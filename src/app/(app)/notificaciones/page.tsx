import type { Metadata } from "next";
import { BellOff, ChevronRight } from "lucide-react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirSesion } from "@/lib/sesion";
import { abrirNotificacion } from "@/acciones/notificaciones";
import { EtiquetaEstado } from "@/components/misiones/etiqueta-estado";
import {
  COLOR_NOTIFICACION,
  DETALLE_NOTIFICACION,
  TITULO_NOTIFICACION,
  type TipoNotificacion,
} from "@/dominio/notificaciones";
import type { EstadoMision } from "@/dominio/estados";
import { BotonMarcarTodas } from "./boton-marcar-todas";

export const metadata: Metadata = { title: "Notificaciones" };

/** Últimos avisos del usuario. Los antiguos siguen en la base, no se borran. */
const MAXIMO = 50;

export default async function PaginaNotificaciones() {
  await exigirSesion();
  const supabase = await crearClienteServidor();

  // RLS ya limita las filas a las del destinatario: no hace falta filtrar aquí.
  const { data: notificaciones } = await supabase
    .from("notificaciones")
    .select("id, tipo, leida, creado_en, mision_id, misiones(numero_mision, estado)")
    .order("creado_en", { ascending: false })
    .limit(MAXIMO);

  const filas = notificaciones ?? [];
  const sinLeer = filas.filter((fila) => !fila.leida).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold text-texto">Notificaciones</h1>
          <p className="text-sm text-texto-suave">
            {sinLeer > 0
              ? `Tienes ${sinLeer} aviso${sinLeer === 1 ? "" : "s"} sin leer.`
              : "Estás al día."}
          </p>
        </div>

        {sinLeer > 0 ? <BotonMarcarTodas /> : null}
      </header>

      {filas.length > 0 ? (
        <ul className="divide-y divide-borde rounded-lg border border-borde bg-card">
          {filas.map((fila) => {
            const tipo = fila.tipo as TipoNotificacion;
            const mision = fila.misiones as {
              numero_mision: string;
              estado: EstadoMision;
            } | null;

            return (
              <li key={fila.id}>
                <form action={abrirNotificacion}>
                  <input type="hidden" name="id" value={fila.id} />
                  <input type="hidden" name="mision" value={fila.mision_id} />

                  <button
                    type="submit"
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-superficie"
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        fila.leida ? "bg-borde-fuerte" : COLOR_NOTIFICACION[tipo]
                      }`}
                    />

                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm ${fila.leida ? "text-texto-suave" : "font-medium text-texto"}`}
                        >
                          {TITULO_NOTIFICACION[tipo]}
                        </span>
                        {mision ? (
                          <span className="font-mono text-xs text-texto-suave">
                            {mision.numero_mision}
                          </span>
                        ) : null}
                        {mision ? <EtiquetaEstado estado={mision.estado} /> : null}
                      </span>

                      <span className="block text-sm text-texto-suave">
                        {DETALLE_NOTIFICACION[tipo]}
                      </span>

                      <time dateTime={fila.creado_en} className="block text-xs text-texto-suave">
                        {new Date(fila.creado_en).toLocaleString("es-CO", {
                          day: "2-digit",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </span>

                    <ChevronRight className="mt-1 size-4 shrink-0 text-texto-suave" aria-hidden />
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-lg border border-borde bg-card px-4 py-16 text-center">
          <BellOff className="mx-auto size-8 text-texto-suave" aria-hidden />
          <p className="mt-3 text-sm font-medium text-texto">No tienes avisos.</p>
          <p className="mt-1 text-sm text-texto-suave">
            Aquí aparecerán los cambios de estado de las misiones que te competen.
          </p>
        </div>
      )}
    </div>
  );
}
