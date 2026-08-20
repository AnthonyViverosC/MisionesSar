/**
 * Semilla de datos de prueba.
 *
 *   pnpm db:seed
 *
 * Crea los catálogos, cuatro cuentas operativas (una por rol) más un operador
 * de otra unidad —necesario para comprobar que el aislamiento por unidad
 * funciona— y cinco misiones en distintos estados, con sus archivos subidos de
 * verdad a los buckets.
 *
 * Es idempotente: se puede ejecutar varias veces. Lo ya creado se reutiliza.
 *
 * Usa la clave de servicio, así que salta RLS: es un script de administración,
 * no forma parte de la aplicación.
 */

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config as cargarEntorno } from "dotenv";
import type { Database, FilaMision, TipoDocumento } from "../../src/tipos/basedatos";
import { generarMp4, generarPdf, generarPng } from "./archivos-sinteticos";

cargarEntorno({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE_SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLAVE_USUARIOS = process.env.PRUEBAS_CLAVE_USUARIOS ?? "Sar.Pruebas.2026!";

if (!URL || !CLAVE_SERVICIO) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.",
  );
  process.exit(1);
}

const db = createClient<Database>(URL, CLAVE_SERVICIO, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ANIO = new Date().getFullYear();

// -----------------------------------------------------------------------------
// Catálogos
// -----------------------------------------------------------------------------

const UNIDADES = [
  { codigo: "BRIG7", nombre: "VII Brigada Aérea" },
  { codigo: "GASUR", nombre: "Grupo Aéreo del Sur" },
];

const TIPOS_MISION = [
  { codigo: "BUSQUEDA", nombre: "Búsqueda", orden: 1 },
  { codigo: "RESCATE", nombre: "Rescate", orden: 2 },
  { codigo: "TRASLADO", nombre: "Traslado", orden: 3 },
  { codigo: "EVACUACION", nombre: "Evacuación aeromédica", orden: 4 },
];

const AERONAVES = [
  { matricula: "FAC-4501", tipo: "Helicóptero UH-60", unidad: "BRIG7" },
  { matricula: "FAC-4502", tipo: "Helicóptero Bell 212", unidad: "BRIG7" },
  { matricula: "FAC-1201", tipo: "Avión C-208 Caravan", unidad: "GASUR" },
];

// -----------------------------------------------------------------------------
// Cuentas de prueba
// -----------------------------------------------------------------------------

const USUARIOS = [
  {
    correo: "admin@sar.mil.co",
    nombre_completo: "Ana María Restrepo",
    documento_identidad: "1010101010",
    grado: "Mayor",
    rol: "admin" as const,
    unidad: null,
  },
  {
    correo: "operador@sar.mil.co",
    nombre_completo: "Carlos Andrés Peña",
    documento_identidad: "2020202020",
    grado: "Teniente",
    rol: "operador" as const,
    unidad: "BRIG7",
  },
  {
    correo: "supervisor@sar.mil.co",
    nombre_completo: "Lucía Fernanda Gómez",
    documento_identidad: "3030303030",
    grado: "Capitán",
    rol: "supervisor" as const,
    unidad: "BRIG7",
  },
  {
    correo: "consulta@sar.mil.co",
    nombre_completo: "Jorge Iván Salazar",
    documento_identidad: "4040404040",
    grado: "Sargento",
    rol: "consulta" as const,
    unidad: null,
  },
  {
    // Sirve para verificar que un operador no ve misiones de otra unidad.
    correo: "operador.sur@sar.mil.co",
    nombre_completo: "Diana Patricia Ríos",
    documento_identidad: "5050505050",
    grado: "Teniente",
    rol: "operador" as const,
    unidad: "GASUR",
  },
];

// -----------------------------------------------------------------------------
// Misiones de ejemplo
// -----------------------------------------------------------------------------

type EstadoSemilla = "borrador" | "enviada" | "observada" | "aprobada" | "anulada";

const MISIONES: {
  numero: string;
  estado: EstadoSemilla;
  tipo: string;
  aeronave: string;
  unidad: string;
  fecha_inicio: string;
  fecha_fin: string;
  comandante: string;
  zona: string;
  horas: number;
  resumen: string;
  /** Cuántos archivos cargar. Los estados distintos de borrador exigen los 8. */
  archivos: number;
}[] = [
  {
    numero: `${ANIO}-001`,
    estado: "borrador",
    tipo: "BUSQUEDA",
    aeronave: "FAC-4501",
    unidad: "BRIG7",
    fecha_inicio: `${ANIO}-05-12`,
    fecha_fin: `${ANIO}-05-12`,
    comandante: "Teniente Carlos Andrés Peña",
    zona: "Serranía de los Yariguíes, Santander",
    horas: 3.5,
    resumen: "Búsqueda de aeronave civil reportada como desaparecida.",
    archivos: 1,
  },
  {
    numero: `${ANIO}-002`,
    estado: "enviada",
    tipo: "RESCATE",
    aeronave: "FAC-4502",
    unidad: "BRIG7",
    fecha_inicio: `${ANIO}-05-10`,
    fecha_fin: `${ANIO}-05-11`,
    comandante: "Teniente Carlos Andrés Peña",
    zona: "Páramo de Sumapaz, Cundinamarca",
    horas: 6.2,
    resumen: "Rescate de dos excursionistas con hipotermia.",
    archivos: 8,
  },
  {
    numero: `${ANIO}-003`,
    estado: "observada",
    tipo: "TRASLADO",
    aeronave: "FAC-4501",
    unidad: "BRIG7",
    fecha_inicio: `${ANIO}-05-08`,
    fecha_fin: `${ANIO}-05-08`,
    comandante: "Teniente Carlos Andrés Peña",
    zona: "Corredor Villavicencio – Bogotá",
    horas: 2.1,
    resumen: "Traslado de paciente crítico a centro de tercer nivel.",
    archivos: 8,
  },
  {
    numero: `${ANIO}-004`,
    estado: "aprobada",
    tipo: "EVACUACION",
    aeronave: "FAC-4502",
    unidad: "BRIG7",
    fecha_inicio: `${ANIO}-04-28`,
    fecha_fin: `${ANIO}-04-28`,
    comandante: "Capitán Lucía Fernanda Gómez",
    zona: "Río Guaviare, sector El Retorno",
    horas: 4.8,
    resumen: "Evacuación aeromédica de tres heridos por accidente fluvial.",
    archivos: 8,
  },
  {
    numero: `${ANIO}-005`,
    estado: "anulada",
    tipo: "BUSQUEDA",
    aeronave: "FAC-4501",
    unidad: "BRIG7",
    fecha_inicio: `${ANIO}-04-20`,
    fecha_fin: `${ANIO}-04-20`,
    comandante: "Teniente Carlos Andrés Peña",
    zona: "Embalse del Neusa, Cundinamarca",
    horas: 1.4,
    resumen: "Salida cancelada por condiciones meteorológicas.",
    archivos: 2,
  },
];

/** Los ocho archivos de una misión completa, en orden de carga. */
const ARCHIVOS: { tipo: TipoDocumento; nombre: string }[] = [
  { tipo: "orden_vuelo", nombre: "orden-de-vuelo.pdf" },
  { tipo: "orden_fragmentaria", nombre: "orden-fragmentaria.pdf" },
  { tipo: "requerimiento_mision", nombre: "requerimiento-de-mision.pdf" },
  { tipo: "formulario_mision_cumplida", nombre: "formulario-mision-cumplida.pdf" },
  { tipo: "certificado_consumo", nombre: "certificado-de-consumo.pdf" },
  { tipo: "foto", nombre: "registro-1.png" },
  { tipo: "foto", nombre: "registro-2.png" },
  { tipo: "video", nombre: "sobrevuelo.mp4" },
];

// -----------------------------------------------------------------------------

async function sembrar() {
  console.log("Sembrando datos de prueba…\n");

  // --- Catálogos ---
  const unidades = new Map<string, string>();
  for (const unidad of UNIDADES) {
    const { data, error } = await db
      .from("unidades")
      .upsert({ codigo: unidad.codigo, nombre: unidad.nombre }, { onConflict: "codigo" })
      .select("id, codigo")
      .single();
    if (error) throw error;
    unidades.set(data.codigo, data.id);
  }
  console.log(`  Unidades: ${unidades.size}`);

  const tipos = new Map<string, string>();
  for (const tipo of TIPOS_MISION) {
    const { data, error } = await db
      .from("tipos_mision")
      .upsert(
        { codigo: tipo.codigo, nombre: tipo.nombre, orden: tipo.orden },
        { onConflict: "codigo" },
      )
      .select("id, codigo")
      .single();
    if (error) throw error;
    tipos.set(data.codigo, data.id);
  }
  console.log(`  Tipos de misión: ${tipos.size}`);

  const aeronaves = new Map<string, string>();
  for (const aeronave of AERONAVES) {
    const { data, error } = await db
      .from("aeronaves")
      .upsert(
        {
          matricula: aeronave.matricula,
          tipo: aeronave.tipo,
          unidad_id: unidades.get(aeronave.unidad)!,
        },
        { onConflict: "matricula" },
      )
      .select("id, matricula")
      .single();
    if (error) throw error;
    aeronaves.set(data.matricula, data.id);
  }
  console.log(`  Aeronaves: ${aeronaves.size}`);

  // --- Cuentas ---
  const usuarios = new Map<string, string>();
  for (const usuario of USUARIOS) {
    const id = await crearUsuario(usuario, unidades);
    usuarios.set(usuario.correo, id);
  }
  console.log(`  Cuentas: ${usuarios.size}`);

  // --- Misiones ---
  const operador = usuarios.get("operador@sar.mil.co")!;
  const supervisor = usuarios.get("supervisor@sar.mil.co")!;
  const admin = usuarios.get("admin@sar.mil.co")!;

  for (const plantilla of MISIONES) {
    const { data: existente } = await db
      .from("misiones")
      .select("id")
      .eq("anio", ANIO)
      .eq("numero_mision", plantilla.numero)
      .maybeSingle();

    if (existente) {
      console.log(`  Misión ${plantilla.numero}: ya existía, se conserva`);
      continue;
    }

    const { data: mision, error } = await db
      .from("misiones")
      .insert({
        numero_mision: plantilla.numero,
        fecha_inicio: plantilla.fecha_inicio,
        fecha_fin: plantilla.fecha_fin,
        tipo_mision_id: tipos.get(plantilla.tipo)!,
        aeronave_id: aeronaves.get(plantilla.aeronave)!,
        unidad_id: unidades.get(plantilla.unidad)!,
        comandante_aeronave: plantilla.comandante,
        zona_operacion: plantilla.zona,
        horas_vuelo: plantilla.horas,
        resumen: plantilla.resumen,
        creada_por: operador,
      })
      .select("id")
      .single();
    if (error) throw error;

    for (const archivo of ARCHIVOS.slice(0, plantilla.archivos)) {
      await subirDocumento(mision.id, archivo.tipo, archivo.nombre, plantilla.numero, operador);
    }

    await llevarAlEstado(mision.id, plantilla, supervisor, admin);
    console.log(
      `  Misión ${plantilla.numero}: ${plantilla.estado}, ${plantilla.archivos} de 8 archivos`,
    );
  }

  console.log("\nListo.");
  console.log("\nCuentas de prueba (contraseña común):");
  console.log(`  contraseña: ${CLAVE_USUARIOS}`);
  for (const usuario of USUARIOS) {
    console.log(`  ${usuario.rol.padEnd(10)} ${usuario.correo}`);
  }
  console.log("\nEl ingreso es con correo y contraseña, sin verificación adicional.");
}

/** Crea la cuenta si no existe y deja el perfil listo para entrar. */
async function crearUsuario(
  usuario: (typeof USUARIOS)[number],
  unidades: Map<string, string>,
): Promise<string> {
  const { data: existentes } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const encontrado = existentes?.users.find((u) => u.email === usuario.correo);

  let id = encontrado?.id;

  if (!id) {
    const { data, error } = await db.auth.admin.createUser({
      email: usuario.correo,
      password: CLAVE_USUARIOS,
      email_confirm: true,
      user_metadata: {
        nombre_completo: usuario.nombre_completo,
        documento_identidad: usuario.documento_identidad,
        grado: usuario.grado,
        rol: usuario.rol,
        unidad_id: usuario.unidad ? unidades.get(usuario.unidad) : null,
      },
    });
    if (error) throw error;
    id = data.user.id;
  }

  // El trigger crea el perfil con los metadatos; aquí se confirma el rol y se
  // saltan las obligaciones de primer ingreso, que en pruebas solo estorban.
  const { error } = await db
    .from("perfiles")
    .update({
      nombre_completo: usuario.nombre_completo,
      documento_identidad: usuario.documento_identidad,
      grado: usuario.grado,
      rol: usuario.rol,
      unidad_id: usuario.unidad ? unidades.get(usuario.unidad)! : null,
      debe_cambiar_clave: false,
      aviso_aceptado_en: new Date().toISOString(),
      activo: true,
    })
    .eq("id", id);
  if (error) throw error;

  return id;
}

/** Genera el archivo, lo sube al bucket y registra el documento. */
async function subirDocumento(
  misionId: string,
  tipo: TipoDocumento,
  nombreOriginal: string,
  numeroMision: string,
  subidoPor: string,
) {
  let contenido: Buffer;
  let mime: string;

  if (tipo === "foto") {
    contenido = generarPng();
    mime = "image/png";
  } else if (tipo === "video") {
    contenido = generarMp4();
    mime = "video/mp4";
  } else {
    contenido = generarPdf(`Misión ${numeroMision}`, [
      `Soporte: ${nombreOriginal}`,
      "Documento de ejemplo generado por la semilla de desarrollo.",
      "No corresponde a una operación real.",
    ]);
    mime = "application/pdf";
  }

  const bucket = tipo === "foto" || tipo === "video" ? "archivo-filmico" : "documentos-pdf";
  const extension = nombreOriginal.slice(nombreOriginal.lastIndexOf("."));
  const ruta = `${misionId}/${tipo}/${crypto.randomUUID()}${extension}`;

  const { error: errorSubida } = await db.storage
    .from(bucket)
    .upload(ruta, contenido, { contentType: mime, upsert: false });
  if (errorSubida) throw errorSubida;

  const { error } = await db.from("documentos").insert({
    mision_id: misionId,
    tipo,
    nombre_original: nombreOriginal,
    ruta_almacenamiento: ruta,
    bucket,
    mime_type: mime,
    tamano_bytes: contenido.byteLength,
    hash_sha256: createHash("sha256").update(contenido).digest("hex"),
    subido_por: subidoPor,
  });
  if (error) throw error;
}

/** Recorre el flujo de estados hasta dejar la misión donde corresponde. */
async function llevarAlEstado(
  misionId: string,
  plantilla: (typeof MISIONES)[number],
  supervisor: string,
  admin: string,
) {
  const mover = async (campos: Partial<FilaMision>) => {
    const { error } = await db.from("misiones").update(campos).eq("id", misionId);
    if (error) throw error;
  };

  switch (plantilla.estado) {
    case "borrador":
      return;

    case "enviada":
      await mover({ estado: "enviada" });
      return;

    case "observada":
      await mover({ estado: "enviada" });
      // Devolver exige una observación escrita previa.
      await db.from("observaciones").insert({
        mision_id: misionId,
        autor_id: supervisor,
        texto:
          "El certificado de consumo no coincide con las horas de vuelo reportadas. " +
          "Corrija el soporte y vuelva a enviar la misión.",
      });
      await mover({ estado: "observada", revisada_por: supervisor });
      return;

    case "aprobada":
      await mover({ estado: "enviada" });
      await mover({ estado: "en_revision", revisada_por: supervisor });
      await mover({ estado: "aprobada", revisada_por: supervisor });
      return;

    case "anulada":
      await mover({
        estado: "anulada",
        motivo_anulacion:
          "Salida cancelada antes del despegue por condiciones meteorológicas adversas.",
        anulada_por: admin,
      });
      return;
  }
}

sembrar().catch((error) => {
  console.error("\nLa semilla falló:", error.message ?? error);
  process.exit(1);
});
