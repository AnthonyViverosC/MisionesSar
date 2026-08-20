-- =============================================================================
-- MISIONES SAR — 09. Row Level Security
--
-- Política por defecto: denegar todo. RLS queda activo en todas las tablas y
-- cada operación (select, insert, update, delete) tiene su política explícita y
-- comentada. Lo que no aparece aquí, no se puede hacer desde la API.
--
-- Resumen de fronteras:
--   admin      → todo
--   operador   → solo las misiones que él creó
--   supervisor → todas las misiones de su unidad, sin editar contenido
--   consulta   → solo lectura de misiones aprobadas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permisos de tabla. Con RLS activo el GRANT es condición necesaria pero no
-- suficiente: la fila además tiene que pasar la política.
-- Nadie recibe DELETE en ninguna tabla del expediente: nada se borra nunca.
-- -----------------------------------------------------------------------------
grant select on public.unidades, public.aeronaves, public.tipos_mision to authenticated;
grant insert, update on public.unidades, public.aeronaves, public.tipos_mision to authenticated;
grant select, update on public.perfiles to authenticated;
grant select, insert, update on public.misiones to authenticated;
grant select, insert, update on public.documentos to authenticated;
grant select, insert, update on public.observaciones to authenticated;
grant select, update on public.notificaciones to authenticated;
grant select on public.auditoria to authenticated;
grant select on public.misiones_con_completitud to authenticated;

-- El rol de servicio administra desde el servidor (invitaciones, URL firmadas,
-- semilla). Salta RLS, pero el GRANT sigue haciendo falta: Supabase ya no
-- expone automáticamente las tablas nuevas a los roles de la API.
-- Tampoco recibe DELETE: la regla de que nada se borra vale también aquí.
grant select, insert, update on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.unidades enable row level security;
alter table public.aeronaves enable row level security;
alter table public.tipos_mision enable row level security;
alter table public.perfiles enable row level security;
alter table public.misiones enable row level security;
alter table public.documentos enable row level security;
alter table public.observaciones enable row level security;
alter table public.notificaciones enable row level security;
alter table public.auditoria enable row level security;
alter table public.intentos_ingreso enable row level security;

-- =============================================================================
-- Funciones de apoyo
-- =============================================================================

