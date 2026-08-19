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

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
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
    .default("https://62f0623e68314aa04e47174412fdf9e2.r2.cloudflarestorage.com"),
  R2_BUCKET_NAME: z.string().default("gstfy"),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
  R2_FORCE_PATH_STYLE: envBoolean(true),
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

    for (const line of contents.split(/\r?\n/)) {
      const trimmedLine = line.trim()

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue
      }

      const separatorIndex = trimmedLine.indexOf("=")

      if (separatorIndex === -1) {
        continue
      }

      const key = trimmedLine.slice(0, separatorIndex).trim()
      const value = normalizeEnvValue(trimmedLine.slice(separatorIndex + 1))

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
