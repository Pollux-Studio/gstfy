import { z } from "zod"

export const updateAccountSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  locale: z.enum(["en", "hi", "ta"]).optional(),
})

export const updateAccountSettingsSchema = z.object({
  displayName: z.string().trim().max(80).nullable().optional(),
  locale: z.enum(["en", "hi", "ta"]).optional(),
})

export const verifyAccountPhoneSchema = z.object({
  idToken: z.string().trim().min(1),
})

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/\d/, "Password must include at least one number.")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one special character.")

export const changeAccountPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  })

export const completeFirstLoginPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  })

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>
export type UpdateAccountSettingsInput = z.infer<typeof updateAccountSettingsSchema>
export type VerifyAccountPhoneInput = z.infer<typeof verifyAccountPhoneSchema>
export type ChangeAccountPasswordInput = z.infer<typeof changeAccountPasswordSchema>
export type CompleteFirstLoginPasswordInput = z.infer<typeof completeFirstLoginPasswordSchema>
