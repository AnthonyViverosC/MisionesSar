"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { KeyRound, Loader2, MailWarning, MoreHorizontal, Power, SquarePen } from "lucide-react";
import {
  actualizarUsuario,
  exigirCambioDeClave,
  reenviarAcceso,
} from "@/acciones/administracion";
import { esquemaUsuario, type DatosUsuario } from "@/dominio/esquemas-admin";
import { ETIQUETA_ROL, ROLES, type Rol } from "@/dominio/roles";
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
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Opcion = { id: string; nombre: string };

export type UsuarioVista = {
  id: string;
  correo: string;
  nombre_completo: string;
  documento_identidad: string;
  grado: string;
  telefono: string;
  rol: Rol;
  unidad_id: string;
  activo: boolean;
  ultimo_acceso: string | null;
};

/**
 * Acciones sobre una cuenta.
 *
 * Desactivar no borra nada: el perfil, sus misiones y su rastro en la bitácora
 * quedan intactos. Lo único que cambia es que el middleware cierra su sesión en
 * la siguiente petición y no la deja volver a entrar.
 */
export function AccionesUsuario({
  usuario,
  unidades,
}: {
  usuario: UsuarioVista;
  unidades: Opcion[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [procesando, iniciar] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<DatosUsuario>({
    resolver: zodResolver(esquemaUsuario),
    mode: "onBlur",
    defaultValues: {
      nombre_completo: usuario.nombre_completo,
      documento_identidad: usuario.documento_identidad,
      grado: usuario.grado,
      telefono: usuario.telefono,
      rol: usuario.rol,
      unidad_id: usuario.unidad_id,
      activo: usuario.activo,
    },
  });

  const rol = watch("rol");

  function guardar(datos: DatosUsuario) {
    iniciar(async () => {
      const resultado = await actualizarUsuario(usuario.id, datos);

      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }

      toast.success(resultado.mensaje);
      setEditando(false);
      router.refresh();
    });
  }

  /** Activa o desactiva la cuenta sin tocar el resto de sus datos. */
  function alternarActividad() {
    iniciar(async () => {
      const resultado = await actualizarUsuario(usuario.id, {
        nombre_completo: usuario.nombre_completo,
        documento_identidad: usuario.documento_identidad,
        grado: usuario.grado,
        telefono: usuario.telefono,
        rol: usuario.rol,
        unidad_id: usuario.unidad_id,
        activo: !usuario.activo,
      });

      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }

      toast.success(usuario.activo ? "Cuenta desactivada" : "Cuenta reactivada");
      setConfirmando(false);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Acciones sobre la cuenta de ${usuario.nombre_completo}`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem
            onSelect={() => {
              reset();
              setEditando(true);
            }}
          >
            <SquarePen className="size-4" aria-hidden />
            Editar datos y rol
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() =>
              iniciar(async () => {
                const resultado = await reenviarAcceso(usuario.id);
                if (resultado.ok) toast.success(resultado.mensaje);
                else toast.error(resultado.error);
              })
            }
          >
            <MailWarning className="size-4" aria-hidden />
            Reenviar acceso por correo
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() =>
              iniciar(async () => {
                const resultado = await exigirCambioDeClave(usuario.id);
                if (resultado.ok) toast.success(resultado.mensaje);
                else toast.error(resultado.error);
              })
            }
          >
            <KeyRound className="size-4" aria-hidden />
            Exigir contraseña nueva
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant={usuario.activo ? "destructive" : "default"}
            onSelect={() => setConfirmando(true)}
          >
            <Power className="size-4" aria-hidden />
            {usuario.activo ? "Desactivar cuenta" : "Reactivar cuenta"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edición */}
      <Dialog open={editando} onOpenChange={setEditando}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar la cuenta de {usuario.nombre_completo}</DialogTitle>
            <DialogDescription>
              {usuario.correo || "Sin correo registrado"} ·{" "}
              {usuario.ultimo_acceso
                ? `último acceso el ${new Date(usuario.ultimo_acceso).toLocaleDateString("es-CO")}`
                : "todavía no ha entrado"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(guardar)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`nombre-${usuario.id}`}>Nombre y apellidos</Label>
                <Input
                  id={`nombre-${usuario.id}`}
                  aria-invalid={Boolean(errors.nombre_completo)}
                  {...register("nombre_completo")}
                />
                {errors.nombre_completo ? (
                  <p className="text-xs text-estado-rojo">{errors.nombre_completo.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`documento-${usuario.id}`}>Documento</Label>
                <Input
                  id={`documento-${usuario.id}`}
                  inputMode="numeric"
                  aria-invalid={Boolean(errors.documento_identidad)}
                  {...register("documento_identidad")}
                />
                {errors.documento_identidad ? (
                  <p className="text-xs text-estado-rojo">{errors.documento_identidad.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`grado-${usuario.id}`}>Grado</Label>
                <Input id={`grado-${usuario.id}`} {...register("grado")} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`telefono-${usuario.id}`}>Teléfono</Label>
                <Input id={`telefono-${usuario.id}`} inputMode="tel" {...register("telefono")} />
                {errors.telefono ? (
                  <p className="text-xs text-estado-rojo">{errors.telefono.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`rol-${usuario.id}`}>Rol</Label>
                <Select
                  value={rol}
                  onValueChange={(valor) =>
                    setValue("rol", valor as Rol, { shouldValidate: true })
                  }
                >
                  <SelectTrigger id={`rol-${usuario.id}`} className="w-full">
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
                <Label htmlFor={`unidad-${usuario.id}`}>Unidad</Label>
                <Select
                  value={watch("unidad_id") || ""}
                  onValueChange={(valor) => setValue("unidad_id", valor, { shouldValidate: true })}
                >
                  <SelectTrigger id={`unidad-${usuario.id}`} className="w-full">
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={procesando}>
                {procesando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Guardando…
                  </>
                ) : (
                  "Guardar cambios"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Activar / desactivar */}
      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {usuario.activo
                ? `Desactivar la cuenta de ${usuario.nombre_completo}`
                : `Reactivar la cuenta de ${usuario.nombre_completo}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {usuario.activo
                ? "Su sesión se cerrará en la siguiente petición y no podrá volver a entrar. Sus misiones, documentos y registros de auditoría se conservan intactos."
                : "Volverá a poder entrar con sus credenciales actuales y con el rol que tenía."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={procesando}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant={usuario.activo ? "destructive" : "default"}
              disabled={procesando}
              onClick={alternarActividad}
            >
              {procesando ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Aplicando…
                </>
              ) : usuario.activo ? (
                "Desactivar"
              ) : (
                "Reactivar"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
