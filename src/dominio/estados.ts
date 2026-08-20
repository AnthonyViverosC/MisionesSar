/**
 * Ciclo de vida de una misión.
 *
 *   borrador → enviada → en_revision → aprobada
 *                 ↑           ↓
 *              observada ←────┘
 *
 *   cualquier estado → anulada (solo admin, con motivo)
 *
 * El mismo grafo está implementado como trigger en Postgres
 * (`supabase/migrations`). Aquí se replica para que la interfaz sepa qué
 * botones ofrecer y para poder probar las reglas sin base de datos. La regla
 * que manda es la de la base: si el trigger rechaza una transición, la acción
 * falla aunque la interfaz la hubiera mostrado.
 */

import type { Rol } from "./roles";

export const ESTADOS = [
  "borrador",
  "enviada",
  "en_revision",
  "observada",
  "aprobada",
  "anulada",
] as const;

export type EstadoMision = (typeof ESTADOS)[number];

export const ETIQUETA_ESTADO: Record<EstadoMision, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  en_revision: "En revisión",
  observada: "Observada",
  aprobada: "Aprobada",
  anulada: "Anulada",
};

/** Clases de color por estado, alineadas con los tokens de `globals.css`. */
export const COLOR_ESTADO: Record<EstadoMision, string> = {
  borrador: "bg-estado-gris-fondo text-estado-gris",
  enviada: "bg-estado-azul-fondo text-estado-azul",
  en_revision: "bg-estado-azul-fondo text-estado-indigo",
  observada: "bg-estado-ambar-fondo text-estado-ambar",
  aprobada: "bg-estado-verde-fondo text-estado-verde",
  anulada: "bg-estado-rojo-fondo text-estado-rojo",
};

/** Acciones que cambian el estado de una misión. */
export const ACCIONES = [
  "enviar",
  "tomar_revision",
  "aprobar",
  "observar",
  "anular",
] as const;

export type AccionMision = (typeof ACCIONES)[number];

export const ETIQUETA_ACCION: Record<AccionMision, string> = {
  enviar: "Enviar misión",
  tomar_revision: "Tomar en revisión",
  aprobar: "Aprobar",
  observar: "Devolver con observación",
  anular: "Anular",
};

/** Mensaje de confirmación tras cada acción, con el mismo verbo del botón. */
export const CONFIRMACION_ACCION: Record<AccionMision, string> = {
  enviar: "Misión enviada a revisión",
  tomar_revision: "Misión tomada en revisión",
  aprobar: "Misión aprobada",
  observar: "Misión devuelta con observación",
  anular: "Misión anulada",
};

type ReglaTransicion = {
  desde: readonly EstadoMision[];
  hacia: EstadoMision;
  /** Roles que pueden ejecutar la acción. */
  roles: readonly Rol[];
  /** Solo el creador de la misión puede ejecutarla. */
  soloCreador?: boolean;
  /** Exige los 8 archivos vigentes. */
  exigeCompletitud?: boolean;
  /** Exige texto obligatorio (observación o motivo de anulación). */
  exigeTexto?: boolean;
};

export const REGLAS: Record<AccionMision, ReglaTransicion> = {
  // El operador envía su propia misión, y solo si están los 8 archivos.
  enviar: {
    desde: ["borrador", "observada"],
    hacia: "enviada",
    roles: ["operador"],
    soloCreador: true,
    exigeCompletitud: true,
  },
  // El supervisor toma la misión de la bandeja y queda como responsable.
  tomar_revision: {
    desde: ["enviada"],
    hacia: "en_revision",
    roles: ["supervisor", "admin"],
  },
  // Aprobar deja la misión inmutable.
  aprobar: {
    desde: ["enviada", "en_revision"],
    hacia: "aprobada",
    roles: ["supervisor", "admin"],
  },
  // Devolver exige siempre una observación escrita.
  observar: {
    desde: ["enviada", "en_revision"],
    hacia: "observada",
    roles: ["supervisor", "admin"],
    exigeTexto: true,
  },
  // Anular es exclusivo del admin y exige motivo. Nada se borra nunca.
  anular: {
    desde: ["borrador", "enviada", "en_revision", "observada", "aprobada"],
    hacia: "anulada",
    roles: ["admin"],
    exigeTexto: true,
  },
};

export type ContextoTransicion = {
  estado: EstadoMision;
  rol: Rol;
  esCreador: boolean;
  archivosVigentes: number;
  texto?: string;
};

export type ResultadoTransicion =
  | { permitida: true; nuevoEstado: EstadoMision }
  | { permitida: false; motivo: string };

/** Número de archivos que exige una misión completa: 5 PDF + 2 fotos + 1 video. */
export const ARCHIVOS_REQUERIDOS = 8;

/**
 * Evalúa si una acción es válida en el contexto dado.
 * Réplica exacta de `validar_transicion_estado` en Postgres.
 */
export function evaluarTransicion(
  accion: AccionMision,
  contexto: ContextoTransicion,
): ResultadoTransicion {
  const regla = REGLAS[accion];

  if (!regla.desde.includes(contexto.estado)) {
    return {
      permitida: false,
      motivo: `Una misión en estado ${ETIQUETA_ESTADO[contexto.estado].toLowerCase()} no admite esta acción.`,
    };
  }

  if (!regla.roles.includes(contexto.rol)) {
    return { permitida: false, motivo: "El rol no tiene permiso para esta acción." };
  }

  if (regla.soloCreador && !contexto.esCreador) {
    return { permitida: false, motivo: "Solo quien creó la misión puede enviarla." };
  }

  if (regla.exigeCompletitud && contexto.archivosVigentes < ARCHIVOS_REQUERIDOS) {
    return {
      permitida: false,
      motivo: `Faltan soportes: hay ${contexto.archivosVigentes} de ${ARCHIVOS_REQUERIDOS} archivos.`,
    };
  }

  if (regla.exigeTexto && !contexto.texto?.trim()) {
    return {
      permitida: false,
      motivo:
        accion === "anular"
          ? "Anular exige un motivo escrito."
          : "Devolver exige una observación escrita.",
    };
  }

  return { permitida: true, nuevoEstado: regla.hacia };
}

/** Una misión aprobada es inmutable: ni sus datos ni sus documentos cambian. */
export function esInmutable(estado: EstadoMision): boolean {
  return estado === "aprobada" || estado === "anulada";
}

/** Estados en los que el operador aún puede editar y cargar soportes. */
export function admiteEdicion(estado: EstadoMision): boolean {
  return estado === "borrador" || estado === "observada";
}

/** Acciones disponibles para un contexto, para pintar los botones del detalle. */
export function accionesDisponibles(
  contexto: Omit<ContextoTransicion, "texto">,
): AccionMision[] {
  return ACCIONES.filter((accion) => {
    const regla = REGLAS[accion];
    // El texto obligatorio se pide en el diálogo, no condiciona mostrar el botón.
    const resultado = evaluarTransicion(accion, {
      ...contexto,
      texto: regla.exigeTexto ? "pendiente" : undefined,
    });
    return resultado.permitida;
  });
}
