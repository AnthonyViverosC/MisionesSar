import { Marca } from "@/components/marca/escudo";
import { INSTITUCION } from "@/config/institucion";

/**
 * Marco de los trámites que hay que resolver antes de entrar: cambio de
 * contraseña del primer ingreso, verificación e inscripción del segundo factor.
 * Sin navegación lateral, para que no haya dónde desviarse.
 */
export default function LayoutTramite({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-marina-900">
      <header className="px-6 py-8 sm:px-10">
        <Marca tamano={44} />
      </header>

      <main id="contenido" className="flex flex-1 items-start justify-center px-4 pb-16">
        <div className="w-full max-w-lg rounded-lg border border-borde bg-card p-8 shadow-sm">
          {children}
        </div>
      </main>

      <footer className="px-6 pb-8 text-center text-xs text-marina-400 sm:px-10">
        {INSTITUCION.unidadPropietaria}
      </footer>
    </div>
  );
}
