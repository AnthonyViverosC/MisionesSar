import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { INSTITUCION } from "@/config/institucion";
import "./globals.css";

/* Inter para toda la interfaz: alta legibilidad en tablet y a distancia. */
const fuenteInterfaz = Inter({
  subsets: ["latin"],
  variable: "--fuente-interfaz",
  display: "swap",
});

/* Serif solo para la marca y los títulos de página, como en la referencia. */
const fuenteTitulos = Source_Serif_4({
  subsets: ["latin"],
  variable: "--fuente-titulos",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: INSTITUCION.nombre,
    template: `%s · ${INSTITUCION.nombre}`,
  },
  description: `${INSTITUCION.descriptor} de ${INSTITUCION.unidadPropietaria}.`,
  // Sistema interno: no debe aparecer en buscadores.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1f3a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO" className={`${fuenteInterfaz.variable} ${fuenteTitulos.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <a href="#contenido" className="salto-contenido">
          Saltar al contenido
        </a>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
