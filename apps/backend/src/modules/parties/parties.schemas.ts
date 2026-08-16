import { z } from "zod"

export const partyTypes = ["business", "individual", "government", "other"] as const
export const partyStatuses = ["active", "inactive", "blocked", "archived"] as const
export const partyRoles = ["customer", "supplier"] as const
export const partySortFields = [
  "name",
  "role",
  "gstin",
  "pan",
  "contact",
  "status",
  "createdAt",
  "updatedAt",
] as const

const nullableTrimmed = z
  .union([z.string().trim().max(240), z.null()])
  .optional()
  .transform((value) => (value === undefined ? undefined : value || null))

const moneySchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => (value === undefined || value === "" ? "0" : String(value).trim()))
  .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/))

const optionalDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .or(z.literal(""))
  .transform((value) => (value === undefined ? undefined : value || null))

export const idParamsSchema = z.object({
  id: z.uuid(),
})

export const partyChildParamsSchema = z.object({
  id: z.uuid(),
  childId: z.uuid(),
})

export const partyGstRegistrationParamsSchema = z.object({
  id: z.uuid(),
  registrationId: z.uuid(),
})

export const partyAddressParamsSchema = z.object({
  id: z.uuid(),
  addressId: z.uuid(),
})

export const partyContactParamsSchema = z.object({
  id: z.uuid(),
  contactId: z.uuid(),
})

export const partyBankAccountParamsSchema = z.object({
  id: z.uuid(),
  bankAccountId: z.uuid(),
})

export const listPartiesQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  role: z.enum(partyRoles).optional(),
  status: z.enum(partyStatuses).optional(),
  sortBy: z.enum(partySortFields).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
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

export const customerProfileSchema = z.object({
  customerCode: z.string().trim().min(2).max(40).optional(),
  creditLimit: moneySchema.default("0"),
  creditDays: z.number().int().min(0).max(365).default(0),
  defaultPaymentTermId: z.uuid().optional().nullable(),
  defaultBillingAddressId: z.uuid().optional().nullable(),
  defaultShippingAddressId: z.uuid().optional().nullable(),
  defaultGstRegistrationId: z.uuid().optional().nullable(),
  priceGroupId: nullableTrimmed,
  salesRepId: z.uuid().optional().nullable(),
  status: z.enum(["active", "inactive", "blocked", "archived"]).default("active"),
})

export const supplierProfileSchema = z.object({
  supplierCode: z.string().trim().min(2).max(40).optional(),
  creditDays: z.number().int().min(0).max(365).default(0),
  defaultPaymentTermId: z.uuid().optional().nullable(),
  defaultPurchaseAddressId: z.uuid().optional().nullable(),
  defaultGstRegistrationId: z.uuid().optional().nullable(),
  preferredWarehouseId: z.uuid().optional().nullable(),
  leadTimeDays: z.number().int().min(0).max(365).default(0),
  status: z.enum(["active", "inactive", "blocked", "archived"]).default("active"),
})

const partyGstRegistrationBaseSchema = z.object({
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/),
    legalName: nullableTrimmed,
    tradeName: nullableTrimmed,
    registrationType: z.enum(["gst", "composition", "uin"]).default("gst"),
    taxpayerType: nullableTrimmed,
    stateCode: z.string().trim().regex(/^\d{2}$/),
    state: nullableTrimmed,
    effectiveFrom: optionalDateSchema,
    effectiveTo: optionalDateSchema,
    status: z
      .enum(["active", "inactive", "cancelled", "suspended", "archived"])
      .default("active"),
    isPrimary: z.boolean().default(false),
  })

export const partyGstRegistrationSchema = partyGstRegistrationBaseSchema
  .superRefine((value, context) => {
    if (value.gstin.slice(0, 2) !== value.stateCode) {
      context.addIssue({
        code: "custom",
        path: ["stateCode"],
        message: "State code must match the first two digits of GSTIN.",
      })
    }
  })

export const partyAddressSchema = z.object({
  addressType: z
    .enum(["registered", "billing", "shipping", "office", "warehouse", "other"])
    .default("billing"),
  label: nullableTrimmed,
  addressLine1: nullableTrimmed,
  addressLine2: nullableTrimmed,
  locality: nullableTrimmed,
  city: nullableTrimmed,
  district: nullableTrimmed,
  state: nullableTrimmed,
  stateCode: z
    .string()
    .trim()
    .regex(/^\d{2}$/)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null),
  country: z.string().trim().min(2).max(80).default("India"),
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export const partyContactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  designation: nullableTrimmed,
  email: z.string().trim().email().optional().or(z.literal("")).transform((value) => value || null),
  phone: nullableTrimmed,
  mobile: nullableTrimmed,
  contactRole: z
    .enum(["billing_contact", "sales_contact", "purchase_contact"])
    .optional()
    .nullable(),
  isPrimary: z.boolean().default(false),
  status: z.enum(["active", "inactive"]).default("active"),
})

export const partyBankAccountSchema = z.object({
  bankName: z.string().trim().min(2).max(120),
  accountName: nullableTrimmed,
  accountNumber: z.string().trim().min(4).max(34).optional(),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null),
  branch: nullableTrimmed,
  accountType: z.enum(["current", "savings", "od", "cash_credit", "other"]).optional(),
  isPrimary: z.boolean().default(false),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
})

export const createPartySchema = z.object({
  partyType: z.enum(partyTypes).default("business"),
  roles: z.array(z.enum(partyRoles)).min(1).default(["customer"]),
  displayName: z.string().trim().min(2).max(160),
  legalName: nullableTrimmed,
  tradeName: nullableTrimmed,
  shortName: nullableTrimmed,
  pan: z
    .union([
      z.string().trim().toUpperCase().regex(/^[A-Z]{5}\d{4}[A-Z]$/),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .transform((value) => value || null),
  status: z.enum(partyStatuses).default("active"),
  notes: nullableTrimmed,
  customerProfile: customerProfileSchema.optional(),
  supplierProfile: supplierProfileSchema.optional(),
  gstRegistration: partyGstRegistrationSchema.optional(),
  address: partyAddressSchema.optional(),
  contact: partyContactSchema.optional(),
  bankAccount: partyBankAccountSchema.optional(),
})

export const updatePartySchema = createPartySchema
  .omit({
    customerProfile: true,
    supplierProfile: true,
    gstRegistration: true,
    address: true,
    contact: true,
    bankAccount: true,
  })
  .partial()

export const updateCustomerProfileSchema = customerProfileSchema.partial()
export const updateSupplierProfileSchema = supplierProfileSchema.partial()
export const updatePartyGstRegistrationSchema = partyGstRegistrationBaseSchema
  .partial()
  .superRefine((value, context) => {
    if (value.gstin && value.stateCode && value.gstin.slice(0, 2) !== value.stateCode) {
      context.addIssue({
        code: "custom",
        path: ["stateCode"],
        message: "State code must match the first two digits of GSTIN.",
      })
    }
  })
export const updatePartyAddressSchema = partyAddressSchema.partial()
export const updatePartyContactSchema = partyContactSchema.partial()
export const updatePartyBankAccountSchema = partyBankAccountSchema.partial()

export type CreatePartyInput = z.infer<typeof createPartySchema>
