-- =============================================================================
-- MISIONES SAR — 01. Extensiones y tipos enumerados
--
-- Todo el esquema está versionado en migraciones: nada se configura a mano
-- desde el panel de Supabase. Para aplicar: `pnpm db:push`.
-- =============================================================================

-- pgcrypto aporta gen_random_uuid() y digest() para verificar hashes.
create extension if not exists pgcrypto with schema extensions;

-- Roles del sistema. La autorización real se aplica con RLS usando este valor.
create type public.rol_usuario as enum (
  'admin',
  'operador',
  'supervisor',
  'consulta'
);

-- Ciclo de vida de una misión.
--   borrador → enviada → en_revision → aprobada
--                 ↑           ↓
--              observada ←────┘
--   cualquier estado → anulada (solo admin, con motivo)
create type public.estado_mision as enum (
  'borrador',
  'enviada',
  'en_revision',
  'observada',
  'aprobada',
  'anulada'
);

-- Los seis soportes obligatorios. El archivo fílmico se descompone en dos
-- tipos porque tiene reglas distintas de formato y de cantidad.
create type public.tipo_documento as enum (
  'orden_vuelo',
  'orden_fragmentaria',
  'requerimiento_mision',
  'formulario_mision_cumplida',
  'certificado_consumo',
  'foto',
  'video'
);

-- Acciones registradas en la auditoría.
create type public.accion_auditoria as enum (
  'crear',
  'actualizar',
  'cambiar_estado',
  'subir_documento',
  'reemplazar_documento',
  'descargar_documento',
  'observar',
  'anular',
  'ingreso_exitoso',
  'ingreso_fallido',
  'cerrar_sesion',
  'invitar_usuario',
  'cambiar_rol',
  'desactivar_usuario'
);

-- Motivos por los que se notifica a un usuario.
create type public.tipo_notificacion as enum (
  'mision_enviada',
  'mision_observada',
  'mision_aprobada',
  'mision_anulada'
);

-- -----------------------------------------------------------------------------
-- Función utilitaria: mantiene actualizado_en en cada UPDATE.
-- -----------------------------------------------------------------------------
create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

comment on function public.tocar_actualizado_en is
  'Trigger genérico que refresca la marca de última modificación.';
