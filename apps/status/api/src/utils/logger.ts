import type { FastifyServerOptions } from "fastify"
import type { LoggerOptions } from "pino"
import pino from "pino"

import type { StatusEnv } from "../config/env.js"

const redactedLogPaths = [
  "authorization",
  "cookie",
  "token",
  "adminToken",
  "monitoringToken",
  "secret",
  "verificationToken",
  "webhookSigningSecret",
  "req.headers.authorization",
  "req.headers.cookie",
  "request.headers.authorization",
  "request.headers.cookie",
  "headers.authorization",
  "headers.cookie",
  "*.authorization",
  "*.cookie",
  "*.token",
  "*.secret",
]

export function createLoggerOptions(env: StatusEnv): FastifyServerOptions["logger"] {
  const loggerOptions: LoggerOptions = {
    level: env.LOG_LEVEL,
    base: {
      service: "gstfy-status-api",
      environment: env.NODE_ENV,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({
        level: label,
      }),
    },
    redact: {
      paths: redactedLogPaths,
      censor: "[redacted]",
    },
    transport:
      shouldUsePrettyLogs(env) ?
        {
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

function shouldUsePrettyLogs(env: StatusEnv) {
  if (env.LOG_PRETTY === "true") {
    return true
  }

  if (env.LOG_PRETTY === "false") {
    return false
  }

  return env.NODE_ENV !== "production"
}
