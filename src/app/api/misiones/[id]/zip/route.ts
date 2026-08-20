import { NextResponse, type NextRequest } from "next/server";
import { Zip, ZipPassThrough } from "fflate";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { obtenerAlmacenamiento } from "@/lib/almacenamiento/supabase";
import { obtenerSesion } from "@/lib/sesion";
import { REGLAS_DOCUMENTO, type Bucket } from "@/dominio/soportes";

/**
 * Descarga del expediente completo en ZIP.
 *
 * Se arma en streaming: los archivos se leen del almacenamiento y se envían al
 * navegador a medida que entran, sin acumular en memoria del servidor. Con
 * videos de 500 MB, cualquier otra cosa tumbaría la función.
 *
 * No se comprime (los PDF, JPG y MP4 ya lo están): el ZIP solo agrupa.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sesion = await obtenerSesion();

  if (!sesion) {
    return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  }

  const supabase = await crearClienteServidor();

  // RLS decide: si el usuario no puede ver la misión, no hay expediente.
  const { data: mision } = await supabase
    .from("misiones")
    .select("id, numero_mision, anio")
    .eq("id", id)
    .maybeSingle();

  if (!mision) {
    return NextResponse.json({ error: "La misión no está disponible." }, { status: 404 });
  }

  const { data: documentos } = await supabase
    .from("documentos")
    .select("id, tipo, nombre_original, ruta_almacenamiento, bucket")
    .eq("mision_id", id)
    .eq("vigente", true)
    .order("tipo");

  if (!documentos || documentos.length === 0) {
    return NextResponse.json(
      { error: "La misión todavía no tiene soportes cargados." },
      { status: 404 },
    );
  }

  const almacenamiento = obtenerAlmacenamiento();
  const nombreZip = `mision-${mision.numero_mision}.zip`;

  const flujo = new ReadableStream<Uint8Array>({
    start(controlador) {
      const zip = new Zip((error, datos, final) => {
        if (error) {
          console.error(`[zip] Error al comprimir la misión ${id}:`, error);
          controlador.error(error);
          return;
        }

        controlador.enqueue(datos);
        if (final) controlador.close();
      });

      // Se procesan en serie: en paralelo el ZIP mezclaría los fragmentos.
      void (async () => {
        try {
          for (const [indice, documento] of documentos.entries()) {
            const regla = REGLAS_DOCUMENTO[documento.tipo];
            // Prefijo numérico para que el orden de la carpeta sea el del expediente.
            const nombre = `${String(indice + 1).padStart(2, "0")}-${regla.tipo}-${documento.nombre_original}`;

            const entrada = new ZipPassThrough(nombre);
            zip.add(entrada);

            const lectura = await almacenamiento.leer(
              documento.bucket as Bucket,
              documento.ruta_almacenamiento,
            );
            const lector = lectura.getReader();

            for (;;) {
              const { done, value } = await lector.read();
              if (done) break;
              entrada.push(value, false);
            }

            entrada.push(new Uint8Array(0), true);
          }

          zip.end();
        } catch (error) {
          console.error(`[zip] Falló el armado del expediente ${id}:`, error);
          controlador.error(error);
        }
      })();
    },
  });

  // La descarga del expediente completo también queda en la bitácora.
  const servicio = crearClienteServicio();
  await servicio.rpc("registrar_evento_autenticacion", {
    p_accion: "descargar_documento",
    p_actor_id: sesion.usuarioId,
    p_actor_email: sesion.correo,
    p_ip: request.headers.get("x-forwarded-for"),
    p_user_agent: request.headers.get("user-agent"),
    p_detalle: {
      entidad_id: id,
      mision_id: id,
      nombre: nombreZip,
      archivos: documentos.length,
    },
  });

  return new NextResponse(flujo, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${nombreZip}"`,
      "cache-control": "no-store",
    },
  });
}
