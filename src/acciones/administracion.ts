"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { exigirRol } from "@/lib/sesion";
import { entornoPublico } from "@/lib/entorno";
import {
  esquemaAeronave,
  esquemaInvitacion,
  esquemaTipoMision,
  esquemaUnidad,
  esquemaUsuario,
} from "@/dominio/esquemas-admin";

/**
 * Administración: usuarios y catálogos.
 *
 * Todo lo de aquí es exclusivo del rol admin. La comprobación se hace tres
 * veces y a propósito: la barra lateral oculta el enlace, cada acción llama a
 * `exigirRol("admin")`, y las políticas de RLS vuelven a exigirlo en la base.
 * Las dos primeras son comodidad; la tercera es la que protege los datos.
 */

export type ResultadoAdmin =
  | { ok: true; mensaje: string; id?: string }
  | { ok: false; error: string; campo?: string };

function traducirError(error: PostgrestError, contexto: string): string {
  console.warn(`[admin] ${contexto}: ${error.code} ${error.message}`);

  // Los triggers del proyecto ya redactan sus mensajes para el usuario.
  if (error.message.startsWith("El rol, la unidad")) return error.message;

  switch (error.code) {
    case "23505":
      return contexto.startsWith("usuario")
        ? "Ya hay una cuenta con ese documento de identidad."
        : "Ya existe un registro con ese código o matrícula.";
    case "23503":
      return "La unidad seleccionada ya no existe. Actualiza la página e intenta de nuevo.";
    case "23514":
      return "Los datos no cumplen las reglas del catálogo. Revisa el formato.";
    case "42501":
      return "Tu rol no permite esta acción.";
    default:
      return "No se pudo completar la operación. Intenta de nuevo; si persiste, revisa el registro del servidor.";
  }
}

// -----------------------------------------------------------------------------
// Usuarios
// -----------------------------------------------------------------------------

/**
 * Invita a un usuario nuevo.
 *
 * Va en dos pasos y no por casualidad:
 *
 *   1. Supabase Auth crea la cuenta y envía el correo de invitación. El trigger
 *      `crear_perfil_al_registrar` levanta el perfil con los datos personales y
 *      el rol más restrictivo, `consulta`.
 *   2. El admin, ya con su propia sesión, asigna el rol y la unidad definitivos.
 *
 * Así la cuenta nunca existe con privilegios que nadie haya firmado: el paso 2
 * pasa por el trigger de auditoría y queda registrado como `cambiar_rol` con el
 * admin como actor. Si el paso 2 fallara, la cuenta se queda en solo lectura.
 */
export async function invitarUsuario(datos: unknown): Promise<ResultadoAdmin> {
  await exigirRol("admin");

  const analisis = esquemaInvitacion.safeParse(datos);
  if (!analisis.success) {
    const problema = analisis.error.issues[0];
    return { ok: false, error: problema.message, campo: String(problema.path[0] ?? "") };
  }

  const invitado = analisis.data;
  const servicio = crearClienteServicio();

  const { data, error } = await servicio.auth.admin.inviteUserByEmail(invitado.correo, {
    data: {
      nombre_completo: invitado.nombre_completo,
      documento_identidad: invitado.documento_identidad,
      grado: invitado.grado || null,
      telefono: invitado.telefono || null,
    },
    redirectTo: `${entornoPublico.NEXT_PUBLIC_URL_APLICACION}/auth/callback?destino=/primer-ingreso`,
  });

  if (error || !data.user) {
    console.warn(`[admin] invitar ${invitado.correo}: ${error?.message ?? "sin usuario"}`);

    if (error?.code === "email_exists" || error?.status === 422) {
      return {
        ok: false,
        error: "Ya existe una cuenta con ese correo. Búscala en el listado para editarla.",
        campo: "correo",
      };
    }

    return {
      ok: false,
      error:
        "No se pudo enviar la invitación. Verifica el correo y que el SMTP del proyecto esté configurado.",
    };
  }

  // Paso 2: el rol y la unidad los asigna el admin con su sesión.
  const supabase = await crearClienteServidor();
  const { error: errorPerfil } = await supabase
    .from("perfiles")
    .update({ rol: invitado.rol, unidad_id: invitado.unidad_id || null })
    .eq("id", data.user.id);

  if (errorPerfil) {
    return {
      ok: false,
      error: `La invitación se envió, pero no se pudo asignar el rol: ${traducirError(errorPerfil, "usuario_rol")}`,
    };
  }

  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    mensaje: `Invitación enviada a ${invitado.correo}.`,
    id: data.user.id,
  };
}

