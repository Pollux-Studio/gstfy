import { z } from "zod"

const passwordSchema = z
  .string()
  .min(8)
  .regex(/\d/, "Password must include at least one number.")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one special character.")

export const businessRegisterSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: passwordSchema,
  company: z.object({
    legalName: z.string().trim().min(2).max(180),
    tradeName: z.string().trim().min(2).max(180),
    pan: z
      .string()
      .trim()
      .regex(/^[A-Z]{5}\d{4}[A-Z]$/i),
    constitution: z.string().trim().min(2).max(80),
  }),
})

export const workspaceRegisterSchema = z.object({
  identifier: z.string().trim().min(1),
  password: passwordSchema,
  caReferralCode: z.string().trim().min(1).max(40),
  company: z.object({
    legalName: z.string().trim().min(2).max(180),
    tradeName: z.string().trim().min(2).max(180),
    pan: z
      .string()
      .trim()
      .regex(/^[A-Z]{5}\d{4}[A-Z]$/i),
    constitution: z.string().trim().min(2).max(80),
    businessEmail: z.string().trim().email().optional(),
    businessMobile: z.string().trim().optional(),
    primaryContactName: z.string().trim().min(2).max(120),
    primaryContactMobile: z.string().trim().min(10).max(20),
    primaryContactEmail: z.string().trim().email(),
  }),
  registration: z.object({
    gstin: z.string().trim().min(15).max(15),
    taxpayerType: z.string().trim().min(1),
    registrationDate: z.string().trim().min(1),
    principalAddressLine1: z.string().trim().min(1),
    principalAddressLine2: z.string().trim().optional(),
    locality: z.string().trim().min(1),
    district: z.string().trim().min(1),
    pincode: z.string().trim().regex(/^\d{6}$/),
    stateCode: z.string().trim().regex(/^\d{2}$/),
    possessionType: z.string().trim().min(1),
    locationSource: z.enum(["manual", "browser_geolocation"]).optional(),
  }),
})

export const caRegisterSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  practiceName: z.string().trim().min(2).max(160),
  email: z.string().trim().email(),
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
})

export const identifierLoginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
})

export const lookupIdentifierSchema = z.object({
  identifier: z.string().trim().min(1),
})

export const caReferralVerifySchema = z.object({
  referralCode: z.string().trim().min(1).max(40),
  gstin: z.string().trim().min(15).max(15).optional(),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: passwordSchema,
})

export const verifyEmailSchema = z.object({
  token: z.string().min(20),
})

export const phoneTokenVerifySchema = z.object({
  idToken: z.string().min(20),
  purpose: z.enum(["login", "register"]).default("login"),
})

export type BusinessRegisterInput = z.infer<typeof businessRegisterSchema>
export type WorkspaceRegisterInput = z.infer<typeof workspaceRegisterSchema>
export type CaRegisterInput = z.infer<typeof caRegisterSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type IdentifierLoginInput = z.infer<typeof identifierLoginSchema>
export type LookupIdentifierInput = z.infer<typeof lookupIdentifierSchema>
export type CaReferralVerifyInput = z.infer<typeof caReferralVerifySchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>
export type PhoneTokenVerifyInput = z.infer<typeof phoneTokenVerifySchema>
