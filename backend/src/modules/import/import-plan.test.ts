import { describe, expect, it } from "vitest";
import { planWorkbook, toBatteryPercent, type SheetGrid } from "./import-plan.js";

const usados: SheetGrid = {
  name: "iPhones Usados",
  rows: [
    ["STOCK DE EQUIPOS USADOS"],
    ["TU COMPRA INCLUYE DE REGALO CABLE + FUNDA + VIDRIO"],
    ["COTIZACION EN PESOS SEGUN PRECIO DE VENTA DEL DOLAR BLUE:", "", "", "", "1540"],
    ["PRECIO DE PROMOCIÓN ABONANDO SOLO EN EFECTIVO!"],
    ["Modelo", "Batería", "Color", "PRECIO USD", "PRECIO ARS"],
    ["12 64 GB", "1", "Midnight", "280", "435.4"],
    ["13 mini 128 GB", "0.96", "Midnight", "310", "477400"],
    ["13 mini 128 GB", "1", "Midnight", "330", "508200"],
    ["13 mini 256 GB", "1", "Midnight", "350", "539000"],
    ["13 128 GB", "83% - 84%", "Starlight", "340", "523600"],
    ["13 Pro 128 GB", "1", "Grafito", "470", "723800"],
    ["13 Pro 256 GB", "1", "Grafito", "500", "770000"],
    ["13 Pro Max 128 GB", "1", "Blue", "590", "908600"],
    ["14 128 GB", "0.87", "Midnight", "440", "677600"],
    ["14 128 GB", "1", "Starlight - Lila", "450", "693000"],
    ["14 Pro 128 GB", "1", "Black", "550", "847000"],
    ["15 128 GB", "0.89", "Black", "530", "816200"],
    ["15 Pro 128 GB", "0.89", "Natural", "650", "1001000"],
    ["16 128 GB", "0.88", "White", "640", "985600"],
    ["16 128 GB", "0.89", "White", "650", "1001000"],
    ["16 Plus 256 GB", "90% - 91%", "Black - Pink", "720", "1108800"],
    ["16 Pro Max 256 GB", "91% 92%", "Desert", "960", "$1.497.600"],
    ["16 Pro Max 256 GB", "0.95", "Black", "980", "1509200"],
    ["17 Pro 256 GB", "0.92", "Orange", "1150", "1771000"],
    ["17 Pro Max 256 GB", "0.9", "Orange", "1230", "1894200"],
    ["PRECIO NO INCLUYE IVA"],
  ],
};

const nuevos: SheetGrid = {
  name: "iPhones Nuevos",
  rows: [
    ["STOCK DE EQUIPOS NUEVOS"],
    ["GARANTIA OFICIAL APPLE POR 12 MESES!"],
    ["CON TU COMPRA TE LLEVAS DE REGALO FUNDA A ELECCION"],
    ["COTIZACION EN PESOS SEGUN PRECIO DE VENTA DEL DOLAR BLUE:", "", "", "1540"],
    ["PRECIO DE PROMOCIÓN ABONANDO SOLO EN EFECTIVO!"],
    ["Modelo", "Color", "PRECIO USD", "PRECIO ARS"],
    ["15 128 GB", "Black - Blue", "790", "1216600"],
    ["17 256 GB", "Sage", "1050", "1617000"],
    ["17 Pro 256 GB", "Blue", "1260", "1940400"],
    ["17 Pro Max 256 GB", "Orange", "1370", "2109800"],
    ["18 Pro 256 GB", "Black", "1490", "2294600"],
    ["18 Pro Max 256 GB", "Black", "1670", "2571800"],
    ["IPADS"],
    ["iPad A16 256 GB", "Silver", "620", "954800"],
    ["OTROS ACCESORIOS ORIGIANALES"],
    ["AirPods Pro 3", "", "290", "446600"],
    ["Adaptador 20 W", "", "58", "89320"],
    ["AirTag Pack x4", "", "180", "277200"],
    ["PRECIO NO INCLUYE IVA."],
  ],
};

const outlet: SheetGrid = {
  name: "OUTLET",
  rows: [
    ["EQUIPOS OUTLET"],
    ["GARANTIA POR 90 DIAS!!!!!"],
    ["TU COMPRA INCLUYE DE REGALO CABLE + FUNDA + VIDRIO"],
    ["COTIZACION EN PESOS SEGUN PRECIO DE VENTA DEL DOLAR BLUE:", "", "", "", "1540"],
    ["PRECIO DE PROMOCIÓN ABONANDO SOLO EN EFECTIVO!"],
    ["Modelo", "Batería", "Color", "PRECIO USD", "PRECIO ARS"],
    ["13 Pro Max 128 GB", "0.84", "Green", "460", "708400"],
    ["15 Pro 128 GB", "1", "Blue", "600", "924000"],
    ["15 Pro Max 256 GB", "0.85", "Blue", "700", "1078000"],
    ["15 Pro Max 256 GB", "0.86", "Blue", "710", "1093400"],
    ["15 Pro Max 256 GB", "1", "Natural", "730", "1124200"],
    ["16 Pro 128 GB", "0.9", "Natural", "790", "1216600"],
    ["16 Pro Max 256 GB", "0.92", "Black", "920", "1416800"],
    ["PRECIO NO INCLUYE IVA"],
  ],
};

const ejemplo = [usados, nuevos, outlet];

