import { buildApp } from "./app.js"
import { getEnv } from "./config/env.js"
import { closeDatabase } from "./db/client.js"
import { runPendingMigrations } from "./db/migrations.js"

const env = getEnv()

if (env.AUTO_RUN_MIGRATIONS) {
  await runPendingMigrations()
}

const app = await buildApp()

const shutdown = async () => {
  await app.close()
  await closeDatabase()
}

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0))
})

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0))
})

await app.listen({
  host: env.HOST,
  port: env.PORT,
})
