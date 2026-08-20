import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/tipos/basedatos";
import { CORREOS, HAY_BASE, clienteComo, clienteServicio } from "./ayudas";

/**
 * Reglas del flujo de estados contra los triggers de Postgres.
 *
 * Es la contraparte de `pruebas/unitarias/estados.test.ts`: allí se prueba la
 * réplica en TypeScript que decide qué botones ve el usuario, aquí la regla que
 * de verdad manda.
 *
 * Trabaja sobre misiones propias creadas al vuelo con el rol de servicio, para
 * no alterar las de la semilla.
 */

describe.skipIf(!HAY_BASE)("reglas de estado en la base de datos", () => {
  const servicio = clienteServicio();
  let operador: SupabaseClient<Database>;
  let supervisor: SupabaseClient<Database>;
  let operadorId: string;
  let misionIncompleta: string;

  beforeAll(async () => {
    operador = await clienteComo(CORREOS.operador);
    supervisor = await clienteComo(CORREOS.supervisor);

    const { data: usuario } = await operador.auth.getUser();
    operadorId = usuario.user!.id;

    const { data: aeronave } = await servicio
      .from("aeronaves")
      .select("id, unidad_id")
      .eq("matricula", "FAC-4501")
      .single();
    const { data: tipo } = await servicio
      .from("tipos_mision")
      .select("id")
      .eq("codigo", "BUSQUEDA")
      .single();

    const anio = new Date().getFullYear();
    const numero = `${anio}-9${String(Math.floor(Math.random() * 90) + 10)}`;

    const { data: mision, error } = await servicio
      .from("misiones")
      .insert({
        numero_mision: numero,
        fecha_inicio: `${anio}-03-01`,
        tipo_mision_id: tipo!.id,
        aeronave_id: aeronave!.id,
        unidad_id: aeronave!.unidad_id,
        comandante_aeronave: "Prueba de integración",
        zona_operacion: "Zona de pruebas",
        creada_por: operadorId,
      })
      .select("id")
      .single();

    if (error) throw error;
    misionIncompleta = mision.id;
  });

  afterAll(async () => {
    // Las misiones no se borran ni siquiera en pruebas: la de prueba se anula.
    await servicio
      .from("misiones")
      .update({
        estado: "anulada",
        motivo_anulacion: "Misión creada por la suite de pruebas de integración.",
      })
      .eq("id", misionIncompleta);

    await Promise.all([operador?.auth.signOut(), supervisor?.auth.signOut()]);
  });

  it("no deja enviar una misión incompleta", async () => {
    const { error } = await operador
      .from("misiones")
      .update({ estado: "enviada" })
      .eq("id", misionIncompleta);

    expect(error).not.toBeNull();
    expect(error!.message).toContain("Faltan soportes");
  });

  it("informa cuántos archivos faltan", async () => {
    const { data } = await servicio.rpc("contar_archivos_vigentes", {
      p_mision_id: misionIncompleta,
    });
    expect(data).toBe(0);

    const { data: completa } = await servicio.rpc("mision_completa", {
      p_mision_id: misionIncompleta,
    });
    expect(completa).toBe(false);
  });

  it("no deja saltar de borrador a aprobada", async () => {
    const { error } = await servicio
      .from("misiones")
      .update({ estado: "aprobada" })
      .eq("id", misionIncompleta);

    expect(error).not.toBeNull();
  });

  it("no deja devolver sin observación registrada", async () => {
    const { data: enviada } = await supervisor
      .from("misiones")
      .select("id")
      .eq("estado", "enviada")
      .limit(1)
      .maybeSingle();

    if (!enviada) return;

    const { error } = await supervisor
      .from("misiones")
      .update({ estado: "observada" })
      .eq("id", enviada.id);

    expect(error).not.toBeNull();
    expect(error!.message).toContain("observación");
  });

  it("no deja anular sin motivo", async () => {
    const { error } = await servicio
      .from("misiones")
      .update({ estado: "anulada" })
      .eq("id", misionIncompleta);

    expect(error).not.toBeNull();
  });

  it("una misión aprobada no admite cambios en sus soportes", async () => {
    const { data: aprobada } = await servicio
      .from("misiones")
      .select("id")
      .eq("estado", "aprobada")
      .limit(1)
      .maybeSingle();

    if (!aprobada) return;

    const { error } = await operador.from("documentos").insert({
      mision_id: aprobada.id,
      tipo: "orden_vuelo",
      nombre_original: "intento.pdf",
      ruta_almacenamiento: `${aprobada.id}/orden_vuelo/${crypto.randomUUID()}.pdf`,
      bucket: "documentos-pdf",
      mime_type: "application/pdf",
      tamano_bytes: 1024,
      hash_sha256: "a".repeat(64),
      subido_por: operadorId,
    });

    expect(error).not.toBeNull();
  });

  it("el archivo fílmico admite dos fotografías, no tres", async () => {
    const { data: conFotos } = await servicio
      .from("documentos")
      .select("mision_id")
      .eq("tipo", "foto")
      .eq("vigente", true)
      .limit(1)
      .maybeSingle();

    if (!conFotos) return;

    const { error } = await servicio.from("documentos").insert({
      mision_id: conFotos.mision_id,
      tipo: "foto",
      nombre_original: "tercera.png",
      ruta_almacenamiento: `${conFotos.mision_id}/foto/${crypto.randomUUID()}.png`,
      bucket: "archivo-filmico",
      mime_type: "image/png",
      tamano_bytes: 2048,
      hash_sha256: "b".repeat(64),
      subido_por: operadorId,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain("dos fotografías");
  });

  it("un PDF no cabe en el bucket del archivo fílmico", async () => {
    const { error } = await servicio.from("documentos").insert({
      mision_id: misionIncompleta,
      tipo: "orden_vuelo",
      nombre_original: "bucket-equivocado.pdf",
      ruta_almacenamiento: `${misionIncompleta}/orden_vuelo/${crypto.randomUUID()}.pdf`,
      bucket: "archivo-filmico",
      mime_type: "application/pdf",
      tamano_bytes: 1024,
      hash_sha256: "c".repeat(64),
      subido_por: operadorId,
    });

    expect(error).not.toBeNull();
  });
});
