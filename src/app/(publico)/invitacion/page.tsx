import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { INSTITUCION } from "@/config/institucion";

export const metadata: Metadata = { title: "Invitación" };

/**
 * Aterrizaje de las invitaciones.
 *
 * El enlace del correo entra por `/auth/callback`, que canjea el token y lleva
 * directo al primer ingreso. Aquí se llega cuando ese enlace ya se usó, venció
 * o alguien abre la dirección a mano: en vez de un 404, se explica qué hacer.
 */
export default function PaginaInvitacion() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <MailCheck className="size-8 text-marina-900" aria-hidden />
        <h1 className="font-serif text-2xl font-semibold text-texto">
          Invitación a {INSTITUCION.nombre}
        </h1>
        <p className="text-sm text-texto-suave">
          No hay registro público: las cuentas las crea un administrador y llegan por correo.
        </p>
      </div>

      <ol className="space-y-3 border-l-2 border-borde pl-4">
        {[
          "Busca en tu correo institucional el mensaje de invitación. Revisa también la carpeta de no deseados.",
          "Abre el enlace del mensaje. Es de un solo uso y vence en una hora.",
          "Define tu contraseña y acepta el aviso de uso. A partir de ahí entras con tu correo y esa contraseña.",
        ].map((paso, indice) => (
          <li key={paso} className="text-sm text-texto-suave">
            <span className="font-medium text-texto">Paso {indice + 1}. </span>
            {paso}
          </li>
        ))}
      </ol>

      <div className="space-y-2 rounded-md bg-superficie px-4 py-3">
        <p className="text-sm font-medium text-texto">¿El enlace ya no funciona?</p>
        <p className="text-sm text-texto-suave">
          Pide a tu administrador que lo reenvíe, o solicítalo tú desde{" "}
          <Link href="/recuperar" className="font-medium text-marina-900 hover:underline">
            recuperar contraseña
          </Link>{" "}
          si tu cuenta ya existe.
        </p>
      </div>

      <Link
        href="/login"
        className="block text-center text-sm font-medium text-marina-900 hover:underline"
      >
        Volver al ingreso
      </Link>
    </div>
  );
}
