import { and, eq, type SQL } from "drizzle-orm"

import { db } from "../../db/client.js"
import {
  businessMembers,
  businesses,
  users,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import type { BusinessAccess } from "../businesses/business-access.js"

export async function resolveAutomationBusinessAccess(
  businessId: string,
  preferredUserId: string | null | undefined
): Promise<BusinessAccess> {
  const membershipConditions = [
    eq(businessMembers.businessId, businessId),
    eq(businessMembers.status, "active"),
  ]

  if (preferredUserId) {
    const access = await findAccess([
      ...membershipConditions,
      eq(businessMembers.userId, preferredUserId),
    ])

    if (access) {
      return access
    }
  }

  const ownerAccess = await findAccess([
    ...membershipConditions,
    eq(businessMembers.role, "owner"),
  ])

  if (ownerAccess) {
    return ownerAccess
  }

  throw new HttpError(404, "No active business owner found for automation.")
}

async function findAccess(conditions: SQL[]) {
  const [record] = await db
    .select({
      business: businesses,
      membership: businessMembers,
      user: users,
    })
    .from(businessMembers)
    .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
    .innerJoin(users, eq(users.id, businessMembers.userId))
    .where(and(...conditions))
    .limit(1)

  if (!record) {
    return null
  }

  return {
    userId: record.user.id,
    user: record.user,
    business: record.business,
    membership: record.membership,
  }
}
