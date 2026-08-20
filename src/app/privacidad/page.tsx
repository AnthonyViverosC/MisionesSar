import type { Metadata } from "next";
import Link from "next/link";
import { Marca } from "@/components/marca/escudo";
import { INSTITUCION } from "@/config/institucion";

export const metadata: Metadata = { title: "Aviso de privacidad" };

/**
 * Aviso de privacidad y política de retención.
 *
 * Es accesible sin sesión porque se enlaza desde el login y desde el trámite de
 * primer ingreso, donde el usuario todavía no ha aceptado nada.
 */
export default function PaginaPrivacidad() {
  return (
    <div className="min-h-screen bg-superficie">
      <header className="bg-marina-900 px-6 py-8 sm:px-10">
        <Marca tamano={44} />
      </header>

      <main id="contenido" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <article className="space-y-8 rounded-lg border border-borde bg-card p-6 sm:p-10">
          <div className="space-y-2">
            <h1 className="font-serif text-3xl font-semibold text-texto">
              Aviso de privacidad y retención de datos
            </h1>
            <p className="text-sm text-texto-suave">
              {INSTITUCION.unidadPropietaria} · {INSTITUCION.nombre}
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-texto">Qué datos se tratan</h2>
            <p className="text-sm leading-relaxed text-texto">
              La plataforma almacena datos de identificación del personal autorizado (nombre,
              documento, grado, unidad, correo institucional y teléfono), los datos operacionales
              de cada misión de búsqueda y rescate, y los archivos que la soportan: órdenes de
              vuelo, órdenes fragmentarias, requerimientos, formularios de misión cumplida,
              certificados de consumo y el archivo fílmico.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-texto">Para qué se usan</h2>
            <p className="text-sm leading-relaxed text-texto">
              Los datos se tratan con una sola finalidad: conformar el archivo documental de las
              misiones, permitir su revisión y aprobación por el mando, y dejar constancia
              verificable de lo actuado. No se usan para fines comerciales, no se ceden a terceros
              y no alimentan sistemas de decisión automatizada.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-texto">Registro de actividad</h2>
            <p className="text-sm leading-relaxed text-texto">
              Toda acción sobre una misión o un documento queda registrada en la auditoría del
              sistema: quién la hizo, cuándo, desde qué dirección IP y con qué navegador, junto al
              estado anterior y posterior del dato. También se registran los ingresos exitosos y
              los fallidos. Ese registro es inmutable: no puede modificarse ni eliminarse desde la
              aplicación, ni siquiera por un administrador.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-texto">Retención</h2>
            <ul className="space-y-2 text-sm leading-relaxed text-texto">
              <li>
                <strong className="font-medium">Misiones y soportes:</strong> se conservan de forma
                indefinida, conforme a las tablas de retención documental de la unidad. Nada se
                borra: una misión errónea se anula con motivo escrito y permanece consultable.
              </li>
              <li>
                <strong className="font-medium">Versiones anteriores de documentos:</strong> al
                reemplazar un soporte, el archivo anterior se conserva marcado como no vigente.
              </li>
              <li>
                <strong className="font-medium">Auditoría:</strong> se conserva de forma indefinida.
              </li>
              <li>
                <strong className="font-medium">Intentos de ingreso:</strong> se conservan 24 horas,
                el tiempo necesario para el bloqueo por intentos fallidos.
              </li>
              <li>
                <strong className="font-medium">Cuentas:</strong> no se eliminan. Una cuenta que
                deja de usarse se desactiva, y con ello pierde todo acceso.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-texto">Acceso y seguridad</h2>
            <p className="text-sm leading-relaxed text-texto">
              El acceso se otorga por invitación del administrador y se limita por rol y por
              unidad. Los archivos se guardan en almacenamiento privado y solo se entregan
              mediante enlaces firmados de cinco minutos, emitidos tras verificar el permiso de
              quien los solicita. El ingreso exige contraseña propia de al menos doce caracteres,
              se bloquea tras cinco intentos fallidos y la sesión se cierra por inactividad.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-texto">Derechos del titular</h2>
            <p className="text-sm leading-relaxed text-texto">
              El personal puede conocer, actualizar y rectificar sus datos de identificación desde
              su perfil o solicitándolo al administrador. La supresión de datos operacionales no
              procede: forman parte del archivo institucional y su conservación responde a un
              deber documental. Para cualquier solicitud, escribe a{" "}
              <a
                href={`mailto:${INSTITUCION.correoContacto}`}
                className="font-medium text-marina-900 underline underline-offset-2"
              >
                {INSTITUCION.correoContacto}
              </a>
              .
            </p>
          </section>

          <p className="border-t border-borde pt-6 text-sm">
            <Link href="/login" className="font-medium text-marina-900 underline underline-offset-2">
              Volver al ingreso
            </Link>
          </p>
        </article>
      </main>
    </div>
  );
}
