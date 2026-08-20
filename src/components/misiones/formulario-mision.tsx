"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { actualizarMision, crearMision } from "@/acciones/misiones";
import {
  esquemaMision,
  PASOS_FORMULARIO,
  type DatosMision,
} from "@/dominio/esquemas-mision";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Opcion = { id: string; nombre: string };

type Props = {
  modo: "crear" | "editar";
  misionId?: string;
  valoresIniciales: Partial<DatosMision>;
  unidades: Opcion[];
  aeronaves: (Opcion & { unidad_id: string })[];
  tipos: Opcion[];
  /** Unidad del usuario: fija el campo cuando no es admin. */
  unidadPropia: string | null;
  puedeElegirUnidad: boolean;
};

/** Cada cuánto se guarda el borrador tras dejar de escribir. */
const MS_AUTOGUARDADO = 2500;

/**
 * Formulario de misión en tres pasos.
 *
 * Valida con el mismo esquema de Zod que aplica el servidor. En modo edición
 * guarda el borrador solo, dos segundos y medio después de la última tecla; en
 * modo creación no puede hacerlo porque todavía no hay misión a la que guardar,
 * así que el primer guardado es explícito y a partir de ahí sigue solo.
 */
export function FormularioMision({
  modo,
  misionId,
  valoresIniciales,
  unidades,
  aeronaves,
  tipos,
  unidadPropia,
  puedeElegirUnidad,
}: Props) {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  const [guardando, iniciarGuardado] = useTransition();
  const [ultimoGuardado, setUltimoGuardado] = useState<string | null>(null);
  const temporizador = useRef<number | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    getValues,
    formState: { errors, isDirty },
  } = useForm<DatosMision>({
    resolver: zodResolver(esquemaMision),
    mode: "onBlur",
    defaultValues: {
      numero_mision: "",
      fecha_inicio: "",
      fecha_fin: "",
      tipo_mision_id: "",
      aeronave_id: "",
      unidad_id: unidadPropia ?? "",
      comandante_aeronave: "",
      zona_operacion: "",
      latitud: "",
      longitud: "",
      horas_vuelo: "",
      resumen: "",
      ...valoresIniciales,
    },
  });

  const unidadSeleccionada = watch("unidad_id");
  // Solo se ofrecen aeronaves de la unidad: la base rechaza cualquier otra.
  const aeronavesVisibles = aeronaves.filter(
    (aeronave) => !unidadSeleccionada || aeronave.unidad_id === unidadSeleccionada,
  );

  // Autoguardado del borrador, solo en edición.
  useEffect(() => {
    if (modo !== "editar" || !misionId || !isDirty) return;

    const suscripcion = watch(() => {
      if (temporizador.current) window.clearTimeout(temporizador.current);

      temporizador.current = window.setTimeout(async () => {
        const valido = await trigger();
        if (!valido) return;

        const resultado = await actualizarMision(misionId, getValues());
        if (resultado.ok) {
          setUltimoGuardado(
            new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
          );
        }
      }, MS_AUTOGUARDADO);
    });

    return () => {
      suscripcion.unsubscribe();
      if (temporizador.current) window.clearTimeout(temporizador.current);
    };
  }, [modo, misionId, isDirty, watch, trigger, getValues]);

  async function avanzar() {
    const campos = [...PASOS_FORMULARIO[paso - 1].campos];
    const valido = await trigger(campos);
    if (valido) setPaso((actual) => Math.min(actual + 1, PASOS_FORMULARIO.length));
  }

  function enviar(datos: DatosMision) {
    iniciarGuardado(async () => {
      const resultado =
        modo === "crear"
          ? await crearMision(datos)
          : await actualizarMision(misionId!, datos);

      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }

      toast.success(resultado.mensaje);

      // Tras crear, el paso siguiente es cargar los soportes.
      router.push(
        modo === "crear" ? `/misiones/${resultado.id}/documentos` : `/misiones/${misionId}`,
      );
    });
  }

  const pasoActual = PASOS_FORMULARIO[paso - 1];

  return (
    <form onSubmit={handleSubmit(enviar)} className="space-y-6" noValidate>
      {/* Indicador de pasos */}
      <ol className="flex flex-wrap gap-2" aria-label="Pasos del formulario">
        {PASOS_FORMULARIO.map((definicion) => {
          const completado = definicion.numero < paso;
          const activo = definicion.numero === paso;

          return (
            <li key={definicion.numero} className="flex-1">
              <button
                type="button"
                onClick={() => setPaso(definicion.numero)}
                aria-current={activo ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  activo
                    ? "border-marina-900 bg-marina-900 text-white"
                    : completado
                      ? "border-borde bg-card text-texto"
                      : "border-borde bg-card text-texto-suave",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    activo
                      ? "bg-white text-marina-900"
                      : completado
                        ? "bg-estado-verde text-white"
                        : "bg-estado-gris-fondo text-texto-suave",
                  )}
                >
                  {completado ? <Check className="size-3" aria-hidden /> : definicion.numero}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{definicion.titulo}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <section className="space-y-5 rounded-lg border border-borde bg-card p-5">
        <div className="space-y-1">
          <h2 className="font-serif text-lg font-semibold text-texto">{pasoActual.titulo}</h2>
          <p className="text-sm text-texto-suave">{pasoActual.descripcion}</p>
        </div>

        {paso === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Número de misión"
              error={errors.numero_mision?.message}
              ayuda="Formato AAAA-NNN, por ejemplo 2026-042."
            >
              <Input
                {...register("numero_mision")}
                placeholder="2026-042"
                className="font-mono"
                autoFocus
              />
            </Campo>

            <Campo etiqueta="Tipo de misión" error={errors.tipo_mision_id?.message}>
              <Select
                value={watch("tipo_mision_id")}
                onValueChange={(valor) =>
                  setValue("tipo_mision_id", valor, { shouldDirty: true, shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((tipo) => (
                    <SelectItem key={tipo.id} value={tipo.id}>
                      {tipo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo etiqueta="Fecha de inicio" error={errors.fecha_inicio?.message}>
              <Input type="date" {...register("fecha_inicio")} />
            </Campo>

            <Campo
              etiqueta="Fecha de finalización"
              error={errors.fecha_fin?.message}
              ayuda="Déjala vacía si la misión terminó el mismo día."
            >
              <Input type="date" {...register("fecha_fin")} />
            </Campo>

            {puedeElegirUnidad ? (
              <Campo etiqueta="Unidad" error={errors.unidad_id?.message}>
                <Select
                  value={watch("unidad_id")}
                  onValueChange={(valor) => {
                    setValue("unidad_id", valor, { shouldDirty: true, shouldValidate: true });
                    // Cambiar de unidad invalida la aeronave elegida.
                    setValue("aeronave_id", "", { shouldDirty: true });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona la unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {unidades.map((unidad) => (
                      <SelectItem key={unidad.id} value={unidad.id}>
                        {unidad.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
            ) : (
              <Campo etiqueta="Unidad">
                <Input
                  value={unidades.find((u) => u.id === unidadPropia)?.nombre ?? ""}
                  readOnly
                  disabled
                />
              </Campo>
            )}
          </div>
        ) : null}

        {paso === 2 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Aeronave" error={errors.aeronave_id?.message}>
              <Select
                value={watch("aeronave_id")}
                onValueChange={(valor) =>
                  setValue("aeronave_id", valor, { shouldDirty: true, shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la matrícula" />
                </SelectTrigger>
                <SelectContent>
                  {aeronavesVisibles.map((aeronave) => (
                    <SelectItem key={aeronave.id} value={aeronave.id}>
                      {aeronave.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo
              etiqueta="Horas de vuelo"
              error={errors.horas_vuelo?.message}
              ayuda="Con decimales, por ejemplo 3.5."
            >
              <Input type="number" step="0.1" min="0" {...register("horas_vuelo")} />
            </Campo>

            <Campo
              etiqueta="Comandante de la aeronave"
              error={errors.comandante_aeronave?.message}
              className="sm:col-span-2"
            >
              <Input {...register("comandante_aeronave")} placeholder="Grado, nombre y apellidos" />
            </Campo>
          </div>
        ) : null}

        {paso === 3 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Zona de operación"
              error={errors.zona_operacion?.message}
              className="sm:col-span-2"
            >
              <Input {...register("zona_operacion")} placeholder="Sector, municipio y departamento" />
            </Campo>

            <Campo
              etiqueta="Latitud"
              error={errors.latitud?.message}
              ayuda="Opcional. En grados decimales."
            >
              <Input type="number" step="0.000001" {...register("latitud")} placeholder="4.598056" />
            </Campo>

            <Campo etiqueta="Longitud" error={errors.longitud?.message} ayuda="Opcional.">
              <Input
                type="number"
                step="0.000001"
                {...register("longitud")}
                placeholder="-74.075833"
              />
            </Campo>

            <Campo
              etiqueta="Resumen de la misión"
              error={errors.resumen?.message}
              className="sm:col-span-2"
              ayuda="Qué se buscó o rescató y con qué resultado."
            >
              <Textarea rows={4} {...register("resumen")} />
            </Campo>
          </div>
        ) : null}
      </section>

      {/* Pie de acciones */}
      <div className="flex flex-wrap items-center gap-3">
        {paso > 1 ? (
          <Button type="button" variant="outline" onClick={() => setPaso(paso - 1)}>
            Anterior
          </Button>
        ) : null}

        {paso < PASOS_FORMULARIO.length ? (
          <Button type="button" onClick={avanzar}>
            Siguiente
          </Button>
        ) : (
          <Button type="submit" disabled={guardando}>
            {guardando ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : modo === "crear" ? (
              "Crear y cargar soportes"
            ) : (
              "Guardar cambios"
            )}
          </Button>
        )}

        <p className="ml-auto text-xs text-texto-suave" aria-live="polite">
          {modo === "editar"
            ? ultimoGuardado
              ? `Borrador guardado a las ${ultimoGuardado}`
              : "El borrador se guarda solo mientras escribes."
            : "El borrador se guardará al crear la misión."}
        </p>
      </div>
    </form>
  );
}

/** Campo con etiqueta, ayuda y error, todos asociados por id. */
function Campo({
  etiqueta,
  error,
  ayuda,
  className,
  children,
}: {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const id = etiqueta.toLowerCase().replace(/[^a-z]+/g, "-");

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{etiqueta}</Label>
      <div id={id}>{children}</div>
      {ayuda && !error ? <p className="text-xs text-texto-suave">{ayuda}</p> : null}
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-estado-rojo">
          <AlertCircle className="mt-0.5 size-3 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
