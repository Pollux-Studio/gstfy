import { z } from "zod"

export const supportTicketAccountTypeSchema = z.enum(["business", "ca"])
export const supportTicketContactMethodSchema = z.enum(["email", "phone", "none"])
export const supportTicketSortBySchema = z.enum(["createdAt", "subject", "status"])
export const supportTicketSortDirectionSchema = z.enum(["asc", "desc"])

export const createSupportTicketSchema = z.object({
  accountType: supportTicketAccountTypeSchema,
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(4000),
  contactMethod: supportTicketContactMethodSchema.default("none"),
  contactValue: z.string().trim().max(255).optional().nullable(),
  workspaceName: z.string().trim().max(160).optional().nullable(),
  tenantUrl: z.string().trim().max(500).optional().nullable(),
  pageUrl: z.string().trim().max(500).optional().nullable(),
})

export const listSupportTicketsQuerySchema = z.object({
  accountType: supportTicketAccountTypeSchema.default("business"),
  sortBy: supportTicketSortBySchema.default("createdAt"),
  sortDirection: supportTicketSortDirectionSchema.default("desc"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>
export type ListSupportTicketsQuery = z.infer<typeof listSupportTicketsQuerySchema>
