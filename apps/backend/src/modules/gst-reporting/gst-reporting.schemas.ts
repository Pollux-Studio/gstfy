import { z } from "zod"

export const gstReportingStatuses = [
  "DRAFT",
  "REVIEW",
  "READY_FOR_CA_REVIEW",
  "CA_APPROVED",
  "READY_FOR_SUBMISSION",
  "SUBMITTED",
  "FILED",
  "LOCKED",
] as const

export const gstReportTypes = ["gstr1", "gstr3b", "hsn", "documents", "review"] as const
export const gstExportFormats = ["csv", "json", "xlsx"] as const
export const gstReportingExceptionStatuses = [
  "OPEN",
  "IN_REVIEW",
  "RESOLVED",
  "IGNORED",
] as const
export const gstReportingExceptionSeverities = ["HIGH", "MEDIUM", "LOW"] as const

const periodSchema = z.string().trim().regex(/^\d{4}-\d{2}$/)
const idempotencyKeySchema = z.string().trim().min(8).max(120)
const optionalReasonSchema = z
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

export const gstReportingRunParamsSchema = z.object({
  id: z.uuid(),
})

export const createGstReportingRunSchema = z.object({
  period: periodSchema,
  gstRegistrationId: z.uuid(),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const reportingRunActionSchema = z.object({
  reason: optionalReasonSchema,
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const approveReportingRunSchema = z.object({
  approvalComment: z.string().trim().min(3).max(500),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const reopenReportingRunSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const resolveReportingExceptionSchema = z.object({
  exceptionId: z.uuid(),
  status: z.enum(["RESOLVED", "IGNORED", "IN_REVIEW"]),
  resolution: z.string().trim().min(3).max(500),
  idempotencyKey: idempotencyKeySchema.optional(),
})

export const listReportingRunsQuerySchema = z.object({
  period: periodSchema.optional(),
  gstRegistrationId: z.uuid().optional(),
  status: z.enum(gstReportingStatuses).optional(),
  ...paginationQuerySchema,
})

export const reportingDatasetQuerySchema = z.object({
  runId: z.uuid().optional(),
  period: periodSchema.optional(),
  gstRegistrationId: z.uuid().optional(),
})

export const reportingExportQuerySchema = reportingDatasetQuerySchema.extend({
  format: z.enum(gstExportFormats).optional().default("csv"),
})

export const reportingExceptionsQuerySchema = reportingDatasetQuerySchema.extend({
  status: z.enum(gstReportingExceptionStatuses).optional(),
  severity: z.enum(gstReportingExceptionSeverities).optional(),
  ...paginationQuerySchema,
})

export const reportingDrilldownQuerySchema = reportingDatasetQuerySchema.extend({
  classification: z.string().trim().max(80).optional(),
  sourceDocumentType: z.string().trim().max(80).optional(),
  hsnSac: z.string().trim().max(16).optional(),
  ...paginationQuerySchema,
})

export type CreateGstReportingRunInput = z.infer<typeof createGstReportingRunSchema>
export type ReportingRunActionInput = z.infer<typeof reportingRunActionSchema>
export type ApproveReportingRunInput = z.infer<typeof approveReportingRunSchema>
export type ReopenReportingRunInput = z.infer<typeof reopenReportingRunSchema>
export type ResolveReportingExceptionInput = z.infer<
  typeof resolveReportingExceptionSchema
>
export type ListReportingRunsQueryInput = z.infer<typeof listReportingRunsQuerySchema>
export type ReportingDatasetQueryInput = z.infer<typeof reportingDatasetQuerySchema>
export type ReportingExportQueryInput = z.infer<typeof reportingExportQuerySchema>
export type ReportingExceptionsQueryInput = z.infer<typeof reportingExceptionsQuerySchema>
export type ReportingDrilldownQueryInput = z.infer<typeof reportingDrilldownQuerySchema>
