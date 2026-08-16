import argon2 from "argon2"
import { desc, eq } from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { db } from "../../db/client.js"
import { sessions, users, type UserRecord } from "../../db/schema/index.js"
import { createProfileImage } from "../../utils/avatar.js"
import { HttpError } from "../../utils/http-error.js"
import { requireAuthenticatedUser } from "../auth/auth.guard.js"
import { verifyFirebaseIdToken } from "../firebase/firebase-admin.js"
import {
  changeAccountPasswordSchema,
  completeFirstLoginPasswordSchema,
  updateAccountSchema,
  updateAccountSettingsSchema,
  verifyAccountPhoneSchema,
} from "./account.schemas.js"

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

  app.get("/account/settings", async (request) => {
    const user = await requireAuthenticatedUser(request)
    return getAccountSettingsResponse(user)
  })

  app.patch("/account/settings/user", async (request) => {
    const user = await requireAuthenticatedUser(request)
    const body = updateAccountSettingsSchema.parse(request.body)
    const userPatch = removeUndefined({
      fullName: body.displayName,
      locale: body.locale,
    })

    if (Object.keys(userPatch).length === 0) {
      return getAccountSettingsResponse(user)
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        ...emptyStringsToNull(userPatch),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning()

    return getAccountSettingsResponse(updatedUser ?? user)
  })

  app.post("/account/settings/user/phone/verify", async (request) => {
    const user = await requireAuthenticatedUser(request)
    const body = verifyAccountPhoneSchema.parse(request.body)
    const decodedToken = await verifyFirebaseIdToken(body.idToken)
    const phoneE164 = normalizeE164Phone(decodedToken.phone_number)

    const existingUser = await db.query.users.findFirst({
      where: eq(users.phoneE164, phoneE164),
    })

    if (existingUser && existingUser.id !== user.id) {
      throw new HttpError(409, "This phone number is already used by another account.")
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        phoneE164,
        phoneVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning()

    return getAccountSettingsResponse(updatedUser ?? user)
  })

  app.post("/account/settings/user/password", async (request) => {
    const user = await requireAuthenticatedUser(request)
    const body = changeAccountPasswordSchema.parse(request.body)

    if (!user.passwordHash) {
      throw new HttpError(400, "Password login is not enabled for this account.")
    }

    const currentPasswordValid = await argon2.verify(
      user.passwordHash,
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
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))

    return {
      success: true,
    }
  })

  app.post("/account/settings/user/password/first-login", async (request) => {
    const user = await requireAuthenticatedUser(request)
    const body = completeFirstLoginPasswordSchema.parse(request.body)

    if (!user.passwordHash) {
      throw new HttpError(400, "Password login is not enabled for this account.")
    }

    if (!user.mustChangePassword) {
      return {
        success: true,
        mustChangePassword: false,
      }
    }

    const passwordHash = await argon2.hash(body.newPassword, {
      type: argon2.argon2id,
    })

    await db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))

    return {
      success: true,
      mustChangePassword: false,
    }
  })

  app.post("/account/settings/user/avatar", async (request) => {
    const user = await requireAuthenticatedUser(request)
    const avatar = createProfileImage()

    const [updatedUser] = await db
      .update(users)
      .set({
        ...avatar,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning()

    return getAccountSettingsResponse(updatedUser ?? { ...user, ...avatar })
  })
}

async function getAccountSettingsResponse(user: UserRecord) {
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
    .where(eq(sessions.userId, user.id))
    .orderBy(desc(sessions.createdAt))
    .limit(2)

  return {
    user: {
      id: user.id,
      email: user.email,
      phoneE164: user.phoneE164,
      displayName: user.fullName,
      profileImageSeed: user.profileImageSeed,
      profileImageStyle: user.profileImageStyle,
      locale: toSupportedLocale(user.locale),
      lastLoginAt: user.lastLoginAt,
    },
    securityActivity: {
      lastLoginAt: user.lastLoginAt,
      recentSessions,
    },
  }
}

function toAccountResponse(user: UserRecord) {
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

function toSupportedLocale(value: string) {
  return value === "ta" || value === "hi" ? value : "en"
}

function normalizeE164Phone(phoneNumber: string | undefined) {
  if (!phoneNumber || !/^\+91[6-9]\d{9}$/.test(phoneNumber)) {
    throw new HttpError(400, "Firebase token does not contain a valid Indian phone number.")
  }

  return phoneNumber
}
