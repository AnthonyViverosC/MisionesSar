import type { Metadata } from "next";
import Link from "next/link";
import { Archive, Download, FileDown } from "lucide-react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirSesion } from "@/lib/sesion";
import { Button } from "@/components/ui/button";
import { EtiquetaEstado } from "@/components/misiones/etiqueta-estado";
import type { EstadoMision } from "@/dominio/estados";
import { esquemaFiltrosArchivo, TAMANO_PAGINA_ARCHIVO } from "@/dominio/esquemas-archivo";
import { FiltrosArchivo } from "./filtros-archivo";

export const metadata: Metadata = { title: "Archivo" };

/**
 * Archivo histórico.
 *
 * Solo misiones cerradas: aprobadas y anuladas. Es la vista de consulta del
 * expediente, la que usa quien necesita encontrar una misión de hace tres años
 * y llevarse sus soportes. Nada de lo que se ve aquí se puede editar.
 *
 * Qué misiones aparecen lo decide RLS, no esta página: el rol de consulta ve
 * solo aprobadas, el operador las suyas, el supervisor las de su unidad.
 */
export default async function PaginaArchivo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirSesion();
  const parametros = await searchParams;
  const filtros = esquemaFiltrosArchivo.parse(parametros);
  const supabase = await crearClienteServidor();

  // Solo misiones cerradas: si el filtro no acota, entran las dos formas de cierre.
  const estados: EstadoMision[] = filtros.estado ? [filtros.estado] : ["aprobada", "anulada"];
  const desde = (filtros.pagina - 1) * TAMANO_PAGINA_ARCHIVO;

  let consulta = supabase
    .from("misiones_con_completitud")
    .select(
      "id, numero_mision, anio, fecha_inicio, tipo_mision, aeronave_matricula, zona_operacion, estado, aprobada_en, archivos_vigentes",
      { count: "exact" },
    )
    .in("estado", estados);

  if (filtros.q) {
    consulta = consulta.or(
      `numero_mision.ilike.%${filtros.q}%,zona_operacion.ilike.%${filtros.q}%,comandante_aeronave.ilike.%${filtros.q}%`,
    );
  }
  if (filtros.anio) consulta = consulta.eq("anio", filtros.anio);
  if (filtros.unidad) consulta = consulta.eq("unidad_id", filtros.unidad);
  if (filtros.tipo) consulta = consulta.eq("tipo_mision_id", filtros.tipo);

  const [{ data: misiones, count }, { data: unidades }, { data: tipos }, { data: anios }] =
    await Promise.all([
      consulta.order("fecha_inicio", { ascending: false }).range(desde, desde + TAMANO_PAGINA_ARCHIVO - 1),
      supabase.from("unidades").select("id, nombre").order("nombre"),
      supabase.from("tipos_mision").select("id, nombre").order("orden"),
      // Años con misiones cerradas, para el desplegable. Se traen solo los años,
      // que son pocos aunque el archivo crezca.
      supabase
        .from("misiones")
        .select("anio")
        .in("estado", ["aprobada", "anulada"])
        .order("anio", { ascending: false }),
    ]);

  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_ARCHIVO));
  const aniosUnicos = [...new Set((anios ?? []).map((fila) => fila.anio))];

  const conParametros = (cambios: Record<string, string | number>) => {
    const nuevos = new URLSearchParams();
    Object.entries(parametros).forEach(([clave, valor]) => {
      if (typeof valor === "string") nuevos.set(clave, valor);
    });
    Object.entries(cambios).forEach(([clave, valor]) => nuevos.set(clave, String(valor)));
    return nuevos.toString();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold text-texto">Archivo</h1>
          <p className="text-sm text-texto-suave">
            Misiones cerradas. El expediente conserva todas las versiones de cada soporte.
          </p>
        </div>

        <Button variant="outline" asChild>
          <a href={`/api/archivo/csv?${conParametros({})}`}>
            <FileDown className="size-4" aria-hidden />
            Exportar la búsqueda
          </a>
        </Button>
      </header>

      <section className="rounded-lg border border-borde bg-card">
        <FiltrosArchivo unidades={unidades ?? []} tipos={tipos ?? []} anios={aniosUnicos} />

        <div className="flex items-center justify-end px-4 py-2">
          <p className="text-xs text-texto-suave" aria-live="polite">
            {total === 0
              ? "Sin resultados"
              : `${total.toLocaleString("es-CO")} misión${total === 1 ? "" : "es"} en el archivo`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Misiones cerradas, página {filtros.pagina} de {totalPaginas}
            </caption>
            <thead>
              <tr className="border-y border-borde bg-superficie text-left">
                <th scope="col" className="w-32 px-4 py-2.5 text-xs font-medium text-texto-suave">
                  N.º de misión
                </th>
                <th scope="col" className="w-28 px-4 py-2.5 text-xs font-medium text-texto-suave">
                  Fecha
                </th>
                <th scope="col" className="w-40 px-4 py-2.5 text-xs font-medium text-texto-suave">
                  Tipo
                </th>
                <th scope="col" className="px-4 py-2.5 text-xs font-medium text-texto-suave">
                  Zona de operación
                </th>
                <th scope="col" className="w-28 px-4 py-2.5 text-xs font-medium text-texto-suave">
                  Aeronave
                </th>
                <th scope="col" className="w-32 px-4 py-2.5 text-xs font-medium text-texto-suave">
                  Estado
                </th>
                <th
                  scope="col"
                  className="w-28 px-4 py-2.5 text-right text-xs font-medium text-texto-suave"
                >
                  Expediente
                </th>
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
                  <td className="max-w-xs truncate px-4 py-3 text-texto-suave">
                    {mision.zona_operacion}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-texto-suave">
                    {mision.aeronave_matricula}
                  </td>
                  <td className="px-4 py-3">
                    <EtiquetaEstado estado={mision.estado} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {mision.archivos_vigentes > 0 ? (
                      <a
                        href={`/api/misiones/${mision.id}/zip`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-marina-900 hover:underline"
                      >
                        <Download className="size-3.5" aria-hidden />
                        ZIP
                      </a>
                    ) : (
                      <span className="text-xs text-texto-suave">sin soportes</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total === 0 ? (
          <div className="px-4 py-16 text-center">
            <Archive className="mx-auto size-8 text-texto-suave" aria-hidden />
            <p className="mt-3 text-sm font-medium text-texto">El archivo no tiene resultados.</p>
            <p className="mt-1 text-sm text-texto-suave">
              Aquí entran las misiones cuando se aprueban o se anulan.
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-borde px-4 py-3">
          <p className="text-xs text-texto-suave">
            Página {filtros.pagina} de {totalPaginas}
          </p>

          <nav className="flex gap-1" aria-label="Paginación del archivo">
            <Button
              variant="outline"
              size="sm"
              asChild={filtros.pagina > 1}
              disabled={filtros.pagina <= 1}
            >
              {filtros.pagina > 1 ? (
                <Link href={`/archivo?${conParametros({ pagina: filtros.pagina - 1 })}`}>
                  Anterior
                </Link>
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
                <Link href={`/archivo?${conParametros({ pagina: filtros.pagina + 1 })}`}>
                  Siguiente
                </Link>
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
