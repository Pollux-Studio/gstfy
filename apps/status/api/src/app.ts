import cors from "@fastify/cors"
import fastify from "fastify"

import { getEnv } from "./config/env.js"
import { sql } from "./db/client.js"
import {
  registerStatusApiRoutes,
  registerStatusFeedRoutes,
} from "./modules/status/status.routes.js"
import { registerErrorHandler } from "./utils/error-handler.js"
import { StatusHttpError } from "./utils/http-error.js"
import { createLoggerOptions } from "./utils/logger.js"

type RateLimitBucket = {
  resetAt: number
  count: number
}

const rateLimitBuckets = new Map<string, RateLimitBucket>()

export async function buildStatusApp() {
  const env = getEnv()
  const requestStartTimes = new WeakMap<object, number>()
  const app = fastify({
    disableRequestLogging: true,
    logger: createLoggerOptions(env),
  })

  app.addHook("onRequest", async (request) => {
    enforceRateLimit(request.ip, request.method, request.url, env)
    requestStartTimes.set(request, Date.now())
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers["user-agent"] ?? null,
      },
      "status request received"
    )
  })

  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: Date.now() - (requestStartTimes.get(request) ?? Date.now()),
      },
      "status request completed"
    )
  })

  await app.register(cors, {
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin, env.STATUS_CORS_ORIGINS))
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Status-Admin-Token",
      "X-Status-Admin-User",
      "X-Status-Monitoring-Token",
      "X-Request-ID",
    ],
  })

  registerErrorHandler(app)

  app.get("/health", async () => ({
    status: "ok",
    service: "gstfy-status-api",
    timestamp: new Date().toISOString(),
  }))

  app.get("/health/ready", async () => {
    await sql`select 1`

    return {
      status: "ok",
      database: "reachable",
      timestamp: new Date().toISOString(),
    }
  })

  await app.register(registerStatusApiRoutes, {
    prefix: "/api/v1",
  })
  await registerStatusFeedRoutes(app)

  return app
}

function isAllowedOrigin(origin: string | undefined, configuredOrigins: string) {
  if (!origin) {
    return true
  }

  const allowedOrigins = configuredOrigins
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  if (allowedOrigins.length === 0) {
    return true
  }

  return allowedOrigins.includes(origin)
}

function enforceRateLimit(
  ipAddress: string,
  method: string,
  url: string,
  env: ReturnType<typeof getEnv>
) {
  const limit = getRateLimitForRoute(method, url, env)
  const now = Date.now()
  const key = `${ipAddress}:${method}:${getRateLimitBucketName(url)}`
  const current = rateLimitBuckets.get(key)

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + 60_000,
    })
    cleanupExpiredRateLimitBuckets(now)
    return
  }

  current.count += 1

  if (current.count > limit) {
    throw new StatusHttpError(
      429,
      "RATE_LIMITED",
      "Too many requests. Please wait a minute and try again."
    )
  }
}

function getRateLimitForRoute(
  method: string,
  url: string,
  env: ReturnType<typeof getEnv>
) {
  if (method === "OPTIONS") {
    return 1_000
  }

  if (url.startsWith("/api/v1/admin/auth/login")) {
    return env.STATUS_AUTH_RATE_LIMIT_PER_MINUTE
  }

  if (url.startsWith("/api/v1/subscriptions")) {
    return env.STATUS_SUBSCRIPTION_RATE_LIMIT_PER_MINUTE
  }

  if (url.startsWith("/api/v1/admin")) {
    return env.STATUS_ADMIN_RATE_LIMIT_PER_MINUTE
  }

  if (url.startsWith("/api/v1/monitoring") || url.startsWith("/api/v1/worker")) {
    return env.STATUS_MONITORING_RATE_LIMIT_PER_MINUTE
  }

  return env.STATUS_PUBLIC_RATE_LIMIT_PER_MINUTE
}

function getRateLimitBucketName(url: string) {
  const [path = "/"] = url.split("?")

  if (path.startsWith("/api/v1/admin/auth/login")) {
    return "admin-auth"
  }

  if (path.startsWith("/api/v1/subscriptions")) {
    return "subscriptions"
  }

  if (path.startsWith("/api/v1/admin")) {
    return "admin"
  }

  if (path.startsWith("/api/v1/monitoring") || path.startsWith("/api/v1/worker")) {
    return "workers"
  }

  return "public"
}

function cleanupExpiredRateLimitBuckets(now: number) {
  if (rateLimitBuckets.size < 1_000) {
    return
  }

  for (const [key, value] of rateLimitBuckets.entries()) {
    if (value.resetAt <= now) {
      rateLimitBuckets.delete(key)
    }
  }
}
