-- =============================================================================
-- MISIONES SAR — 07. Auditoría
--
-- Registro inmutable. La aplicación no escribe aquí: lo hacen los triggers de
-- las tablas auditadas. La única excepción son los eventos de autenticación,
-- que no tienen tabla propia y entran por una función controlada reservada al
-- rol de servicio (ver `registrar_evento_autenticacion`).
--
-- La tabla no tiene políticas de UPDATE ni de DELETE: nadie, con ningún rol de
-- la API, puede alterar lo registrado.
-- =============================================================================

create table public.auditoria (
  id bigint generated always as identity primary key,
  actor_id uuid references public.perfiles (id) on delete restrict,
  actor_email text,
  accion public.accion_auditoria not null,
  entidad text not null,
  entidad_id text,
  datos_antes jsonb,
  datos_despues jsonb,
  ip inet,
  user_agent text,
  creado_en timestamptz not null default now()
);

comment on table public.auditoria is
  'Bitácora inmutable. Solo inserción, y solo desde triggers o funciones de servicio.';

create index auditoria_entidad_idx on public.auditoria (entidad, entidad_id);
create index auditoria_actor_idx on public.auditoria (actor_id, creado_en desc);
create index auditoria_fecha_idx on public.auditoria (creado_en desc);
create index auditoria_accion_idx on public.auditoria (accion);

-- -----------------------------------------------------------------------------
-- Datos de contexto de la petición.
--
-- PostgREST publica las cabeceras de la petición en un ajuste de sesión. Fuera
-- de una petición HTTP (semilla, mantenimiento) sencillamente no hay contexto y
-- se registra nulo.
-- -----------------------------------------------------------------------------
create or replace function public.ip_peticion()
returns inet
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cabeceras jsonb;
  v_ip text;
begin
  v_cabeceras := nullif(current_setting('request.headers', true), '')::jsonb;
  if v_cabeceras is null then
    return null;
  end if;

  -- x-forwarded-for puede traer varias IP: la primera es la del cliente.
  v_ip := split_part(coalesce(v_cabeceras ->> 'x-forwarded-for', ''), ',', 1);
  v_ip := trim(v_ip);

  if v_ip = '' then
    return null;
  end if;

  return v_ip::inet;
exception
  when others then
    return null;
end;
$$;

create or replace function public.agente_peticion()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cabeceras jsonb;
begin
  v_cabeceras := nullif(current_setting('request.headers', true), '')::jsonb;
  if v_cabeceras is null then
    return null;
  end if;
  return left(v_cabeceras ->> 'user-agent', 500);
exception
  when others then
    return null;
end;
$$;

create or replace function public.correo_actual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text from auth.users u where u.id = (select auth.uid())
$$;

-- -----------------------------------------------------------------------------
-- Trigger genérico de auditoría.
--
-- Se instala en las tablas del expediente. Clasifica la acción según la tabla y
-- la operación, y guarda la fila antes y después.
-- -----------------------------------------------------------------------------
create or replace function public.auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_accion public.accion_auditoria;
  v_antes jsonb;
  v_despues jsonb;
  v_entidad_id text;
begin
  v_antes := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_despues := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_entidad_id := coalesce(v_despues ->> 'id', v_antes ->> 'id');

  if tg_table_name = 'misiones' then
    if tg_op = 'INSERT' then
      v_accion := 'crear';
    elsif old.estado is distinct from new.estado then
      v_accion := case new.estado
        when 'anulada' then 'anular'::public.accion_auditoria
        when 'observada' then 'observar'::public.accion_auditoria
        else 'cambiar_estado'::public.accion_auditoria
      end;
    else
      v_accion := 'actualizar';
    end if;

  elsif tg_table_name = 'documentos' then
    if tg_op = 'INSERT' then
      v_accion := case when new.version > 1
        then 'reemplazar_documento'::public.accion_auditoria
        else 'subir_documento'::public.accion_auditoria
      end;
    else
      v_accion := 'actualizar';
    end if;

  elsif tg_table_name = 'perfiles' then
    if tg_op = 'INSERT' then
      v_accion := 'invitar_usuario';
    elsif old.rol is distinct from new.rol then
      v_accion := 'cambiar_rol';
    elsif old.activo and not new.activo then
      v_accion := 'desactivar_usuario';
    else
      v_accion := 'actualizar';
    end if;

  elsif tg_table_name = 'observaciones' then
    v_accion := case when tg_op = 'INSERT'
      then 'observar'::public.accion_auditoria
      else 'actualizar'::public.accion_auditoria
    end;

  else
    v_accion := case when tg_op = 'INSERT'
      then 'crear'::public.accion_auditoria
      else 'actualizar'::public.accion_auditoria
    end;
  end if;

  insert into public.auditoria (
    actor_id, actor_email, accion, entidad, entidad_id,
    datos_antes, datos_despues, ip, user_agent
  )
  values (
    (select auth.uid()),
    public.correo_actual(),
    v_accion,
    tg_table_name,
    v_entidad_id,
    v_antes,
    v_despues,
    public.ip_peticion(),
    public.agente_peticion()
  );

  return null; -- trigger AFTER: el valor de retorno se ignora
