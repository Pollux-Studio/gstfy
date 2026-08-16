import { and, desc, eq, isNull, or } from "drizzle-orm"
import type { FastifyInstance } from "fastify"
import { z } from "zod"

import { db } from "../../db/client.js"
import { cessRules, gstRegistrations, hsnSacCodes, taxRules, uqcCodes } from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"
import { calculateTaxForBusiness } from "./tax-engine.service.js"
import { calculateTaxSchema } from "./tax.schemas.js"

const codeParamsSchema = z.object({
  code: z.string().trim().min(1).max(16),
})

export async function registerTaxRoutes(app: FastifyInstance) {
  app.get("/tax/rules", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)

    return {
      rules: await db
        .select()
        .from(taxRules)
        .where(
          and(
            or(isNull(taxRules.businessId), eq(taxRules.businessId, access.business.id)),
            eq(taxRules.status, "active")
          )
        )
        .orderBy(desc(taxRules.businessId), taxRules.transactionType, taxRules.ruleCode),
      cessRules: await db
        .select()
        .from(cessRules)
        .where(
          and(
            or(isNull(cessRules.businessId), eq(cessRules.businessId, access.business.id)),
            eq(cessRules.status, "active")
          )
        )
        .orderBy(desc(cessRules.businessId), cessRules.ruleCode),
    }
  })

  app.get("/tax/hsn/:code", async (request) => {
    await requirePrimaryBusinessAccess(request)
    const { code } = codeParamsSchema.parse(request.params)
    const row = await db.query.hsnSacCodes.findFirst({
      where: and(eq(hsnSacCodes.code, code), eq(hsnSacCodes.status, "active")),
    })

    if (!row) {
      throw new HttpError(404, "HSN/SAC code is not available in the configured tax master.")
    }

    return {
      hsnSac: row,
    }
  })

  app.get("/tax/uqc/:code", async (request) => {
    await requirePrimaryBusinessAccess(request)
    const { code } = codeParamsSchema.parse(request.params)
    const row = await db.query.uqcCodes.findFirst({
      where: and(eq(uqcCodes.code, code), eq(uqcCodes.status, "active")),
    })

    if (!row) {
      throw new HttpError(404, "UQC code is not available in the configured tax master.")
    }

    return {
      uqc: row,
    }
  })

  app.post("/tax/calculate", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const body = calculateTaxSchema.parse(request.body)
    const registration =
      body.gstRegistrationId ?
        await db.query.gstRegistrations.findFirst({
          where: and(
            eq(gstRegistrations.businessId, access.business.id),
            eq(gstRegistrations.id, body.gstRegistrationId)
          ),
        })
      : await db.query.gstRegistrations.findFirst({
          where: and(
            eq(gstRegistrations.businessId, access.business.id),
            eq(gstRegistrations.status, "active")
          ),
        })

    const sellerStateCode = body.sellerStateCode ?? registration?.stateCode

    if (!sellerStateCode) {
      throw new HttpError(400, "Seller state code is required for tax calculation.")
    }

    return {
      tax: await calculateTaxForBusiness(access.business.id, body.lines, {
        transactionDate: body.transactionDate,
        transactionType: body.transactionType,
        supplyType: body.supplyType,
        partyRegistrationType: body.partyRegistrationType,
        sellerGstin: registration?.gstin ?? null,
        sellerStateCode,
        placeOfSupplyStateCode: body.placeOfSupplyStateCode || sellerStateCode,
        reverseCharge: body.reverseCharge,
      }),
    }
  })
}
