import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad aplicadas a todas las respuestas.
 *
 * La Content-Security-Policy no se define aquí: se genera por petición en
 * `src/middleware.ts` con un nonce distinto cada vez, que es lo que permite
 * prescindir de `unsafe-inline`.
 */
const cabecerasSeguridad = [
  // Fuerza HTTPS durante dos años, incluidos subdominios.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // La aplicación nunca debe embeberse en un marco ajeno.
  { key: "X-Frame-Options", value: "DENY" },
  // Impide que el navegador adivine el tipo de contenido.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No filtra la ruta completa al navegar a otro origen.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Ninguna funcionalidad del dispositivo es necesaria.
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Aísla la ventana de otros orígenes.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  // Oculta la versión del framework en las respuestas.
  poweredByHeader: false,

  // Un error de tipos detiene la compilación: es parte del contrato de calidad,
  // no una advertencia.
  typescript: { ignoreBuildErrors: false },

  async headers() {
    return [{ source: "/:path*", headers: cabecerasSeguridad }];
  },
};

export default nextConfig;
