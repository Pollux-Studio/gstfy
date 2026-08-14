import cookie from "@fastify/cookie"
import cors from "@fastify/cors"
import fastify from "fastify"

import { getEnv } from "./config/env.js"
import { sql } from "./db/client.js"
import { getMigrationStatus } from "./db/migrations.js"
import { registerAccountRoutes } from "./modules/account/account.routes.js"
import { registerAvatarRoutes } from "./modules/avatar/avatar.routes.js"
import { registerAuthRoutes } from "./modules/auth/auth.routes.js"
import { registerCaRoutes } from "./modules/ca/ca.routes.js"
import { registerSettingsRoutes } from "./modules/settings/settings.routes.js"
import { registerUsersRoutes } from "./modules/users/users.routes.js"
import { registerErrorHandler } from "./utils/error-handler.js"

export async function buildApp() {
  const env = getEnv()
  const requestStartTimes = new WeakMap<object, number>()
  const app = fastify({
    disableRequestLogging: true,
    logger: {
      level: env.LOG_LEVEL,
    },
  })

  app.addHook("onRequest", async (request) => {
    requestStartTimes.set(request, Date.now())
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers["user-agent"] ?? null,
      },
      "request received"
    )
  })

  app.addHook("onResponse", async (request, reply) => {
    const startedAt = requestStartTimes.get(request) ?? Date.now()
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: Date.now() - startedAt,
      },
      "request completed"
    )
  })

  app.addHook("onError", async (request, reply, error) => {
    const startedAt = requestStartTimes.get(request) ?? Date.now()
    request.log.error(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: Date.now() - startedAt,
        err: error,
      },
      "request failed"
    )
  })

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  })
  await app.register(cookie)
  registerErrorHandler(app)

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

  app.get("/health/migrations", async () => getMigrationStatus())

  await registerBackendRoutes(app)
  await app.register(registerBackendRoutes, {
    prefix: "/api",
  })

  return app
}

async function registerBackendRoutes(app: Parameters<typeof registerAuthRoutes>[0]) {
  await registerAvatarRoutes(app)
  await registerAuthRoutes(app)
  await registerCaRoutes(app)
  await registerAccountRoutes(app)
  await registerSettingsRoutes(app)
  await registerUsersRoutes(app)
}
