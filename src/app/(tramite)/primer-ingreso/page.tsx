import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { FormularioPrimerIngreso } from "./formulario-primer-ingreso";

export const metadata: Metadata = { title: "Primer ingreso" };

export default async function PaginaPrimerIngreso() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo, debe_cambiar_clave, aviso_aceptado_en")
    .eq("id", user.id)
    .maybeSingle();

  // Quien ya cumplió el trámite no tiene nada que hacer aquí.
  if (perfil && !perfil.debe_cambiar_clave && perfil.aviso_aceptado_en) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl font-semibold text-texto">
          Define tu contraseña
        </h1>
        <p className="text-sm text-texto-suave">
          {perfil?.nombre_completo ? `${perfil.nombre_completo}: a` : "A"}ntes de entrar por
          primera vez debes establecer una contraseña propia y aceptar el aviso de uso.
        </p>
      </div>

      <FormularioPrimerIngreso />
    </div>
  );
}
