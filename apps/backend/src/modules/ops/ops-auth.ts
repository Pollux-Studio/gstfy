import type { FastifyRequest } from "fastify"

import { getEnv } from "../../config/env.js"
import { HttpError } from "../../utils/http-error.js"
import { requireAuthenticatedUser } from "../auth/auth.guard.js"

export async function requireOpsAdmin(request: FastifyRequest) {
  const user = await requireAuthenticatedUser(request)
  const email = user.email?.trim().toLowerCase()
  const allowedEmails = getOpsAdminEmails()

  if (!email || !allowedEmails.has(email)) {
    throw new HttpError(403, "This operations dashboard is restricted.")
  }

  return user
}

function getOpsAdminEmails() {
  return new Set(
    getEnv()
      .OPS_ADMIN_EMAILS.split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )
}
