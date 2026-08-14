import { eq } from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { db } from "../../db/client.js"
import { users } from "../../db/schema/index.js"
import { requireAuthenticatedUser } from "../auth/auth.guard.js"
import { updateAccountSchema } from "./account.schemas.js"

export async function registerAccountRoutes(app: FastifyInstance) {
  app.get("/account", async (request) => {
    const user = await requireAuthenticatedUser(request)
    const account = toAccountResponse(user)
    return {
      account,
      user: account,
    }
  })

  app.patch("/account", async (request) => {
    const user = await requireAuthenticatedUser(request)
    const body = updateAccountSchema.parse(request.body)

    const [updatedUser] = await db
      .update(users)
      .set(body)
      .where(eq(users.id, user.id))
      .returning()

    return {
      account: toAccountResponse(updatedUser ?? user),
      user: toAccountResponse(updatedUser ?? user),
    }
  })
}

function toAccountResponse(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    phoneE164: user.phoneE164,
    fullName: user.fullName,
    displayName: user.fullName,
    profileImageSeed: user.profileImageSeed,
    profileImageStyle: user.profileImageStyle,
    locale: user.locale,
    emailVerified: Boolean(user.emailVerifiedAt),
    phoneVerified: Boolean(user.phoneVerifiedAt),
    lastLoginAt: user.lastLoginAt,
  }
}
