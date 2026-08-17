import { z } from "zod"

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)
const nullableUuidSchema = z.uuid().optional().nullable()
const quantitySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^\d+(\.\d{1,3})?$/))
  .refine((value) => Number(value) > 0, "Quantity must be greater than zero.")
const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/))

export const inventorySettingsPayloadSchema = z.object({
  negativeStockPolicy: z.enum(["ALLOW", "WARN", "BLOCK"]).optional(),
  valuationMethod: z.enum(["WEIGHTED_AVERAGE", "FIFO"]).optional(),
})

export const inventoryItemLedgerParamsSchema = z.object({
  id: z.string().trim().min(1).max(120),
})

export const inventoryWarehouseParamsSchema = z.object({
  id: z.uuid(),
})

export const inventoryTransferParamsSchema = z.object({
  id: z.uuid(),
})

export const inventoryLedgerQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  warehouse: z.uuid().optional(),
  branch: z.uuid().optional(),
  transactionType: z
    .enum([
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
    ])
    .optional(),
})

export const inventoryOpeningStockSchema = z.object({
  itemId: z.uuid(),
  warehouseId: z.uuid(),
  branchId: nullableUuidSchema,
  quantity: quantitySchema,
  sourceUnit: z.string().trim().min(1).max(20).default("PCS"),
  baseQuantity: quantitySchema.optional(),
  unitCost: moneySchema,
  transactionDate: dateSchema,
  batchNumber: z.string().trim().max(120).optional().or(z.literal("")).transform((value) => value || null),
  manufacturingDate: dateSchema.optional().or(z.literal("")).transform((value) => value || null),
  expiryDate: dateSchema.optional().or(z.literal("")).transform((value) => value || null),
  serialNumbers: z.array(z.string().trim().min(1).max(120)).default([]),
  reason: z.string().trim().max(240).optional().or(z.literal("")).transform((value) => value || null),
})

export const inventoryAdjustmentSchema = z.object({
  itemId: z.uuid(),
  warehouseId: z.uuid(),
  branchId: nullableUuidSchema,
  quantity: quantitySchema,
  direction: z.enum(["in", "out"]),
  adjustmentType: z.enum(["ADJUSTMENT", "DAMAGE", "EXPIRY"]).default("ADJUSTMENT"),
  sourceUnit: z.string().trim().min(1).max(20).default("PCS"),
  baseQuantity: quantitySchema.optional(),
  unitCost: moneySchema.optional(),
  transactionDate: dateSchema,
  batchId: z.string().trim().max(120).optional().or(z.literal("")).transform((value) => value || null),
  serialId: z.string().trim().max(120).optional().or(z.literal("")).transform((value) => value || null),
  reason: z.string().trim().min(3).max(240),
})

export const createInventoryTransferSchema = z
  .object({
    sourceWarehouseId: z.uuid(),
    destinationWarehouseId: z.uuid(),
    branchId: nullableUuidSchema,
    transferDate: dateSchema,
    referenceNumber: z.string().trim().max(80).optional().or(z.literal("")).transform((value) => value || null),
    notes: z.string().trim().max(500).optional().or(z.literal("")).transform((value) => value || null),
    lines: z
      .array(
        z.object({
          itemId: z.uuid(),
          quantity: quantitySchema,
          unit: z.string().trim().min(1).max(20).default("PCS"),
          unitCost: moneySchema.optional(),
          batchId: z.string().trim().max(120).optional().or(z.literal("")).transform((value) => value || null),
          serialId: z.string().trim().max(120).optional().or(z.literal("")).transform((value) => value || null),
        })
      )
      .min(1),
  })
  .refine(
    (value) => value.sourceWarehouseId !== value.destinationWarehouseId,
    "Source and destination warehouses must be different."
  )

export const rebuildInventoryBalanceSchema = z.object({
  itemId: z.string().trim().min(1).max(120),
  warehouseId: z.uuid(),
})

export const listInventoryTransfersQuerySchema = z.object({
  status: z
    .enum(["DRAFT", "DISPATCHED", "IN_TRANSIT", "RECEIVED", "CANCELLED"])
    .optional(),
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
