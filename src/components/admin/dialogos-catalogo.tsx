"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, SquarePen } from "lucide-react";
import {
  guardarAeronave,
  guardarTipoMision,
  guardarUnidad,
  type ResultadoAdmin,
} from "@/acciones/administracion";
import {
  esquemaAeronave,
  esquemaTipoMision,
  esquemaUnidad,
  type DatosAeronave,
  type DatosTipoMision,
  type DatosUnidad,
} from "@/dominio/esquemas-admin";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Diálogos de mantenimiento de los catálogos.
 *
 * Los tres se comportan igual: el mismo componente crea y edita según reciba o
 * no un registro. Ninguno ofrece borrar, porque no se borra: se desmarca
 * "activo" y el catálogo deja de aparecer en los formularios nuevos sin afectar
 * a las misiones ya registradas con él.
 */

type Opcion = { id: string; nombre: string };

/** Botón que abre el diálogo: "Añadir" al crear, un lápiz al editar. */
function Disparador({ editando, etiqueta }: { editando: boolean; etiqueta: string }) {
  return editando ? (
    <Button variant="ghost" size="icon" aria-label={`Editar ${etiqueta}`}>
      <SquarePen className="size-4" aria-hidden />
    </Button>
  ) : (
    <Button size="sm" variant="outline">
      <Plus className="size-4" aria-hidden />
      {etiqueta}
    </Button>
  );
}

/** Pie común: cancelar y guardar, con el estado de envío. */
function PieDialogo({
  enviando,
  onCancelar,
}: {
  enviando: boolean;
  onCancelar: () => void;
}) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancelar}>
        Cancelar
      </Button>
      <Button type="submit" disabled={enviando}>
        {enviando ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Guardando…
          </>
        ) : (
          "Guardar"
        )}
      </Button>
    </DialogFooter>
  );
}

/**
 * Envío compartido: notifica, cierra y refresca.
 *
 * Único identificador del proyecto que no está en español: React exige que los
 * hooks empiecen por `use` para poder verificar sus reglas, y el linter falla si
 * se llamara `usarEnvio`.
 */
function useEnvioCatalogo(cerrar: () => void) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();

  const enviar = (accion: () => Promise<ResultadoAdmin>) =>
    iniciar(async () => {
      const resultado = await accion();

      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }

      toast.success(resultado.mensaje);
      cerrar();
      router.refresh();
    });

  return { enviando, enviar };
}

// -----------------------------------------------------------------------------

