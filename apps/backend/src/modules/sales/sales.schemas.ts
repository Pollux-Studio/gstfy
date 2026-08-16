import { z } from "zod"

import { pricingModes, taxabilities } from "../tax/tax.types.js"

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)
const optionalDateSchema = dateSchema.optional().or(z.literal("")).transform((value) => value || null)
const nullableUuidSchema = z.uuid().optional().nullable()
const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/))
const quantitySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^\d+(\.\d{1,3})?$/))
  .refine((value) => Number(value) > 0, "Quantity must be greater than zero.")

export const salesInvoiceStatuses = ["draft", "posted"] as const
export const paymentModes = ["cash", "upi", "card", "bank", "cheque"] as const

export const salesInvoiceLineSchema = z.object({
  itemId: nullableUuidSchema,
  itemName: z.string().trim().min(2).max(180),
  hsnSacCode: z.string().trim().max(12).optional().or(z.literal("")).transform((value) => value || null),
  quantity: quantitySchema,
  unit: z.string().trim().min(1).max(20).default("PCS"),
  rate: moneySchema.refine((value) => Number(value) > 0, "Rate must be greater than zero."),
  gstRate: moneySchema.default("0"),
  taxability: z.enum(taxabilities).default("TAXABLE"),
  cessRuleId: z.string().trim().max(80).optional().or(z.literal("")).transform((value) => value || null),
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
  referenceNumber: z.string().trim().max(80).optional().or(z.literal("")).transform((value) => value || null),
})

export const createSalesInvoiceSchema = z.object({
  status: z.enum(salesInvoiceStatuses).default("draft"),
  partyId: nullableUuidSchema,
  customerName: z.string().trim().max(180).optional().or(z.literal("")).transform((value) => value || null),
  invoiceDate: dateSchema,
  dueDate: optionalDateSchema,
  gstRegistrationId: nullableUuidSchema,
  branchId: nullableUuidSchema,
  warehouseId: nullableUuidSchema,
  placeOfSupplyStateCode: z.string().trim().regex(/^\d{2}$/).optional().nullable(),
  supplyType: z.enum(["b2b", "b2c"]).default("b2c"),
  invoiceType: z.enum(["tax_invoice", "bill_of_supply"]).default("tax_invoice"),
  notes: z.string().trim().max(500).optional().or(z.literal("")).transform((value) => value || null),
  lines: z.array(salesInvoiceLineSchema).min(1),
  payments: z.array(salesPaymentSchema).default([]),
})

export const invoiceIdParamsSchema = z.object({
  id: z.uuid(),
})

export const listSalesInvoicesQuerySchema = z.object({
  status: z.enum(["draft", "posted", "cancelled"]).optional(),
  search: z.string().trim().max(120).optional(),
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

export type CreateSalesInvoiceInput = z.infer<typeof createSalesInvoiceSchema>
