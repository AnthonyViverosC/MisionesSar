import { describe, expect, it } from "vitest";
import {
  ARCHIVOS_REQUERIDOS,
  accionesDisponibles,
  admiteEdicion,
  esInmutable,
  evaluarTransicion,
  type ContextoTransicion,
} from "@/dominio/estados";

/**
 * Reglas del flujo de estados.
 *
 * Estas pruebas cubren la réplica en TypeScript, la que decide qué botones ve
 * el usuario. La misma matriz se comprueba contra los triggers de Postgres en
 * `pruebas/integracion/reglas-estado.test.ts`: si alguna de las dos se desvía,
 * una de las dos suites falla.
 */

const base: ContextoTransicion = {
  estado: "borrador",
  rol: "operador",
  esCreador: true,
  archivosVigentes: ARCHIVOS_REQUERIDOS,
};

describe("enviar a revisión", () => {
  it("el creador envía su misión completa", () => {
    const resultado = evaluarTransicion("enviar", base);
    expect(resultado).toEqual({ permitida: true, nuevoEstado: "enviada" });
  });

  it("también se envía desde observada, tras corregir", () => {
    const resultado = evaluarTransicion("enviar", { ...base, estado: "observada" });
    expect(resultado).toEqual({ permitida: true, nuevoEstado: "enviada" });
  });

  it("no se envía una misión incompleta", () => {
    const resultado = evaluarTransicion("enviar", { ...base, archivosVigentes: 7 });
    expect(resultado.permitida).toBe(false);
    if (!resultado.permitida) {
      expect(resultado.motivo).toContain("7 de 8");
    }
  });

  it("no la envía quien no la creó", () => {
    const resultado = evaluarTransicion("enviar", { ...base, esCreador: false });
    expect(resultado.permitida).toBe(false);
  });

  it("el supervisor no envía misiones", () => {
    const resultado = evaluarTransicion("enviar", { ...base, rol: "supervisor" });
    expect(resultado.permitida).toBe(false);
  });

  it("no se envía dos veces", () => {
    const resultado = evaluarTransicion("enviar", { ...base, estado: "enviada" });
    expect(resultado.permitida).toBe(false);
  });
});

describe("aprobar", () => {
  const enviada: ContextoTransicion = {
    ...base,
    estado: "enviada",
    rol: "supervisor",
    esCreador: false,
  };

  it("el supervisor aprueba una misión enviada", () => {
    expect(evaluarTransicion("aprobar", enviada)).toEqual({
      permitida: true,
      nuevoEstado: "aprobada",
    });
  });

  it("el admin también aprueba", () => {
    expect(evaluarTransicion("aprobar", { ...enviada, rol: "admin" }).permitida).toBe(true);
  });

  it("el operador no aprueba su propia misión", () => {
    const resultado = evaluarTransicion("aprobar", {
      ...enviada,
      rol: "operador",
      esCreador: true,
    });
    expect(resultado.permitida).toBe(false);
  });

  it("el rol de consulta no aprueba nada", () => {
    expect(evaluarTransicion("aprobar", { ...enviada, rol: "consulta" }).permitida).toBe(false);
  });

  it("no se aprueba un borrador", () => {
    expect(evaluarTransicion("aprobar", { ...enviada, estado: "borrador" }).permitida).toBe(
      false,
    );
  });
});

describe("devolver con observación", () => {
  const enRevision: ContextoTransicion = {
    ...base,
    estado: "en_revision",
    rol: "supervisor",
    esCreador: false,
  };

  it("exige texto de observación", () => {
    const resultado = evaluarTransicion("observar", enRevision);
    expect(resultado.permitida).toBe(false);
    if (!resultado.permitida) {
      expect(resultado.motivo).toContain("observación escrita");
    }
  });

  it("con observación escrita se devuelve", () => {
    const resultado = evaluarTransicion("observar", {
      ...enRevision,
      texto: "Falta el certificado de consumo firmado.",
    });
    expect(resultado).toEqual({ permitida: true, nuevoEstado: "observada" });
  });

  it("una observación en blanco no cuenta", () => {
    const resultado = evaluarTransicion("observar", { ...enRevision, texto: "    " });
    expect(resultado.permitida).toBe(false);
  });
});

describe("anular", () => {
  it("solo el admin anula, y con motivo", () => {
    const contexto: ContextoTransicion = { ...base, rol: "admin", texto: "Duplicada por error." };
    expect(evaluarTransicion("anular", contexto)).toEqual({
      permitida: true,
      nuevoEstado: "anulada",
    });
  });

  it("el supervisor no anula", () => {
    const resultado = evaluarTransicion("anular", {
      ...base,
      rol: "supervisor",
      texto: "Duplicada por error.",
    });
    expect(resultado.permitida).toBe(false);
  });

  it("sin motivo no se anula", () => {
    const resultado = evaluarTransicion("anular", { ...base, rol: "admin" });
    expect(resultado.permitida).toBe(false);
    if (!resultado.permitida) {
      expect(resultado.motivo).toContain("motivo escrito");
    }
  });

  it("una misión aprobada todavía puede anularse", () => {
    const resultado = evaluarTransicion("anular", {
      ...base,
      estado: "aprobada",
      rol: "admin",
      texto: "Anulada por orden del comando.",
    });
    expect(resultado.permitida).toBe(true);
  });
});

describe("inmutabilidad y edición", () => {
  it("aprobada y anulada son estados terminales", () => {
    expect(esInmutable("aprobada")).toBe(true);
    expect(esInmutable("anulada")).toBe(true);
    expect(esInmutable("enviada")).toBe(false);
  });

  it("el operador solo edita en borrador y observada", () => {
    expect(admiteEdicion("borrador")).toBe(true);
    expect(admiteEdicion("observada")).toBe(true);
    expect(admiteEdicion("enviada")).toBe(false);
    expect(admiteEdicion("en_revision")).toBe(false);
    expect(admiteEdicion("aprobada")).toBe(false);
  });

  it("una misión aprobada no admite ninguna transición salvo anular", () => {
    const acciones = accionesDisponibles({
      estado: "aprobada",
      rol: "admin",
      esCreador: false,
      archivosVigentes: ARCHIVOS_REQUERIDOS,
    });
    expect(acciones).toEqual(["anular"]);
  });

  it("una misión anulada no admite nada", () => {
    const acciones = accionesDisponibles({
      estado: "anulada",
      rol: "admin",
      esCreador: false,
      archivosVigentes: ARCHIVOS_REQUERIDOS,
    });
    expect(acciones).toEqual([]);
  });
});

describe("acciones que ofrece la interfaz", () => {
  it("al operador con borrador completo le ofrece enviar", () => {
    expect(accionesDisponibles(base)).toEqual(["enviar"]);
  });

  it("al operador con borrador incompleto no le ofrece nada", () => {
    expect(accionesDisponibles({ ...base, archivosVigentes: 3 })).toEqual([]);
  });

  it("al supervisor con misión enviada le ofrece tomar, aprobar y devolver", () => {
    const acciones = accionesDisponibles({
      estado: "enviada",
      rol: "supervisor",
      esCreador: false,
      archivosVigentes: ARCHIVOS_REQUERIDOS,
    });
    expect(acciones).toEqual(["tomar_revision", "aprobar", "observar"]);
  });

  it("al rol de consulta no le ofrece ninguna acción", () => {
    const acciones = accionesDisponibles({
      estado: "aprobada",
      rol: "consulta",
      esCreador: false,
      archivosVigentes: ARCHIVOS_REQUERIDOS,
    });
    expect(acciones).toEqual([]);
  });
});
