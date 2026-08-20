"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { invitarUsuario } from "@/acciones/administracion";
import { esquemaInvitacion, type DatosInvitacion } from "@/dominio/esquemas-admin";
import { DESCRIPCION_ROL, ETIQUETA_ROL, ROLES } from "@/dominio/roles";
import { Button } from "@/components/ui/button";
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

type Opcion = { id: string; nombre: string };

/**
 * Alta de una cuenta.
 *
 * No hay registro público: toda cuenta nace de aquí. Supabase envía el correo de
 * invitación y el usuario define su contraseña en el primer ingreso; esta
 * pantalla nunca fija contraseñas.
 */
export function DialogoInvitacion({ unidades }: { unidades: Opcion[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [enviando, iniciar] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<DatosInvitacion>({
    resolver: zodResolver(esquemaInvitacion),
    mode: "onBlur",
    defaultValues: {
      correo: "",
      nombre_completo: "",
      documento_identidad: "",
      grado: "",
      telefono: "",
      rol: "consulta",
      unidad_id: "",
    },
  });

  const rol = watch("rol");
  const necesitaUnidad = rol === "operador" || rol === "supervisor";

  function enviar(datos: DatosInvitacion) {
    iniciar(async () => {
      const resultado = await invitarUsuario(datos);

      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }

      toast.success(resultado.mensaje);
      reset();
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" aria-hidden />
          Invitar usuario
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invitar a una cuenta nueva</DialogTitle>
          <DialogDescription>
            Recibirá un correo para definir su contraseña y aceptar el aviso de uso. El
            correo no se puede cambiar después.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(enviar)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="correo">Correo institucional</Label>
            <Input
              id="correo"
              type="email"
              autoComplete="off"
              aria-invalid={Boolean(errors.correo)}
              {...register("correo")}
            />
            {errors.correo ? (
              <p className="text-xs text-estado-rojo">{errors.correo.message}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nombre_completo">Nombre y apellidos</Label>
              <Input
                id="nombre_completo"
                aria-invalid={Boolean(errors.nombre_completo)}
                {...register("nombre_completo")}
              />
              {errors.nombre_completo ? (
                <p className="text-xs text-estado-rojo">{errors.nombre_completo.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="documento_identidad">Documento de identidad</Label>
              <Input
                id="documento_identidad"
                inputMode="numeric"
                aria-invalid={Boolean(errors.documento_identidad)}
                {...register("documento_identidad")}
              />
              {errors.documento_identidad ? (
                <p className="text-xs text-estado-rojo">{errors.documento_identidad.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="grado">Grado (opcional)</Label>
              <Input id="grado" placeholder="TE., CT., MY." {...register("grado")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="telefono">Teléfono (opcional)</Label>
              <Input id="telefono" inputMode="tel" {...register("telefono")} />
              {errors.telefono ? (
                <p className="text-xs text-estado-rojo">{errors.telefono.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rol">Rol</Label>
              <Select
                value={rol}
                onValueChange={(valor) =>
                  setValue("rol", valor as DatosInvitacion["rol"], { shouldValidate: true })
                }
              >
                <SelectTrigger id="rol" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((opcion) => (
                    <SelectItem key={opcion} value={opcion}>
                      {ETIQUETA_ROL[opcion]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="unidad_id">
                Unidad {necesitaUnidad ? "" : "(opcional para este rol)"}
              </Label>
              <Select
                value={watch("unidad_id") || ""}
                onValueChange={(valor) => setValue("unidad_id", valor, { shouldValidate: true })}
              >
                <SelectTrigger id="unidad_id" className="w-full">
                  <SelectValue placeholder="Sin unidad" />
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
          </div>

          <p className="rounded-md bg-superficie px-3 py-2 text-xs text-texto-suave">
            {DESCRIPCION_ROL[rol]}
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Enviando…
                </>
              ) : (
                "Enviar invitación"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
