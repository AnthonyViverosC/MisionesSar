import Image from "next/image";
import { INSTITUCION } from "@/config/institucion";
import { cn } from "@/lib/utils";

/** Escudo de la unidad. El archivo se reemplaza en `public/escudo.svg`. */
export function Escudo({
  tamano = 40,
  className,
}: {
  tamano?: number;
  className?: string;
}) {
  return (
    <Image
      src={INSTITUCION.escudo}
      alt={`Escudo de ${INSTITUCION.unidadPropietaria}`}
      width={tamano}
      height={tamano}
      className={cn("shrink-0", className)}
      priority
    />
  );
}

/** Escudo con el nombre del sistema y su descriptor, como en la referencia. */
export function Marca({
  tamano = 40,
  claro = true,
  className,
}: {
  tamano?: number;
  claro?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Escudo tamano={tamano} />
      <div className="leading-tight">
        <p
          className={cn(
            "font-serif text-lg font-semibold tracking-wide",
            claro ? "text-white" : "text-texto",
          )}
        >
          {INSTITUCION.nombre}
        </p>
        <p className={cn("text-[11px]", claro ? "text-marina-400" : "text-texto-suave")}>
          {INSTITUCION.descriptor}
        </p>
      </div>
    </div>
  );
}
