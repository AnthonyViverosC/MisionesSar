"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirSesion } from "@/lib/sesion";

/**
 * Notificaciones del usuario.
 *
 * Solo hay dos operaciones posibles y las dos marcan como leído: RLS deja al
 * usuario tocar únicamente las notificaciones cuyo destinatario es él, y no hay
 * política de INSERT ni de DELETE. Nadie se manda avisos ni los hace desaparecer.
 */

export type ResultadoNotificacion = { ok: true } | { ok: false; error: string };

/** Vacía el contador de la campana de una sola vez. */
export async function marcarTodasLeidas(): Promise<ResultadoNotificacion> {
  const sesion = await exigirSesion();

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("notificaciones")
    .update({ leida: true, leida_en: new Date().toISOString() })
    .eq("destinatario_id", sesion.usuarioId)
    .eq("leida", false);

  if (error) {
    console.warn(`[notificaciones] marcar todas: ${error.code} ${error.message}`);
    return { ok: false, error: "No se pudieron marcar los avisos como leídos." };
  }

  revalidatePath("/notificaciones");
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Abre la misión del aviso y lo da por leído de paso.
 *
 * Se usa como `action` de un formulario, de modo que el enlace funciona igual
 * sin JavaScript en el navegador.
 */
export async function abrirNotificacion(datos: FormData): Promise<void> {
  await exigirSesion();

  const notificacionId = String(datos.get("id") ?? "");
  const misionId = String(datos.get("mision") ?? "");

  if (notificacionId) {
    const supabase = await crearClienteServidor();
    await supabase
      .from("notificaciones")
      .update({ leida: true, leida_en: new Date().toISOString() })
      .eq("id", notificacionId)
      .eq("leida", false);

    revalidatePath("/", "layout");
  }

  redirect(misionId ? `/misiones/${misionId}` : "/notificaciones");
}
