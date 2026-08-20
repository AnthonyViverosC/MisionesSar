import { z } from "zod";

/**
 * Validación de las variables de entorno.
 *
 * Se valida al arrancar para que una configuración incompleta falle de
 * inmediato y con un mensaje claro, en vez de producir errores oscuros a mitad
 * de una operación.
 */

const esquemaPublico = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, "Falta NEXT_PUBLIC_SUPABASE_ANON_KEY."),
  NEXT_PUBLIC_URL_APLICACION: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_MINUTOS_INACTIVIDAD: z.coerce.number().int().positive().default(30),
});

/**
 * Variables disponibles en el navegador.
 * Next.js sustituye estas referencias en tiempo de compilación, por eso se
 * escriben completas y no con acceso dinámico.
 */
export const entornoPublico = esquemaPublico.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_URL_APLICACION: process.env.NEXT_PUBLIC_URL_APLICACION,
  NEXT_PUBLIC_MINUTOS_INACTIVIDAD: process.env.NEXT_PUBLIC_MINUTOS_INACTIVIDAD,
});

/** Milisegundos de inactividad antes de cerrar la sesión. */
export const MS_INACTIVIDAD = entornoPublico.NEXT_PUBLIC_MINUTOS_INACTIVIDAD * 60 * 1000;

/** Milisegundos de antelación con que se avisa al usuario (2 minutos). */
export const MS_AVISO_PREVIO = 2 * 60 * 1000;
