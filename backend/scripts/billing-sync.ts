import { syncPlans, reconcileSubscriptions } from '../src/modules/billing/service.js';
import { prisma } from '../src/plugins/prisma.js';

try {
  const plans = await syncPlans();
  console.log(`Facturación: ${plans.length} planes sincronizados en ARS.`);
  const count = await reconcileSubscriptions();
  console.log(`Facturación: ${count} suscripciones verificadas.`);
} catch {
  // Avoid printing provider payloads or credentials even on failure.
  console.error('No se pudo sincronizar facturación. Revisá configuración y conectividad y reintentá.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
