import argon2 from "argon2"
import { and, desc, eq, gt, ne } from "drizzle-orm"
import type { FastifyInstance, FastifyRequest } from "fastify"

import { db } from "../../db/client.js"
import {
  businesses,
  businessLocations,
  businessPreferences,
  businessProfiles,
  caBusinessLinks,
  caClientInvites,
  caPractices,
  gstRegistrations,
  sessions,
  users,
} from "../../db/schema/index.js"
import { createProfileImage } from "../../utils/avatar.js"
import { HttpError } from "../../utils/http-error.js"
import { createTenantSlug } from "../../utils/tenant-slug.js"
import { getTenantUrl } from "../../utils/tenant-url.js"
import { verifyFirebaseIdToken } from "../firebase/firebase-admin.js"
import {
  assertCanManageBusiness,
  requirePrimaryBusinessAccess,
} from "../businesses/business-access.js"
import {
  changeUserPasswordSchema,
  updateBusinessTenantSchema,
  updateBusinessSettingsSchema,
  updateGstRateSettingsSchema,
  updateInvoiceSettingsSchema,
  updatePrinterSettingsSchema,
  updateUserSettingsSchema,
  verifyCaReferralSchema,
  verifyUserPhoneSchema,
} from "./settings.schemas.js"

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get("/settings", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    return getSettingsResponse(access)
  })

  app.patch("/settings/business", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)
    const body = updateBusinessSettingsSchema.parse(request.body)
    const { tradeName } = body

    if (tradeName) {
      await db
        .update(businesses)
        .set({
          tradeName,
        })
        .where(eq(businesses.id, access.business.id))
    }

    await ensureSettingsRows(access.business.id)
    const currentProfile = await db.query.businessProfiles.findFirst({
      where: eq(businessProfiles.businessId, access.business.id),
    })
    const currentRegistration = await db.query.gstRegistrations.findFirst({
      where: eq(gstRegistrations.businessId, access.business.id),
    })
    const profilePatch = removeUndefined({
      businessEmail: body.businessEmail,
      businessMobile: body.businessMobile,
      primaryContactName: body.primaryContactName,
      primaryContactEmail: body.primaryContactEmail,
      primaryContactMobile: body.primaryContactMobile,
      addressLine1: body.principalAddressLine1 ?? body.addressLine1,
      addressLine2: body.principalAddressLine2 ?? body.addressLine2,
      locality: body.locality,
      district: body.district,
      pincode: body.pincode,
      stateCode: body.stateCode,
      possessionType: body.possessionType,
      registrationDate:
        !currentProfile?.registrationDate ? body.registrationDate : undefined,
    })

    if (Object.keys(profilePatch).length > 0) {
      await db
        .update(businessProfiles)
        .set(emptyStringsToNull(profilePatch))
        .where(eq(businessProfiles.businessId, access.business.id))
    }

    const locationPatch = removeUndefined({
      addressLine1: body.principalAddressLine1 ?? body.addressLine1,
      addressLine2: body.principalAddressLine2 ?? body.addressLine2,
      locality: body.locality,
      district: body.district,
      city: body.district,
      pincode: body.pincode,
      stateCode: body.stateCode,
    })

    if (Object.keys(locationPatch).length > 0) {
      await db
        .update(businessLocations)
        .set({
          ...emptyStringsToNull(locationPatch),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(businessLocations.businessId, access.business.id),
            eq(businessLocations.locationCode, "PRINCIPAL")
          )
        )
    }

    const registrationPatch = removeUndefined({
      tradeName,
      registrationDate:
        !currentRegistration?.registrationDate ? body.registrationDate : undefined,
      effectiveFrom:
        !currentRegistration?.effectiveFrom ? body.registrationDate : undefined,
      stateCode: body.stateCode,
    })

    if (Object.keys(registrationPatch).length > 0) {
      await db
        .update(gstRegistrations)
        .set({
          ...emptyStringsToNull(registrationPatch),
          updatedAt: new Date(),
        })
        .where(eq(gstRegistrations.businessId, access.business.id))
    }

    return getSettingsResponse(access)
  })

  app.post("/settings/business/ca-referral", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)
    const body = verifyCaReferralSchema.parse(request.body)

    await linkBusinessToCaReferral(access.business.id, body.referralCode)

    return getSettingsResponse(access)
  })

  app.patch("/settings/business/tenant", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    if (access.business.tenantSlug?.trim()) {
      throw new HttpError(409, "Workspace URL is already set for this business.")
    }

    const body = updateBusinessTenantSchema.parse(request.body)
    const tenantSlug = createTenantSlug(body.tenantSlug)

    const existingBusiness = await db.query.businesses.findFirst({
      where: and(
        eq(businesses.tenantSlug, tenantSlug),
        ne(businesses.id, access.business.id)
      ),
    })

    if (existingBusiness) {
      throw new HttpError(409, "This workspace URL is already used.")
    }

    await db
      .update(businesses)
      .set({
        tenantSlug,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, access.business.id))

    return getSettingsResponse({
      ...access,
      business: {
        ...access.business,
        tenantSlug,
      },
    })
  })

  app.patch("/settings/user", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const body = updateUserSettingsSchema.parse(request.body)
    const userPatch = removeUndefined({
      fullName: body.displayName,
      locale: body.locale,
    })

    if (Object.keys(userPatch).length > 0) {
      await db
        .update(users)
        .set({
          ...emptyStringsToNull(userPatch),
          updatedAt: new Date(),
        })
        .where(eq(users.id, access.user.id))
    }

    return getSettingsResponse({
      ...access,
      user: {
        ...access.user,
        fullName:
          body.displayName === undefined ? access.user.fullName : body.displayName,
        locale: body.locale ?? access.user.locale,
      },
    })
  })

  app.post("/settings/user/phone/verify", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const body = verifyUserPhoneSchema.parse(request.body)
    const decodedToken = await verifyFirebaseIdToken(body.idToken)
    const phoneE164 = normalizeE164Phone(decodedToken.phone_number)

    const existingUser = await db.query.users.findFirst({
      where: eq(users.phoneE164, phoneE164),
    })

    if (existingUser && existingUser.id !== access.user.id) {
      throw new HttpError(409, "This phone number is already used by another account.")
    }

    await db
      .update(users)
      .set({
        phoneE164,
        phoneVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, access.user.id))

    return getSettingsResponse({
      ...access,
      user: {
        ...access.user,
        phoneE164,
        phoneVerifiedAt: new Date(),
      },
    })
  })

  app.post("/settings/user/password", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const body = changeUserPasswordSchema.parse(request.body)

    if (!access.user.passwordHash) {
      throw new HttpError(400, "Password login is not enabled for this account.")
    }

    const currentPasswordValid = await argon2.verify(
      access.user.passwordHash,
      body.currentPassword
    )

    if (!currentPasswordValid) {
      throw new HttpError(401, "Current password is incorrect.")
    }

    const passwordHash = await argon2.hash(body.newPassword, {
      type: argon2.argon2id,
    })

    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, access.user.id))

    return {
      success: true,
    }
  })

  app.post("/settings/user/avatar", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const avatar = createProfileImage()

    await db
      .update(users)
      .set({
        ...avatar,
        updatedAt: new Date(),
      })
      .where(eq(users.id, access.user.id))

    return getSettingsResponse({
      ...access,
      user: {
        ...access.user,
        ...avatar,
      },
    })
  })

  app.patch("/settings/invoice", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)
    const body = updateInvoiceSettingsSchema.parse(request.body)
    await ensureSettingsRows(access.business.id)
    const invoicePatch = removeUndefined({
      invoiceTemplate:
        body.invoiceTemplate ? toStoredInvoiceTemplate(body.invoiceTemplate) : undefined,
      invoicePrefix: body.invoicePrefix,
      invoiceNextNumber: body.invoiceNextNumber,
    })

    await db
      .update(businessPreferences)
      .set(invoicePatch)
      .where(eq(businessPreferences.businessId, access.business.id))

    return getSettingsResponse(access)
  })

  async function updateGstPresetSettings(request: FastifyRequest) {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)
    const body = updateGstRateSettingsSchema.parse(request.body)
    await ensureSettingsRows(access.business.id)
    const gstPatch = removeUndefined({
      enabledGstSlabs: body.enabledGstSlabs?.join(","),
    })

    await db
      .update(businessPreferences)
      .set(gstPatch)
      .where(eq(businessPreferences.businessId, access.business.id))

    return getSettingsResponse(access)
  }

  app.patch("/settings/gst-rates", updateGstPresetSettings)
  app.patch("/settings/gst-presets", updateGstPresetSettings)

  app.patch("/settings/printer", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)
    const body = updatePrinterSettingsSchema.parse(request.body)
    await ensureSettingsRows(access.business.id)
    const printerPatch = removeUndefined({
      printerPaperSize:
        body.paperSize ? toStoredPaperSize(body.paperSize) : body.printerPaperSize,
      printerCopies: body.printerCopies,
      printOrientation: body.printOrientation,
      autoOpenPrintDialog: body.autoOpenPrintDialog,
      compactPrintLayout: body.compactPrintLayout,
    })

    await db
      .update(businessPreferences)
      .set(printerPatch)
      .where(eq(businessPreferences.businessId, access.business.id))

    return getSettingsResponse(access)
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

