import { PrismaClient, type Client } from "@prisma/client";

const prisma = new PrismaClient();
const SEED = "reports-charts";
const EMAIL = "matiscorniaok@gmail.com";

const MODELS = [
  { model: "iPhone 13", capacity: "128GB", color: "Medianoche", cost: 620_000, price: 890_000 },
  { model: "iPhone 14", capacity: "128GB", color: "Azul", cost: 780_000, price: 1_090_000 },
  { model: "iPhone 15", capacity: "128GB", color: "Negro", cost: 980_000, price: 1_350_000 },
  { model: "Galaxy S23", capacity: "256GB", color: "Verde", cost: 540_000, price: 790_000 },
  { model: "iPhone 12", capacity: "64GB", color: "Blanco", cost: 380_000, price: 560_000 },
] as const;

const PAYMENTS = ["TRANSFERENCIA", "TRANSFERENCIA", "EFECTIVO", "TARJETA", "CANJE / PAGO"] as const;
const MODEL_ROTATION = [0, 0, 1, 1, 2, 3, 4];

const CLIENTS = [
  { dni: "SEED90001", name: "Lucía Fernández", email: "lucia.fernandez@example.com", phone: "2615550101", pendingBalance: 180_000 },
  { dni: "SEED90002", name: "Martín Acosta", email: "martin.acosta@example.com", phone: "2615550102", pendingBalance: 0 },
  { dni: "SEED90003", name: "Sofía Benítez", email: "sofia.benitez@example.com", phone: "2615550103", pendingBalance: 95_000 },
  { dni: "SEED90004", name: "Julián Romero", email: "julian.romero@example.com", phone: "2615550104", pendingBalance: 0 },
  { dni: "SEED90005", name: "Camila Duarte", email: "camila.duarte@example.com", phone: "2615550105", pendingBalance: 0 },
  { dni: "SEED90006", name: "Nicolás Pereyra", email: "nicolas.pereyra@example.com", phone: "2615550106", pendingBalance: 240_000 },
];

type PlannedSale = {
  daysAgo: number;
  amount: number;
  pending?: boolean;
};

type PlannedTradeIn = {
  daysAgo: number;
  status: string;
  difference: number;
};

type PlannedStock = {
  daysAgo: number;
  status: "DISPONIBLE" | "EN_REVISION";
  modelIndex: number;
  cost: number;
  price: number;
};

function argentinaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

function atNoon(daysAgo: number) {
  const today = argentinaParts();
  const date = new Date(Date.UTC(today.year, today.month - 1, today.day, 15, 0, 0));
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
}

function onDay(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 15, 0, 0));
}

