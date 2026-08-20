/**
 * Los seis soportes obligatorios de una misión y sus reglas de archivo.
 *
 * Una misión completa son 8 archivos: cinco PDF, dos fotos y un video. La
 * interfaz muestra los seis bloques numerados de la referencia visual, y el
 * indicador de completitud cuenta archivos ("5 de 8 archivos"), que es lo que
 * de verdad describe si falta algo dentro del archivo fílmico.
 */

export const TIPOS_DOCUMENTO = [
  "orden_vuelo",
  "orden_fragmentaria",
  "requerimiento_mision",
  "formulario_mision_cumplida",
  "certificado_consumo",
  "foto",
  "video",
] as const;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

/** Bucket privado en el que vive cada tipo. */
export type Bucket = "documentos-pdf" | "archivo-filmico";

export const BUCKET_PDF: Bucket = "documentos-pdf";
export const BUCKET_FILMICO: Bucket = "archivo-filmico";

const MB = 1024 * 1024;

export type ReglaDocumento = {
  tipo: TipoDocumento;
  etiqueta: string;
  /** Cuántos archivos vigentes admite este tipo. */
  cantidad: number;
  bucket: Bucket;
  /** Tipos MIME aceptados. Se verifican además por magic bytes. */
  mimes: readonly string[];
  extensiones: readonly string[];
  tamanoMaximo: number;
  /** Texto de ayuda bajo el título del bloque. */
  formatoLegible: string;
};

export const REGLAS_DOCUMENTO: Record<TipoDocumento, ReglaDocumento> = {
  orden_vuelo: {
    tipo: "orden_vuelo",
    etiqueta: "Orden de vuelo",
    cantidad: 1,
    bucket: BUCKET_PDF,
    mimes: ["application/pdf"],
    extensiones: [".pdf"],
    tamanoMaximo: 20 * MB,
    formatoLegible: "PDF",
  },
  orden_fragmentaria: {
    tipo: "orden_fragmentaria",
    etiqueta: "Orden fragmentaria",
    cantidad: 1,
    bucket: BUCKET_PDF,
    mimes: ["application/pdf"],
    extensiones: [".pdf"],
    tamanoMaximo: 20 * MB,
    formatoLegible: "PDF",
  },
  requerimiento_mision: {
    tipo: "requerimiento_mision",
    etiqueta: "Requerimiento de misión",
    cantidad: 1,
    bucket: BUCKET_PDF,
    mimes: ["application/pdf"],
    extensiones: [".pdf"],
    tamanoMaximo: 20 * MB,
    formatoLegible: "PDF",
  },
  formulario_mision_cumplida: {
    tipo: "formulario_mision_cumplida",
    etiqueta: "Formulario de misión cumplida",
    cantidad: 1,
    bucket: BUCKET_PDF,
    mimes: ["application/pdf"],
    extensiones: [".pdf"],
    tamanoMaximo: 20 * MB,
    formatoLegible: "PDF",
  },
  certificado_consumo: {
    tipo: "certificado_consumo",
    etiqueta: "Certificado de consumo",
    cantidad: 1,
    bucket: BUCKET_PDF,
    mimes: ["application/pdf"],
    extensiones: [".pdf"],
    tamanoMaximo: 20 * MB,
    formatoLegible: "PDF",
  },
  foto: {
    tipo: "foto",
    etiqueta: "Fotografías",
    cantidad: 2,
    bucket: BUCKET_FILMICO,
    mimes: ["image/jpeg", "image/png"],
    extensiones: [".jpg", ".jpeg", ".png"],
    tamanoMaximo: 10 * MB,
    formatoLegible: "JPG o PNG",
  },
  video: {
    tipo: "video",
    etiqueta: "Video",
    cantidad: 1,
    bucket: BUCKET_FILMICO,
    mimes: ["video/mp4"],
    extensiones: [".mp4"],
    tamanoMaximo: 500 * MB,
    formatoLegible: "MP4",
  },
};

/** Los cinco soportes que son un único PDF. */
export const TIPOS_PDF = [
  "orden_vuelo",
  "orden_fragmentaria",
  "requerimiento_mision",
  "formulario_mision_cumplida",
  "certificado_consumo",
] as const satisfies readonly TipoDocumento[];

/**
 * Los seis bloques de la pantalla de carga, en el orden de la referencia.
 * El sexto agrupa fotos y video bajo "Archivo fílmico".
 */
export const BLOQUES_CARGA = [
  { numero: 1, titulo: "Orden de vuelo", tipos: ["orden_vuelo"] },
  { numero: 2, titulo: "Orden fragmentaria", tipos: ["orden_fragmentaria"] },
  { numero: 3, titulo: "Requerimiento de misión", tipos: ["requerimiento_mision"] },
  {
    numero: 4,
    titulo: "Formulario de misión cumplida",
    tipos: ["formulario_mision_cumplida"],
  },
  { numero: 5, titulo: "Certificado de consumo", tipos: ["certificado_consumo"] },
  { numero: 6, titulo: "Archivo fílmico", tipos: ["foto", "video"] },
] as const satisfies readonly {
  numero: number;
  titulo: string;
  tipos: readonly TipoDocumento[];
}[];

/** Total de archivos de una misión completa: 5 + 2 + 1 = 8. */
export const TOTAL_ARCHIVOS = TIPOS_DOCUMENTO.reduce(
  (suma, tipo) => suma + REGLAS_DOCUMENTO[tipo].cantidad,
  0,
);

/**
 * Firmas de archivo (magic bytes) por tipo MIME.
 * El navegador declara el MIME que quiera y la extensión se renombra en un
 * segundo: lo único confiable es leer los primeros bytes.
 */
export const FIRMAS: Record<string, { offset: number; bytes: number[] }[]> = {
  // %PDF
  "application/pdf": [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }],
  // JPEG: FF D8 FF
  "image/jpeg": [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  "image/png": [
    { offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  ],
  // MP4 / ISO BMFF: en el offset 4 aparece "ftyp"
  "video/mp4": [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }],
};

/** Verifica una cabecera de archivo contra las firmas del MIME esperado. */
export function coincideFirma(cabecera: Uint8Array, mime: string): boolean {
  const firmas = FIRMAS[mime];
  if (!firmas) return false;

  return firmas.some(({ offset, bytes }) =>
    bytes.every((byte, indice) => cabecera[offset + indice] === byte),
  );
}

/** Cuántos bytes hay que leer para poder comprobar cualquiera de las firmas. */
export const BYTES_CABECERA = 16;

/** Formatea un tamaño en bytes para mostrarlo al usuario. */
export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / (1024 * MB)).toFixed(2)} GB`;
}
