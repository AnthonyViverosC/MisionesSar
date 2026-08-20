"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { iniciarSesion, type EstadoAccion } from "@/acciones/autenticacion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ESTADO_INICIAL: EstadoAccion = {};

export function FormularioIngreso({ siguiente }: { siguiente?: string }) {
  const [estado, enviar] = useActionState(iniciarSesion, ESTADO_INICIAL);

  return (
    <form action={enviar} className="space-y-4" noValidate>
      <input type="hidden" name="siguiente" value={siguiente ?? ""} />

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
          aria-describedby={estado.error ? "error-ingreso" : undefined}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contrasena">Contraseña</Label>
        <Input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={estado.error ? "error-ingreso" : undefined}
        />
      </div>

      {estado.error ? (
        <p
          id="error-ingreso"
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
      {pending ? "Verificando…" : "Ingresar"}
    </Button>
  );
}
