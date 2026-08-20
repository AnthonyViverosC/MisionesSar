import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, Plus } from "lucide-react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirSesion } from "@/lib/sesion";
import { EtiquetaEstado } from "@/components/misiones/etiqueta-estado";
import { ProgresoDocumental } from "@/components/misiones/progreso-documental";
import { Button } from "@/components/ui/button";
import { esquemaFiltros, TAMANO_PAGINA } from "@/dominio/esquemas-mision";
import type { EstadoMision } from "@/dominio/estados";
import { FiltrosMisiones } from "./filtros-misiones";

export const metadata: Metadata = { title: "Misiones" };

type Columna = {
  clave: "numero_mision" | "fecha_inicio" | "estado" | "actualizado_en" | null;
  etiqueta: string;
  className?: string;
};

const COLUMNAS: Columna[] = [
  { clave: "numero_mision", etiqueta: "N.º de misión", className: "w-32" },
  { clave: "fecha_inicio", etiqueta: "Fecha", className: "w-32" },
  { clave: null, etiqueta: "Tipo", className: "w-40" },
  { clave: "estado", etiqueta: "Estado", className: "w-36" },
  { clave: null, etiqueta: "Progreso documental" },
  { clave: null, etiqueta: "Acción", className: "w-16 text-right" },
];

