import { describe, expect, it } from "vitest";
import {
  commissionForSale,
  currentPeriodKey,
  monthBounds,
  ruleForSale,
  startOfZonedDay,
  summarizeCommissions,
  type MemberSnapshot,
  type RuleSnapshot,
  type SaleSnapshot,
} from "./commission-math.js";

const seller: MemberSnapshot = { memberId: "m-a", userId: "u-a", name: "Vendedor Ejemplo A", role: "STAFF" };
const employee: MemberSnapshot = { memberId: "m-c", userId: "u-c", name: "Empleado Ejemplo C", role: "STAFF" };

function rule(partial: Partial<RuleSnapshot> & Pick<RuleSnapshot, "id" | "basis" | "rate">): RuleSnapshot {
  return {
    memberId: null,
    userId: null,
    includeAccessories: false,
    settlement: "MONTHLY",
    effectiveFrom: new Date("2026-10-01T03:00:00.000Z"),
    createdAt: new Date("2026-10-01T03:00:00.000Z"),
    ...partial,
  };
}

function sale(partial: Partial<SaleSnapshot> & Pick<SaleSnapshot, "amount">): SaleSnapshot {
  return {
    id: "sale",
    saleNumber: 139,
    soldAt: new Date("2026-10-06T15:00:00.000Z"),
    dateLabel: "06/10/2026",
    status: "COMPLETADA",
    deviceLabel: "iPhone 14 Pro 256GB",
    deviceCost: 400000,
    userId: seller.userId,
    accessories: [],
    ...partial,
  };
}

describe("commission periods", () => {
  it("bounds October in Argentina time", () => {
    const period = monthBounds("2026-10", new Date("2026-10-08T15:00:00.000Z"));
    expect(period).toMatchObject({
      key: "2026-10",
      label: "Octubre 2026",
      closesLabel: "31/10",
      current: true,
    });
    expect(period?.start.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(period?.end.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(monthBounds("2026-13")).toBeNull();
    expect(currentPeriodKey(new Date("2026-10-08T02:00:00.000Z"))).toBe("2026-10");
    expect(startOfZonedDay(new Date("2026-10-08T15:00:00.000Z")).toISOString()).toBe("2026-10-08T03:00:00.000Z");
  });
});

describe("commission math", () => {
  const teamPercent = rule({ id: "team", basis: "PERCENT_SALE", rate: 3, includeAccessories: true });
  const personalFixed = rule({
    id: "personal",
    memberId: employee.memberId,
    userId: employee.userId,
    basis: "FIXED_PER_DEVICE",
    rate: 15000,
    includeAccessories: false,
    effectiveFrom: new Date("2026-10-08T03:00:00.000Z"),
    createdAt: new Date("2026-10-08T12:00:00.000Z"),
  });

  it("takes a percent of the sale and can add the accessories already included in the total", () => {
    const row = sale({
      amount: 548000,
      accessories: [{ quantity: 1, unitPrice: 18000, unitCost: 8000, voided: false }],
    });
    expect(commissionForSale(row, teamPercent)).toBe(16440);
    expect(commissionForSale(row, { ...teamPercent, includeAccessories: false })).toBe(15900);
  });

  it("uses profit, skips voided accessories and ignores a cancelled sale", () => {
    const profit = rule({ id: "profit", basis: "PERCENT_PROFIT", rate: 10, includeAccessories: true });
    const row = sale({
      amount: 548000,
      deviceCost: 400000,
      accessories: [
        { quantity: 1, unitPrice: 18000, unitCost: 8000, voided: false },
        { quantity: 1, unitPrice: 5000, unitCost: 1000, voided: true },
      ],
    });
    expect(commissionForSale(row, profit)).toBe(14000);
    expect(commissionForSale({ ...row, status: "CANCELADA" }, profit)).toBe(0);
  });

  it("pays a fixed amount per device and lets a personal rule replace the team rule from its effective day", () => {
    const before = sale({
      id: "old",
      userId: employee.userId,
      amount: 650000,
      soldAt: new Date("2026-10-07T15:00:00.000Z"),
    });
    const today = sale({
      id: "today",
      userId: employee.userId,
      amount: 650000,
      soldAt: new Date("2026-10-08T15:00:00.000Z"),
    });
    expect(ruleForSale([teamPercent, personalFixed], employee.userId, before.soldAt)?.id).toBe("team");
    expect(ruleForSale([teamPercent, personalFixed], employee.userId, today.soldAt)?.id).toBe("personal");
    expect(commissionForSale(today, personalFixed)).toBe(15000);
  });

  it("sums the period, skips cancelled sales and marks who was paid", () => {
    const summary = summarizeCommissions({
      members: [seller, employee],
      rules: [teamPercent, personalFixed],
      payments: [{ memberId: seller.memberId, paidAt: new Date("2026-10-05T15:00:00.000Z"), amount: 16440 }],
      sales: [
        sale({
          id: "a",
          saleNumber: 139,
          amount: 548000,
          accessories: [{ quantity: 1, unitPrice: 18000, unitCost: 8000, voided: false }],
        }),
        sale({ id: "void", saleNumber: 140, amount: 200000, status: "CANCELADA" }),
        sale({
          id: "c",
          saleNumber: 12,
          userId: employee.userId,
          amount: 650000,
          deviceLabel: "iPhone 11 64GB",
          soldAt: new Date("2026-10-08T15:00:00.000Z"),
          dateLabel: "08/10/2026",
        }),
        sale({ id: "stranger", userId: "gone", amount: 999 }),
      ],
    });

    expect(summary.salesCount).toBe(2);
    expect(summary.soldAmount).toBe(548000 + 650000);
    expect(summary.commission).toBe(16440 + 15000);
    expect(summary.paidCount).toBe(1);
    expect(summary.paidAmount).toBe(16440);
    expect(summary.pendingAmount).toBe(15000);
    expect(summary.people.map((person) => person.name)).toEqual(["Empleado Ejemplo C", "Vendedor Ejemplo A"]);
    expect(summary.people[1]?.sales[0]?.code).toBe("#V-0139");
    expect(summary.people[1]?.rule?.label).toBe("3% sobre la venta");
    expect(summary.people[1]?.rule?.detail).toBe("incluye accesorios");
    expect(summary.people[0]?.rule?.label).toBe("$ 15.000 por equipo");
  });
});
