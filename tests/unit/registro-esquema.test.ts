import { describe, expect, it } from "vitest";
import { esquemaRegistro } from "@/server/clientes/acceso/esquemas";

// Regresión: el celular es opcional, así que un campo vacío (que llega como "") debe pasar.
const base = {
  tipoDoc: "CC",
  numDoc: "1015877995",
  nombre: "Felipe Bautista",
  email: "f@prueba.co",
};

describe("esquema de registro: celular opcional", () => {
  it("acepta el celular vacío como si no se hubiera enviado", () => {
    const resultado = esquemaRegistro.safeParse({ ...base, celular: "" });
    expect(resultado.success).toBe(true);
  });

  it("acepta un celular con solo dígitos", () => {
    const resultado = esquemaRegistro.safeParse({ ...base, celular: "3001234567" });
    expect(resultado.success).toBe(true);
  });

  it("rechaza un celular con letras", () => {
    const resultado = esquemaRegistro.safeParse({ ...base, celular: "300abc" });
    expect(resultado.success).toBe(false);
  });
});
