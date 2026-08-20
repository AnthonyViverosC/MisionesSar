"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { obtenerAlmacenamiento } from "@/lib/almacenamiento/supabase";
import { exigirSesion } from "@/lib/sesion";
import { REGLAS_DOCUMENTO, TIPOS_DOCUMENTO, type TipoDocumento } from "@/dominio/soportes";

/**
 * Carga y descarga de soportes.
 *
 * El archivo nunca pasa por el servidor de la aplicación: el navegador lo sube
 * directamente al almacenamiento con una URL firmada que se emite aquí, y solo
 * después de comprobar que el usuario puede editar esa misión.
 *
 * El servidor revalida tipo y tamaño aunque el navegador ya los haya
 * verificado, y la base vuelve a comprobarlo con sus propias restricciones.
 */

/** Vigencia de las URL de descarga. */
const SEGUNDOS_DESCARGA = 300; // 5 minutos

export type ResultadoSubida =
  | {
      ok: true;
      url: string;
      token: string;
      ruta: string;
      bucket: string;
      /** Documento vigente al que reemplazará este archivo, si lo hay. */
      reemplazaA: string | null;
    }
  | { ok: false; error: string };

const esquemaPreparacion = z.object({
  misionId: z.string().uuid(),
  tipo: z.enum(TIPOS_DOCUMENTO),
  nombreOriginal: z.string().trim().min(1).max(255),
  tamanoBytes: z.number().int().positive(),
  mimeType: z.string().trim().min(1).max(100),
  /** Para el archivo fílmico: qué fotografía concreta se reemplaza. */
  reemplazaA: z.string().uuid().optional(),
});

/**
 * Comprueba permisos y emite la URL firmada de subida.
 *
 * La ruta se construye siempre con un UUID nuevo: el nombre original del
 * archivo no toca el almacenamiento, se guarda aparte solo para mostrarlo.
 */
export async function prepararSubida(entrada: unknown): Promise<ResultadoSubida> {
  const sesion = await exigirSesion();

  const analisis = esquemaPreparacion.safeParse(entrada);
  if (!analisis.success) {
    return { ok: false, error: "Los datos del archivo no son válidos." };
  }

  const { misionId, tipo, nombreOriginal, tamanoBytes, mimeType, reemplazaA } = analisis.data;
  const regla = REGLAS_DOCUMENTO[tipo];

  // Validación de formato y tamaño en el servidor, sin confiar en el navegador.
  if (!regla.mimes.includes(mimeType)) {
    return {
      ok: false,
      error: `${regla.etiqueta} admite ${regla.formatoLegible}. El archivo enviado es ${mimeType}.`,
    };
  }

  if (tamanoBytes > regla.tamanoMaximo) {
    return {
      ok: false,
      error: `El archivo supera el máximo de ${Math.round(regla.tamanoMaximo / (1024 * 1024))} MB para ${regla.etiqueta.toLowerCase()}.`,
    };
  }

  const supabase = await crearClienteServidor();

  // La base decide si este usuario puede editar el expediente.
  const { data: puedeEditar } = await supabase.rpc("puede_editar_mision", {
    p_mision_id: misionId,
  });

  if (!puedeEditar) {
    return {
      ok: false,
      error: "Esta misión no admite cambios en sus soportes con tu rol y su estado actual.",
    };
  }

  // ¿Hay que reemplazar un documento vigente?
  const { data: vigentes } = await supabase
    .from("documentos")
    .select("id, version, creado_en")
    .eq("mision_id", misionId)
    .eq("tipo", tipo)
    .eq("vigente", true)
    .order("creado_en");

  let objetivo: string | null = null;

  if (reemplazaA) {
    objetivo = vigentes?.find((documento) => documento.id === reemplazaA)?.id ?? null;
    if (!objetivo) {
      return { ok: false, error: "El documento que intentas reemplazar ya no está vigente." };
    }
  } else if ((vigentes?.length ?? 0) >= regla.cantidad) {
    // Para los tipos de un solo archivo, subir otro reemplaza al que estaba.
    if (regla.cantidad === 1) {
      objetivo = vigentes![0].id;
    } else {
      return {
        ok: false,
        error: `${regla.etiqueta} ya tiene ${regla.cantidad} archivos. Elige cuál reemplazar.`,
      };
    }
  }

  const extension = nombreOriginal.slice(nombreOriginal.lastIndexOf(".")).toLowerCase();
  if (!regla.extensiones.includes(extension)) {
    return {
      ok: false,
      error: `La extensión ${extension || "(ninguna)"} no corresponde a ${regla.formatoLegible}.`,
    };
  }

  const ruta = `${misionId}/${tipo}/${crypto.randomUUID()}${extension}`;

  try {
    const almacenamiento = obtenerAlmacenamiento();
    const firma = await almacenamiento.urlDeSubida(regla.bucket, ruta);

    return {
      ok: true,
      url: firma.url,
      token: firma.token,
      ruta,
      bucket: regla.bucket,
      reemplazaA: objetivo,
    };
  } catch (error) {
    console.error(`[documentos] Firma de subida fallida para ${misionId}/${tipo}:`, error);
    return { ok: false, error: "No se pudo preparar la subida. Intenta de nuevo." };
  }
}

