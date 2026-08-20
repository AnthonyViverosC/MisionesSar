import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Rol } from "@/dominio/roles";

export type SesionActual = {
  usuarioId: string;
  correo: string;
  nombreCompleto: string;
  grado: string | null;
  rol: Rol;
  unidadId: string | null;
  unidadNombre: string | null;
};

/**
 * Sesión del usuario para Server Components y Server Actions.
 *
 * Va envuelta en `cache` para resolverse una sola vez por petición aunque la
 * pidan varios componentes.
 *
 * Esto NO es control de acceso: es la identidad que se usa para decidir qué
 * mostrar y para verificar permisos antes de una mutación. Quien realmente
 * autoriza cada lectura y escritura es RLS.
 */
export const obtenerSesion = cache(async (): Promise<SesionActual | null> => {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo, grado, rol, unidad_id, activo, unidades(nombre)")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil || !perfil.activo) return null;

  const unidad = perfil.unidades as { nombre: string } | null;

  return {
    usuarioId: user.id,
    correo: user.email ?? "",
    nombreCompleto: perfil.nombre_completo,
    grado: perfil.grado,
    rol: perfil.rol,
    unidadId: perfil.unidad_id,
    unidadNombre: unidad?.nombre ?? null,
  };
});

/** Igual que `obtenerSesion`, pero exige sesión: si no hay, manda al login. */
export async function exigirSesion(): Promise<SesionActual> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  return sesion;
}

/**
 * Exige que el usuario tenga uno de los roles indicados.
 *
 * Se usa al principio de cada Server Action como primera barrera. La segunda,
 * la que de verdad protege los datos, son las políticas de RLS.
 */
export async function exigirRol(...roles: Rol[]): Promise<SesionActual> {
  const sesion = await exigirSesion();

  if (!roles.includes(sesion.rol)) {
    redirect("/?error=sin_permiso");
  }

  return sesion;
}
