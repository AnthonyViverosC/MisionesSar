"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Check } from "lucide-react";
import { definirContrasena, type EstadoAccion } from "@/acciones/autenticacion";
import { LONGITUD_MINIMA } from "@/lib/seguridad/contrasena";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ESTADO_INICIAL: EstadoAccion = {};

export function FormularioPrimerIngreso() {
  const [estado, enviar] = useActionState(definirContrasena, ESTADO_INICIAL);
  const [contrasena, setContrasena] = useState("");
  const [aceptado, setAceptado] = useState(false);

  const suficienteLargo = contrasena.length >= LONGITUD_MINIMA;

  return (
    <form action={enviar} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="contrasena">Contraseña nueva</Label>
        <Input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          value={contrasena}
          onChange={(evento) => setContrasena(evento.target.value)}
          aria-describedby="requisitos-clave"
        />
        <ul id="requisitos-clave" className="space-y-1 text-xs text-texto-suave">
          <li className={suficienteLargo ? "text-estado-verde" : undefined}>
            {suficienteLargo ? <Check className="mr-1 inline size-3" aria-hidden /> : "• "}
            Al menos {LONGITUD_MINIMA} caracteres.
          </li>
          <li>• No puede aparecer en filtraciones públicas conocidas; se verifica al guardar.</li>
          <li>• Usa una frase larga que no hayas usado en otro servicio.</li>
        </ul>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmacion">Repite la contraseña</Label>
        <Input
          id="confirmacion"
          name="confirmacion"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>

      <div className="flex items-start gap-3 rounded-md border border-borde bg-superficie p-3">
        <Checkbox
          id="aviso"
          name="aviso"
          value="aceptado"
          checked={aceptado}
          onCheckedChange={(valor) => setAceptado(valor === true)}
          required
        />
        <Label htmlFor="aviso" className="text-sm font-normal leading-relaxed text-texto">
          Acepto el uso institucional de la plataforma y el tratamiento de los datos descrito
          en el{" "}
          <Link
            href="/privacidad"
            target="_blank"
            className="font-medium underline underline-offset-2"
          >
            aviso de privacidad
          </Link>
          . Entiendo que toda acción queda registrada en la auditoría del sistema.
        </Label>
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

      <BotonGuardar habilitado={aceptado && suficienteLargo} />
    </form>
  );
}

function BotonGuardar({ habilitado }: { habilitado: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending || !habilitado}>
      {pending ? "Guardando…" : "Guardar y continuar"}
    </Button>
  );
}