async function getSettingsResponse(
  access: Awaited<ReturnType<typeof requirePrimaryBusinessAccess>>
) {
  const settings = await getSettings(access.business.id)
  const caReferral = await getCaReferralState(access.business.id)
  const recentSessions = await db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      expiresAt: sessions.expiresAt,
      revokedAt: sessions.revokedAt,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, access.user.id))
    .orderBy(desc(sessions.createdAt))
    .limit(2)
  const profile = settings.profile
  const preferences = settings.preferences
  const invoicePrefix = preferences?.invoicePrefix ?? "INV"
  const invoiceNextNumber = preferences?.invoiceNextNumber ?? 1

  return {
    business: {
      id: access.business.id,
      tenantSlug: access.business.tenantSlug,
      tenantUrl: getTenantUrl(access.business.tenantSlug),
      legalName: access.business.legalName,
      tradeName: access.business.tradeName,
      pan: access.business.pan,
      constitution: access.business.constitution,
      businessEmail: profile?.businessEmail ?? null,
      businessMobile: profile?.businessMobile ?? null,
      primaryContactName: profile?.primaryContactName ?? access.user.fullName ?? "",
      primaryContactMobile: profile?.primaryContactMobile ?? "",
      primaryContactEmail: profile?.primaryContactEmail ?? access.user.email ?? "",
    },
    registration: {
      id: access.business.id,
      gstin: profile?.gstin ?? "",
      taxpayerType: profile?.taxpayerType ?? "regular",
      registrationDate: profile?.registrationDate ?? "",
      principalAddressLine1: profile?.addressLine1 ?? "",
      principalAddressLine2: profile?.addressLine2 ?? null,
      locality: profile?.locality ?? "",
      district: profile?.district ?? "",
      pincode: profile?.pincode ?? "",
      stateCode: profile?.stateCode ?? "",
      possessionType: profile?.possessionType ?? "rented",
      locationSource: profile?.locationSource ?? "manual",
    },
    user: {
      id: access.user.id,
      email: access.user.email,
      phoneE164: access.user.phoneE164,
      displayName: access.user.fullName,
      profileImageSeed: access.user.profileImageSeed,
      profileImageStyle: access.user.profileImageStyle,
      locale: toSupportedLocale(access.user.locale),
      lastLoginAt: access.user.lastLoginAt,
    },
    securityActivity: {
      lastLoginAt: access.user.lastLoginAt,
      recentSessions,
    },
    caReferral,
    invoiceSettings: {
      invoiceTemplate: toUiInvoiceTemplate(preferences?.invoiceTemplate),
      invoicePrefix,
      previewInvoiceNumber: `${invoicePrefix}-2026-${String(invoiceNextNumber).padStart(4, "0")}`,
    },
    gstRateSettings: {
      enabledGstSlabs: parseEnabledGstSlabs(preferences?.enabledGstSlabs),
    },
    printerSettings: {
      paperSize: toUiPaperSize(preferences?.printerPaperSize),
      printOrientation: toUiPrintOrientation(preferences?.printOrientation),
      autoOpenPrintDialog: preferences?.autoOpenPrintDialog ?? true,
      compactPrintLayout: preferences?.compactPrintLayout ?? false,
    },
    permissions: {
      canEditBusiness:
        access.membership.role === "owner" || access.membership.role === "admin",
      role: access.membership.role,
    },
  }
}

