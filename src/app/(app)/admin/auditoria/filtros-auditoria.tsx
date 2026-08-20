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
import {
  ACCIONES_AUDITORIA,
  ENTIDADES_AUDITORIA,
  ETIQUETA_ACCION_AUDITORIA,
  ETIQUETA_ENTIDAD,
} from "@/dominio/auditoria";

const TODOS = "todos";

export function FiltrosAuditoria() {
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

    // Cualquier cambio de filtro devuelve a la primera página.
    nuevos.delete("pagina");

    iniciarTransicion(() => router.push(`/admin/auditoria?${nuevos.toString()}`));
  }

  const hayFiltros = Array.from(parametros.keys()).some((clave) => clave !== "pagina");

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-borde px-4 py-3">
      <div className="space-y-1.5">
        <Label htmlFor="filtro-accion" className="text-xs text-texto-suave">
          Acción
        </Label>
        <Select
          value={parametros.get("accion") ?? TODOS}
          onValueChange={(valor) => aplicar("accion", valor)}
        >
          <SelectTrigger id="filtro-accion" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas las acciones</SelectItem>
            {ACCIONES_AUDITORIA.map((accion) => (
              <SelectItem key={accion} value={accion}>
                {ETIQUETA_ACCION_AUDITORIA[accion]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filtro-entidad" className="text-xs text-texto-suave">
          Entidad
        </Label>
        <Select
          value={parametros.get("entidad") ?? TODOS}
          onValueChange={(valor) => aplicar("entidad", valor)}
        >
          <SelectTrigger id="filtro-entidad" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas</SelectItem>
            {ENTIDADES_AUDITORIA.map((entidad) => (
              <SelectItem key={entidad} value={entidad}>
                {ETIQUETA_ENTIDAD[entidad]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filtro-actor" className="text-xs text-texto-suave">
          Actor
        </Label>
        <Input
          id="filtro-actor"
          type="search"
          placeholder="correo@unidad.mil"
          className="w-56"
          defaultValue={parametros.get("actor") ?? ""}
          onChange={(evento) => aplicar("actor", evento.target.value.trim())}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filtro-desde-auditoria" className="text-xs text-texto-suave">
          Desde
        </Label>
        <Input
          id="filtro-desde-auditoria"
          type="date"
          className="w-40"
          defaultValue={parametros.get("desde") ?? ""}
          onChange={(evento) => aplicar("desde", evento.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filtro-hasta-auditoria" className="text-xs text-texto-suave">
          Hasta
        </Label>
        <Input
          id="filtro-hasta-auditoria"
          type="date"
          className="w-40"
          defaultValue={parametros.get("hasta") ?? ""}
          onChange={(evento) => aplicar("hasta", evento.target.value)}
        />
      </div>

      {hayFiltros ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => iniciarTransicion(() => router.push("/admin/auditoria"))}
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
