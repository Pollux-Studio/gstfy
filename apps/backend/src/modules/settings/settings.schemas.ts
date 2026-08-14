import { z } from "zod"

export const updateBusinessSettingsSchema = z.object({
  tradeName: z.string().trim().min(2).max(180).optional(),
  businessEmail: z.string().trim().email().optional().or(z.literal("")),
  businessMobile: z.string().trim().max(20).optional().or(z.literal("")),
  primaryContactName: z.string().trim().min(2).max(120).optional(),
  primaryContactEmail: z.string().trim().email().optional().or(z.literal("")),
  primaryContactMobile: z.string().trim().max(20).optional().or(z.literal("")),
  addressLine1: z.string().trim().max(180).optional(),
  addressLine2: z.string().trim().max(180).optional(),
  locality: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  pincode: z.string().trim().regex(/^\d{6}$/).optional(),
  stateCode: z.string().trim().regex(/^\d{2}$/).optional(),
})

export const updateInvoiceSettingsSchema = z.object({
  invoiceTemplate: z.enum(["standard", "modern", "thermal"]).optional(),
  invoicePrefix: z.string().trim().min(1).max(12).optional(),
  invoiceNextNumber: z.number().int().positive().optional(),
})

export const updateGstRateSettingsSchema = z.object({
  cgstRateBps: z.number().int().min(0).max(1400).optional(),
  sgstRateBps: z.number().int().min(0).max(1400).optional(),
})

export const updatePrinterSettingsSchema = z.object({
  printerPaperSize: z.enum(["a4", "a5", "thermal_80mm"]).optional(),
  printerCopies: z.number().int().min(1).max(5).optional(),
})

export type UpdateBusinessSettingsInput = z.infer<
  typeof updateBusinessSettingsSchema
>
export type UpdateInvoiceSettingsInput = z.infer<typeof updateInvoiceSettingsSchema>
export type UpdateGstRateSettingsInput = z.infer<typeof updateGstRateSettingsSchema>
export type UpdatePrinterSettingsInput = z.infer<typeof updatePrinterSettingsSchema>
