import { prisma } from "../src/plugins/prisma.js";
import { firestore } from "../src/plugins/firebase-admin.js";

type FirestoreClientDoc = {
  authorUid?: unknown;
  dni?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  lastPurchaseDate?: unknown;
  totalSpent?: unknown;
  pendingBalance?: unknown;
};

type MigrationResult = {
  scanned: number;
  migrated: number;
  created: number;
  updated: number;
  skipped: number;
};

const monthMap: Record<string, number> = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11,
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNullableString(value: unknown): string | null {
  const trimmed = asString(value);
  if (!trimmed) return null;
  return trimmed === "N/A" ? null : trimmed;
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseLastPurchaseAt(value: unknown): Date | null {
  if (value == null) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    const maybeDate = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(maybeDate.getTime()) ? null : maybeDate;
  }

  const stringValue = asNullableString(value);
  if (!stringValue) return null;

  const directParse = new Date(stringValue);
  if (!Number.isNaN(directParse.getTime())) {
    return directParse;
  }

  const normalized = stringValue.toLowerCase().replace(/\./g, "");
  const match = normalized.match(/^(\d{1,2})\s+([a-z]{3})\s+(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = monthMap[match[2]];
  const year = Number(match[3]);

  if (month === undefined || !Number.isFinite(day) || !Number.isFinite(year)) {
    return null;
  }

  const parsed = new Date(year, month, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function resolveStoreId(authorUid: string) {
  const user = await prisma.user.findUnique({
    where: { firebaseUid: authorUid },
    select: { id: true },
  });

  if (!user) {
    return null;
  }

  const membership = await prisma.storeMember.findFirst({
    where: {
      userId: user.id,
      isDefault: true,
    },
    select: { storeId: true },
  });

  return membership?.storeId ?? null;
}

async function migrateClients() {
  const snapshot = await firestore.collection("clients").get();
  const result: MigrationResult = {
    scanned: snapshot.size,
    migrated: 0,
    created: 0,
    updated: 0,
    skipped: 0,
  };

  const skippedReasons: string[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() as FirestoreClientDoc;
    const authorUid = asString(data.authorUid);
    const dni = asString(data.dni);
    const name = asString(data.name);

    if (!authorUid) {
      result.skipped += 1;
      skippedReasons.push(`[${doc.id}] missing authorUid`);
      continue;
    }

    const storeId = await resolveStoreId(authorUid);
    if (!storeId) {
      result.skipped += 1;
      skippedReasons.push(`[${doc.id}] no store membership for authorUid=${authorUid}`);
      continue;
    }

    if (!dni) {
      result.skipped += 1;
      skippedReasons.push(`[${doc.id}] missing dni`);
      continue;
    }

    const normalizedName = name ?? `Cliente ${dni}`;
    const email = asNullableString(data.email);
    const phone = asNullableString(data.phone);
    const lastPurchaseAt = parseLastPurchaseAt(data.lastPurchaseDate);
    const totalSpent = asNumber(data.totalSpent);
    const pendingBalance = asNumber(data.pendingBalance);

    const existing = await prisma.client.findUnique({
      where: {
        storeId_dni: {
          storeId,
          dni,
        },
      },
      select: { id: true },
    });

    await prisma.client.upsert({
      where: {
        storeId_dni: {
          storeId,
          dni,
        },
      },
      create: {
        storeId,
        dni,
        name: normalizedName,
        email,
        phone,
        lastPurchaseAt,
        totalSpent,
        pendingBalance,
      },
      update: {
        name: normalizedName,
        email,
        phone,
        lastPurchaseAt,
        totalSpent,
        pendingBalance,
      },
    });

    result.migrated += 1;
    if (existing) {
      result.updated += 1;
    } else {
      result.created += 1;
    }
  }

  return { result, skippedReasons };
}

async function main() {
  try {
    const { result, skippedReasons } = await migrateClients();

    console.log("Clients migration finished");
    console.log(JSON.stringify(result, null, 2));

    if (skippedReasons.length > 0) {
      console.log("Skipped records:");
      for (const reason of skippedReasons) {
        console.log(`- ${reason}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error("Clients migration failed:", error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
