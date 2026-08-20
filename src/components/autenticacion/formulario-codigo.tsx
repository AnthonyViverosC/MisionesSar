"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import type { EstadoAccion } from "@/acciones/autenticacion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ESTADO_INICIAL: EstadoAccion = {};

/** Campo de código TOTP, compartido por la verificación y la inscripción. */
export function FormularioCodigo({
  accion,
  factorId,
  textoBoton,
  textoEnviando,
}: {
  accion: (estado: EstadoAccion, datos: FormData) => Promise<EstadoAccion>;
  factorId: string;
  textoBoton: string;
  textoEnviando: string;
}) {
  const [estado, enviar] = useActionState(accion, ESTADO_INICIAL);

  return (
    <form action={enviar} className="space-y-4" noValidate>
      <input type="hidden" name="factorId" value={factorId} />

      <div className="space-y-2">
        <Label htmlFor="codigo">Código de verificación</Label>
        <Input
          id="codigo"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          placeholder="000000"
          className="text-center font-mono text-lg tracking-[0.4em]"
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

      <BotonEnviar texto={textoBoton} textoEnviando={textoEnviando} />
    </form>
  );
}

function BotonEnviar({ texto, textoEnviando }: { texto: string; textoEnviando: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? textoEnviando : texto}
    </Button>
  );
}
