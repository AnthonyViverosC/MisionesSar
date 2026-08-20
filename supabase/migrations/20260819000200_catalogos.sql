-- =============================================================================
-- MISIONES SAR — 02. Catálogos administrables
--
-- Unidades, aeronaves y tipos de misión son datos que el admin mantiene desde
-- la aplicación. La unidad es además la frontera de visibilidad: de ella
-- dependen las políticas de RLS de operador y supervisor, por eso es una clave
-- foránea y no un texto libre.
-- =============================================================================

create table public.unidades (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint unidades_codigo_no_vacio check (length(trim(codigo)) > 0),
  constraint unidades_nombre_no_vacio check (length(trim(nombre)) > 0)
);

comment on table public.unidades is
  'Unidades aéreas. Delimitan qué misiones ve cada operador y supervisor.';

create table public.aeronaves (
  id uuid primary key default gen_random_uuid(),
  matricula text not null unique,
  tipo text not null,
  unidad_id uuid not null references public.unidades (id) on delete restrict,
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  -- Matrícula en mayúsculas y sin espacios, para que el listado sea uniforme.
  constraint aeronaves_matricula_formato check (matricula = upper(trim(matricula)))
);

comment on table public.aeronaves is 'Aeronaves por unidad, identificadas por matrícula.';

create index aeronaves_unidad_idx on public.aeronaves (unidad_id);

create table public.tipos_mision (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  activo boolean not null default true,
  orden smallint not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.tipos_mision is
  'Tipos de misión (búsqueda, rescate, traslado, …), administrables.';

-- Marca de última modificación en los tres catálogos.
create trigger unidades_actualizado_en
  before update on public.unidades
  for each row execute function public.tocar_actualizado_en();

create trigger aeronaves_actualizado_en
  before update on public.aeronaves
  for each row execute function public.tocar_actualizado_en();

create trigger tipos_mision_actualizado_en
  before update on public.tipos_mision
  for each row execute function public.tocar_actualizado_en();