export function DialogoUnidad({ unidad }: { unidad?: DatosUnidad }) {
  const [abierto, setAbierto] = useState(false);
  const { enviando, enviar } = useEnvioCatalogo(() => setAbierto(false));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DatosUnidad>({
    resolver: zodResolver(esquemaUnidad),
    mode: "onBlur",
    defaultValues: unidad ?? { codigo: "", nombre: "", activa: true },
  });

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Disparador editando={Boolean(unidad)} etiqueta={unidad ? unidad.nombre : "Nueva unidad"} />
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{unidad ? "Editar unidad" : "Nueva unidad"}</DialogTitle>
          <DialogDescription>
            La unidad delimita qué misiones ve cada operador y supervisor.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((datos) => enviar(() => guardarUnidad(datos)))}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="unidad-codigo">Código</Label>
            <Input
              id="unidad-codigo"
              className="font-mono uppercase"
              aria-invalid={Boolean(errors.codigo)}
              {...register("codigo")}
            />
            {errors.codigo ? (
              <p className="text-xs text-estado-rojo">{errors.codigo.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="unidad-nombre">Nombre</Label>
            <Input
              id="unidad-nombre"
              aria-invalid={Boolean(errors.nombre)}
              {...register("nombre")}
            />
            {errors.nombre ? (
              <p className="text-xs text-estado-rojo">{errors.nombre.message}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="unidad-activa"
              checked={watch("activa")}
              onCheckedChange={(valor) => setValue("activa", valor === true)}
            />
            <Label htmlFor="unidad-activa" className="font-normal">
              Activa: se ofrece al crear misiones
            </Label>
          </div>

          <PieDialogo enviando={enviando} onCancelar={() => setAbierto(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------

export function DialogoAeronave({
  aeronave,
  unidades,
}: {
  aeronave?: DatosAeronave;
  unidades: Opcion[];
}) {
  const [abierto, setAbierto] = useState(false);
  const { enviando, enviar } = useEnvioCatalogo(() => setAbierto(false));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DatosAeronave>({
    resolver: zodResolver(esquemaAeronave),
    mode: "onBlur",
    defaultValues: aeronave ?? { matricula: "", tipo: "", unidad_id: "", activa: true },
  });

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Disparador
          editando={Boolean(aeronave)}
          etiqueta={aeronave ? aeronave.matricula : "Nueva aeronave"}
        />
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{aeronave ? "Editar aeronave" : "Nueva aeronave"}</DialogTitle>
          <DialogDescription>
            Solo se ofrecen aeronaves de la unidad de la misión: la base rechaza cualquier
            otra.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((datos) => enviar(() => guardarAeronave(datos)))}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="aeronave-matricula">Matrícula</Label>
            <Input
              id="aeronave-matricula"
              className="font-mono uppercase"
              placeholder="FAC-1234"
              aria-invalid={Boolean(errors.matricula)}
              {...register("matricula")}
            />
            {errors.matricula ? (
              <p className="text-xs text-estado-rojo">{errors.matricula.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="aeronave-tipo">Tipo</Label>
            <Input
              id="aeronave-tipo"
              placeholder="Helicóptero UH-60"
              aria-invalid={Boolean(errors.tipo)}
              {...register("tipo")}
            />
            {errors.tipo ? (
              <p className="text-xs text-estado-rojo">{errors.tipo.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="aeronave-unidad">Unidad</Label>
            <Select
              value={watch("unidad_id")}
              onValueChange={(valor) => setValue("unidad_id", valor, { shouldValidate: true })}
            >
              <SelectTrigger id="aeronave-unidad" className="w-full">
                <SelectValue placeholder="Selecciona la unidad" />
              </SelectTrigger>
              <SelectContent>
                {unidades.map((unidad) => (
                  <SelectItem key={unidad.id} value={unidad.id}>
                    {unidad.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.unidad_id ? (
              <p className="text-xs text-estado-rojo">{errors.unidad_id.message}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="aeronave-activa"
              checked={watch("activa")}
              onCheckedChange={(valor) => setValue("activa", valor === true)}
            />
            <Label htmlFor="aeronave-activa" className="font-normal">
              En servicio
            </Label>
          </div>

          <PieDialogo enviando={enviando} onCancelar={() => setAbierto(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------

export function DialogoTipoMision({ tipo }: { tipo?: DatosTipoMision }) {
  const [abierto, setAbierto] = useState(false);
  const { enviando, enviar } = useEnvioCatalogo(() => setAbierto(false));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DatosTipoMision>({
    resolver: zodResolver(esquemaTipoMision),
    mode: "onBlur",
    defaultValues: tipo ?? { codigo: "", nombre: "", orden: 0, activo: true },
  });

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Disparador
          editando={Boolean(tipo)}
          etiqueta={tipo ? tipo.nombre : "Nuevo tipo de misión"}
        />
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tipo ? "Editar tipo de misión" : "Nuevo tipo de misión"}</DialogTitle>
          <DialogDescription>
            El orden decide cómo se listan en el formulario de misión.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((datos) => enviar(() => guardarTipoMision(datos)))}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="tipo-codigo">Código</Label>
            <Input
              id="tipo-codigo"
              className="font-mono uppercase"
              placeholder="BUSQUEDA"
              aria-invalid={Boolean(errors.codigo)}
              {...register("codigo")}
            />
            {errors.codigo ? (
              <p className="text-xs text-estado-rojo">{errors.codigo.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tipo-nombre">Nombre</Label>
            <Input
              id="tipo-nombre"
              aria-invalid={Boolean(errors.nombre)}
              {...register("nombre")}
            />
            {errors.nombre ? (
              <p className="text-xs text-estado-rojo">{errors.nombre.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tipo-orden">Orden</Label>
            <Input
              id="tipo-orden"
              type="number"
              min={0}
              max={999}
              className="w-28"
              aria-invalid={Boolean(errors.orden)}
              {...register("orden", { valueAsNumber: true })}
            />
            {errors.orden ? (
              <p className="text-xs text-estado-rojo">{errors.orden.message}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="tipo-activo"
              checked={watch("activo")}
              onCheckedChange={(valor) => setValue("activo", valor === true)}
            />
            <Label htmlFor="tipo-activo" className="font-normal">
              Activo: se ofrece al crear misiones
            </Label>
          </div>

          <PieDialogo enviando={enviando} onCancelar={() => setAbierto(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
