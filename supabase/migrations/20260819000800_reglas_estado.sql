-- =============================================================================
-- MISIONES SAR — 08. Reglas del flujo de estados
--
-- El grafo de estados se aplica aquí, en la base de datos. La interfaz replica
-- las mismas reglas para saber qué botones ofrecer, pero quien decide es este
-- trigger: aunque alguien llame a la API directamente, las reglas se cumplen.
--
--   borrador → enviada → en_revision → aprobada
--                 ↑           ↓
--              observada ←────┘
--   cualquier estado → anulada (solo admin, con motivo)
--
-- Nota sobre operaciones sin sesión: cuando auth.uid() es nulo la operación
-- viene del rol de servicio (semilla o mantenimiento), que ya está fuera de la
-- API pública. En ese caso se omiten las comprobaciones de rol y de autoría,
-- pero nunca las de integridad del expediente.
-- =============================================================================

create or replace function public.validar_transicion_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_rol public.rol_usuario := auth.rol_actual();
  v_es_servicio boolean := v_usuario is null;
  v_observaciones_pendientes integer;
begin
  -- ---------------------------------------------------------------------------
  -- Caso 1: el estado no cambia. Solo se comprueba la inmutabilidad.
  -- ---------------------------------------------------------------------------
  if old.estado = new.estado then
    if old.estado = 'aprobada' and not v_es_servicio then
      raise exception 'Una misión aprobada es inmutable: no admite cambios.'
        using errcode = 'check_violation';
    end if;

    if old.estado = 'anulada' and not v_es_servicio then
      raise exception 'Una misión anulada no admite cambios.'
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  -- ---------------------------------------------------------------------------
  -- Caso 2: hay transición. Se valida contra el grafo.
  -- ---------------------------------------------------------------------------

  -- Anular: exclusivo del admin, desde cualquier estado, con motivo.
  if new.estado = 'anulada' then
    if not v_es_servicio and v_rol <> 'admin' then
      raise exception 'Solo un administrador puede anular una misión.'
        using errcode = 'insufficient_privilege';
    end if;

    if length(trim(coalesce(new.motivo_anulacion, ''))) < 10 then
      raise exception 'Anular exige un motivo escrito de al menos 10 caracteres.'
        using errcode = 'check_violation';
    end if;

    new.anulada_por := coalesce(new.anulada_por, v_usuario);
    new.anulada_en := now();
    return new;
  end if;

  -- Ninguna transición sale de un estado terminal.
  if old.estado in ('aprobada', 'anulada') then
    raise exception 'Una misión % no admite más cambios de estado.', old.estado
      using errcode = 'check_violation';
  end if;

  -- Enviar a revisión: solo el creador, solo desde borrador u observada, y solo
  -- con los ocho archivos cargados.
  if new.estado = 'enviada' then
    if old.estado not in ('borrador', 'observada') then
      raise exception 'Solo se envía a revisión una misión en borrador o observada.'
        using errcode = 'check_violation';
    end if;

    if not v_es_servicio then
      if v_rol <> 'operador' then
        raise exception 'Solo el operador que creó la misión puede enviarla a revisión.'
          using errcode = 'insufficient_privilege';
      end if;

      if new.creada_por <> v_usuario then
        raise exception 'Solo quien creó la misión puede enviarla a revisión.'
          using errcode = 'insufficient_privilege';
      end if;
    end if;

    if not public.mision_completa(new.id) then
      raise exception 'Faltan soportes: la misión tiene % de 8 archivos.',
        public.contar_archivos_vigentes(new.id)
        using errcode = 'check_violation';
    end if;

    new.enviada_en := now();

    -- Al reenviar, las observaciones del ciclo anterior quedan atendidas.
    update public.observaciones o
    set resuelta = true, resuelta_en = now(), resuelta_por = v_usuario
    where o.mision_id = new.id and not o.resuelta;

    return new;
  end if;

  -- Tomar en revisión: supervisor o admin, desde enviada.
  if new.estado = 'en_revision' then
    if old.estado <> 'enviada' then
      raise exception 'Solo se toma en revisión una misión enviada.'
        using errcode = 'check_violation';
    end if;

    if not v_es_servicio and v_rol not in ('supervisor', 'admin') then
      raise exception 'Solo un supervisor o un administrador revisa misiones.'
        using errcode = 'insufficient_privilege';
    end if;

    new.revisada_por := coalesce(v_usuario, new.revisada_por);
    new.revisada_en := now();
    return new;
  end if;

  -- Aprobar: supervisor o admin, desde enviada o en revisión.
  if new.estado = 'aprobada' then
    if old.estado not in ('enviada', 'en_revision') then
      raise exception 'Solo se aprueba una misión enviada o en revisión.'
        using errcode = 'check_violation';
    end if;

    if not v_es_servicio and v_rol not in ('supervisor', 'admin') then
      raise exception 'Solo un supervisor o un administrador aprueba misiones.'
        using errcode = 'insufficient_privilege';
    end if;

    -- Se revalida la completitud: entre el envío y la aprobación pudo cambiar.
    if not public.mision_completa(new.id) then
      raise exception 'No se aprueba una misión incompleta: tiene % de 8 archivos.',
        public.contar_archivos_vigentes(new.id)
        using errcode = 'check_violation';
    end if;

    new.revisada_por := coalesce(v_usuario, new.revisada_por);
    new.aprobada_en := now();

    update public.observaciones o
    set resuelta = true, resuelta_en = now(), resuelta_por = v_usuario
    where o.mision_id = new.id and not o.resuelta;

    return new;
  end if;

  -- Devolver con observación: supervisor o admin, y tiene que existir una
  -- observación sin resolver escrita para este ciclo.
  if new.estado = 'observada' then
    if old.estado not in ('enviada', 'en_revision') then
      raise exception 'Solo se devuelve una misión enviada o en revisión.'
        using errcode = 'check_violation';
    end if;

    if not v_es_servicio and v_rol not in ('supervisor', 'admin') then
      raise exception 'Solo un supervisor o un administrador devuelve misiones.'
        using errcode = 'insufficient_privilege';
    end if;

    select count(*) into v_observaciones_pendientes
    from public.observaciones o
    where o.mision_id = new.id and not o.resuelta;

    if v_observaciones_pendientes = 0 then
      raise exception 'Devolver una misión exige registrar antes la observación.'
        using errcode = 'check_violation';
    end if;

    new.revisada_por := coalesce(v_usuario, new.revisada_por);
    new.revisada_en := now();
    return new;
  end if;

  -- Volver a borrador no forma parte del flujo.
  raise exception 'Transición no permitida: % → %.', old.estado, new.estado
    using errcode = 'check_violation';
