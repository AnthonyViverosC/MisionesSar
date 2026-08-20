import { z } from "zod";
import { ROLES } from "./roles";

/**
 * Esquemas de administración: usuarios y catálogos.
 *
 * Como en el resto del proyecto, el mismo objeto valida en el navegador y en la
 * Server Action. Las reglas que de verdad protegen los datos siguen siendo las
 * de RLS: aquí solo se rechaza pronto lo que la base rechazaría después.
 */

const correo = z
  .string()
  .trim()
  .toLowerCase()
  .email("Escribe un correo institucional válido.")
  .max(320, "El correo no puede superar los 320 caracteres.");

const nombreCompleto = z
  .string()
  .trim()
  .min(5, "Escribe el nombre y los apellidos.")
  .max(120, "El nombre no puede superar los 120 caracteres.");

const documento = z
  .string()
  .trim()
  .regex(/^\d{5,15}$/, "El documento de identidad va sin puntos, entre 5 y 15 dígitos.");

const grado = z
  .string()
  .trim()
  .max(60, "El grado no puede superar los 60 caracteres.")
  .optional()
  .or(z.literal(""));

const telefono = z
  .string()
  .trim()
  .regex(/^[\d+\s()-]{7,20}$/, "El teléfono admite dígitos, espacios, paréntesis, + y guion.")
  .optional()
  .or(z.literal(""));

const rol = z.enum(ROLES);

/**
 * Operador y supervisor trabajan siempre dentro de una unidad: sin unidad no hay
 * frontera de visibilidad que aplicar. Es la misma restricción
 * `perfiles_unidad_obligatoria` que tiene la tabla.
 */
const exigeUnidad = (datos: { rol: (typeof ROLES)[number]; unidad_id?: string }) =>
  datos.rol === "admin" || datos.rol === "consulta" || Boolean(datos.unidad_id);

const MENSAJE_UNIDAD = {
  message: "Operador y supervisor necesitan una unidad asignada.",
  path: ["unidad_id"],
};

/** Alta de usuario. El correo solo se define aquí: después no cambia. */
export const esquemaInvitacion = z
  .object({
    correo,
    nombre_completo: nombreCompleto,
    documento_identidad: documento,
    grado,
    telefono,
    rol,
    unidad_id: z.string().uuid("Selecciona la unidad.").optional().or(z.literal("")),
  })
  .refine(exigeUnidad, MENSAJE_UNIDAD);

export type DatosInvitacion = z.infer<typeof esquemaInvitacion>;

/** Edición de un usuario por parte del admin. El correo no está: no se cambia. */
export const esquemaUsuario = z
  .object({
    nombre_completo: nombreCompleto,
    documento_identidad: documento,
    grado,
    telefono,
    rol,
    unidad_id: z.string().uuid("Selecciona la unidad.").optional().or(z.literal("")),
    activo: z.boolean(),
  })
  .refine(exigeUnidad, MENSAJE_UNIDAD);

export type DatosUsuario = z.infer<typeof esquemaUsuario>;

/** Datos que cada quien mantiene de sí mismo. Rol y unidad no aparecen. */
export const esquemaPerfilPropio = z.object({
  nombre_completo: nombreCompleto,
  grado,
  telefono,
});

export type DatosPerfilPropio = z.infer<typeof esquemaPerfilPropio>;

// -----------------------------------------------------------------------------
// Catálogos
// -----------------------------------------------------------------------------

export const esquemaUnidad = z.object({
  id: z.string().uuid().optional(),
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "El código de la unidad es obligatorio.")
    .max(20, "El código no puede superar los 20 caracteres."),
  nombre: z
    .string()
    .trim()
    .min(3, "El nombre de la unidad es obligatorio.")
    .max(120, "El nombre no puede superar los 120 caracteres."),
  activa: z.boolean(),
});

export type DatosUnidad = z.infer<typeof esquemaUnidad>;

export const esquemaAeronave = z.object({
  id: z.string().uuid().optional(),
  // La restricción `aeronaves_matricula_formato` exige mayúsculas sin espacios.
  matricula: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,15}$/, "La matrícula va en mayúsculas, sin espacios: FAC-1234."),
  tipo: z
    .string()
    .trim()
    .min(2, "Escribe el tipo de aeronave.")
    .max(80, "El tipo no puede superar los 80 caracteres."),
  unidad_id: z.string().uuid("Selecciona la unidad a la que pertenece."),
  activa: z.boolean(),
});

export type DatosAeronave = z.infer<typeof esquemaAeronave>;

export const esquemaTipoMision = z.object({
  id: z.string().uuid().optional(),
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{2,20}$/, "El código admite letras, números y guion bajo."),
  nombre: z
    .string()
    .trim()
    .min(3, "El nombre del tipo de misión es obligatorio.")
    .max(80, "El nombre no puede superar los 80 caracteres."),
  // El formulario lo registra con `valueAsNumber`, así que llega ya numérico.
  orden: z
    .number()
    .int("El orden es un número entero.")
    .min(0, "El orden no puede ser negativo.")
    .max(999, "El orden no puede superar 999."),
  activo: z.boolean(),
});

export type DatosTipoMision = z.infer<typeof esquemaTipoMision>;

/** Filtros de la bitácora de auditoría. */
export const esquemaFiltrosAuditoria = z.object({
  accion: z.string().trim().max(40).optional(),
  entidad: z.string().trim().max(40).optional(),
  actor: z.string().trim().max(320).optional(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});

export type FiltrosAuditoria = z.infer<typeof esquemaFiltrosAuditoria>;

/** Registros por página de la bitácora. */
export const TAMANO_PAGINA_AUDITORIA = 50;
