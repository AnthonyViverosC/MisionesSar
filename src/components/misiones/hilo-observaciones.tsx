"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import { responderObservacion } from "@/acciones/misiones";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ObservacionVista = {
  id: string;
  texto: string;
  creado_en: string;
  resuelta: boolean;
  autor: string;
};

/**
 * Hilo de revisión de la misión.
 *
 * Las observaciones no se editan ni se borran: cada intervención queda como
 * está. El operador responde en el mismo hilo mientras la misión siga abierta.
 */
export function HiloObservaciones({
  misionId,
  observaciones,
  puedeResponder,
}: {
  misionId: string;
  observaciones: ObservacionVista[];
  puedeResponder: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [enviando, iniciar] = useTransition();

  function responder() {
    iniciar(async () => {
      const resultado = await responderObservacion(misionId, texto);

      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }

      toast.success(resultado.mensaje);
      setTexto("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 px-4 py-4">
      {observaciones.length === 0 ? (
        <p className="flex items-center gap-2 py-4 text-sm text-texto-suave">
          <MessageSquare className="size-4" aria-hidden />
          Sin observaciones. Aparecerán aquí si el supervisor devuelve la misión.
        </p>
      ) : (
        <ol className="space-y-3">
          {observaciones.map((observacion) => (
            <li
              key={observacion.id}
              className="rounded-md border border-borde bg-superficie px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-texto">{observacion.autor}</p>
                <time
                  dateTime={observacion.creado_en}
                  className="text-xs text-texto-suave"
                >
                  {new Date(observacion.creado_en).toLocaleString("es-CO", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                {observacion.resuelta ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-estado-verde">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    Atendida
                  </span>
                ) : (
                  <span className="ml-auto text-xs font-medium text-estado-ambar">
                    Pendiente
                  </span>
                )}
              </div>
              <p className="mt-1.5 whitespace-pre-line text-sm text-texto">
                {observacion.texto}
              </p>
            </li>
          ))}
        </ol>
      )}

      {puedeResponder ? (
        <div className="space-y-2 border-t border-borde pt-4">
          <Label htmlFor="respuesta">Responder en el hilo</Label>
          <Textarea
            id="respuesta"
            rows={3}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="Explica qué corregiste o pide una aclaración…"
          />
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              onClick={responder}
              disabled={enviando || texto.trim().length < 10}
            >
              {enviando ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Enviando…
                </>
              ) : (
                "Responder"
              )}
            </Button>
            <p className="text-xs text-texto-suave">Mínimo 10 caracteres.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
