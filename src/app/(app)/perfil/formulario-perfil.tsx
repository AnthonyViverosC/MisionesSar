"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { actualizarPerfilPropio } from "@/acciones/perfil";
import { esquemaPerfilPropio, type DatosPerfilPropio } from "@/dominio/esquemas-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Datos de contacto que cada quien mantiene por su cuenta. */
export function FormularioPerfil({ valores }: { valores: DatosPerfilPropio }) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<DatosPerfilPropio>({
    resolver: zodResolver(esquemaPerfilPropio),
    mode: "onBlur",
    defaultValues: valores,
  });

  function guardar(datos: DatosPerfilPropio) {
    iniciar(async () => {
      const resultado = await actualizarPerfilPropio(datos);

      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }

      toast.success(resultado.mensaje);
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-borde bg-card">
      <div className="border-b border-borde px-4 py-3">
        <h2 className="text-sm font-medium text-texto">Datos personales</h2>
      </div>

      <form onSubmit={handleSubmit(guardar)} className="space-y-4 px-4 py-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="perfil-nombre">Nombre y apellidos</Label>
            <Input
              id="perfil-nombre"
              aria-invalid={Boolean(errors.nombre_completo)}
              {...register("nombre_completo")}
            />
            {errors.nombre_completo ? (
              <p className="text-xs text-estado-rojo">{errors.nombre_completo.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="perfil-grado">Grado</Label>
            <Input id="perfil-grado" placeholder="TE., CT., MY." {...register("grado")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="perfil-telefono">Teléfono</Label>
            <Input id="perfil-telefono" inputMode="tel" {...register("telefono")} />
            {errors.telefono ? (
              <p className="text-xs text-estado-rojo">{errors.telefono.message}</p>
            ) : null}
          </div>
        </div>

        <Button type="submit" disabled={guardando || !isDirty}>
          {guardando ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Guardando…
            </>
          ) : (
            "Guardar cambios"
          )}
        </Button>
      </form>
    </section>
  );
}
