import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { startDailyReprice } from "./modules/billing/reprice-schedule.js";
import { prisma } from "./plugins/prisma.js";

const app = buildApp();
let stopDailyReprice = () => {};
app.addHook('onClose', async () => { stopDailyReprice(); });

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  try {
    await app.close();
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });

async function start() {
  try {
    await app.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });

    app.log.info(`API running on port ${env.PORT}`);
    const log = {
      info: (message: string) => app.log.info(message),
      warn: (message: string) => app.log.warn(message),
    };
    stopDailyReprice = startDailyReprice(log);
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
    await shutdown();
  }
}

start();
