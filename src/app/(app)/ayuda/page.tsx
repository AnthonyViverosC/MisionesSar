import type { Metadata } from "next";
import Link from "next/link";
import { exigirSesion } from "@/lib/sesion";
import { DESCRIPCION_ROL, ETIQUETA_ROL, ROLES } from "@/dominio/roles";
import { ETIQUETA_ESTADO } from "@/dominio/estados";
import {
  BLOQUES_CARGA,
  formatearTamano,
  REGLAS_DOCUMENTO,
  TOTAL_ARCHIVOS,
  type TipoDocumento,
} from "@/dominio/soportes";
import { INSTITUCION } from "@/config/institucion";

export const metadata: Metadata = { title: "Ayuda" };

/** Preguntas que aparecen una y otra vez al empezar a usar el sistema. */
const PREGUNTAS = [
  {
    titulo: "No puedo enviar la misión a revisión",
    respuesta: `El botón solo se habilita con los ${TOTAL_ARCHIVOS} archivos cargados. El indicador de progreso dice cuántos faltan, y el checklist del expediente señala cuál.`,
  },
  {
    titulo: "Subí un documento equivocado",
    respuesta:
      "Vuelve a subirlo en el mismo bloque: el nuevo queda como versión vigente y el anterior se conserva en el historial. Nada se borra.",
  },
  {
    titulo: "Me devolvieron la misión",
    respuesta:
      "Abre el expediente y lee el hilo de observaciones. Corrige lo señalado, responde en el hilo si hace falta y vuelve a enviarla.",
  },
  {
    titulo: "Necesito cambiar una misión ya aprobada",
    respuesta:
      "No se puede: una misión aprobada es inmutable. Si el expediente tiene un error grave, un administrador la anula con motivo y se registra una nueva.",
  },
  {
    titulo: "Olvidé mi contraseña",
    respuesta:
      "Usa «Recuperar» en la pantalla de ingreso. Si el correo no llega, pide a un administrador que reenvíe el acceso desde la administración de usuarios.",
  },
  {
    titulo: "La sesión se cierra sola",
    respuesta:
      "Es la expiración por inactividad. Aparece un aviso antes de cerrarse; basta con responder para continuar trabajando.",
  },
];

export default async function PaginaAyuda() {
  const sesion = await exigirSesion();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold text-texto">Ayuda</h1>
        <p className="text-sm text-texto-suave">
          Cómo funciona el archivo digital de misiones de {INSTITUCION.unidadPropietaria}.
        </p>
      </header>

      {/* Flujo */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-texto-suave">El recorrido de una misión</h2>

        <ol className="space-y-2 rounded-lg border border-borde bg-card px-4 py-4">
          {[
            {
              estado: "borrador",
              texto:
                "El operador crea la misión con sus datos y carga los soportes. Puede editarla cuanto quiera.",
            },
            {
              estado: "enviada",
              texto: `Con los ${TOTAL_ARCHIVOS} archivos completos, el operador la envía. Deja de poder editarla.`,
            },
            {
              estado: "en_revision",
              texto: "El supervisor la toma y queda registrado como responsable de la revisión.",
            },
            {
              estado: "observada",
              texto:
                "Si algo falta o está mal, la devuelve con una observación escrita. El operador corrige y vuelve a enviar.",
            },
            {
              estado: "aprobada",
              texto: "Queda cerrada e inmutable, y pasa al archivo.",
            },
            {
              estado: "anulada",
              texto:
                "Solo un administrador puede anular, siempre con motivo. La misión se conserva; no se borra.",
            },
          ].map((paso, indice) => (
            <li key={paso.estado} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-superficie text-xs font-medium tabular-nums text-texto-suave">
                {indice + 1}
              </span>
              <p className="text-sm text-texto">
                <span className="font-medium">
                  {ETIQUETA_ESTADO[paso.estado as keyof typeof ETIQUETA_ESTADO]}:
                </span>{" "}
                <span className="text-texto-suave">{paso.texto}</span>
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Soportes */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-texto-suave">
          Los soportes obligatorios ({TOTAL_ARCHIVOS} archivos)
        </h2>

        <div className="overflow-x-auto rounded-lg border border-borde bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde bg-superficie text-left">
                <th scope="col" className="px-4 py-2.5 text-xs font-medium text-texto-suave">
                  Soporte
                </th>
                <th scope="col" className="px-4 py-2.5 text-xs font-medium text-texto-suave">
                  Formato
                </th>
                <th scope="col" className="px-4 py-2.5 text-xs font-medium text-texto-suave">
                  Cantidad
                </th>
                <th scope="col" className="px-4 py-2.5 text-xs font-medium text-texto-suave">
                  Tamaño máximo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {BLOQUES_CARGA.map((bloque) => {
                const reglas = bloque.tipos.map((tipo) => REGLAS_DOCUMENTO[tipo as TipoDocumento]);
                const cantidad = reglas.reduce((suma, regla) => suma + regla.cantidad, 0);
                const maximo = Math.max(...reglas.map((regla) => regla.tamanoMaximo));

                return (
                  <tr key={bloque.numero}>
                    <td className="px-4 py-2.5 text-texto">
                      {bloque.numero}. {bloque.titulo}
                    </td>
                    <td className="px-4 py-2.5 text-texto-suave">
                      {reglas.map((regla) => regla.formatoLegible).join(" + ")}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-texto-suave">{cantidad}</td>
                    <td className="px-4 py-2.5 tabular-nums text-texto-suave">
                      {formatearTamano(maximo)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-texto-suave">
          De cada archivo se guarda su huella SHA-256, se verifica su contenido real —no basta
          con renombrar la extensión— y se conservan todas las versiones anteriores.
        </p>
      </section>

      {/* Roles */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-texto-suave">Qué puede hacer cada rol</h2>

        <dl className="divide-y divide-borde rounded-lg border border-borde bg-card">
          {ROLES.map((rol) => (
            <div key={rol} className="px-4 py-3">
              <dt className="flex items-center gap-2 text-sm font-medium text-texto">
                {ETIQUETA_ROL[rol]}
                {rol === sesion.rol ? (
                  <span className="rounded bg-superficie px-1.5 py-0.5 text-xs font-normal text-texto-suave">
                    tu rol
                  </span>
                ) : null}
              </dt>
              <dd className="mt-0.5 text-sm text-texto-suave">{DESCRIPCION_ROL[rol]}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Preguntas frecuentes */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-texto-suave">Dudas frecuentes</h2>

        <div className="divide-y divide-borde rounded-lg border border-borde bg-card">
          {PREGUNTAS.map((pregunta) => (
            <details key={pregunta.titulo} className="group px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-texto marker:text-texto-suave">
                {pregunta.titulo}
              </summary>
              <p className="mt-2 text-sm text-texto-suave">{pregunta.respuesta}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-borde bg-card px-4 py-3">
        <h2 className="text-sm font-medium text-texto">¿Sigues con dudas?</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Escribe al administrador del sistema de tu unidad ({INSTITUCION.correoContacto}). Para
          el tratamiento de los datos, consulta el{" "}
          <Link href="/privacidad" className="font-medium text-marina-900 hover:underline">
            aviso de privacidad
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
