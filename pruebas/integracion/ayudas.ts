import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as cargarEntorno } from "dotenv";
import type { Database } from "../../src/tipos/basedatos";

/**
 * Utilidades de las pruebas de integración.
 *
 * Estas pruebas hablan con un proyecto real de Supabase, sembrado con
 * `pnpm db:seed`. Si no hay credenciales configuradas, las suites se saltan en
 * vez de fallar: así el repositorio sigue siendo clonable y ejecutable sin
 * acceso a la base.
 */

cargarEntorno({ path: ".env.local", quiet: true });

export const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const CLAVE_ANONIMA = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const CLAVE_SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const CLAVE_USUARIOS = process.env.PRUEBAS_CLAVE_USUARIOS ?? "Sar.Pruebas.2026!";

/** ¿Hay un proyecto real configurado? */
export const HAY_BASE =
  URL_SUPABASE.startsWith("https://") &&
  !URL_SUPABASE.includes("pendiente") &&
  CLAVE_ANONIMA.length > 30 &&
  CLAVE_SERVICIO.length > 30;

export const CORREOS = {
  admin: "admin@sar.mil.co",
  operador: "operador@sar.mil.co",
  supervisor: "supervisor@sar.mil.co",
  consulta: "consulta@sar.mil.co",
  operadorOtraUnidad: "operador.sur@sar.mil.co",
} as const;

/** Cliente autenticado como uno de los usuarios de la semilla. */
export async function clienteComo(correo: string): Promise<SupabaseClient<Database>> {
  const cliente = createClient<Database>(URL_SUPABASE, CLAVE_ANONIMA, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await cliente.auth.signInWithPassword({
    email: correo,
    password: CLAVE_USUARIOS,
  });

  if (error) {
    throw new Error(
      `No se pudo iniciar sesión como ${correo}: ${error.message}. ` +
        "¿Ejecutaste `pnpm db:seed`?",
    );
  }

  return cliente;
}

/** Cliente sin sesión, para comprobar que un anónimo no ve nada. */
export function clienteAnonimo(): SupabaseClient<Database> {
  return createClient<Database>(URL_SUPABASE, CLAVE_ANONIMA, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Cliente de servicio, para preparar datos que las políticas no dejan crear. */
export function clienteServicio(): SupabaseClient<Database> {
  return createClient<Database>(URL_SUPABASE, CLAVE_SERVICIO, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
