import { and, desc, eq, isNull, type SQL } from "drizzle-orm"
import type { FastifyInstance, FastifyRequest } from "fastify"

import { db } from "../../db/client.js"
import {
  businessMembers,
  businesses,
  userFeedback,
} from "../../db/schema/index.js"
import { getTenantSlugFromRequest } from "../../utils/tenant-context.js"
import { HttpError } from "../../utils/http-error.js"
import { requireAuthenticatedUser } from "../auth/auth.guard.js"
import { createFeedbackSchema } from "./feedback.schemas.js"

const feedbackCooldownMs = 7 * 24 * 60 * 60 * 1000

export async function registerFeedbackRoutes(app: FastifyInstance) {
  app.get("/feedback/status", async (request) => {
    const user = await requireAuthenticatedUser(request)
    const businessId = await resolveFeedbackBusinessId(request, user.id)
    const accountType = getFeedbackAccountType(request)
    const latestFeedback = await getLatestFeedback(user.id, businessId, accountType)

    return getFeedbackStatusResponse(latestFeedback)
  })

  app.post("/feedback", async (request) => {
    const user = await requireAuthenticatedUser(request)
    const body = createFeedbackSchema.parse(request.body)
    const businessId = await resolveFeedbackBusinessId(request, user.id)
    const latestFeedback = await getLatestFeedback(
      user.id,
      businessId,
      body.accountType
    )
    const nextAllowedAt = getNextAllowedAt(latestFeedback?.createdAt ?? null)

    if (nextAllowedAt && nextAllowedAt.getTime() > Date.now()) {
      throw new HttpError(409, "Feedback was already submitted recently.", {
        latestFeedback,
        nextAllowedAt: nextAllowedAt.toISOString(),
      })
    }

    const [feedback] = await db
      .insert(userFeedback)
      .values({
        businessId,
        userId: user.id,
        accountType: body.accountType,
        category: body.category,
        rating: body.rating,
        effortScore: body.effortScore,
        message: body.message,
        pageUrl: body.pageUrl?.trim() || null,
        contactConsent: body.contactConsent,
        metadata: {
          userAgent: request.headers["user-agent"] ?? null,
        },
      })
      .returning({
        id: userFeedback.id,
        status: userFeedback.status,
        createdAt: userFeedback.createdAt,
      })

    if (!feedback) {
      throw new HttpError(500, "Unable to save feedback.")
    }

    return {
      feedback,
      nextAllowedAt: getNextAllowedAt(feedback.createdAt)?.toISOString() ?? null,
    }
  })
}

async function getLatestFeedback(
  userId: string,
  businessId: string | null,
  accountType: string
) {
  const [record] = await db
    .select({
      id: userFeedback.id,
      status: userFeedback.status,
      category: userFeedback.category,
      rating: userFeedback.rating,
      effortScore: userFeedback.effortScore,
      createdAt: userFeedback.createdAt,
    })
    .from(userFeedback)
    .where(
      and(
        eq(userFeedback.userId, userId),
        eq(userFeedback.accountType, accountType),
        getBusinessScopeCondition(businessId)
      )
    )
    .orderBy(desc(userFeedback.createdAt))
    .limit(1)

  return record ?? null
}

function getFeedbackStatusResponse(
  latestFeedback: Awaited<ReturnType<typeof getLatestFeedback>>
) {
  const nextAllowedAt = getNextAllowedAt(latestFeedback?.createdAt ?? null)
  const canSubmit = !nextAllowedAt || nextAllowedAt.getTime() <= Date.now()

  return {
    canSubmit,
    latestFeedback,
    nextAllowedAt: nextAllowedAt?.toISOString() ?? null,
  }
}

function getNextAllowedAt(createdAt: Date | null) {
  if (!createdAt) {
    return null
  }

  return new Date(createdAt.getTime() + feedbackCooldownMs)
}

function getBusinessScopeCondition(businessId: string | null): SQL {
  return businessId ?
      eq(userFeedback.businessId, businessId)
    : isNull(userFeedback.businessId)
}

function getFeedbackAccountType(request: FastifyRequest) {
  const header = request.headers["x-gstfy-account-type"]
  const value = Array.isArray(header) ? header[0] : header

  return value === "ca" ? "ca" : "business"
}

async function resolveFeedbackBusinessId(request: FastifyRequest, userId: string) {
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
