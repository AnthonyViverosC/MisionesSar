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

type Opcion = { id: string; nombre: string };

const TODOS = "todos";

/** Filtros del archivo histórico. Van en la URL para poder compartir la búsqueda. */
export function FiltrosArchivo({
  unidades,
  tipos,
  anios,
}: {
  unidades: Opcion[];
  tipos: Opcion[];
  anios: number[];
}) {
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

    nuevos.delete("pagina");
    iniciarTransicion(() => router.push(`/archivo?${nuevos.toString()}`));
  }

  const hayFiltros = Array.from(parametros.keys()).some((clave) => clave !== "pagina");

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-borde px-4 py-3">
      <div className="space-y-1.5">
        <Label htmlFor="archivo-q" className="text-xs text-texto-suave">
          Número, zona o comandante
        </Label>
        <Input
          id="archivo-q"
          type="search"
          placeholder="Buscar en el archivo…"
          className="w-64"
          defaultValue={parametros.get("q") ?? ""}
          onChange={(evento) => aplicar("q", evento.target.value.trim())}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="archivo-anio" className="text-xs text-texto-suave">
          Año
        </Label>
        <Select
          value={parametros.get("anio") ?? TODOS}
          onValueChange={(valor) => aplicar("anio", valor)}
        >
          <SelectTrigger id="archivo-anio" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos</SelectItem>
            {anios.map((anio) => (
              <SelectItem key={anio} value={String(anio)}>
                {anio}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="archivo-estado" className="text-xs text-texto-suave">
          Cierre
        </Label>
        <Select
          value={parametros.get("estado") ?? TODOS}
          onValueChange={(valor) => aplicar("estado", valor)}
        >
          <SelectTrigger id="archivo-estado" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Aprobadas y anuladas</SelectItem>
            <SelectItem value="aprobada">Aprobadas</SelectItem>
            <SelectItem value="anulada">Anuladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="archivo-unidad" className="text-xs text-texto-suave">
          Unidad
        </Label>
        <Select
          value={parametros.get("unidad") ?? TODOS}
          onValueChange={(valor) => aplicar("unidad", valor)}
        >
          <SelectTrigger id="archivo-unidad" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas</SelectItem>
            {unidades.map((unidad) => (
              <SelectItem key={unidad.id} value={unidad.id}>
                {unidad.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="archivo-tipo" className="text-xs text-texto-suave">
          Tipo
        </Label>
        <Select
          value={parametros.get("tipo") ?? TODOS}
          onValueChange={(valor) => aplicar("tipo", valor)}
        >
          <SelectTrigger id="archivo-tipo" className="w-44">
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

      {hayFiltros ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => iniciarTransicion(() => router.push("/archivo"))}
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
