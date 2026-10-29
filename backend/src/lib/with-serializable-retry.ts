import { Prisma } from "@prisma/client";
import { prisma } from "../plugins/prisma.js";
import { DomainError } from "./domain-error.js";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
const RETRYABLE = new Set(["P2034", "40001", "40P01"]);

export async function withSerializableRetry<T>(work: (tx: TransactionClient) => Promise<T>, attempts = 5, timeout = 20_000): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout });
    } catch (error) {
      const failure = error as { code?: string; meta?: { code?: string } };
      const code = failure?.code === "P2010" ? failure.meta?.code : failure?.code;
      if (!RETRYABLE.has(code ?? "")) throw error;
      if (attempt + 1 >= attempts) {
        throw new DomainError("La operación coincidió con otro cambio. Volvé a intentarlo.", 409, { code, attempts: attempt + 1 });
      }
      await new Promise((resolve) => setTimeout(resolve, 40 * 2 ** attempt));
    }
  }
}
