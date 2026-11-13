import { expect, type Page, test } from "@playwright/test";
import { correoE2E, registrarClienteYConsentir } from "./apoyo.ts";

// Asistente del cliente (E2-T3): flujo completo, autoguardado, validación y opciones de pago.
// Las entidades y tasas vienen de db:seed:demo (ver globalSetup).

async function abrirCdtCon(page: Page, entidad: string) {
  await page.goto("/mi-cuenta/solicitudes/nueva");
  await page.getByRole("button", { name: new RegExp(entidad) }).click();
  await expect(page).toHaveURL(/paso=cdt/);
}

async function rellenarCdt(page: Page, plazo: string) {
  await page.getByLabel("Valor a invertir (pesos)").fill("5000000");
  // El radio de cada chip está oculto: se pulsa su etiqueta, como haría una persona.
  await expect(page.getByText(`${plazo} días`, { exact: true })).toBeVisible();
  await page.getByText(`${plazo} días`, { exact: true }).click();
  await page.getByLabel("Fecha de apertura").fill("2026-03-02");
  await page.getByLabel("Tipo de CDT").selectOption("desmaterializado");
  await page.getByLabel("Forma de pago").selectOption("transferencia");
  await page.getByLabel("Ciudad de diligenciamiento").fill("Medellín");
}

async function rellenarPersonal(page: Page) {
  await page.getByLabel("Primer nombre").fill("Ana");
  await page.getByLabel("Primer apellido").fill("Gómez");
  await page.getByLabel("Tipo de documento").selectOption("CC");
  await page.getByLabel("Número de documento").fill("12345678");
  await page.getByLabel("Celular").fill("3001234567");
  await page.getByLabel("Dirección de residencia").fill("Calle 10 # 40-25");
  await page.getByLabel("Ciudad de residencia").fill("Medellín");
}

test.describe("asistente del cliente", () => {
  test.beforeEach(async ({ page }) => {
    await registrarClienteYConsentir(page, correoE2E());
  });

  test("completa los pasos y envía a validación", async ({ page }) => {
    await abrirCdtCon(page, "Ban100");
    await rellenarCdt(page, "90");
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page).toHaveURL(/paso=personal/);
    await rellenarPersonal(page);
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
    await expect(page).toHaveURL(/\/mi-cuenta\/solicitudes\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Pendiente de validación" })).toBeVisible();
  });

  test("restaura los valores guardados al recargar", async ({ page }) => {
    await abrirCdtCon(page, "Ban100");
    const guardado = page.waitForResponse(
      (r) => r.request().method() === "PATCH" && r.url().includes("/api/v1/solicitudes/"),
    );
    await page.getByLabel("Ciudad de diligenciamiento").fill("Cali");
    await guardado;

    await page.reload();
    await expect(page.getByLabel("Ciudad de diligenciamiento")).toHaveValue("Cali");
  });

  test("con un campo obligatorio vacío se queda en el paso y enfoca el primero inválido", async ({
    page,
  }) => {
    await abrirCdtCon(page, "Ban100");
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page).toHaveURL(/paso=cdt/);
    await expect(page.getByText("Campo obligatorio").first()).toBeVisible();
    await expect(page.getByLabel("Valor a invertir (pesos)")).toBeFocused();
  });

  test("en pago solo aparecen las periodicidades que devuelve la consulta, con su tasa", async ({
    page,
  }) => {
    await abrirCdtCon(page, "Ban100");
    await rellenarCdt(page, "360");
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page).toHaveURL(/paso=personal/);

    await page.goto(page.url().replace("paso=personal", "paso=pago"));
    const opciones = page.getByRole("radio");
    await expect(opciones).toHaveCount(2);
    await expect(page.getByText(/^Al vencimiento · 10,50 %/)).toBeVisible();
    await expect(page.getByText(/^Mensual · 10,30 %/)).toBeVisible();
  });
});
