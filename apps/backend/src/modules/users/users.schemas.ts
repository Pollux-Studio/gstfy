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

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contact: z.string().trim().email(),
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

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type PermissionMapInput = z.infer<typeof permissionMapSchema>
