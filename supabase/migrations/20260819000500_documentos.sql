-- =============================================================================
-- MISIONES SAR — 05. Documentos
--
-- Un documento nunca se borra. Al reemplazarlo se inserta una versión nueva y
-- la anterior queda con vigente = false, conservando su archivo en el bucket.
-- =============================================================================

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  mision_id uuid not null references public.misiones (id) on delete restrict,
  tipo public.tipo_documento not null,

  -- Nombre con el que el usuario subió el archivo, solo para mostrar y para el
  -- ZIP. La ruta real nunca lo usa.
  nombre_original text not null,
  -- Ruta dentro del bucket: <mision_id>/<tipo>/<uuid>.<ext>
  ruta_almacenamiento text not null unique,
  bucket text not null,
  mime_type text not null,
  tamano_bytes bigint not null,
  -- SHA-256 en hexadecimal, calculado en el navegador y revalidado al descargar.
  hash_sha256 text not null,

  version integer not null default 1,
  vigente boolean not null default true,
  subido_por uuid not null references public.perfiles (id) on delete restrict,
  reemplazado_en timestamptz,
  creado_en timestamptz not null default now(),

  constraint documentos_version_positiva check (version >= 1),
  constraint documentos_tamano_positivo check (tamano_bytes > 0),
  constraint documentos_hash_formato check (hash_sha256 ~ '^[0-9a-f]{64}$'),
  constraint documentos_bucket_valido check (bucket in ('documentos-pdf', 'archivo-filmico')),

  -- Cada tipo admite un solo formato y un tamaño máximo propio. Se comprueba
  -- aquí además de en el servidor: si alguien llegara a la tabla por otra vía,
  -- la regla sigue aplicando.
  constraint documentos_formato_valido check (
    case tipo
      when 'foto' then mime_type in ('image/jpeg', 'image/png') and tamano_bytes <= 10485760
      when 'video' then mime_type = 'video/mp4' and tamano_bytes <= 524288000
      else mime_type = 'application/pdf' and tamano_bytes <= 20971520
    end
  ),

  -- El bucket depende del tipo: los PDF nunca caen en el archivo fílmico.
  constraint documentos_bucket_coherente check (
    case
      when tipo in ('foto', 'video') then bucket = 'archivo-filmico'
      else bucket = 'documentos-pdf'
    end
  ),

  -- Un documento vigente no puede estar marcado como reemplazado.
  constraint documentos_reemplazo_coherente check (
    (vigente and reemplazado_en is null) or (not vigente)
  )
);

comment on table public.documentos is
  'Soportes de una misión, versionados. Reemplazar crea versión nueva; nada se borra.';

create index documentos_mision_idx on public.documentos (mision_id);
create index documentos_hash_idx on public.documentos (hash_sha256);
create index documentos_vigentes_idx on public.documentos (mision_id, tipo) where vigente;

-- Un solo documento vigente por tipo para los cinco PDF y para el video.
create unique index documentos_unico_vigente_idx
  on public.documentos (mision_id, tipo)
  where vigente and tipo <> 'foto';

-- -----------------------------------------------------------------------------
-- Las fotos admiten exactamente dos vigentes. No hay índice único que exprese
-- "como máximo dos", así que se comprueba con trigger.
-- -----------------------------------------------------------------------------
create or replace function public.validar_cantidad_fotos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vigentes integer;
begin
  if new.tipo <> 'foto' or not new.vigente then
    return new;
  end if;

  select count(*) into v_vigentes
  from public.documentos d
  where d.mision_id = new.mision_id
    and d.tipo = 'foto'
    and d.vigente
    and d.id <> new.id;

  if v_vigentes >= 2 then
    raise exception 'El archivo fílmico admite dos fotografías. Reemplaza una de las cargadas.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger documentos_validar_fotos
  before insert or update on public.documentos
  for each row execute function public.validar_cantidad_fotos();

-- -----------------------------------------------------------------------------
-- Completitud de una misión
-- -----------------------------------------------------------------------------
create or replace function public.contar_archivos_vigentes(p_mision_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.documentos d
  where d.mision_id = p_mision_id
    and d.vigente
$$;

comment on function public.contar_archivos_vigentes is
  'Cuántos de los ocho archivos exigidos están cargados y vigentes.';

create or replace function public.mision_completa(p_mision_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Completa = los cinco PDF, dos fotos y un video, todos vigentes.
  select
    count(*) filter (where d.tipo not in ('foto', 'video')) = 5
    and count(*) filter (where d.tipo = 'foto') = 2
    and count(*) filter (where d.tipo = 'video') = 1
  from public.documentos d
  where d.mision_id = p_mision_id
    and d.vigente
$$;

comment on function public.mision_completa is
  'Verdadero cuando están los ocho archivos: 5 PDF + 2 fotos + 1 video.';

grant execute on function public.contar_archivos_vigentes to authenticated, service_role;
grant execute on function public.mision_completa to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Vista de apoyo para el listado: completitud por misión sin subconsultas
-- repetidas en la aplicación.
-- -----------------------------------------------------------------------------
create or replace view public.misiones_con_completitud
with (security_invoker = true) as
select
  m.*,
  coalesce(c.archivos_vigentes, 0) as archivos_vigentes,
  coalesce(c.archivos_vigentes, 0) >= 8 as completa
from public.misiones m
left join lateral (
  select count(*)::integer as archivos_vigentes
  from public.documentos d
  where d.mision_id = m.id and d.vigente
) c on true;

comment on view public.misiones_con_completitud is
  'Misiones con su conteo de archivos vigentes. security_invoker: respeta la RLS de quien consulta.';
