import "server-only";

import type { Bucket } from "@/dominio/soportes";

/**
 * Contrato del almacenamiento de archivos.
 *
 * Toda la aplicación habla con esta interfaz, nunca con Supabase Storage
 * directamente. El día que el archivo fílmico se mude a Cloudflare R2 —los
 * videos de 500 MB son el motivo previsible— basta escribir otra
 * implementación y elegirla en `obtenerAlmacenamiento`, sin tocar acciones ni
 * pantallas.
 */
export interface AdaptadorAlmacenamiento {
  /**
   * Emite una URL firmada para que el navegador suba el archivo directamente,
   * sin que pase por el servidor de la aplicación.
   */
  urlDeSubida(
    bucket: Bucket,
    ruta: string,
  ): Promise<{ url: string; token: string; ruta: string }>;

  /** URL de descarga de vigencia corta. */
  urlDeDescarga(bucket: Bucket, ruta: string, segundos: number): Promise<string>;

  /** Contenido del archivo, para armar el ZIP del expediente en el servidor. */
  leer(bucket: Bucket, ruta: string): Promise<ReadableStream<Uint8Array>>;

  /**
   * Punto final para subidas reanudables (protocolo tus).
   * El video se sube por aquí: permite continuar donde se cortó.
   */
  puntoFinalReanudable(): string;
}
