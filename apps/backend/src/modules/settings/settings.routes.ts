import { eq } from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { db } from "../../db/client.js"
import {
  businesses,
  businessPreferences,
  businessProfiles,
} from "../../db/schema/index.js"
import {
  assertCanManageBusiness,
  requirePrimaryBusinessAccess,
} from "../businesses/business-access.js"
import {
  updateBusinessSettingsSchema,
  updateGstRateSettingsSchema,
  updateInvoiceSettingsSchema,
  updatePrinterSettingsSchema,
} from "./settings.schemas.js"

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get("/settings", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const settings = await getSettings(access.business.id)

    return {
      business: access.business,
      profile: settings.profile,
      preferences: settings.preferences,
    }
  })

  app.patch("/settings/business", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)
    const body = updateBusinessSettingsSchema.parse(request.body)
    const { tradeName, ...profilePatch } = body

    if (tradeName) {
      await db
        .update(businesses)
        .set({
          tradeName,
        })
        .where(eq(businesses.id, access.business.id))
    }

    await ensureSettingsRows(access.business.id)

    if (Object.keys(profilePatch).length > 0) {
      await db
        .update(businessProfiles)
        .set(emptyStringsToNull(profilePatch))
        .where(eq(businessProfiles.businessId, access.business.id))
    }

    return getSettings(access.business.id)
  })

  app.patch("/settings/invoice", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)
    const body = updateInvoiceSettingsSchema.parse(request.body)
    await ensureSettingsRows(access.business.id)
    await db
      .update(businessPreferences)
      .set(body)
      .where(eq(businessPreferences.businessId, access.business.id))

    return getSettings(access.business.id)
  })

  app.patch("/settings/gst-rates", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)
    const body = updateGstRateSettingsSchema.parse(request.body)
    await ensureSettingsRows(access.business.id)
    await db
      .update(businessPreferences)
      .set(body)
      .where(eq(businessPreferences.businessId, access.business.id))

    return getSettings(access.business.id)
  })

  app.patch("/settings/printer", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)
    const body = updatePrinterSettingsSchema.parse(request.body)
    await ensureSettingsRows(access.business.id)
    await db
      .update(businessPreferences)
      .set(body)
      .where(eq(businessPreferences.businessId, access.business.id))

    return getSettings(access.business.id)
  })
}

async function getSettings(businessId: string) {
  await ensureSettingsRows(businessId)
  const profile = await db.query.businessProfiles.findFirst({
    where: eq(businessProfiles.businessId, businessId),
  })
  const preferences = await db.query.businessPreferences.findFirst({
    where: eq(businessPreferences.businessId, businessId),
  })

  return {
    profile,
    preferences,
  }
}

async function ensureSettingsRows(businessId: string) {
  await db
    .insert(businessProfiles)
    .values({
      businessId,
    })
    .onConflictDoNothing()
  await db
    .insert(businessPreferences)
    .values({
      businessId,
    })
    .onConflictDoNothing()
}

function emptyStringsToNull<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, item === "" ? null : item])
  )
}
