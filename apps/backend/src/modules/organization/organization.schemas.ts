import { z } from "zod"

const optionalTrimmed = z
  .string()
  .trim()
  .max(180)
  .optional()
  .transform((value) => value || undefined)

const nullableTrimmed = z
  .string()
  .trim()
  .max(180)
  .optional()
  .transform((value) => value || null)

export const idParamsSchema = z.object({
  id: z.uuid(),
})

export const branchWarehouseParamsSchema = z.object({
  branchId: z.uuid(),
})

export const branchWarehouseItemParamsSchema = z.object({
  branchId: z.uuid(),
  warehouseId: z.uuid(),
})

export const branchUserParamsSchema = z.object({
  branchId: z.uuid(),
})

export const branchUserItemParamsSchema = z.object({
  branchId: z.uuid(),
  memberId: z.uuid(),
})

export const createLocationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  locationCode: z.string().trim().min(2).max(24).toUpperCase(),
  addressLine1: nullableTrimmed,
  addressLine2: nullableTrimmed,
  locality: nullableTrimmed,
  district: nullableTrimmed,
  city: nullableTrimmed,
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null),
  stateCode: z
    .string()
    .trim()
    .regex(/^\d{2}$/)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null),
  state: nullableTrimmed,
  country: z.string().trim().min(2).max(80).default("India"),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
  isPrincipalPlace: z.boolean().default(false),
  isAdditionalPlace: z.boolean().default(false),
  isSalesLocation: z.boolean().default(true),
  isPurchaseLocation: z.boolean().default(true),
  isDispatchLocation: z.boolean().default(true),
  isWarehouseLocation: z.boolean().default(false),
  isOffice: z.boolean().default(false),
})

export const updateLocationSchema = createLocationSchema.partial()

export const createGstRegistrationSchema = z.object({
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/),
  legalName: z.string().trim().min(2).max(160),
  tradeName: z.string().trim().min(2).max(160),
  taxpayerType: optionalTrimmed,
  registrationType: z.enum(["gst", "composition"]).default("gst"),
  stateCode: z.string().trim().regex(/^\d{2}$/),
  state: optionalTrimmed,
  registrationDate: optionalTrimmed,
  effectiveFrom: optionalTrimmed,
  effectiveTo: optionalTrimmed,
  status: z
    .enum(["active", "inactive", "cancelled", "suspended", "archived"])
    .default("active"),
  principalLocationId: z.uuid().optional().nullable(),
})

export const updateGstRegistrationSchema = createGstRegistrationSchema.partial()

export const createBranchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  branchCode: z.string().trim().min(2).max(24).toUpperCase(),
  branchType: z.string().trim().min(2).max(60).default("retail_store"),
  locationId: z.uuid(),
  gstRegistrationId: z.uuid(),
  managerName: optionalTrimmed,
  phone: optionalTrimmed,
  email: z.string().trim().email().optional().or(z.literal("")),
  openingDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  status: z.enum(["active", "closing", "inactive", "archived"]).default("active"),
})

export const updateBranchSchema = createBranchSchema.partial()

export const createWarehouseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  warehouseCode: z.string().trim().min(2).max(24).toUpperCase(),
  locationId: z.uuid(),
  warehouseType: z
    .enum(["central", "branch", "distribution", "transit", "returns", "damaged"])
    .default("branch"),
  capacity: optionalTrimmed,
  managerName: optionalTrimmed,
  status: z.enum(["active", "inactive", "archived"]).default("active"),
})

export const updateWarehouseSchema = createWarehouseSchema.partial()

export const updateBranchWarehousesSchema = z.object({
  warehouseIds: z.array(z.uuid()).default([]),
  defaultWarehouseId: z.uuid().optional().nullable(),
})

export const createBranchWarehouseLinkSchema = z.object({
  warehouseId: z.uuid(),
  isDefault: z.boolean().default(false),
})

export const createBranchUserLinkSchema = z.object({
  memberId: z.uuid(),
  isPrimary: z.boolean().default(false),
})