end;
$$;

create trigger misiones_auditar
  after insert or update on public.misiones
  for each row execute function public.auditar();

create trigger documentos_auditar
  after insert or update on public.documentos
  for each row execute function public.auditar();

create trigger perfiles_auditar
  after insert or update on public.perfiles
  for each row execute function public.auditar();

create trigger observaciones_auditar
  after insert or update on public.observaciones
  for each row execute function public.auditar();

-- -----------------------------------------------------------------------------
-- Eventos que no nacen de una tabla: ingresos, cierres de sesión y descargas.
--
-- La función es SECURITY DEFINER y solo el rol de servicio puede ejecutarla, de
-- modo que sigue siendo imposible escribir en la auditoría desde el navegador.
-- Además solo admite el subconjunto de acciones que no cubren los triggers.
-- -----------------------------------------------------------------------------
create or replace function public.registrar_evento_autenticacion(
  p_accion public.accion_auditoria,
  p_actor_id uuid,
  p_actor_email text,
  p_ip text default null,
  p_user_agent text default null,
  p_detalle jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_accion not in (
    'ingreso_exitoso', 'ingreso_fallido', 'cerrar_sesion', 'descargar_documento'
  ) then
    raise exception 'Acción % no admitida por esta función.', p_accion
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.auditoria (
    actor_id, actor_email, accion, entidad, entidad_id,
    datos_despues, ip, user_agent
  )
  values (
    p_actor_id,
    left(p_actor_email, 320),
    p_accion,
    case when p_accion = 'descargar_documento' then 'documentos' else 'autenticacion' end,
    p_detalle ->> 'entidad_id',
    p_detalle,
    (
      case
        when p_ip is null or trim(p_ip) = '' then null
        else trim(split_part(p_ip, ',', 1))::inet
      end
    ),
    left(p_user_agent, 500)
  );
exception
  when invalid_text_representation then
    -- Una IP mal formada no puede impedir que quede el registro.
    insert into public.auditoria (
      actor_id, actor_email, accion, entidad, entidad_id, datos_despues, user_agent
    )
    values (
      p_actor_id, left(p_actor_email, 320), p_accion,
      case when p_accion = 'descargar_documento' then 'documentos' else 'autenticacion' end,
      p_detalle ->> 'entidad_id', p_detalle, left(p_user_agent, 500)
    );
end;
$$;

revoke execute on function public.registrar_evento_autenticacion from public, anon, authenticated;
grant execute on function public.registrar_evento_autenticacion to service_role;

-- -----------------------------------------------------------------------------
-- Control de intentos de ingreso.
--
-- Cinco fallos desde la misma cuenta o la misma IP bloquean quince minutos. Se
-- consulta y se escribe solo desde el servidor con el rol de servicio.
-- -----------------------------------------------------------------------------
create table public.intentos_ingreso (
  id bigint generated always as identity primary key,
  correo text,
  ip inet,
  exitoso boolean not null,
  creado_en timestamptz not null default now()
);

comment on table public.intentos_ingreso is
  'Intentos de ingreso recientes, para el bloqueo temporal por fuerza bruta.';

create index intentos_ingreso_correo_idx on public.intentos_ingreso (correo, creado_en desc);
create index intentos_ingreso_ip_idx on public.intentos_ingreso (ip, creado_en desc);

create or replace function public.ingreso_bloqueado(p_correo text, p_ip text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ip inet;
  v_fallos integer;
begin
  begin
    v_ip := nullif(trim(split_part(coalesce(p_ip, ''), ',', 1)), '')::inet;
  exception when others then
    v_ip := null;
  end;

  select count(*) into v_fallos
  from public.intentos_ingreso i
  where not i.exitoso
    and i.creado_en > now() - interval '15 minutes'
    and (
      (p_correo is not null and lower(i.correo) = lower(p_correo))
      or (v_ip is not null and i.ip = v_ip)
    );

  return v_fallos >= 5;
end;
$$;

create or replace function public.registrar_intento_ingreso(
  p_correo text,
  p_ip text,
  p_exitoso boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip inet;
begin
  begin
    v_ip := nullif(trim(split_part(coalesce(p_ip, ''), ',', 1)), '')::inet;
  exception when others then
    v_ip := null;
  end;

  insert into public.intentos_ingreso (correo, ip, exitoso)
  values (lower(nullif(trim(p_correo), '')), v_ip, p_exitoso);

  -- Al acertar se limpian los fallos previos de esa cuenta.
  if p_exitoso then
    delete from public.intentos_ingreso
    where correo = lower(trim(p_correo)) and not exitoso;
  end if;

  -- Poda: el registro de intentos no es un archivo histórico.
  delete from public.intentos_ingreso where creado_en < now() - interval '1 day';
end;
$$;

revoke execute on function public.ingreso_bloqueado from public, anon, authenticated;
revoke execute on function public.registrar_intento_ingreso from public, anon, authenticated;
grant execute on function public.ingreso_bloqueado to service_role;
grant execute on function public.registrar_intento_ingreso to service_role;
