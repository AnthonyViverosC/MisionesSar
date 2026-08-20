"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Filter, X } from "lucide-react";
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
import { ESTADOS, ETIQUETA_ESTADO } from "@/dominio/estados";

type Opcion = { id: string; nombre: string };

const TODOS = "todos";

/**
 * Filtros del listado.
 *
 * Viven en la URL: así un filtro concreto se puede compartir, y la paginación y
 * el ordenamiento del servidor leen el mismo estado.
 */
export function FiltrosMisiones({
  unidades,
  aeronaves,
  tipos,
  mostrarUnidad,
}: {
  unidades: Opcion[];
  aeronaves: Opcion[];
  tipos: Opcion[];
  mostrarUnidad: boolean;
}) {
  const router = useRouter();
  const parametros = useSearchParams();
  const [pendiente, iniciarTransicion] = useTransition();
  const [avanzados, setAvanzados] = useState(
    Boolean(
      parametros.get("unidad") ??
        parametros.get("aeronave") ??
        parametros.get("tipo") ??
        parametros.get("desde") ??
        parametros.get("hasta"),
    ),
  );

  function aplicar(clave: string, valor: string | null) {
    const nuevos = new URLSearchParams(parametros.toString());

    if (!valor || valor === TODOS) {
      nuevos.delete(clave);
    } else {
      nuevos.set(clave, valor);
    }

    // Cualquier cambio de filtro devuelve a la primera página.
    nuevos.delete("pagina");

    iniciarTransicion(() => {
      router.push(`/misiones?${nuevos.toString()}`);
    });
  }

  const hayFiltros = Array.from(parametros.keys()).some(
    (clave) => !["pagina", "orden", "dir"].includes(clave),
  );

  return (
    <div className="space-y-4 border-b border-borde px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="filtro-estado" className="text-xs text-texto-suave">
            Estado
          </Label>
          <Select
            value={parametros.get("estado") ?? TODOS}
            onValueChange={(valor) => aplicar("estado", valor)}
          >
            <SelectTrigger id="filtro-estado" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos los estados</SelectItem>
              {ESTADOS.map((estado) => (
                <SelectItem key={estado} value={estado}>
                  {ETIQUETA_ESTADO[estado]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filtro-numero" className="text-xs text-texto-suave">
            Número de misión
          </Label>
          <Input
            id="filtro-numero"
            defaultValue={parametros.get("q") ?? ""}
            placeholder="2026-042"
            className="w-40 font-mono"
            onChange={(evento) => aplicar("q", evento.target.value.trim())}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAvanzados((valor) => !valor)}
          aria-expanded={avanzados}
        >
          <Filter className="size-4" aria-hidden />
          {avanzados ? "Menos filtros" : "Más filtros"}
        </Button>

        {hayFiltros ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => iniciarTransicion(() => router.push("/misiones"))}
          >
            <X className="size-4" aria-hidden />
            Limpiar
          </Button>
        ) : null}

        <p className="ml-auto text-xs text-texto-suave" aria-live="polite">
          {pendiente ? "Actualizando…" : null}
        </p>
      </div>

      {avanzados ? (
        <div className="flex flex-wrap items-end gap-3">
          {mostrarUnidad ? (
            <div className="space-y-1.5">
              <Label htmlFor="filtro-unidad" className="text-xs text-texto-suave">
                Unidad
              </Label>
              <Select
                value={parametros.get("unidad") ?? TODOS}
                onValueChange={(valor) => aplicar("unidad", valor)}
              >
                <SelectTrigger id="filtro-unidad" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas las unidades</SelectItem>
                  {unidades.map((unidad) => (
                    <SelectItem key={unidad.id} value={unidad.id}>
                      {unidad.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="filtro-aeronave" className="text-xs text-texto-suave">
              Aeronave
            </Label>
            <Select
              value={parametros.get("aeronave") ?? TODOS}
              onValueChange={(valor) => aplicar("aeronave", valor)}
            >
              <SelectTrigger id="filtro-aeronave" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas</SelectItem>
                {aeronaves.map((aeronave) => (
                  <SelectItem key={aeronave.id} value={aeronave.id}>
                    {aeronave.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-tipo" className="text-xs text-texto-suave">
              Tipo
            </Label>
            <Select
              value={parametros.get("tipo") ?? TODOS}
              onValueChange={(valor) => aplicar("tipo", valor)}
            >
              <SelectTrigger id="filtro-tipo" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {tipos.map((tipo) => (
                  <SelectItem key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-desde" className="text-xs text-texto-suave">
              Desde
            </Label>
            <Input
              id="filtro-desde"
              type="date"
              className="w-40"
              defaultValue={parametros.get("desde") ?? ""}
              onChange={(evento) => aplicar("desde", evento.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-hasta" className="text-xs text-texto-suave">
              Hasta
            </Label>
            <Input
              id="filtro-hasta"
              type="date"
              className="w-40"
              defaultValue={parametros.get("hasta") ?? ""}
              onChange={(evento) => aplicar("hasta", evento.target.value)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
