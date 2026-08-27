import { z } from "zod"

import { automationJobStatuses } from "../automation/automation.types.js"

const boundedLimitSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    const parsed = Number(value ?? 80)

    if (!Number.isFinite(parsed)) {
      return 80
    }

    return Math.min(Math.max(Math.trunc(parsed), 1), 200)
  })

export const opsLogsQuerySchema = z.object({
  level: z.enum(["all", "info", "warn", "error"]).optional().default("all"),
  limit: boundedLimitSchema,
})

export const opsQueueQuerySchema = z.object({
  status: z
    .enum(["all", ...automationJobStatuses])
    .optional()
    .default("all"),
  limit: boundedLimitSchema,
})

export const opsJobParamsSchema = z.object({
  id: z.uuid(),
})
