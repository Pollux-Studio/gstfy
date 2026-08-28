import { and, asc, desc, eq, isNull, type SQL } from "drizzle-orm"
import type { FastifyInstance, FastifyRequest } from "fastify"

import { db } from "../../db/client.js"
import {
  businessMembers,
  businesses,
  supportTickets,
  type SupportTicketRecord,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { getTenantSlugFromRequest } from "../../utils/tenant-context.js"
import { requireAuthenticatedUser } from "../auth/auth.guard.js"
import {
  createSupportTicketSchema,
  listSupportTicketsQuerySchema,
  type ListSupportTicketsQuery,
} from "./support.schemas.js"

export async function registerSupportRoutes(app: FastifyInstance) {
  app.get("/support/tickets", async (request) => {
    const user = await requireAuthenticatedUser(request)
    const query = listSupportTicketsQuerySchema.parse(request.query)
    const businessId = await resolveSupportBusinessId(request, user.id)
    const rows = await db
      .select()
      .from(supportTickets)
      .where(
        and(
          eq(supportTickets.userId, user.id),
          eq(supportTickets.accountType, query.accountType),
          getBusinessScopeCondition(businessId)
        )
      )
      .orderBy(getSupportTicketSortExpression(query))
      .limit(query.limit)

    return {
      tickets: rows.map(toSupportTicketResponse),
    }
  })

  app.post("/support/tickets", async (request) => {
    const user = await requireAuthenticatedUser(request)
    const body = createSupportTicketSchema.parse(request.body)
    const businessId = await resolveSupportBusinessId(request, user.id)
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        businessId,
        userId: user.id,
        accountType: body.accountType,
        subject: body.subject,
        message: body.message,
        contactMethod: body.contactMethod,
        contactValue: body.contactValue?.trim() || null,
        workspaceName: body.workspaceName?.trim() || null,
        tenantUrl: body.tenantUrl?.trim() || null,
        pageUrl: body.pageUrl?.trim() || null,
        metadata: {
          userAgent: request.headers["user-agent"] ?? null,
        },
      })
      .returning()

    if (!ticket) {
      throw new HttpError(500, "Unable to create support ticket.")
    }

    return {
      ticket: toSupportTicketResponse(ticket),
    }
  })
}

function getSupportTicketSortExpression(query: ListSupportTicketsQuery) {
  const column =
    query.sortBy === "subject" ? supportTickets.subject
    : query.sortBy === "status" ? supportTickets.status
    : supportTickets.createdAt

  return query.sortDirection === "asc" ? asc(column) : desc(column)
}

function getBusinessScopeCondition(businessId: string | null): SQL {
  return businessId ?
      eq(supportTickets.businessId, businessId)
    : isNull(supportTickets.businessId)
}

async function resolveSupportBusinessId(request: FastifyRequest, userId: string) {
  const tenantSlug = getTenantSlugFromRequest(request)

  if (!tenantSlug) {
    return null
  }

  const [record] = await db
    .select({
      businessId: businesses.id,
    })
    .from(businessMembers)
    .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
    .where(
      and(
        eq(businesses.tenantSlug, tenantSlug),
        eq(businessMembers.userId, userId),
        eq(businessMembers.status, "active")
      )
    )
    .limit(1)

  return record?.businessId ?? null
}

function toSupportTicketResponse(ticket: SupportTicketRecord) {
  return {
    id: ticket.id,
    accountType: ticket.accountType,
    subject: ticket.subject,
    message: ticket.message,
    contactMethod: ticket.contactMethod,
    contactValue: ticket.contactValue,
    workspaceName: ticket.workspaceName,
    tenantUrl: ticket.tenantUrl,
    pageUrl: ticket.pageUrl,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  }
}
