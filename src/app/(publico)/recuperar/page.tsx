import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRecuperacion } from "./formulario-recuperacion";

export const metadata: Metadata = { title: "Recuperar acceso" };

export default function PaginaRecuperar() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl font-semibold text-texto">Recuperar acceso</h1>
        <p className="text-sm text-texto-suave">
          Te enviamos un enlace de un solo uso para definir una contraseña nueva.
        </p>
      </div>

      <FormularioRecuperacion />

      <p className="text-sm text-texto-suave">
        <Link href="/login" className="font-medium text-marina-900 underline underline-offset-2">
          Volver a ingresar
        </Link>
      </p>
    </div>
  );
}
