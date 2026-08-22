import { z } from "zod"

export const reconciliationStatuses = [
  "NOT_MATCHED",
  "MATCHED",
  "PARTIAL_MATCH",
  "VALUE_MISMATCH",
  "TAX_MISMATCH",
  "DATE_MISMATCH",
  "DUPLICATE",
  "BOOKS_ONLY",
  "EXTERNAL_ONLY",
  "MANUAL_REVIEW",
] as const

export const matchStatuses = [
  "MATCHED",
  "PARTIAL_MATCH",
  "VALUE_MISMATCH",
  "TAX_MISMATCH",
  "DATE_MISMATCH",
  "DUPLICATE",
  "MANUAL_REVIEW",
] as const

export const matchConfidences = [
  "EXACT",
  "STRONG",
  "PARTIAL",
  "WEAK",
  "NO_MATCH",
] as const

export const itcStatuses = [
  "NOT_REVIEWED",
  "ELIGIBLE",
  "PARTIALLY_ELIGIBLE",
  "DEFERRED",
  "INELIGIBLE",
  "CLAIMED",
  "REVERSED",
  "REJECTED",
] as const

export const exceptionStatuses = ["OPEN", "IN_REVIEW", "RESOLVED", "IGNORED"] as const
export const exceptionSeverities = ["HIGH", "MEDIUM", "LOW"] as const
export const externalGstSources = ["gstr_2b", "gstr_2a", "manual", "other"] as const

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)
const periodSchema = z.string().trim().regex(/^\d{4}-\d{2}$/)
const optionalTextSchema = z
  .union([z.string().trim().max(500), z.literal(""), z.null()])
  .optional()
  .transform((value) => value || null)
const idempotencyKeySchema = z.string().trim().min(8).max(120)
const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^-?\d+(\.\d{1,2})?$/))

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

export const gstReconciliationIdParamsSchema = z.object({
  id: z.uuid(),
})

export const externalGstImportParamsSchema = z.object({
  id: z.uuid(),
})

export const importExternalGstRecordSchema = z.object({
  supplierGstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/),
  supplierName: optionalTextSchema,
  documentNumber: z.string().trim().min(1).max(80),
  documentDate: dateSchema,
  taxableValue: moneySchema.default("0"),
  cgst: moneySchema.default("0"),
  sgst: moneySchema.default("0"),
  igst: moneySchema.default("0"),
  cess: moneySchema.default("0"),
  rawReference: z.record(z.string(), z.unknown()).optional().default({}),
})

export const importExternalGstSchema = z.object({
  source: z.enum(externalGstSources).default("gstr_2b"),
  period: periodSchema,
  gstRegistrationId: z.uuid().optional(),
  fileName: z.string().trim().min(1).max(180),
  records: z.array(importExternalGstRecordSchema).min(1).max(5000),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const listGstReconciliationQuerySchema = z.object({
  period: periodSchema.optional(),
  search: z.string().trim().max(120).optional(),
  supplierId: z.uuid().optional(),
  matchStatus: z.enum(reconciliationStatuses).optional(),
  itcStatus: z.enum(itcStatuses).optional(),
  severity: z.enum(exceptionSeverities).optional(),
  branchId: z.uuid().optional(),
  gstRegistrationId: z.uuid().optional(),
  sortBy: z
    .enum(["invoiceDate", "supplier", "invoiceNumber", "bookTax", "difference", "status"])
    .optional()
    .default("invoiceDate"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
  ...paginationQuerySchema,
})

export const listExternalGstImportsQuerySchema = z.object({
  period: periodSchema.optional(),
  source: z.enum(externalGstSources).optional(),
  gstRegistrationId: z.uuid().optional(),
  ...paginationQuerySchema,
})

export const listGstExceptionsQuerySchema = z.object({
  status: z.enum(exceptionStatuses).optional(),
  severity: z.enum(exceptionSeverities).optional(),
  period: periodSchema.optional(),
  ...paginationQuerySchema,
})

export const manualMatchSchema = z.object({
  externalGstRecordId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const unmatchSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const resolveExceptionSchema = z.object({
  exceptionId: z.uuid().optional(),
  status: z.enum(["RESOLVED", "IGNORED", "IN_REVIEW"]),
  resolution: z.string().trim().min(3).max(500),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const itcDecisionSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const itcPartialEligibilitySchema = itcDecisionSchema.extend({
  eligibleCgst: moneySchema.optional(),
  eligibleSgst: moneySchema.optional(),
  eligibleIgst: moneySchema.optional(),
  eligibleCess: moneySchema.optional(),
})

export const itcClaimSchema = z.object({
  claimPeriod: periodSchema,
  reason: optionalTextSchema,
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const itcReverseSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export type ImportExternalGstInput = z.infer<typeof importExternalGstSchema>
export type ImportExternalGstRecordInput = z.infer<typeof importExternalGstRecordSchema>
export type ListGstReconciliationQueryInput = z.infer<
  typeof listGstReconciliationQuerySchema
>
export type ListExternalGstImportsQueryInput = z.infer<
  typeof listExternalGstImportsQuerySchema
>
export type ListGstExceptionsQueryInput = z.infer<typeof listGstExceptionsQuerySchema>
export type ManualMatchInput = z.infer<typeof manualMatchSchema>
export type UnmatchInput = z.infer<typeof unmatchSchema>
export type ResolveExceptionInput = z.infer<typeof resolveExceptionSchema>
export type ItcDecisionInput = z.infer<typeof itcDecisionSchema>
export type ItcPartialEligibilityInput = z.infer<typeof itcPartialEligibilitySchema>
export type ItcClaimInput = z.infer<typeof itcClaimSchema>
export type ItcReverseInput = z.infer<typeof itcReverseSchema>
