"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Check, Loader2, Send, Undo2 } from "lucide-react";
import {
  anularMision,
  aprobarMision,
  devolverConObservacion,
  enviarARevision,
  tomarEnRevision,
  type ResultadoMision,
} from "@/acciones/misiones";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { accionesDisponibles, type AccionMision } from "@/dominio/estados";
import type { EstadoMision } from "@/dominio/estados";
import type { Rol } from "@/dominio/roles";

type Props = {
  misionId: string;
  numeroMision: string;
  estado: EstadoMision;
  rol: Rol;
  esCreador: boolean;
  archivosVigentes: number;
};

/** Configuración visual y textual de cada acción. */
const PRESENTACION: Record<
  AccionMision,
  {
    etiqueta: string;
    icono: React.ComponentType<{ className?: string }>;
    variante: "default" | "outline" | "destructive";
    titulo: (numero: string) => string;
    descripcion: (numero: string) => string;
    /** Etiqueta del campo de texto, si la acción lo exige. */
    campo?: { etiqueta: string; ayuda: string };
  }
> = {
  enviar: {
    etiqueta: "Enviar misión",
    icono: Send,
    variante: "default",
    titulo: (numero) => `Enviar la misión ${numero} a revisión`,
    descripcion: () =>
      "Quedará en manos del supervisor y no podrás editarla mientras la revisa.",
  },
  tomar_revision: {
    etiqueta: "Tomar en revisión",
    icono: Check,
    variante: "outline",
    titulo: (numero) => `Tomar en revisión la misión ${numero}`,
    descripcion: () => "Quedarás registrado como responsable de la revisión.",
  },
  aprobar: {
    etiqueta: "Aprobar",
    icono: Check,
    variante: "default",
    titulo: (numero) => `Aprobar la misión ${numero}`,
    descripcion: () =>
      "Una vez aprobada, la misión queda inmutable: no se editan sus datos ni se reemplazan sus soportes.",
  },
  observar: {
    etiqueta: "Devolver con observación",
    icono: Undo2,
    variante: "outline",
    titulo: (numero) => `Devolver la misión ${numero}`,
    descripcion: () => "El operador podrá corregir y volver a enviarla.",
    campo: {
      etiqueta: "Observación",
      ayuda: "Explica qué debe corregirse. El operador verá este texto.",
    },
  },
  anular: {
    etiqueta: "Anular",
    icono: Ban,
    variante: "destructive",
    titulo: (numero) => `Anular la misión ${numero}`,
    descripcion: () =>
      "La misión deja de estar activa pero se conserva con su motivo. Esta acción no se revierte.",
    campo: {
      etiqueta: "Motivo de la anulación",
      ayuda: "Queda registrado en la auditoría y visible en el expediente.",
    },
  },
};

/**
 * Botones de acción del detalle.
 *
 * Qué botones aparecen lo decide `accionesDisponibles`, la misma lógica que
 * replican los triggers de la base. Si algo se cuela, la base lo rechaza y el
 * mensaje de error se muestra tal cual: nunca se pierde una regla por el camino.
 *
 * Toda acción irreversible pasa por una confirmación que nombra la misión.
 */
export function AccionesMision({
  misionId,
  numeroMision,
  estado,
  rol,
  esCreador,
  archivosVigentes,
}: Props) {
  const router = useRouter();
  const [abierta, setAbierta] = useState<AccionMision | null>(null);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  const disponibles = accionesDisponibles({ estado, rol, esCreador, archivosVigentes });

  if (disponibles.length === 0) return null;

  function ejecutar(accion: AccionMision) {
    setError(null);

    iniciar(async () => {
      let resultado: ResultadoMision;

      switch (accion) {
        case "enviar":
          resultado = await enviarARevision(misionId);
          break;
        case "tomar_revision":
          resultado = await tomarEnRevision(misionId);
          break;
        case "aprobar":
          resultado = await aprobarMision(misionId);
          break;
        case "observar":
          resultado = await devolverConObservacion(misionId, texto);
          break;
        case "anular":
          resultado = await anularMision(misionId, texto);
          break;
      }

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      toast.success(resultado.mensaje);
      setAbierta(null);
      setTexto("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {disponibles.map((accion) => {
        const presentacion = PRESENTACION[accion];
        const Icono = presentacion.icono;

        return (
          <Button
            key={accion}
            variant={presentacion.variante}
            onClick={() => {
              setAbierta(accion);
              setTexto("");
              setError(null);
            }}
          >
            <Icono className="size-4" aria-hidden />
            {presentacion.etiqueta}
          </Button>
        );
      })}

      <AlertDialog
        open={abierta !== null}
        onOpenChange={(abierto) => {
          if (!abierto && !enCurso) {
            setAbierta(null);
            setError(null);
          }
        }}
      >
        <AlertDialogContent>
          {abierta ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{PRESENTACION[abierta].titulo(numeroMision)}</AlertDialogTitle>
                <AlertDialogDescription>
                  {PRESENTACION[abierta].descripcion(numeroMision)}
                </AlertDialogDescription>
              </AlertDialogHeader>

              {PRESENTACION[abierta].campo ? (
                <div className="space-y-1.5">
                  <Label htmlFor="texto-accion">{PRESENTACION[abierta].campo!.etiqueta}</Label>
                  <Textarea
                    id="texto-accion"
                    rows={4}
                    value={texto}
                    onChange={(evento) => setTexto(evento.target.value)}
                    placeholder="Escribe al menos 10 caracteres…"
                    autoFocus
                  />
                  <p className="text-xs text-texto-suave">
                    {PRESENTACION[abierta].campo!.ayuda}
                  </p>
                </div>
              ) : null}

              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-estado-rojo/30 bg-estado-rojo-fondo px-3 py-2 text-sm text-estado-rojo"
                >
                  {error}
                </p>
              ) : null}

              <AlertDialogFooter>
                <AlertDialogCancel disabled={enCurso}>Cancelar</AlertDialogCancel>
                <Button
                  variant={PRESENTACION[abierta].variante}
                  onClick={() => ejecutar(abierta)}
                  disabled={
                    enCurso || (Boolean(PRESENTACION[abierta].campo) && texto.trim().length < 10)
                  }
                >
                  {enCurso ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Procesando…
                    </>
                  ) : (
                    PRESENTACION[abierta].etiqueta
                  )}
                </Button>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
