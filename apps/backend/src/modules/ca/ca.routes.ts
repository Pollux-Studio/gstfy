import { randomBytes } from "node:crypto"

import { and, desc, eq, gt, sql as drizzleSql } from "drizzle-orm"
import type { FastifyInstance, FastifyRequest } from "fastify"
import { z } from "zod"

import { getEnv } from "../../config/env.js"
import { db, sql } from "../../db/client.js"
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

const paginationValueSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") {
      return undefined
    }

    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.max(Math.trunc(parsed), 1) : undefined
  })

const caDashboardQuerySchema = z.object({
  clientsPage: paginationValueSchema.default(1),
  clientsLimit: paginationValueSchema.default(15),
  invitesPage: paginationValueSchema.default(1),
  invitesLimit: paginationValueSchema.default(15),
})

const caDashboardOverviewQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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

type CaDashboardQuery = {
  clientsPage: number
  clientsLimit: number
  invitesPage: number
  invitesLimit: number
}

type CaDashboardClientRow = {
  link_id: string
  business_id: string
  business_name: string
  trade_name: string
  gstin: string | null
  access_scope: string
  accepted_at: Date | string
  sales_amount: string | null
  purchase_amount: string | null
  output_tax: string | null
  input_tax: string | null
  latest_run_id: string | null
  latest_period: string | null
  latest_status: string | null
  open_exceptions: number
  blocking_exceptions: number
}

