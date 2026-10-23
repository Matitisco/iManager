import { openDeskSection } from './navigation';
import ExcelJS from "exceljs";
import { test, expect, type Page } from "@playwright/test";
import {
  authHeaders,
  buildTestEmail,
  loginViaUi,
  fetchInventory,
  bootstrapStoreViaApi,
} from "./utils";
import type { ImportAnalysis } from "../src/services/import-api";
const API = process.env.PLAYWRIGHT_API_BASE_URL || "http://127.0.0.1:3100";
const analysis: ImportAnalysis = {
  source: "model",
  currency: "USD",
  notice: null,
  plan: [],
  rows: [
    {
      model: "iPhone 13",
      capacity: "128GB",
      color: "Azul",
      condition: "USADO",
      price: "420",
      currency: "USD",
      quantity: "2",
      batteryHealth: "89%",
    },
    {
      model: "iPhone 14",
      capacity: "",
      color: "",
      condition: "USADO",
      price: "590",
      currency: "USD",
      quantity: "1",
      batteryHealth: "",
    },
  ],
  review: [
    { line: 1, original: "iPhone 13 x2 USD420", dudas: [] },
    { line: 2, original: "iPhone 14 USD590", dudas: ["Falta capacidad"] },
  ],
  discarded: [],
  summary: { sheetCount: 1, rowCount: 2, sheets: [] },
};
const text = "iPhone 13 128GB azul usado 89% x2 USD420\niPhone 14 usado USD590";
async function quote(page: Page) {
  await page.route("https://dolarapi.com/**", (route) =>
    route.fulfill({
      json: {
        compra: 1280,
        venta: 1300,
        fechaActualizacion: new Date().toISOString(),
      },
    }),
  );
  await page.route("https://mercados.ambito.com/**", (route) =>
    route.fulfill({ json: { venta: "1300,00", valor_cierre_ant: "1300,00" } }),
  );
}
async function shot(page: Page, name: string) {
  const directory = process.env.ISSUE_395_SHOTS;
  if (!directory) return;
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${directory}/395-${name}.png`, animations: "disabled", scale: "css" });
}
async function start(page: Page, email: string, device?: string) {
  await quote(page);
  await loginViaUi(page, email);
  await page.getByTestId("onboarding-store-name").fill("iPhone Club Palermo");
  await expect(page.getByTestId("onboarding-submit")).toBeInViewport();
  if (device) {
    await expect(page.getByText(/USD · dólar blue \$/)).toBeVisible();
    await shot(page, `nombre-${device}`);
  }
  await page.getByTestId("onboarding-submit").click();
  if (process.env.ISSUE_395_SHOTS) {
    const profile = await page.request.patch(`${API}/api/users/me`, { headers: authHeaders(email), data: { displayName: "Martín" } });
    expect(profile.ok()).toBe(true);
  }
  await expect(page.getByRole("heading", { name: "Cargá tu stock" })).toBeVisible();
  await expect(page.getByTestId("onboarding-invite")).toHaveCount(0);
  await expect(page.getByText("Mejor con tu equipo")).toHaveCount(0);
  if (device) await shot(page, `stock-${device}`);
}
async function toStock(page: Page) {
  await expect(page.getByRole("heading", { name: "Cargá tu stock" })).toBeVisible();
  await expect(page.getByText("Paso 2 de 2", { exact: true })).toBeVisible();
  const primary = page.getByTestId("stock-onboarding").getByRole("button").first();
  await expect(primary).toHaveText("Subir Excel");
  await expect(primary).toBeInViewport();
  await expect(page.getByRole("button", { name: "Saltar por ahora" })).toBeInViewport();
  expect(await primary.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(await page.evaluate(() => innerWidth <= 760 ? 56 : 44));
}
async function paste(page: Page, value = text) {
  await page.getByRole("button", { name: "Pegar lista" }).click();
  await page.getByRole("textbox", { name: "Listado de equipos" }).fill(value);
  await page.getByRole("button", { name: "Analizar mi lista" }).click();
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
export function onboardingCases(phone: boolean) {
  test("Subir Excel es la primera opción y guarda stock real tras revisar", async ({ page, request }, info) => {
    const email = buildTestEmail(info, "onboarding-excel");
    await start(page, email);
    await toStock(page);
    await page.getByRole("button", { name: "Subir Excel", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Importar equipos" });
    await expect(dialog).toBeVisible();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Stock");
    sheet.addRows([["Modelo", "Precio USD", "Capacidad", "Condición"], ["iPhone 13", 420, "128GB", "USADO"]]);
    await dialog.locator('input[type="file"]').setInputFiles({ name: "stock.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await workbook.xlsx.writeBuffer()) });
    await expect(dialog.getByTestId("import-confirm")).toBeEnabled();
    expect((await fetchInventory(request, email)).inventory).toHaveLength(0);
    await dialog.getByTestId("import-confirm").click();
    await expect(page.getByRole("heading", { name: "Inventario", exact: true })).toBeVisible();
    expect((await fetchInventory(request, email)).inventory).toHaveLength(1);
    await page.getByTestId("sidebar-tab-dashboard").click();
    await expect(page.getByRole("button", { name: "Primeros pasos, 2 de 5" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Primeros pasos, 2 de 5" })).toBeVisible();
    await expect(page.getByTestId("stock-onboarding")).toHaveCount(0);
    await fits(page);
  });

  test("cargar a mano conserva el equipo y termina con 2 de 5", async ({ page, request }, info) => {
    const email = buildTestEmail(info, "onboarding-manual");
    await start(page, email);
    await page.getByRole("button", { name: "A mano", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Registrar equipo" });
    await dialog.getByLabel("Modelo", { exact: true }).fill("iPhone 13");
    await dialog.getByLabel(/Precio de venta/).fill("420");
    await dialog.getByRole("button", { name: "Guardar equipo", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Ir a mi inventario" })).toBeVisible();
    await page.getByRole("button", { name: "Ir a mi inventario" }).click();
    await expect(page.getByRole("heading", { name: "Inventario", exact: true })).toBeVisible();
    expect((await fetchInventory(request, email)).inventory).toHaveLength(1);
    await page.getByTestId("sidebar-tab-dashboard").click();
    await expect(page.getByRole("button", { name: "Primeros pasos, 2 de 5" })).toBeVisible();
    await fits(page);
  });

  test("una etapa de equipo antigua reanuda directamente en stock", async ({ page, request }, info) => {
    const email = buildTestEmail(info, "onboarding-resume-invite");
    await start(page, email);
    const response = await request.patch(`${API}/api/onboarding/progress`, { headers: authHeaders(email), data: { stage: "invite" } });
    expect(response.ok()).toBe(true);
    await page.reload();
    await toStock(page);
    await expect(page.getByText("Mejor con tu equipo")).toHaveCount(0);
    await page.getByRole("button", { name: "Saltar por ahora" }).click();
    await expect(page.getByRole("button", { name: "Primeros pasos, 1 de 5" })).toBeVisible();
  });

  test("los datos de ejemplo desde Stock conservan 1 de 5 después de recargar", async ({ page, request }, info) => {
    const email = buildTestEmail(info, "onboarding-samples-progress");
    await start(page, email);
    await page.getByRole("button", { name: /Probar con datos de ejemplo/ }).click();
    await expect(page.getByText("Estás viendo datos de ejemplo")).toBeVisible();
    await expect(page.getByRole("button", { name: "Primeros pasos, 1 de 5" })).toBeVisible();
    expect((await fetchInventory(request, email)).inventory).toHaveLength(3);
    await page.reload();
    await page.getByTestId("getting-started").click();
    await expect(page.getByTestId("getting-started")).toContainText("1 de 5");
    await expect(page.getByTestId("first-step-store")).toHaveAttribute("data-done", "true");
    await expect(page.getByTestId("first-step-stock")).toHaveAttribute("data-done", "false");
    await expect(page.getByTestId("stock-onboarding")).toHaveCount(0);
    await fits(page);
  });

  test("nombre → stock → lista → revisión → inventario, sin guardar antes de confirmar", async ({
    page,
    request,
  }, info) => {
    const email = buildTestEmail(info, "onboarding-happy");
    await start(page, email, phone ? "mobile" : "desktop");
    await toStock(page);
    await page.route("**/api/import/analyze-text", (route) =>
      route.fulfill({
        contentType: "application/x-ndjson",
        body:
          JSON.stringify({
            type: "progress",
            rows: [{ model: "iPhone 13", quantity: 2 }],
          }) +
          "\n" +
          JSON.stringify({ type: "result", analysis }) +
          "\n",
      }),
    );
    await paste(page);
    await expect(page.getByTestId("onboarding-equipment-count")).toHaveText(
      "3",
    );
    await expect(page.getByTestId("onboarding-stock-usd")).toHaveText(
      "US$ 1.430",
    );
    await expect(page.getByText("≈ $ 1.859.000 al blue")).toBeVisible();
    await page
      .getByRole("button", { name: "Revisar iPhone 14, fila 2" })
      .click();
    const reviewEditor = page.getByRole("dialog", { name: "Revisar equipo" });
    await reviewEditor.getByLabel("Capacidad").fill("256GB");
    await reviewEditor
      .getByRole("button", { name: "Listo", exact: true })
      .click();
    expect((await fetchInventory(request, email)).inventory).toHaveLength(0);
    await fits(page);
    await page.screenshot({
      path: info.outputPath("resultado.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Guardar 3 equipos e ir al inventario" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Inventario", exact: true }),
    ).toBeVisible();
    const saved = (await fetchInventory(request, email)).inventory;
    expect(saved).toHaveLength(3);
    expect(
      saved.some(
        (row) => row.customFields?.onboardingReview === "Falta capacidad",
      ),
    ).toBe(true);
    await expect(page.getByText("Para revisar", { exact: true })).toBeVisible();
    await page.getByTestId("sidebar-tab-dashboard").click();
    const island = page.getByTestId("getting-started");
    await expect(island).toBeVisible();
    await island.click();
    const checklist = page.getByTestId("getting-started");
    await expect(checklist.getByTestId("first-step-stock")).toHaveAttribute("data-done", "true");
    await expect(checklist.getByTestId("first-step-store")).toHaveAttribute("data-done", "true");
    await expect(checklist.getByTestId("first-step-team")).toHaveAttribute("data-done", "false");
    await expect(checklist).toContainText("2 de 5");
    if (phone) await shot(page, "pasos-2de5-mobile");
    await expect(page.getByText("Video de bienvenida")).toHaveCount(0);
    await page.getByRole("button", { name: "Minimizar primeros pasos" }).click();
    await page.reload();
    await expect(page.getByTestId("getting-started")).toBeVisible();
  });
  test("saltea stock, reanuda al recargar y permite minimizar y consultar checklist desde Ayuda", async ({
    page,
    request,
  }, info) => {
    const email = buildTestEmail(info, "onboarding-skip");
    await start(page, email);
    await page.reload();
    await toStock(page);
    await page.getByRole("button", { name: "Saltar por ahora" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Primeros pasos, 1 de 5" })).toBeVisible();
    await expect(page.getByTestId("stock-onboarding")).toHaveCount(0);
    await expect(
      page.getByTestId("getting-started"),
    ).toBeVisible();
    await fits(page);
    await page.screenshot({
      path: info.outputPath("dashboard-vacio.png"),
      fullPage: true,
    });
    await shot(page, `dashboard-${phone ? "mobile" : "desktop"}`);
    expect((await fetchInventory(request, email)).inventory).toHaveLength(0);
    await page.getByTestId("getting-started").click();
    const stockStep = page.getByTestId("getting-started").getByTestId("first-step-stock");
    await expect(stockStep).toHaveAttribute("data-done", "false");
    await shot(page, phone ? "pasos-1de5-mobile" : "pasos-panel-desktop");
    await stockStep.getByRole("button", { name: /Cargá tu stock/ }).click();
    await expect(
      page.getByRole("button", { name: /Probar con datos de ejemplo/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Probar con datos de ejemplo/ }).click();
    await expect(
      page.getByText("Estás viendo datos de ejemplo", { exact: false }),
    ).toBeVisible();
    await fits(page);
    await expect(page.getByTestId("getting-started")).toBeVisible();
    await page.getByTestId("getting-started").click();
    await expect(page.getByTestId("first-step-stock")).toHaveAttribute("data-done", "false");
    await expect(page.getByTestId("getting-started")).toContainText("1 de 5");
    await expect(page.getByRole("button", { name: "Cerrar Primeros pasos" })).toHaveCount(0);
    await page.getByRole("button", { name: "Minimizar primeros pasos" }).click();
    await page.reload();
    await expect(page.getByTestId("getting-started")).toBeVisible();
    if (phone) await page.getByTestId("sidebar-tab-more").click();
    await openDeskSection(page, 'help');
    await expect(page.getByTestId("getting-started")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "▶ Ver video de bienvenida" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mostrar en Dashboard" })).toHaveCount(0);
    await page.getByTestId("sidebar-tab-dashboard").click();
    await expect(page.getByTestId("getting-started")).toBeVisible();
    await fits(page);
  });
  test("error parcial permite corregir líneas o seguir solo con las reconocidas", async ({
    page,
    request,
  }, info) => {
    const email = buildTestEmail(info, "onboarding-partial");
    await start(page, email);
    await toStock(page);
    await page.route("**/api/import/analyze-text", (route) =>
      route.fulfill({
        json: {
          ...analysis,
          discarded: [
            {
              line: 3,
              original: "funda gratis",
              reason: "Accesorio sin equipo",
            },
          ],
        },
      }),
    );
    await paste(page, text + "\nfunda gratis");
    await expect(page.getByText("Reconocimos 2 de 3 líneas")).toBeVisible();
    await expect(
      page.getByText("La línea sin reconocer no parece un equipo."),
    ).toBeVisible();
    await expect(page.getByText(/Las 1 sin reconocer/)).toHaveCount(0);
    await page.getByRole("textbox", { name: "Línea 3 sin reconocer" }).fill("");
    expect((await fetchInventory(request, email)).inventory).toHaveLength(0);
    await page
      .getByRole("button", { name: "Seguir con las reconocidas" })
      .click();
    await page
      .getByRole("button", { name: "Guardar 3 equipos e ir al inventario" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Inventario", exact: true }),
    ).toBeVisible();
    expect((await fetchInventory(request, email)).inventory).toHaveLength(3);
  });
  test("texto inválido muestra formato y alternativas, sin persistir", async ({
    page,
    request,
  }, info) => {
    const email = buildTestEmail(info, "onboarding-invalid");
    await start(page, email);
    await toStock(page);
    await page.route("**/api/import/analyze-text", (route) =>
      route.fulfill({
        json: {
          ...analysis,
          rows: [],
          review: [],
          discarded: [],
          notice: "Este texto no parece tener equipos para importar",
        },
      }),
    );
    await paste(page, "Hola, a qué hora abren mañana");
    await expect(
      page.getByText("Este texto no parece tener equipos para importar", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Subir Excel" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cargar a mano" }),
    ).toBeVisible();
    await expect(page.getByText(/iPhone 13 128GB azul 89%/)).toBeVisible();
    await fits(page);
    expect((await fetchInventory(request, email)).inventory).toHaveLength(0);
  });
  test("muestras requieren confirmar y solo borran muestras, conservando equipos reales", async ({
    page,
    request,
  }, info) => {
    const email = buildTestEmail(info, "onboarding-samples");
    await start(page, email);
    await toStock(page);
    await page
      .getByRole("button", { name: /Probar con datos de ejemplo/ })
      .click();
    await expect(
      page.getByText("Estás viendo datos de ejemplo", { exact: false }),
    ).toBeVisible();
    const real = await request.post(`${API}/api/inventory/import`, {
      headers: authHeaders(email),
      data: {
        rows: [{ model: "Equipo real", imei: "", price: 123, currency: "USD" }],
      },
    });
    expect(real.ok()).toBe(true);
    await page.reload();
    await page
      .getByRole("button", { name: "Borrar y cargar los míos" })
      .click();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    expect((await fetchInventory(request, email)).inventory).toHaveLength(4);
    await page
      .getByRole("button", { name: "Borrar y cargar los míos" })
      .click();
    await page
      .getByRole("button", { name: "Borrar ejemplos", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Cargá tu stock" }),
    ).toBeVisible();
    const saved = (await fetchInventory(request, email)).inventory;
    expect(saved).toHaveLength(1);
    expect(saved[0].model).toBe("Equipo real");
  });
  test("una cuenta existente entra sin recorrido y muestra Primeros pasos desde Ayuda", async ({
    page,
    request,
  }, info) => {
    await bootstrapStoreViaApi(
      page,
      request,
      buildTestEmail(info, "existing344"),
      "Existente",
    );
    await expect(page.getByTestId("stock-onboarding")).toHaveCount(0);
    await expect(page.getByTestId("getting-started")).toHaveCount(0);
    if (phone) await page.getByTestId("sidebar-tab-more").click();
    await openDeskSection(page, 'help');
    await expect(page.getByTestId("getting-started")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "▶ Ver video de bienvenida" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Mostrar en Dashboard" }).click();
    await page.getByTestId("sidebar-tab-dashboard").click();
    await expect(page.getByTestId("getting-started")).toBeVisible();
    await fits(page);
  });
  test("el análisis muestra los equipos antes del resultado y no se queda en cero", async ({
    page,
    request,
  }, info) => {
    const email = buildTestEmail(info, "onboarding-progress");
    await start(page, email);
    await toStock(page);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/import/analyze-text", async (route) => {
      await gate;
      await route.fulfill({ json: analysis });
    });
    await paste(page);
    await expect(page.getByTestId("onboarding-analyze-status")).toHaveText(
      /Leyendo/,
    );
    await expect(page.getByText("0 equipos reconocidos")).toHaveCount(0);
    const appeared = page
      .getByTestId("onboarding-analyzing")
      .getByText("iPhone 13")
      .waitFor();
    release();
    await appeared;
    expect((await fetchInventory(request, email)).inventory).toHaveLength(0);
    await expect(page.getByTestId("onboarding-equipment-count")).toHaveText("3");
    await fits(page);
  });
  test("una fila sin moneda queda fuera del total en dólares", async ({
    page,
    request,
  }, info) => {
    const email = buildTestEmail(info, "onboarding-currency");
    await start(page, email);
    await toStock(page);
    await page.route("**/api/import/analyze-text", (route) =>
      route.fulfill({
        json: {
          ...analysis,
          rows: [
            { ...analysis.rows[0], quantity: "1", price: "420" },
            {
              model: "Libre",
              capacity: "",
              color: "",
              condition: "USADO",
              price: "100",
              currency: "",
              quantity: "1",
              batteryHealth: "",
            },
          ],
          review: [
            { line: 1, original: "iPhone 13 USD420", dudas: [] },
            {
              line: 2,
              original: "libre 100",
              dudas: ["Sin moneda: elegí ARS o USD antes de importar."],
            },
          ],
        },
      }),
    );
    await paste(page, "iPhone 13 USD420\nlibre 100");
    await expect(page.getByTestId("onboarding-stock-usd")).toHaveText("US$ 420");
    await expect(page.getByTestId("onboarding-without-currency")).toContainText(
      "1 equipo sin moneda no entra en el total",
    );
    await expect(page.getByRole("button", { name: /Libre/ })).toContainText(
      "Sin moneda",
    );
    expect((await fetchInventory(request, email)).inventory).toHaveLength(0);
    await fits(page);
  });
}
