import { z } from "zod"

import { pricingModes, taxabilities } from "../tax/tax.types.js"

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)
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
const nullableTextSchema = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .nullable()
    .transform((value) => (typeof value === "string" && value ? value : null))

export const paymentModes = ["cash", "upi", "card", "bank", "cheque"] as const

export const posCheckoutLineSchema = z.object({
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

export const posPaymentSchema = z.object({
  paymentMode: z.enum(paymentModes),
  amount: moneySchema.refine((value) => Number(value) > 0, "Amount must be greater than zero."),
  referenceNumber: nullableTextSchema(80),
})

export const posCheckoutSchema = z.object({
  partyId: nullableUuidSchema,
  customerName: nullableTextSchema(180),
  receiptDate: dateSchema.default(() => new Date().toISOString().slice(0, 10)),
  gstRegistrationId: nullableUuidSchema,
  branchId: nullableUuidSchema,
  warehouseId: nullableUuidSchema,
  placeOfSupplyStateCode: z.string().trim().regex(/^\d{2}$/).optional().nullable(),
  notes: nullableTextSchema(500),
  lines: z.array(posCheckoutLineSchema).min(1),
  payments: z.array(posPaymentSchema).min(1),
})

export const posSaleIdParamsSchema = z.object({
  id: z.uuid(),
})

export const listPosSalesQuerySchema = z.object({
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

export type PosCheckoutInput = z.infer<typeof posCheckoutSchema>
