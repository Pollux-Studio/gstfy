import { z } from "zod"

export const itemTypes = ["GOODS", "SERVICE"] as const
export const itemStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const
export const taxabilities = [
  "TAXABLE",
  "EXEMPT",
  "NIL_RATED",
  "NON_GST",
  "ZERO_RATED",
] as const
export const priceTypes = [
  "RETAIL",
  "WHOLESALE",
  "DEALER",
  "ONLINE",
  "SPECIAL",
  "PURCHASE",
] as const
export const taxModes = ["EXCLUSIVE", "INCLUSIVE"] as const

const nullableTrimmed = z
  .string()
  .trim()
  .max(240)
  .optional()
  .or(z.literal(""))
  .transform((value) => (value === undefined ? undefined : value || null))

const optionalDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .or(z.literal(""))
  .transform((value) => (value === undefined ? undefined : value || null))

const requiredDateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)

const decimalSchema = (scale: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === undefined || value === "" ? "0" : String(value).trim()))
    .pipe(z.string().regex(new RegExp(`^\\d+(\\.\\d{1,${scale}})?$`)))

const positiveDecimalSchema = (scale: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === undefined || value === "" ? "1" : String(value).trim()))
    .pipe(z.string().regex(new RegExp(`^\\d+(\\.\\d{1,${scale}})?$`)))
    .refine((value) => Number(value) > 0, "Value must be greater than zero.")

export const idParamsSchema = z.object({
  id: z.uuid(),
})

export const childParamsSchema = z.object({
  id: z.uuid(),
  childId: z.uuid(),
})

export const listProductsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  itemType: z.enum(itemTypes).optional(),
  status: z.enum(itemStatuses).optional(),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") {
        return 50
      }

      const parsed = Number(value)
      return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 50
    }),
})

export const resolveProductQuerySchema = z.object({
  transactionDate: requiredDateSchema,
  branchId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  supplierId: z.uuid().optional(),
  transactionType: z
    .enum(["SALES", "PURCHASE", "STOCK_TRANSFER", "STOCK_ADJUSTMENT"])
    .default("SALES"),
  priceType: z.enum(priceTypes).default("RETAIL"),
})

const productTaxProfileBaseSchema = z.object({
  taxability: z.enum(taxabilities).default("TAXABLE"),
  hsnSac: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{4,8}$/)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null),
  gstRate: decimalSchema(2).default("0"),
  cessRuleId: nullableTrimmed,
  effectiveFrom: requiredDateSchema,
  effectiveTo: optionalDateSchema,
  status: z.enum(itemStatuses).default("ACTIVE"),
})

export const productTaxProfileSchema = productTaxProfileBaseSchema
  .superRefine((value, context) => {
    if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
      context.addIssue({
        code: "custom",
        path: ["effectiveTo"],
        message: "Effective-to date cannot be before effective-from date.",
      })
    }

    if (value.taxability === "TAXABLE" && !value.hsnSac) {
      context.addIssue({
        code: "custom",
        path: ["hsnSac"],
        message: "HSN/SAC is required for taxable products.",
      })
    }
  })

export const productUnitSchema = z.object({
  baseUnit: z.string().trim().toUpperCase().min(1).max(20).default("PCS"),
  secondaryUnit: z
    .string()
    .trim()
    .toUpperCase()
    .max(20)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null),
  conversionFactor: positiveDecimalSchema(6).default("1"),
  gstUqc: z
    .string()
    .trim()
    .toUpperCase()
    .max(20)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null),
})

const productPriceBaseSchema = z.object({
  priceType: z.enum(priceTypes).default("RETAIL"),
  price: decimalSchema(2).default("0"),
  taxMode: z.enum(taxModes).default("EXCLUSIVE"),
  currency: z.string().trim().toUpperCase().length(3).default("INR"),
  minimumQuantity: positiveDecimalSchema(3).default("1"),
  customerGroupId: nullableTrimmed,
  effectiveFrom: requiredDateSchema,
  effectiveTo: optionalDateSchema,
  status: z.enum(itemStatuses).default("ACTIVE"),
})

export const productPriceSchema = productPriceBaseSchema
  .superRefine((value, context) => {
    if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
      context.addIssue({
        code: "custom",
        path: ["effectiveTo"],
        message: "Effective-to date cannot be before effective-from date.",
      })
    }
  })

