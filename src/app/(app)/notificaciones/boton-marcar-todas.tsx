"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck, Loader2 } from "lucide-react";
import { marcarTodasLeidas } from "@/acciones/notificaciones";
import { Button } from "@/components/ui/button";

/** Vacía el contador de la campana de una sola vez. */
export function BotonMarcarTodas() {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={enviando}
      onClick={() =>
        iniciar(async () => {
          const resultado = await marcarTodasLeidas();

          if (!resultado.ok) {
            toast.error(resultado.error);
            return;
          }

          router.refresh();
        })
      }
    >
      {enviando ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <CheckCheck className="size-4" aria-hidden />
      )}
      Marcar todo como leído
    </Button>
  );
}
