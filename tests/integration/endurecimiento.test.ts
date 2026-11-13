import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.ts";
import { POST as registro } from "@/app/api/v1/auth/registro/route";
import { getEnv } from "@/lib/env";
import { ipUnica } from "../helpers/auth-clientes.ts";

// Endurecimiento (E3-T5): cabeceras de seguridad, límite de registro y ausencia de console.log.

const CABECERAS_ESPERADAS: Record<string, RegExp> = {
  "Content-Security-Policy": /frame-ancestors 'none'/,
  "Strict-Transport-Security": /max-age=63072000; includeSubDomains/,
  "X-Content-Type-Options": /^nosniff$/,
  "Referrer-Policy": /^strict-origin-when-cross-origin$/,
  "X-Frame-Options": /^DENY$/,
  "Permissions-Policy": /camera=\(self\), microphone=\(\), geolocation=\(\)/,
};

describe("cabeceras de seguridad (E3-T5)", () => {
  it("next.config.ts declara las seis cabeceras para todas las rutas", async () => {
    const reglas = await nextConfig.headers?.();
    const regla = reglas?.find((r) => r.source === "/(.*)");
    expect(regla).toBeDefined();
    const mapa = new Map((regla?.headers ?? []).map((h) => [h.key, h.value]));
    for (const [clave, patron] of Object.entries(CABECERAS_ESPERADAS)) {
      const valor = mapa.get(clave);
      expect(valor, `falta ${clave}`).toBeDefined();
      expect(valor ?? "", clave).toMatch(patron);
    }
  });
});

describe("límite de registro (E3-T5)", () => {
  it("la undécima petición desde la misma IP en 15 minutos responde 429 LIMITE_EXCEDIDO", async () => {
    const ip = ipUnica();
    const origen = getEnv().BETTER_AUTH_URL;
    const peticion = () =>
      new Request("http://localhost/api/v1/auth/registro", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: origen,
          "x-forwarded-for": ip,
        },
        body: "{}",
      });

    // Las diez primeras pasan el límite (y luego fallan la validación del cuerpo).
    for (let i = 0; i < 10; i++) {
      const respuesta = await registro(peticion());
      expect(respuesta.status).not.toBe(429);
    }
    const undecima = await registro(peticion());
    expect(undecima.status).toBe(429);
    const cuerpo = (await undecima.json()) as { error: { code: string } };
    expect(cuerpo.error.code).toBe("LIMITE_EXCEDIDO");
    expect(undecima.headers.get("Retry-After")).not.toBeNull();
  });
});

describe("sin console.log en el código fuente (E3-T5)", () => {
  it("ningún archivo de src/ (salvo components/ui) usa console.log", () => {
    const raiz = path.resolve("src");
    const hallazgos: string[] = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = path.join(dir, nombre);
        if (statSync(ruta).isDirectory()) {
          if (ruta.replaceAll("\\", "/").endsWith("src/components/ui")) continue;
          recorrer(ruta);
        } else if (
          /\.(ts|tsx)$/.test(nombre) &&
          /console\.log\(/.test(readFileSync(ruta, "utf8"))
        ) {
          hallazgos.push(path.relative(raiz, ruta));
        }
      }
    };
    recorrer(raiz);
    expect(hallazgos).toEqual([]);
  });
});