-- ¿El usuario puede modificar el expediente de esta misión?
-- Operador: sus propias misiones en borrador u observada.
-- Admin: cualquiera que no esté aprobada ni anulada.
-- Supervisor y consulta: nunca.
create or replace function public.puede_editar_mision(p_mision_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_estado public.estado_mision;
  v_creada_por uuid;
  v_rol public.rol_usuario := public.rol_actual();
  v_usuario uuid := (select auth.uid());
begin
  select m.estado, m.creada_por into v_estado, v_creada_por
  from public.misiones m
  where m.id = p_mision_id;

  if v_estado is null then
    return false;
  end if;

  if v_rol = 'admin' then
    return v_estado not in ('aprobada', 'anulada');
  end if;

  if v_rol = 'operador' then
    return v_creada_por = v_usuario and v_estado in ('borrador', 'observada');
  end if;

  return false;
end;
$$;

grant execute on function public.puede_editar_mision to authenticated, service_role;

-- Directorio de personal: nombre y grado de cualquier usuario, sin exponer
-- documento, teléfono ni rol. Permite mostrar "creada por" sin abrir `perfiles`.
-- La vista se ejecuta con los permisos de su propietario (no security_invoker),
-- que es justamente lo que la hace utilizable por todos los roles.
create or replace view public.directorio as
select p.id, p.nombre_completo, p.grado
from public.perfiles p;

revoke all on public.directorio from anon;
grant select on public.directorio to authenticated;

comment on view public.directorio is
  'Nombre y grado del personal. Vista mínima para mostrar autorías.';

-- =============================================================================
-- Catálogos: todos consultan, solo el admin mantiene
-- =============================================================================

-- SELECT: cualquier usuario autenticado necesita los catálogos para los filtros
-- del listado y para el formulario de misión.
create policy unidades_select on public.unidades
  for select to authenticated
  using (true);

-- INSERT / UPDATE: exclusivo del admin. No hay DELETE: un catálogo se desactiva.
create policy unidades_insert on public.unidades
  for insert to authenticated
  with check (public.tiene_rol('admin'));

create policy unidades_update on public.unidades
  for update to authenticated
  using (public.tiene_rol('admin'))
  with check (public.tiene_rol('admin'));

create policy aeronaves_select on public.aeronaves
  for select to authenticated
  using (true);

create policy aeronaves_insert on public.aeronaves
  for insert to authenticated
  with check (public.tiene_rol('admin'));

create policy aeronaves_update on public.aeronaves
  for update to authenticated
  using (public.tiene_rol('admin'))
  with check (public.tiene_rol('admin'));

create policy tipos_mision_select on public.tipos_mision
  for select to authenticated
  using (true);

create policy tipos_mision_insert on public.tipos_mision
  for insert to authenticated
  with check (public.tiene_rol('admin'));

create policy tipos_mision_update on public.tipos_mision
  for update to authenticated
  using (public.tiene_rol('admin'))
  with check (public.tiene_rol('admin'));

-- =============================================================================
-- Perfiles
-- =============================================================================

-- SELECT: cada quien ve su perfil; el supervisor ve el de su unidad para saber
-- quién le envía misiones; el admin ve todos.
create policy perfiles_select on public.perfiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or public.tiene_rol('admin')
    or (public.tiene_rol('supervisor') and unidad_id = public.unidad_actual())
  );

-- INSERT: ninguna política. Los perfiles nacen del trigger sobre auth.users
-- cuando el admin cursa la invitación; no se crean desde el navegador.

-- UPDATE: el usuario mantiene sus propios datos de contacto y el admin
-- administra a todos. Qué columnas puede tocar cada uno lo controla el trigger
-- `proteger_campos_perfil`, porque RLS no distingue columnas.
create policy perfiles_update on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()) or public.tiene_rol('admin'))
  with check (id = (select auth.uid()) or public.tiene_rol('admin'));

-- DELETE: ninguna política. Un usuario se desactiva, no se borra.

-- Rol, unidad y estado de actividad son atribuciones del admin: nadie se
-- asciende a sí mismo cambiando su propio perfil.
create or replace function public.proteger_campos_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
begin
  -- Sin sesión es el rol de servicio (invitaciones, semilla).
  if v_usuario is null or public.tiene_rol('admin') then
    return new;
  end if;

  if new.rol is distinct from old.rol
     or new.unidad_id is distinct from old.unidad_id
     or new.activo is distinct from old.activo then
    raise exception 'El rol, la unidad y el estado de la cuenta solo los cambia un administrador.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger perfiles_proteger_campos
  before update on public.perfiles
  for each row execute function public.proteger_campos_perfil();

-- =============================================================================
-- Misiones
-- =============================================================================

-- SELECT: cada rol tiene su frontera.
--   admin      → todas
--   operador   → las que creó
--   supervisor → las de su unidad
--   consulta   → solo aprobadas
create policy misiones_select on public.misiones
  for select to authenticated
  using (
    public.tiene_rol('admin')
    or (public.tiene_rol('operador') and creada_por = (select auth.uid()))
    or (public.tiene_rol('supervisor') and unidad_id = public.unidad_actual())
    or (public.tiene_rol('consulta') and estado = 'aprobada')
  );

-- INSERT: el operador crea misiones a su nombre y dentro de su unidad; el admin
-- puede crear en cualquier unidad. Toda misión nace en borrador.
create policy misiones_insert on public.misiones
  for insert to authenticated
  with check (
    (
      public.tiene_rol('operador')
      and creada_por = (select auth.uid())
      and unidad_id = public.unidad_actual()
      and estado = 'borrador'
    )
    or public.tiene_rol('admin')
  );

