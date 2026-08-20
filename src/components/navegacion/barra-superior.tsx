"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CircleHelp, LogOut, Search, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ETIQUETA_ROL, type Rol } from "@/dominio/roles";

/** Iniciales del nombre, para el avatar. */
function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

export function BarraSuperior({
  nombre,
  correo,
  rol,
  unidad,
  notificacionesSinLeer,
}: {
  nombre: string;
  correo: string;
  rol: Rol;
  unidad: string | null;
  notificacionesSinLeer: number;
}) {
  const router = useRouter();

  function buscar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const consulta = String(datos.get("q") ?? "").trim();
    router.push(consulta ? `/misiones?q=${encodeURIComponent(consulta)}` : "/misiones");
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-borde bg-card px-4 sm:px-6">
      <form onSubmit={buscar} className="relative w-full max-w-md" role="search">
        <label htmlFor="busqueda" className="sr-only">
          Buscar misiones
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-suave"
          aria-hidden
        />
        <Input
          id="busqueda"
          name="q"
          type="search"
          placeholder="Buscar misiones, IDs o personal…"
          className="pl-9"
        />
      </form>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/notificaciones" className="relative">
            <Bell className="size-5" aria-hidden />
            <span className="sr-only">
              Notificaciones{notificacionesSinLeer > 0 ? ` (${notificacionesSinLeer} sin leer)` : ""}
            </span>
            {notificacionesSinLeer > 0 ? (
              <span
                aria-hidden
                className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-estado-rojo text-[10px] font-semibold text-white"
              >
                {notificacionesSinLeer > 9 ? "9+" : notificacionesSinLeer}
              </span>
            ) : null}
          </Link>
        </Button>

        <Button variant="ghost" size="icon" asChild>
          <Link href="/ayuda">
            <CircleHelp className="size-5" aria-hidden />
            <span className="sr-only">Ayuda</span>
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Cuenta de ${nombre}`}>
              <Avatar className="size-8">
                <AvatarFallback className="bg-marina-900 text-xs text-white">
                  {iniciales(nombre)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="space-y-0.5">
              <p className="text-sm font-medium text-texto">{nombre}</p>
              <p className="text-xs font-normal text-texto-suave">{correo}</p>
              <p className="text-xs font-normal text-texto-suave">
                {ETIQUETA_ROL[rol]}
                {unidad ? ` · ${unidad}` : ""}
              </p>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href="/perfil">
                <UserRound className="size-4" aria-hidden />
                Mi perfil
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              {/* Cerrar sesión va por POST: un GET podría dispararse desde otra página. */}
              <form action="/auth/cerrar" method="post" className="w-full">
                <button type="submit" className="flex w-full items-center gap-2">
                  <LogOut className="size-4" aria-hidden />
                  Cerrar sesión
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
