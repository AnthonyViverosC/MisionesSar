import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { confirmarInscripcionMfa, iniciarInscripcionMfa } from "@/acciones/mfa";
import { FormularioCodigo } from "@/components/autenticacion/formulario-codigo";
import { exigeMfa } from "@/dominio/roles";

export const metadata: Metadata = { title: "Segundo factor" };

export default async function PaginaInscribirMfa({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  const obligatorio = perfil ? exigeMfa(perfil.rol) : false;
  const inscripcion = await iniciarInscripcionMfa();

  if ("error" in inscripcion) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-2xl font-semibold text-texto">Segundo factor</h1>
        <p role="alert" className="text-sm text-estado-rojo">
          {inscripcion.error}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl font-semibold text-texto">
          Inscribe tu segundo factor
        </h1>
        <p className="text-sm text-texto-suave">
          {obligatorio || motivo === "obligatorio"
            ? "Tu rol exige verificación en dos pasos para entrar a la plataforma."
            : "Añade una segunda verificación al ingresar. Es opcional para tu rol, y recomendable."}
        </p>
      </div>

      <ol className="space-y-4 text-sm text-texto">
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-marina-900 text-xs font-semibold text-white">
            1
          </span>
          <span>
            Abre tu aplicación de autenticación (Google Authenticator, Microsoft
            Authenticator, 1Password u otra compatible con TOTP).
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-marina-900 text-xs font-semibold text-white">
            2
          </span>
          <div className="space-y-3">
            <span>Escanea este código:</span>
            {/* El QR llega desde Supabase como SVG embebido. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={inscripcion.qr}
              alt="Código QR para inscribir el segundo factor"
              className="size-44 rounded-md border border-borde bg-white p-2"
            />
            <p className="text-xs text-texto-suave">
              ¿No puedes escanear? Escribe esta clave en la aplicación:{" "}
              <code className="rounded bg-superficie px-1.5 py-0.5 font-mono text-[11px] text-texto">
                {inscripcion.secreto}
              </code>
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-marina-900 text-xs font-semibold text-white">
            3
          </span>
          <span className="w-full space-y-3">
            <span className="block">Escribe el código que aparece para confirmar:</span>
            <FormularioCodigo
              accion={confirmarInscripcionMfa}
              factorId={inscripcion.factorId}
              textoBoton="Confirmar segundo factor"
              textoEnviando="Confirmando…"
            />
          </span>
        </li>
      </ol>

      <p className="flex items-start gap-2 border-t border-borde pt-4 text-xs text-texto-suave">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Guarda la clave en un lugar seguro. Si pierdes el dispositivo, solo el
          administrador de la plataforma puede retirar el factor.
        </span>
      </p>
    </div>
  );
}
