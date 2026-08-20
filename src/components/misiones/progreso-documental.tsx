import { TOTAL_ARCHIVOS } from "@/dominio/soportes";
import { cn } from "@/lib/utils";

/**
 * Progreso de carga de los ocho archivos de una misión.
 *
 * La referencia muestra una barra y un contador a su derecha. El contador va en
 * archivos, no en soportes: es lo único que dice si falta la segunda foto o el
 * video dentro del archivo fílmico.
 */
export function ProgresoDocumental({
  cargados,
  total = TOTAL_ARCHIVOS,
  compacto = false,
  className,
}: {
  cargados: number;
  total?: number;
  compacto?: boolean;
  className?: string;
}) {
  const porcentaje = total > 0 ? Math.min(100, Math.round((cargados / total) * 100)) : 0;
  const completo = cargados >= total;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-valuenow={cargados}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${cargados} de ${total} archivos cargados`}
        className={cn(
          "h-1.5 overflow-hidden rounded-full bg-estado-gris-fondo",
          compacto ? "w-24" : "w-full max-w-[180px]",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            completo ? "bg-estado-verde" : "bg-marina-900",
          )}
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      <span
        className={cn(
          "shrink-0 rounded-md border border-borde bg-superficie px-2 py-0.5 text-xs tabular-nums",
          completo ? "text-estado-verde" : "text-texto-suave",
        )}
      >
        {cargados}/{total} archivos
      </span>
    </div>
  );
}
