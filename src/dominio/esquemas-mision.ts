import { z } from "zod";

/**
 * Esquema de una misión.
 *
 * Es el mismo objeto en el navegador y en el servidor: React Hook Form lo usa
 * para validar mientras se escribe, y la Server Action vuelve a aplicarlo antes
 * de tocar la base. Que el cliente ya haya validado no exime al servidor.
 */

const textoObligatorio = (etiqueta: string, minimo = 3) =>
  z
    .string()
    .trim()
    .min(minimo, `${etiqueta} es obligatorio.`)
    .max(200, `${etiqueta} no puede superar los 200 caracteres.`);

/** Número con formato AAAA-NNN, como en la referencia visual. */
export const esquemaNumeroMision = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{3}$/, "El número de misión va en formato AAAA-NNN, por ejemplo 2026-042.");

const fechaIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha válida.")
  .refine((valor) => !Number.isNaN(Date.parse(valor)), "Usa una fecha válida.");

/**
 * Campo numérico opcional que viaja como texto.
 *
 * Los formularios entregan cadenas. Se valida como cadena y la conversión a
 * número ocurre en un solo sitio, `aRegistro`, justo antes de guardar: así el
 * tipo de entrada y el de salida del esquema coinciden y el formulario no tiene
 * que lidiar con dos formas del mismo dato.
 */
const numeroOpcional = (minimo: number, maximo: number, mensaje: string) =>
  z
    .string()
    .trim()
    .optional()
    .refine((valor) => {
      if (!valor) return true;
      const numero = Number(valor);
      return Number.isFinite(numero) && numero >= minimo && numero <= maximo;
    }, mensaje);

export const esquemaMision = z
  .object({
    numero_mision: esquemaNumeroMision,
    fecha_inicio: fechaIso,
    fecha_fin: fechaIso.optional().or(z.literal("")),
    tipo_mision_id: z.string().uuid("Selecciona el tipo de misión."),
    aeronave_id: z.string().uuid("Selecciona la aeronave."),
    unidad_id: z.string().uuid("Selecciona la unidad."),
    comandante_aeronave: textoObligatorio("El comandante de la aeronave"),
    zona_operacion: textoObligatorio("La zona de operación"),
    latitud: numeroOpcional(-90, 90, "La latitud va entre -90 y 90 grados."),
    longitud: numeroOpcional(-180, 180, "La longitud va entre -180 y 180 grados."),
    horas_vuelo: numeroOpcional(0, 999, "Las horas de vuelo van entre 0 y 999."),
    resumen: z
      .string()
      .trim()
      .max(2000, "El resumen no puede superar los 2000 caracteres.")
      .optional(),
  })
  // El número de misión empieza por el año de la fecha de inicio: es la misma
  // regla que aplica el trigger `completar_datos_mision`.
  .refine(
    (datos) => datos.numero_mision.slice(0, 4) === datos.fecha_inicio.slice(0, 4),
    {
      message: "El número de misión debe empezar por el año de la fecha de inicio.",
      path: ["numero_mision"],
    },
  )
  .refine(
    (datos) => !datos.fecha_fin || datos.fecha_fin >= datos.fecha_inicio,
    { message: "La fecha de finalización no puede ser anterior al inicio.", path: ["fecha_fin"] },
  )
  // Las coordenadas van completas o no van.
  .refine((datos) => Boolean(datos.latitud) === Boolean(datos.longitud), {
    message: "Escribe las dos coordenadas o ninguna.",
    path: ["longitud"],
  });

export type DatosMision = z.infer<typeof esquemaMision>;

/** Pasos del formulario, con los campos que valida cada uno. */
export const PASOS_FORMULARIO = [
  {
    numero: 1,
    titulo: "Identificación",
    descripcion: "Número, fechas y tipo de misión.",
    campos: ["numero_mision", "fecha_inicio", "fecha_fin", "tipo_mision_id", "unidad_id"],
  },
  {
    numero: 2,
    titulo: "Aeronave y tripulación",
    descripcion: "Matrícula, comandante y horas de vuelo.",
    campos: ["aeronave_id", "comandante_aeronave", "horas_vuelo"],
  },
  {
    numero: 3,
    titulo: "Operación",
    descripcion: "Zona, coordenadas y resumen de lo ejecutado.",
    campos: ["zona_operacion", "latitud", "longitud", "resumen"],
  },
] as const satisfies readonly {
  numero: number;
  titulo: string;
  descripcion: string;
  campos: readonly (keyof DatosMision)[];
}[];

/** Convierte los campos vacíos del formulario en los nulos que espera la base. */
export function aRegistro(datos: DatosMision) {
  const numero = (valor: string | undefined) =>
    valor === undefined || valor.trim() === "" ? null : Number(valor);

  return {
    numero_mision: datos.numero_mision,
    fecha_inicio: datos.fecha_inicio,
    fecha_fin: datos.fecha_fin ? datos.fecha_fin : null,
    tipo_mision_id: datos.tipo_mision_id,
    aeronave_id: datos.aeronave_id,
    unidad_id: datos.unidad_id,
    comandante_aeronave: datos.comandante_aeronave,
    zona_operacion: datos.zona_operacion,
    latitud: numero(datos.latitud),
    longitud: numero(datos.longitud),
    horas_vuelo: numero(datos.horas_vuelo),
    resumen: datos.resumen ? datos.resumen : null,
  };
}

/** Filtros del listado de misiones. Todos opcionales. */
export const esquemaFiltros = z.object({
  q: z.string().trim().max(60).optional(),
  estado: z.string().optional(),
  unidad: z.string().uuid().optional(),
  aeronave: z.string().uuid().optional(),
  tipo: z.string().uuid().optional(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  orden: z.enum(["numero_mision", "fecha_inicio", "estado", "actualizado_en"]).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});

export type FiltrosListado = z.infer<typeof esquemaFiltros>;

/** Filas por página del listado. */
export const TAMANO_PAGINA = 20;
