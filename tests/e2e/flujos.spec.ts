import { randomUUID } from "node:crypto";
import { type APIRequestContext, type Browser, type Page, expect, test } from "@playwright/test";
import { correoE2E, registrarClienteYConsentir } from "./apoyo.ts";

// Los cuatro flujos completos del producto (E3-T5), cada uno con sus propios datos. El cliente usa
// su sesión en `page`; el equipo, una sesión separada (otro contexto del navegador).

const ORIGEN = "http://127.0.0.1:3200";
const TIEMPO_FLUJO = 180_000;
const EMAIL_STAFF = "coordinador.e2e@corbanfc.com";

// PNG de 1 × 1 píxel: suficiente para la validación por firma de bytes.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function rellenarAsistente(page: Page): Promise<string> {
  await page.goto("/mi-cuenta/solicitudes/nueva");
  await page.getByRole("button", { name: /Ban100/ }).click();
  await expect(page).toHaveURL(/paso=cdt/, { timeout: 30000 });

  await page.getByLabel("Valor a invertir (pesos)").fill("5000000");
  await page.getByText("90 días", { exact: true }).click();
  // Aprobar exige fecha de apertura hoy o posterior: se usa una fecha futura.
  await page.getByLabel("Fecha de apertura").fill("2027-03-02");
  await page.getByLabel("Tipo de CDT").selectOption("desmaterializado");
  await page.getByLabel("Forma de pago").selectOption("transferencia");
  await page.getByLabel("Ciudad de diligenciamiento").fill("Medellín");
  await page.getByRole("button", { name: "Siguiente" }).click();

  await expect(page).toHaveURL(/paso=personal/);
  await page.getByLabel("Primer nombre").fill("Ana");
  await page.getByLabel("Primer apellido").fill("Gómez");
  await page.getByLabel("Tipo de documento").selectOption("CC");
  await page.getByLabel("Número de documento").fill(`${Date.now()}`.slice(-9));
  await page.getByLabel("Celular").fill("3001234567");
  await page.getByLabel("Dirección de residencia").fill("Calle 10 # 40-25");
  await page.getByLabel("Ciudad de residencia").fill("Medellín");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(/paso=laboral/);
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(/paso=financiera/);
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(/paso=pago/);

  await page.getByText(/^Al vencimiento ·/).click();
  await page.getByLabel("Banco de la cuenta").fill("Bancolombia");
  await page.getByLabel("Tipo de cuenta").selectOption("ahorros");
  await page.getByLabel("Número de cuenta").fill("12345678901");
  await page.getByLabel("Titular de la cuenta").fill("Ana Gómez");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(/paso=resumen/);
  await page.getByRole("button", { name: "Enviar a validación" }).click();
  await expect(page).toHaveURL(/\/mi-cuenta\/solicitudes\/[0-9a-f-]{36}$/, { timeout: 30000 });
  await expect(page.getByRole("heading", { name: "Pendiente de validación" })).toBeVisible();
  return page.url().split("/").pop() ?? "";
}

// Sesión del equipo: otro contexto, con la cookie de /api/test/login.
async function sesionStaff(navegador: Browser) {
  const contexto = await navegador.newContext({ baseURL: ORIGEN });
  const respuesta = await contexto.request.post("/api/test/login", {
    data: { email: EMAIL_STAFF },
  });
  expect(respuesta.ok()).toBe(true);
  return contexto;
}

function cabeceras(): Record<string, string> {
  return { origin: ORIGEN };
}

async function aprobar(staff: APIRequestContext, id: string) {
  const r = await staff.post(`/api/staff/solicitudes/${id}/aprobar`, {
    headers: cabeceras(),
    data: {},
  });
  expect(r.ok()).toBe(true);
}

// Carga de los dos PNG firmados desde la propia página del cliente (FormData nativo del navegador).
async function cargarFirmados(page: Page, id: string) {
  const estado = await page.evaluate(
    async ({ solicitudId, b64 }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const formulario = new FormData();
      formulario.append("archivos", new File([bytes], "firma-1.png", { type: "image/png" }));
      formulario.append("archivos", new File([bytes], "firma-2.png", { type: "image/png" }));
      const r = await fetch(`/api/v1/solicitudes/${solicitudId}/firmados`, {
        method: "POST",
        body: formulario,
      });
      return r.status;
    },
    { solicitudId: id, b64: PNG.toString("base64") },
  );
  expect(estado).toBe(200);
}

