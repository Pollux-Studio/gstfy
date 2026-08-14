import { z } from "zod"

export const permissionSchema = z.object({
  module: z.string().trim().min(2).max(40),
  canView: z.boolean().default(false),
  canCreate: z.boolean().default(false),
  canEdit: z.boolean().default(false),
  canDelete: z.boolean().default(false),
})

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  role: z.enum(["admin", "staff", "accountant", "cashier"]).default("staff"),
  status: z.enum(["active", "invited", "disabled"]).default("invited"),
  permissions: z.array(permissionSchema).default([]),
})

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  role: z.enum(["admin", "staff", "accountant", "cashier"]).optional(),
  status: z.enum(["active", "invited", "disabled"]).optional(),
  permissions: z.array(permissionSchema).optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
