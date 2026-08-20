"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cambiarContrasenaPropia } from "@/acciones/perfil";
import { LONGITUD_MINIMA } from "@/lib/seguridad/contrasena";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const VACIO = { actual: "", nueva: "", confirmacion: "" };

/**
 * Cambio de contraseña dentro de la sesión.
 *
 * Se pide la contraseña actual aunque haya sesión abierta: sin eso, un equipo
 * desatendido bastaría para quedarse con la cuenta. La contraseña nueva se
 * comprueba además contra filtraciones conocidas, en el servidor.
 */
export function FormularioContrasena() {
  const [valores, setValores] = useState(VACIO);
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    iniciar(async () => {
      const resultado = await cambiarContrasenaPropia(valores);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      toast.success(resultado.mensaje);
      setValores(VACIO);
    });
  }

  const campo = (clave: keyof typeof VACIO) => ({
    value: valores[clave],
    onChange: (evento: React.ChangeEvent<HTMLInputElement>) =>
      setValores((previos) => ({ ...previos, [clave]: evento.target.value })),
  });

  return (
    <section className="rounded-lg border border-borde bg-card">
      <div className="border-b border-borde px-4 py-3">
        <h2 className="text-sm font-medium text-texto">Contraseña</h2>
      </div>

      <form onSubmit={enviar} className="space-y-4 px-4 py-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="clave-actual">Contraseña actual</Label>
            <Input
              id="clave-actual"
              type="password"
              autoComplete="current-password"
              required
              className="sm:max-w-xs"
              {...campo("actual")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clave-nueva">Contraseña nueva</Label>
            <Input
              id="clave-nueva"
              type="password"
              autoComplete="new-password"
              required
              minLength={LONGITUD_MINIMA}
              {...campo("nueva")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clave-confirmacion">Repite la contraseña nueva</Label>
            <Input
              id="clave-confirmacion"
              type="password"
              autoComplete="new-password"
              required
              minLength={LONGITUD_MINIMA}
              {...campo("confirmacion")}
            />
          </div>
        </div>

        <p className="text-xs text-texto-suave">
          Mínimo {LONGITUD_MINIMA} caracteres. Se rechaza cualquier contraseña que aparezca en
          filtraciones públicas conocidas.
        </p>

        {error ? (
          <p role="alert" className="text-sm text-estado-rojo">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={enviando}>
          {enviando ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Actualizando…
            </>
          ) : (
            "Cambiar contraseña"
          )}
        </Button>
      </form>
    </section>
  );
}
