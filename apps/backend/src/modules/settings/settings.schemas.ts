import { z } from "zod"

export const updateBusinessSettingsSchema = z.object({
  tradeName: z.string().trim().min(2).max(180).optional(),
  businessEmail: z
    .string()
    .trim()
    .email()
    .nullable()
    .optional()
    .or(z.literal("")),
  businessMobile: z
    .string()
    .trim()
    .max(20)
    .nullable()
    .optional()
    .or(z.literal("")),
  primaryContactName: z.string().trim().min(2).max(120).optional(),
  primaryContactEmail: z
    .string()
    .trim()
    .email()
    .nullable()
    .optional()
    .or(z.literal("")),
  primaryContactMobile: z
    .string()
    .trim()
    .max(20)
    .nullable()
    .optional()
    .or(z.literal("")),
  principalAddressLine1: z.string().trim().max(180).optional(),
  principalAddressLine2: z
    .string()
    .trim()
    .max(180)
    .nullable()
    .optional()
    .or(z.literal("")),
  addressLine1: z.string().trim().max(180).optional(),
  addressLine2: z.string().trim().max(180).nullable().optional(),
  locality: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  pincode: z.string().trim().regex(/^\d{6}$/).optional(),
  stateCode: z.string().trim().regex(/^\d{2}$/).optional(),
  possessionType: z.string().trim().max(80).optional(),
  registrationDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
})

export const updateInvoiceSettingsSchema = z.object({
  invoiceTemplate: z.enum(["classic", "modern", "compact", "standard", "thermal"]).optional(),
  invoicePrefix: z.string().trim().min(1).max(12).optional(),
  invoiceNextNumber: z.number().int().positive().optional(),
})

export const updateGstRateSettingsSchema = z.object({
  enabledGstSlabs: z
    .array(z.union([z.literal(5), z.literal(12), z.literal(18), z.literal(28)]))
    .min(1)
    .optional(),
})

export const updatePrinterSettingsSchema = z.object({
  paperSize: z.enum(["A4", "A5", "THERMAL_80MM"]).optional(),
  printOrientation: z.enum(["portrait", "landscape"]).optional(),
  autoOpenPrintDialog: z.boolean().optional(),
  compactPrintLayout: z.boolean().optional(),
  printerPaperSize: z.enum(["a4", "a5", "thermal_80mm"]).optional(),
  printerCopies: z.number().int().min(1).max(5).optional(),
})

export const updateUserSettingsSchema = z.object({
  displayName: z.string().trim().max(80).nullable().optional(),
  locale: z.enum(["en", "ta", "hi"]).optional(),
})

export const verifyUserPhoneSchema = z.object({
  idToken: z.string().trim().min(1),
})

export const verifyCaReferralSchema = z.object({
  referralCode: z.string().trim().min(1).max(40),
})

export const updateBusinessTenantSchema = z.object({
  tenantSlug: z
    .string()
    .trim()
    .min(3)
    .max(48)
    .regex(
      /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/,
      "Use letters, numbers, and hyphens only."
    ),
})

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/\d/, "Password must include at least one number.")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one special character.")

export const changeUserPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  })

export type UpdateBusinessSettingsInput = z.infer<
  typeof updateBusinessSettingsSchema
>
export type UpdateInvoiceSettingsInput = z.infer<typeof updateInvoiceSettingsSchema>
export type UpdateGstRateSettingsInput = z.infer<typeof updateGstRateSettingsSchema>
export type UpdatePrinterSettingsInput = z.infer<typeof updatePrinterSettingsSchema>
export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>
export type VerifyUserPhoneInput = z.infer<typeof verifyUserPhoneSchema>
export type VerifyCaReferralInput = z.infer<typeof verifyCaReferralSchema>
export type UpdateBusinessTenantInput = z.infer<typeof updateBusinessTenantSchema>
export type ChangeUserPasswordInput = z.infer<typeof changeUserPasswordSchema>
