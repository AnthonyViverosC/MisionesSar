"use client";

import * as tus from "tus-js-client";
import { BYTES_CABECERA, REGLAS_DOCUMENTO, coincideFirma, type TipoDocumento } from "@/dominio/soportes";
import { sha256DeArchivo } from "./sha256";

/**
 * Subida de archivos desde el navegador.
 *
 * Los PDF y las fotos van por una URL firmada, con XMLHttpRequest para poder
 * mostrar progreso real. El video usa subida reanudable (tus): si se cae la
 * conexión en el minuto ocho de una carga de 400 MB, continúa donde estaba en
 * vez de empezar de nuevo.
 */

export type EtapaSubida = "verificando" | "calculando" | "subiendo" | "registrando";

export type ProgresoSubida = {
  etapa: EtapaSubida;
  /** Porcentaje de la etapa en curso, de 0 a 100. */
  porcentaje: number;
};

/**
 * Verifica que el contenido del archivo sea de verdad lo que dice ser.
 *
 * Renombrar un .exe a .pdf toma un segundo, y el navegador declara el tipo MIME
 * que le parezca. Lo único confiable son los primeros bytes.
 */
export async function verificarFirma(
  archivo: File,
  tipo: TipoDocumento,
): Promise<{ valido: true; mime: string } | { valido: false; error: string }> {
  const regla = REGLAS_DOCUMENTO[tipo];

  if (archivo.size === 0) {
    return { valido: false, error: "El archivo está vacío." };
  }

  if (archivo.size > regla.tamanoMaximo) {
    const maximo = Math.round(regla.tamanoMaximo / (1024 * 1024));
    return {
      valido: false,
      error: `El archivo pesa más de ${maximo} MB, el máximo para ${regla.etiqueta.toLowerCase()}.`,
    };
  }

  const cabecera = new Uint8Array(await archivo.slice(0, BYTES_CABECERA).arrayBuffer());
  const coincidencia = regla.mimes.find((mime) => coincideFirma(cabecera, mime));

  if (!coincidencia) {
    return {
      valido: false,
      error: `El contenido del archivo no es ${regla.formatoLegible}, aunque su nombre lo diga. Verifica que sea el archivo correcto.`,
    };
  }

  return { valido: true, mime: coincidencia };
}

/** Sube el archivo a una URL firmada, informando el progreso real. */
export function subirConUrlFirmada(
  url: string,
  archivo: File,
  mime: string,
  alProgresar: (porcentaje: number) => void,
): Promise<void> & { cancelar: () => void } {
  const peticion = new XMLHttpRequest();

  const promesa = new Promise<void>((resolver, rechazar) => {
    peticion.open("PUT", url, true);
    peticion.setRequestHeader("content-type", mime);
    peticion.setRequestHeader("x-upsert", "false");

    peticion.upload.addEventListener("progress", (evento) => {
      if (evento.lengthComputable) {
        alProgresar(Math.round((evento.loaded / evento.total) * 100));
      }
    });

    peticion.addEventListener("load", () => {
      if (peticion.status >= 200 && peticion.status < 300) {
        alProgresar(100);
        resolver();
      } else {
        rechazar(new Error(`El almacenamiento rechazó el archivo (HTTP ${peticion.status}).`));
      }
    });

    peticion.addEventListener("error", () =>
      rechazar(new Error("Se perdió la conexión durante la subida.")),
    );
    peticion.addEventListener("abort", () => rechazar(new Error("Subida cancelada.")));

    peticion.send(archivo);
  }) as Promise<void> & { cancelar: () => void };

  promesa.cancelar = () => peticion.abort();
  return promesa;
}

export type ControlSubidaReanudable = {
  promesa: Promise<void>;
  pausar: () => void;
  reanudar: () => void;
  cancelar: () => void;
};

/**
 * Sube el video con el protocolo tus.
 *
 * Reintenta sola con espera creciente y, si el usuario vuelve a elegir el mismo
 * archivo tras un corte, continúa desde donde se quedó.
 */
export function subirReanudable({
  puntoFinal,
  token,
  bucket,
  ruta,
  archivo,
  mime,
  alProgresar,
}: {
  puntoFinal: string;
  token: string;
  bucket: string;
  ruta: string;
  archivo: File;
  mime: string;
  alProgresar: (porcentaje: number) => void;
}): ControlSubidaReanudable {
  let subida: tus.Upload;

  const promesa = new Promise<void>((resolver, rechazar) => {
    subida = new tus.Upload(archivo, {
      endpoint: puntoFinal,
      // Esperas crecientes: un corte breve de red no aborta la carga.
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${token}`,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      // Permite reanudar aunque el usuario recargue la página.
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: ruta,
        contentType: mime,
        cacheControl: "3600",
      },
      // Supabase Storage exige exactamente 6 MB por fragmento.
      chunkSize: 6 * 1024 * 1024,
      onProgress(subidos, total) {
        alProgresar(Math.round((subidos / total) * 100));
      },
      onSuccess() {
        alProgresar(100);
        resolver();
      },
      onError(error) {
        rechazar(
          new Error(
            `La subida del video se interrumpió: ${error.message}. Puedes reintentarla y continuará donde se quedó.`,
          ),
        );
      },
    });

    // Si hay una subida previa del mismo archivo, se retoma.
    subida.findPreviousUploads().then((previas) => {
      if (previas.length > 0) subida.resumeFromPreviousUpload(previas[0]);
      subida.start();
    });
  });

  return {
    promesa,
    pausar: () => subida?.abort(),
    reanudar: () => subida?.start(),
    cancelar: () => {
      void subida?.abort(true);
    },
  };
}

/** Calcula el hash del archivo informando el avance. */
export async function calcularHash(
  archivo: File,
  alProgresar: (porcentaje: number) => void,
): Promise<string> {
  return sha256DeArchivo(archivo, (fraccion) => alProgresar(Math.round(fraccion * 100)));
}
