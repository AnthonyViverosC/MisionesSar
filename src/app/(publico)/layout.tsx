import Link from "next/link";
import { Marca } from "@/components/marca/escudo";
import { INSTITUCION } from "@/config/institucion";

/**
 * Marco de las pantallas sin sesión: login, recuperación e invitación.
 * Tarjeta centrada sobre el azul institucional, como en la referencia.
 */
export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-marina-900">
      <header className="px-6 py-8 sm:px-10">
        <Marca tamano={44} />
      </header>

      <main id="contenido" className="flex flex-1 items-start justify-center px-4 pb-16">
        <div className="w-full max-w-md rounded-lg border border-borde bg-card p-8 shadow-sm">
          {children}
        </div>
      </main>

      <footer className="px-6 pb-8 text-center text-xs text-marina-400 sm:px-10">
        <p>{INSTITUCION.unidadPropietaria}</p>
        <p className="mt-1">
          Uso institucional restringido.{" "}
          <Link href="/privacidad" className="underline underline-offset-2 hover:text-white">
            Aviso de privacidad
          </Link>
        </p>
      </footer>
    </div>
  );
}