describe("ejemplo-stock workbook", () => {
  const sheets = planWorkbook(ejemplo, { section: "inventory", currency: "ARS", sellRate: 1300 });

  it("imports every valid sheet without a manual header or mapping", () => {
    expect(sheets.map((sheet) => [sheet.name, sheet.include, sheet.rows.length, sheet.condition])).toEqual([
      ["iPhones Usados", true, 20, "USADO"],
      ["iPhones Nuevos", true, 10, "NUEVO"],
      ["OUTLET", true, 7, "OUTLET"],
    ]);
    expect(sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0)).toBe(37);
    expect(sheets[0]?.headerRow).toBe(4);
    expect(sheets[0]?.mapping).toMatchObject({
      model: "Modelo",
      batteryHealth: "Batería",
      color: "Color",
      price: "PRECIO ARS",
    });
    expect(Object.values(sheets[0]?.mapping ?? {})).not.toContain("PRECIO USD");
  });

  it("splits the model, keeps english colors and fixes the broken peso cell", () => {
    const rows = sheets[0]?.rows ?? [];
    expect(rows[0]).toMatchObject({
      model: "12",
      capacity: "64 GB",
      color: "Midnight",
      batteryHealth: "100%",
      price: "431200",
      condition: "USADO",
    });
    expect(rows[1]).toMatchObject({
      model: "13 mini",
      capacity: "128 GB",
      color: "Midnight",
      batteryHealth: "96%",
      price: "477400",
    });
    expect(rows[4]).toMatchObject({ model: "13", capacity: "128 GB", batteryHealth: "83% - 84%", color: "Starlight" });
    expect(rows[5]).toMatchObject({ model: "13 Pro", color: "Grafito" });
    expect(rows[9]).toMatchObject({ color: "Starlight - Lila" });
    expect(rows[16]).toMatchObject({
      model: "16 Pro Max",
      capacity: "256 GB",
      batteryHealth: "91% - 92%",
      color: "Desert",
      price: "1497600",
    });
    expect(rows.some((row) => /iva|ipad|accesorio|stock/i.test(row.model ?? ""))).toBe(false);
  });

  it("keeps new accessories and outlet phones with the sheet condition", () => {
    const fresh = sheets[1]?.rows ?? [];
    expect(fresh.map((row) => row.model)).toEqual([
      "15",
      "17",
      "17 Pro",
      "17 Pro Max",
      "18 Pro",
      "18 Pro Max",
      "iPad A16",
      "AirPods Pro 3",
      "Adaptador 20 W",
      "AirTag Pack x4",
    ]);
    expect(fresh.every((row) => row.condition === "NUEVO")).toBe(true);
    expect(fresh.find((row) => row.model === "iPad A16")).toMatchObject({ capacity: "256 GB", color: "Silver", price: "954800" });
    expect(fresh.find((row) => row.model === "Adaptador 20 W")?.capacity).toBeUndefined();
    const airpods = fresh.find((row) => row.model === "AirPods Pro 3");
    expect(airpods).toMatchObject({ price: "446600" });
    expect(airpods?.color).toBeUndefined();

    const discounted = sheets[2]?.rows ?? [];
    expect(discounted).toHaveLength(7);
    expect(discounted.every((row) => row.condition === "OUTLET")).toBe(true);
    expect(discounted[0]).toMatchObject({ model: "13 Pro Max", capacity: "128 GB", batteryHealth: "84%", color: "Green", price: "708400" });
    expect(discounted[1]).toMatchObject({ batteryHealth: "100%", color: "Blue" });
  });

  it("uses the dollar column when the store currency is USD", () => {
    const [sheet] = planWorkbook([usados], { section: "inventory", currency: "USD", sellRate: null });
    expect(sheet?.mapping.price).toBe("PRECIO USD");
    expect(sheet?.rows[0]).toMatchObject({ price: "280", color: "Midnight" });
    expect(sheet?.rows[1]?.price).toBe("310");
  });

  it("converts with the store rate when the sheet has no quote", () => {
    const grid: SheetGrid = {
      name: "Usados",
      rows: [
        ["Modelo", "PRECIO USD", "PRECIO ARS"],
        ["13 128 GB", "310", "50"],
      ],
    };
    const [sheet] = planWorkbook([grid], { section: "inventory", currency: "ARS", sellRate: 1500 });
    expect(sheet?.rows[0]).toMatchObject({ model: "13", capacity: "128 GB", price: "465000", condition: "USADO" });
  });

  it("keeps a price column the user picked", () => {
    const [sheet] = planWorkbook(ejemplo, {
      section: "inventory",
      currency: "ARS",
      sellRate: null,
      overrides: [{
        name: "iPhones Usados",
        include: true,
        headerRow: 4,
        lockMoney: true,
        mapping: { model: "Modelo", price: "PRECIO USD", color: "Color", batteryHealth: "Batería" },
      }],
    });
    expect(sheet?.rows).toHaveLength(20);
    expect(sheet?.rows[1]).toMatchObject({ model: "13 mini", price: "477400" });
    expect(sheet?.rows[0]?.price).toBe("431200");
  });
});

describe("battery percents", () => {
  it("turns fractions and loose ranges into percents", () => {
    expect(toBatteryPercent("0.96")).toBe("96%");
    expect(toBatteryPercent("1")).toBe("100%");
    expect(toBatteryPercent("83% - 84%")).toBe("83% - 84%");
    expect(toBatteryPercent("91% 92%")).toBe("91% - 92%");
    expect(toBatteryPercent("90% - 91%")).toBe("90% - 91%");
  });
});