async function linkBusinessToCaReferral(businessId: string, rawReferralCode: string) {
  const existingLink = await db.query.caBusinessLinks.findFirst({
    where: and(
      eq(caBusinessLinks.businessId, businessId),
      eq(caBusinessLinks.status, "active")
    ),
  })

  if (existingLink) {
    throw new HttpError(409, "A CA referral is already linked to this business.")
  }

  const referralCode = normalizeReferralCode(rawReferralCode)
  const acceptedAt = new Date()

  await db.transaction(async (tx) => {
    const invite = await tx.query.caClientInvites.findFirst({
      where: and(
        eq(caClientInvites.referralCode, referralCode),
        eq(caClientInvites.status, "pending"),
        gt(caClientInvites.expiresAt, acceptedAt)
      ),
    })

    if (!invite) {
      throw new HttpError(400, "CA referral code is invalid or expired.")
    }

    const profile = await tx.query.businessProfiles.findFirst({
      where: eq(businessProfiles.businessId, businessId),
    })
    const businessGstin = profile?.gstin?.trim().toUpperCase() ?? ""

    if (
      invite.clientGstin &&
      businessGstin &&
      invite.clientGstin.trim().toUpperCase() !== businessGstin
    ) {
      throw new HttpError(400, "This referral code is assigned to a different GSTIN.")
    }

    await tx
      .insert(caBusinessLinks)
      .values({
        practiceId: invite.practiceId,
        businessId,
        accessScope: "gst_read_write",
        status: "active",
        acceptedAt,
      })
      .onConflictDoUpdate({
        target: [caBusinessLinks.practiceId, caBusinessLinks.businessId],
        set: {
          accessScope: "gst_read_write",
          status: "active",
          acceptedAt,
          updatedAt: acceptedAt,
        },
      })

    await tx
      .update(caClientInvites)
      .set({
        status: "accepted",
        acceptedBusinessId: businessId,
        acceptedAt,
        updatedAt: acceptedAt,
      })
      .where(eq(caClientInvites.id, invite.id))
  })
}

