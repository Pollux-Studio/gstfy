import type { FastifyServerOptions } from "fastify"
import type { LoggerOptions } from "pino"
import pino from "pino"

import type { AppEnv } from "../config/env.js"

const REDACTED_LOG_PATHS = [
  "authorization",
  "cookie",
  "password",
  "oldPassword",
  "newPassword",
  "confirmPassword",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "privateKey",
  "req.headers.authorization",
  "req.headers.cookie",
  "request.headers.authorization",
  "request.headers.cookie",
  "headers.authorization",
  "headers.cookie",
  "*.authorization",
  "*.cookie",
  "*.password",
  "*.oldPassword",
  "*.newPassword",
  "*.confirmPassword",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "*.secret",
  "*.privateKey",
]

export function createLoggerOptions(env: AppEnv): FastifyServerOptions["logger"] {
  const usePrettyLogs = shouldUsePrettyLogs(env)
  const loggerOptions: LoggerOptions = {
    level: env.LOG_LEVEL,
    base: {
      service: "gstfy-backend",
      environment: env.NODE_ENV,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({
        level: label,
      }),
    },
    redact: {
      paths: REDACTED_LOG_PATHS,
      censor: "[redacted]",
    },
    transport: usePrettyLogs
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            errorLikeObjectKeys: ["err", "error"],
            ignore: "pid,hostname",
            levelFirst: true,
            messageFormat: "{msg}",
            singleLine: false,
            translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
          },
        }
      : undefined,
  }

  return loggerOptions
}

function shouldUsePrettyLogs(env: AppEnv) {
  if (env.LOG_PRETTY === "true") {
    return true
  }

  if (env.LOG_PRETTY === "false") {
    return false
  }

  return env.NODE_ENV !== "production"
}
