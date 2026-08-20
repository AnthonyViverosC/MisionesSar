"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ETIQUETA_ROL, ROLES } from "@/dominio/roles";

const TODOS = "todos";

/** Filtros del listado de cuentas. Viven en la URL, como los de misiones. */
export function FiltrosUsuarios() {
  const router = useRouter();
  const parametros = useSearchParams();
  const [pendiente, iniciarTransicion] = useTransition();

  function aplicar(clave: string, valor: string | null) {
    const nuevos = new URLSearchParams(parametros.toString());

    if (!valor || valor === TODOS) {
      nuevos.delete(clave);
    } else {
      nuevos.set(clave, valor);
    }

    iniciarTransicion(() => router.push(`/admin/usuarios?${nuevos.toString()}`));
  }

  const hayFiltros = Array.from(parametros.keys()).length > 0;

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-borde px-4 py-3">
      <div className="space-y-1.5">
        <Label htmlFor="filtro-rol" className="text-xs text-texto-suave">
          Rol
        </Label>
        <Select
          value={parametros.get("rol") ?? TODOS}
          onValueChange={(valor) => aplicar("rol", valor)}
        >
          <SelectTrigger id="filtro-rol" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los roles</SelectItem>
            {ROLES.map((rol) => (
              <SelectItem key={rol} value={rol}>
                {ETIQUETA_ROL[rol]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filtro-estado-cuenta" className="text-xs text-texto-suave">
          Estado
        </Label>
        <Select
          value={parametros.get("estado") ?? TODOS}
          onValueChange={(valor) => aplicar("estado", valor)}
        >
          <SelectTrigger id="filtro-estado-cuenta" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas</SelectItem>
            <SelectItem value="activo">Activas</SelectItem>
            <SelectItem value="inactivo">Desactivadas</SelectItem>
            <SelectItem value="pendiente">Sin estrenar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filtro-persona" className="text-xs text-texto-suave">
          Nombre o documento
        </Label>
        <Input
          id="filtro-persona"
          defaultValue={parametros.get("q") ?? ""}
          placeholder="Buscar…"
          className="w-56"
          onChange={(evento) => aplicar("q", evento.target.value.trim())}
        />
      </div>

      {hayFiltros ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => iniciarTransicion(() => router.push("/admin/usuarios"))}
        >
          <X className="size-4" aria-hidden />
          Limpiar
        </Button>
      ) : null}

      <p className="ml-auto text-xs text-texto-suave" aria-live="polite">
        {pendiente ? "Actualizando…" : null}
      </p>
    </div>
  );
}
