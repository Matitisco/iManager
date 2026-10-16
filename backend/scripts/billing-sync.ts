import { syncPlans, reconcileSubscriptions } from '../src/modules/billing/service.js';
import { prisma } from '../src/plugins/prisma.js';

try {
  const plans = await syncPlans();
  console.log(`Facturación: ${plans.length} planes sincronizados en ARS.`);
  const stored = await prisma.billingPlan.findMany({ select: { key: true, providerId: true } });
  for (const plan of plans) {
    const id = stored.find(row => row.key === plan.key)?.providerId ?? '-';
    console.log(`Facturación: ${plan.key} ${id} ARS ${plan.amountArs}`);
  }
  const count = await reconcileSubscriptions();
  console.log(`Facturación: ${count} suscripciones verificadas.`);
} catch {
  // Avoid printing provider payloads or credentials even on failure.
  console.error('No se pudo sincronizar facturación. Revisá configuración y conectividad y reintentá.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
