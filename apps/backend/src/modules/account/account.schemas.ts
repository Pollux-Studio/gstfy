import { z } from "zod"

export const updateAccountSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  locale: z.enum(["en", "hi", "ta"]).optional(),
})

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>