function dateLabel(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("day")}/${read("month")}/${read("year")}`;
}

function imei(index: number) {
  return `35977${String(index).padStart(10, "0")}`;
}

function recentSales(): PlannedSale[] {
  const planned: PlannedSale[] = [
    { daysAgo: 0, amount: 1_850_000 },
    { daysAgo: 1, amount: 720_000 },
    { daysAgo: 2, amount: 1_340_000 },
    { daysAgo: 3, amount: 540_000 },
    { daysAgo: 4, amount: 1_680_000 },
    { daysAgo: 5, amount: 980_000 },
    { daysAgo: 6, amount: 410_000 },
    { daysAgo: 8, amount: 900_000 },
    { daysAgo: 10, amount: 760_000 },
    { daysAgo: 12, amount: 1_120_000 },
    { daysAgo: 13, amount: 640_000 },
    { daysAgo: 16, amount: 520_000 },
    { daysAgo: 19, amount: 380_000 },
    { daysAgo: 22, amount: 870_000 },
    { daysAgo: 24, amount: 690_000 },
    { daysAgo: 26, amount: 740_000 },
    { daysAgo: 27, amount: 510_000 },
    { daysAgo: 28, amount: 830_000 },
    { daysAgo: 29, amount: 610_000 },
    { daysAgo: 2, amount: 460_000, pending: true },
    { daysAgo: 9, amount: 390_000, pending: true },
  ];

  for (const daysAgo of [33, 37, 41, 46, 52, 58]) {
    planned.push({ daysAgo, amount: 480_000 + (daysAgo % 5) * 90_000 });
  }

  for (const daysAgo of [64, 71, 78, 86]) {
    planned.push({ daysAgo, amount: 420_000 + (daysAgo % 4) * 110_000 });
  }

  return planned;
}

function olderMonthSales(year: number, month: number, scale: number): Array<{ soldAt: Date; amount: number }> {
  return [4, 11, 18, 25].map((day, index) => ({
    soldAt: onDay(year, month, day),
    amount: Math.round((360_000 + index * 140_000 + month * 25_000) * scale),
  }));
}

function tradeIns(): PlannedTradeIn[] {
  const recent: PlannedTradeIn[] = [
    { daysAgo: 0, status: "APROBADO", difference: 280_000 },
    { daysAgo: 1, status: "PENDIENTE", difference: 95_000 },
    { daysAgo: 2, status: "LISTO", difference: 210_000 },
    { daysAgo: 4, status: "RECHAZADO", difference: 45_000 },
    { daysAgo: 6, status: "EN REVISIÓN", difference: 110_000 },
    { daysAgo: 8, status: "APROBADO", difference: 340_000 },
    { daysAgo: 11, status: "PERITAJE TÉC.", difference: 75_000 },
    { daysAgo: 15, status: "LISTO", difference: 190_000 },
    { daysAgo: 18, status: "RECHAZADO", difference: 60_000 },
    { daysAgo: 23, status: "APROBADO", difference: 260_000 },
    { daysAgo: 28, status: "PENDIENTE", difference: 130_000 },
    { daysAgo: 36, status: "LISTO", difference: 220_000 },
    { daysAgo: 44, status: "EN REVISIÓN", difference: 80_000 },
    { daysAgo: 55, status: "APROBADO", difference: 310_000 },
    { daysAgo: 67, status: "RECHAZADO", difference: 50_000 },
    { daysAgo: 79, status: "LISTO", difference: 175_000 },
    { daysAgo: 88, status: "PENDIENTE", difference: 100_000 },
  ];

  return recent;
}

function stockPlan(): PlannedStock[] {
  const disponible: PlannedStock[] = [
    ...[1, 3, 5, 7, 9, 11, 13, 14].map((daysAgo, index) => ({
      daysAgo,
      status: "DISPONIBLE" as const,
      modelIndex: index % MODELS.length,
      cost: 480_000 + index * 70_000,
      price: 720_000 + index * 85_000,
    })),
    ...[16, 18, 21, 24, 27, 29, 30].map((daysAgo, index) => ({
      daysAgo,
      status: "DISPONIBLE" as const,
      modelIndex: (index + 1) % MODELS.length,
      cost: 410_000 + index * 55_000,
      price: 640_000 + index * 70_000,
    })),
    ...[35, 42, 48, 53, 58, 60].map((daysAgo, index) => ({
      daysAgo,
      status: "DISPONIBLE" as const,
      modelIndex: (index + 2) % MODELS.length,
      cost: 360_000 + index * 60_000,
      price: 560_000 + index * 75_000,
    })),
    ...[75, 95, 120, 150, 190, 230, 280, 320].map((daysAgo, index) => ({
      daysAgo,
      status: "DISPONIBLE" as const,
      modelIndex: (index + 3) % MODELS.length,
      cost: 290_000 + index * 40_000,
      price: 470_000 + index * 50_000,
    })),
  ];

  const review: PlannedStock[] = [2, 6, 12, 20, 38, 70].map((daysAgo, index) => ({
    daysAgo,
    status: "EN_REVISION" as const,
    modelIndex: index % MODELS.length,
    cost: 350_000 + index * 45_000,
    price: 540_000 + index * 60_000,
  }));

  return [...disponible, ...review];
}

async function clearSeed(storeId: string) {
  const where = {
    storeId,
    customFields: { path: ["seed"], equals: SEED },
  };

  await prisma.sale.deleteMany({ where });
  await prisma.tradeIn.deleteMany({ where });
  await prisma.inventoryItem.deleteMany({ where });
  await prisma.client.deleteMany({ where });
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: EMAIL, mode: "insensitive" } },
    include: {
      memberships: {
        include: { store: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) {
    throw new Error(`No existe un usuario con email ${EMAIL}`);
  }

  const membership = user.memberships.find((entry) => entry.isDefault) ?? user.memberships[0];
  if (!membership) {
    throw new Error(`${EMAIL} no tiene una tienda asignada`);
  }

  const storeId = membership.storeId;
  await clearSeed(storeId);

  const category = await prisma.inventoryCategory.upsert({
    where: { storeId_name: { storeId, name: "Celulares" } },
    update: {},
    create: { storeId, name: "Celulares", sortOrder: 0 },
  });

  const clients: Client[] = [];
  for (const client of CLIENTS) {
    clients.push(
      await prisma.client.create({
        data: {
          storeId,
          dni: client.dni,
          name: client.name,
          email: client.email,
          phone: client.phone,
          pendingBalance: client.pendingBalance,
          totalSpent: 0,
          customFields: { seed: SEED },
        },
      })
    );
  }

  let serial = 1;
  const stock = stockPlan();
  for (const item of stock) {
    const model = MODELS[item.modelIndex];
    const createdAt = atNoon(item.daysAgo);
    await prisma.inventoryItem.create({
      data: {
        storeId,
        categoryId: category.id,
        imei: imei(serial),
        model: model.model,
        capacity: model.capacity,
        color: model.color,
        condition: "USADO",
        grade: item.daysAgo > 60 ? "B" : "A",
        batteryHealth: item.daysAgo > 60 ? "82%" : "91%",
        cost: item.cost,
        price: item.price,
        status: item.status,
        customFields: { seed: SEED },
        createdAt,
      },
    });
    serial += 1;
  }

  const spent = new Map<string, { total: number; last: Date }>();
  let paymentIndex = 0;
  let modelIndex = 0;
  let clientIndex = 0;

  const createSale = async (input: { soldAt: Date; amount: number; pending?: boolean }) => {
    const model = MODELS[MODEL_ROTATION[modelIndex % MODEL_ROTATION.length]];
    modelIndex += 1;
    const client = clients[clientIndex % clients.length];
    clientIndex += 1;
    const payment = PAYMENTS[paymentIndex % PAYMENTS.length];
    paymentIndex += 1;
    const item = await prisma.inventoryItem.create({
      data: {
        storeId,
        categoryId: category.id,
        imei: imei(serial),
        model: model.model,
        capacity: model.capacity,
        color: model.color,
        condition: "USADO",
        grade: "A",
        batteryHealth: "88%",
        cost: Math.round(input.amount * 0.72),
        price: input.amount,
        status: input.pending ? "DISPONIBLE" : "VENDIDO",
        customFields: { seed: SEED },
        createdAt: new Date(input.soldAt.getTime() - 1000 * 60 * 60 * 24 * 12),
      },
    });
    serial += 1;

    await prisma.sale.create({
      data: {
        storeId,
        clientId: client.id,
        inventoryItemId: item.id,
        dateLabel: dateLabel(input.soldAt),
        amount: input.amount,
        paymentMethod: payment,
        status: input.pending ? "PENDIENTE" : "COMPLETADA",
        soldAt: input.soldAt,
        customFields: { seed: SEED },
      },
    });

    if (!input.pending) {
      const current = spent.get(client.id) ?? { total: 0, last: input.soldAt };
      current.total += input.amount;
      if (input.soldAt > current.last) current.last = input.soldAt;
      spent.set(client.id, current);
    }
  };

  for (const sale of recentSales()) {
    await createSale({ soldAt: atNoon(sale.daysAgo), amount: sale.amount, pending: sale.pending });
  }

  const today = argentinaParts();
  for (let month = 1; month <= 6; month += 1) {
    for (const sale of olderMonthSales(today.year, month, 1)) {
      await createSale(sale);
    }
  }

  for (let month = 4; month <= 12; month += 1) {
    for (const sale of olderMonthSales(today.year - 1, month, 0.72)) {
      await createSale(sale);
    }
  }

  for (const [clientId, totals] of spent) {
    await prisma.client.update({
      where: { id: clientId },
      data: { totalSpent: totals.total, lastPurchaseAt: totals.last },
    });
  }

  let tradeSerial = 1;
  for (const tradeIn of tradeIns()) {
    const received = MODELS[tradeSerial % MODELS.length];
    const given = MODELS[(tradeSerial + 2) % MODELS.length];
    const tradeAt = atNoon(tradeIn.daysAgo);
    await prisma.tradeIn.create({
      data: {
        storeId,
        clientId: clients[tradeSerial % clients.length].id,
        dateLabel: dateLabel(tradeAt),
        deviceReceived: `${received.model} ${received.capacity}`,
        deviceReceivedImei: imei(80_000 + tradeSerial),
        takeValue: Math.round(tradeIn.difference * 1.8),
        deviceGiven: `${given.model} ${given.capacity}`,
        differencePaid: tradeIn.difference,
        status: tradeIn.status,
        batteryHealth: "86%",
        grade: "A",
        tradeAt,
        customFields: { seed: SEED },
      },
    });
    tradeSerial += 1;
  }

  for (let month = 1; month <= 6; month += 1) {
    const statuses = ["APROBADO", "PENDIENTE", "RECHAZADO"];
    for (let index = 0; index < statuses.length; index += 1) {
      const tradeAt = onDay(today.year, month, 6 + index * 7);
      const received = MODELS[(month + index) % MODELS.length];
      const given = MODELS[(month + index + 1) % MODELS.length];
      await prisma.tradeIn.create({
        data: {
          storeId,
          clientId: clients[(month + index) % clients.length].id,
          dateLabel: dateLabel(tradeAt),
          deviceReceived: `${received.model} ${received.capacity}`,
          deviceReceivedImei: imei(90_000 + month * 10 + index),
          takeValue: 400_000 + month * 20_000,
          deviceGiven: `${given.model} ${given.capacity}`,
          differencePaid: 120_000 + index * 40_000 + month * 8_000,
          status: statuses[index],
          batteryHealth: "84%",
          grade: "B",
          tradeAt,
          customFields: { seed: SEED },
        },
      });
    }
  }

  const [sales, items, trades] = await Promise.all([
    prisma.sale.count({ where: { storeId, customFields: { path: ["seed"], equals: SEED } } }),
    prisma.inventoryItem.count({ where: { storeId, customFields: { path: ["seed"], equals: SEED } } }),
    prisma.tradeIn.count({ where: { storeId, customFields: { path: ["seed"], equals: SEED } } }),
  ]);

  console.log(
    JSON.stringify({
      email: user.email,
      store: membership.store.name,
      storeId,
      sales,
      inventory: items,
      tradeIns: trades,
      clients: clients.length,
    })
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
