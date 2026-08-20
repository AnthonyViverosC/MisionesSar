import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, FolderDown, PencilLine, Upload } from "lucide-react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirSesion } from "@/lib/sesion";
import { AccionesMision } from "@/components/misiones/acciones-mision";
import { ChecklistSoportes } from "@/components/misiones/checklist-soportes";
import { EtiquetaEstado } from "@/components/misiones/etiqueta-estado";
import { HiloObservaciones } from "@/components/misiones/hilo-observaciones";
import { LineaTiempo } from "@/components/misiones/linea-tiempo";
import { ProgresoDocumental } from "@/components/misiones/progreso-documental";
import { Button } from "@/components/ui/button";
import { admiteEdicion } from "@/dominio/estados";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("misiones")
    .select("numero_mision")
    .eq("id", id)
    .maybeSingle();

  return { title: data ? `Misión ${data.numero_mision}` : "Misión" };
}

export default async function PaginaDetalleMision({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sesion = await exigirSesion();
  const supabase = await crearClienteServidor();

  const { data: mision } = await supabase
    .from("misiones")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // Si RLS no la entrega, para este usuario la misión no existe.
  if (!mision) notFound();

  const [{ data: documentos }, { data: observaciones }, { data: personal }] =
    await Promise.all([
      supabase
        .from("documentos")
        .select("id, tipo, nombre_original, tamano_bytes, version, creado_en")
        .eq("mision_id", id)
        .eq("vigente", true)
        .order("creado_en"),
      supabase
        .from("observaciones")
        .select("id, texto, creado_en, resuelta, autor_id")
        .eq("mision_id", id)
        .order("creado_en", { ascending: false }),
      supabase.from("directorio").select("id, nombre_completo, grado"),
    ]);

  const nombres = Object.fromEntries(
    (personal ?? []).map((persona) => [
      persona.id,
      persona.grado ? `${persona.grado} ${persona.nombre_completo}` : persona.nombre_completo,
    ]),
  );

  const archivosVigentes = documentos?.length ?? 0;
  const esCreador = mision.creada_por === sesion.usuarioId;

  const puedeEditar =
    sesion.rol === "admin"
      ? mision.estado !== "aprobada" && mision.estado !== "anulada"
      : sesion.rol === "operador" && esCreador && admiteEdicion(mision.estado);

  const datosGenerales: { etiqueta: string; valor: string }[] = [
    { etiqueta: "Tipo de misión", valor: mision.tipo_mision },
    { etiqueta: "Aeronave", valor: mision.aeronave_matricula },
    { etiqueta: "Comandante", valor: mision.comandante_aeronave },
    { etiqueta: "Zona de operación", valor: mision.zona_operacion },
    {
      etiqueta: "Fechas",
      valor: mision.fecha_fin
        ? `${formatearFecha(mision.fecha_inicio)} — ${formatearFecha(mision.fecha_fin)}`
        : formatearFecha(mision.fecha_inicio),
    },
    {
      etiqueta: "Horas de vuelo",
      valor: mision.horas_vuelo === null ? "No registradas" : `${mision.horas_vuelo} h`,
    },
    {
      etiqueta: "Coordenadas",
      valor:
        mision.latitud !== null && mision.longitud !== null
          ? `${mision.latitud}, ${mision.longitud}`
          : "No registradas",
    },
    { etiqueta: "Creada por", valor: nombres[mision.creada_por] ?? "—" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-3xl font-semibold text-texto">
                {mision.numero_mision}
              </h1>
              <EtiquetaEstado estado={mision.estado} />
            </div>
            <p className="text-sm text-texto-suave">
              {mision.tipo_mision} · {mision.zona_operacion}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {archivosVigentes > 0 ? (
              <Button variant="outline" asChild>
                {/* La descarga completa se arma en streaming en el servidor. */}
                <a href={`/api/misiones/${id}/zip`}>
                  <FolderDown className="size-4" aria-hidden />
                  Descargar expediente
                </a>
              </Button>
            ) : null}

            {puedeEditar ? (
              <>
                <Button variant="outline" asChild>
                  <Link href={`/misiones/${id}/editar`}>
                    <PencilLine className="size-4" aria-hidden />
                    Editar datos
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/misiones/${id}/documentos`}>
                    <Upload className="size-4" aria-hidden />
                    Cargar soportes
                  </Link>
                </Button>
              </>
            ) : null}

            <AccionesMision
              misionId={id}
              numeroMision={mision.numero_mision}
              estado={mision.estado}
              rol={sesion.rol}
              esCreador={esCreador}
              archivosVigentes={archivosVigentes}
            />
          </div>
        </div>

        <ProgresoDocumental cargados={archivosVigentes} />

        {mision.estado === "anulada" && mision.motivo_anulacion ? (
          <p className="flex items-start gap-2 rounded-md border border-estado-rojo/30 bg-estado-rojo-fondo px-3 py-2.5 text-sm text-estado-rojo">
            <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong className="font-medium">Misión anulada.</strong>{" "}
              {mision.motivo_anulacion}
            </span>
          </p>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border border-borde bg-card">
            <h2 className="border-b border-borde px-4 py-3 text-sm font-medium text-texto">
              Datos generales
            </h2>
            <dl className="grid gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-2">
              {datosGenerales.map((dato) => (
                <div key={dato.etiqueta}>
                  <dt className="text-xs text-texto-suave">{dato.etiqueta}</dt>
                  <dd className="mt-0.5 text-sm text-texto">{dato.valor}</dd>
                </div>
              ))}
              {mision.resumen ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-texto-suave">Resumen</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-sm text-texto">
                    {mision.resumen}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-lg border border-borde bg-card">
            <div className="flex items-center justify-between border-b border-borde px-4 py-3">
              <h2 className="text-sm font-medium text-texto">Soportes de la misión</h2>
              <span className="text-xs text-texto-suave">{archivosVigentes} de 8 archivos</span>
            </div>
            <ChecklistSoportes
              documentos={documentos ?? []}
              misionId={id}
              puedeCargar={puedeEditar}
            />
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-borde bg-card">
            <h2 className="border-b border-borde px-4 py-3 text-sm font-medium text-texto">
              Observaciones
            </h2>
            {sesion.rol === "consulta" ? (
              <p className="px-4 py-6 text-sm text-texto-suave">
                El hilo de revisión es interno y no está disponible para el rol de consulta.
              </p>
            ) : (
              <HiloObservaciones
                misionId={id}
                observaciones={(observaciones ?? []).map((observacion) => ({
                  id: observacion.id,
                  texto: observacion.texto,
                  creado_en: observacion.creado_en,
                  resuelta: observacion.resuelta,
                  autor: nombres[observacion.autor_id] ?? "Usuario retirado",
                }))}
                puedeResponder={
                  (esCreador || sesion.rol === "supervisor" || sesion.rol === "admin") &&
                  mision.estado !== "aprobada" &&
                  mision.estado !== "anulada"
                }
              />
            )}
          </section>

          <section className="rounded-lg border border-borde bg-card">
            <h2 className="border-b border-borde px-4 py-3 text-sm font-medium text-texto">
              Línea de tiempo
            </h2>
            <LineaTiempo mision={mision} nombres={nombres} />
          </section>
        </div>
      </div>
    </div>
  );
}

function formatearFecha(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