async function getCaReferralState(businessId: string) {
  const [link] = await db
    .select({
      practiceName: caPractices.practiceName,
      acceptedAt: caBusinessLinks.acceptedAt,
      status: caBusinessLinks.status,
      practiceId: caBusinessLinks.practiceId,
    })
    .from(caBusinessLinks)
    .innerJoin(caPractices, eq(caPractices.id, caBusinessLinks.practiceId))
    .where(
      and(
        eq(caBusinessLinks.businessId, businessId),
        eq(caBusinessLinks.status, "active")
      )
    )
    .orderBy(desc(caBusinessLinks.acceptedAt))
    .limit(1)

  if (!link) {
    return {
      referralCode: null,
      practiceName: null,
      status: "not_linked" as const,
      linkedAt: null,
      canAdd: true,
    }
  }

  const [acceptedInvite] = await db
    .select({
      referralCode: caClientInvites.referralCode,
    })
    .from(caClientInvites)
    .where(
      and(
        eq(caClientInvites.practiceId, link.practiceId),
        eq(caClientInvites.acceptedBusinessId, businessId),
        eq(caClientInvites.status, "accepted")
      )
    )
    .orderBy(desc(caClientInvites.acceptedAt))
    .limit(1)

  return {
    referralCode: acceptedInvite?.referralCode ?? null,
    practiceName: link.practiceName,
    status: "linked" as const,
    linkedAt: link.acceptedAt.toISOString(),
    canAdd: false,
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

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  )
}

function toStoredInvoiceTemplate(template: string) {
  if (template === "standard") {
    return "classic"
  }

  if (template === "thermal") {
    return "compact"
  }

  return template
}

function toUiInvoiceTemplate(template: string | null | undefined) {
  if (template === "modern") {
    return "modern"
  }

  if (template === "compact" || template === "thermal") {
    return "compact"
  }

  return "classic"
}

function parseEnabledGstSlabs(value: string | null | undefined) {
  const slabs = (value ?? "5,12,18,28")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item): item is 5 | 12 | 18 | 28 =>
      item === 5 || item === 12 || item === 18 || item === 28
    )

  return slabs.length > 0 ? slabs : [5, 12, 18, 28]
}

function toStoredPaperSize(value: "A4" | "A5" | "THERMAL_80MM") {
  if (value === "THERMAL_80MM") {
    return "thermal_80mm"
  }

  return value.toLowerCase()
}

function toUiPaperSize(value: string | null | undefined) {
  if (value === "a5") {
    return "A5"
  }

  if (value === "thermal_80mm") {
    return "THERMAL_80MM"
  }

  return "A4"
}

function toUiPrintOrientation(value: string | null | undefined) {
  return value === "landscape" ? "landscape" : "portrait"
}

function toSupportedLocale(value: string) {
  return value === "ta" || value === "hi" ? value : "en"
}

function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase()
}

function normalizeE164Phone(phoneNumber: string | undefined) {
  if (!phoneNumber || !/^\+91[6-9]\d{9}$/.test(phoneNumber)) {
    throw new HttpError(400, "Firebase token does not contain a valid Indian phone number.")
  }

  return phoneNumber
}
