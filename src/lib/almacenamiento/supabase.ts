import "server-only";

import { crearClienteServicio } from "@/lib/supabase/servicio";
import { entornoPublico } from "@/lib/entorno";
import type { Bucket } from "@/dominio/soportes";
import type { AdaptadorAlmacenamiento } from "./adaptador";

/**
 * Implementación sobre Supabase Storage.
 *
 * Usa la clave de servicio porque firmar URLs es una operación de servidor. Los
 * permisos se comprueban antes de llegar aquí: este módulo no decide quién
 * puede subir o descargar, solo ejecuta.
 */
class AlmacenamientoSupabase implements AdaptadorAlmacenamiento {
  async urlDeSubida(bucket: Bucket, ruta: string) {
    const supabase = crearClienteServicio();
    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(ruta);

    if (error || !data) {
      throw new Error(`No se pudo firmar la subida: ${error?.message ?? "sin datos"}`);
    }

    return { url: data.signedUrl, token: data.token, ruta: data.path };
  }

  async urlDeDescarga(bucket: Bucket, ruta: string, segundos: number) {
    const supabase = crearClienteServicio();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(ruta, segundos);

    if (error || !data) {
      throw new Error(`No se pudo firmar la descarga: ${error?.message ?? "sin datos"}`);
    }

    return data.signedUrl;
  }

  async leer(bucket: Bucket, ruta: string) {
    const supabase = crearClienteServicio();
    const { data, error } = await supabase.storage.from(bucket).download(ruta);

    if (error || !data) {
      throw new Error(`No se pudo leer el archivo: ${error?.message ?? "sin datos"}`);
    }

    return data.stream() as ReadableStream<Uint8Array>;
  }

  puntoFinalReanudable() {
    return `${entornoPublico.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`;
  }
}

let instancia: AdaptadorAlmacenamiento | null = null;

/** Almacenamiento en uso. Único punto donde se elige la implementación. */
export function obtenerAlmacenamiento(): AdaptadorAlmacenamiento {
  instancia ??= new AlmacenamientoSupabase();
  return instancia;
}
