import Link from "next/link";
import { Check, CircleDashed, RefreshCw } from "lucide-react";
import {
  BLOQUES_CARGA,
  REGLAS_DOCUMENTO,
  formatearTamano,
  type TipoDocumento,
} from "@/dominio/soportes";
import { cn } from "@/lib/utils";

export type DocumentoResumen = {
  id: string;
  tipo: TipoDocumento;
  nombre_original: string;
  tamano_bytes: number;
  version: number;
  creado_en: string;
};

/**
 * Checklist de los seis soportes.
 *
 * Muestra los bloques numerados de la referencia y, dentro de cada uno, qué
 * archivos están cargados, cuáles faltan y cuáles son reemplazos de una versión
 * anterior.
 */
export function ChecklistSoportes({
  documentos,
  misionId,
  puedeCargar,
}: {
  documentos: DocumentoResumen[];
  misionId: string;
  puedeCargar: boolean;
}) {
  return (
    <ol className="divide-y divide-borde">
      {BLOQUES_CARGA.map((bloque) => {
        const delBloque = documentos.filter((documento) =>
          (bloque.tipos as readonly TipoDocumento[]).includes(documento.tipo),
        );
        const requeridos = bloque.tipos.reduce(
          (suma, tipo) => suma + REGLAS_DOCUMENTO[tipo].cantidad,
          0,
        );
        const completo = delBloque.length >= requeridos;

        return (
          <li key={bloque.numero} className="flex gap-3 px-4 py-3">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                completo ? "bg-estado-verde text-white" : "bg-estado-gris-fondo text-texto-suave",
              )}
              aria-hidden
            >
              {completo ? <Check className="size-3.5" /> : bloque.numero}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="font-medium text-texto">{bloque.titulo}</p>
                <p className="text-xs text-texto-suave">
                  {bloque.tipos.map((tipo) => REGLAS_DOCUMENTO[tipo].formatoLegible).join(" · ")}
                  {requeridos > 1 ? ` · ${requeridos} archivos` : ""}
                </p>
                <span
                  className={cn(
                    "ml-auto text-xs font-medium",
                    completo ? "text-estado-verde" : "text-estado-ambar",
                  )}
                >
                  {completo ? "Completo" : `${delBloque.length} de ${requeridos}`}
                </span>
              </div>

              {delBloque.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {delBloque.map((documento) => (
                    <li
                      key={documento.id}
                      className="flex flex-wrap items-center gap-2 text-xs text-texto-suave"
                    >
                      <Link
                        href={`/misiones/${misionId}/documentos/${documento.id}`}
                        className="truncate font-medium text-texto hover:underline"
                      >
                        {documento.nombre_original}
                      </Link>
                      <span>{formatearTamano(documento.tamano_bytes)}</span>
                      {documento.version > 1 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-estado-azul-fondo px-2 py-0.5 text-estado-azul">
                          <RefreshCw className="size-3" aria-hidden />
                          Versión {documento.version}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-texto-suave">
                  <CircleDashed className="size-3.5" aria-hidden />
                  {puedeCargar ? (
                    <>
                      Falta cargar.{" "}
                      <Link
                        href={`/misiones/${misionId}/documentos`}
                        className="font-medium text-marina-900 underline underline-offset-2"
                      >
                        Cargar ahora
                      </Link>
                    </>
                  ) : (
                    "Falta cargar."
                  )}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
