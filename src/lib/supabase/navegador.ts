"use client";

import { createBrowserClient } from "@supabase/ssr";
import { entornoPublico } from "@/lib/entorno";
import type { Database } from "@/tipos/basedatos";

/**
 * Cliente de Supabase para componentes de cliente.
 *
 * Usa exclusivamente la clave anónima: cualquier lectura o escritura que
 * intente queda sujeta a las políticas de RLS. La sesión vive en una cookie
 * httpOnly gestionada por el servidor, nunca en localStorage.
 */
export function crearClienteNavegador() {
  return createBrowserClient<Database>(
    entornoPublico.NEXT_PUBLIC_SUPABASE_URL,
    entornoPublico.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
