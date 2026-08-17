import { z } from "zod"

export const accountTypes = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const
export const normalBalances = ["DEBIT", "CREDIT"] as const
export const accountStatuses = ["active", "inactive"] as const

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)
const nullableUuidSchema = z.uuid().optional().nullable()
const pageSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") {
      return 1
    }

    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.max(Math.trunc(parsed), 1) : 1
  })
const limitSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") {
      return 15
    }

    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 15
  })

export const accountIdParamsSchema = z.object({
  id: z.uuid(),
})

export const listAccountsQuerySchema = z.object({
  status: z.enum(accountStatuses).optional(),
  accountType: z.enum(accountTypes).optional(),
  search: z.string().trim().max(80).optional(),
  page: pageSchema,
  limit: limitSchema,
})

export const createLedgerAccountSchema = z.object({
  parentAccountId: nullableUuidSchema,
  accountCode: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9._-]+$/i)
    .transform((value) => value.toUpperCase()),
  accountName: z.string().trim().min(2).max(160),
  accountType: z.enum(accountTypes),
  accountGroup: z.string().trim().min(2).max(80).default("UNCATEGORIZED"),
  normalBalance: z.enum(normalBalances).optional(),
  allowPosting: z.boolean().default(true),
  description: z.string().trim().max(500).optional(),
})

export const updateLedgerAccountSchema = z.object({
  parentAccountId: nullableUuidSchema,
  accountName: z.string().trim().min(2).max(160).optional(),
  accountGroup: z.string().trim().min(2).max(80).optional(),
  allowPosting: z.boolean().optional(),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(accountStatuses).optional(),
})

export const reportQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  branchId: nullableUuidSchema,
  gstRegistrationId: nullableUuidSchema,
  warehouseId: nullableUuidSchema,
  page: pageSchema,
  limit: limitSchema,
})

export type AccountType = (typeof accountTypes)[number]
export type NormalBalance = (typeof normalBalances)[number]
export type CreateLedgerAccountInput = z.infer<typeof createLedgerAccountSchema>
export type UpdateLedgerAccountInput = z.infer<typeof updateLedgerAccountSchema>
export type ReportQueryInput = z.infer<typeof reportQuerySchema>
