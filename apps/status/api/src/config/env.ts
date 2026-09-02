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

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),
    LOG_PRETTY: envLogPretty(),
    STATUS_PORT: z.coerce.number().int().positive().default(4100),
    STATUS_HOST: z.string().default("0.0.0.0"),
    STATUS_DATABASE_URL: z
      .string()
      .min(1)
      .default("postgres://postgres:postgres@localhost:5432/gstfy_status"),
    STATUS_PUBLIC_BASE_URL: z.string().url().default("http://localhost:4100"),
    STATUS_CORS_ORIGINS: z.string().default(""),
    STATUS_ADMIN_TOKEN: z
      .string()
      .min(32)
      .default("dev-status-admin-token-change-me-32chars"),
    STATUS_MONITORING_TOKEN: z
      .string()
      .min(32)
      .default("dev-status-monitor-token-change-me-32chars"),
    STATUS_ENCRYPTION_KEY: z
      .string()
      .min(32)
      .default("dev-status-encryption-key-change-me-32chars"),
    STATUS_BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
    STATUS_BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).optional(),
    STATUS_AUTO_RUN_MIGRATIONS: envBoolean(true),
    STATUS_CREATE_DATABASE_IF_MISSING: envBoolean(true),
    STATUS_PUBLIC_CACHE_SECONDS: z.coerce.number().int().min(0).default(30),
    STATUS_PUBLIC_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
    STATUS_ADMIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
    STATUS_AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
    STATUS_SUBSCRIPTION_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
    STATUS_MONITORING_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(600),
    STATUS_DEFAULT_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(3),
    STATUS_DEFAULT_RECOVERY_THRESHOLD: z.coerce.number().int().positive().default(3),
  })
  .superRefine((env, ctx) => {
    if (
      env.NODE_ENV === "production" &&
      env.STATUS_ADMIN_TOKEN === "dev-status-admin-token-change-me-32chars"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STATUS_ADMIN_TOKEN"],
        message: "STATUS_ADMIN_TOKEN must be changed in production.",
      })
    }

    if (
      env.NODE_ENV === "production" &&
      env.STATUS_MONITORING_TOKEN === "dev-status-monitor-token-change-me-32chars"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STATUS_MONITORING_TOKEN"],
        message: "STATUS_MONITORING_TOKEN must be changed in production.",
      })
    }

    if (
      env.NODE_ENV === "production" &&
      env.STATUS_ENCRYPTION_KEY === "dev-status-encryption-key-change-me-32chars"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STATUS_ENCRYPTION_KEY"],
        message: "STATUS_ENCRYPTION_KEY must be changed in production.",
      })
    }

    if (
      (env.STATUS_BOOTSTRAP_ADMIN_EMAIL && !env.STATUS_BOOTSTRAP_ADMIN_PASSWORD) ||
      (!env.STATUS_BOOTSTRAP_ADMIN_EMAIL && env.STATUS_BOOTSTRAP_ADMIN_PASSWORD)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STATUS_BOOTSTRAP_ADMIN_EMAIL"],
        message:
          "STATUS_BOOTSTRAP_ADMIN_EMAIL and STATUS_BOOTSTRAP_ADMIN_PASSWORD must be configured together.",
      })
    }
  })

export type StatusEnv = z.infer<typeof envSchema>

let cachedEnv: StatusEnv | null = null

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

      if ((quote === "\"" || quote === "'") && !rawValue.endsWith(quote)) {
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
