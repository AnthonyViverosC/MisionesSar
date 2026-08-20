import { z } from "zod";

/**
 * Validación de las variables de entorno.
 *
 * Se valida en el primer uso, no al importar el módulo. La diferencia importa al
 * compilar: Next.js importa cada Route Handler para recolectar sus datos, y si
 * la validación se ejecutara ahí, un despliegue sin variables fallaría con un
 * «Failed to collect page data» que no dice nada del problema real.
 *
 * Compilar sin ellas es inofensivo —ninguna página estática habla con Supabase—,
 * pero atender una petición sin ellas no lo es: por eso el primer acceso al
 * entorno sí falla, y con un mensaje que nombra la variable que falta.
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

type EntornoPublico = z.infer<typeof esquemaPublico>;

/**
 * Una variable definida pero vacía equivale a no haberla definido.
 *
 * En el panel de Vercel es fácil crear una variable y dejarla en blanco; sin
 * esto, el mensaje hablaría de formato cuando el problema es que no tiene valor.
 */
function valor(bruto: string | undefined): string | undefined {
  const limpio = bruto?.trim();
  return limpio ? limpio : undefined;
}

/**
 * Next.js sustituye estas referencias en tiempo de compilación, por eso se
 * escriben completas y no con acceso dinámico.
 */
function leerDelProceso() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: valor(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: valor(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_URL_APLICACION: valor(process.env.NEXT_PUBLIC_URL_APLICACION),
    NEXT_PUBLIC_MINUTOS_INACTIVIDAD: valor(process.env.NEXT_PUBLIC_MINUTOS_INACTIVIDAD),
  };
}

/** Mensaje con la variable concreta que hay que corregir y dónde se configura. */
function explicar(error: z.ZodError): string {
  const problemas = error.issues
    .map((problema) => `  · ${problema.path.join(".") || "(sin nombre)"}: ${problema.message}`)
    .join("\n");

  return (
    `Variables de entorno incompletas o inválidas:\n${problemas}\n\n` +
    "En local se leen de .env.local (usa .env.example como plantilla).\n" +
    "En Vercel, en Settings → Environment Variables, marcando Production, Preview y " +
    "Development. Las NEXT_PUBLIC_* se incrustan al compilar: después de añadirlas o " +
    "cambiarlas hay que volver a desplegar para que surtan efecto."
  );
}

let resuelto: EntornoPublico | null = null;

function resolver(): EntornoPublico {
  if (resuelto) return resuelto;

  const analisis = esquemaPublico.safeParse(leerDelProceso());

  if (!analisis.success) {
    throw new Error(explicar(analisis.error));
  }

  resuelto = analisis.data;
  return resuelto;
}

// Aviso temprano, sin interrumpir. Deja el detalle en el registro de la
// compilación, donde se ve antes de que nadie abra la aplicación.
{
  const analisis = esquemaPublico.safeParse(leerDelProceso());
  if (!analisis.success) {
    console.warn(`[entorno] ${explicar(analisis.error)}`);
  }
}

/**
 * Variables disponibles en el navegador.
 *
 * Es un proxy a propósito: leer cualquiera de sus campos dispara la validación,
 * de modo que el error aparece cuando de verdad se necesita el valor y no al
 * importar el módulo.
 */
export const entornoPublico = new Proxy({} as EntornoPublico, {
  get(_objetivo, propiedad) {
    if (typeof propiedad === "symbol") return undefined;
    return resolver()[propiedad as keyof EntornoPublico];
  },
});

/** Milisegundos de inactividad antes de cerrar la sesión. */
export function msInactividad(): number {
  return entornoPublico.NEXT_PUBLIC_MINUTOS_INACTIVIDAD * 60 * 1000;
}

/** Milisegundos de antelación con que se avisa al usuario (2 minutos). */
export const MS_AVISO_PREVIO = 2 * 60 * 1000;
