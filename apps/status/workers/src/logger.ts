import pino from "pino"

import type { StatusWorkerEnv } from "./config/env.js"

export function createLogger(env: StatusWorkerEnv) {
  const pretty =
    env.LOG_PRETTY === "true" ||
    (env.LOG_PRETTY === "auto" && process.env.NODE_ENV !== "production")

  return pino({
    level: env.LOG_LEVEL,
    transport: pretty ?
      {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname",
          translateTime: "SYS:standard",
        },
      }
    : undefined,
  })
}