const esquemaRegistro = z.object({
  misionId: z.string().uuid(),
  tipo: z.enum(TIPOS_DOCUMENTO),
  nombreOriginal: z.string().trim().min(1).max(255),
  ruta: z.string().trim().min(1).max(500),
  bucket: z.enum(["documentos-pdf", "archivo-filmico"]),
  mimeType: z.string().trim().min(1).max(100),
  tamanoBytes: z.number().int().positive(),
  hashSha256: z.string().regex(/^[0-9a-f]{64}$/, "El hash del archivo no es válido."),
  reemplazaA: z.string().uuid().nullable().optional(),
});

export type ResultadoRegistro =
  | { ok: true; documentoId: string; version: number; duplicadoDe?: string }
  | { ok: false; error: string };

/**
 * Registra el documento una vez subido.
 *
 * Si reemplaza a otro, la versión anterior no se borra: se marca como no
 * vigente y la nueva entra con el número de versión siguiente.
 */
export async function registrarDocumento(entrada: unknown): Promise<ResultadoRegistro> {
  const sesion = await exigirSesion();

  const analisis = esquemaRegistro.safeParse(entrada);
  if (!analisis.success) {
    return { ok: false, error: analisis.error.issues[0]?.message ?? "Datos no válidos." };
  }

  const datos = analisis.data;
  const regla = REGLAS_DOCUMENTO[datos.tipo];

  if (regla.bucket !== datos.bucket || !regla.mimes.includes(datos.mimeType)) {
    return { ok: false, error: "El archivo no corresponde al soporte indicado." };
  }

  // La ruta tiene que estar dentro de la carpeta de la misión: si no, se estaría
  // registrando un archivo ajeno al expediente.
  if (!datos.ruta.startsWith(`${datos.misionId}/${datos.tipo}/`)) {
    return { ok: false, error: "La ruta del archivo no corresponde a esta misión." };
  }

  const supabase = await crearClienteServidor();

  // Versión siguiente para este tipo dentro de la misión.
  const { data: previos } = await supabase
    .from("documentos")
    .select("id, version")
    .eq("mision_id", datos.misionId)
    .eq("tipo", datos.tipo)
    .order("version", { ascending: false })
    .limit(1);

  const version = (previos?.[0]?.version ?? 0) + 1;

  // Duplicado: el mismo archivo ya está en el sistema. Se avisa, no se bloquea:
  // un mismo anexo puede repetirse legítimamente entre misiones.
  const { data: duplicado } = await supabase
    .from("documentos")
    .select("id, mision_id")
    .eq("hash_sha256", datos.hashSha256)
    .eq("vigente", true)
    .limit(1)
    .maybeSingle();

  // El reemplazo se retira antes de insertar: el índice único no admite dos
  // documentos vigentes del mismo tipo.
  if (datos.reemplazaA) {
    const { error } = await supabase
      .from("documentos")
      .update({ vigente: false, reemplazado_en: new Date().toISOString() })
      .eq("id", datos.reemplazaA);

    if (error) {
      console.warn(`[documentos] No se pudo retirar ${datos.reemplazaA}: ${error.message}`);
      return { ok: false, error: "No se pudo reemplazar el documento anterior." };
    }
  }

  const { data: creado, error } = await supabase
    .from("documentos")
    .insert({
      mision_id: datos.misionId,
      tipo: datos.tipo,
      nombre_original: datos.nombreOriginal,
      ruta_almacenamiento: datos.ruta,
      bucket: datos.bucket,
      mime_type: datos.mimeType,
      tamano_bytes: datos.tamanoBytes,
      hash_sha256: datos.hashSha256,
      version,
      subido_por: sesion.usuarioId,
    })
    .select("id, version")
    .single();

  if (error) {
    console.warn(`[documentos] Registro fallido: ${error.code} ${error.message}`);

    // Los mensajes de nuestros triggers ya están escritos para el usuario.
    const propio =
      error.message.includes("fílmico") ||
      error.message.includes("misión") ||
      error.message.includes("revisión");

    return {
      ok: false,
      error: propio
        ? error.message
        : "No se pudo registrar el documento. Verifica el formato y vuelve a intentar.",
    };
  }

  revalidatePath(`/misiones/${datos.misionId}`);
  revalidatePath(`/misiones/${datos.misionId}/documentos`);
  revalidatePath("/misiones");

  return {
    ok: true,
    documentoId: creado.id,
    version: creado.version,
    duplicadoDe: duplicado?.mision_id,
  };
}

