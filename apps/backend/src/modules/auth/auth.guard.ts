import type { FastifyRequest } from "fastify"
import { jwtVerify } from "jose"

import { getEnv } from "../../config/env.js"
import { db } from "../../db/client.js"
import { users, type UserRecord } from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { eq } from "drizzle-orm"

const tokenEncoder = new TextEncoder()

export type AuthenticatedRequestUser = UserRecord

export async function requireAuthenticatedUser(request: FastifyRequest) {
  const authorization = request.headers.authorization ?? ""
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : ""

  if (!token) {
    throw new HttpError(401, "Missing access token.")
  }

  const env = getEnv()
  const { payload } = await jwtVerify(
    token,
    tokenEncoder.encode(env.JWT_ACCESS_SECRET)
  ).catch(() => {
    throw new HttpError(401, "Invalid or expired access token.")
  })

  if (!payload.sub) {
    throw new HttpError(401, "Invalid access token.")
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.sub),
  })

  if (!user || user.status !== "active") {
    throw new HttpError(401, "User account is not active.")
  }

  return user
}
