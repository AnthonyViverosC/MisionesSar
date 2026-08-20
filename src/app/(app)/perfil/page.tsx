import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirSesion } from "@/lib/sesion";
import { ETIQUETA_ROL, DESCRIPCION_ROL } from "@/dominio/roles";
import { entornoPublico } from "@/lib/entorno";
import { FormularioPerfil } from "./formulario-perfil";
import { FormularioContrasena } from "./formulario-contrasena";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function PaginaPerfil() {
  const sesion = await exigirSesion();
  const supabase = await crearClienteServidor();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo, documento_identidad, grado, telefono, ultimo_acceso, creado_en")
    .eq("id", sesion.usuarioId)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold text-texto">Mi perfil</h1>
        <p className="text-sm text-texto-suave">
          Tus datos de contacto y el acceso a tu cuenta.
        </p>
      </header>

      {/* Datos que fija la administración */}
      <section className="rounded-lg border border-borde bg-card">
        <div className="border-b border-borde px-4 py-3">
          <h2 className="text-sm font-medium text-texto">Cuenta</h2>
        </div>

        <dl className="divide-y divide-borde">
          {[
            { etiqueta: "Correo", valor: sesion.correo },
            { etiqueta: "Documento de identidad", valor: perfil?.documento_identidad ?? "—" },
            { etiqueta: "Rol", valor: ETIQUETA_ROL[sesion.rol] },
            { etiqueta: "Unidad", valor: sesion.unidadNombre ?? "Sin unidad asignada" },
            {
              etiqueta: "Último acceso",
              valor: perfil?.ultimo_acceso
                ? new Date(perfil.ultimo_acceso).toLocaleString("es-CO")
                : "Este es tu primer ingreso",
            },
          ].map((fila) => (
            <div key={fila.etiqueta} className="flex flex-wrap gap-2 px-4 py-2.5">
              <dt className="w-56 text-sm text-texto-suave">{fila.etiqueta}</dt>
              <dd className="text-sm text-texto">{fila.valor}</dd>
            </div>
          ))}
        </dl>

        <p className="border-t border-borde px-4 py-3 text-xs text-texto-suave">
          {DESCRIPCION_ROL[sesion.rol]} El correo, el rol y la unidad los cambia un
          administrador.
        </p>
      </section>

      <FormularioPerfil
        valores={{
          nombre_completo: perfil?.nombre_completo ?? sesion.nombreCompleto,
          grado: perfil?.grado ?? "",
          telefono: perfil?.telefono ?? "",
        }}
      />

      <FormularioContrasena />

      <section className="rounded-lg border border-borde bg-card px-4 py-3">
        <h2 className="text-sm font-medium text-texto">Sesión</h2>
        <p className="mt-1 text-sm text-texto-suave">
          La sesión se cierra sola tras {entornoPublico.NEXT_PUBLIC_MINUTOS_INACTIVIDAD} minutos
          sin actividad. Al
          desactivarse una cuenta, su sesión termina en la siguiente petición.
        </p>
      </section>
    </div>
  );
}