/** Cambia los datos institucionales, el rol, la unidad o el estado de una cuenta. */
export async function actualizarUsuario(
  usuarioId: string,
  datos: unknown,
): Promise<ResultadoAdmin> {
  const sesion = await exigirRol("admin");

  const analisis = esquemaUsuario.safeParse(datos);
  if (!analisis.success) {
    const problema = analisis.error.issues[0];
    return { ok: false, error: problema.message, campo: String(problema.path[0] ?? "") };
  }

  const usuario = analisis.data;

  // Un admin no se quita a sí mismo el rol ni se desactiva: dejaría el sistema
  // sin administrador si fuera el único, y en todo caso es un error de bulto.
  if (usuarioId === sesion.usuarioId && (usuario.rol !== "admin" || !usuario.activo)) {
    return {
      ok: false,
      error: "No puedes cambiar tu propio rol ni desactivar tu cuenta. Pídeselo a otro administrador.",
    };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("perfiles")
    .update({
      nombre_completo: usuario.nombre_completo,
      documento_identidad: usuario.documento_identidad,
      grado: usuario.grado || null,
      telefono: usuario.telefono || null,
      rol: usuario.rol,
      unidad_id: usuario.unidad_id || null,
      activo: usuario.activo,
    })
    .eq("id", usuarioId);

  if (error) {
    return { ok: false, error: traducirError(error, "usuario") };
  }

  revalidatePath("/admin/usuarios");
  return { ok: true, mensaje: "Cuenta actualizada", id: usuarioId };
}

/**
 * Reenvía el acceso por correo.
 *
 * Sirve tanto para una invitación que se perdió como para una cuenta bloqueada
 * por olvido de contraseña: en ambos casos el enlace lleva al mismo trámite de
 * primer ingreso, donde el usuario define contraseña y acepta el aviso de uso.
 */
export async function reenviarAcceso(usuarioId: string): Promise<ResultadoAdmin> {
  await exigirRol("admin");

  const servicio = crearClienteServicio();
  const { data, error } = await servicio.auth.admin.getUserById(usuarioId);

  if (error || !data.user?.email) {
    console.warn(`[admin] reenviar acceso ${usuarioId}: ${error?.message ?? "sin correo"}`);
    return { ok: false, error: "No se encontró la cuenta." };
  }

  // El envío va por el cliente anónimo: es el que dispara el correo del
  // proveedor de Auth. `generateLink` devolvería el enlace sin enviarlo.
  const supabase = await crearClienteServidor();
  const { error: errorEnvio } = await supabase.auth.resetPasswordForEmail(data.user.email, {
    redirectTo: `${entornoPublico.NEXT_PUBLIC_URL_APLICACION}/auth/callback?destino=/primer-ingreso`,
  });

  if (errorEnvio) {
    console.warn(`[admin] reenviar acceso ${usuarioId}: ${errorEnvio.message}`);
    return { ok: false, error: "No se pudo enviar el correo. Revisa la configuración de SMTP." };
  }

  return { ok: true, mensaje: `Enlace de acceso enviado a ${data.user.email}.` };
}

/**
 * Obliga a repetir el trámite de primer ingreso.
 *
 * Se usa cuando hay sospecha sobre una cuenta: en el siguiente acceso el
 * middleware la manda a definir contraseña nueva antes de dejarla entrar.
 */
export async function exigirCambioDeClave(usuarioId: string): Promise<ResultadoAdmin> {
  await exigirRol("admin");

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("perfiles")
    .update({ debe_cambiar_clave: true })
    .eq("id", usuarioId);

  if (error) {
    return { ok: false, error: traducirError(error, "usuario") };
  }

  revalidatePath("/admin/usuarios");
  return { ok: true, mensaje: "En su próximo ingreso deberá definir una contraseña nueva." };
}

// -----------------------------------------------------------------------------
// Catálogos
//
// Ninguno se borra: se desactiva. Las misiones ya registradas siguen apuntando
// a la unidad, la aeronave o el tipo con el que se ejecutaron, y un catálogo
// inactivo deja de ofrecerse en los formularios nuevos.
// -----------------------------------------------------------------------------

export async function guardarUnidad(datos: unknown): Promise<ResultadoAdmin> {
  await exigirRol("admin");

  const analisis = esquemaUnidad.safeParse(datos);
  if (!analisis.success) {
    const problema = analisis.error.issues[0];
    return { ok: false, error: problema.message, campo: String(problema.path[0] ?? "") };
  }

  const { id, ...unidad } = analisis.data;
  const supabase = await crearClienteServidor();

  const { error } = id
    ? await supabase.from("unidades").update(unidad).eq("id", id)
    : await supabase.from("unidades").insert(unidad);

  if (error) {
    return { ok: false, error: traducirError(error, "unidad") };
  }

  revalidatePath("/admin/catalogos");
  revalidatePath("/misiones");
  return { ok: true, mensaje: id ? "Unidad actualizada" : "Unidad creada" };
}

export async function guardarAeronave(datos: unknown): Promise<ResultadoAdmin> {
  await exigirRol("admin");

  const analisis = esquemaAeronave.safeParse(datos);
  if (!analisis.success) {
    const problema = analisis.error.issues[0];
    return { ok: false, error: problema.message, campo: String(problema.path[0] ?? "") };
  }

  const { id, ...aeronave } = analisis.data;
  const supabase = await crearClienteServidor();

  const { error } = id
    ? await supabase.from("aeronaves").update(aeronave).eq("id", id)
    : await supabase.from("aeronaves").insert(aeronave);

  if (error) {
    return { ok: false, error: traducirError(error, "aeronave") };
  }

  revalidatePath("/admin/catalogos");
  revalidatePath("/misiones");
  return { ok: true, mensaje: id ? "Aeronave actualizada" : "Aeronave registrada" };
}

export async function guardarTipoMision(datos: unknown): Promise<ResultadoAdmin> {
  await exigirRol("admin");

  const analisis = esquemaTipoMision.safeParse(datos);
  if (!analisis.success) {
    const problema = analisis.error.issues[0];
    return { ok: false, error: problema.message, campo: String(problema.path[0] ?? "") };
  }

  const { id, ...tipo } = analisis.data;
  const supabase = await crearClienteServidor();

  const { error } = id
    ? await supabase.from("tipos_mision").update(tipo).eq("id", id)
    : await supabase.from("tipos_mision").insert(tipo);

  if (error) {
    return { ok: false, error: traducirError(error, "tipo de misión") };
  }

  revalidatePath("/admin/catalogos");
  revalidatePath("/misiones");
  return { ok: true, mensaje: id ? "Tipo de misión actualizado" : "Tipo de misión creado" };
}
