import { z } from "zod";

/**
 * Filtros del archivo histórico.
 *
 * Los comparten la pantalla y la exportación a CSV, para que lo que se descarga
 * sea exactamente lo que se está viendo.
 */
export const esquemaFiltrosArchivo = z.object({
  q: z.string().trim().max(80).optional(),
  anio: z.coerce.number().int().min(1990).max(2100).optional(),
  estado: z.enum(["aprobada", "anulada"]).optional(),
  unidad: z.string().uuid().optional(),
  tipo: z.string().uuid().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});

export type FiltrosArchivo = z.infer<typeof esquemaFiltrosArchivo>;

/** Filas por página del archivo. */
export const TAMANO_PAGINA_ARCHIVO = 25;

/** Tope de filas de una exportación, para no armar un CSV de memoria infinita. */
export const MAXIMO_EXPORTACION = 5000;
