/**
 * Avisos que la base genera sola.
 *
 * Las crea el trigger `notificar_cambio_estado` cuando una misión se mueve. La
 * aplicación nunca inserta notificaciones: solo las lee y las marca como leídas.
 * Este archivo únicamente traduce el enum a lenguaje del usuario.
 */

export const TIPOS_NOTIFICACION = [
  "mision_enviada",
  "mision_observada",
  "mision_aprobada",
  "mision_anulada",
] as const;

export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];

export const TITULO_NOTIFICACION: Record<TipoNotificacion, string> = {
  mision_enviada: "Misión enviada a revisión",
  mision_observada: "Misión devuelta con observación",
  mision_aprobada: "Misión aprobada",
  mision_anulada: "Misión anulada",
};

/** Qué se espera de quien recibe el aviso. */
export const DETALLE_NOTIFICACION: Record<TipoNotificacion, string> = {
  mision_enviada: "Un operador de tu unidad envió una misión completa. Espera tu decisión.",
  mision_observada: "El supervisor pidió correcciones. Revisa el hilo de observaciones.",
  mision_aprobada: "La misión quedó cerrada y su expediente ya no admite cambios.",
  mision_anulada: "La misión se anuló. El motivo queda registrado en su expediente.",
};

/** Color del punto que acompaña cada aviso, con los tokens de `globals.css`. */
export const COLOR_NOTIFICACION: Record<TipoNotificacion, string> = {
  mision_enviada: "bg-estado-azul",
  mision_observada: "bg-estado-ambar",
  mision_aprobada: "bg-estado-verde",
  mision_anulada: "bg-estado-rojo",
};
