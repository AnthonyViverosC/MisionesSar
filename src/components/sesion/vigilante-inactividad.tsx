"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { continuarSesion } from "@/acciones/autenticacion";
import { MS_AVISO_PREVIO, MS_INACTIVIDAD } from "@/lib/entorno";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Aviso de expiración por inactividad.
 *
 * Dos minutos antes de que venza la sesión aparece un diálogo con la cuenta
 * regresiva y la opción de continuar, que renueva el token. Si nadie responde,
 * la sesión se cierra sola.
 *
 * Quien decide de verdad si la sesión sigue viva es el middleware: esto solo
 * evita que el usuario pierda trabajo sin enterarse.
 */
export function VigilanteInactividad() {
  const router = useRouter();
  const [avisando, setAvisando] = useState(false);
  const [segundos, setSegundos] = useState(Math.floor(MS_AVISO_PREVIO / 1000));
  // Se inicializa en el efecto: leer el reloj durante el render no es puro.
  const ultimaActividad = useRef(0);

  const registrarActividad = useCallback(() => {
    ultimaActividad.current = Date.now();
    setAvisando(false);
  }, []);

  useEffect(() => {
    // Arranque del contador: solo toca la referencia, sin provocar un render.
    ultimaActividad.current = Date.now();

    const eventos: (keyof WindowEventMap)[] = [
      "pointerdown",
      "keydown",
      "scroll",
      "focus",
    ];
    eventos.forEach((evento) => window.addEventListener(evento, registrarActividad));

    const reloj = window.setInterval(() => {
      const inactivo = Date.now() - ultimaActividad.current;
      const restante = MS_INACTIVIDAD - inactivo;

      if (restante <= 0) {
        // Se acabó el tiempo. Navegar fuerza el paso por el proxy, que es quien
        // cierra la sesión de verdad.
        router.replace("/login?motivo=inactividad");
        return;
      }

      if (restante <= MS_AVISO_PREVIO) {
        setAvisando(true);
        setSegundos(Math.ceil(restante / 1000));
      }
    }, 1000);

    return () => {
      eventos.forEach((evento) => window.removeEventListener(evento, registrarActividad));
      window.clearInterval(reloj);
    };
  }, [registrarActividad, router]);

  async function continuar() {
    await continuarSesion();
    registrarActividad();
  }

  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;

  return (
    <AlertDialog open={avisando}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="size-5 text-estado-ambar" aria-hidden />
            Tu sesión está por cerrarse
          </AlertDialogTitle>
          <AlertDialogDescription>
            Por seguridad, la sesión se cierra tras {Math.floor(MS_INACTIVIDAD / 60000)} minutos
            sin actividad. Se cerrará en{" "}
            <span className="font-mono font-medium text-texto" aria-live="polite">
              {minutos}:{String(resto).padStart(2, "0")}
            </span>
            . Lo que tengas guardado como borrador se conserva.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={continuar}>Continuar trabajando</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
