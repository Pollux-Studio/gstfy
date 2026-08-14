import cookie from "@fastify/cookie"
import cors from "@fastify/cors"
import fastify from "fastify"

import { getEnv } from "./config/env.js"
import { sql } from "./db/client.js"
import { registerAccountRoutes } from "./modules/account/account.routes.js"
import { registerAuthRoutes } from "./modules/auth/auth.routes.js"
import { registerSettingsRoutes } from "./modules/settings/settings.routes.js"
import { registerUsersRoutes } from "./modules/users/users.routes.js"

export async function buildApp() {
  const env = getEnv()
  const app = fastify({
    logger: true,
  })

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  })
  await app.register(cookie)

  app.get("/health", async () => ({
    status: "ok",
    service: "gstfy-backend",
    timestamp: new Date().toISOString(),
  }))

  app.get("/health/db", async () => {
    await sql`select 1`
    return {
      status: "ok",
      database: "reachable",
      timestamp: new Date().toISOString(),
    }
  })

  await registerBackendRoutes(app)
  await app.register(registerBackendRoutes, {
    prefix: "/api",
  })

  return app
}

async function registerBackendRoutes(app: Parameters<typeof registerAuthRoutes>[0]) {
  await registerAuthRoutes(app)
  await registerAccountRoutes(app)
  await registerSettingsRoutes(app)
  await registerUsersRoutes(app)
}
