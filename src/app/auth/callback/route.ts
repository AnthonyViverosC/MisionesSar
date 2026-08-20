import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/**
 * Punto de retorno de los enlaces que Supabase envía por correo: invitación,
 * recuperación de contraseña y confirmación de correo.
 *
 * Admite las dos formas del enlace: el código PKCE y el par token_hash/type.
 * En ambos casos el token es de un solo uso: si ya se consumió, el usuario
 * vuelve al login con un mensaje que le dice qué hacer.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const codigo = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const destino = searchParams.get("destino") ?? "/primer-ingreso";

  const supabase = await crearClienteServidor();

  if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(destino, origin));
    }
    console.warn(`[auth] Enlace inválido (${tipo}): ${error.message}`);
  } else if (codigo) {
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) {
      return NextResponse.redirect(new URL(destino, origin));
    }
    console.warn(`[auth] Código inválido: ${error.message}`);
  }

  return NextResponse.redirect(new URL("/login?motivo=enlace_invalido", origin));
}