export async function registerCaRoutes(app: FastifyInstance) {
  app.get("/ca/clients", async (request) => {
    const { practice } = await requireCaPracticeAccess(request)
    const query = caDashboardQuerySchema.parse(request.query)
    return getCaDashboardResponse(practice, normalizeDashboardQuery(query))
  })

  app.get("/ca/dashboard", async (request) => {
    const { practice } = await requireCaPracticeAccess(request)
    const query = caDashboardOverviewQuerySchema.parse(request.query)
    const period = resolveCaDashboardPeriod(query)
    const [clientRows, [inviteSummary]] = await Promise.all([
      getCaDashboardClientRows(practice.id, period.from, period.to),
      getCaInviteSummary(practice.id),
    ])

    const clients = clientRows.map((row) => {
      const salesAmount = toNumber(row.sales_amount)
      const purchaseAmount = toNumber(row.purchase_amount)
      const outputTax = toNumber(row.output_tax)
      const inputTax = toNumber(row.input_tax)
      const readinessStatus = getClientReadinessStatus(row)

      return {
        client: {
          id: row.link_id,
          businessId: row.business_id,
          businessName: row.business_name,
          tradeName: row.trade_name,
          gstin: row.gstin,
          accessScope: row.access_scope,
          status: "active" as const,
          acceptedAt: toIsoString(row.accepted_at) ?? "",
        },
        period: period.label,
        readinessStatus,
        latestReport: {
          id: row.latest_run_id,
          period: row.latest_period,
          status: row.latest_status,
        },
        salesAmount,
        purchaseAmount,
        estimatedTaxPayable: Math.max(outputTax - inputTax, 0),
        openExceptions: row.open_exceptions,
        blockingExceptions: row.blocking_exceptions,
      }
    })

    const readyClients = clients.filter((client) => client.readinessStatus === "ready")
    const needsActionClients = clients.filter(
      (client) => client.readinessStatus !== "ready"
    )

    return {
      practice: {
        id: practice.id,
        name: practice.practiceName,
        contactEmail: practice.contactEmail,
        contactPhone: practice.contactPhoneE164,
        status: practice.status,
      },
      period,
      summary: {
        clientsTotal: clientRows.length,
        activeClientsTotal: clientRows.length,
        pendingInvitesTotal: inviteSummary?.pending_invites ?? 0,
        acceptedInvitesTotal: inviteSummary?.accepted_invites ?? 0,
        readyClientsTotal: readyClients.length,
        needsActionTotal: needsActionClients.length,
        returnsDueTotal: clientRows.length * 2,
        totalSales: money(
          clients.reduce((total, client) => total + client.salesAmount, 0)
        ),
        totalPurchases: money(
          clients.reduce((total, client) => total + client.purchaseAmount, 0)
        ),
        estimatedTaxPayable: money(
          clients.reduce((total, client) => total + client.estimatedTaxPayable, 0)
        ),
      },
      deadlines: {
        gstr1: period.gstr1Due,
        gstr3b: period.gstr3bDue,
      },
      clientReadiness: clients,
    }
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

async function getCaDashboardResponse(
  practice: CaPracticeRecord,
  query: CaDashboardQuery = {
    clientsPage: 1,
    clientsLimit: 15,
    invitesPage: 1,
    invitesLimit: 15,
  }
) {
  const clientOffset = (query.clientsPage - 1) * query.clientsLimit
  const inviteOffset = (query.invitesPage - 1) * query.invitesLimit
  const [
    clientRows,
    inviteRows,
    [{ count: clientsTotal = 0 } = {}],
    [{ count: activeClientsTotal = 0 } = {}],
    [{ count: invitesTotal = 0 } = {}],
    [{ count: pendingInvitesTotal = 0 } = {}],
    [{ count: acceptedInvitesTotal = 0 } = {}],
  ] = await Promise.all([
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
      .orderBy(desc(caBusinessLinks.acceptedAt))
      .limit(query.clientsLimit)
      .offset(clientOffset),
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
      .orderBy(desc(caClientInvites.createdAt))
      .limit(query.invitesLimit)
      .offset(inviteOffset),
    db
      .select({ count: drizzleSql<number>`count(*)::int` })
      .from(caBusinessLinks)
      .where(eq(caBusinessLinks.practiceId, practice.id)),
    db
      .select({ count: drizzleSql<number>`count(*)::int` })
      .from(caBusinessLinks)
      .where(
        and(
          eq(caBusinessLinks.practiceId, practice.id),
          eq(caBusinessLinks.status, "active")
        )
      ),
    db
      .select({ count: drizzleSql<number>`count(*)::int` })
      .from(caClientInvites)
      .where(eq(caClientInvites.practiceId, practice.id)),
    db
      .select({ count: drizzleSql<number>`count(*)::int` })
      .from(caClientInvites)
      .where(
        and(
          eq(caClientInvites.practiceId, practice.id),
          eq(caClientInvites.status, "pending")
        )
      ),
    db
      .select({ count: drizzleSql<number>`count(*)::int` })
      .from(caClientInvites)
      .where(
        and(
          eq(caClientInvites.practiceId, practice.id),
          eq(caClientInvites.status, "accepted")
        )
      ),
  ])

  return {
    practice: {
      id: practice.id,
      name: practice.practiceName,
      contactEmail: practice.contactEmail,
      contactPhone: practice.contactPhoneE164,
      status: practice.status,
    },
    summary: {
      clientsTotal,
      activeClientsTotal,
      invitesTotal,
      pendingInvitesTotal,
      acceptedInvitesTotal,
    },
    clientsPagination: createPaginationMeta(
      query.clientsPage,
      query.clientsLimit,
      clientsTotal
    ),
    invitesPagination: createPaginationMeta(
      query.invitesPage,
      query.invitesLimit,
      invitesTotal
    ),
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

async function getCaDashboardClientRows(practiceId: string, from: string, to: string) {
  return sql<CaDashboardClientRow[]>`
    select
      link.id::text as link_id,
      business.id::text as business_id,
      business.legal_name as business_name,
      business.trade_name,
      profile.gstin,
      link.access_scope,
      link.accepted_at,
      coalesce((
        select sum(invoice.total_amount)
        from public.sales_invoices invoice
        where invoice.business_id = business.id
          and invoice.status = 'posted'
          and invoice.invoice_date::date between ${from}::date and ${to}::date
      ), 0)::text as sales_amount,
      coalesce((
        select sum(bill.total_amount)
        from public.purchase_bills bill
        where bill.business_id = business.id
          and bill.status = 'posted'
          and bill.invoice_date::date between ${from}::date and ${to}::date
      ), 0)::text as purchase_amount,
      coalesce((
        select sum(invoice.cgst_amount + invoice.sgst_amount + invoice.igst_amount + invoice.cess_amount)
        from public.sales_invoices invoice
        where invoice.business_id = business.id
          and invoice.status = 'posted'
          and invoice.invoice_date::date between ${from}::date and ${to}::date
      ), 0)::text as output_tax,
      coalesce((
        select sum(bill.cgst_amount + bill.sgst_amount + bill.igst_amount + bill.cess_amount)
        from public.purchase_bills bill
        where bill.business_id = business.id
          and bill.status = 'posted'
          and bill.invoice_date::date between ${from}::date and ${to}::date
      ), 0)::text as input_tax,
      latest_run.id::text as latest_run_id,
      latest_run.period as latest_period,
      latest_run.status as latest_status,
      coalesce(exception_summary.open_exceptions, 0)::int as open_exceptions,
      coalesce(exception_summary.blocking_exceptions, 0)::int as blocking_exceptions
    from public.ca_business_links link
    inner join public.businesses business
      on business.id = link.business_id
    left join public.business_profiles profile
      on profile.business_id = business.id
    left join lateral (
      select run.id, run.period, run.status, run.generated_at, run.created_at
      from public.gst_reporting_runs run
      where run.business_id = business.id
      order by coalesce(run.generated_at, run.created_at) desc
      limit 1
    ) latest_run on true
    left join lateral (
      select
        count(exception.id) filter (where exception.status = 'OPEN')::int as open_exceptions,
        count(exception.id) filter (
          where exception.status = 'OPEN'
            and exception.is_blocking = true
        )::int as blocking_exceptions
      from public.gst_reporting_exceptions exception
      where exception.business_id = business.id
        and (
          latest_run.id is null
          or exception.run_id = latest_run.id
        )
    ) exception_summary on true
    where link.practice_id = ${practiceId}
      and link.status = 'active'
    order by coalesce(exception_summary.blocking_exceptions, 0) desc,
      coalesce(exception_summary.open_exceptions, 0) desc,
      link.accepted_at desc
    limit 100
  `
}

async function getCaInviteSummary(practiceId: string) {
  return sql<{
    pending_invites: number
    accepted_invites: number
  }[]>`
    select
      count(*) filter (where status = 'pending')::int as pending_invites,
      count(*) filter (where status = 'accepted')::int as accepted_invites
    from public.ca_client_invites
    where practice_id = ${practiceId}
  `
}

function resolveCaDashboardPeriod(query: { from?: string; to?: string }) {
  const now = new Date()
  const year = now.getUTCFullYear()
  const monthIndex = now.getUTCMonth()
  const from = query.from ?? `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`
  const to =
    query.to ??
    new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10)
  const label = new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex, 1)))
  const nextMonth = new Date(Date.UTC(year, monthIndex + 1, 1))
  const nextMonthPrefix = `${nextMonth.getUTCFullYear()}-${String(
    nextMonth.getUTCMonth() + 1
  ).padStart(2, "0")}`

  return {
    from,
    to,
    label,
    gstr1Due: `${nextMonthPrefix}-11`,
    gstr3bDue: `${nextMonthPrefix}-20`,
  }
}

function getClientReadinessStatus(row: CaDashboardClientRow) {
  if (!row.gstin) {
    return "missing-gstin" as const
  }

  if (row.blocking_exceptions > 0) {
    return "blocked" as const
  }

  if (row.open_exceptions > 0) {
    return "review" as const
  }

  if (
    row.latest_status === "READY_FOR_SUBMISSION" ||
    row.latest_status === "APPROVED" ||
    row.latest_status === "FILED" ||
    row.latest_status === "LOCKED"
  ) {
    return "ready" as const
  }

  const hasData = toNumber(row.sales_amount) > 0 || toNumber(row.purchase_amount) > 0
  return hasData ? ("review" as const) : ("no-data" as const)
}

function money(value: number) {
  return Number(value.toFixed(2))
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}

function normalizeDashboardQuery(query: {
  clientsPage?: number
  clientsLimit?: number
  invitesPage?: number
  invitesLimit?: number
}): CaDashboardQuery {
  return {
    clientsPage: query.clientsPage ?? 1,
    clientsLimit: Math.min(Math.max(query.clientsLimit ?? 15, 1), 100),
    invitesPage: query.invitesPage ?? 1,
    invitesLimit: Math.min(Math.max(query.invitesLimit ?? 15, 1), 100),
  }
}

function createPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    hasMore: page * limit < total,
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
