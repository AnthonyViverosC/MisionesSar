import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Inbox } from "lucide-react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirSesion } from "@/lib/sesion";
import { AccionesMision } from "@/components/misiones/acciones-mision";
import { EtiquetaEstado } from "@/components/misiones/etiqueta-estado";
import { ProgresoDocumental } from "@/components/misiones/progreso-documental";

export const metadata: Metadata = { title: "Bandeja de revisión" };

/**
 * Cola de misiones que esperan decisión del supervisor.
 *
 * Ordenadas por antigüedad de envío: primero lo que lleva más tiempo esperando.
 * Cada fila trae las acciones de aprobar y devolver, para no obligar a entrar
 * al detalle cuando la revisión ya se hizo por otra vía.
 */
export default async function PaginaBandejaRevision() {
  const sesion = await exigirSesion();

  if (sesion.rol !== "supervisor" && sesion.rol !== "admin") {
    redirect("/misiones");
  }

  const supabase = await crearClienteServidor();

  const { data: misiones } = await supabase
    .from("misiones_con_completitud")
    .select(
      "id, numero_mision, tipo_mision, aeronave_matricula, fecha_inicio, enviada_en, estado, archivos_vigentes, creada_por",
    )
    .in("estado", ["enviada", "en_revision"])
    .order("enviada_en", { ascending: true });

  const { data: personal } = await supabase
    .from("directorio")
    .select("id, nombre_completo, grado");

  const nombres = Object.fromEntries(
    (personal ?? []).map((persona) => [
      persona.id,
      persona.grado ? `${persona.grado} ${persona.nombre_completo}` : persona.nombre_completo,
    ]),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold text-texto">Bandeja de revisión</h1>
        <p className="text-sm text-texto-suave">
          {sesion.unidadNombre
            ? `Misiones de ${sesion.unidadNombre} que esperan tu decisión.`
            : "Misiones que esperan decisión."}
        </p>
      </header>

      {misiones && misiones.length > 0 ? (
        <ul className="space-y-3">
          {misiones.map((mision) => (
            <li key={mision.id} className="rounded-lg border border-borde bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/misiones/${mision.id}`}
                      className="font-mono text-lg font-semibold text-texto hover:underline"
                    >
                      {mision.numero_mision}
                    </Link>
                    <EtiquetaEstado estado={mision.estado} />
                  </div>

                  <p className="text-sm text-texto-suave">
                    {mision.tipo_mision} · {mision.aeronave_matricula} ·{" "}
                    {nombres[mision.creada_por] ?? "—"}
                  </p>

                  <p className="text-xs text-texto-suave">
                    Enviada{" "}
                    {mision.enviada_en ? (
                      <time dateTime={mision.enviada_en}>
                        {new Date(mision.enviada_en).toLocaleString("es-CO", {
                          day: "2-digit",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    ) : (
                      "sin fecha registrada"
                    )}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <ProgresoDocumental cargados={mision.archivos_vigentes} compacto />

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <AccionesMision
                      misionId={mision.id}
                      numeroMision={mision.numero_mision}
                      estado={mision.estado}
                      rol={sesion.rol}
                      esCreador={false}
                      archivosVigentes={mision.archivos_vigentes}
                    />

                    <Link
                      href={`/misiones/${mision.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-marina-900 hover:underline"
                    >
                      Ver expediente
                      <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-borde bg-card px-4 py-16 text-center">
          <Inbox className="mx-auto size-8 text-texto-suave" aria-hidden />
          <p className="mt-3 text-sm font-medium text-texto">La bandeja está vacía.</p>
          <p className="mt-1 text-sm text-texto-suave">
            Cuando un operador envíe una misión completa, aparecerá aquí para tu revisión.
          </p>
        </div>
      )}
    </div>
  );
}
