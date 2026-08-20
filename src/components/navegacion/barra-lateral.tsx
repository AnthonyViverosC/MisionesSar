"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  ClipboardCheck,
  FileStack,
  PlusCircle,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Marca } from "@/components/marca/escudo";
import type { Rol } from "@/dominio/roles";
import { cn } from "@/lib/utils";

type Enlace = {
  href: string;
  etiqueta: string;
  icono: React.ComponentType<{ className?: string }>;
  /** Roles que ven el enlace. Vacío = todos. */
  roles?: Rol[];
};

const ENLACES: Enlace[] = [
  { href: "/misiones", etiqueta: "Misiones", icono: FileStack },
  {
    href: "/misiones/nueva",
    etiqueta: "Nueva misión",
    icono: PlusCircle,
    roles: ["operador", "admin"],
  },
  {
    href: "/revision",
    etiqueta: "Bandeja de revisión",
    icono: ClipboardCheck,
    roles: ["supervisor", "admin"],
  },
  { href: "/archivo", etiqueta: "Archivo", icono: Archive },
  { href: "/admin", etiqueta: "Administración", icono: ShieldCheck, roles: ["admin"] },
  { href: "/perfil", etiqueta: "Configuración", icono: Settings },
];

/**
 * Navegación principal. Reproduce la barra lateral de la referencia: azul
 * marino, ítem activo con fondo más claro y guía vertical a la izquierda.
 *
 * Ocultar un enlace es comodidad, no seguridad: cada ruta verifica el rol por
 * su cuenta y RLS lo hace de nuevo en la base de datos.
 */
export function BarraLateral({ rol }: { rol: Rol }) {
  const ruta = usePathname();
  const visibles = ENLACES.filter((enlace) => !enlace.roles || enlace.roles.includes(rol));

  return (
    <nav
      aria-label="Navegación principal"
      className="flex h-full w-60 shrink-0 flex-col bg-marina-900"
    >
      <div className="px-5 py-6">
        <Link href="/" className="block rounded-md focus-visible:outline-white">
          <Marca tamano={38} />
        </Link>
      </div>

      <ul className="flex flex-1 flex-col gap-0.5 px-2">
        {visibles.map((enlace) => {
          const activo =
            ruta === enlace.href ||
            (enlace.href !== "/misiones/nueva" && ruta.startsWith(`${enlace.href}/`));
          const Icono = enlace.icono;

          return (
            <li key={enlace.href}>
              <Link
                href={enlace.href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                  activo
                    ? "bg-marina-800 font-medium text-white"
                    : "text-marina-400 hover:bg-marina-800/60 hover:text-white",
                )}
              >
                {activo ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-white"
                  />
                ) : null}
                <Icono className="size-4 shrink-0" />
                {enlace.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
