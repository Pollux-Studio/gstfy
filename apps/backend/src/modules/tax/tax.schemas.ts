import { z } from "zod"

import { pricingModes, supplyTypes, taxabilities, transactionTypes } from "./tax.types.js"

const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/))

const quantitySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^\d+(\.\d{1,3})?$/))

export const calculateTaxSchema = z.object({
  transactionDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  transactionType: z.enum(transactionTypes).default("sales"),
  supplyType: z.enum(supplyTypes).optional(),
  partyRegistrationType: z.enum(["registered", "unregistered"]).optional(),
  gstRegistrationId: z.uuid().optional().nullable(),
  sellerStateCode: z.string().trim().regex(/^\d{2}$/).optional(),
  placeOfSupplyStateCode: z.string().trim().regex(/^\d{2}$/).optional().nullable(),
  reverseCharge: z.boolean().default(false),
  lines: z
    .array(
      z.object({
        itemId: z.uuid().optional().nullable(),
        itemName: z.string().trim().min(1).max(180),
        hsnSacCode: z.string().trim().max(12).optional().nullable(),
        quantity: quantitySchema,
        unit: z.string().trim().max(20).optional(),
        rate: moneySchema,
        gstRate: moneySchema.optional().nullable(),
        taxability: z.enum(taxabilities).optional().nullable(),
        cessRuleId: z.string().trim().max(80).optional().nullable(),
        itcEligible: z.boolean().optional(),
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
    )
    .min(1),
})

export type CalculateTaxInput = z.infer<typeof calculateTaxSchema>