const productSupplierBaseSchema = z.object({
  supplierId: z.uuid(),
  supplierItemCode: nullableTrimmed,
  purchasePrice: decimalSchema(2).optional(),
  minimumOrderQuantity: positiveDecimalSchema(3).default("1"),
  leadTimeDays: z.number().int().min(0).max(365).default(0),
  isPreferred: z.boolean().default(false),
  effectiveFrom: optionalDateSchema,
  effectiveTo: optionalDateSchema,
  status: z.enum(itemStatuses).default("ACTIVE"),
})

export const productSupplierSchema = productSupplierBaseSchema
  .superRefine((value, context) => {
    if (value.effectiveTo && value.effectiveFrom && value.effectiveTo < value.effectiveFrom) {
      context.addIssue({
        code: "custom",
        path: ["effectiveTo"],
        message: "Effective-to date cannot be before effective-from date.",
      })
    }
  })

export const productBarcodeSchema = z.object({
  barcode: z.string().trim().min(3).max(80),
  barcodeType: nullableTrimmed,
  isPrimary: z.boolean().default(false),
  status: z.enum(itemStatuses).default("ACTIVE"),
})

export const productInventoryProfileSchema = z.object({
  trackInventory: z.boolean().default(true),
  defaultWarehouseId: z.uuid().optional().nullable(),
  reorderLevel: decimalSchema(3).default("0"),
  minimumStock: decimalSchema(3).default("0"),
  maximumStock: decimalSchema(3).default("0"),
  batchTracking: z.boolean().default(false),
  serialTracking: z.boolean().default(false),
})

export const productAccountingProfileSchema = z.object({
  salesAccountId: z.uuid().optional().nullable(),
  purchaseAccountId: z.uuid().optional().nullable(),
  inventoryAccountId: z.uuid().optional().nullable(),
  salesReturnAccountId: z.uuid().optional().nullable(),
  purchaseReturnAccountId: z.uuid().optional().nullable(),
})

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(180),
  itemType: z.enum(itemTypes).default("GOODS"),
  sku: z.string().trim().toUpperCase().min(2).max(80),
  description: nullableTrimmed,
  categoryId: nullableTrimmed,
  brandId: nullableTrimmed,
  manufacturer: nullableTrimmed,
  modelNumber: nullableTrimmed,
  status: z.enum(itemStatuses).default("ACTIVE"),
  taxProfile: productTaxProfileSchema.optional(),
  unitProfile: productUnitSchema.optional(),
  price: productPriceSchema.optional(),
  supplier: productSupplierSchema.optional(),
  barcodes: z.array(productBarcodeSchema).default([]),
  inventoryProfile: productInventoryProfileSchema.optional(),
  accountingProfile: productAccountingProfileSchema.optional(),
})

export const updateProductSchema = createProductSchema
  .omit({
    taxProfile: true,
    unitProfile: true,
    price: true,
    supplier: true,
    barcodes: true,
    inventoryProfile: true,
    accountingProfile: true,
  })
  .partial()

export const updateProductTaxProfileSchema = productTaxProfileBaseSchema
  .partial()
  .superRefine((value, context) => {
    if (value.effectiveTo && value.effectiveFrom && value.effectiveTo < value.effectiveFrom) {
      context.addIssue({
        code: "custom",
        path: ["effectiveTo"],
        message: "Effective-to date cannot be before effective-from date.",
      })
    }
  })
export const updateProductUnitSchema = productUnitSchema.partial()
export const updateProductPriceSchema = productPriceBaseSchema
  .partial()
  .superRefine((value, context) => {
    if (value.effectiveTo && value.effectiveFrom && value.effectiveTo < value.effectiveFrom) {
      context.addIssue({
        code: "custom",
        path: ["effectiveTo"],
        message: "Effective-to date cannot be before effective-from date.",
      })
    }
  })
export const updateProductSupplierSchema = productSupplierBaseSchema
  .partial()
  .superRefine((value, context) => {
    if (value.effectiveTo && value.effectiveFrom && value.effectiveTo < value.effectiveFrom) {
      context.addIssue({
        code: "custom",
        path: ["effectiveTo"],
        message: "Effective-to date cannot be before effective-from date.",
      })
    }
  })
export const updateProductBarcodeSchema = productBarcodeSchema.partial()
export const updateProductInventoryProfileSchema = productInventoryProfileSchema.partial()
export const updateProductAccountingProfileSchema = productAccountingProfileSchema.partial()

export type CreateProductInput = z.infer<typeof createProductSchema>
export type ProductTaxProfileInput = z.infer<typeof productTaxProfileSchema>
export type ProductPriceInput = z.infer<typeof productPriceSchema>
