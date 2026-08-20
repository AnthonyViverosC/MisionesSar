import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Sha256, sha256, sha256DeArchivo } from "@/lib/archivos/sha256";

/**
 * El hash se guarda con cada documento y se usa para detectar duplicados y para
 * probar integridad, así que tiene que coincidir exactamente con el que calcula
 * cualquier otra herramienta. Se contrasta contra los vectores oficiales y
 * contra la implementación de Node.
 */

describe("vectores conocidos", () => {
  it("cadena vacía", () => {
    expect(sha256("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it('"abc"', () => {
    expect(sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("mensaje de 448 bits (dos bloques)", () => {
    expect(sha256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });

  it("un millón de letras a", () => {
    const calculo = new Sha256();
    const bloque = new TextEncoder().encode("a".repeat(1000));
    for (let i = 0; i < 1000; i += 1) calculo.actualizar(bloque);

    expect(calculo.finalizar()).toBe(
      "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
    );
  });
});

describe("coincidencia con Node", () => {
  it("mismo resultado sobre datos aleatorios de varios tamaños", () => {
    for (const tamano of [1, 55, 56, 63, 64, 65, 127, 1024, 100_000]) {
      const datos = randomBytes(tamano);
      const esperado = createHash("sha256").update(datos).digest("hex");
      expect(sha256(new Uint8Array(datos)), `tamaño ${tamano}`).toBe(esperado);
    }
  });

  it("el resultado no depende de cómo se fragmente la entrada", () => {
    const datos = randomBytes(10_000);
    const esperado = createHash("sha256").update(datos).digest("hex");

    const calculo = new Sha256();
    let posicion = 0;
    // Fragmentos de tamaño irregular, como los que llegan al leer un archivo.
    for (const trozo of [1, 63, 64, 65, 200, 1000, 3000]) {
      calculo.actualizar(new Uint8Array(datos.subarray(posicion, posicion + trozo)));
      posicion += trozo;
    }
    calculo.actualizar(new Uint8Array(datos.subarray(posicion)));

    expect(calculo.finalizar()).toBe(esperado);
  });
});

describe("archivos", () => {
  it("calcula el hash de un Blob leyéndolo por partes", async () => {
    const datos = randomBytes(5 * 1024 * 1024 + 123); // supera el bloque de lectura
    const esperado = createHash("sha256").update(datos).digest("hex");
    const blob = new Blob([new Uint8Array(datos)]);

    const fracciones: number[] = [];
    const obtenido = await sha256DeArchivo(blob, (fraccion) => fracciones.push(fraccion));

    expect(obtenido).toBe(esperado);
    expect(fracciones.at(-1)).toBe(1);
    expect(fracciones.length).toBeGreaterThan(1);
  });
});
