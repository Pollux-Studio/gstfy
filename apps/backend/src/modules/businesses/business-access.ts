import { and, eq } from "drizzle-orm"
import type { FastifyRequest } from "fastify"

import { db } from "../../db/client.js"
import {
  businessMembers,
  businesses,
  type BusinessMemberRecord,
  type BusinessRecord,
  type UserRecord,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { getTenantSlugFromRequest } from "../../utils/tenant-context.js"
import { requireAuthenticatedUser } from "../auth/auth.guard.js"

type BusinessAccess = {
  userId: string
  user: UserRecord
  business: BusinessRecord
  membership: BusinessMemberRecord
}

export async function requirePrimaryBusinessAccess(
  request: FastifyRequest
): Promise<BusinessAccess> {
  const user = await requireAuthenticatedUser(request)
  const tenantSlug = getTenantSlugFromRequest(request)
  const [record] = await db
    .select({
      business: businesses,
      membership: businessMembers,
    })
    .from(businessMembers)
    .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
    .where(
      and(
        eq(businessMembers.userId, user.id),
        eq(businessMembers.status, "active"),
        ...(tenantSlug ? [eq(businesses.tenantSlug, tenantSlug)] : [])
      )
    )
    .limit(1)

  if (!record) {
    throw new HttpError(404, "Business workspace not found.")
  }

  return {
    userId: user.id,
    user,
    business: record.business,
    membership: record.membership,
  }
}

export function assertCanManageBusiness(membership: BusinessMemberRecord) {
  if (membership.role !== "owner" && membership.role !== "admin") {
    throw new HttpError(403, "You do not have permission to manage this business.")
  }
}
