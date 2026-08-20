-- =============================================================================
-- MISIONES SAR — 06. Observaciones y notificaciones
-- =============================================================================

-- Hilo de observaciones de una misión. El supervisor escribe al devolver y el
-- operador responde; ninguna observación se borra.
create table public.observaciones (
  id uuid primary key default gen_random_uuid(),
  mision_id uuid not null references public.misiones (id) on delete restrict,
  autor_id uuid not null references public.perfiles (id) on delete restrict,
  texto text not null,
  resuelta boolean not null default false,
  resuelta_en timestamptz,
  resuelta_por uuid references public.perfiles (id) on delete restrict,
  creado_en timestamptz not null default now(),

  -- Una observación vacía no devuelve información al operador.
  constraint observaciones_texto_minimo check (length(trim(texto)) >= 10),
  constraint observaciones_resuelta_coherente check (
    (not resuelta and resuelta_en is null) or (resuelta and resuelta_en is not null)
  )
);

comment on table public.observaciones is
  'Hilo de revisión de una misión. Devolver a observada exige una observación.';

create index observaciones_mision_idx on public.observaciones (mision_id, creado_en desc);
create index observaciones_pendientes_idx on public.observaciones (mision_id) where not resuelta;

-- Avisos dirigidos a un usuario concreto: al operador cuando le devuelven o le
-- aprueban una misión, al supervisor cuando entra una misión a su bandeja.
create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references public.perfiles (id) on delete restrict,
  mision_id uuid not null references public.misiones (id) on delete restrict,
  tipo public.tipo_notificacion not null,
  leida boolean not null default false,
  leida_en timestamptz,
  creado_en timestamptz not null default now()
);

comment on table public.notificaciones is 'Avisos por usuario sobre cambios de estado de misiones.';

create index notificaciones_pendientes_idx
  on public.notificaciones (destinatario_id, creado_en desc)
  where not leida;
