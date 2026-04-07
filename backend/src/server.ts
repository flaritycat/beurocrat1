import { buildApp } from "./app/build-app";
import { closePool } from "./db/pool";

async function start() {
  const app = await buildApp();

  const closeSignals = ["SIGINT", "SIGTERM"] as const;
  for (const signal of closeSignals) {
    process.on(signal, async () => {
      await app.close();
      await closePool();
      process.exit(0);
    });
  }

  try {
    await app.listen({
      host: "0.0.0.0",
      port: 3000,
    });
  } catch (error) {
    app.log.error(error);
    await closePool();
    process.exit(1);
  }
}

start();
