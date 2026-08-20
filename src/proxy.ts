import { NextResponse, type NextRequest } from "next/server";
import { construirCsp, generarNonce } from "@/lib/seguridad/csp";
import { resolverSesion } from "@/lib/supabase/sesion-middleware";

/**
 * Intermediario único de la aplicación (lo que en versiones anteriores de
 * Next.js se llamaba middleware).
 *
 * Hace dos cosas, en este orden:
 *   1. genera la Content-Security-Policy de la petición, con su propio nonce
 *   2. resuelve la sesión: renueva el token, aplica la expiración por
 *      inactividad y protege todas las rutas salvo las públicas
 */
export async function proxy(request: NextRequest) {
  const nonce = generarNonce();
  const esProduccion = process.env.NODE_ENV === "production";
  const csp = construirCsp(nonce, esProduccion);

  // Next.js lee estas cabeceras de la petición para marcar con el nonce los
  // scripts que él mismo inserta en la página.
  const cabecerasPeticion = new Headers(request.headers);
  cabecerasPeticion.set("x-nonce", nonce);
  cabecerasPeticion.set("content-security-policy", csp);

  const respuesta = NextResponse.next({ request: { headers: cabecerasPeticion } });
  respuesta.headers.set("content-security-policy", csp);

  return resolverSesion(request, respuesta);
}

export const config = {
  matcher: [
    /*
     * Todas las rutas menos los archivos estáticos y las imágenes optimizadas.
     * Qué ruta es pública se decide dentro de `resolverSesion`, no aquí: así el
     * criterio vive en un solo lugar.
     */
    "/((?!_next/static|_next/image|favicon.ico|escudo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
