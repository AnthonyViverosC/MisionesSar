-- =============================================================================
-- MISIONES SAR — 03. Perfiles y funciones de identidad
--
-- `perfiles` extiende auth.users con el rol y la unidad. Todas las políticas de
-- RLS del sistema se apoyan en las dos funciones definidas aquí.
-- =============================================================================

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete restrict,
  nombre_completo text not null,
  documento_identidad text not null unique,
  grado text,
  unidad_id uuid references public.unidades (id) on delete restrict,
  rol public.rol_usuario not null default 'consulta',
  telefono text,
  activo boolean not null default true,
  -- Obliga a cambiar la contraseña y aceptar el aviso en el primer ingreso.
  debe_cambiar_clave boolean not null default true,
  aviso_aceptado_en timestamptz,
  ultimo_acceso timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint perfiles_nombre_no_vacio check (length(trim(nombre_completo)) > 0),
  -- Operador y supervisor trabajan siempre dentro de una unidad: sin unidad no
  -- hay frontera de visibilidad que aplicar.
  constraint perfiles_unidad_obligatoria check (
    rol in ('admin', 'consulta') or unidad_id is not null
  )
);

comment on table public.perfiles is
  'Datos institucionales del usuario. El rol y la unidad gobiernan el acceso.';

create index perfiles_unidad_idx on public.perfiles (unidad_id);
create index perfiles_rol_idx on public.perfiles (rol);

create trigger perfiles_actualizado_en
  before update on public.perfiles
  for each row execute function public.tocar_actualizado_en();

-- -----------------------------------------------------------------------------
-- Funciones de identidad
--
-- Viven en `public` y no en `auth`: Supabase dejó de conceder al rol de la
-- migración permiso de creación sobre el esquema `auth`, que ahora administra
-- la propia plataforma. El comportamiento es idéntico; solo cambia el prefijo.
--
-- Son SECURITY DEFINER a propósito: leen `perfiles`, que tiene RLS activo, y si
-- se ejecutaran con los permisos de quien llama la política se llamarían a sí
-- mismas en bucle. Al ejecutarse como el propietario saltan RLS y devuelven el
-- dato de forma directa. `search_path = ''` obliga a calificar cada objeto y
-- cierra la puerta a suplantaciones por búsqueda de esquema.
-- -----------------------------------------------------------------------------

create or replace function public.rol_actual()
returns public.rol_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select p.rol
  from public.perfiles p
  where p.id = (select auth.uid())
    and p.activo
$$;

comment on function public.rol_actual is
  'Rol del usuario autenticado, o NULL si no hay sesión o está desactivado.';

create or replace function public.unidad_actual()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.unidad_id
  from public.perfiles p
  where p.id = (select auth.uid())
    and p.activo
$$;

comment on function public.unidad_actual is
  'Unidad del usuario autenticado. Frontera de visibilidad de operador y supervisor.';

-- Atajo legible para las políticas: ¿el usuario tiene alguno de estos roles?
create or replace function public.tiene_rol(variadic roles public.rol_usuario[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.rol_actual() = any(roles)
$$;

comment on function public.tiene_rol is
  'Verdadero si el rol del usuario está entre los indicados.';

grant execute on function public.rol_actual to authenticated;
grant execute on function public.unidad_actual to authenticated;
grant execute on function public.tiene_rol to authenticated;

-- -----------------------------------------------------------------------------
-- Alta de usuarios
--
-- No hay registro público. El admin invita por correo y Supabase Auth crea la
-- fila en auth.users; este trigger crea el perfil correspondiente con los datos
-- que el admin envió en los metadatos de la invitación. El rol por defecto es
-- 'consulta': el más restrictivo, por si la invitación llegara sin rol.
-- -----------------------------------------------------------------------------
create or replace function public.crear_perfil_al_registrar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (
    id,
    nombre_completo,
    documento_identidad,
    grado,
    unidad_id,
    rol,
    telefono
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre_completo', new.email),
    coalesce(new.raw_user_meta_data ->> 'documento_identidad', new.id::text),
    new.raw_user_meta_data ->> 'grado',
    nullif(new.raw_user_meta_data ->> 'unidad_id', '')::uuid,
    coalesce(
      (new.raw_user_meta_data ->> 'rol')::public.rol_usuario,
      'consulta'::public.rol_usuario
    ),
    new.raw_user_meta_data ->> 'telefono'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger crear_perfil_al_registrar
  after insert on auth.users
  for each row execute function public.crear_perfil_al_registrar();
