import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { entornoPublico, MS_INACTIVIDAD } from "@/lib/entorno";
import type { Database } from "@/tipos/basedatos";

/** Nombre de la cookie que guarda la marca de última actividad. */
export const COOKIE_ACTIVIDAD = "sar_actividad";

/** Rutas accesibles sin sesión. */
const RUTAS_PUBLICAS = [
  "/login",
  "/recuperar",
  "/invitacion",
  "/privacidad",
  "/auth/callback",
  "/auth/cerrar",
];

/** Rutas que un usuario con sesión iniciada puede visitar aunque tenga
 *  pendiente el primer ingreso (cambio de contraseña y aviso de uso). */
const RUTAS_DE_TRAMITE = ["/primer-ingreso", "/auth/cerrar", "/privacidad"];

export function esRutaPublica(ruta: string): boolean {
  return RUTAS_PUBLICAS.some((publica) => ruta === publica || ruta.startsWith(`${publica}/`));
}

function esRutaDeTramite(ruta: string): boolean {
  return RUTAS_DE_TRAMITE.some((tramite) => ruta === tramite || ruta.startsWith(`${tramite}/`));
}

/**
 * Resuelve la sesión en cada petición: renueva el token de forma silenciosa,
 * aplica la expiración por inactividad y redirige según el estado del usuario.
 *
 * Se ejecuta antes de cualquier página. Ninguna ruta distinta de las públicas
 * llega a renderizarse sin sesión válida.
 */
export async function resolverSesion(request: NextRequest, respuesta: NextResponse) {
  const ruta = request.nextUrl.pathname;

  const supabase = createServerClient<Database>(
    entornoPublico.NEXT_PUBLIC_SUPABASE_URL,
    entornoPublico.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesNuevas) {
          cookiesNuevas.forEach(({ name, value, options }) => {
            respuesta.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              path: "/",
            });
          });
        },
      },
    },
  );

  // getUser valida el token contra el servidor de Auth: es la comprobación que
  // no se puede falsificar desde el navegador. De paso renueva el token si está
  // por vencer, que es la renovación silenciosa mientras el usuario trabaja.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (esRutaPublica(ruta)) return respuesta;
    return redirigirALogin(request, respuesta);
  }

  // ---------------------------------------------------------------------------
  // Expiración por inactividad
  // ---------------------------------------------------------------------------
  const marcaActividad = Number(request.cookies.get(COOKIE_ACTIVIDAD)?.value ?? 0);
  const ahora = Date.now();

  if (marcaActividad && ahora - marcaActividad > MS_INACTIVIDAD) {
    await supabase.auth.signOut();
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = "?motivo=inactividad";
    const salida = NextResponse.redirect(destino);
    limpiarCookies(request, salida);
    return salida;
  }

  // Cada navegación renueva la marca de actividad.
  respuesta.cookies.set(COOKIE_ACTIVIDAD, String(ahora), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(MS_INACTIVIDAD / 1000),
  });

  if (esRutaPublica(ruta) && !esRutaDeTramite(ruta)) {
    // Con sesión activa, el login no tiene sentido.
    const destino = request.nextUrl.clone();
    destino.pathname = "/";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  // ---------------------------------------------------------------------------
  // Obligaciones pendientes del usuario
  // ---------------------------------------------------------------------------
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, activo, debe_cambiar_clave, aviso_aceptado_en")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil || !perfil.activo) {
    // Cuenta desactivada o sin perfil: se cierra la sesión de inmediato.
    await supabase.auth.signOut();
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = "?motivo=cuenta_inactiva";
    const salida = NextResponse.redirect(destino);
    limpiarCookies(request, salida);
    return salida;
  }

  if (esRutaDeTramite(ruta)) return respuesta;

  // Primer ingreso: cambio de contraseña y aceptación del aviso de uso.
  if (perfil.debe_cambiar_clave || !perfil.aviso_aceptado_en) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/primer-ingreso";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  // El ingreso es con correo y contraseña: no hay segundo factor que verificar.
  return respuesta;
}

function redirigirALogin(request: NextRequest, respuesta: NextResponse) {
  const destino = request.nextUrl.clone();
  const rutaOriginal = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  destino.pathname = "/login";
  destino.search = rutaOriginal === "/" ? "" : `?siguiente=${encodeURIComponent(rutaOriginal)}`;

  const salida = NextResponse.redirect(destino);
  // Conserva las cookies que el cliente de Supabase haya podido actualizar.
  respuesta.cookies.getAll().forEach((cookie) => salida.cookies.set(cookie));
  return salida;
}

function limpiarCookies(request: NextRequest, respuesta: NextResponse) {
  request.cookies.getAll().forEach((cookie) => {
    if (cookie.name.startsWith("sb-") || cookie.name === COOKIE_ACTIVIDAD) {
      respuesta.cookies.delete(cookie.name);
    }
  });
}
