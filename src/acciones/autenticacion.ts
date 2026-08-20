"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { entornoPublico } from "@/lib/entorno";
import {
  esquemaContrasena,
  mensajeFiltracion,
  verificarFiltracion,
} from "@/lib/seguridad/contrasena";

/**
 * Acciones de autenticación.
 *
 * Todas devuelven mensajes genéricos al usuario: nunca revelan si un correo
 * existe, si la contraseña era incorrecta o si la cuenta está bloqueada. El
 * detalle queda en la bitácora del servidor.
 */

export type EstadoAccion = { error?: string; mensaje?: string };

const MENSAJE_CREDENCIALES = "Las credenciales no son válidas. Verifica y vuelve a intentar.";
const MENSAJE_BLOQUEO =
  "Demasiados intentos fallidos. Espera 15 minutos antes de volver a intentar.";

const esquemaIngreso = z.object({
  correo: z.string().trim().toLowerCase().email("Escribe un correo válido."),
  contrasena: z.string().min(1, "Escribe tu contraseña."),
  siguiente: z.string().optional(),
});

/** Datos de la petición para la bitácora y para el límite por IP. */
async function contextoPeticion() {
  const cabeceras = await headers();
  return {
    ip: cabeceras.get("x-forwarded-for") ?? cabeceras.get("x-real-ip") ?? null,
    agente: cabeceras.get("user-agent") ?? null,
  };
}

export async function iniciarSesion(
  _estadoPrevio: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const analisis = esquemaIngreso.safeParse({
    correo: datos.get("correo"),
    contrasena: datos.get("contrasena"),
    siguiente: datos.get("siguiente") ?? undefined,
  });

  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message ?? MENSAJE_CREDENCIALES };
  }

  const { correo, contrasena, siguiente } = analisis.data;
  const { ip, agente } = await contextoPeticion();
  const servicio = crearClienteServicio();

  // Bloqueo temporal tras cinco fallos desde la misma cuenta o la misma IP.
  const { data: bloqueado } = await servicio.rpc("ingreso_bloqueado", {
    p_correo: correo,
    p_ip: ip,
  });

  if (bloqueado) {
    await servicio.rpc("registrar_evento_autenticacion", {
      p_accion: "ingreso_fallido",
      p_actor_id: null,
      p_actor_email: correo,
      p_ip: ip,
      p_user_agent: agente,
      p_detalle: { motivo: "bloqueo_temporal" },
    });
    return { error: MENSAJE_BLOQUEO };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  });

  await servicio.rpc("registrar_intento_ingreso", {
    p_correo: correo,
    p_ip: ip,
    p_exitoso: !error,
  });

  if (error || !data.user) {
    await servicio.rpc("registrar_evento_autenticacion", {
      p_accion: "ingreso_fallido",
      p_actor_id: null,
      p_actor_email: correo,
      p_ip: ip,
      p_user_agent: agente,
      p_detalle: { motivo: error?.code ?? "credenciales" },
    });
    console.warn(`[auth] Ingreso fallido de ${correo}: ${error?.message ?? "sin usuario"}`);
    return { error: MENSAJE_CREDENCIALES };
  }

  await servicio.rpc("registrar_evento_autenticacion", {
    p_accion: "ingreso_exitoso",
    p_actor_id: data.user.id,
    p_actor_email: correo,
    p_ip: ip,
    p_user_agent: agente,
    p_detalle: null,
  });

  await servicio
    .from("perfiles")
    .update({ ultimo_acceso: new Date().toISOString() })
    .eq("id", data.user.id);

  // El middleware decide si toca primer ingreso, verificación de MFA o destino.
  redirect(siguiente && siguiente.startsWith("/") ? siguiente : "/");
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { ip, agente } = await contextoPeticion();
    const servicio = crearClienteServicio();
    await servicio.rpc("registrar_evento_autenticacion", {
      p_accion: "cerrar_sesion",
      p_actor_id: user.id,
      p_actor_email: user.email ?? null,
      p_ip: ip,
      p_user_agent: agente,
      p_detalle: null,
    });
  }

  await supabase.auth.signOut();
  redirect("/login");
}

const esquemaRecuperacion = z.object({
  correo: z.string().trim().toLowerCase().email("Escribe un correo válido."),
});

/**
 * Envía el enlace de recuperación.
 *
 * La respuesta es siempre la misma exista o no la cuenta: de lo contrario esta
 * pantalla se convertiría en un directorio de correos válidos.
 */
export async function solicitarRecuperacion(
  _estadoPrevio: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const analisis = esquemaRecuperacion.safeParse({ correo: datos.get("correo") });

  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(analisis.data.correo, {
    redirectTo: `${entornoPublico.NEXT_PUBLIC_URL_APLICACION}/auth/callback?destino=/primer-ingreso`,
  });

  if (error) {
    console.warn(`[auth] Recuperación fallida para ${analisis.data.correo}: ${error.message}`);
  }

  return {
    mensaje:
      "Si el correo corresponde a una cuenta activa, recibirás un enlace para definir una contraseña nueva. El enlace vence en una hora y solo puede usarse una vez.",
  };
}

const esquemaClaveNueva = z
  .object({
    contrasena: esquemaContrasena,
    confirmacion: z.string(),
    aviso: z.string().optional(),
  })
  .refine((valores) => valores.contrasena === valores.confirmacion, {
    message: "Las dos contraseñas no coinciden.",
    path: ["confirmacion"],
  });

/**
 * Define la contraseña definitiva y cierra el trámite de primer ingreso.
 * Se usa tanto al aceptar una invitación como al recuperar la contraseña.
 */
export async function definirContrasena(
  _estadoPrevio: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const analisis = esquemaClaveNueva.safeParse({
    contrasena: datos.get("contrasena"),
    confirmacion: datos.get("confirmacion"),
    aviso: datos.get("aviso") ?? undefined,
  });

  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message };
  }

  if (analisis.data.aviso !== "aceptado") {
    return { error: "Debes aceptar el aviso de uso de la plataforma para continuar." };
  }

  const filtracion = await verificarFiltracion(analisis.data.contrasena);
  if (filtracion.filtrada === true) {
    return { error: mensajeFiltracion(filtracion.apariciones) };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "La sesión expiró. Vuelve a abrir el enlace que recibiste por correo." };
  }

  const { error } = await supabase.auth.updateUser({ password: analisis.data.contrasena });

  if (error) {
    console.warn(`[auth] Cambio de contraseña fallido de ${user.id}: ${error.message}`);
    return {
      error:
        "No se pudo actualizar la contraseña. Si el enlace ya se usó, solicita uno nuevo desde Recuperar.",
    };
  }

  const servicio = crearClienteServicio();
  await servicio
    .from("perfiles")
    .update({ debe_cambiar_clave: false, aviso_aceptado_en: new Date().toISOString() })
    .eq("id", user.id);

  redirect("/");
}

/** Renueva la marca de actividad cuando el usuario responde al aviso de expiración. */
export async function continuarSesion(): Promise<void> {
  const supabase = await crearClienteServidor();
  await supabase.auth.refreshSession();
}
