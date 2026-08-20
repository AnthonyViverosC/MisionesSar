import type { AccionAuditoria } from "@/tipos/basedatos";

/**
 * Vocabulario de la bitácora.
 *
 * El enum `accion_auditoria` lo escriben los triggers de Postgres; aquí solo se
 * traduce a algo legible y se agrupa para los filtros de la pantalla.
 */

export const ACCIONES_AUDITORIA: AccionAuditoria[] = [
  "crear",
  "actualizar",
  "cambiar_estado",
  "subir_documento",
  "reemplazar_documento",
  "descargar_documento",
  "observar",
  "anular",
  "ingreso_exitoso",
  "ingreso_fallido",
  "cerrar_sesion",
  "invitar_usuario",
  "cambiar_rol",
  "desactivar_usuario",
];

export const ETIQUETA_ACCION_AUDITORIA: Record<AccionAuditoria, string> = {
  crear: "Creación",
  actualizar: "Actualización",
  cambiar_estado: "Cambio de estado",
  subir_documento: "Carga de documento",
  reemplazar_documento: "Reemplazo de documento",
  descargar_documento: "Descarga de documento",
  observar: "Observación",
  anular: "Anulación",
  ingreso_exitoso: "Ingreso",
  ingreso_fallido: "Ingreso fallido",
  cerrar_sesion: "Cierre de sesión",
  invitar_usuario: "Invitación de usuario",
  cambiar_rol: "Cambio de rol",
  desactivar_usuario: "Desactivación de cuenta",
};

/** Color del indicador de cada acción, con los tokens de `globals.css`. */
export const COLOR_ACCION_AUDITORIA: Record<AccionAuditoria, string> = {
  crear: "bg-estado-azul",
  actualizar: "bg-estado-gris",
  cambiar_estado: "bg-estado-indigo",
  subir_documento: "bg-estado-azul",
  reemplazar_documento: "bg-estado-ambar",
  descargar_documento: "bg-estado-gris",
  observar: "bg-estado-ambar",
  anular: "bg-estado-rojo",
  ingreso_exitoso: "bg-estado-verde",
  ingreso_fallido: "bg-estado-rojo",
  cerrar_sesion: "bg-estado-gris",
  invitar_usuario: "bg-estado-azul",
  cambiar_rol: "bg-estado-ambar",
  desactivar_usuario: "bg-estado-rojo",
};

/** Entidades sobre las que se registran movimientos. */
export const ENTIDADES_AUDITORIA = [
  "misiones",
  "documentos",
  "observaciones",
  "perfiles",
  "autenticacion",
] as const;

export const ETIQUETA_ENTIDAD: Record<string, string> = {
  misiones: "Misiones",
  documentos: "Documentos",
  observaciones: "Observaciones",
  perfiles: "Usuarios",
  autenticacion: "Autenticación",
};
