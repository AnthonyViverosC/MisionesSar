import { z } from "zod";

/**
 * Validación de las variables de entorno.
 *
 * Se valida al cargar el módulo para que una configuración incompleta falle de
 * inmediato y con un mensaje claro, en vez de producir errores oscuros a mitad
 * de una operación. Fallar aquí es deliberado: un despliegue sin credenciales
 * arrancaría, pero ninguna pantalla funcionaría.
 */

const esquemaPublico = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ error: "falta. Panel de Supabase → Settings → API → Project URL." })
    .url("debe ser una URL completa, con https:// incluido."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({ error: "falta. Panel de Supabase → Settings → API → anon public." })
    .min(20, "parece incompleta: la clave anónima es mucho más larga."),
  NEXT_PUBLIC_URL_APLICACION: z
    .string()
    .url("debe ser una URL completa: https://tu-proyecto.vercel.app, sin barra final.")
    .default("http://localhost:3000"),
  NEXT_PUBLIC_MINUTOS_INACTIVIDAD: z.coerce
    .number()
    .int("debe ser un número entero de minutos.")
    .positive("debe ser un número entero de minutos.")
    .default(30),
});

/**
 * Una variable definida pero vacía equivale a no haberla definido.
 *
 * En el panel de Vercel es fácil crear una variable y dejarla en blanco; sin
 * esto, el mensaje de error hablaría de formato cuando el problema real es que
 * no tiene valor.
 */
function valor(bruto: string | undefined): string | undefined {
  const limpio = bruto?.trim();
  return limpio ? limpio : undefined;
}

/**
 * Variables disponibles en el navegador.
 * Next.js sustituye estas referencias en tiempo de compilación, por eso se
 * escriben completas y no con acceso dinámico.
 */
const analisis = esquemaPublico.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: valor(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: valor(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  NEXT_PUBLIC_URL_APLICACION: valor(process.env.NEXT_PUBLIC_URL_APLICACION),
  NEXT_PUBLIC_MINUTOS_INACTIVIDAD: valor(process.env.NEXT_PUBLIC_MINUTOS_INACTIVIDAD),
});

if (!analisis.success) {
  // El error de Zod, tal cual, se pierde entre el ruido del registro de
  // compilación y no dice qué variable hay que tocar. Este mensaje sí.
  const problemas = analisis.error.issues
    .map((problema) => `  · ${problema.path.join(".") || "(sin nombre)"}: ${problema.message}`)
    .join("\n");

  throw new Error(
    `Variables de entorno incompletas o inválidas:\n${problemas}\n\n` +
      "En local se leen de .env.local (usa .env.example como plantilla).\n" +
      "En Vercel, en Settings → Environment Variables, marcando Production, Preview y " +
      "Development. Las NEXT_PUBLIC_* se incrustan al compilar: después de añadirlas o " +
      "cambiarlas hay que volver a desplegar para que surtan efecto.",
  );
}

export const entornoPublico = analisis.data;

/** Milisegundos de inactividad antes de cerrar la sesión. */
export const MS_INACTIVIDAD = entornoPublico.NEXT_PUBLIC_MINUTOS_INACTIVIDAD * 60 * 1000;

/** Milisegundos de antelación con que se avisa al usuario (2 minutos). */
export const MS_AVISO_PREVIO = 2 * 60 * 1000;
