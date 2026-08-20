import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/tipos/basedatos";
import {
  CORREOS,
  HAY_BASE,
  clienteAnonimo,
  clienteComo,
  clienteServicio,
} from "./ayudas";

/**
 * Políticas de RLS contra la base real.
 *
 * Comprueba la matriz de permisos fila por fila. Es la prueba que importa: la
 * interfaz puede esconder botones, pero lo que de verdad protege los datos son
 * estas políticas.
 *
 * Requiere un proyecto de Supabase con las migraciones aplicadas y la semilla
 * ejecutada. Sin credenciales, la suite se salta.
 */

describe.skipIf(!HAY_BASE)("políticas de RLS", () => {
  let admin: SupabaseClient<Database>;
  let operador: SupabaseClient<Database>;
  let supervisor: SupabaseClient<Database>;
  let consulta: SupabaseClient<Database>;
  let operadorSur: SupabaseClient<Database>;

  beforeAll(async () => {
    [admin, operador, supervisor, consulta, operadorSur] = await Promise.all([
      clienteComo(CORREOS.admin),
      clienteComo(CORREOS.operador),
      clienteComo(CORREOS.supervisor),
      clienteComo(CORREOS.consulta),
      clienteComo(CORREOS.operadorOtraUnidad),
    ]);
  });

  afterAll(async () => {
    await Promise.all(
      [admin, operador, supervisor, consulta, operadorSur].map((cliente) =>
        cliente?.auth.signOut(),
      ),
    );
  });

  describe("visibilidad de misiones", () => {
    it("el admin ve todas las misiones", async () => {
      const { data, error } = await admin.from("misiones").select("id, estado");
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(5);
    });

    it("el operador solo ve las misiones que creó", async () => {
      const { data: usuario } = await operador.auth.getUser();
      const { data, error } = await operador.from("misiones").select("id, creada_por");

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.every((m) => m.creada_por === usuario.user!.id)).toBe(true);
    });

    it("un operador de otra unidad no ve ninguna de esas misiones", async () => {
      const { data, error } = await operadorSur.from("misiones").select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("el supervisor ve las misiones de su unidad", async () => {
      // El supervisor ve varios perfiles de su unidad: hay que pedir el suyo.
      const { data: usuario } = await supervisor.auth.getUser();
      const { data: perfil } = await supervisor
        .from("perfiles")
        .select("unidad_id")
        .eq("id", usuario.user!.id)
        .single();
      const { data, error } = await supervisor.from("misiones").select("id, unidad_id");

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.every((m) => m.unidad_id === perfil!.unidad_id)).toBe(true);
    });

    it("el rol de consulta solo ve misiones aprobadas", async () => {
      const { data, error } = await consulta.from("misiones").select("id, estado");
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.every((m) => m.estado === "aprobada")).toBe(true);
    });

    it("sin sesión no se ve nada", async () => {
      const anonimo = clienteAnonimo();
      const { data } = await anonimo.from("misiones").select("id");
      expect(data ?? []).toEqual([]);
    });
  });

  describe("escritura de misiones", () => {
    it("el rol de consulta no puede crear misiones", async () => {
      const { data: catalogo } = await clienteServicio()
        .from("aeronaves")
        .select("id, unidad_id")
        .limit(1)
        .single();
      const { data: tipo } = await clienteServicio()
        .from("tipos_mision")
        .select("id")
        .limit(1)
        .single();
      const { data: usuario } = await consulta.auth.getUser();

      const { error } = await consulta.from("misiones").insert({
        numero_mision: `${new Date().getFullYear()}-901`,
        fecha_inicio: `${new Date().getFullYear()}-01-15`,
        tipo_mision_id: tipo!.id,
        aeronave_id: catalogo!.id,
        unidad_id: catalogo!.unidad_id,
        comandante_aeronave: "Prueba",
        zona_operacion: "Prueba",
        creada_por: usuario.user!.id,
      });

      expect(error).not.toBeNull();
    });

    it("el operador no puede aprobar su propia misión", async () => {
      const { data: propia } = await operador
        .from("misiones")
        .select("id")
        .eq("estado", "enviada")
        .limit(1)
        .maybeSingle();

      // Si la tiene enviada, ya no le pertenece la decisión.
      if (!propia) return;

      await operador.from("misiones").update({ estado: "aprobada" }).eq("id", propia.id);

      // La política de UPDATE no alcanza a una misión enviada, así que la fila
      // queda fuera del alcance y no se modifica: PostgREST no devuelve error,
      // simplemente no afecta ninguna fila. Lo que importa es el resultado.
      const { data: despues } = await operador
        .from("misiones")
        .select("estado")
        .eq("id", propia.id)
        .single();

      expect(despues!.estado).toBe("enviada");
    });

    it("nadie puede modificar una misión aprobada", async () => {
      const { data: aprobada } = await admin
        .from("misiones")
        .select("id")
        .eq("estado", "aprobada")
        .limit(1)
        .single();

      const { error } = await admin
        .from("misiones")
        .update({ resumen: "Modificación indebida" })
        .eq("id", aprobada!.id);

      expect(error).not.toBeNull();
    });

    it("las misiones no se pueden borrar", async () => {
      const { data: cualquiera } = await admin.from("misiones").select("id").limit(1).single();

      const { error } = await admin.from("misiones").delete().eq("id", cualquiera!.id);

      // Sin GRANT de delete ni política, la operación no prospera.
      const { count } = await admin
        .from("misiones")
        .select("id", { count: "exact", head: true })
        .eq("id", cualquiera!.id);

      expect(error !== null || count === 1).toBe(true);
    });
  });

  describe("documentos", () => {
    it("el operador ve los documentos de sus misiones", async () => {
      const { data, error } = await operador.from("documentos").select("id, mision_id");
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
    });

    it("un operador de otra unidad no ve ningún documento", async () => {
      const { data } = await operadorSur.from("documentos").select("id");
      expect(data ?? []).toEqual([]);
    });

    it("los documentos no se pueden borrar", async () => {
      const { data: documento } = await operador
        .from("documentos")
        .select("id")
        .limit(1)
        .single();

      await operador.from("documentos").delete().eq("id", documento!.id);

      const { count } = await operador
        .from("documentos")
        .select("id", { count: "exact", head: true })
        .eq("id", documento!.id);

      expect(count).toBe(1);
    });
  });

  describe("auditoría", () => {
    it("el admin consulta la bitácora completa", async () => {
      const { data, error } = await admin.from("auditoria").select("id, accion").limit(5);
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
    });

    it("el operador no ve la bitácora", async () => {
      const { data } = await operador.from("auditoria").select("id");
      expect(data ?? []).toEqual([]);
    });

    it("nadie puede escribir en la bitácora", async () => {
      const { data: usuario } = await admin.auth.getUser();

      const { error } = await admin.from("auditoria").insert({
        actor_id: usuario.user!.id,
        actor_email: CORREOS.admin,
        accion: "aprobar" as never,
        entidad: "misiones",
        entidad_id: null,
        datos_antes: null,
        datos_despues: null,
        ip: null,
        user_agent: null,
      });

      expect(error).not.toBeNull();
    });

    it("nadie puede alterar un registro de la bitácora", async () => {
      const { data: registro } = await admin
        .from("auditoria")
        .select("id, entidad")
        .limit(1)
        .single();

      await admin.from("auditoria").update({ entidad: "alterada" }).eq("id", registro!.id);

      const { data: despues } = await admin
        .from("auditoria")
        .select("entidad")
        .eq("id", registro!.id)
        .single();

      expect(despues!.entidad).toBe(registro!.entidad);
    });
  });

  describe("perfiles y catálogos", () => {
    it("el operador no ve los perfiles de otros usuarios", async () => {
      const { data: usuario } = await operador.auth.getUser();
      const { data } = await operador.from("perfiles").select("id");

      expect(data!.every((p) => p.id === usuario.user!.id)).toBe(true);
    });

    it("nadie se cambia el rol a sí mismo", async () => {
      const { data: usuario } = await operador.auth.getUser();

      await operador.from("perfiles").update({ rol: "admin" }).eq("id", usuario.user!.id);

      const { data: perfil } = await operador
        .from("perfiles")
        .select("rol")
        .eq("id", usuario.user!.id)
        .single();

      expect(perfil!.rol).toBe("operador");
    });

    it("solo el admin edita los catálogos", async () => {
      const { data: unidad } = await operador.from("unidades").select("id").limit(1).single();

      const { error } = await operador
        .from("unidades")
        .update({ nombre: "Nombre indebido" })
        .eq("id", unidad!.id);

      const { data: despues } = await operador
        .from("unidades")
        .select("nombre")
        .eq("id", unidad!.id)
        .single();

      expect(error !== null || despues!.nombre !== "Nombre indebido").toBe(true);
    });

    it("el operador sí consulta los catálogos que necesita el formulario", async () => {
      const { data, error } = await operador.from("aeronaves").select("id, matricula");
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
    });
  });

  describe("intentos de ingreso", () => {
    it("no son consultables desde la API", async () => {
      const { data } = await admin.from("intentos_ingreso").select("id");
      expect(data ?? []).toEqual([]);
    });
  });
});
