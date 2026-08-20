/**
 * Generadores de archivos de ejemplo para la semilla.
 *
 * Son archivos reales, no marcadores: pasan la validación por magic bytes y se
 * suben de verdad a los buckets, para que el entorno de desarrollo se comporte
 * como el de producción. El MP4 lleva las cajas mínimas de un contenedor ISO
 * BMFF: sirve para probar la carga, la firma y la descarga, pero no tiene pista
 * de video, así que el reproductor no mostrará imagen.
 */

/** PDF de una página con el texto indicado. Incluye tabla xref correcta. */
export function generarPdf(titulo: string, lineas: string[]): Buffer {
  const contenido = [
    "BT",
    "/F1 16 Tf",
    "72 720 Td",
    `(${escapar(titulo)}) Tj`,
    "/F1 11 Tf",
    ...lineas.flatMap((linea) => ["0 -22 Td", `(${escapar(linea)}) Tj`]),
    "ET",
  ].join("\n");

  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const desplazamientos: number[] = [];

  objetos.forEach((objeto, indice) => {
    desplazamientos.push(pdf.length);
    pdf += `${indice + 1} 0 obj\n${objeto}\nendobj\n`;
  });

  const inicioXref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  desplazamientos.forEach((desplazamiento) => {
    pdf += `${desplazamiento.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf +=
    `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${inicioXref}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

function escapar(texto: string): string {
  return texto.replace(/([\\()])/g, "\\$1");
}

/** PNG real de 1×1 píxel. */
export function generarPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk" +
      "+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
}

/** Contenedor MP4 mínimo: cajas ftyp, free y mdat. */
export function generarMp4(): Buffer {
  const caja = (tipo: string, carga: Buffer): Buffer => {
    const encabezado = Buffer.alloc(8);
    encabezado.writeUInt32BE(carga.length + 8, 0);
    encabezado.write(tipo, 4, "ascii");
    return Buffer.concat([encabezado, carga]);
  };

  const ftyp = caja(
    "ftyp",
    Buffer.concat([
      Buffer.from("isom", "ascii"), // marca mayor
      Buffer.from([0x00, 0x00, 0x02, 0x00]), // versión menor
      Buffer.from("isomiso2mp41", "ascii"), // marcas compatibles
    ]),
  );

  const free = caja("free", Buffer.alloc(0));
  const mdat = caja("mdat", Buffer.alloc(1024, 0));

  return Buffer.concat([ftyp, free, mdat]);
}
