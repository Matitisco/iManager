import { describe, expect, it } from "vitest";
import { assembleFollowUps, debtSchedule, groupFollowUps, sortFollowUps, type FollowUpCard, type FollowUpSettings } from "./follow-ups.js";

const settings: FollowUpSettings = {
  birthdayLeadDays: 7,
  warrantyMonths: 12,
  warrantyLeadDays: 15,
  inactiveDays: 180,
  includeDebts: true,
};

function card(partial: Pick<FollowUpCard, "id" | "kind" | "clientId" | "name"> & Partial<FollowUpCard>): FollowUpCard {
  return {
    phone: "",
    title: "",
    detail: "no parsear",
    amount: null,
    dueDate: null,
    lastPurchaseAt: null,
    warrantyEndsAt: null,
    deviceLabel: null,
    currency: null,
    installmentSequence: null,
    installmentCount: null,
    birthdayOn: null,
    turningAge: null,
    warrantyDays: null,
    ...partial,
  };
}

describe("seguimientos estructurados", () => {
  it("arma monto, vencimiento, última compra, garantía y equipo sin depender del texto", () => {
    const { cards, groups } = assembleFollowUps({
      today: "2026-10-18",
      settings,
      clients: [
        { id: "lucia", name: "Lucía Fernández", phone: "1162007525", birthday: null, lastPurchaseAt: "2026-10-02" },
        { id: "nico", name: "Nicolás Pereyra", phone: "1147252919", birthday: null, lastPurchaseAt: "2026-09-20" },
        { id: "martin", name: "Martín Acosta", phone: "1145399666", birthday: "1992-10-19", lastPurchaseAt: "2026-09-01" },
        { id: "carla", name: "Carla Ruiz", phone: "1174265813", birthday: "1996-10-23", lastPurchaseAt: "2026-08-01" },
        { id: "diego", name: "Diego Sosa", phone: "1112005924", birthday: null, lastPurchaseAt: "2026-08-25" },
        { id: "julieta", name: "Julieta Romero", phone: "1183724161", birthday: null, lastPurchaseAt: "2026-10-01" },
        { id: "pablo", name: "Pablo Ríos", phone: "", birthday: null, lastPurchaseAt: "2026-04-09" },
        { id: "laura", name: "Laura Méndez", phone: "1128145387", birthday: null, lastPurchaseAt: "2026-03-22" },
      ],
      debts: [
        {
          clientId: "lucia",
          name: "Lucía Fernández",
          phone: "1162007525",
          amount: 640000,
          currency: "ARS",
          lines: [{ source: "VENTA", openedAt: "2026-10-02", installments: [] }, { source: "REPARACION", openedAt: "2026-01-01", installments: [] }],
        },
        {
          clientId: "nico",
          name: "Nicolás Pereyra",
          phone: "1147252919",
          amount: 420000,
          currency: "ARS",
          lines: [{
            source: "VENTA",
            openedAt: "2026-09-20",
            installments: [
              { sequence: 1, dueDate: "2026-09-20", status: "PAGADA" },
              { sequence: 2, dueDate: "2026-10-20", status: "PENDIENTE" },
              { sequence: 3, dueDate: "2026-11-20", status: "PENDIENTE" },
            ],
          }],
        },
        { clientId: "ajeno", name: "Ajeno", phone: "1100000000", amount: 999999, currency: "ARS", lines: [{ source: "MANUAL", openedAt: "2026-01-01", installments: [] }] },
      ],
      warranties: [
        { saleId: "s-diego", clientId: "diego", name: "Diego Sosa", phone: "1112005924", deviceLabel: "iPhone 13 128GB", soldOn: "2026-08-25", warrantyDays: 60 },
        { saleId: "s-julieta", clientId: "julieta", name: "Julieta Romero", phone: "1183724161", deviceLabel: "iPhone 14 Pro 256GB", soldOn: "2026-10-01", warrantyDays: 30 },
        { saleId: "s-tarde", clientId: "diego", name: "Diego Sosa", phone: "1112005924", deviceLabel: "Otro", soldOn: "2026-10-18", warrantyDays: 40 },
      ],
      devices: [
        { clientId: "pablo", deviceLabel: "iPhone 11" },
        { clientId: "laura", deviceLabel: "iPhone 12" },
      ],
    });

    expect(cards.find((item) => item.clientId === "lucia" && item.kind === "DEUDA")).toMatchObject({
      amount: 640000,
      dueDate: "2026-10-02",
      currency: "ARS",
      installmentSequence: null,
      lastPurchaseAt: null,
      warrantyEndsAt: null,
      deviceLabel: null,
    });
    expect(cards.find((item) => item.clientId === "nico")).toMatchObject({
      amount: 420000,
      dueDate: "2026-10-20",
      installmentSequence: 2,
      installmentCount: 3,
    });
    expect(cards.find((item) => item.id === "birthday-martin")).toMatchObject({
      birthdayOn: "2026-10-19",
      turningAge: 34,
      amount: null,
      dueDate: null,
    });
    expect(cards.find((item) => item.id === "birthday-carla")).toMatchObject({ birthdayOn: "2026-10-23", turningAge: 30 });
    expect(cards.find((item) => item.id === "warranty-s-diego")).toMatchObject({
      warrantyEndsAt: "2026-10-24",
      deviceLabel: "iPhone 13 128GB",
      warrantyDays: 60,
      amount: null,
    });
    expect(cards.find((item) => item.id === "warranty-s-julieta")).toMatchObject({
      warrantyEndsAt: "2026-10-31",
      deviceLabel: "iPhone 14 Pro 256GB",
    });
    expect(cards.find((item) => item.id === "warranty-s-tarde")).toBeUndefined();
    expect(cards.find((item) => item.id === "inactive-pablo")).toMatchObject({
      lastPurchaseAt: "2026-04-09",
      deviceLabel: "iPhone 11",
      phone: "",
      amount: null,
    });
    expect(cards.find((item) => item.id === "inactive-laura")).toMatchObject({ lastPurchaseAt: "2026-03-22", deviceLabel: "iPhone 12" });
    expect(cards.some((item) => item.name === "Ajeno")).toBe(false);

    expect(groups.map((group) => group.kind)).toEqual(["DEUDA", "CUMPLEANOS", "GARANTIA", "INACTIVO"]);
    expect(groups.find((group) => group.kind === "DEUDA")).toEqual({ kind: "DEUDA", count: 2, totalAmount: 1060000, currency: "ARS" });
    expect(groups.find((group) => group.kind === "CUMPLEANOS")).toMatchObject({ count: 2, totalAmount: null });
    expect(groups.find((group) => group.kind === "GARANTIA")).toMatchObject({ count: 2, totalAmount: null });
    expect(groups.find((group) => group.kind === "INACTIVO")).toMatchObject({ count: 2, totalAmount: null });
    expect(cards.map((item) => item.kind)).toEqual([
      "DEUDA", "DEUDA",
      "CUMPLEANOS", "CUMPLEANOS",
      "GARANTIA", "GARANTIA",
      "INACTIVO", "INACTIVO",
    ]);
    expect(cards.filter((item) => item.kind === "DEUDA").map((item) => item.amount)).toEqual([640000, 420000]);
    expect(cards.filter((item) => item.kind === "INACTIVO").map((item) => item.name)).toEqual(["Pablo Ríos", "Laura Méndez"]);
  });

  it("anula el total del grupo cuando las deudas mezclan moneda y respeta las reglas", () => {
    const mixed = groupFollowUps([
      card({ id: "a", kind: "DEUDA", clientId: "a", name: "A", amount: 10, currency: "ARS" }),
      card({ id: "b", kind: "DEUDA", clientId: "b", name: "B", amount: 5, currency: "USD" }),
    ]);
    expect(mixed).toEqual([{ kind: "DEUDA", count: 2, totalAmount: null, currency: null }]);

    const hidden = assembleFollowUps({
      today: "2026-10-18",
      settings: { ...settings, includeDebts: false, birthdayLeadDays: 0, warrantyLeadDays: 0 },
      clients: [{ id: "ana", name: "Ana", phone: "2615550101", birthday: "1990-10-19", lastPurchaseAt: "2026-10-01" }],
      debts: [{ clientId: "ana", name: "Ana", phone: "2615550101", amount: 100, currency: "ARS", lines: [{ source: "MANUAL", openedAt: "2026-10-01", installments: [] }] }],
      warranties: [{ saleId: "s", clientId: "ana", name: "Ana", phone: "2615550101", deviceLabel: "iPhone", soldOn: "2026-10-10", warrantyDays: 30 }],
      devices: [],
    });
    expect(hidden.cards).toEqual([]);
    expect(hidden.groups).toEqual([]);
  });

  it("elige la cuota impaga más próxima y deja afuera la reparación", () => {
    expect(debtSchedule([
      { source: "REPARACION", openedAt: "2020-01-01", installments: [] },
      {
        source: "VENTA",
        openedAt: "2026-09-01",
        installments: [
          { sequence: 1, dueDate: "2026-09-01", status: "PAGADA" },
          { sequence: 2, dueDate: "2026-10-01", status: "VENCIDA" },
          { sequence: 3, dueDate: "2026-11-01", status: "PENDIENTE" },
        ],
      },
    ])).toEqual({ dueDate: "2026-10-01", installmentSequence: 2, installmentCount: 3 });
    expect(debtSchedule([{ source: "MANUAL", openedAt: "2026-09-28", installments: [] }])).toEqual({
      dueDate: "2026-09-28",
      installmentSequence: null,
      installmentCount: null,
    });
  });

  it("ordena deudas por monto y garantías por vencimiento", () => {
    const ordered = sortFollowUps([
      card({ id: "g2", kind: "GARANTIA", clientId: "b", name: "B", warrantyEndsAt: "2026-10-30" }),
      card({ id: "d2", kind: "DEUDA", clientId: "b", name: "B", amount: 10 }),
      card({ id: "g1", kind: "GARANTIA", clientId: "a", name: "A", warrantyEndsAt: "2026-10-24" }),
      card({ id: "d1", kind: "DEUDA", clientId: "a", name: "A", amount: 50 }),
    ]);
    expect(ordered.map((item) => item.id)).toEqual(["d1", "d2", "g1", "g2"]);
  });
});
