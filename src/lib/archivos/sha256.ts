/**
 * SHA-256 incremental.
 *
 * `crypto.subtle.digest` exige el archivo entero en memoria, y aquí hay videos
 * de hasta 500 MB que se suben desde una tablet. Esta implementación procesa el
 * archivo por bloques de 4 MB, así que la memoria usada no depende del tamaño.
 *
 * El hash se guarda con el documento: sirve para detectar duplicados y para
 * probar que el archivo descargado es el mismo que se subió.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (valor: number, bits: number) => (valor >>> bits) | (valor << (32 - bits));

/** Estado de un cálculo de SHA-256 en curso. */
export class Sha256 {
  private estado = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
    0x5be0cd19,
  ]);
  private pendiente = new Uint8Array(64);
  private bytesPendientes = 0;
  private longitudTotal = 0;
  private bloque = new Uint32Array(64);

  /** Añade un fragmento al cálculo. Se puede llamar tantas veces como haga falta. */
  actualizar(datos: Uint8Array): void {
    this.longitudTotal += datos.length;
    let posicion = 0;

    // Completa el bloque a medias que hubiera quedado del fragmento anterior.
    if (this.bytesPendientes > 0) {
      const faltan = Math.min(64 - this.bytesPendientes, datos.length);
      this.pendiente.set(datos.subarray(0, faltan), this.bytesPendientes);
      this.bytesPendientes += faltan;
      posicion = faltan;

      if (this.bytesPendientes === 64) {
        this.procesar(this.pendiente, 0);
        this.bytesPendientes = 0;
      }
    }

    // Procesa los bloques completos directamente sobre el fragmento.
    while (posicion + 64 <= datos.length) {
      this.procesar(datos, posicion);
      posicion += 64;
    }

    // Guarda el resto para la próxima llamada.
    if (posicion < datos.length) {
      this.pendiente.set(datos.subarray(posicion), 0);
      this.bytesPendientes = datos.length - posicion;
    }
  }

  /** Cierra el cálculo y devuelve el hash en hexadecimal. */
  finalizar(): string {
    const longitudBits = this.longitudTotal * 8;
    const relleno = new Uint8Array(this.bytesPendientes < 56 ? 64 : 128);
    relleno.set(this.pendiente.subarray(0, this.bytesPendientes));
    relleno[this.bytesPendientes] = 0x80;

    // La longitud va en los últimos 8 bytes, big-endian.
    const vista = new DataView(relleno.buffer);
    vista.setUint32(relleno.length - 8, Math.floor(longitudBits / 0x100000000), false);
    vista.setUint32(relleno.length - 4, longitudBits >>> 0, false);

    for (let posicion = 0; posicion < relleno.length; posicion += 64) {
      this.procesar(relleno, posicion);
    }

    return Array.from(this.estado)
      .map((palabra) => palabra.toString(16).padStart(8, "0"))
      .join("");
  }

  private procesar(datos: Uint8Array, desplazamiento: number): void {
    const w = this.bloque;

    for (let i = 0; i < 16; i += 1) {
      const base = desplazamiento + i * 4;
      w[i] =
        ((datos[base] << 24) |
          (datos[base + 1] << 16) |
          (datos[base + 2] << 8) |
          datos[base + 3]) >>>
        0;
    }

    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = this.estado;

    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    this.estado[0] = (this.estado[0] + a) >>> 0;
    this.estado[1] = (this.estado[1] + b) >>> 0;
    this.estado[2] = (this.estado[2] + c) >>> 0;
    this.estado[3] = (this.estado[3] + d) >>> 0;
    this.estado[4] = (this.estado[4] + e) >>> 0;
    this.estado[5] = (this.estado[5] + f) >>> 0;
    this.estado[6] = (this.estado[6] + g) >>> 0;
    this.estado[7] = (this.estado[7] + h) >>> 0;
  }
}

/** SHA-256 de un texto o de un búfer, en un solo paso. */
export function sha256(datos: Uint8Array | string): string {
  const bytes = typeof datos === "string" ? new TextEncoder().encode(datos) : datos;
  const calculo = new Sha256();
  calculo.actualizar(bytes);
  return calculo.finalizar();
}

/** Tamaño de bloque de lectura: 4 MB mantiene la memoria acotada. */
const BLOQUE = 4 * 1024 * 1024;

/**
 * SHA-256 de un archivo, leyéndolo por partes.
 * `alProgresar` recibe la fracción leída, entre 0 y 1.
 */
export async function sha256DeArchivo(
  archivo: File | Blob,
  alProgresar?: (fraccion: number) => void,
): Promise<string> {
  const calculo = new Sha256();
  let leidos = 0;

  while (leidos < archivo.size) {
    const parte = archivo.slice(leidos, Math.min(leidos + BLOQUE, archivo.size));
    const buffer = await parte.arrayBuffer();
    calculo.actualizar(new Uint8Array(buffer));
    leidos += buffer.byteLength;
    alProgresar?.(leidos / archivo.size);
  }

  return calculo.finalizar();
}
