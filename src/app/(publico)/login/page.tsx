import type { Metadata } from "next";
import Link from "next/link";
import { FormularioIngreso } from "./formulario-ingreso";

export const metadata: Metadata = { title: "Ingresar" };

const MOTIVOS: Record<string, string> = {
  inactividad: "Tu sesión se cerró por inactividad. Vuelve a ingresar para continuar.",
  cuenta_inactiva:
    "Tu cuenta está desactivada. Comunícate con el administrador de la plataforma.",
  sesion_cerrada: "Cerraste la sesión correctamente.",
};

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string; motivo?: string }>;
}) {
  const { siguiente, motivo } = await searchParams;
  const aviso = motivo ? MOTIVOS[motivo] : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl font-semibold text-texto">Ingresar</h1>
        <p className="text-sm text-texto-suave">
          Accede con el correo institucional que registró el administrador.
        </p>
      </div>

      {aviso ? (
        <p
          role="status"
          className="rounded-md border border-borde bg-estado-azul-fondo px-3 py-2 text-sm text-estado-azul"
        >
          {aviso}
        </p>
      ) : null}

      <FormularioIngreso siguiente={siguiente} />

      <p className="text-sm text-texto-suave">
        ¿Olvidaste tu contraseña?{" "}
        <Link href="/recuperar" className="font-medium text-marina-900 underline underline-offset-2">
          Recuperar acceso
        </Link>
      </p>

      <p className="border-t border-borde pt-4 text-xs text-texto-suave">
        Esta plataforma no tiene registro público. Las cuentas las crea el administrador de
        la unidad y llegan por invitación al correo institucional.
      </p>
    </div>
  );
}
