import { z } from "zod"

import {
  gstFilingMockModes,
  gstFilingReturnTypes,
  gstFilingStatuses,
} from "./gst-filing.domain.js"

const idempotencyKeySchema = z.string().trim().min(8).max(120)
const periodSchema = z.string().trim().regex(/^\d{4}-\d{2}$/)
const reasonSchema = z
  .union([z.string().trim().max(500), z.literal(""), z.null()])
  .optional()
  .transform((value) => value || null)

const paginationQuerySchema = {
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") {
        return 1
      }

      const parsed = Number(value)
      return Number.isFinite(parsed) ? Math.max(Math.floor(parsed), 1) : 1
    }),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") {
        return 15
      }

      const parsed = Number(value)
      return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), 1), 100) : 15
    }),
}

export const gstFilingRunParamsSchema = z.object({
  id: z.uuid(),
})

export const createGstFilingRunSchema = z.object({
  reportingRunId: z.uuid(),
  returnType: z.enum(gstFilingReturnTypes),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const listGstFilingRunsQuerySchema = z.object({
  period: periodSchema.optional(),
  gstRegistrationId: z.uuid().optional(),
  reportingRunId: z.uuid().optional(),
  returnType: z.enum(gstFilingReturnTypes).optional(),
  status: z.enum(gstFilingStatuses).optional(),
  ...paginationQuerySchema,
})

export const filingRunActionSchema = z.object({
  reason: reasonSchema,
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const submitGstFilingRunSchema = z.object({
  mockMode: z.enum(gstFilingMockModes).optional().default("MOCK_ACCEPT"),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export type CreateGstFilingRunInput = z.infer<typeof createGstFilingRunSchema>
export type ListGstFilingRunsQueryInput = z.infer<
  typeof listGstFilingRunsQuerySchema
>
export type FilingRunActionInput = z.infer<typeof filingRunActionSchema>
export type SubmitGstFilingRunInput = z.infer<typeof submitGstFilingRunSchema>
