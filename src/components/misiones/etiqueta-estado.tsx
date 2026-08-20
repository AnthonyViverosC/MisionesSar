import { COLOR_ESTADO, ETIQUETA_ESTADO, type EstadoMision } from "@/dominio/estados";
import { cn } from "@/lib/utils";

/**
 * Distintivo de estado con punto de color, como en la referencia.
 * El color nunca va solo: siempre acompaña al texto, para no depender de la
 * percepción cromática.
 */
export function EtiquetaEstado({
  estado,
  className,
}: {
  estado: EstadoMision;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        COLOR_ESTADO[estado],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}
