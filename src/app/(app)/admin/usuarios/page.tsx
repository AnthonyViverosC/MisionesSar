import type { Metadata } from "next";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { exigirRol } from "@/lib/sesion";
import { ETIQUETA_ROL, ROLES, type Rol } from "@/dominio/roles";
import { Badge } from "@/components/ui/badge";
import { DialogoInvitacion } from "@/components/admin/dialogo-invitacion";
import { AccionesUsuario } from "@/components/admin/acciones-usuario";
import { FiltrosUsuarios } from "./filtros-usuarios";

export const metadata: Metadata = { title: "Usuarios" };

const esquemaFiltros = z.object({
  rol: z.enum(ROLES).optional(),
  estado: z.enum(["activo", "inactivo", "pendiente"]).optional(),
  q: z.string().trim().max(80).optional(),
});

export default async function PaginaUsuarios({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Esta pantalla usa la clave de servicio para leer los correos: el rol se
  // comprueba aquí y no solo en el layout, que se renderiza en paralelo.
  await exigirRol("admin");

  const filtros = esquemaFiltros.parse(await searchParams);
  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("perfiles")
    .select(
      "id, nombre_completo, documento_identidad, grado, telefono, rol, unidad_id, activo, debe_cambiar_clave, aviso_aceptado_en, ultimo_acceso, unidades(nombre)",
    )
    .order("nombre_completo");

  if (filtros.rol) consulta = consulta.eq("rol", filtros.rol);
  if (filtros.estado === "activo") consulta = consulta.eq("activo", true);
  if (filtros.estado === "inactivo") consulta = consulta.eq("activo", false);
  if (filtros.estado === "pendiente") consulta = consulta.is("aviso_aceptado_en", null);
  if (filtros.q) {
    consulta = consulta.or(
      `nombre_completo.ilike.%${filtros.q}%,documento_identidad.ilike.%${filtros.q}%`,
    );
  }

  const [{ data: perfiles }, { data: unidades }] = await Promise.all([
    consulta,
    supabase.from("unidades").select("id, nombre, activa").order("nombre"),
  ]);

  // El correo vive en auth.users, fuera del alcance de RLS. Es uno de los usos
  // previstos de la clave de servicio, ya con el rol de admin comprobado por el
  // layout de esta sección.
  const servicio = crearClienteServicio();
  const { data: cuentas } = await servicio.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const correos = new Map((cuentas?.users ?? []).map((cuenta) => [cuenta.id, cuenta.email ?? ""]));

  const filas = perfiles ?? [];
  const opcionesUnidad = (unidades ?? []).map((unidad) => ({
    id: unidad.id,
    nombre: unidad.activa ? unidad.nombre : `${unidad.nombre} (inactiva)`,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-texto-suave">
          {filas.length === 0
            ? "Ninguna cuenta coincide con el filtro."
            : `${filas.length} cuenta${filas.length === 1 ? "" : "s"}.`}
        </p>

        <DialogoInvitacion unidades={opcionesUnidad} />
      </div>

      <section className="rounded-lg border border-borde bg-card">
        <FiltrosUsuarios />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Cuentas del sistema</caption>
            <thead>
              <tr className="border-y border-borde bg-superficie text-left">
                <th scope="col" className="px-4 py-2.5 text-xs font-medium text-texto-suave">
                  Nombre
                </th>
                <th scope="col" className="px-4 py-2.5 text-xs font-medium text-texto-suave">
                  Correo
                </th>
                <th scope="col" className="w-36 px-4 py-2.5 text-xs font-medium text-texto-suave">
                  Rol
                </th>
                <th scope="col" className="w-48 px-4 py-2.5 text-xs font-medium text-texto-suave">
                  Unidad
                </th>
                <th scope="col" className="w-36 px-4 py-2.5 text-xs font-medium text-texto-suave">
                  Estado
                </th>
                <th scope="col" className="w-16 px-4 py-2.5 text-right text-xs font-medium text-texto-suave">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-borde">
              {filas.map((perfil) => {
                const unidad = perfil.unidades as { nombre: string } | null;
                const pendiente = !perfil.aviso_aceptado_en;

                return (
                  <tr key={perfil.id} className="hover:bg-superficie">
                    <td className="px-4 py-3">
                      <p className="font-medium text-texto">
                        {perfil.grado ? `${perfil.grado} ` : ""}
                        {perfil.nombre_completo}
                      </p>
                      <p className="text-xs tabular-nums text-texto-suave">
                        C.C. {perfil.documento_identidad}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-texto-suave">
                      {correos.get(perfil.id) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-texto">{ETIQUETA_ROL[perfil.rol as Rol]}</td>
                    <td className="px-4 py-3 text-texto-suave">{unidad?.nombre ?? "—"}</td>
                    <td className="px-4 py-3">
                      {!perfil.activo ? (
                        <Badge variant="destructive">Desactivada</Badge>
                      ) : pendiente ? (
                        <Badge variant="secondary">Sin estrenar</Badge>
                      ) : (
                        <Badge variant="outline">Activa</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AccionesUsuario
                        usuario={{
                          id: perfil.id,
                          correo: correos.get(perfil.id) ?? "",
                          nombre_completo: perfil.nombre_completo,
                          documento_identidad: perfil.documento_identidad,
                          grado: perfil.grado ?? "",
                          telefono: perfil.telefono ?? "",
                          rol: perfil.rol as Rol,
                          unidad_id: perfil.unidad_id ?? "",
                          activo: perfil.activo,
                          ultimo_acceso: perfil.ultimo_acceso,
                        }}
                        unidades={opcionesUnidad}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filas.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium text-texto">Sin resultados.</p>
            <p className="mt-1 text-sm text-texto-suave">
              Ajusta los filtros o invita a una cuenta nueva.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
