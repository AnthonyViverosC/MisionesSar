"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PESTANAS = [
  { href: "/admin", etiqueta: "Resumen" },
  { href: "/admin/usuarios", etiqueta: "Usuarios" },
  { href: "/admin/catalogos", etiqueta: "Catálogos" },
  { href: "/admin/auditoria", etiqueta: "Auditoría" },
];

export function PestanasAdmin() {
  const ruta = usePathname();

  return (
    <nav aria-label="Secciones de administración" className="border-b border-borde">
      <ul className="flex flex-wrap gap-1">
        {PESTANAS.map((pestana) => {
          const activa =
            pestana.href === "/admin" ? ruta === "/admin" : ruta.startsWith(pestana.href);

          return (
            <li key={pestana.href}>
              <Link
                href={pestana.href}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "-mb-px block border-b-2 px-3 py-2 text-sm transition-colors",
                  activa
                    ? "border-marina-900 font-medium text-marina-900"
                    : "border-transparent text-texto-suave hover:text-texto",
                )}
              >
                {pestana.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
