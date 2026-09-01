import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { z } from "zod"

loadLocalEnv()

const envBoolean = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (value === undefined || value === "") {
      return undefined
    }

    if (typeof value === "boolean") {
      return value
    }

    if (typeof value === "string") {
      const normalizedValue = value.trim().toLowerCase()

      if (["true", "1", "yes", "on"].includes(normalizedValue)) {
        return true
      }

      if (["false", "0", "no", "off"].includes(normalizedValue)) {
        return false
      }
    }

    return value
  }, z.boolean().default(defaultValue))

const envLogPretty = () =>
  z.preprocess((value) => {
    if (value === undefined || value === "") {
      return "auto"
    }

    if (typeof value === "string") {
      const normalizedValue = value.trim().toLowerCase()

      if (["true", "1", "yes", "on"].includes(normalizedValue)) {
        return "true"
      }

      if (["false", "0", "no", "off"].includes(normalizedValue)) {
        return "false"
      }

      if (normalizedValue === "auto") {
        return "auto"
      }
    }

    return value
  }, z.enum(["auto", "true", "false"]).default("auto"))

const envOptionalUrl = () =>
  z.preprocess((value) => {
    if (value === undefined || value === "") {
      return undefined
    }

    if (typeof value === "string") {
      const trimmedValue = value.trim()
      return trimmedValue.length > 0 ? trimmedValue : undefined
    }

    return value
  }, z.string().url().optional())

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  LOG_PRETTY: envLogPretty(),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgres://postgres:postgres@localhost:5432/gstfy"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  APP_BASE_DOMAIN: z.string().default("localhost:3000"),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: envBoolean(false),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters")
    .default("dev-only-change-before-production-gstfy-secret"),
  CORE_POSTING_INTERNAL_KEY: z
    .string()
    .min(16, "CORE_POSTING_INTERNAL_KEY must be at least 16 characters")
    .default("dev-core-posting-key"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: envBoolean(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_AUTH_METHOD: z.string().optional(),
  MAIL_FROM: z.string().default("GSTFY <no-reply@gstfy.in>"),
  AUTO_RUN_MIGRATIONS: envBoolean(true),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_ENDPOINT: z
    .string()
    .url()
    .default("test"),
  R2_BUCKET_NAME: z.string().default("gstfy"),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
  R2_FORCE_PATH_STYLE: envBoolean(true),
  REDIS_URL: envOptionalUrl(),
  QUEUE_WORKER_ENABLED: envBoolean(false),
  QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(3),
  QUEUE_JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  QUEUE_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  QUEUE_BACKOFF_BASE_MS: z.coerce.number().int().positive().default(2_000),
  OPS_ADMIN_EMAILS: z.string().default(""),
  EINVOICE_PROVIDER: z.literal("irp5").optional(),
  EINVOICE_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  EINVOICE_LIVE_ENABLED: envBoolean(false),
  IRP5_BASE_URL: envOptionalUrl(),
  IRP5_CLIENT_ID: z.string().optional(),
  IRP5_CLIENT_SECRET: z.string().optional(),
  IRP5_USERNAME: z.string().optional(),
  IRP5_PASSWORD: z.string().optional(),
  IRP5_APP_KEY: z.string().optional(),
  IRP5_PUBLIC_KEY: z.string().optional(),
}).superRefine((env, ctx) => {
  if (
    env.NODE_ENV === "production" &&
    env.JWT_ACCESS_SECRET === "dev-only-change-before-production-gstfy-secret"
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JWT_ACCESS_SECRET"],
      message: "JWT_ACCESS_SECRET must be changed in production.",
    })
  }

  if (
    env.NODE_ENV === "production" &&
    env.CORE_POSTING_INTERNAL_KEY === "dev-core-posting-key"
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["CORE_POSTING_INTERNAL_KEY"],
      message: "CORE_POSTING_INTERNAL_KEY must be changed in production.",
    })
  }

  const hasAnyR2Credential = Boolean(env.R2_ACCESS_KEY_ID || env.R2_SECRET_ACCESS_KEY)

  if (hasAnyR2Credential && (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["R2_ACCESS_KEY_ID"],
      message: "R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required for R2 uploads.",
    })
  }

  if (env.QUEUE_WORKER_ENABLED && !env.REDIS_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["REDIS_URL"],
      message: "REDIS_URL is required when QUEUE_WORKER_ENABLED is true.",
    })
  }

  const irp5Values = [
    env.IRP5_BASE_URL,
    env.IRP5_CLIENT_ID,
    env.IRP5_CLIENT_SECRET,
    env.IRP5_USERNAME,
    env.IRP5_PASSWORD,
    env.IRP5_APP_KEY,
    env.IRP5_PUBLIC_KEY,
  ]
  const hasAnyIrp5Config = irp5Values.some(Boolean)
  const hasCompleteIrp5Config = irp5Values.every(Boolean)

  if (env.EINVOICE_PROVIDER === "irp5" && !hasCompleteIrp5Config) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["IRP5_BASE_URL"],
      message: "Complete IRP5 configuration is required when EINVOICE_PROVIDER is irp5.",
    })
  }

  if (hasAnyIrp5Config && !hasCompleteIrp5Config) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["IRP5_BASE_URL"],
      message: "IRP5 credentials must be configured together.",
    })
  }

  if (
    env.EINVOICE_PROVIDER === "irp5" &&
    env.EINVOICE_ENVIRONMENT === "production" &&
    !env.EINVOICE_LIVE_ENABLED
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["EINVOICE_LIVE_ENABLED"],
      message: "EINVOICE_LIVE_ENABLED must be true for production e-invoice operations.",
    })
  }
})

export type AppEnv = z.infer<typeof envSchema>

let cachedEnv: AppEnv | null = null

export function getEnv() {
  cachedEnv ??= envSchema.parse(process.env)
  return cachedEnv
}

function loadLocalEnv() {
  const candidates = [
    resolve(process.cwd(), ".env"),
    fileURLToPath(new URL("../../.env", import.meta.url)),
  ]
  const loadedPaths = new Set<string>()

  for (const candidate of candidates) {
    if (loadedPaths.has(candidate) || !existsSync(candidate)) {
      continue
    }

    loadedPaths.add(candidate)
    const contents = readFileSync(candidate, "utf8")

    const lines = contents.split(/\r?\n/)

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex] ?? ""
      const trimmedLine = line.trim()

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue
      }

      const separatorIndex = trimmedLine.indexOf("=")

      if (separatorIndex === -1) {
        continue
      }

      const key = trimmedLine.slice(0, separatorIndex).trim()
      let rawValue = trimmedLine.slice(separatorIndex + 1).trim()
      const quote = rawValue[0]

      if (
        (quote === '"' || quote === "'") &&
        !rawValue.endsWith(quote)
      ) {
        const valueLines = [rawValue]

        while (lineIndex + 1 < lines.length) {
          lineIndex += 1
          const nextLine = lines[lineIndex] ?? ""
          valueLines.push(nextLine)

          if (nextLine.trimEnd().endsWith(quote)) {
            break
          }
        }

        rawValue = valueLines.join("\n")
      }

      const value = normalizeEnvValue(rawValue)

      if (!key || value === "" || process.env[key] !== undefined) {
        continue
      }

      process.env[key] = value
    }
  }
}

function normalizeEnvValue(value: string) {
  const trimmedValue = value.trim()
  const quote = trimmedValue[0]

  if (
    (quote === "\"" || quote === "'") &&
    trimmedValue.endsWith(quote) &&
    trimmedValue.length >= 2
  ) {
    return trimmedValue.slice(1, -1)
  }

  return trimmedValue
}
