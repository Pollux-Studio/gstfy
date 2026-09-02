import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { z } from "zod"

loadLocalEnv()

const envBoolean = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string(), z.undefined()])
    .transform((value) => {
      if (value === undefined) {
        return defaultValue
      }

      if (typeof value === "boolean") {
        return value
      }

      return ["1", "true", "yes", "on"].includes(value.toLowerCase())
    })

const envSchema = z.object({
  STATUS_API_BASE_URL: z.string().url().default("http://localhost:4100"),
  STATUS_MONITORING_TOKEN: z.string().min(32),
  STATUS_WORKER_KIND: z
    .enum(["monitoring", "notifications"])
    .default("monitoring"),
  STATUS_WORKER_ID: z.string().min(2).default(`status-worker-${process.pid}`),
  STATUS_WORKER_REGION: z.string().min(2).default("india"),
  STATUS_WORKER_VERSION: z.string().min(1).default("dev"),
  STATUS_WORKER_POLL_SECONDS: z.coerce.number().int().positive().default(30),
  STATUS_NOTIFICATION_POLL_SECONDS: z.coerce.number().int().positive().default(15),
  SMTP_HOST: z.string().trim().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: envBoolean(false),
  SMTP_USER: z.string().trim().min(1).optional(),
  SMTP_PASSWORD: z.string().trim().min(1).optional(),
  SMTP_FROM: z.string().trim().min(1).default("GSTfy Status <status@gstfy.in>"),
  LOG_LEVEL: z.string().default("info"),
  LOG_PRETTY: z.enum(["true", "false", "auto"]).default("auto"),
})

export type StatusWorkerEnv = z.infer<typeof envSchema>

let cachedEnv: StatusWorkerEnv | null = null

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

    for (const line of lines) {
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

      if (!key || process.env[key] !== undefined) {
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
