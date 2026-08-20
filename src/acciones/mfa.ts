"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { EstadoAccion } from "@/acciones/autenticacion";

/**
 * Segundo factor por TOTP.
 *
 * Obligatorio para admin y supervisor, opcional para el resto. La inscripción
 * y la verificación las hace Supabase Auth; aquí solo se orquesta el flujo y se
 * devuelven mensajes en la voz del sistema.
 */

const esquemaCodigo = z.object({
  factorId: z.string().uuid("Falta el factor a verificar."),
  codigo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código son seis dígitos."),
});

export type FactorInscrito = {
  id: string;
  nombre: string;
  estado: "verified" | "unverified";
  creadoEn: string;
};

/** Datos que necesita la pantalla de inscripción. */
export async function iniciarInscripcionMfa(): Promise<
  { error: string } | { factorId: string; qr: string; secreto: string }
> {
  const supabase = await crearClienteServidor();

  // Un factor sin verificar de un intento anterior estorba: se retira primero.
  const { data: factores } = await supabase.auth.mfa.listFactors();
  const pendiente = factores?.all?.find((factor) => factor.status === "unverified");
  if (pendiente) {
    await supabase.auth.mfa.unenroll({ factorId: pendiente.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Aplicación de autenticación · ${new Date().toLocaleDateString("es-CO")}`,
  });

  if (error || !data) {
    console.warn(`[mfa] Inscripción fallida: ${error?.message}`);
    return { error: "No se pudo iniciar la inscripción del segundo factor. Intenta de nuevo." };
  }

  return {
    factorId: data.id,
    qr: data.totp.qr_code,
    secreto: data.totp.secret,
  };
}

/** Confirma la inscripción con el primer código que genera la aplicación. */
export async function confirmarInscripcionMfa(
  _estadoPrevio: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const analisis = esquemaCodigo.safeParse({
    factorId: datos.get("factorId"),
    codigo: datos.get("codigo"),
  });

  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message };
  }

  const supabase = await crearClienteServidor();
  const { factorId, codigo } = analisis.data;

  const { data: reto, error: errorReto } = await supabase.auth.mfa.challenge({ factorId });
  if (errorReto || !reto) {
    return { error: "No se pudo verificar el código. Vuelve a intentarlo." };
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: reto.id,
    code: codigo,
  });

  if (error) {
    return {
      error:
        "El código no coincide. Revisa que la hora del dispositivo esté sincronizada y usa el código vigente.",
    };
  }

  revalidatePath("/perfil");
  redirect("/?mfa=inscrito");
}

/** Verifica el segundo factor al ingresar. */
export async function verificarFactorMfa(
  _estadoPrevio: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const analisis = esquemaCodigo.safeParse({
    factorId: datos.get("factorId"),
    codigo: datos.get("codigo"),
  });

  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message };
  }

  const supabase = await crearClienteServidor();
  const { factorId, codigo } = analisis.data;

  const { data: reto, error: errorReto } = await supabase.auth.mfa.challenge({ factorId });
  if (errorReto || !reto) {
    return { error: "No se pudo verificar el código. Vuelve a intentarlo." };
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: reto.id,
    code: codigo,
  });

  if (error) {
    console.warn(`[mfa] Verificación fallida del factor ${factorId}: ${error.message}`);
    return { error: "El código no coincide. Usa el código vigente de tu aplicación." };
  }

  redirect("/");
}

/** Retira un factor. La interfaz solo lo ofrece a quien no tiene MFA obligatorio. */
export async function retirarFactorMfa(factorId: string): Promise<EstadoAccion> {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "La sesión expiró." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  if (perfil?.rol === "admin" || perfil?.rol === "supervisor") {
    return { error: "Tu rol exige mantener el segundo factor activo." };
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return { error: "No se pudo retirar el factor. Intenta de nuevo." };
  }

  revalidatePath("/perfil");
  return { mensaje: "Segundo factor retirado" };
}

/** Factores inscritos del usuario, para la pantalla de perfil. */
export async function listarFactores(): Promise<FactorInscrito[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.mfa.listFactors();

  return (data?.all ?? []).map((factor) => ({
    id: factor.id,
    nombre: factor.friendly_name ?? "Aplicación de autenticación",
    estado: factor.status,
    creadoEn: factor.created_at,
  }));
}
