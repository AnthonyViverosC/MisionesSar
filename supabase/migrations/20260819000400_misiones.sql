-- =============================================================================
-- MISIONES SAR — 04. Misiones
--
-- Cada fila es una misión de búsqueda y rescate y el expediente de sus ocho
-- soportes. Las misiones no se borran nunca: se anulan con motivo.
-- =============================================================================

create table public.misiones (
  id uuid primary key default gen_random_uuid(),

  -- Identificación. El número lo asigna la unidad, con formato AAAA-NNN, y solo
  -- puede repetirse entre años distintos.
  numero_mision text not null,
  anio smallint not null,

  -- Ventana temporal de la operación.
  fecha_inicio date not null,
  fecha_fin date,

  -- Clasificación. Se guarda la referencia al catálogo y también el texto del
  -- momento, para que el expediente no cambie si mañana se renombra el catálogo.
  tipo_mision_id uuid not null references public.tipos_mision (id) on delete restrict,
  tipo_mision text not null,
  aeronave_id uuid not null references public.aeronaves (id) on delete restrict,
  aeronave_matricula text not null,
  unidad_id uuid not null references public.unidades (id) on delete restrict,

  -- Datos operacionales.
  comandante_aeronave text not null,
  zona_operacion text not null,
  latitud numeric(9, 6),
  longitud numeric(9, 6),
  horas_vuelo numeric(6, 2),
  resumen text,

  -- Flujo de revisión.
  estado public.estado_mision not null default 'borrador',
  creada_por uuid not null references public.perfiles (id) on delete restrict,
  enviada_en timestamptz,
  revisada_por uuid references public.perfiles (id) on delete restrict,
  revisada_en timestamptz,
  aprobada_en timestamptz,
  motivo_anulacion text,
  anulada_por uuid references public.perfiles (id) on delete restrict,
  anulada_en timestamptz,

  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  -- Un número de misión es único dentro de su año.
  constraint misiones_numero_unico_por_anio unique (anio, numero_mision),
  constraint misiones_numero_formato check (numero_mision ~ '^[0-9]{4}-[0-9]{3}$'),
  constraint misiones_anio_valido check (anio between 2000 and 2100),
  constraint misiones_fechas_coherentes check (fecha_fin is null or fecha_fin >= fecha_inicio),
  constraint misiones_horas_positivas check (horas_vuelo is null or horas_vuelo >= 0),
  constraint misiones_latitud_valida check (latitud is null or latitud between -90 and 90),
  constraint misiones_longitud_valida check (longitud is null or longitud between -180 and 180),
  -- Coordenadas: o van las dos o no va ninguna.
  constraint misiones_coordenadas_completas check (
    (latitud is null and longitud is null) or (latitud is not null and longitud is not null)
  ),
  -- Anular exige siempre motivo escrito.
  constraint misiones_anulacion_con_motivo check (
    estado <> 'anulada' or length(trim(coalesce(motivo_anulacion, ''))) >= 10
  ),
  constraint misiones_comandante_no_vacio check (length(trim(comandante_aeronave)) > 0),
  constraint misiones_zona_no_vacia check (length(trim(zona_operacion)) > 0)
);

comment on table public.misiones is
  'Expediente de una misión SAR. Se anula con motivo; nunca se borra.';

-- Índices de los filtros y ordenamientos del listado.
create index misiones_numero_idx on public.misiones (numero_mision);
create index misiones_estado_idx on public.misiones (estado);
create index misiones_fecha_inicio_idx on public.misiones (fecha_inicio desc);
create index misiones_unidad_idx on public.misiones (unidad_id);
create index misiones_creada_por_idx on public.misiones (creada_por);
create index misiones_aeronave_idx on public.misiones (aeronave_id);
-- Bandeja del supervisor: misiones pendientes de decisión, por antigüedad.
create index misiones_bandeja_idx on public.misiones (unidad_id, enviada_en)
  where estado in ('enviada', 'en_revision');

create trigger misiones_actualizado_en
  before update on public.misiones
  for each row execute function public.tocar_actualizado_en();

-- -----------------------------------------------------------------------------
-- Coherencia de los datos derivados del catálogo.
--
-- El año sale de la fecha de inicio, y el texto de tipo y matrícula se copia del
-- catálogo en el momento de guardar. Así el cliente no puede escribir una
-- matrícula que no existe ni desalinear el año del número de misión.
-- -----------------------------------------------------------------------------
create or replace function public.completar_datos_mision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_matricula text;
  v_unidad_aeronave uuid;
  v_tipo text;
begin
  new.anio := extract(year from new.fecha_inicio)::smallint;

  -- El número de misión debe empezar por su año.
  if left(new.numero_mision, 4) <> new.anio::text then
    raise exception 'El número de misión % no corresponde al año % de la fecha de inicio.',
      new.numero_mision, new.anio
      using errcode = 'check_violation';
  end if;

  select a.matricula, a.unidad_id into v_matricula, v_unidad_aeronave
  from public.aeronaves a
  where a.id = new.aeronave_id;

  if v_matricula is null then
    raise exception 'La aeronave indicada no existe.' using errcode = 'foreign_key_violation';
  end if;

  new.aeronave_matricula := v_matricula;

  -- La aeronave tiene que pertenecer a la unidad de la misión.
  if v_unidad_aeronave <> new.unidad_id then
    raise exception 'La aeronave % no pertenece a la unidad de la misión.', v_matricula
      using errcode = 'check_violation';
  end if;

  select t.nombre into v_tipo
  from public.tipos_mision t
  where t.id = new.tipo_mision_id;

  if v_tipo is null then
    raise exception 'El tipo de misión indicado no existe.' using errcode = 'foreign_key_violation';
  end if;

  new.tipo_mision := v_tipo;

  return new;
end;
$$;

create trigger misiones_completar_datos
  before insert or update of fecha_inicio, aeronave_id, tipo_mision_id, unidad_id, numero_mision
  on public.misiones
  for each row execute function public.completar_datos_mision();