end;
$$;

create trigger misiones_validar_transicion
  before update on public.misiones
  for each row execute function public.validar_transicion_estado();

comment on function public.validar_transicion_estado is
  'Aplica el grafo de estados, la completitud, la autoría y la inmutabilidad.';

-- -----------------------------------------------------------------------------
-- Los documentos siguen el estado de su misión.
--
-- Solo se cargan o reemplazan mientras la misión está en borrador u observada.
-- El admin puede además corregir una misión enviada o en revisión; sobre una
-- aprobada o anulada no puede nadie.
-- -----------------------------------------------------------------------------
create or replace function public.validar_documento_editable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado public.estado_mision;
  v_rol public.rol_usuario := auth.rol_actual();
  v_es_servicio boolean := (select auth.uid()) is null;
begin
  select m.estado into v_estado
  from public.misiones m
  where m.id = new.mision_id;

  if v_estado is null then
    raise exception 'La misión indicada no existe.' using errcode = 'foreign_key_violation';
  end if;

  if v_es_servicio then
    return new;
  end if;

  if v_estado in ('aprobada', 'anulada') then
    raise exception 'Una misión % no admite cambios en sus soportes.', v_estado
      using errcode = 'check_violation';
  end if;

  if v_estado in ('enviada', 'en_revision') and v_rol <> 'admin' then
    raise exception 'La misión está en revisión: sus soportes no se pueden modificar.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger documentos_validar_editable
  before insert or update on public.documentos
  for each row execute function public.validar_documento_editable();

-- -----------------------------------------------------------------------------
-- Notificaciones automáticas por cambio de estado.
-- -----------------------------------------------------------------------------
create or replace function public.notificar_cambio_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.estado = new.estado then
    return null;
  end if;

  if new.estado = 'enviada' then
    -- A la bandeja de todos los supervisores activos de la unidad.
    insert into public.notificaciones (destinatario_id, mision_id, tipo)
    select p.id, new.id, 'mision_enviada'
    from public.perfiles p
    where p.rol = 'supervisor' and p.activo and p.unidad_id = new.unidad_id;

  elsif new.estado = 'observada' then
    insert into public.notificaciones (destinatario_id, mision_id, tipo)
    values (new.creada_por, new.id, 'mision_observada');

  elsif new.estado = 'aprobada' then
    insert into public.notificaciones (destinatario_id, mision_id, tipo)
    values (new.creada_por, new.id, 'mision_aprobada');

  elsif new.estado = 'anulada' then
    insert into public.notificaciones (destinatario_id, mision_id, tipo)
    values (new.creada_por, new.id, 'mision_anulada');
  end if;

  return null;
end;
$$;

create trigger misiones_notificar_estado
  after update on public.misiones
  for each row execute function public.notificar_cambio_estado();
