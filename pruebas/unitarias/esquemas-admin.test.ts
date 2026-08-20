import { describe, expect, it } from "vitest";
import {
  esquemaAeronave,
  esquemaInvitacion,
  esquemaTipoMision,
  esquemaUnidad,
  esquemaUsuario,
} from "@/dominio/esquemas-admin";

/**
 * Validaciones de administración.
 *
 * Son la primera barrera, no la última: las mismas reglas están en las
 * restricciones de la base (`perfiles_unidad_obligatoria`,
 * `aeronaves_matricula_formato`, los índices únicos). Estas pruebas comprueban
 * que la aplicación rechaza pronto lo que la base rechazaría después, para que
 * el usuario reciba un mensaje útil en vez de un error de Postgres.
 */

const UNIDAD = "3f1e7c60-0f5a-4a52-9d1a-4b6a9f0c1d23";

const invitacionValida = {
  correo: "TE.Ramirez@sar.mil.co",
  nombre_completo: "Ramírez Gómez Andrés",
  documento_identidad: "1085234567",
  grado: "TE.",
  telefono: "+57 300 1234567",
  rol: "operador" as const,
  unidad_id: UNIDAD,
};

describe("invitación de usuario", () => {
  it("acepta una invitación completa y normaliza el correo", () => {
    const resultado = esquemaInvitacion.parse(invitacionValida);
    expect(resultado.correo).toBe("te.ramirez@sar.mil.co");
  });

  it("exige unidad al operador", () => {
    const resultado = esquemaInvitacion.safeParse({ ...invitacionValida, unidad_id: "" });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0].path).toEqual(["unidad_id"]);
  });

  it("exige unidad al supervisor", () => {
    const resultado = esquemaInvitacion.safeParse({
      ...invitacionValida,
      rol: "supervisor",
      unidad_id: "",
    });
    expect(resultado.success).toBe(false);
  });

  it("no exige unidad al admin ni al rol de consulta", () => {
    for (const rol of ["admin", "consulta"] as const) {
      const resultado = esquemaInvitacion.safeParse({
        ...invitacionValida,
        rol,
        unidad_id: "",
      });
      expect(resultado.success, `el rol ${rol} no debería exigir unidad`).toBe(true);
    }
  });

  it("rechaza un documento con puntos o letras", () => {
    for (const documento of ["1.085.234.567", "10852A4567", "123"]) {
      expect(
        esquemaInvitacion.safeParse({ ...invitacionValida, documento_identidad: documento })
          .success,
      ).toBe(false);
    }
  });

  it("rechaza un correo sin forma de correo", () => {
    expect(
      esquemaInvitacion.safeParse({ ...invitacionValida, correo: "ramirez.sar.mil.co" }).success,
    ).toBe(false);
  });
});

describe("edición de usuario", () => {
  const usuarioValido = {
    nombre_completo: "Ramírez Gómez Andrés",
    documento_identidad: "1085234567",
    grado: "",
    telefono: "",
    rol: "supervisor" as const,
    unidad_id: UNIDAD,
    activo: true,
  };

  it("acepta grado y teléfono vacíos", () => {
    expect(esquemaUsuario.safeParse(usuarioValido).success).toBe(true);
  });

  it("no permite dejar sin unidad a un supervisor", () => {
    const resultado = esquemaUsuario.safeParse({ ...usuarioValido, unidad_id: "" });
    expect(resultado.success).toBe(false);
  });

  it("acepta desactivar la cuenta", () => {
    expect(esquemaUsuario.safeParse({ ...usuarioValido, activo: false }).success).toBe(true);
  });
});

describe("catálogo de unidades", () => {
  it("pasa el código a mayúsculas", () => {
    const resultado = esquemaUnidad.parse({
      codigo: "bav7",
      nombre: "VII Brigada Aérea",
      activa: true,
    });
    expect(resultado.codigo).toBe("BAV7");
  });

  it("rechaza un nombre demasiado corto", () => {
    expect(
      esquemaUnidad.safeParse({ codigo: "BAV7", nombre: "AB", activa: true }).success,
    ).toBe(false);
  });
});

describe("catálogo de aeronaves", () => {
  it("normaliza la matrícula a mayúsculas", () => {
    const resultado = esquemaAeronave.parse({
      matricula: "fac-1234",
      tipo: "Helicóptero UH-60",
      unidad_id: UNIDAD,
      activa: true,
    });
    // La restricción `aeronaves_matricula_formato` exige mayúsculas sin espacios.
    expect(resultado.matricula).toBe("FAC-1234");
  });

  it("rechaza matrículas con espacios", () => {
    expect(
      esquemaAeronave.safeParse({
        matricula: "FAC 1234",
        tipo: "Helicóptero",
        unidad_id: UNIDAD,
        activa: true,
      }).success,
    ).toBe(false);
  });

  it("exige la unidad a la que pertenece", () => {
    expect(
      esquemaAeronave.safeParse({
        matricula: "FAC-1234",
        tipo: "Helicóptero",
        unidad_id: "",
        activa: true,
      }).success,
    ).toBe(false);
  });
});

describe("catálogo de tipos de misión", () => {
  const tipoValido = { codigo: "BUSQUEDA", nombre: "Búsqueda", orden: 1, activo: true };

  it("acepta un tipo bien formado", () => {
    expect(esquemaTipoMision.safeParse(tipoValido).success).toBe(true);
  });

  it("rechaza un código con espacios o guiones", () => {
    for (const codigo of ["BUSQUEDA AEREA", "BUSQUEDA-AEREA"]) {
      expect(esquemaTipoMision.safeParse({ ...tipoValido, codigo }).success).toBe(false);
    }
  });

  it("rechaza un orden negativo o no entero", () => {
    expect(esquemaTipoMision.safeParse({ ...tipoValido, orden: -1 }).success).toBe(false);
    expect(esquemaTipoMision.safeParse({ ...tipoValido, orden: 1.5 }).success).toBe(false);
  });
});
