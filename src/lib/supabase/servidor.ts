import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { entornoPublico } from "@/lib/entorno";
import type { Database } from "@/tipos/basedatos";

/**
 * Cliente de Supabase para el servidor (Server Components, Server Actions y
 * Route Handlers).
 *
 * Actúa en nombre del usuario: usa la clave anónima y la sesión de la cookie,
 * de modo que todas sus consultas pasan por RLS. Es el cliente por defecto:
 * el de servicio solo se usa donde está explícitamente justificado.
 */
export async function crearClienteServidor() {
  const almacenCookies = await cookies();

  return createServerClient<Database>(
    entornoPublico.NEXT_PUBLIC_SUPABASE_URL,
    entornoPublico.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return almacenCookies.getAll();
        },
        setAll(cookiesNuevas) {
          try {
            cookiesNuevas.forEach(({ name, value, options }) => {
              almacenCookies.set(name, value, {
                ...options,
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
              });
            });
          } catch {
            // Los Server Components no pueden escribir cookies. La renovación
            // del token la hace el middleware, así que aquí se ignora.
          }
        },
      },
    },
  );
}