-- UPDATE: el operador corrige lo suyo mientras esté abierto; el supervisor toca
-- las de su unidad solo para revisarlas; el admin, todo lo no aprobado.
-- El grafo de estados y la inmutabilidad los aplica el trigger
-- `validar_transicion_estado`; el alcance de columnas, `proteger_campos_mision`.
create policy misiones_update on public.misiones
  for update to authenticated
  using (
    public.tiene_rol('admin')
    or (
      public.tiene_rol('operador')
      and creada_por = (select auth.uid())
      and estado in ('borrador', 'observada')
    )
    or (
      public.tiene_rol('supervisor')
      and unidad_id = public.unidad_actual()
      and estado in ('enviada', 'en_revision')
    )
  )
  with check (
    public.tiene_rol('admin')
    or (public.tiene_rol('operador') and creada_por = (select auth.uid()))
    or (public.tiene_rol('supervisor') and unidad_id = public.unidad_actual())
  );

-- DELETE: ninguna política. Las misiones se anulan con motivo.

-- El supervisor revisa, no edita: solo puede mover el estado y los campos de
-- revisión. El operador, al revés, no se aprueba sus propias misiones.
create or replace function public.proteger_campos_mision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol public.rol_usuario := public.rol_actual();
begin
  if (select auth.uid()) is null or v_rol = 'admin' then
    return new;
  end if;

  if v_rol = 'supervisor' then
    if new.numero_mision is distinct from old.numero_mision
       or new.fecha_inicio is distinct from old.fecha_inicio
       or new.fecha_fin is distinct from old.fecha_fin
       or new.tipo_mision_id is distinct from old.tipo_mision_id
       or new.aeronave_id is distinct from old.aeronave_id
       or new.unidad_id is distinct from old.unidad_id
       or new.comandante_aeronave is distinct from old.comandante_aeronave
       or new.zona_operacion is distinct from old.zona_operacion
       or new.latitud is distinct from old.latitud
       or new.longitud is distinct from old.longitud
       or new.horas_vuelo is distinct from old.horas_vuelo
       or new.resumen is distinct from old.resumen
       or new.creada_por is distinct from old.creada_por then
      raise exception 'El supervisor revisa la misión; no modifica lo que cargó el operador.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if v_rol = 'operador' then
    -- El operador solo puede llevar su misión a "enviada".
    if new.estado is distinct from old.estado and new.estado <> 'enviada' then
      raise exception 'El operador solo puede enviar la misión a revisión.'
        using errcode = 'insufficient_privilege';
    end if;

    if new.creada_por is distinct from old.creada_por then
      raise exception 'La autoría de una misión no se transfiere.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

create trigger misiones_proteger_campos
  before update on public.misiones
  for each row execute function public.proteger_campos_mision();

-- =============================================================================
-- Documentos
-- =============================================================================

-- SELECT: se ve el documento si se ve la misión. La subconsulta pasa por la
-- política de `misiones`, de modo que la frontera se define en un solo lugar.
create policy documentos_select on public.documentos
  for select to authenticated
  using (
    exists (select 1 from public.misiones m where m.id = documentos.mision_id)
  );

-- INSERT: solo quien puede editar el expediente. El estado de la misión lo
-- comprueba además el trigger `validar_documento_editable`.
create policy documentos_insert on public.documentos
  for insert to authenticated
  with check (
    public.puede_editar_mision(mision_id)
    and subido_por = (select auth.uid())
  );

-- UPDATE: la única modificación legítima es marcar vigente = false al
-- reemplazar. Se permite a quien puede editar el expediente.
create policy documentos_update on public.documentos
  for update to authenticated
  using (public.puede_editar_mision(mision_id))
  with check (public.puede_editar_mision(mision_id));

