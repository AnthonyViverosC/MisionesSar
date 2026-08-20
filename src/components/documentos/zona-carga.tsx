"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, FileUp, Loader2, RefreshCw, X } from "lucide-react";
import {
  datosSubidaReanudable,
  prepararSubida,
  registrarDocumento,
} from "@/acciones/documentos";
import {
  calcularHash,
  subirConUrlFirmada,
  subirReanudable,
  verificarFirma,
  type EtapaSubida,
} from "@/lib/archivos/subida";
import { REGLAS_DOCUMENTO, formatearTamano, type TipoDocumento } from "@/dominio/soportes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TEXTO_ETAPA: Record<EtapaSubida, string> = {
  verificando: "Verificando el archivo…",
  calculando: "Calculando la huella del archivo…",
  subiendo: "Subiendo…",
  registrando: "Registrando el soporte…",
};

/**
 * Zona de carga de un soporte.
 *
 * Reproduce el recuadro punteado de la referencia. Antes de subir nada
 * comprueba que el contenido del archivo sea del formato correcto y calcula su
 * huella; después sube directamente al almacenamiento, sin pasar por el
 * servidor de la aplicación.
 */
export function ZonaCarga({
  misionId,
  tipo,
  reemplazaA,
  etiquetaReemplazo,
}: {
  misionId: string;
  tipo: TipoDocumento;
  /** Documento vigente que este archivo sustituirá, si aplica. */
  reemplazaA?: string;
  etiquetaReemplazo?: string;
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const cancelar = useRef<(() => void) | null>(null);

  const [sobrevolando, setSobrevolando] = useState(false);
  // El ref guarda la función de cancelación; el estado es lo que puede leerse
  // durante el render para decidir si se muestra el botón.
  const [cancelable, setCancelable] = useState(false);
  const [etapa, setEtapa] = useState<EtapaSubida | null>(null);
  const [porcentaje, setPorcentaje] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [archivoActual, setArchivoActual] = useState<File | null>(null);

  const regla = REGLAS_DOCUMENTO[tipo];
  const ocupado = etapa !== null;

  async function procesar(archivo: File) {
    setError(null);
    setArchivoActual(archivo);
    setPorcentaje(0);

    try {
      // 1. El contenido tiene que ser lo que dice ser.
      setEtapa("verificando");
      const firma = await verificarFirma(archivo, tipo);
      if (!firma.valido) {
        setError(firma.error);
        setEtapa(null);
        return;
      }

      // 2. Huella del archivo, para integridad y duplicados.
      setEtapa("calculando");
      const hash = await calcularHash(archivo, setPorcentaje);

      // 3. Permiso y URL firmada.
      setEtapa("subiendo");
      setPorcentaje(0);

      const preparacion = await prepararSubida({
        misionId,
        tipo,
        nombreOriginal: archivo.name,
        tamanoBytes: archivo.size,
        mimeType: firma.mime,
        reemplazaA,
      });

      if (!preparacion.ok) {
        setError(preparacion.error);
        setEtapa(null);
        return;
      }

      // 4. Subida: reanudable para el video, firmada para el resto.
      if (tipo === "video") {
        const datos = await datosSubidaReanudable(misionId);
        if (!datos.ok) {
          setError(datos.error);
          setEtapa(null);
          return;
        }

        const control = subirReanudable({
          puntoFinal: datos.puntoFinal,
          token: datos.token,
          bucket: datos.bucket,
          ruta: preparacion.ruta,
          archivo,
          mime: firma.mime,
          alProgresar: setPorcentaje,
        });

        cancelar.current = control.cancelar;
        setCancelable(true);
        await control.promesa;
      } else {
        const subida = subirConUrlFirmada(preparacion.url, archivo, firma.mime, setPorcentaje);
        cancelar.current = subida.cancelar;
        setCancelable(true);
        await subida;
      }

      cancelar.current = null;
      setCancelable(false);

      // 5. Registro en la base.
      setEtapa("registrando");
      const registro = await registrarDocumento({
        misionId,
        tipo,
        nombreOriginal: archivo.name,
        ruta: preparacion.ruta,
        bucket: preparacion.bucket,
        mimeType: firma.mime,
        tamanoBytes: archivo.size,
        hashSha256: hash,
        reemplazaA: preparacion.reemplazaA,
      });

      if (!registro.ok) {
        setError(registro.error);
        setEtapa(null);
        return;
      }

      toast.success(
        registro.version > 1
          ? `${regla.etiqueta}: versión ${registro.version} cargada`
          : `${regla.etiqueta} cargado`,
        {
          description: registro.duplicadoDe
            ? "Este archivo ya existía en otra misión. Verifica que sea el correcto."
            : undefined,
        },
      );

      setEtapa(null);
      setArchivoActual(null);
      router.refresh();
    } catch (fallo) {
      cancelar.current = null;
      setCancelable(false);
      setError(fallo instanceof Error ? fallo.message : "No se pudo completar la subida.");
      setEtapa(null);
    }
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(evento) => {
          evento.preventDefault();
          if (!ocupado) setSobrevolando(true);
        }}
        onDragLeave={() => setSobrevolando(false)}
        onDrop={(evento) => {
          evento.preventDefault();
          setSobrevolando(false);
          const archivo = evento.dataTransfer.files[0];
          if (archivo && !ocupado) void procesar(archivo);
        }}
        className={cn(
          "rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors",
          sobrevolando ? "border-marina-700 bg-estado-azul-fondo" : "border-borde bg-superficie",
          ocupado && "opacity-90",
        )}
      >
        {ocupado ? (
          <div className="space-y-3">
            <p className="flex items-center justify-center gap-2 text-sm font-medium text-texto">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {TEXTO_ETAPA[etapa]}
            </p>

            <div
              role="progressbar"
              aria-valuenow={porcentaje}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={TEXTO_ETAPA[etapa]}
              className="mx-auto h-2 w-full max-w-sm overflow-hidden rounded-full bg-estado-gris-fondo"
            >
              <div
                className="h-full rounded-full bg-marina-900 transition-[width]"
                style={{ width: `${porcentaje}%` }}
              />
            </div>

            <p className="text-xs text-texto-suave">
              {porcentaje}%
              {archivoActual ? ` · ${formatearTamano(archivoActual.size)}` : ""}
            </p>

            {cancelable ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  cancelar.current?.();
                  cancelar.current = null;
                  setCancelable(false);
                  setEtapa(null);
                  setError("Subida cancelada.");
                }}
              >
                <X className="size-4" aria-hidden />
                Cancelar
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <FileUp className="mx-auto size-6 text-texto-suave" aria-hidden />
            <p className="text-sm text-texto">
              Arrastra el archivo o{" "}
              <button
                type="button"
                onClick={() => entrada.current?.click()}
                className="font-medium text-marina-900 underline underline-offset-2"
              >
                haz clic para seleccionar
              </button>
            </p>
            <p className="text-xs text-texto-suave">
              {regla.formatoLegible} · máximo{" "}
              {formatearTamano(regla.tamanoMaximo)}
              {etiquetaReemplazo ? ` · reemplaza “${etiquetaReemplazo}”` : ""}
            </p>
          </div>
        )}

        <input
          ref={entrada}
          type="file"
          className="sr-only"
          accept={regla.extensiones.join(",")}
          aria-label={`Seleccionar archivo para ${regla.etiqueta}`}
          onChange={(evento) => {
            const archivo = evento.target.files?.[0];
            if (archivo) void procesar(archivo);
            evento.target.value = "";
          }}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-estado-rojo/30 bg-estado-rojo-fondo px-3 py-2 text-sm text-estado-rojo"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="flex-1">{error}</span>
          {archivoActual ? (
            <button
              type="button"
              onClick={() => void procesar(archivoActual)}
              className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Reintentar
            </button>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
