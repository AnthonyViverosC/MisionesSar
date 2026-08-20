"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { PostgrestError } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirSesion } from "@/lib/sesion";
import type { FilaMision } from "@/tipos/basedatos";
import { aRegistro, esquemaMision } from "@/dominio/esquemas-mision";
import { CONFIRMACION_ACCION } from "@/dominio/estados";

/**
 * Mutaciones sobre misiones.
 *
 * Cada acción hace tres cosas antes de tocar la base: confirma que hay sesión,
 * valida la entrada con el mismo esquema que usó el navegador, y deja que RLS y
 * los triggers apliquen las reglas. Si la base rechaza la operación, se muestra
 * su mensaje: están redactados para que los lea un operador.
 */

export type ResultadoMision =
  | { ok: true; mensaje: string; id?: string }
  | { ok: false; error: string; campo?: string };

/**
 * Traduce un error de Postgres a algo que el usuario pueda accionar.
 *
 * Los mensajes de nuestros triggers ya vienen escritos para el usuario y se
 * muestran tal cual. Lo demás se resume, y el detalle queda en el registro del
 * servidor.
 */
function traducirError(error: PostgrestError, contexto: string): string {
  console.warn(`[misiones] ${contexto}: ${error.code} ${error.message}`);

  // Mensajes propios: los levantan nuestros triggers con raise exception.
  const propios = [
    "Faltan soportes",
    "misión aprobada",
    "misión anulada",
    "Solo",
    "El supervisor",
    "El operador",
    "Anular exige",
    "Devolver",
    "El archivo fílmico",
    "La aeronave",
    "El número de misión",
    "El rol, la unidad",
    "Una observación",
    "Transición no permitida",
    "La misión está en revisión",
    "No se aprueba",
  ];

  if (propios.some((inicio) => error.message.includes(inicio))) {
    return error.message;
  }

  switch (error.code) {
    case "23505":
      return "Ya existe una misión con ese número en el año. Verifica el consecutivo.";
    case "23503":
      return "Alguno de los datos seleccionados ya no existe. Actualiza la página e intenta de nuevo.";
    case "23514":
      return "Los datos no cumplen las reglas de la misión. Revisa fechas, coordenadas y horas.";
    case "42501":
      return "Tu rol no permite esta acción sobre esta misión.";
    default:
      return "No se pudo completar la operación. Intenta de nuevo; si persiste, avisa al administrador.";
  }
}

// -----------------------------------------------------------------------------
// Creación y edición
// -----------------------------------------------------------------------------

export async function crearMision(datos: unknown): Promise<ResultadoMision> {
  const sesion = await exigirSesion();

  if (sesion.rol !== "operador" && sesion.rol !== "admin") {
    return { ok: false, error: "Tu rol no permite crear misiones." };
  }

  const analisis = esquemaMision.safeParse(datos);
  if (!analisis.success) {
    const problema = analisis.error.issues[0];
    return { ok: false, error: problema.message, campo: String(problema.path[0] ?? "") };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("misiones")
    .insert({ ...aRegistro(analisis.data), creada_por: sesion.usuarioId })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: traducirError(error, "crear") };
  }

  revalidatePath("/misiones");
  return { ok: true, mensaje: "Misión creada", id: data.id };
}

export async function actualizarMision(
  misionId: string,
  datos: unknown,
): Promise<ResultadoMision> {
  await exigirSesion();

  const analisis = esquemaMision.safeParse(datos);
  if (!analisis.success) {
    const problema = analisis.error.issues[0];
    return { ok: false, error: problema.message, campo: String(problema.path[0] ?? "") };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("misiones")
    .update(aRegistro(analisis.data))
    .eq("id", misionId);

  if (error) {
    return { ok: false, error: traducirError(error, "actualizar") };
  }

  revalidatePath(`/misiones/${misionId}`);
  revalidatePath("/misiones");
  return { ok: true, mensaje: "Cambios guardados", id: misionId };
}

// -----------------------------------------------------------------------------
// Transiciones de estado
// -----------------------------------------------------------------------------

/** Cambia el estado y deja que el trigger decida si la transición vale. */
async function cambiarEstado(
  misionId: string,
  campos: Partial<FilaMision>,
  mensaje: string,
  contexto: string,
): Promise<ResultadoMision> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("misiones").update(campos).eq("id", misionId);

  if (error) {
    return { ok: false, error: traducirError(error, contexto) };
  }

  revalidatePath(`/misiones/${misionId}`);
  revalidatePath("/misiones");
  revalidatePath("/revision");
  revalidatePath("/");
  return { ok: true, mensaje, id: misionId };
}

