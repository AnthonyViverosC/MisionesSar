import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { verificarFactorMfa } from "@/acciones/mfa";
import { FormularioCodigo } from "@/components/autenticacion/formulario-codigo";

export const metadata: Metadata = { title: "Verificación en dos pasos" };

export default async function PaginaVerificar() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: factores } = await supabase.auth.mfa.listFactors();
  const verificado = factores?.totp?.find((factor) => factor.status === "verified");

  // Sin factor inscrito no hay nada que verificar: el segundo factor es
  // voluntario, así que quien no lo tenga sigue directo al tablero.
  if (!verificado) redirect("/");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl font-semibold text-texto">
          Verificación en dos pasos
        </h1>
        <p className="text-sm text-texto-suave">
          Escribe el código de seis dígitos que muestra tu aplicación de autenticación.
        </p>
      </div>

      <FormularioCodigo
        accion={verificarFactorMfa}
        factorId={verificado.id}
        textoBoton="Verificar"
        textoEnviando="Verificando…"
      />

      <p className="border-t border-borde pt-4 text-xs text-texto-suave">
        ¿Perdiste el acceso a tu aplicación de autenticación? El administrador de la
        plataforma puede retirar el factor y permitirte inscribir uno nuevo.
      </p>
    </div>
  );
}