test.describe("flujos completos", () => {
  test("1 · registro por OTP, consentimiento, asistente y envío a validación", async ({ page }) => {
    test.setTimeout(TIEMPO_FLUJO);
    await registrarClienteYConsentir(page, correoE2E());
    await rellenarAsistente(page);
  });

  test("2 · el asesor aprueba y el cliente descarga los formatos en PDF", async ({
    page,
    browser,
  }) => {
    test.setTimeout(TIEMPO_FLUJO);
    await registrarClienteYConsentir(page, correoE2E());
    const id = await rellenarAsistente(page);
    const staff = await sesionStaff(browser);
    await aprobar(staff.request, id);

    const documentos = await page.request.get(`/api/v1/solicitudes/${id}/documentos`);
    expect(documentos.ok()).toBe(true);
    const lista = ((await documentos.json()) as { data: { id: string }[] }).data;
    expect(lista.length).toBeGreaterThan(0);
    for (const doc of lista) {
      const pdf = await page.request.get(`/api/v1/solicitudes/${id}/documentos/${doc.id}`);
      expect(pdf.ok()).toBe(true);
      expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    }
    await staff.close();
  });

  test("3 · firmas, aceptación, envío, constitución visible en el portafolio", async ({
    page,
    browser,
  }) => {
    test.setTimeout(TIEMPO_FLUJO);
    await registrarClienteYConsentir(page, correoE2E());
    const id = await rellenarAsistente(page);
    const staff = await sesionStaff(browser);
    await aprobar(staff.request, id);
    await cargarFirmados(page, id);

    const aceptar = await staff.request.post(`/api/staff/solicitudes/${id}/firma/aceptar`, {
      headers: cabeceras(),
      data: {},
    });
    expect(aceptar.ok()).toBe(true);
    const enviar = await staff.request.post(`/api/staff/solicitudes/${id}/enviar_entidad`, {
      headers: cabeceras(),
      data: { fechaEnvio: "2026-03-03" },
    });
    expect(enviar.ok()).toBe(true);

    const numero = `E2E-${randomUUID().slice(0, 8)}`;
    const pagina = await staff.newPage();
    await pagina.goto(`/asesor/solicitudes/${id}`);
    await pagina.getByLabel("Número del CDT").fill(numero);
    await pagina.getByRole("button", { name: "Registrar constitución" }).click();
    await expect(pagina.getByText(/constituido/i).first()).toBeVisible({ timeout: 30000 });

    await page.goto("/mi-cuenta/portafolio");
    await expect(page.getByText(numero)).toBeVisible();
    await staff.close();
  });

  test("4 · edición posterior a la aprobación crea la versión 2 y vuelve a pendiente de firma", async ({
    page,
    browser,
  }) => {
    test.setTimeout(TIEMPO_FLUJO);
    await registrarClienteYConsentir(page, correoE2E());
    const id = await rellenarAsistente(page);
    const staff = await sesionStaff(browser);
    await aprobar(staff.request, id);
    await cargarFirmados(page, id);

    const edicion = await staff.request.patch(`/api/staff/solicitudes/${id}/edicion`, {
      headers: cabeceras(),
      data: { motivo: "Ajuste de prueba E2E", cambios: { valor: "5100000" } },
    });
    expect(edicion.ok(), `edicion ${edicion.status()}: ${await edicion.text()}`).toBe(true);

    // El firmado anterior queda desactualizado (la API lo lista con su estado).
    const documentos = await page.request.get(`/api/v1/solicitudes/${id}/documentos`);
    const lista = ((await documentos.json()) as { data: { tipo: string; estado: string }[] }).data;
    expect(lista.some((d) => d.tipo === "firmado" && d.estado === "desactualizado")).toBe(true);

    await page.goto(`/mi-cuenta/solicitudes/${id}`);
    await expect(page.getByText(/Pendiente de firma/i).first()).toBeVisible();
    await staff.close();
  });
});
