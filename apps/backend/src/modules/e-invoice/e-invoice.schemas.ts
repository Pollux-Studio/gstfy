import { z } from "zod"

import {
  eInvoiceMockModes,
  eInvoiceSourceDocumentTypes,
  eInvoiceSubmissionStatuses,
} from "./e-invoice.domain.js"

const idempotencyKeySchema = z.string().trim().min(8).max(120)
const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)
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

export const eInvoiceRecordParamsSchema = z.object({
  id: z.uuid(),
})

export const createEInvoiceRecordSchema = z.object({
  sourceDocumentType: z.enum(eInvoiceSourceDocumentTypes),
  sourceDocumentId: z.uuid(),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const eInvoiceEligibilityQuerySchema = z.object({
  sourceDocumentType: z.enum(eInvoiceSourceDocumentTypes),
  sourceDocumentId: z.uuid(),
})

export const listEInvoiceRecordsQuerySchema = z.object({
  status: z.enum(eInvoiceSubmissionStatuses).optional(),
  sourceDocumentType: z.enum(eInvoiceSourceDocumentTypes).optional(),
  gstRegistrationId: z.uuid().optional(),
  fromDate: dateSchema.optional(),
  toDate: dateSchema.optional(),
  search: z.string().trim().max(120).optional(),
  ...paginationQuerySchema,
})

export const eInvoiceActionSchema = z.object({
  reason: reasonSchema,
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const generateEInvoiceSchema = z.object({
  mockMode: z.enum(eInvoiceMockModes).optional().default("MOCK_GENERATE"),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const cancelEInvoiceSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  mockMode: z.enum(eInvoiceMockModes).optional().default("MOCK_GENERATE"),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export type CreateEInvoiceRecordInput = z.infer<typeof createEInvoiceRecordSchema>
export type ListEInvoiceRecordsQueryInput = z.infer<
  typeof listEInvoiceRecordsQuerySchema
>
export type EInvoiceActionInput = z.infer<typeof eInvoiceActionSchema>
export type GenerateEInvoiceInput = z.infer<typeof generateEInvoiceSchema>
export type CancelEInvoiceInput = z.infer<typeof cancelEInvoiceSchema>
