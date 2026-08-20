import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirRol } from "@/lib/sesion";
import { Badge } from "@/components/ui/badge";
import {
  DialogoAeronave,
  DialogoTipoMision,
  DialogoUnidad,
} from "@/components/admin/dialogos-catalogo";

export const metadata: Metadata = { title: "Catálogos" };

/** Marca de activo o inactivo, común a los tres catálogos. */
function Estado({ activo }: { activo: boolean }) {
  return activo ? (
    <Badge variant="outline">Activo</Badge>
  ) : (
    <Badge variant="secondary">Inactivo</Badge>
  );
}

export default async function PaginaCatalogos() {
  // Layout y página se renderizan en paralelo: el rol se comprueba también aquí.
  await exigirRol("admin");
  const supabase = await crearClienteServidor();

  const [{ data: unidades }, { data: aeronaves }, { data: tipos }] = await Promise.all([
    supabase.from("unidades").select("id, codigo, nombre, activa").order("nombre"),
    supabase
      .from("aeronaves")
      .select("id, matricula, tipo, unidad_id, activa, unidades(nombre)")
      .order("matricula"),
    supabase.from("tipos_mision").select("id, codigo, nombre, orden, activo").order("orden"),
  ]);

  const opcionesUnidad = (unidades ?? []).map((unidad) => ({
    id: unidad.id,
    nombre: unidad.nombre,
  }));

  return (
    <div className="space-y-6">
      <p className="text-sm text-texto-suave">
        Los catálogos no se borran. Al desactivar uno deja de ofrecerse en las misiones
        nuevas, y las que ya lo usan conservan el dato con el que se ejecutaron.
      </p>

      {/* Unidades */}
      <section className="rounded-lg border border-borde bg-card">
        <div className="flex items-center justify-between border-b border-borde px-4 py-3">
          <h2 className="text-sm font-medium text-texto">
            Unidades <span className="text-texto-suave">({unidades?.length ?? 0})</span>
          </h2>
          <DialogoUnidad />
        </div>

        <ul className="divide-y divide-borde">
          {(unidades ?? []).map((unidad) => (
            <li key={unidad.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-24 shrink-0 font-mono text-xs text-texto-suave">
                {unidad.codigo}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-texto">{unidad.nombre}</span>
              <Estado activo={unidad.activa} />
              <DialogoUnidad
                unidad={{
                  id: unidad.id,
                  codigo: unidad.codigo,
                  nombre: unidad.nombre,
                  activa: unidad.activa,
                }}
              />
            </li>
          ))}
        </ul>

        {(unidades?.length ?? 0) === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-texto-suave">
            No hay unidades registradas. Crea al menos una antes de invitar operadores.
          </p>
        ) : null}
      </section>

      {/* Aeronaves */}
      <section className="rounded-lg border border-borde bg-card">
        <div className="flex items-center justify-between border-b border-borde px-4 py-3">
          <h2 className="text-sm font-medium text-texto">
            Aeronaves <span className="text-texto-suave">({aeronaves?.length ?? 0})</span>
          </h2>
          <DialogoAeronave unidades={opcionesUnidad} />
        </div>

        <ul className="divide-y divide-borde">
          {(aeronaves ?? []).map((aeronave) => {
            const unidad = aeronave.unidades as { nombre: string } | null;

            return (
              <li key={aeronave.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-24 shrink-0 font-mono text-xs text-texto">
                  {aeronave.matricula}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-texto">
                  {aeronave.tipo}
                </span>
                <span className="hidden truncate text-xs text-texto-suave sm:block sm:w-56">
                  {unidad?.nombre ?? "—"}
                </span>
                <Estado activo={aeronave.activa} />
                <DialogoAeronave
                  unidades={opcionesUnidad}
                  aeronave={{
                    id: aeronave.id,
                    matricula: aeronave.matricula,
                    tipo: aeronave.tipo,
                    unidad_id: aeronave.unidad_id,
                    activa: aeronave.activa,
                  }}
                />
              </li>
            );
          })}
        </ul>

        {(aeronaves?.length ?? 0) === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-texto-suave">
            No hay aeronaves registradas.
          </p>
        ) : null}
      </section>

      {/* Tipos de misión */}
      <section className="rounded-lg border border-borde bg-card">
        <div className="flex items-center justify-between border-b border-borde px-4 py-3">
          <h2 className="text-sm font-medium text-texto">
            Tipos de misión <span className="text-texto-suave">({tipos?.length ?? 0})</span>
          </h2>
          <DialogoTipoMision />
        </div>

        <ul className="divide-y divide-borde">
          {(tipos ?? []).map((tipo) => (
            <li key={tipo.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-8 shrink-0 text-xs tabular-nums text-texto-suave">
                {tipo.orden}
              </span>
              <span className="w-28 shrink-0 font-mono text-xs text-texto-suave">
                {tipo.codigo}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-texto">{tipo.nombre}</span>
              <Estado activo={tipo.activo} />
              <DialogoTipoMision
                tipo={{
                  id: tipo.id,
                  codigo: tipo.codigo,
                  nombre: tipo.nombre,
                  orden: tipo.orden,
                  activo: tipo.activo,
                }}
              />
            </li>
          ))}
        </ul>

        {(tipos?.length ?? 0) === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-texto-suave">
            No hay tipos de misión registrados.
          </p>
        ) : null}
      </section>
    </div>
  );
}
