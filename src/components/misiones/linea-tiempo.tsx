import { Ban, Check, FileText, Send, Undo2 } from "lucide-react";
import type { FilaMision } from "@/tipos/basedatos";

/** Formato largo y legible de una marca de tiempo. */
function formatear(marca: string): string {
  return new Date(marca).toLocaleString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Línea de tiempo de la misión.
 *
 * Se arma con las marcas que guarda la propia misión. Para el detalle completo
 * de quién hizo qué está la auditoría, que es donde queda todo.
 */
export function LineaTiempo({
  mision,
  nombres,
}: {
  mision: FilaMision;
  nombres: Record<string, string>;
}) {
  const hitos = [
    {
      marca: mision.creado_en,
      icono: FileText,
      titulo: "Misión creada",
      autor: nombres[mision.creada_por],
    },
    mision.enviada_en
      ? { marca: mision.enviada_en, icono: Send, titulo: "Enviada a revisión", autor: nombres[mision.creada_por] }
      : null,
    mision.revisada_en && mision.estado === "observada"
      ? {
          marca: mision.revisada_en,
          icono: Undo2,
          titulo: "Devuelta con observación",
          autor: mision.revisada_por ? nombres[mision.revisada_por] : undefined,
        }
      : mision.revisada_en && !mision.aprobada_en
        ? {
            marca: mision.revisada_en,
            icono: Check,
            titulo: "Tomada en revisión",
            autor: mision.revisada_por ? nombres[mision.revisada_por] : undefined,
          }
        : null,
    mision.aprobada_en
      ? {
          marca: mision.aprobada_en,
          icono: Check,
          titulo: "Aprobada",
          autor: mision.revisada_por ? nombres[mision.revisada_por] : undefined,
        }
      : null,
    mision.anulada_en
      ? {
          marca: mision.anulada_en,
          icono: Ban,
          titulo: "Anulada",
          autor: mision.anulada_por ? nombres[mision.anulada_por] : undefined,
        }
      : null,
  ].filter((hito): hito is NonNullable<typeof hito> => hito !== null);

  return (
    <ol className="space-y-4 px-4 py-4">
      {hitos.map((hito, indice) => {
        const Icono = hito.icono;

        return (
          <li key={`${hito.titulo}-${indice}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-borde bg-superficie text-texto-suave">
                <Icono className="size-3.5" aria-hidden />
              </span>
              {indice < hitos.length - 1 ? (
                <span aria-hidden className="mt-1 w-px flex-1 bg-borde" />
              ) : null}
            </div>

            <div className="pb-1">
              <p className="text-sm font-medium text-texto">{hito.titulo}</p>
              <p className="text-xs text-texto-suave">
                <time dateTime={hito.marca}>{formatear(hito.marca)}</time>
                {hito.autor ? ` · ${hito.autor}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
