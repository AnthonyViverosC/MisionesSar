import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ShieldCheck } from "lucide-react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirSesion } from "@/lib/sesion";
import { urlDeDescarga } from "@/acciones/documentos";
import { Button } from "@/components/ui/button";
import { REGLAS_DOCUMENTO, formatearTamano } from "@/dominio/soportes";

export const metadata: Metadata = { title: "Documento" };

/**
 * Visor de un soporte.
 *
 * El archivo se muestra embebido con una URL firmada de cinco minutos que se
 * genera en el servidor tras comprobar el permiso. El bucket es privado: sin
 * esa firma no hay forma de llegar al archivo.
 */
export default async function PaginaDocumento({
  params,
}: {
  params: Promise<{ id: string; documentoId: string }>;
}) {
  const { id, documentoId } = await params;
  await exigirSesion();
  const supabase = await crearClienteServidor();

  const { data: documento } = await supabase
    .from("documentos")
    .select("*")
    .eq("id", documentoId)
    .eq("mision_id", id)
    .maybeSingle();

  if (!documento) notFound();

  const [{ data: mision }, { data: versiones }, firma] = await Promise.all([
    supabase.from("misiones").select("numero_mision").eq("id", id).maybeSingle(),
    supabase
      .from("documentos")
      .select("id, nombre_original, version, vigente, creado_en, tamano_bytes")
      .eq("mision_id", id)
      .eq("tipo", documento.tipo)
      .order("version", { ascending: false }),
    urlDeDescarga(documentoId),
  ]);

  const regla = REGLAS_DOCUMENTO[documento.tipo];
  const esPdf = documento.mime_type === "application/pdf";
  const esImagen = documento.mime_type.startsWith("image/");
  const esVideo = documento.mime_type.startsWith("video/");

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <Link
          href={`/misiones/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-texto-suave hover:text-texto"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver a la misión {mision?.numero_mision ?? ""}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="font-serif text-2xl font-semibold text-texto">{regla.etiqueta}</h1>
          <p className="truncate text-sm text-texto-suave">
            {documento.nombre_original} · {formatearTamano(documento.tamano_bytes)} · versión{" "}
            {documento.version}
            {documento.vigente ? "" : " (no vigente)"}
          </p>
        </div>

        {firma.ok ? (
          <Button asChild variant="outline">
            <a href={firma.url} download={documento.nombre_original}>
              <Download className="size-4" aria-hidden />
              Descargar
            </a>
          </Button>
        ) : null}
      </header>

      <section className="overflow-hidden rounded-lg border border-borde bg-card">
        {!firma.ok ? (
          <p className="px-4 py-16 text-center text-sm text-texto-suave">{firma.error}</p>
        ) : esPdf ? (
          <iframe
            src={firma.url}
            title={`Vista previa de ${documento.nombre_original}`}
            className="h-[70vh] w-full border-0"
          />
        ) : esImagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={firma.url}
            alt={`Fotografía ${documento.nombre_original} de la misión`}
            className="mx-auto max-h-[70vh] w-auto"
          />
        ) : esVideo ? (
          <video
            src={firma.url}
            controls
            preload="metadata"
            className="max-h-[70vh] w-full bg-black"
          >
            Tu navegador no puede reproducir este video. Descárgalo para verlo.
          </video>
        ) : (
          <p className="px-4 py-16 text-center text-sm text-texto-suave">
            Este formato no tiene vista previa. Descárgalo para consultarlo.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-borde bg-card">
        <h2 className="border-b border-borde px-4 py-3 text-sm font-medium text-texto">
          Versiones de este soporte
        </h2>
        <ul className="divide-y divide-borde">
          {(versiones ?? []).map((version) => (
            <li key={version.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="font-mono text-xs text-texto-suave">v{version.version}</span>
              <Link
                href={`/misiones/${id}/documentos/${version.id}`}
                className="min-w-0 flex-1 truncate text-sm text-texto hover:underline"
              >
                {version.nombre_original}
              </Link>
              <span className="text-xs text-texto-suave">
                {formatearTamano(version.tamano_bytes)}
              </span>
              <time dateTime={version.creado_en} className="text-xs text-texto-suave">
                {new Date(version.creado_en).toLocaleDateString("es-CO")}
              </time>
              <span
                className={
                  version.vigente
                    ? "rounded-full bg-estado-verde-fondo px-2 py-0.5 text-xs text-estado-verde"
                    : "rounded-full bg-estado-gris-fondo px-2 py-0.5 text-xs text-texto-suave"
                }
              >
                {version.vigente ? "Vigente" : "Reemplazada"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="flex items-start gap-2 text-xs text-texto-suave">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Huella SHA-256:{" "}
          <code className="break-all font-mono">{documento.hash_sha256}</code>. Permite verificar
          que el archivo descargado es idéntico al que se cargó. El enlace de descarga vence a los
          cinco minutos y cada descarga queda registrada en la auditoría.
        </span>
      </p>
    </div>
  );
}
