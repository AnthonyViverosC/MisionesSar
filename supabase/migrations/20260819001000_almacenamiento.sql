-- =============================================================================
-- MISIONES SAR — 10. Almacenamiento
--
-- Dos buckets, los dos privados. Ningún archivo es accesible por URL pública:
-- toda descarga pasa por una URL firmada de cinco minutos que emite el servidor
-- después de comprobar el rol.
--
-- Rutas: <mision_id>/<tipo>/<uuid>.<ext>. Nunca se usa el nombre original como
-- ruta; se conserva aparte, solo para mostrarlo y para el ZIP.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'documentos-pdf',
    'documentos-pdf',
    false,
    20971520, -- 20 MB
    array['application/pdf']
  ),
  (
    'archivo-filmico',
    'archivo-filmico',
    false,
    524288000, -- 500 MB
    array['image/jpeg', 'image/png', 'video/mp4']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- ¿La ruta pertenece a una misión que el usuario puede editar?
--
-- El primer segmento de la ruta es el identificador de la misión. Si no es un
-- UUID válido la respuesta es no, sin discusión.
-- -----------------------------------------------------------------------------
create or replace function public.ruta_de_mision_editable(p_ruta text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mision uuid;
begin
  begin
    v_mision := (storage.foldername(p_ruta))[1]::uuid;
  exception when others then
    return false;
  end;

  return public.puede_editar_mision(v_mision);
end;
$$;

grant execute on function public.ruta_de_mision_editable to authenticated;

-- -----------------------------------------------------------------------------
-- Políticas de storage.objects
--
-- Los PDF y las fotos suben con URL firmada de subida, que el servidor emite y
-- que no depende de estas políticas. El video usa subida reanudable (tus), que
-- viaja con el token del usuario y sí pasa por RLS: por eso existe la política
-- de INSERT, y solo para el bucket del archivo fílmico.
--
-- No hay política de SELECT: nadie lee del bucket con su propio token. Tampoco
-- de UPDATE ni de DELETE: los archivos no se sobrescriben ni se borran, se
-- versionan.
-- -----------------------------------------------------------------------------

create policy filmico_insert_reanudable on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'archivo-filmico'
    and public.ruta_de_mision_editable(name)
  );

comment on policy filmico_insert_reanudable on storage.objects is
  'Subida reanudable de video: solo en misiones que el usuario puede editar.';
