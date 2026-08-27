import { z } from "zod"

export const feedbackCategorySchema = z.enum([
  "ease_of_use",
  "billing_pos",
  "gst_filing",
  "inventory",
  "payments",
  "performance",
  "bug",
  "feature_request",
  "other",
])

export const createFeedbackSchema = z.object({
  accountType: z.enum(["business", "ca"]),
  category: feedbackCategorySchema,
  rating: z.number().int().min(1).max(5),
  effortScore: z.number().int().min(1).max(5),
  message: z.string().trim().min(10).max(2000),
  pageUrl: z.string().trim().max(500).optional().nullable(),
  contactConsent: z.boolean().default(false),
})

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>
