import { buildStatusApp } from "./app.js"
import { getEnv } from "./config/env.js"
import { closeStatusDatabase } from "./db/client.js"
import { runPendingStatusMigrations } from "./db/migrations.js"
import { ensureBootstrapAdmin } from "./modules/status/status.repository.js"

const env = getEnv()
const app = await buildStatusApp()

app.log.info(
  {
    autoRunMigrations: env.STATUS_AUTO_RUN_MIGRATIONS,
    nodeEnv: env.NODE_ENV,
  },
  "status api startup configuration loaded"
)

if (env.STATUS_AUTO_RUN_MIGRATIONS) {
  await runPendingStatusMigrations(app.log)
} else {
  app.log.warn(
    {
      autoRunMigrations: env.STATUS_AUTO_RUN_MIGRATIONS,
    },
    "automatic status migrations disabled"
  )
}

const bootstrapAdmin = await ensureBootstrapAdmin()
if (bootstrapAdmin.configured) {
  app.log.info(
    {
      created: bootstrapAdmin.created,
    },
    "status bootstrap admin checked"
  )
}

const shutdown = async () => {
  await app.close()
  await closeStatusDatabase()
}

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0))
})

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0))
})

await app.listen({
  host: env.STATUS_HOST,
  port: env.STATUS_PORT,
})
