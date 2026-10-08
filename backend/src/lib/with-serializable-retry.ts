import { Prisma } from "@prisma/client";
import { prisma } from "../plugins/prisma.js";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
const RETRYABLE = new Set(["P2034", "40001", "40P01"]);

export async function withSerializableRetry<T>(work: (tx: TransactionClient) => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 20_000 });
    } catch (error) {
      if (!RETRYABLE.has((error as { code?: string })?.code ?? "") || attempt + 1 >= attempts) throw error;
    }
  }
}
