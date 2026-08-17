import { z } from "zod"

export const adjustmentTypes = [
  "SALES_RETURN",
  "PURCHASE_RETURN",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
] as const

export const adjustmentStatuses = ["draft", "posted", "reversed"] as const
export const sourceDocumentTypes = ["sales_invoice", "purchase_bill"] as const
export const inventoryEffects = ["STOCK_IN", "STOCK_OUT", "NONE"] as const

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)
const optionalTextSchema = z
  .union([z.string().trim().max(500), z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === "") {
      return undefined
    }

    return value
  })

const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/))

const quantitySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^\d+(\.\d{1,3})?$/))

export const idParamsSchema = z.object({
  id: z.uuid(),
})

export const returnableParamsSchema = z.object({
  id: z.uuid(),
})

export const listAdjustmentsQuerySchema = z.object({
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") {
        return 1
      }

      const parsed = Number(value)
      return Number.isFinite(parsed) ? Math.max(Math.trunc(parsed), 1) : 1
    }),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") {
        return 15
      }

      const parsed = Number(value)
      return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), 100) : 15
    }),
  search: z.string().trim().max(120).optional().default(""),
  status: z.enum(adjustmentStatuses).optional(),
  fromDate: dateSchema.optional(),
  toDate: dateSchema.optional(),
})

const adjustmentLineSchema = z
  .object({
    originalLineId: z.uuid().optional(),
    quantity: quantitySchema.optional(),
    taxableValue: moneySchema.optional(),
    rate: moneySchema.optional(),
    reason: optionalTextSchema,
    inventoryEffect: z.enum(inventoryEffects).optional(),
    inventoryWarehouseId: z.uuid().optional().nullable(),
  })
  .superRefine((line, ctx) => {
    if (!line.originalLineId) {
      ctx.addIssue({
        code: "custom",
        message: "Choose a source document line for this adjustment.",
        path: ["originalLineId"],
      })
    }

    if (!line.quantity && !line.taxableValue) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a quantity or adjustment value.",
        path: ["quantity"],
      })
    }
  })

export const createAdjustmentSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  sourceDocumentId: z.uuid(),
  adjustmentDate: dateSchema,
  reasonCode: z.string().trim().max(80).optional(),
  reason: optionalTextSchema,
  adjustmentContext: z
    .enum(["goods_related", "value_only", "tax_adjustment"])
    .default("goods_related"),
  issuerType: z
    .enum(["GSTFY_BUSINESS", "CUSTOMER", "SUPPLIER"])
    .default("GSTFY_BUSINESS"),
  documentDirection: z.enum(["incoming", "outgoing"]).default("outgoing"),
  sourcePartyRole: z.enum(["customer", "supplier"]).optional(),
  lines: z.array(adjustmentLineSchema).min(1),
})

export const updateAdjustmentSchema = createAdjustmentSchema
  .omit({ idempotencyKey: true, sourceDocumentId: true })
  .partial()

export const postAdjustmentSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
})

export const reverseAdjustmentSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  reason: z.string().trim().min(3).max(240),
})

export type ListAdjustmentsQueryInput = z.infer<typeof listAdjustmentsQuerySchema>
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>
export type UpdateAdjustmentInput = z.infer<typeof updateAdjustmentSchema>
export type PostAdjustmentInput = z.infer<typeof postAdjustmentSchema>
export type ReverseAdjustmentInput = z.infer<typeof reverseAdjustmentSchema>
