import { and, asc, eq } from "drizzle-orm"
import type { FastifyInstance } from "fastify"
import { z } from "zod"

import { db } from "../../db/client.js"
import { paymentTerms } from "../../db/schema/index.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"

const paymentTermSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{2,40}$/),
  name: z.string().trim().min(2).max(80),
  days: z.number().int().min(0).max(365),
  dueDateRule: z
    .enum(["invoice_date_plus_days", "month_end_plus_days", "due_on_receipt"])
    .default("invoice_date_plus_days"),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
})

const defaultPaymentTerms = [
  { code: "immediate", name: "Due on receipt", days: 0 },
  { code: "7_days", name: "Net 7", days: 7 },
  { code: "15_days", name: "Net 15", days: 15 },
  { code: "30_days", name: "Net 30", days: 30 },
  { code: "45_days", name: "Net 45", days: 45 },
] as const

export async function registerPaymentTermsRoutes(app: FastifyInstance) {
  app.get("/payment-terms", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await ensureDefaultPaymentTerms(access.business.id)

    const rows = await db
      .select()
      .from(paymentTerms)
      .where(
        and(
          eq(paymentTerms.businessId, access.business.id),
          eq(paymentTerms.status, "active")
        )
      )
      .orderBy(asc(paymentTerms.days), asc(paymentTerms.name))

    return { paymentTerms: rows }
  })

  app.post("/payment-terms", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const body = paymentTermSchema.parse(request.body)

    const [paymentTerm] = await db
      .insert(paymentTerms)
      .values({
        businessId: access.business.id,
        code: body.code,
        name: body.name,
        days: body.days,
        dueDateRule: body.dueDateRule,
        status: body.status,
        isSystem: false,
      })
      .onConflictDoUpdate({
        target: [paymentTerms.businessId, paymentTerms.code],
        set: {
          name: body.name,
          days: body.days,
          dueDateRule: body.dueDateRule,
          status: body.status,
          updatedAt: new Date(),
        },
      })
      .returning()

    return { paymentTerm }
  })
}

async function ensureDefaultPaymentTerms(businessId: string) {
  await db
    .insert(paymentTerms)
    .values(
      defaultPaymentTerms.map((term) => ({
        businessId,
        code: term.code,
        name: term.name,
        days: term.days,
        dueDateRule: "invoice_date_plus_days",
        status: "active",
        isSystem: true,
      }))
    )
    .onConflictDoNothing()
}
