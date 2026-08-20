"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, MailCheck } from "lucide-react";
import { solicitarRecuperacion, type EstadoAccion } from "@/acciones/autenticacion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ESTADO_INICIAL: EstadoAccion = {};

export function FormularioRecuperacion() {
  const [estado, enviar] = useActionState(solicitarRecuperacion, ESTADO_INICIAL);

  if (estado.mensaje) {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-md border border-borde bg-estado-verde-fondo px-3 py-3 text-sm text-estado-verde"
      >
        <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{estado.mensaje}</span>
      </p>
    );
  }

  return (
    <form action={enviar} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="correo">Correo institucional</Label>
        <Input
          id="correo"
          name="correo"
          type="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="nombre@sar.mil.co"
        />
      </div>

      {estado.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-estado-rojo/30 bg-estado-rojo-fondo px-3 py-2 text-sm text-estado-rojo"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{estado.error}</span>
        </p>
      ) : null}

      <BotonEnviar />
    </form>
  );
}

function BotonEnviar() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Enviando…" : "Enviar enlace"}
    </Button>
  );
}
