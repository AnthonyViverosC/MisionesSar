"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { enviarARevision } from "@/acciones/misiones";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TOTAL_ARCHIVOS } from "@/dominio/soportes";

/**
 * Pie fijo de la pantalla de carga, como en la referencia: guardar borrador a la
 * izquierda y enviar misión a la derecha.
 *
 * "Enviar misión" solo se habilita con los ocho archivos cargados. Aunque
 * alguien forzara el botón, el trigger de la base rechazaría el envío.
 */
export function PieCarga({
  misionId,
  numeroMision,
  cargados,
  puedeEnviar,
}: {
  misionId: string;
  numeroMision: string;
  cargados: number;
  /** El envío corresponde a quien creó la misión. */
  puedeEnviar: boolean;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, iniciar] = useTransition();

  const completa = cargados >= TOTAL_ARCHIVOS;
  const faltan = TOTAL_ARCHIVOS - cargados;

  function enviar() {
    iniciar(async () => {
      const resultado = await enviarARevision(misionId);

      if (!resultado.ok) {
        toast.error(resultado.error);
        setConfirmando(false);
        return;
      }

      toast.success(resultado.mensaje);
      router.push(`/misiones/${misionId}`);
    });
  }

  return (
    <>
      <div className="sticky bottom-0 -mx-4 mt-6 flex flex-wrap items-center gap-3 border-t border-borde bg-card px-4 py-3 sm:-mx-6 sm:px-6">
        <Button variant="outline" onClick={() => router.push(`/misiones/${misionId}`)}>
          Guardar borrador
        </Button>

        <p className="text-xs text-texto-suave" aria-live="polite">
          {completa
            ? "Todos los soportes están cargados."
            : `Faltan ${faltan} archivo${faltan === 1 ? "" : "s"} para poder enviar.`}
        </p>

        {puedeEnviar ? (
          <Button
            className="ml-auto"
            disabled={!completa || enviando}
            onClick={() => setConfirmando(true)}
          >
            <Send className="size-4" aria-hidden />
            Enviar misión
          </Button>
        ) : null}
      </div>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar la misión {numeroMision} a revisión</AlertDialogTitle>
            <AlertDialogDescription>
              Quedará en manos del supervisor y no podrás editarla ni reemplazar sus soportes
              mientras la revisa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(evento) => {
                evento.preventDefault();
                enviar();
              }}
              disabled={enviando}
            >
              {enviando ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Enviando…
                </>
              ) : (
                "Enviar misión"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
