import { z } from "zod"

import { pricingModes, taxabilities } from "../tax/tax.types.js"

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)
const optionalDateSchema = z
  .union([dateSchema, z.literal(""), z.null()])
  .optional()
  .transform((value) => value || null)
const nullableUuidSchema = z.uuid().optional().nullable()
const nullableTextSchema = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .nullable()
    .transform((value) => (typeof value === "string" && value ? value : null))
const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/))
const quantitySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^\d+(\.\d{1,3})?$/))
  .refine((value) => Number(value) > 0, "Quantity must be greater than zero.")

export const salesInvoiceStatuses = ["quotation", "draft", "posted"] as const
export const paymentModes = ["cash", "upi", "card", "bank", "cheque"] as const

export const salesInvoiceLineSchema = z.object({
  itemId: nullableUuidSchema,
  itemName: z.string().trim().min(2).max(180),
  hsnSacCode: nullableTextSchema(12),
  quantity: quantitySchema,
  unit: z.string().trim().min(1).max(20).default("PCS"),
  rate: moneySchema.refine((value) => Number(value) > 0, "Rate must be greater than zero."),
  gstRate: moneySchema.default("0"),
  taxability: z.enum(taxabilities).default("TAXABLE"),
  cessRuleId: nullableTextSchema(80),
  pricingMode: z.enum(pricingModes).default("tax_exclusive"),
  discountAmount: moneySchema.optional().nullable(),
  otherCharges: z
    .array(
      z.object({
        chargeType: z.string().trim().min(1).max(80),
        amount: moneySchema,
        taxTreatment: z.enum(["taxable", "non_taxable"]),
      })
    )
    .default([]),
})

export const salesPaymentSchema = z.object({
  paymentMode: z.enum(paymentModes),
  amount: moneySchema.refine((value) => Number(value) > 0, "Amount must be greater than zero."),
  referenceNumber: nullableTextSchema(80),
})

export const createSalesInvoiceSchema = z.object({
  status: z.enum(salesInvoiceStatuses).default("draft"),
  partyId: nullableUuidSchema,
  customerName: nullableTextSchema(180),
  invoiceDate: dateSchema,
  dueDate: optionalDateSchema,
  gstRegistrationId: nullableUuidSchema,
  branchId: nullableUuidSchema,
  warehouseId: nullableUuidSchema,
  placeOfSupplyStateCode: z.string().trim().regex(/^\d{2}$/).optional().nullable(),
  supplyType: z.enum(["b2b", "b2c"]).default("b2c"),
  invoiceType: z.enum(["tax_invoice", "bill_of_supply"]).default("tax_invoice"),
  notes: nullableTextSchema(500),
  lines: z.array(salesInvoiceLineSchema).min(1),
  payments: z.array(salesPaymentSchema).default([]),
})

export const invoiceIdParamsSchema = z.object({
  id: z.uuid(),
})

export const listSalesInvoicesQuerySchema = z.object({
  status: z.enum(["quotation", "draft", "posted", "cancelled"]).optional(),
  search: z.string().trim().max(120).optional(),
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
      return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 15
    }),
})

export type CreateSalesInvoiceInput = z.infer<typeof createSalesInvoiceSchema>
