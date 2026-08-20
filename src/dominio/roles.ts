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
 * Nota sobre verificación en dos pasos: la unidad decidió no usarla. El ingreso
 * es con correo y contraseña, sin segundo factor para ningún rol. La protección
 * de las cuentas se apoya en la contraseña larga verificada contra filtraciones,
 * el bloqueo tras cinco intentos fallidos y la expiración por inactividad.
 */
