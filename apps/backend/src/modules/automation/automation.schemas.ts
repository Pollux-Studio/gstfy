import { z } from "zod"

import { automationJobStatuses } from "./automation.types.js"

export const automationSettingsPayloadSchema = z.object({
  autoStockAccountingEnabled: z.boolean().optional(),
  autoEInvoiceEnabled: z.boolean().optional(),
  bankAutoMatchHighConfidenceEnabled: z.boolean().optional(),
  notifyAutomationFailures: z.boolean().optional(),
})

export const listAutomationJobsQuerySchema = z.object({
  status: z.enum(["all", ...automationJobStatuses]).default("all"),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") {
        return 25
      }

      const parsed = Number(value)
      return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), 1), 100) : 25
    }),
})

export const automationJobParamsSchema = z.object({
  id: z.uuid(),
})

export type AutomationSettingsPayload = z.infer<
  typeof automationSettingsPayloadSchema
>
export type ListAutomationJobsQuery = z.infer<typeof listAutomationJobsQuerySchema>
