import { randomBytes } from "node:crypto"

import { and, desc, eq, gt } from "drizzle-orm"
import type { FastifyInstance, FastifyRequest } from "fastify"
import { z } from "zod"

import { getEnv } from "../../config/env.js"
import { db } from "../../db/client.js"
import {
  businessProfiles,
  businesses,
  caBusinessLinks,
  caClientInvites,
  caPracticeMembers,
  caPractices,
  type CaPracticeRecord,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { requireAuthenticatedUser } from "../auth/auth.guard.js"
import {
  assertCanManageBusiness,
  requirePrimaryBusinessAccess,
} from "../businesses/business-access.js"
import { buildActionEmailHtml, MailService } from "../mail/mail.service.js"

const createClientSchema = z.object({
  clientName: z.string().trim().min(2).max(180),
  clientEmail: z.string().trim().email().optional(),
  clientGstin: z.string().trim().min(15).max(15).optional(),
})

const acceptInviteSchema = z.object({
  referralCode: z.string().trim().min(4).max(40),
})

const clientParamsSchema = z.object({
  businessId: z.uuid(),
})

const inviteValidityMs = 1000 * 60 * 60 * 24 * 30
const mailService = new MailService()

type InviteEmailDelivery = {
  attempted: boolean
  sent: boolean
  skipped: boolean
  recipient: string | null
  reason: string | null
}

export async function registerCaRoutes(app: FastifyInstance) {
  app.get("/ca/clients", async (request) => {
    const { practice } = await requireCaPracticeAccess(request)
    return getCaDashboardResponse(practice)
  })

  app.post("/ca/clients", async (request) => {
    const { practice } = await requireCaPracticeAccess(request)
    const body = createClientSchema.parse(request.body)
    const referralCode = await createUniqueReferralCode()
    const expiresAt = new Date(Date.now() + inviteValidityMs)

    await db.insert(caClientInvites).values({
      practiceId: practice.id,
      clientName: body.clientName,
      clientEmail: body.clientEmail?.trim().toLowerCase() || null,
      clientGstin: body.clientGstin?.trim().toUpperCase() || null,
      referralCode,
      expiresAt,
    })

    const inviteUrl = buildInviteUrl(referralCode)
    let emailDelivery: InviteEmailDelivery = {
      attempted: false,
      sent: false,
      skipped: false,
      recipient: body.clientEmail?.trim().toLowerCase() || null,
      reason: null,
    }

    if (body.clientEmail) {
      const recipient = body.clientEmail.trim().toLowerCase()

      try {
        const delivery = await mailService.sendMail({
          to: recipient,
          subject: "Your GSTFY CA referral code",
          text: [
            `${practice.practiceName} invited you to connect your GSTFY business workspace.`,
            `Referral code: ${referralCode}`,
            `Register here: ${inviteUrl}`,
          ].join("\n\n"),
          html: buildActionEmailHtml({
            eyebrow: "CA client invite",
            title: "Register and connect your GSTFY workspace",
            body: `${practice.practiceName} invited you to register your GSTFY business workspace for GST filing access. Your referral code is ${referralCode} and will be prefilled from this link.`,
            actionLabel: "Register and connect",
            actionUrl: inviteUrl,
            footer: "Only use this invite if you recognize this CA or accountant.",
          }),
        })

        emailDelivery = {
          attempted: true,
          sent: !delivery.skipped,
          skipped: delivery.skipped,
          recipient,
          reason: delivery.reason,
        }

        if (delivery.skipped) {
          request.log.warn({ recipient }, "CA invite email skipped")
        } else {
          request.log.info({ recipient }, "CA invite email sent")
        }
      } catch (error) {
        emailDelivery = {
          attempted: true,
          sent: false,
          skipped: false,
          recipient,
          reason: getMailDeliveryErrorReason(error),
        }
        request.log.warn(
          { err: error, recipient, reason: emailDelivery.reason },
          "CA invite email could not be sent"
        )
      }
    }

    return {
      ...(await getCaDashboardResponse(practice)),
      createdInvite: {
        referralCode,
        inviteUrl,
        emailDelivery,
      },
    }
  })

  app.post("/ca/invites/accept", async (request) => {
    const { business, membership } = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(membership)
    const body = acceptInviteSchema.parse(request.body)
    const referralCode = normalizeReferralCode(body.referralCode)
    const acceptedAt = new Date()

    const link = await db.transaction(async (tx) => {
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

      const [linkedBusiness] = await tx
        .insert(caBusinessLinks)
        .values({
          practiceId: invite.practiceId,
          businessId: business.id,
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
        .returning()

      await tx
        .update(caClientInvites)
        .set({
          status: "accepted",
          acceptedBusinessId: business.id,
          acceptedAt,
          updatedAt: acceptedAt,
        })
        .where(eq(caClientInvites.id, invite.id))

      return linkedBusiness ?? null
    })

    return {
      success: true,
      linkId: link?.id ?? null,
    }
  })

  app.get("/ca/clients/:businessId/summary", async (request) => {
    const { practice } = await requireCaPracticeAccess(request)
    const params = clientParamsSchema.parse(request.params)
    const [record] = await db
      .select({
        link: caBusinessLinks,
        business: businesses,
        profile: businessProfiles,
      })
      .from(caBusinessLinks)
      .innerJoin(businesses, eq(businesses.id, caBusinessLinks.businessId))
      .leftJoin(businessProfiles, eq(businessProfiles.businessId, businesses.id))
      .where(
        and(
          eq(caBusinessLinks.practiceId, practice.id),
          eq(caBusinessLinks.businessId, params.businessId),
          eq(caBusinessLinks.status, "active")
        )
      )
      .limit(1)

    if (!record) {
      throw new HttpError(404, "Client workspace not found.")
    }

    return {
      business: {
        id: record.business.id,
        legalName: record.business.legalName,
        tradeName: record.business.tradeName,
        businessEmail: record.profile?.businessEmail ?? null,
        primaryContactName: record.profile?.primaryContactName ?? "",
        primaryContactMobile: record.profile?.primaryContactMobile ?? "",
        gstin: record.profile?.gstin ?? null,
        stateCode: record.profile?.stateCode ?? null,
        branchCount: 1,
      },
      accessScope: "gst_read_write" as const,
      filingSnapshot: {
        monthlySales: 0,
        monthlyPurchases: 0,
        estimatedTaxPayable: 0,
        pendingFilings: ["GSTR-1", "GSTR-3B"],
      },
    }
  })

  app.post("/ca/clients/:businessId/revoke", async (request) => {
    const { practice } = await requireCaPracticeAccess(request)
    const params = clientParamsSchema.parse(request.params)
    const now = new Date()
    const [link] = await db
      .update(caBusinessLinks)
      .set({
        status: "revoked",
        updatedAt: now,
      })
      .where(
        and(
          eq(caBusinessLinks.practiceId, practice.id),
          eq(caBusinessLinks.businessId, params.businessId),
          eq(caBusinessLinks.status, "active")
        )
      )
      .returning()

    if (!link) {
      throw new HttpError(404, "Client workspace not found.")
    }

    return getCaDashboardResponse(practice)
  })
}

async function requireCaPracticeAccess(request: FastifyRequest) {
  const user = await requireAuthenticatedUser(request)
  const [record] = await db
    .select({
      practice: caPractices,
      membership: caPracticeMembers,
    })
    .from(caPracticeMembers)
    .innerJoin(caPractices, eq(caPractices.id, caPracticeMembers.practiceId))
    .where(
      and(
        eq(caPracticeMembers.userId, user.id),
        eq(caPracticeMembers.status, "active"),
        eq(caPractices.status, "active")
      )
    )
    .limit(1)

  if (!record) {
    throw new HttpError(403, "CA workspace not found.")
  }

  return {
    user,
    practice: record.practice,
    membership: record.membership,
  }
}

async function getCaDashboardResponse(practice: CaPracticeRecord) {
  const [clientRows, inviteRows] = await Promise.all([
    db
      .select({
        id: caBusinessLinks.id,
        businessId: businesses.id,
        businessName: businesses.legalName,
        tradeName: businesses.tradeName,
        gstin: businessProfiles.gstin,
        accessScope: caBusinessLinks.accessScope,
        status: caBusinessLinks.status,
        acceptedAt: caBusinessLinks.acceptedAt,
      })
      .from(caBusinessLinks)
      .innerJoin(businesses, eq(businesses.id, caBusinessLinks.businessId))
      .leftJoin(businessProfiles, eq(businessProfiles.businessId, businesses.id))
      .where(eq(caBusinessLinks.practiceId, practice.id))
      .orderBy(desc(caBusinessLinks.acceptedAt)),
    db
      .select({
        id: caClientInvites.id,
        clientName: caClientInvites.clientName,
        clientEmail: caClientInvites.clientEmail,
        clientGstin: caClientInvites.clientGstin,
        referralCode: caClientInvites.referralCode,
        status: caClientInvites.status,
        expiresAt: caClientInvites.expiresAt,
        acceptedBusinessId: caClientInvites.acceptedBusinessId,
        acceptedAt: caClientInvites.acceptedAt,
        createdAt: caClientInvites.createdAt,
      })
      .from(caClientInvites)
      .where(eq(caClientInvites.practiceId, practice.id))
      .orderBy(desc(caClientInvites.createdAt)),
  ])

  return {
    practice: {
      id: practice.id,
      name: practice.practiceName,
      contactEmail: practice.contactEmail,
      contactPhone: practice.contactPhoneE164,
      status: practice.status,
    },
    clients: clientRows.map((client) => ({
      id: client.id,
      businessId: client.businessId,
      businessName: client.businessName,
      tradeName: client.tradeName,
      gstin: client.gstin,
      accessScope: "gst_read_write" as const,
      status: client.status === "revoked" ? ("revoked" as const) : ("active" as const),
      acceptedAt: client.acceptedAt.toISOString(),
    })),
    invites: inviteRows.map((invite) => ({
      id: invite.id,
      clientName: invite.clientName,
      clientEmail: invite.clientEmail,
      clientGstin: invite.clientGstin,
      referralCode: invite.referralCode,
      inviteUrl: buildInviteUrl(invite.referralCode),
      status: getInviteStatus(invite.status, invite.expiresAt),
      expiresAt: invite.expiresAt.toISOString(),
      acceptedBusinessId: invite.acceptedBusinessId,
      acceptedAt: invite.acceptedAt?.toISOString() ?? null,
      createdAt: invite.createdAt.toISOString(),
    })),
  }
}

async function createUniqueReferralCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const referralCode = `GSTFY-${randomBytes(4).toString("hex").toUpperCase()}`
    const existingInvite = await db.query.caClientInvites.findFirst({
      where: eq(caClientInvites.referralCode, referralCode),
    })

    if (!existingInvite) {
      return referralCode
    }
  }

  throw new HttpError(500, "Unable to generate referral code.")
}

function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase()
}

function buildInviteUrl(referralCode: string) {
  const inviteUrl = new URL("/auth/register", getEnv().WEB_ORIGIN)
  inviteUrl.searchParams.set("referralCode", referralCode)

  return inviteUrl.toString()
}

function getInviteStatus(status: string, expiresAt: Date) {
  if (status === "pending" && expiresAt.getTime() <= Date.now()) {
    return "expired" as const
  }

  if (status === "accepted") {
    return "accepted" as const
  }

  if (status === "revoked") {
    return "revoked" as const
  }

  return "pending" as const
}

function getMailDeliveryErrorReason(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Email delivery failed."
  }

  const smtpError = error as {
    code?: unknown
    command?: unknown
    responseCode?: unknown
    response?: unknown
    message?: unknown
  }
  const details = [
    typeof smtpError.code === "string" ? smtpError.code : null,
    typeof smtpError.command === "string" ? smtpError.command : null,
    typeof smtpError.responseCode === "number" ? String(smtpError.responseCode) : null,
    typeof smtpError.response === "string" ? smtpError.response : null,
    typeof smtpError.message === "string" ? smtpError.message.split(/\r?\n/)[0] : null,
  ].filter(Boolean)

  return details.join(" - ") || "Email delivery failed."
}
