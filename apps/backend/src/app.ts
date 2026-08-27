import cookie from "@fastify/cookie"
import cors from "@fastify/cors"
import multipart from "@fastify/multipart"
import fastify from "fastify"

import { getEnv } from "./config/env.js"
import { sql } from "./db/client.js"
import { getMigrationStatus } from "./db/migrations.js"
import { registerAccountRoutes } from "./modules/account/account.routes.js"
import { registerAccountingRoutes } from "./modules/accounting/accounting.routes.js"
import { registerAdjustmentRoutes } from "./modules/adjustments/adjustments.routes.js"
import { registerAvatarRoutes } from "./modules/avatar/avatar.routes.js"
import { registerAuthRoutes } from "./modules/auth/auth.routes.js"
import { registerAutomationRoutes } from "./modules/automation/automation.routes.js"
import { registerCaRoutes } from "./modules/ca/ca.routes.js"
import { registerCoreRoutes } from "./modules/core/core.routes.js"
import { registerDashboardRoutes } from "./modules/dashboard/dashboard.routes.js"
import { registerEInvoiceRoutes } from "./modules/e-invoice/e-invoice.routes.js"
import { registerFeedbackRoutes } from "./modules/feedback/feedback.routes.js"
import { registerInventoryRoutes } from "./modules/inventory/inventory.routes.js"
import { registerGstFilingRoutes } from "./modules/gst-filing/gst-filing.routes.js"
import { registerGstReconciliationRoutes } from "./modules/gst-reconciliation/gst-reconciliation.routes.js"
import { registerGstReportingRoutes } from "./modules/gst-reporting/gst-reporting.routes.js"
import { registerOrganizationRoutes } from "./modules/organization/organization.routes.js"
import { recordOpsLog } from "./modules/ops/ops-log-store.js"
import { registerOpsRoutes } from "./modules/ops/ops.routes.js"
import { registerPartiesRoutes } from "./modules/parties/parties.routes.js"
import { registerPaymentReceiptRoutes } from "./modules/payment-receipt/payment-receipt.routes.js"
import { registerPaymentTermsRoutes } from "./modules/payment-terms/payment-terms.routes.js"
import { registerPosRoutes } from "./modules/pos/pos.routes.js"
import { registerProductsRoutes } from "./modules/products/products.routes.js"
import { registerPurchasesRoutes } from "./modules/purchases/purchases.routes.js"
import { registerSalesRoutes } from "./modules/sales/sales.routes.js"
import { registerSettingsRoutes } from "./modules/settings/settings.routes.js"
import { registerTaxRoutes } from "./modules/tax/tax.routes.js"
import { registerUsersRoutes } from "./modules/users/users.routes.js"
import { registerErrorHandler } from "./utils/error-handler.js"
import { r2MultipartMaxBytes } from "./utils/r2-storage.js"
import { isHttpError } from "./utils/http-error.js"
import { createLoggerOptions } from "./utils/logger.js"

export async function buildApp() {
  const env = getEnv()
  const requestStartTimes = new WeakMap<object, number>()
  const app = fastify({
    disableRequestLogging: true,
    logger: createLoggerOptions(env),
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
    const statusCode = reply.statusCode
    const durationMs = Date.now() - startedAt

    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode,
        durationMs,
      },
      "request completed"
    )

    if (shouldRecordOpsLog(request.url)) {
      const opsLogUrl = getOpsLogUrl(request.url)

      recordOpsLog({
        level:
          statusCode >= 500 ? "error"
          : statusCode >= 400 ? "warn"
          : "info",
        message: "request completed",
        requestId: request.id,
        method: request.method,
        url: opsLogUrl,
        statusCode,
        durationMs,
      })
    }
  })

  app.addHook("onError", async (request, reply, error) => {
    const startedAt = requestStartTimes.get(request) ?? Date.now()
    const statusCode = getErrorStatusCode(error, reply.statusCode)
    const logPayload = {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode,
      durationMs: Date.now() - startedAt,
      err: error,
    }

    if (isHttpError(error) || (statusCode >= 400 && statusCode < 500)) {
      request.log.warn(logPayload, "request rejected")

      if (shouldRecordOpsLog(request.url)) {
        const opsLogUrl = getOpsLogUrl(request.url)

        recordOpsLog({
          level: "warn",
          message: error.message || "request rejected",
          requestId: request.id,
          method: request.method,
          url: opsLogUrl,
          statusCode,
          durationMs: Date.now() - startedAt,
        })
      }

      return
    }

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

    if (shouldRecordOpsLog(request.url)) {
      const opsLogUrl = getOpsLogUrl(request.url)

      recordOpsLog({
        level: "error",
        message: error.message || "request failed",
        requestId: request.id,
        method: request.method,
        url: opsLogUrl,
        statusCode,
        durationMs: Date.now() - startedAt,
      })
    }
  })

  await app.register(cors, {
    origin: (origin, callback) => {
      callback(null, isAllowedWebOrigin(origin, env))
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "Idempotency-Key",
      "X-GSTFY-Tenant",
      "X-GSTFY-Account-Type",
    ],
  })
  await app.register(cookie)
  await app.register(multipart, {
    limits: {
      fileSize: r2MultipartMaxBytes,
      files: 1,
    },
  })
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

  await app.register(registerBackendRoutes, {
    prefix: "/api/v1",
  })

  return app
}

function getErrorStatusCode(error: unknown, fallbackStatusCode: number) {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode
  }

  return fallbackStatusCode
}

function isAllowedWebOrigin(origin: string | undefined, env: ReturnType<typeof getEnv>) {
  if (!origin) {
    return true
  }

  if (origin === env.WEB_ORIGIN) {
    return true
  }

  const baseHost = normalizeHost(env.APP_BASE_DOMAIN)
  const originHost = normalizeHost(origin)

  if (!baseHost || !originHost) {
    return false
  }

  if (baseHost === "localhost") {
    return originHost === "localhost" || originHost.endsWith(".localhost")
  }

  return originHost === baseHost || originHost.endsWith(`.${baseHost}`)
}

function normalizeHost(value: string) {
  let hostValue = value

  if (value.includes("://")) {
    try {
      hostValue = new URL(value).host
    } catch {
      return ""
    }
  }

  return hostValue
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
}

function shouldRecordOpsLog(url: string) {
  return !url.startsWith("/health") && !url.startsWith("/api/v1/ops")
}

function getOpsLogUrl(url: string) {
  return url.split("?")[0] || url
}

async function registerBackendRoutes(app: Parameters<typeof registerAuthRoutes>[0]) {
  await registerAvatarRoutes(app)
  await registerAuthRoutes(app)
  await registerOpsRoutes(app)
  await registerAutomationRoutes(app)
  await registerFeedbackRoutes(app)
  await registerCaRoutes(app)
  await registerAccountRoutes(app)
  await registerSettingsRoutes(app)
  await registerOrganizationRoutes(app)
  await registerUsersRoutes(app)
  await registerCoreRoutes(app)
  await registerDashboardRoutes(app)
  await registerAccountingRoutes(app)
  await registerPaymentTermsRoutes(app)
  await registerPaymentReceiptRoutes(app)
  await registerAdjustmentRoutes(app)
  await registerPartiesRoutes(app)
  await registerProductsRoutes(app)
  await registerInventoryRoutes(app)
  await registerEInvoiceRoutes(app)
  await registerGstFilingRoutes(app)
  await registerGstReconciliationRoutes(app)
  await registerGstReportingRoutes(app)
  await registerTaxRoutes(app)
  await registerSalesRoutes(app)
  await registerPurchasesRoutes(app)
  await registerPosRoutes(app)
}
