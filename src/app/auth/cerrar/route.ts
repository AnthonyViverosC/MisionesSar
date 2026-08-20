import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";

/**
 * Cierre de sesión.
 *
 * Solo responde a POST: un GET permitiría cerrarle la sesión a alguien con una
 * simple etiqueta de imagen en otra página.
 */
export async function POST(request: NextRequest) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const servicio = crearClienteServicio();
    await servicio.rpc("registrar_evento_autenticacion", {
      p_accion: "cerrar_sesion",
      p_actor_id: user.id,
      p_actor_email: user.email ?? null,
      p_ip: request.headers.get("x-forwarded-for"),
      p_user_agent: request.headers.get("user-agent"),
      p_detalle: null,
    });
  }

  await supabase.auth.signOut();

  return NextResponse.redirect(
    new URL("/login?motivo=sesion_cerrada", request.nextUrl.origin),
    { status: 303 },
  );
}
