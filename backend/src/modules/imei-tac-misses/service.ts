import { prisma } from '../../plugins/prisma.js';

export async function recordTacMiss(tac: string) {
  await prisma.imeiTacMiss.upsert({
    where: { tac },
    create: { tac },
    update: { count: { increment: 1 }, lastSeenAt: new Date() },
  });
}

export async function listTacMisses(limit: number) {
  const items = await prisma.imeiTacMiss.findMany({
    select: { tac: true, count: true, firstSeenAt: true, lastSeenAt: true },
    orderBy: [{ count: 'desc' }, { tac: 'asc' }],
    take: limit,
  });
  return { items };
}
