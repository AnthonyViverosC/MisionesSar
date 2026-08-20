import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirSesion } from "@/lib/sesion";
import { FormularioMision } from "@/components/misiones/formulario-mision";
import { admiteEdicion } from "@/dominio/estados";

export const metadata: Metadata = { title: "Editar misión" };

export default async function PaginaEditarMision({
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

  // Si RLS no la devuelve, para este usuario la misión no existe.
  if (!mision) notFound();

  const puedeEditar =
    sesion.rol === "admin"
      ? mision.estado !== "aprobada" && mision.estado !== "anulada"
      : sesion.rol === "operador" &&
        mision.creada_por === sesion.usuarioId &&
        admiteEdicion(mision.estado);

  if (!puedeEditar) {
    redirect(`/misiones/${id}`);
  }

  const [{ data: unidades }, { data: aeronaves }, { data: tipos }] = await Promise.all([
    supabase.from("unidades").select("id, nombre").eq("activa", true).order("nombre"),
    supabase
      .from("aeronaves")
      .select("id, matricula, unidad_id")
      .eq("activa", true)
      .order("matricula"),
    supabase.from("tipos_mision").select("id, nombre").eq("activo", true).order("orden"),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold text-texto">
          Editar misión {mision.numero_mision}
        </h1>
        <p className="text-sm text-texto-suave">
          Los cambios se guardan solos mientras escribes.
        </p>
      </header>

      <FormularioMision
        modo="editar"
        misionId={mision.id}
        valoresIniciales={{
          numero_mision: mision.numero_mision,
          fecha_inicio: mision.fecha_inicio,
          fecha_fin: mision.fecha_fin ?? "",
          tipo_mision_id: mision.tipo_mision_id,
          aeronave_id: mision.aeronave_id,
          unidad_id: mision.unidad_id,
          comandante_aeronave: mision.comandante_aeronave,
          zona_operacion: mision.zona_operacion,
          latitud: mision.latitud === null ? "" : String(mision.latitud),
          longitud: mision.longitud === null ? "" : String(mision.longitud),
          horas_vuelo: mision.horas_vuelo === null ? "" : String(mision.horas_vuelo),
          resumen: mision.resumen ?? "",
        }}
        unidades={unidades ?? []}
        aeronaves={(aeronaves ?? []).map((a) => ({
          id: a.id,
          nombre: a.matricula,
          unidad_id: a.unidad_id,
        }))}
        tipos={tipos ?? []}
        unidadPropia={sesion.unidadId}
        puedeElegirUnidad={sesion.rol === "admin"}
      />
    </div>
  );
}
