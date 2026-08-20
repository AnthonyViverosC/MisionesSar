import type { Metadata } from "next";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirRol } from "@/lib/sesion";
import { Button } from "@/components/ui/button";
import {
  COLOR_ACCION_AUDITORIA,
  ETIQUETA_ACCION_AUDITORIA,
  ETIQUETA_ENTIDAD,
} from "@/dominio/auditoria";
import {
  esquemaFiltrosAuditoria,
  TAMANO_PAGINA_AUDITORIA,
} from "@/dominio/esquemas-admin";
import type { AccionAuditoria, Json } from "@/tipos/basedatos";
import { FiltrosAuditoria } from "./filtros-auditoria";

export const metadata: Metadata = { title: "Auditoría" };

/**
 * Campos que no aportan nada al leer un cambio: o son ruido de la fila (marcas
 * de tiempo que cambian siempre) o repiten lo que ya muestra la columna.
 */
const CAMPOS_IGNORADOS = new Set(["actualizado_en", "creado_en", "id"]);

/** Diferencia legible entre el antes y el después de una fila. */
function diferencias(antes: Json | null, despues: Json | null): [string, string, string][] {
  if (!despues || typeof despues !== "object" || Array.isArray(despues)) return [];

  const previo = antes && typeof antes === "object" && !Array.isArray(antes) ? antes : {};
  const cambios: [string, string, string][] = [];

  for (const [campo, valor] of Object.entries(despues)) {
    if (CAMPOS_IGNORADOS.has(campo)) continue;

    const anterior = (previo as Record<string, Json>)[campo];
    const textoAnterior = anterior === undefined || anterior === null ? "—" : String(anterior);
    const textoNuevo = valor === null ? "—" : String(valor);

    if (textoAnterior !== textoNuevo) {
      cambios.push([campo, textoAnterior, textoNuevo]);
    }
  }

  return cambios;
}

export default async function PaginaAuditoria({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Layout y página se renderizan en paralelo: el rol se comprueba también aquí.
  await exigirRol("admin");

  const parametros = await searchParams;
  const filtros = esquemaFiltrosAuditoria.parse(parametros);
  const supabase = await crearClienteServidor();

  const desde = (filtros.pagina - 1) * TAMANO_PAGINA_AUDITORIA;

  let consulta = supabase
    .from("auditoria")
    .select("id, accion, entidad, entidad_id, actor_email, ip, datos_antes, datos_despues, creado_en", {
      count: "exact",
    });

  if (filtros.accion) consulta = consulta.eq("accion", filtros.accion as AccionAuditoria);
  if (filtros.entidad) consulta = consulta.eq("entidad", filtros.entidad);
  if (filtros.actor) consulta = consulta.ilike("actor_email", `%${filtros.actor}%`);
  if (filtros.desde) consulta = consulta.gte("creado_en", `${filtros.desde}T00:00:00Z`);
  if (filtros.hasta) consulta = consulta.lte("creado_en", `${filtros.hasta}T23:59:59Z`);

  const { data: eventos, count } = await consulta
    .order("creado_en", { ascending: false })
    .range(desde, desde + TAMANO_PAGINA_AUDITORIA - 1);

  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_AUDITORIA));

  const conPagina = (pagina: number) => {
    const nuevos = new URLSearchParams();
    Object.entries(parametros).forEach(([clave, valor]) => {
      if (typeof valor === "string") nuevos.set(clave, valor);
    });
    nuevos.set("pagina", String(pagina));
    return `/admin/auditoria?${nuevos.toString()}`;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-texto-suave">
        Registro inmutable. Lo escriben los triggers de la base: no hay forma de alterarlo ni
        de borrarlo desde la aplicación.
      </p>

      <section className="rounded-lg border border-borde bg-card">
        <FiltrosAuditoria />

        <div className="flex items-center justify-end px-4 py-2">
          <p className="text-xs text-texto-suave" aria-live="polite">
            {total === 0
              ? "Sin registros"
              : `${total.toLocaleString("es-CO")} registro${total === 1 ? "" : "s"}`}
          </p>
        </div>

        <ul className="divide-y divide-borde border-y border-borde">
          {(eventos ?? []).map((evento) => {
            const accion = evento.accion as AccionAuditoria;
            const cambios = diferencias(evento.datos_antes, evento.datos_despues);

            return (
              <li key={evento.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    aria-hidden
                    className={`size-2 shrink-0 rounded-full ${COLOR_ACCION_AUDITORIA[accion]}`}
                  />
                  <span className="text-sm font-medium text-texto">
                    {ETIQUETA_ACCION_AUDITORIA[accion]}
                  </span>
                  <span className="text-xs text-texto-suave">
                    {ETIQUETA_ENTIDAD[evento.entidad] ?? evento.entidad}
                  </span>

                  {evento.entidad === "misiones" && evento.entidad_id ? (
                    <Link
                      href={`/misiones/${evento.entidad_id}`}
                      className="font-mono text-xs text-marina-900 hover:underline"
                    >
                      ver misión
                    </Link>
                  ) : null}

                  <span className="ml-auto text-xs text-texto-suave">
                    {evento.actor_email ?? "sistema"}
                  </span>
                  {evento.ip ? (
                    <span className="font-mono text-xs text-texto-suave">{evento.ip}</span>
                  ) : null}
                  <time
                    dateTime={evento.creado_en}
                    className="w-40 text-right text-xs tabular-nums text-texto-suave"
                  >
                    {new Date(evento.creado_en).toLocaleString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>

                {cambios.length > 0 ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-texto-suave hover:text-texto">
                      {cambios.length} campo{cambios.length === 1 ? "" : "s"} con cambio
                    </summary>
                    <dl className="mt-2 space-y-1 rounded-md bg-superficie px-3 py-2">
                      {cambios.map(([campo, anterior, nuevo]) => (
                        <div key={campo} className="flex flex-wrap gap-2 text-xs">
                          <dt className="font-mono text-texto-suave">{campo}</dt>
                          <dd className="text-texto">
                            <span className="text-texto-suave line-through">{anterior}</span>
                            {" → "}
                            <span className="font-medium">{nuevo}</span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>

        {total === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium text-texto">No hay registros que coincidan.</p>
            <p className="mt-1 text-sm text-texto-suave">Amplía el rango de fechas o quita filtros.</p>
          </div>
        ) : null}

        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-xs text-texto-suave">
            Página {filtros.pagina} de {totalPaginas}
          </p>

          <nav className="flex gap-1" aria-label="Paginación de la bitácora">
            <Button
              variant="outline"
              size="sm"
              asChild={filtros.pagina > 1}
              disabled={filtros.pagina <= 1}
            >
              {filtros.pagina > 1 ? (
                <Link href={conPagina(filtros.pagina - 1)}>Anterior</Link>
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
                <Link href={conPagina(filtros.pagina + 1)}>Siguiente</Link>
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