export type ResultadoDescarga = { ok: true; url: string } | { ok: false; error: string };

/**
 * Emite una URL de descarga con cinco minutos de vigencia.
 *
 * El permiso lo aplica RLS: si el usuario no puede ver el documento, la
 * consulta no devuelve nada y no se firma ninguna URL. Cada descarga queda en
 * la bitácora.
 */
export async function urlDeDescarga(documentoId: string): Promise<ResultadoDescarga> {
  const sesion = await exigirSesion();

  if (!z.string().uuid().safeParse(documentoId).success) {
    return { ok: false, error: "El documento solicitado no es válido." };
  }

  const supabase = await crearClienteServidor();
  const { data: documento } = await supabase
    .from("documentos")
    .select("id, bucket, ruta_almacenamiento, nombre_original, mision_id")
    .eq("id", documentoId)
    .maybeSingle();

  if (!documento) {
    // Puede no existir o estar fuera del alcance del rol: la respuesta es la
    // misma, para no revelar qué documentos existen.
    return { ok: false, error: "El documento no está disponible." };
  }

  try {
    const almacenamiento = obtenerAlmacenamiento();
    const url = await almacenamiento.urlDeDescarga(
      documento.bucket as "documentos-pdf" | "archivo-filmico",
      documento.ruta_almacenamiento,
      SEGUNDOS_DESCARGA,
    );

    const cabeceras = await headers();
    const servicio = crearClienteServicio();
    await servicio.rpc("registrar_evento_autenticacion", {
      p_accion: "descargar_documento",
      p_actor_id: sesion.usuarioId,
      p_actor_email: sesion.correo,
      p_ip: cabeceras.get("x-forwarded-for"),
      p_user_agent: cabeceras.get("user-agent"),
      p_detalle: {
        entidad_id: documento.id,
        mision_id: documento.mision_id,
        nombre: documento.nombre_original,
      },
    });

    return { ok: true, url };
  } catch (error) {
    console.error(`[documentos] Firma de descarga fallida (${documentoId}):`, error);
    return { ok: false, error: "No se pudo generar el enlace de descarga." };
  }
}

/**
 * Token de sesión para la subida reanudable del video.
 *
 * El protocolo tus viaja con el token del usuario, así que la subida pasa por
 * las políticas de Storage: solo entra si la misión es editable para él.
 */
export async function datosSubidaReanudable(misionId: string): Promise<
  { ok: true; puntoFinal: string; token: string; bucket: string } | { ok: false; error: string }
> {
  await exigirSesion();

  const supabase = await crearClienteServidor();
  const { data: puedeEditar } = await supabase.rpc("puede_editar_mision", {
    p_mision_id: misionId,
  });

  if (!puedeEditar) {
    return { ok: false, error: "Esta misión no admite cambios en sus soportes." };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "La sesión expiró. Vuelve a ingresar." };
  }

  return {
    ok: true,
    puntoFinal: obtenerAlmacenamiento().puntoFinalReanudable(),
    token: session.access_token,
    bucket: "archivo-filmico",
  };
}

/** Versiones anteriores de un soporte, para el historial del documento. */
export async function historialDocumento(misionId: string, tipo: TipoDocumento) {
  await exigirSesion();

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("documentos")
    .select("id, nombre_original, version, vigente, creado_en, tamano_bytes, subido_por")
    .eq("mision_id", misionId)
    .eq("tipo", tipo)
    .order("version", { ascending: false });

  return data ?? [];
}
