import { buildApp } from "./app.js"
import { getEnv } from "./config/env.js"
import { closeDatabase } from "./db/client.js"
import { runPendingMigrations } from "./db/migrations.js"

const env = getEnv()
const app = await buildApp()

app.log.info(
  {
    autoRunMigrations: env.AUTO_RUN_MIGRATIONS,
    nodeEnv: env.NODE_ENV,
  },
  "backend startup configuration loaded"
)

if (env.AUTO_RUN_MIGRATIONS) {
  await runPendingMigrations(app.log)
} else {
  app.log.warn(
    {
      autoRunMigrations: env.AUTO_RUN_MIGRATIONS,
    },
    "automatic migrations disabled"
  )
}

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
