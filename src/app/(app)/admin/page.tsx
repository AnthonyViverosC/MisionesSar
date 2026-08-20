import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirRol } from "@/lib/sesion";
import { ETIQUETA_ROL, ROLES, DESCRIPCION_ROL } from "@/dominio/roles";
import { ETIQUETA_ACCION_AUDITORIA } from "@/dominio/auditoria";
import type { AccionAuditoria } from "@/tipos/basedatos";

export const metadata: Metadata = { title: "Administración" };

export default async function PaginaAdmin() {
  // El layout ya lo exige, pero layout y página se renderizan en paralelo: cada
  // pantalla de administración comprueba el rol por su cuenta.
  await exigirRol("admin");
  const supabase = await crearClienteServidor();

  const [porRol, pendientes, inactivos, catalogos, ultimos] = await Promise.all([
    Promise.all(
      ROLES.map(async (rol) => {
        const { count } = await supabase
          .from("perfiles")
          .select("id", { count: "exact", head: true })
          .eq("rol", rol)
          .eq("activo", true);
        return { rol, total: count ?? 0 };
      }),
    ),
    supabase
      .from("perfiles")
      .select("id", { count: "exact", head: true })
      .eq("activo", true)
      .is("aviso_aceptado_en", null),
    supabase.from("perfiles").select("id", { count: "exact", head: true }).eq("activo", false),
    Promise.all([
      supabase.from("unidades").select("id", { count: "exact", head: true }).eq("activa", true),
      supabase.from("aeronaves").select("id", { count: "exact", head: true }).eq("activa", true),
      supabase.from("tipos_mision").select("id", { count: "exact", head: true }).eq("activo", true),
    ]),
    supabase
      .from("auditoria")
      .select("id, accion, entidad, actor_email, creado_en")
      .order("creado_en", { ascending: false })
      .limit(8),
  ]);

  const [unidades, aeronaves, tipos] = catalogos;
  const sinEstrenar = pendientes.count ?? 0;

  return (
    <div className="space-y-8">
      {/* Cuentas por rol */}
      <section aria-labelledby="titulo-cuentas" className="space-y-3">
        <h2 id="titulo-cuentas" className="text-sm font-medium text-texto-suave">
          Cuentas activas por rol
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {porRol.map(({ rol, total }) => (
            <Link
              key={rol}
              href={`/admin/usuarios?rol=${rol}`}
              className="rounded-lg border border-borde bg-card p-4 transition-colors hover:border-borde-fuerte"
            >
              <p className="text-3xl font-semibold tabular-nums text-texto">{total}</p>
              <p className="mt-1 text-sm font-medium text-texto">{ETIQUETA_ROL[rol]}</p>
              <p className="mt-0.5 text-xs text-texto-suave">{DESCRIPCION_ROL[rol]}</p>
            </Link>
          ))}
        </div>
      </section>

      {sinEstrenar > 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-estado-ambar/40 bg-estado-ambar-fondo px-4 py-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-estado-ambar" aria-hidden />
          <p className="text-sm text-texto">
            {sinEstrenar === 1
              ? "Hay una cuenta que todavía no completó el primer ingreso."
              : `Hay ${sinEstrenar} cuentas que todavía no completaron el primer ingreso.`}{" "}
            <Link href="/admin/usuarios?estado=pendiente" className="font-medium underline">
              Revisarlas
            </Link>
            .
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Catálogos */}
        <section aria-labelledby="titulo-catalogos" className="rounded-lg border border-borde bg-card">
          <div className="flex items-center justify-between border-b border-borde px-4 py-3">
            <h2 id="titulo-catalogos" className="text-sm font-medium text-texto">
              Catálogos
            </h2>
            <Link
              href="/admin/catalogos"
              className="flex items-center gap-1 text-xs font-medium text-marina-900 hover:underline"
            >
              Mantener
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>

          <dl className="divide-y divide-borde">
            {[
              { etiqueta: "Unidades activas", valor: unidades.count ?? 0 },
              { etiqueta: "Aeronaves activas", valor: aeronaves.count ?? 0 },
              { etiqueta: "Tipos de misión", valor: tipos.count ?? 0 },
              { etiqueta: "Cuentas desactivadas", valor: inactivos.count ?? 0 },
            ].map((fila) => (
              <div key={fila.etiqueta} className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-texto-suave">{fila.etiqueta}</dt>
                <dd className="text-sm font-medium tabular-nums text-texto">{fila.valor}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Últimos eventos */}
        <section
          aria-labelledby="titulo-bitacora"
          className="lg:col-span-2 rounded-lg border border-borde bg-card"
        >
          <div className="flex items-center justify-between border-b border-borde px-4 py-3">
            <h2 id="titulo-bitacora" className="text-sm font-medium text-texto">
              Últimos movimientos
            </h2>
            <Link
              href="/admin/auditoria"
              className="flex items-center gap-1 text-xs font-medium text-marina-900 hover:underline"
            >
              Ver la bitácora
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>

          {ultimos.data && ultimos.data.length > 0 ? (
            <ul className="divide-y divide-borde">
              {ultimos.data.map((evento) => (
                <li key={evento.id} className="flex flex-wrap items-center gap-x-3 px-4 py-2.5">
                  <span className="text-sm text-texto">
                    {ETIQUETA_ACCION_AUDITORIA[evento.accion as AccionAuditoria]}
                  </span>
                  <span className="text-xs text-texto-suave">{evento.entidad}</span>
                  <span className="ml-auto text-xs text-texto-suave">
                    {evento.actor_email ?? "sistema"}
                  </span>
                  <time dateTime={evento.creado_en} className="text-xs tabular-nums text-texto-suave">
                    {new Date(evento.creado_en).toLocaleString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-texto-suave">
              La bitácora está vacía.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
