import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { startDailyReprice } from "./modules/billing/reprice-schedule.js";

const app = buildApp();

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
    startDailyReprice(log);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
