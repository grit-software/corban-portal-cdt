import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("responde 200 con status ok y sin tocar la base de datos", async () => {
    const respuesta = GET();
    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({ status: "ok" });
  });
});
