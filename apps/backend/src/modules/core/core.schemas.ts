import { z } from "zod"

export const voucherTypes = [
  "SALES",
  "PURCHASE",
  "RECEIPT",
  "PAYMENT",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
  "SALES_RETURN",
  "PURCHASE_RETURN",
  "EXPENSE",
  "JOURNAL",
  "STOCK_TRANSFER",
  "STOCK_ADJUSTMENT",
] as const

export const auditActions = [
  "DRAFT_CREATED",
  "DRAFT_UPDATED",
  "POSTED",
  "CANCELLED",
  "CREDIT_NOTE_CREATED",
  "DEBIT_NOTE_CREATED",
  "PAYMENT_ALLOCATED",
  "STOCK_TRANSFERRED",
  "GST_ADJUSTED",
] as const

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)

const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^-?\d+(\.\d{1,2})?$/))

const quantitySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^-?\d+(\.\d{1,3})?$/))

const nullableUuidSchema = z.uuid().optional().nullable()
const snapshotSchema = z.record(z.string(), z.unknown())

export const inventoryMovementTypes = [
  "OPENING_STOCK",
  "PURCHASE",
  "SALE",
  "SALES_RETURN",
  "PURCHASE_RETURN",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "DAMAGE",
  "EXPIRY",
] as const

const inventoryEntrySchema = z
  .object({
    branchId: nullableUuidSchema,
    warehouseId: nullableUuidSchema,
    itemId: z.string().trim().min(1).max(120).optional(),
    itemNameSnapshot: z.string().trim().min(2).max(180),
    skuSnapshot: z.string().trim().max(80).optional(),
    unitSnapshot: z.string().trim().max(40).optional(),
    itemSnapshot: snapshotSchema.optional(),
    movementType: z.enum(inventoryMovementTypes),
    quantity: quantitySchema.optional(),
    quantityIn: quantitySchema.default("0"),
    quantityOut: quantitySchema.default("0"),
    unit: z.string().trim().min(1).max(20).default("pcs"),
    sourceUnit: z.string().trim().min(1).max(20).optional(),
    baseQuantity: quantitySchema.optional(),
    unitCost: moneySchema.optional(),
    totalCost: moneySchema.optional(),
    inventoryValue: moneySchema.optional(),
    batchId: z.string().trim().max(120).optional(),
    serialId: z.string().trim().max(120).optional(),
    batchNumberSnapshot: z.string().trim().max(120).optional(),
    serialNumberSnapshot: z.string().trim().max(120).optional(),
    transactionDate: dateSchema.optional(),
    reason: z.string().trim().max(240).optional(),
  })
  .superRefine((entry, ctx) => {
    const quantityIn = Number(entry.quantityIn)
    const quantityOut = Number(entry.quantityOut)

    if (entry.quantity === undefined && quantityIn === 0 && quantityOut === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Inventory movement must include quantityIn, quantityOut, or legacy quantity.",
        path: ["quantity"],
      })
    }

    if (quantityIn < 0 || quantityOut < 0) {
      ctx.addIssue({
        code: "custom",
        message: "Inventory quantityIn and quantityOut must be positive values.",
        path: ["quantityIn"],
      })
    }

    if (quantityIn > 0 && quantityOut > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Inventory movement cannot have both quantityIn and quantityOut.",
        path: ["quantityOut"],
      })
    }
  })

export const idParamsSchema = z.object({
  id: z.uuid(),
})

export const listVouchersQuerySchema = z.object({
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
      return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 15
    }),
})

export const postVoucherSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  voucherType: z.enum(voucherTypes),
  voucherDate: dateSchema,
  financialYearId: z.uuid(),
  gstRegistrationId: nullableUuidSchema,
  branchId: nullableUuidSchema,
  warehouseId: nullableUuidSchema,
  referenceVoucherId: nullableUuidSchema,
  documentType: z.string().trim().min(2).max(40).optional(),
  seriesCode: z.string().trim().min(2).max(40).default("DEFAULT"),
  notes: z.string().trim().max(500).optional(),
  snapshots: z
    .object({
      seller: snapshotSchema.optional(),
      branch: snapshotSchema.optional(),
      party: snapshotSchema.optional(),
      tax: snapshotSchema.optional(),
    })
    .default({}),
  journal: z.object({
    description: z.string().trim().max(240).optional(),
    lines: z
      .array(
        z.object({
          accountId: z.uuid(),
          accountCode: z.string().trim().min(2).max(60),
          accountName: z.string().trim().min(2).max(160),
          debit: moneySchema.default("0"),
          credit: moneySchema.default("0"),
          narration: z.string().trim().max(240).optional(),
          branchId: nullableUuidSchema,
          gstRegistrationId: nullableUuidSchema,
          warehouseId: nullableUuidSchema,
        })
      )
      .min(2),
  }),
  inventoryEntries: z
    .array(inventoryEntrySchema)
    .default([]),
  gstEntries: z
    .array(
      z.object({
        gstRegistrationId: nullableUuidSchema,
        branchId: nullableUuidSchema,
        entryType: z.enum(["output", "input", "rcm_liability", "rcm_itc", "adjustment"]),
        taxComponent: z.enum(["cgst", "sgst", "igst", "cess"]),
        taxRate: moneySchema.default("0"),
        taxableValue: moneySchema.default("0"),
        taxAmount: moneySchema.default("0"),
        placeOfSupplyStateCode: z.string().trim().regex(/^\d{2}$/).optional(),
        itcEligibility: z
          .enum(["eligible", "ineligible", "pending_2b", "blocked"])
          .optional(),
      })
    )
    .default([]),
  receivablePayableEntries: z
    .array(
      z.object({
        partyId: z.string().trim().max(120).optional(),
        partyNameSnapshot: z.string().trim().min(2).max(180),
        partySnapshot: snapshotSchema.optional(),
        entryType: z.enum(["receivable", "payable"]),
        originalAmount: moneySchema,
        dueDate: dateSchema.optional(),
      })
    )
    .default([]),
  paymentAllocations: z
    .array(
      z.object({
        documentVoucherId: z.uuid(),
        receivablePayableEntryId: z.uuid(),
        allocatedAmount: moneySchema,
      })
    )
    .default([]),
})

export type PostVoucherInput = z.infer<typeof postVoucherSchema>
export type VoucherType = (typeof voucherTypes)[number]
export type InventoryMovementType = (typeof inventoryMovementTypes)[number]
