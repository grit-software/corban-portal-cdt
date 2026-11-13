import { expect, test } from "@playwright/test";
import { correoE2E, registrarClienteYConsentir } from "./apoyo.ts";

// Responsive y accesibilidad base de las páginas del sistema de diseño (E2-T1).
// Las páginas de staff se miran con sesión de coordinador obtenida por /api/test/login.
const ANCHOS = [375, 768, 1440];
const PAGINAS = ["/", "/ingreso", "/registro", "/ingreso-staff", "/coordinador/condiciones"];

// next dev compila cada ruta la primera vez que se pide. Si esa compilación ocurre durante la
// navegación de la prueba, la página se recarga y page.evaluate pierde su contexto. Se calientan
// todas las rutas antes, con peticiones simples (sin navegar).
test.beforeAll(async ({ request }) => {
  for (const ruta of [...PAGINAS, ...PAGINAS_CLIENTE]) {
    await request.get(ruta);
  }
});

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

// Páginas de staff del barrido completo (E3-T5), cada una con el rol que la ve.
const PAGINAS_STAFF: { ruta: string; email: string }[] = [
  { ruta: "/asesor", email: "asesor.e2e@corbanfc.com" },
  { ruta: "/asesor/solicitudes", email: "asesor.e2e@corbanfc.com" },
  { ruta: "/asesor/clientes", email: "asesor.e2e@corbanfc.com" },
  { ruta: "/coordinador/importar", email: "coordinador.e2e@corbanfc.com" },
  { ruta: "/gerencia", email: "gerencia.e2e@corbanfc.com" },
  { ruta: "/admin/staff", email: "admin.e2e@corbanfc.com" },
];

test.describe("barrido responsive de staff", () => {
  for (const ancho of ANCHOS) {
    for (const { ruta, email } of PAGINAS_STAFF) {
      test(`${ruta} a ${ancho} px no desborda`, async ({ page }) => {
        const respuesta = await page.request.post("/api/test/login", { data: { email } });
        expect(respuesta.ok()).toBe(true);
        await page.setViewportSize({ width: ancho, height: 800 });
        await page.goto(ruta);
        const desborda = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        expect(desborda).toBe(false);
      });
    }
  }
});

// Área de cliente: sesión de cliente con consentimiento (apoyo.ts), no la de staff.
const PAGINAS_CLIENTE = ["/mi-cuenta", "/mi-cuenta/solicitudes/nueva", "/mi-cuenta/portafolio"];

test.describe("área de cliente sin desplazamiento horizontal", () => {
  test.beforeEach(async ({ page }) => {
    await registrarClienteYConsentir(page, correoE2E());
  });

  for (const ancho of ANCHOS) {
    for (const pagina of PAGINAS_CLIENTE) {
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
