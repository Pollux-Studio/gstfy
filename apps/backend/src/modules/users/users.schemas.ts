import { z } from "zod"

export const permissionSchema = z.object({
  module: z.string().trim().min(2).max(40),
  canView: z.boolean().default(false),
  canCreate: z.boolean().default(false),
  canEdit: z.boolean().default(false),
  canDelete: z.boolean().default(false),
})

export const permissionMapSchema = z.record(
  z.string().trim().min(2).max(40),
  z.object({
    view: z.boolean().default(false),
    create: z.boolean().default(false),
    edit: z.boolean().default(false),
    delete: z.boolean().default(false),
  })
)

const contactSchema = z.union([
  z.string().trim().email(),
  z.string().trim().regex(/^(?:\+91)?[6-9]\d{9}$/),
])

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contact: contactSchema,
  designation: z.string().trim().min(2).max(80),
  status: z.enum(["active", "inactive", "invited"]).default("invited"),
  permissionPreset: z
    .enum(["manager", "cashier", "accountant", "operations", "custom"])
    .default("custom"),
  branchIds: z.array(z.uuid()).default([]),
  primaryBranchId: z.uuid().optional(),
  permissions: permissionMapSchema.default({}),
})

export const updateUserSchema = createUserSchema.partial()

export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  status: z.enum(["all", "active", "inactive", "invited"]).default("all"),
  preset: z
    .enum(["all", "owner", "manager", "cashier", "accountant", "operations", "custom"])
    .default("all"),
  branchId: z.union([z.uuid(), z.literal("all")]).default("all"),
  sortBy: z.enum(["name", "contact", "designation", "status", "preset", "branch"]).default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
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

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>
export type PermissionMapInput = z.infer<typeof permissionMapSchema>
