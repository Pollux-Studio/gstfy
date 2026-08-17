import { z } from "zod"

export const moneyDocumentStatuses = ["draft", "posted", "reversed"] as const
export const paymentMethods = ["cash", "bank", "upi", "card", "cheque", "other"] as const
export const unallocatedTreatments = ["advance", "unallocated"] as const

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)
const nullableUuidSchema = z.uuid().optional().nullable()
const optionalTextSchema = z
  .union([z.string().trim().max(500), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value === undefined ? undefined : value || null))
const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/))
const positiveMoneySchema = moneySchema.refine(
  (value) => Number(value) > 0,
  "Amount must be greater than zero."
)
const idempotencyKeySchema = z.string().trim().min(8).max(120)

export const listMoneyDocumentsQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  status: z.enum(["all", ...moneyDocumentStatuses]).default("all"),
  paymentMethod: z.enum(["all", ...paymentMethods]).default("all"),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
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
})

export const listReceivablePayableQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  status: z.enum(["all", "open", "partially_settled", "settled", "closed", "cancelled"]).default("all"),
  partyId: nullableUuidSchema,
  from: dateSchema.optional(),
  to: dateSchema.optional(),
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
})

export const idParamsSchema = z.object({
  id: z.uuid(),
})

export const allocationParamsSchema = z.object({
  id: z.uuid(),
  allocationId: z.uuid(),
})

const moneyDocumentFieldsSchema = z.object({
  partyId: z.uuid(),
  branchId: nullableUuidSchema,
  gstRegistrationId: nullableUuidSchema,
  cashBankAccountId: z.uuid(),
  documentDate: dateSchema,
  paymentMethod: z.enum(paymentMethods),
  amount: positiveMoneySchema,
  unallocatedTreatment: z.enum(unallocatedTreatments).default("advance"),
  referenceNumber: optionalTextSchema,
  notes: optionalTextSchema,
})

export const createMoneyDocumentSchema = moneyDocumentFieldsSchema.extend({
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const updateMoneyDocumentSchema = moneyDocumentFieldsSchema.partial()

export const moneyAllocationSchema = z.object({
  receivablePayableEntryId: z.uuid(),
  allocatedAmount: moneySchema,
})

export const postMoneyDocumentSchema = z.object({
  allocations: z.array(moneyAllocationSchema).default([]),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
})

export const createAllocationSchema = moneyAllocationSchema.extend({
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const reverseMoneyDocumentSchema = z.object({
  reason: z.string().trim().min(3).max(300),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const reportDateRangeQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
})

export const agingReportQuerySchema = reportDateRangeQuerySchema.extend({
  entryType: z.enum(["receivable", "payable"]).default("receivable"),
})

export const bankReconciliationQuerySchema = reportDateRangeQuerySchema.extend({
  status: z.enum(["all", "reconciled", "unmatched"]).default("all"),
  accountId: nullableUuidSchema,
  search: z.string().trim().max(120).default(""),
})

export const bankReconciliationSchema = z.object({
  documentType: z.enum(["receipt", "payment"]),
  documentId: z.uuid(),
  statementLineId: nullableUuidSchema,
  statementDate: dateSchema,
  bankReference: optionalTextSchema,
  notes: optionalTextSchema,
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const bankStatementImportSchema = z.object({
  cashBankAccountId: z.uuid(),
  fileName: z.string().trim().min(1).max(180),
  csvText: z.string().min(1).max(2_000_000),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const bankStatementLinesQuerySchema = reportDateRangeQuerySchema.extend({
  status: z.enum(["all", "unmatched", "matched", "ignored"]).default("all"),
  accountId: nullableUuidSchema,
  importId: nullableUuidSchema,
  search: z.string().trim().max(120).default(""),
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
})

export const bankAutoMatchSchema = z.object({
  importId: nullableUuidSchema,
  cashBankAccountId: nullableUuidSchema,
  dateToleranceDays: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") {
        return 3
      }

      const parsed = Number(value)
      return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), 0), 7) : 3
    }),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const reconciliationParamsSchema = z.object({
  id: z.uuid(),
})

export type ListMoneyDocumentsQueryInput = z.infer<typeof listMoneyDocumentsQuerySchema>
export type ListReceivablePayableQueryInput = z.infer<typeof listReceivablePayableQuerySchema>
export type CreateMoneyDocumentInput = z.infer<typeof createMoneyDocumentSchema>
export type UpdateMoneyDocumentInput = z.infer<typeof updateMoneyDocumentSchema>
export type PostMoneyDocumentInput = z.infer<typeof postMoneyDocumentSchema>
export type CreateAllocationInput = z.infer<typeof createAllocationSchema>
export type ReportDateRangeQueryInput = z.infer<typeof reportDateRangeQuerySchema>
export type AgingReportQueryInput = z.infer<typeof agingReportQuerySchema>
export type BankReconciliationQueryInput = z.infer<
  typeof bankReconciliationQuerySchema
>
export type BankReconciliationInput = z.infer<typeof bankReconciliationSchema>
export type BankStatementImportInput = z.infer<typeof bankStatementImportSchema>
export type BankStatementLinesQueryInput = z.infer<
  typeof bankStatementLinesQuerySchema
>
export type BankAutoMatchInput = z.infer<typeof bankAutoMatchSchema>
