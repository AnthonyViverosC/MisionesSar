import { BarraLateral } from "@/components/navegacion/barra-lateral";
import { BarraSuperior } from "@/components/navegacion/barra-superior";
import { VigilanteInactividad } from "@/components/sesion/vigilante-inactividad";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirSesion } from "@/lib/sesion";

/**
 * Marco de la aplicación con sesión: barra lateral fija, barra superior con
 * buscador y el contenido sobre el gris claro, como en la referencia.
 */
export default async function LayoutAplicacion({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await exigirSesion();
  const supabase = await crearClienteServidor();

  const { count } = await supabase
    .from("notificaciones")
    .select("id", { count: "exact", head: true })
    .eq("leida", false);

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:block">
        <BarraLateral rol={sesion.rol} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperior
          nombre={sesion.nombreCompleto}
          correo={sesion.correo}
          rol={sesion.rol}
          unidad={sesion.unidadNombre}
          notificacionesSinLeer={count ?? 0}
        />

        <main id="contenido" className="flex-1 overflow-y-auto bg-superficie p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      <VigilanteInactividad />
    </div>
  );
}
