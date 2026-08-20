import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirSesion } from "@/lib/sesion";
import { FormularioMision } from "@/components/misiones/formulario-mision";

export const metadata: Metadata = { title: "Nueva misión" };

export default async function PaginaNuevaMision() {
  const sesion = await exigirSesion();

  // Crear misiones es del operador y del admin. El resto no debería llegar aquí
  // porque el enlace no aparece, pero la ruta se protege igual.
  if (sesion.rol !== "operador" && sesion.rol !== "admin") {
    redirect("/misiones");
  }

  const supabase = await crearClienteServidor();
  const [{ data: unidades }, { data: aeronaves }, { data: tipos }] = await Promise.all([
    supabase.from("unidades").select("id, nombre").eq("activa", true).order("nombre"),
    supabase
      .from("aeronaves")
      .select("id, matricula, unidad_id")
      .eq("activa", true)
      .order("matricula"),
    supabase.from("tipos_mision").select("id, nombre").eq("activo", true).order("orden"),
  ]);

  const anio = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold text-texto">Nueva misión</h1>
        <p className="text-sm text-texto-suave">
          Registra los datos generales. Los ocho soportes se cargan en el paso siguiente.
        </p>
      </header>

      <FormularioMision
        modo="crear"
        valoresIniciales={{
          numero_mision: `${anio}-`,
          unidad_id: sesion.unidadId ?? "",
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
