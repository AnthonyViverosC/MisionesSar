import { exigirRol } from "@/lib/sesion";
import { PestanasAdmin } from "./pestanas-admin";

/**
 * Marco de la administración.
 *
 * El rol se comprueba aquí una vez para todo el subárbol; cada Server Action
 * vuelve a comprobarlo por su cuenta y RLS lo exige de nuevo en la base.
 */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  await exigirRol("admin");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold text-texto">Administración</h1>
        <p className="text-sm text-texto-suave">
          Cuentas, catálogos y bitácora del sistema.
        </p>
      </header>

      <PestanasAdmin />

      {children}
    </div>
  );
}
