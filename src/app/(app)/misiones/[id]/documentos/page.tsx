import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  Calendar,
  Check,
  Download,
  FileText,
  Hash,
  Image as IconoImagen,
  Video,
} from "lucide-react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirSesion } from "@/lib/sesion";
import { EtiquetaEstado } from "@/components/misiones/etiqueta-estado";
import { PieCarga } from "@/components/documentos/pie-carga";
import { ZonaCarga } from "@/components/documentos/zona-carga";
import { Button } from "@/components/ui/button";
import { admiteEdicion } from "@/dominio/estados";
import {
  BLOQUES_CARGA,
  REGLAS_DOCUMENTO,
  TOTAL_ARCHIVOS,
  formatearTamano,
  type TipoDocumento,
} from "@/dominio/soportes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Carga de documentos" };

/** Icono según el soporte, como los de la referencia. */
const ICONOS: Record<TipoDocumento, React.ComponentType<{ className?: string }>> = {
  orden_vuelo: FileText,
  orden_fragmentaria: FileText,
  requerimiento_mision: FileText,
  formulario_mision_cumplida: FileText,
  certificado_consumo: FileText,
  foto: IconoImagen,
  video: Video,
};

export default async function PaginaCargaDocumentos({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sesion = await exigirSesion();
  const supabase = await crearClienteServidor();

  const { data: mision } = await supabase
    .from("misiones")
    .select("id, numero_mision, fecha_inicio, estado, creada_por, unidad_id, unidades(nombre)")
    .eq("id", id)
    .maybeSingle();

  if (!mision) notFound();

  const { data: documentos } = await supabase
    .from("documentos")
    .select("id, tipo, nombre_original, tamano_bytes, version, creado_en")
    .eq("mision_id", id)
    .eq("vigente", true)
    .order("creado_en");

  const cargados = documentos?.length ?? 0;
  const esCreador = mision.creada_por === sesion.usuarioId;

  const puedeCargar =
    sesion.rol === "admin"
      ? mision.estado !== "aprobada" && mision.estado !== "anulada"
      : sesion.rol === "operador" && esCreador && admiteEdicion(mision.estado);

  const unidad = mision.unidades as { nombre: string } | null;
  const porcentaje = Math.round((cargados / TOTAL_ARCHIVOS) * 100);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-serif text-3xl font-semibold text-texto">Carga de documentos</h1>
          <EtiquetaEstado estado={mision.estado} />
        </div>

        <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-texto-suave">
          <div className="flex items-center gap-1.5">
            <Hash className="size-3.5" aria-hidden />
            <dt className="sr-only">Número de misión</dt>
            <dd className="font-mono text-texto">{mision.numero_mision}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5" aria-hidden />
            <dt className="sr-only">Fecha</dt>
            <dd>
              {new Date(`${mision.fecha_inicio}T00:00:00`).toLocaleDateString("es-CO")}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Building2 className="size-3.5" aria-hidden />
            <dt className="sr-only">Unidad</dt>
            <dd>{unidad?.nombre ?? "—"}</dd>
          </div>
        </dl>
      </header>

      {/* Progreso global de carga */}
      <section className="mt-5 rounded-md border border-borde bg-card px-4 py-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide text-texto-suave">
            Progreso de carga
          </h2>
          <p className="text-xs text-texto-suave tabular-nums">
            {cargados} de {TOTAL_ARCHIVOS} archivos cargados
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuenow={cargados}
          aria-valuemin={0}
          aria-valuemax={TOTAL_ARCHIVOS}
          aria-label={`${cargados} de ${TOTAL_ARCHIVOS} archivos cargados`}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-estado-gris-fondo"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              cargados >= TOTAL_ARCHIVOS ? "bg-estado-verde" : "bg-marina-900",
            )}
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      </section>

      {!puedeCargar ? (
        <p className="mt-4 rounded-md border border-borde bg-estado-azul-fondo px-3 py-2.5 text-sm text-estado-azul">
          {mision.estado === "aprobada"
            ? "La misión está aprobada: sus soportes quedaron cerrados y no se reemplazan."
            : mision.estado === "anulada"
              ? "La misión está anulada. Sus soportes se conservan como quedaron."
              : "La misión está en revisión. Podrás cargar de nuevo si el supervisor la devuelve."}
        </p>
      ) : null}

      {/* Los seis bloques de soportes */}
      <ol className="mt-5 space-y-4">
        {BLOQUES_CARGA.map((bloque) => {
          const tipos = bloque.tipos as readonly TipoDocumento[];
          const delBloque = (documentos ?? []).filter((documento) =>
            tipos.includes(documento.tipo),
          );
          const requeridos = tipos.reduce(
            (suma, tipo) => suma + REGLAS_DOCUMENTO[tipo].cantidad,
            0,
          );
          const completo = delBloque.length >= requeridos;
          const Icono = ICONOS[tipos[0]];

          return (
            <li key={bloque.numero} className="rounded-lg border border-borde bg-card p-5">
              <div className="flex flex-wrap items-start gap-3">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    completo ? "bg-estado-verde text-white" : "bg-marina-900 text-white",
                  )}
                  aria-hidden
                >
                  {completo ? <Check className="size-4" /> : bloque.numero}
                </span>

                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-texto">
                    <Icono className="size-4 text-texto-suave" aria-hidden />
                    {bloque.titulo}
                  </h2>
                  <p className="text-xs text-texto-suave">
                    Formato requerido:{" "}
                    {tipos.map((tipo) => REGLAS_DOCUMENTO[tipo].formatoLegible).join(" + ")}
                    {requeridos > 1 ? ` · ${requeridos} archivos` : ""}
                  </p>
                </div>

                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    completo
                      ? "bg-estado-verde-fondo text-estado-verde"
                      : "bg-estado-ambar-fondo text-estado-ambar",
                  )}
                >
                  {completo ? "Completo" : `Pendiente ${delBloque.length}/${requeridos}`}
                </span>
              </div>

              {/* Archivos ya cargados */}
              {delBloque.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {delBloque.map((documento) => (
                    <li
                      key={documento.id}
                      className="flex flex-wrap items-center gap-3 rounded-md border border-borde bg-superficie px-3 py-2"
                    >
                      <Check className="size-4 shrink-0 text-estado-verde" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm text-texto">
                        {documento.nombre_original}
                      </span>
                      <span className="text-xs text-texto-suave">
                        {formatearTamano(documento.tamano_bytes)}
                        {documento.version > 1 ? ` · versión ${documento.version}` : ""}
                      </span>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/misiones/${id}/documentos/${documento.id}`}>
                          <Download className="size-3.5" aria-hidden />
                          Ver
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {/* Zonas de carga pendientes */}
              {puedeCargar ? (
                <div className="mt-4 space-y-4">
                  {tipos.map((tipo) => {
                    const regla = REGLAS_DOCUMENTO[tipo];
                    const delTipo = delBloque.filter((documento) => documento.tipo === tipo);
                    const faltantes = regla.cantidad - delTipo.length;

                    return (
                      <div key={tipo} className="space-y-3">
                        {faltantes > 0 ? (
                          <>
                            {tipos.length > 1 ? (
                              <p className="text-xs font-medium text-texto">
                                {regla.etiqueta}
                                {faltantes > 1 ? ` · faltan ${faltantes}` : ""}
                              </p>
                            ) : null}
                            <ZonaCarga misionId={id} tipo={tipo} />
                          </>
                        ) : (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-texto-suave hover:text-texto">
                              Reemplazar {regla.etiqueta.toLowerCase()}
                            </summary>
                            <div className="mt-3 space-y-3">
                              {delTipo.map((documento) => (
                                <div key={documento.id} className="space-y-1.5">
                                  <p className="text-xs text-texto-suave">
                                    Sustituir “{documento.nombre_original}”. La versión actual se
                                    conserva como no vigente.
                                  </p>
                                  <ZonaCarga
                                    misionId={id}
                                    tipo={tipo}
                                    reemplazaA={documento.id}
                                    etiquetaReemplazo={documento.nombre_original}
                                  />
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <PieCarga
        misionId={id}
        numeroMision={mision.numero_mision}
        cargados={cargados}
        puedeEnviar={puedeCargar && esCreador && sesion.rol === "operador"}
      />
    </div>
  );
}
