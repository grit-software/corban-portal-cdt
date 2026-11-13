import { expect, test } from "@playwright/test";

// Responsive y accesibilidad base de las páginas del sistema de diseño (E2-T1).
// Las páginas de staff se miran con sesión de coordinador obtenida por /api/test/login.
const ANCHOS = [375, 768, 1440];
const PAGINAS = ["/", "/ingreso", "/registro", "/ingreso-staff", "/coordinador/condiciones"];

test.describe("sin desplazamiento horizontal", () => {
  test.beforeEach(async ({ page }) => {
    const respuesta = await page.request.post("/api/test/login", {
      data: { email: "coordinador.e2e@corbanfc.com" },
    });
    expect(respuesta.ok()).toBe(true);
  });

  for (const ancho of ANCHOS) {
    for (const pagina of PAGINAS) {
      test(`${pagina} a ${ancho} px no desborda`, async ({ page }) => {
        await page.setViewportSize({ width: ancho, height: 800 });
        await page.goto(pagina);
        const desborda = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        expect(desborda).toBe(false);
      });
    }
  }
});

test.describe("estructura accesible", () => {
  test.beforeEach(async ({ page }) => {
    await page.request.post("/api/test/login", {
      data: { email: "coordinador.e2e@corbanfc.com" },
    });
  });

  for (const pagina of PAGINAS) {
    test(`${pagina}: lang es-CO, un solo h1 y «Saltar al contenido» primero`, async ({ page }) => {
      await page.goto(pagina);
      await expect(page.locator("html")).toHaveAttribute("lang", "es-CO");
      await expect(page.locator("h1")).toHaveCount(1);
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
    });
  }
});

test.describe("redirecciones sin sesión", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/mi-cuenta lleva a /ingreso", async ({ page }) => {
    await page.goto("/mi-cuenta");
    await expect(page).toHaveURL(/\/ingreso/);
  });

  test("/asesor lleva a /ingreso-staff", async ({ page }) => {
    await page.goto("/asesor");
    await expect(page).toHaveURL(/\/ingreso-staff/);
  });
});