-- DELETE: ninguna política. Las versiones anteriores se conservan.

-- =============================================================================
-- Observaciones
-- =============================================================================

-- SELECT: quien ve la misión ve su hilo de revisión. El rol de consulta queda
-- fuera: solo accede a misiones aprobadas y sin la conversación interna.
create policy observaciones_select on public.observaciones
  for select to authenticated
  using (
    not public.tiene_rol('consulta')
    and exists (select 1 from public.misiones m where m.id = observaciones.mision_id)
  );

-- INSERT: el supervisor y el admin observan; el operador responde en su propia
-- misión. Siempre a nombre propio.
create policy observaciones_insert on public.observaciones
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and (
      (
        public.tiene_rol('supervisor', 'admin')
        and exists (select 1 from public.misiones m where m.id = observaciones.mision_id)
      )
      or (
        public.tiene_rol('operador')
        and exists (
          select 1 from public.misiones m
          where m.id = observaciones.mision_id
            and m.creada_por = (select auth.uid())
        )
      )
    )
  );

-- UPDATE: marcar una observación como resuelta corresponde a quien revisa. El
-- texto no se reescribe (lo impide `proteger_texto_observacion`).
create policy observaciones_update on public.observaciones
  for update to authenticated
  using (
    public.tiene_rol('supervisor', 'admin')
    and exists (select 1 from public.misiones m where m.id = observaciones.mision_id)
  )
  with check (
    public.tiene_rol('supervisor', 'admin')
    and exists (select 1 from public.misiones m where m.id = observaciones.mision_id)
  );

-- DELETE: ninguna política.

create or replace function public.proteger_texto_observacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and (new.texto is distinct from old.texto or new.autor_id is distinct from old.autor_id) then
    raise exception 'Una observación registrada no se reescribe.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger observaciones_proteger_texto
  before update on public.observaciones
  for each row execute function public.proteger_texto_observacion();

-- =============================================================================
-- Notificaciones
-- =============================================================================

-- SELECT: cada usuario ve las suyas.
create policy notificaciones_select on public.notificaciones
  for select to authenticated
  using (destinatario_id = (select auth.uid()));

-- UPDATE: solo para marcarlas como leídas.
create policy notificaciones_update on public.notificaciones
  for update to authenticated
  using (destinatario_id = (select auth.uid()))
  with check (destinatario_id = (select auth.uid()));

-- INSERT y DELETE: ninguna política. Las crea el trigger de cambio de estado.

-- =============================================================================
-- Auditoría
-- =============================================================================

-- SELECT: el admin consulta la bitácora completa. El supervisor solo ve lo
-- ocurrido sobre misiones de su unidad, que es su ámbito de responsabilidad.
create policy auditoria_select on public.auditoria
  for select to authenticated
  using (
    public.tiene_rol('admin')
    or (
      public.tiene_rol('supervisor')
      and entidad in ('misiones', 'documentos', 'observaciones')
      and exists (
        select 1
        from public.misiones m
        where m.unidad_id = public.unidad_actual()
          and (
            (auditoria.entidad = 'misiones' and auditoria.entidad_id = m.id::text)
            or (
              auditoria.entidad in ('documentos', 'observaciones')
              and coalesce(
                auditoria.datos_despues ->> 'mision_id',
                auditoria.datos_antes ->> 'mision_id'
              ) = m.id::text
            )
          )
      )
    )
  );

-- INSERT, UPDATE y DELETE: ninguna política, a propósito. Los registros entran
-- por triggers SECURITY DEFINER; desde la API la bitácora es de solo lectura.

-- =============================================================================
-- Intentos de ingreso
-- =============================================================================

-- Sin políticas: RLS activo y ninguna regla equivale a acceso denegado para
-- todos los roles de la API. Solo el rol de servicio, que salta RLS, lo usa
-- desde el servidor para el bloqueo por fuerza bruta.
