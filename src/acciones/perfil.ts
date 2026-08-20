"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirSesion } from "@/lib/sesion";
import { esquemaPerfilPropio } from "@/dominio/esquemas-admin";
import {
  esquemaContrasena,
  mensajeFiltracion,
  verificarFiltracion,
} from "@/lib/seguridad/contrasena";

/**
 * Datos que cada usuario mantiene de sí mismo.
 *
 * Rol, unidad y estado de la cuenta no están aquí: los cambia un administrador
 * y el trigger `proteger_campos_perfil` rechaza el intento de cualquier otro,
 * aunque la petición llegue armada a mano.
 */

export type ResultadoPerfil =
  | { ok: true; mensaje: string }
  | { ok: false; error: string; campo?: string };

export async function actualizarPerfilPropio(datos: unknown): Promise<ResultadoPerfil> {
  const sesion = await exigirSesion();

  const analisis = esquemaPerfilPropio.safeParse(datos);
  if (!analisis.success) {
    const problema = analisis.error.issues[0];
    return { ok: false, error: problema.message, campo: String(problema.path[0] ?? "") };
  }

  const perfil = analisis.data;
  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from("perfiles")
    .update({
      nombre_completo: perfil.nombre_completo,
      grado: perfil.grado || null,
      telefono: perfil.telefono || null,
    })
    .eq("id", sesion.usuarioId);

  if (error) {
    console.warn(`[perfil] actualizar: ${error.code} ${error.message}`);
    return { ok: false, error: "No se pudieron guardar los cambios. Intenta de nuevo." };
  }

  revalidatePath("/perfil");
  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Datos actualizados" };
}

const esquemaCambioClave = z
  .object({
    actual: z.string().min(1, "Escribe tu contraseña actual."),
    nueva: esquemaContrasena,
    confirmacion: z.string(),
  })
  .refine((valores) => valores.nueva === valores.confirmacion, {
    message: "Las dos contraseñas no coinciden.",
    path: ["confirmacion"],
  })
  .refine((valores) => valores.nueva !== valores.actual, {
    message: "La contraseña nueva debe ser distinta de la actual.",
    path: ["nueva"],
  });

/**
 * Cambia la contraseña desde dentro de la sesión.
 *
 * Se exige la contraseña actual aunque haya sesión abierta: sin eso, un equipo
 * desatendido bastaría para secuestrar la cuenta. La verificación se hace
 * reintentando el ingreso, que es la única forma de comprobarla contra Auth.
 */
export async function cambiarContrasenaPropia(datos: unknown): Promise<ResultadoPerfil> {
  const sesion = await exigirSesion();

  const analisis = esquemaCambioClave.safeParse(datos);
  if (!analisis.success) {
    const problema = analisis.error.issues[0];
    return { ok: false, error: problema.message, campo: String(problema.path[0] ?? "") };
  }

  const supabase = await crearClienteServidor();

  const { error: errorCredenciales } = await supabase.auth.signInWithPassword({
    email: sesion.correo,
    password: analisis.data.actual,
  });

  if (errorCredenciales) {
    return { ok: false, error: "La contraseña actual no es correcta.", campo: "actual" };
  }

  const filtracion = await verificarFiltracion(analisis.data.nueva);
  if (filtracion.filtrada === true) {
    return { ok: false, error: mensajeFiltracion(filtracion.apariciones), campo: "nueva" };
  }

  const { error } = await supabase.auth.updateUser({ password: analisis.data.nueva });

  if (error) {
    console.warn(`[perfil] cambio de contraseña de ${sesion.usuarioId}: ${error.message}`);
    return { ok: false, error: "No se pudo actualizar la contraseña. Intenta de nuevo." };
  }

  // Si el admin había exigido el cambio, con esto queda cumplido.
  await supabase
    .from("perfiles")
    .update({ debe_cambiar_clave: false })
    .eq("id", sesion.usuarioId);

  revalidatePath("/perfil");
  return { ok: true, mensaje: "Contraseña actualizada" };
}
