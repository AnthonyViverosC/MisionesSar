import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerSesion } from "@/lib/sesion";
import {
  esquemaFiltrosArchivo,
  MAXIMO_EXPORTACION,
} from "@/dominio/esquemas-archivo";
import { ETIQUETA_ESTADO, type EstadoMision } from "@/dominio/estados";

/**
 * Exportación del archivo a CSV.
 *
 * Devuelve exactamente las misiones que el usuario está viendo: los filtros son
 * los mismos de la pantalla y las filas las sigue decidiendo RLS. Un operador
 * exporta lo suyo, un supervisor lo de su unidad; nadie amplía su alcance por
 * pedir el CSV en vez de la tabla.
 *
 * Va separado por punto y coma y con BOM: es lo que Excel en español abre bien
 * sin pasar por el asistente de importación.
 */

const COLUMNAS = [
  "Número de misión",
  "Año",
  "Fecha de inicio",
  "Fecha de fin",
  "Tipo",
  "Unidad",
  "Aeronave",
  "Comandante",
  "Zona de operación",
  "Latitud",
  "Longitud",
  "Horas de vuelo",
  "Estado",
  "Aprobada el",
  "Motivo de anulación",
  "Archivos vigentes",
];

/** Escapa un valor para CSV: comillas dobles y saltos de línea incluidos. */
function celda(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export async function GET(request: NextRequest) {
  const sesion = await obtenerSesion();

  if (!sesion) {
    return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  }

  const parametros = Object.fromEntries(request.nextUrl.searchParams.entries());
  const analisis = esquemaFiltrosArchivo.safeParse(parametros);

  if (!analisis.success) {
    return NextResponse.json({ error: "Los filtros no son válidos." }, { status: 400 });
  }

  const filtros = analisis.data;
  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("misiones_con_completitud")
    .select(
      "numero_mision, anio, fecha_inicio, fecha_fin, tipo_mision, aeronave_matricula, comandante_aeronave, zona_operacion, latitud, longitud, horas_vuelo, estado, aprobada_en, motivo_anulacion, archivos_vigentes, unidades(nombre)",
    )
    .in("estado", filtros.estado ? [filtros.estado] : ["aprobada", "anulada"]);

  if (filtros.q) {
    consulta = consulta.or(
      `numero_mision.ilike.%${filtros.q}%,zona_operacion.ilike.%${filtros.q}%,comandante_aeronave.ilike.%${filtros.q}%`,
    );
  }
  if (filtros.anio) consulta = consulta.eq("anio", filtros.anio);
  if (filtros.unidad) consulta = consulta.eq("unidad_id", filtros.unidad);
  if (filtros.tipo) consulta = consulta.eq("tipo_mision_id", filtros.tipo);

  const { data: misiones, error } = await consulta
    .order("fecha_inicio", { ascending: false })
    .limit(MAXIMO_EXPORTACION);

  if (error) {
    console.error(`[archivo] exportación fallida: ${error.code} ${error.message}`);
    return NextResponse.json({ error: "No se pudo generar la exportación." }, { status: 500 });
  }

  const lineas = [COLUMNAS.join(";")];

  for (const mision of misiones ?? []) {
    const unidad = mision.unidades as { nombre: string } | null;

    lineas.push(
      [
        mision.numero_mision,
        mision.anio,
        mision.fecha_inicio,
        mision.fecha_fin,
        mision.tipo_mision,
        unidad?.nombre,
        mision.aeronave_matricula,
        mision.comandante_aeronave,
        mision.zona_operacion,
        mision.latitud,
        mision.longitud,
        mision.horas_vuelo,
        ETIQUETA_ESTADO[mision.estado as EstadoMision],
        mision.aprobada_en ? new Date(mision.aprobada_en).toLocaleString("es-CO") : "",
        mision.motivo_anulacion,
        mision.archivos_vigentes,
      ]
        .map(celda)
        .join(";"),
    );
  }

  const fecha = new Date().toISOString().slice(0, 10);

  // El BOM es lo que hace que Excel reconozca el UTF-8 y no rompa las tildes.
  return new NextResponse(`﻿${lineas.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="archivo-misiones-${fecha}.csv"`,
      "cache-control": "no-store",
    },
  });
}
