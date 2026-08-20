import pg from "pg";
import { config as cargarEntorno } from "dotenv";

/**
 * Conexión directa a Postgres para las herramientas de mantenimiento.
 *
 * Lee las credenciales de `.env.local`; nunca se escriben en el repositorio.
 * Se usa solo desde scripts de administración, jamás desde la aplicación: allí
 * todo pasa por PostgREST y sus políticas de RLS.
 */
cargarEntorno({ path: ".env.local", quiet: true });

export function urlDeConexion() {
  const referencia = process.env.SUPABASE_PROJECT_REF;
  const clave = process.env.SUPABASE_DB_PASSWORD;

  if (!referencia || !clave) {
    throw new Error("Faltan SUPABASE_PROJECT_REF o SUPABASE_DB_PASSWORD en .env.local.");
  }

  return `postgresql://postgres:${encodeURIComponent(clave)}@db.${referencia}.supabase.co:5432/postgres`;
}

/** Cliente conectado y listo para consultar. */
export async function conectar() {
  const cliente = new pg.Client({
    connectionString: urlDeConexion(),
    // Supabase presenta un certificado propio; la conexión sigue siendo TLS.
    ssl: { rejectUnauthorized: false },
  });

  await cliente.connect();
  return cliente;
}
