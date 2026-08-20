/**
 * Roles del sistema y sus capacidades.
 *
 * Esta tabla existe para que la interfaz sepa qué mostrar. NO es el control de
 * acceso: la autorización real vive en las políticas de RLS de Postgres y en la
 * verificación de rol que hace cada Server Action. Si esta tabla y la base de
 * datos discrepan, la base de datos manda.
 */

export const ROLES = ["admin", "operador", "supervisor", "consulta"] as const;

export type Rol = (typeof ROLES)[number];

/** Etiqueta que ve el usuario para cada rol. */
export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: "Administrador",
  operador: "Operador",
  supervisor: "Supervisor",
  consulta: "Consulta",
};

/** Descripción corta de cada rol, para la pantalla de administración. */
export const DESCRIPCION_ROL: Record<Rol, string> = {
  admin: "Administra usuarios, catálogos y auditoría. Ve y edita todo.",
  operador: "Crea misiones, carga sus soportes y las envía a revisión.",
  supervisor: "Revisa las misiones de su unidad: aprueba o devuelve con observación.",
  consulta: "Solo lectura y descarga de misiones aprobadas.",
};

/**
 * Roles a los que se les exige verificación en dos pasos.
 *
 * Hoy la lista está vacía por decisión de la unidad: el segundo factor es
 * voluntario y se activa desde el perfil. Para volver a exigirlo a los roles con
 * atribuciones de aprobación basta con escribir aquí `["admin", "supervisor"]`;
 * el resto del flujo —inscripción, verificación al ingresar y bloqueo del
 * retiro— ya está implementado y se aplica solo.
 */
export const ROLES_CON_MFA_OBLIGATORIO: readonly Rol[] = [];

export function exigeMfa(rol: Rol): boolean {
  return ROLES_CON_MFA_OBLIGATORIO.includes(rol);
}
