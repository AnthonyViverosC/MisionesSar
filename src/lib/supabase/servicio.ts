import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/tipos/basedatos";

/**
 * Cliente con la clave de servicio.
 *
 * SALTA TODAS LAS POLÍTICAS DE RLS. El import de `server-only` hace fallar la
 * compilación si este módulo llegara a incluirse en un bundle de cliente.
 *
 * Usos legítimos, y ninguno más:
 *   - emitir URLs firmadas de subida y de descarga, después de verificar el rol
 *   - administrar usuarios (invitar, desactivar) desde el panel de admin
 *   - registrar intentos de ingreso y eventos de autenticación en la bitácora
 *   - la semilla de datos de prueba
 *
 * Toda función que lo use debe comprobar antes, por su cuenta, quién es el
 * usuario y qué puede hacer.
 */
export function crearClienteServicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !clave) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.",
    );
  }

  return createClient<Database>(url, clave, {
    auth: {
      // Un cliente de servicio no tiene sesión que persistir ni refrescar.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
