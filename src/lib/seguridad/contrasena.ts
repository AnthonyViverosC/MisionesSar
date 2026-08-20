import { z } from "zod";

/**
 * Reglas de contraseña.
 *
 * Mínimo doce caracteres y comprobación contra la base de contraseñas filtradas
 * de Have I Been Pwned. La consulta usa k-anonymity: se envían los cinco
 * primeros caracteres del SHA-1 y el servicio devuelve todos los sufijos que
 * empiezan así, de modo que nunca sale de aquí la contraseña ni su hash
 * completo.
 */

export const LONGITUD_MINIMA = 12;

export const esquemaContrasena = z
  .string()
  .min(LONGITUD_MINIMA, `La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`)
  .max(128, "La contraseña no puede superar los 128 caracteres.")
  .refine((valor) => !/^\s|\s$/.test(valor), "La contraseña no puede empezar ni terminar con espacios.");

/** Calcula el SHA-1 en hexadecimal y en mayúsculas, formato que espera el servicio. */
async function sha1(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const resumen = await crypto.subtle.digest("SHA-1", datos);
  return Array.from(new Uint8Array(resumen))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export type ResultadoFiltracion =
  | { filtrada: true; apariciones: number }
  | { filtrada: false }
  | { filtrada: "desconocido" };

/**
 * Consulta si la contraseña aparece en filtraciones conocidas.
 *
 * Si el servicio no responde se devuelve "desconocido": una caída de un tercero
 * no puede impedir que alguien cambie su contraseña, pero tampoco se afirma que
 * sea segura.
 */
export async function verificarFiltracion(contrasena: string): Promise<ResultadoFiltracion> {
  try {
    const hash = await sha1(contrasena);
    const prefijo = hash.slice(0, 5);
    const sufijo = hash.slice(5);

    const respuesta = await fetch(`https://api.pwnedpasswords.com/range/${prefijo}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(4000),
    });

    if (!respuesta.ok) return { filtrada: "desconocido" };

    const cuerpo = await respuesta.text();

    for (const linea of cuerpo.split("\n")) {
      const [sufijoDevuelto, conteo] = linea.trim().split(":");
      if (sufijoDevuelto === sufijo) {
        const apariciones = Number(conteo);
        // Con "Add-Padding" el servicio incluye registros de relleno con conteo 0.
        if (apariciones > 0) return { filtrada: true, apariciones };
      }
    }

    return { filtrada: false };
  } catch {
    return { filtrada: "desconocido" };
  }
}

/** Mensaje para el usuario cuando la contraseña aparece en filtraciones. */
export function mensajeFiltracion(apariciones: number): string {
  return (
    `Esta contraseña aparece en ${apariciones.toLocaleString("es-CO")} filtraciones públicas. ` +
    "Elige otra que no hayas usado en ningún otro servicio."
  );
}
