import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirSesion } from "@/lib/sesion";
import { EtiquetaEstado } from "@/components/misiones/etiqueta-estado";
import { ProgresoDocumental } from "@/components/misiones/progreso-documental";
import { ETIQUETA_ESTADO, type EstadoMision } from "@/dominio/estados";
import type { Rol } from "@/dominio/roles";

export const metadata: Metadata = { title: "Tablero" };

/** Estados que se muestran como tarjeta de conteo, en orden de flujo. */
const TARJETAS: { estado: EstadoMision; descripcion: string }[] = [
  { estado: "borrador", descripcion: "En preparación, aún sin enviar" },
  { estado: "enviada", descripcion: "Esperando revisión" },
  { estado: "observada", descripcion: "Devueltas para corregir" },
  { estado: "aprobada", descripcion: "Cerradas este mes" },
];

/** Qué significa "requiere mi atención" para cada rol. */
const ATENCION: Record<Rol, { titulo: string; estados: EstadoMision[]; vacio: string }> = {
  operador: {
    titulo: "Requieren tu atención",
    estados: ["borrador", "observada"],
    vacio: "No tienes misiones pendientes de completar.",
  },
  supervisor: {
    titulo: "Pendientes de tu decisión",
    estados: ["enviada", "en_revision"],
    vacio: "No hay misiones esperando revisión en tu unidad.",
  },
  admin: {
    titulo: "Pendientes en la unidad",
    estados: ["enviada", "en_revision", "observada"],
    vacio: "No hay misiones pendientes de decisión.",
  },
  consulta: {
    titulo: "Últimas misiones aprobadas",
    estados: ["aprobada"],
    vacio: "Todavía no hay misiones aprobadas para consultar.",
  },
};

export default async function PaginaTablero() {
  const sesion = await exigirSesion();
  const supabase = await crearClienteServidor();

  const inicioDeMes = new Date();
  inicioDeMes.setDate(1);
  inicioDeMes.setHours(0, 0, 0, 0);

  // Un conteo por tarjeta. Todos pasan por RLS, así que cada rol ve el número
  // que le corresponde sin ningún filtro adicional en la aplicación.
  const conteos = await Promise.all(
    TARJETAS.map(async ({ estado }) => {
      let consulta = supabase
        .from("misiones")
        .select("id", { count: "exact", head: true })
        .eq("estado", estado);

      if (estado === "aprobada") {
        consulta = consulta.gte("aprobada_en", inicioDeMes.toISOString());
      }

      const { count } = await consulta;
      return count ?? 0;
    }),
  );

  const atencion = ATENCION[sesion.rol];

  const { data: pendientes } = await supabase
    .from("misiones_con_completitud")
    .select("id, numero_mision, tipo_mision, fecha_inicio, estado, archivos_vigentes")
    .in("estado", atencion.estados)
    .order("fecha_inicio", { ascending: false })
    .limit(6);

  const { data: recientes } = await supabase
    .from("misiones")
    .select("id, numero_mision, estado, actualizado_en")
    .order("actualizado_en", { ascending: false })
    .limit(6);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold text-texto">
          Buen día, {sesion.nombreCompleto.split(" ")[0]}
        </h1>
        <p className="text-sm text-texto-suave">
          {sesion.unidadNombre
            ? `${sesion.unidadNombre} · estado del archivo documental.`
            : "Estado del archivo documental."}
        </p>
      </header>

      {/* Conteos por estado */}
      <section aria-labelledby="titulo-conteos" className="space-y-3">
        <h2 id="titulo-conteos" className="text-sm font-medium text-texto-suave">
          Estado de las misiones
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TARJETAS.map((tarjeta, indice) => (
            <Link
              key={tarjeta.estado}
              href={`/misiones?estado=${tarjeta.estado}`}
              className="rounded-lg border border-borde bg-card p-4 transition-colors hover:border-borde-fuerte"
            >
              <p className="text-3xl font-semibold tabular-nums text-texto">
                {conteos[indice]}
              </p>
              <p className="mt-1 text-sm font-medium text-texto">
                {ETIQUETA_ESTADO[tarjeta.estado]}
                {tarjeta.estado === "aprobada" ? " este mes" : ""}
              </p>
              <p className="mt-0.5 text-xs text-texto-suave">{tarjeta.descripcion}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cola de trabajo propia del rol */}
        <section
          aria-labelledby="titulo-atencion"
          className="lg:col-span-2 rounded-lg border border-borde bg-card"
        >
          <div className="flex items-center justify-between border-b border-borde px-4 py-3">
            <h2 id="titulo-atencion" className="text-sm font-medium text-texto">
              {atencion.titulo}
            </h2>
            <Link
              href="/misiones"
              className="flex items-center gap-1 text-xs font-medium text-marina-900 hover:underline"
            >
              Ver todas
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>

          {pendientes && pendientes.length > 0 ? (
            <ul className="divide-y divide-borde">
              {pendientes.map((mision) => (
                <li key={mision.id}>
                  <Link
                    href={`/misiones/${mision.id}`}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-superficie"
                  >
                    <span className="font-mono text-sm font-medium text-texto">
                      {mision.numero_mision}
                    </span>
                    <span className="text-sm text-texto-suave">{mision.tipo_mision}</span>
                    <EtiquetaEstado estado={mision.estado} className="ml-auto" />
                    <ProgresoDocumental cargados={mision.archivos_vigentes} compacto />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-texto-suave">{atencion.vacio}</p>
          )}
        </section>

        {/* Actividad reciente */}
        <section aria-labelledby="titulo-actividad" className="rounded-lg border border-borde bg-card">
          <div className="border-b border-borde px-4 py-3">
            <h2 id="titulo-actividad" className="text-sm font-medium text-texto">
              Actividad reciente
            </h2>
          </div>

          {recientes && recientes.length > 0 ? (
            <ul className="divide-y divide-borde">
              {recientes.map((mision) => (
                <li key={mision.id} className="px-4 py-3">
                  <Link href={`/misiones/${mision.id}`} className="block hover:underline">
                    <span className="font-mono text-sm text-texto">{mision.numero_mision}</span>
                  </Link>
                  <p className="mt-1 flex items-center gap-2 text-xs text-texto-suave">
                    <EtiquetaEstado estado={mision.estado} />
                    <time dateTime={mision.actualizado_en}>
                      {new Date(mision.actualizado_en).toLocaleDateString("es-CO", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-texto-suave">
              Aún no hay movimientos registrados.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
