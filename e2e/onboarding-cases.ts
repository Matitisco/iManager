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
async function start(page: Page, email: string) {
  await quote(page);
  await loginViaUi(page, email);
  await page.getByTestId("onboarding-store-name").fill("Tienda Palermo");
  await page.getByTestId("onboarding-submit").click();
  await expect(page.getByTestId("onboarding-invite")).toBeVisible();
}
async function toStock(page: Page) {
  await page
    .getByTestId("onboarding-invite")
    .getByRole("button", { name: "Saltar por ahora" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cargá tu stock" }),
  ).toBeVisible();
}
async function paste(page: Page, value = text) {
  await page.getByRole("button", { name: "Pegar mi lista" }).click();
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
  test("nombre → invitación → lista → revisión → inventario, sin guardar antes de confirmar", async ({
    page,
    request,
  }, info) => {
    const email = buildTestEmail(info, "onboarding-happy");
    await start(page, email);
    await page
      .getByRole("button", { name: "Invitar al equipo", exact: true })
      .click();
    const invite = page.getByRole("dialog", {
      name: "Invitar al equipo",
      exact: true,
    });
    await invite.getByRole("button", { name: "Empleado", exact: true }).click();
    await invite.getByRole("button", { name: "Generar link" }).click();
    await expect(
      page.getByRole("dialog", { name: "Link listo" }),
    ).toBeVisible();
    const link = await page.locator(".linkrow span").innerText();
    const token = link.split("/invite/")[1];
    const employeeEmail = buildTestEmail(info, "employee");
    // Accept using the real existing invitation API, then verify the checklist uses membership.
    const accepted = await request.post(`${API}/api/invitations/accept`, {
      headers: authHeaders(employeeEmail),
      data: { token },
    });
    expect(accepted.ok()).toBe(true);
    await page
      .getByRole("dialog", { name: "Link listo" })
      .getByRole("button", { name: "Listo", exact: true })
      .click();
    await page
      .getByTestId("onboarding-invite")
      .getByRole("button", { name: "Seguir", exact: true })
      .click();
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
    const checklist = page.getByTestId("getting-started");
    await expect(checklist).toBeVisible();
    await expect(checklist.getByTestId("first-step-stock")).toHaveCount(0);
    await expect(checklist.getByTestId("first-step-video")).toHaveCount(0);
    await expect(page.getByText("Video de bienvenida")).toHaveCount(0);
    await expect(checklist.getByTestId("first-step-team")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("getting-started")).toBeVisible();
  });
  test("saltea cada pantalla, reanuda al recargar y permite cerrar/reabrir checklist desde Ayuda", async ({
    page,
    request,
  }, info) => {
    const email = buildTestEmail(info, "onboarding-skip");
    await start(page, email);
    await page.reload();
    await expect(page.getByTestId("onboarding-invite")).toBeVisible();
    await page.getByRole("button", { name: "Saltar por ahora" }).click();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Cargá tu stock" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Saltar por ahora" }).click();
    await expect(
      page.getByRole("button", { name: "Cargar mi stock", exact: true }),
    ).toBeVisible();
    await fits(page);
    await page.screenshot({
      path: info.outputPath("dashboard-vacio.png"),
      fullPage: true,
    });
    expect((await fetchInventory(request, email)).inventory).toHaveLength(0);
    await page.getByRole("button", { name: "Cargar mi stock", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /Probar con datos de ejemplo/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Probar con datos de ejemplo/ }).click();
    await expect(
      page.getByText("Estás viendo datos de ejemplo", { exact: false }),
    ).toBeVisible();
    await fits(page);
    await page.getByRole("button", { name: "Cerrar Primeros pasos" }).click();
    await page.reload();
    await expect(page.getByTestId("getting-started")).toHaveCount(0);
    if (phone) await page.getByTestId("sidebar-tab-more").click();
    await page.getByTestId("sidebar-tab-help").click();
    await expect(page.getByTestId("getting-started")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "▶ Ver video de bienvenida" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Mostrar en Dashboard" }).click();
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
    await page.getByTestId("sidebar-tab-help").click();
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