export async function enviarARevision(misionId: string): Promise<ResultadoMision> {
  await exigirSesion();
  return cambiarEstado(misionId, { estado: "enviada" }, CONFIRMACION_ACCION.enviar, "enviar");
}

export async function tomarEnRevision(misionId: string): Promise<ResultadoMision> {
  const sesion = await exigirSesion();

  if (sesion.rol !== "supervisor" && sesion.rol !== "admin") {
    return { ok: false, error: "Tu rol no permite revisar misiones." };
  }

  return cambiarEstado(
    misionId,
    { estado: "en_revision" },
    CONFIRMACION_ACCION.tomar_revision,
    "tomar_revision",
  );
}

export async function aprobarMision(misionId: string): Promise<ResultadoMision> {
  const sesion = await exigirSesion();

  if (sesion.rol !== "supervisor" && sesion.rol !== "admin") {
    return { ok: false, error: "Tu rol no permite aprobar misiones." };
  }

  return cambiarEstado(misionId, { estado: "aprobada" }, CONFIRMACION_ACCION.aprobar, "aprobar");
}

const esquemaObservacion = z
  .string()
  .trim()
  .min(10, "La observación debe explicar qué corregir: al menos 10 caracteres.")
  .max(2000, "La observación no puede superar los 2000 caracteres.");

/**
 * Devuelve la misión al operador.
 *
 * Se registra primero la observación y después se mueve el estado: el trigger
 * rechaza el cambio si no encuentra una observación sin resolver, de modo que
 * nunca queda una devolución sin explicación.
 */
export async function devolverConObservacion(
  misionId: string,
  texto: unknown,
): Promise<ResultadoMision> {
  const sesion = await exigirSesion();

  if (sesion.rol !== "supervisor" && sesion.rol !== "admin") {
    return { ok: false, error: "Tu rol no permite devolver misiones." };
  }

  const analisis = esquemaObservacion.safeParse(texto);
  if (!analisis.success) {
    return { ok: false, error: analisis.error.issues[0].message, campo: "texto" };
  }

  const supabase = await crearClienteServidor();

  const { error: errorObservacion } = await supabase.from("observaciones").insert({
    mision_id: misionId,
    autor_id: sesion.usuarioId,
    texto: analisis.data,
  });

  if (errorObservacion) {
    return { ok: false, error: traducirError(errorObservacion, "observar") };
  }

  return cambiarEstado(
    misionId,
    { estado: "observada" },
    CONFIRMACION_ACCION.observar,
    "observar",
  );
}

const esquemaMotivo = z
  .string()
  .trim()
  .min(10, "El motivo de la anulación debe tener al menos 10 caracteres.")
  .max(500, "El motivo no puede superar los 500 caracteres.");

export async function anularMision(
  misionId: string,
  motivo: unknown,
): Promise<ResultadoMision> {
  const sesion = await exigirSesion();

  if (sesion.rol !== "admin") {
    return { ok: false, error: "Solo un administrador puede anular una misión." };
  }

  const analisis = esquemaMotivo.safeParse(motivo);
  if (!analisis.success) {
    return { ok: false, error: analisis.error.issues[0].message, campo: "motivo" };
  }

  return cambiarEstado(
    misionId,
    { estado: "anulada", motivo_anulacion: analisis.data, anulada_por: sesion.usuarioId },
    CONFIRMACION_ACCION.anular,
    "anular",
  );
}

/** Respuesta del operador dentro del hilo de observaciones. */
export async function responderObservacion(
  misionId: string,
  texto: unknown,
): Promise<ResultadoMision> {
  const sesion = await exigirSesion();

  const analisis = esquemaObservacion.safeParse(texto);
  if (!analisis.success) {
    return { ok: false, error: analisis.error.issues[0].message, campo: "texto" };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("observaciones").insert({
    mision_id: misionId,
    autor_id: sesion.usuarioId,
    texto: analisis.data,
  });

  if (error) {
    return { ok: false, error: traducirError(error, "responder") };
  }

  revalidatePath(`/misiones/${misionId}`);
  return { ok: true, mensaje: "Respuesta registrada", id: misionId };
}

/** Atajo desde la bandeja: abrir una misión enviada la deja en revisión. */
export async function abrirDesdeBandeja(misionId: string): Promise<void> {
  const sesion = await exigirSesion();

  if (sesion.rol === "supervisor" || sesion.rol === "admin") {
    const supabase = await crearClienteServidor();
    await supabase
      .from("misiones")
      .update({ estado: "en_revision" })
      .eq("id", misionId)
      .eq("estado", "enviada");
  }

  redirect(`/misiones/${misionId}`);
}