export default async function PaginaMisiones({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesion = await exigirSesion();
  const parametros = await searchParams;
  const filtros = esquemaFiltros.parse(parametros);
  const supabase = await crearClienteServidor();

  // Catálogos para los desplegables de filtro.
  const [{ data: unidades }, { data: aeronaves }, { data: tipos }] = await Promise.all([
    supabase.from("unidades").select("id, nombre").eq("activa", true).order("nombre"),
    supabase.from("aeronaves").select("id, matricula").eq("activa", true).order("matricula"),
    supabase.from("tipos_mision").select("id, nombre").eq("activo", true).order("orden"),
  ]);

  // Paginación y ordenamiento del lado del servidor: el navegador nunca recibe
  // más de una página de resultados.
  const orden = filtros.orden ?? "fecha_inicio";
  const ascendente = filtros.dir === "asc";
  const desde = (filtros.pagina - 1) * TAMANO_PAGINA;

  let consulta = supabase
    .from("misiones_con_completitud")
    .select(
      "id, numero_mision, fecha_inicio, tipo_mision, aeronave_matricula, estado, archivos_vigentes",
      { count: "exact" },
    );

  if (filtros.q) consulta = consulta.ilike("numero_mision", `%${filtros.q}%`);
  if (filtros.estado) consulta = consulta.eq("estado", filtros.estado as EstadoMision);
  if (filtros.unidad) consulta = consulta.eq("unidad_id", filtros.unidad);
  if (filtros.aeronave) consulta = consulta.eq("aeronave_id", filtros.aeronave);
  if (filtros.tipo) consulta = consulta.eq("tipo_mision_id", filtros.tipo);
  if (filtros.desde) consulta = consulta.gte("fecha_inicio", filtros.desde);
  if (filtros.hasta) consulta = consulta.lte("fecha_inicio", filtros.hasta);

  const { data: misiones, count } = await consulta
    .order(orden, { ascending: ascendente })
    .range(desde, desde + TAMANO_PAGINA - 1);

  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));
  const puedeCrear = sesion.rol === "operador" || sesion.rol === "admin";

  /** Conserva los filtros al cambiar de orden o de página. */
  const conParametros = (cambios: Record<string, string | number>) => {
    const nuevos = new URLSearchParams();
    Object.entries(parametros).forEach(([clave, valor]) => {
      if (typeof valor === "string") nuevos.set(clave, valor);
    });
    Object.entries(cambios).forEach(([clave, valor]) => nuevos.set(clave, String(valor)));
    return `/misiones?${nuevos.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold text-texto">
            {sesion.rol === "operador" ? "Mis misiones" : "Misiones"}
          </h1>
          <p className="text-sm text-texto-suave">
            Gestión y seguimiento de misiones activas y archivadas.
          </p>
        </div>

        {puedeCrear ? (
          <Button asChild>
            <Link href="/misiones/nueva">
              <Plus className="size-4" aria-hidden />
              Nueva misión
            </Link>
          </Button>
        ) : null}
      </header>

      <section className="rounded-lg border border-borde bg-card">
        <FiltrosMisiones
          unidades={unidades ?? []}
          aeronaves={(aeronaves ?? []).map((a) => ({ id: a.id, nombre: a.matricula }))}
          tipos={tipos ?? []}
          mostrarUnidad={sesion.rol === "admin"}
        />

        <div className="flex items-center justify-end px-4 py-2">
          <p className="text-xs text-texto-suave" aria-live="polite">
            {total === 0
              ? "Sin resultados"
              : `Mostrando ${Math.min(total - desde, TAMANO_PAGINA)} de ${total} resultado${total === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Misiones filtradas, página {filtros.pagina} de {totalPaginas}
            </caption>
            <thead>
              <tr className="border-y border-borde bg-superficie text-left">
                {COLUMNAS.map((columna) => {
                  const activa = orden === columna.clave;
                  return (
                    <th
                      key={columna.etiqueta}
                      scope="col"
                      className={`px-4 py-2.5 text-xs font-medium text-texto-suave ${columna.className ?? ""}`}
                      aria-sort={
                        activa ? (ascendente ? "ascending" : "descending") : undefined
                      }
                    >
                      {columna.clave ? (
                        <Link
                          href={conParametros({
                            orden: columna.clave,
                            dir: activa && !ascendente ? "asc" : "desc",
                            pagina: 1,
                          })}
                          className="inline-flex items-center gap-1 hover:text-texto"
                        >
                          {columna.etiqueta}
                          {activa ? (
                            ascendente ? (
                              <ArrowUp className="size-3" aria-hidden />
                            ) : (
                              <ArrowDown className="size-3" aria-hidden />
                            )
                          ) : null}
                        </Link>
                      ) : (
                        columna.etiqueta
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-borde">
              {(misiones ?? []).map((mision) => (
                <tr key={mision.id} className="hover:bg-superficie">
                  <td className="px-4 py-3">
                    <Link
                      href={`/misiones/${mision.id}`}
                      className="font-mono font-medium text-texto hover:underline"
                    >
                      {mision.numero_mision}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-texto-suave">
                    {new Date(`${mision.fecha_inicio}T00:00:00`).toLocaleDateString("es-CO")}
                  </td>
                  <td className="px-4 py-3 text-texto">{mision.tipo_mision}</td>
                  <td className="px-4 py-3">
                    <EtiquetaEstado estado={mision.estado} />
                  </td>
                  <td className="px-4 py-3">
                    <ProgresoDocumental cargados={mision.archivos_vigentes} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/misiones/${mision.id}`}
                      className="inline-flex size-8 items-center justify-center rounded-md text-texto-suave hover:bg-superficie hover:text-texto"
                      aria-label={`Abrir la misión ${mision.numero_mision}`}
                    >
                      <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium text-texto">No hay misiones que coincidan.</p>
            <p className="mt-1 text-sm text-texto-suave">
              {puedeCrear
                ? "Ajusta los filtros o crea una misión nueva para empezar a cargar sus soportes."
                : "Ajusta los filtros para ampliar la búsqueda."}
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-borde px-4 py-3">
          <p className="text-xs text-texto-suave">
            Página {filtros.pagina} de {totalPaginas}
          </p>

          <nav className="flex gap-1" aria-label="Paginación">
            <Button
              variant="outline"
              size="sm"
              asChild={filtros.pagina > 1}
              disabled={filtros.pagina <= 1}
            >
              {filtros.pagina > 1 ? (
                <Link href={conParametros({ pagina: filtros.pagina - 1 })}>Anterior</Link>
              ) : (
                <span>Anterior</span>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              asChild={filtros.pagina < totalPaginas}
              disabled={filtros.pagina >= totalPaginas}
            >
              {filtros.pagina < totalPaginas ? (
                <Link href={conParametros({ pagina: filtros.pagina + 1 })}>Siguiente</Link>
              ) : (
                <span>Siguiente</span>
              )}
            </Button>
          </nav>
        </div>
      </section>
    </div>
  );
}
