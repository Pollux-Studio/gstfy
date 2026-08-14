import { and, eq, inArray } from "drizzle-orm"
import type { FastifyInstance } from "fastify"
import { z } from "zod"

import { db } from "../../db/client.js"
import {
  businessMemberPermissions,
  businessMembers,
  users,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { createProfileImage } from "../../utils/avatar.js"
import {
  assertCanManageBusiness,
  requirePrimaryBusinessAccess,
} from "../businesses/business-access.js"
import {
  createUserSchema,
  permissionSchema,
  updateUserSchema,
} from "./users.schemas.js"

const memberParamsSchema = z.object({
  memberId: z.uuid(),
})

export async function registerUsersRoutes(app: FastifyInstance) {
  app.get("/users", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const members = await getBusinessUsers(access.business.id)

    return {
      users: members,
    }
  })

  app.post("/users", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const body = createUserSchema.parse(request.body)
    const email = normalizeEmail(body.email)

    const [existingMember] = await db
      .select({ id: businessMembers.id })
      .from(businessMembers)
      .innerJoin(users, eq(users.id, businessMembers.userId))
      .where(
        and(eq(businessMembers.businessId, access.business.id), eq(users.email, email))
      )
      .limit(1)

    if (existingMember) {
      throw new HttpError(409, "This user is already part of the business.")
    }

    const user = await findOrCreateUser(email, body.fullName)
    const [member] = await db
      .insert(businessMembers)
      .values({
        businessId: access.business.id,
        userId: user.id,
        role: body.role,
        status: body.status,
      })
      .returning()

    if (!member) {
      throw new HttpError(500, "Unable to add user to the business.")
    }

    await replacePermissions(member.id, body.permissions)

    return {
      user: await getBusinessUser(access.business.id, member.id),
    }
  })

  app.patch("/users/:memberId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const { memberId } = memberParamsSchema.parse(request.params)
    const body = updateUserSchema.parse(request.body)
    const member = await requireBusinessMember(access.business.id, memberId)

    if (member.role === "owner") {
      throw new HttpError(403, "Owner permissions cannot be edited.")
    }

    if (body.fullName) {
      await db
        .update(users)
        .set({
          fullName: body.fullName,
          updatedAt: new Date(),
        })
        .where(eq(users.id, member.userId))
    }

    if (body.role || body.status) {
      await db
        .update(businessMembers)
        .set({
          role: body.role ?? member.role,
          status: body.status ?? member.status,
          updatedAt: new Date(),
        })
        .where(eq(businessMembers.id, memberId))
    }

    if (body.permissions) {
      await replacePermissions(memberId, body.permissions)
    }

    return {
      user: await getBusinessUser(access.business.id, memberId),
    }
  })

  app.delete("/users/:memberId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const { memberId } = memberParamsSchema.parse(request.params)
    const member = await requireBusinessMember(access.business.id, memberId)

    if (member.role === "owner") {
      throw new HttpError(403, "Owner access cannot be removed.")
    }

    await db
      .update(businessMembers)
      .set({
        status: "disabled",
        updatedAt: new Date(),
      })
      .where(eq(businessMembers.id, memberId))

    return {
      ok: true,
    }
  })
}

async function getBusinessUsers(businessId: string) {
  const rows = await db
    .select({
      memberId: businessMembers.id,
      userId: users.id,
      email: users.email,
      phoneE164: users.phoneE164,
      fullName: users.fullName,
      role: businessMembers.role,
      status: businessMembers.status,
      createdAt: businessMembers.createdAt,
    })
    .from(businessMembers)
    .innerJoin(users, eq(users.id, businessMembers.userId))
    .where(eq(businessMembers.businessId, businessId))
    .orderBy(businessMembers.createdAt)

  const memberIds = rows.map((row) => row.memberId)
  const permissions =
    memberIds.length > 0
      ? await db
          .select()
          .from(businessMemberPermissions)
          .where(inArray(businessMemberPermissions.businessMemberId, memberIds))
      : []

  return rows.map((row) => ({
    ...row,
    permissions: permissions
      .filter((permission) => permission.businessMemberId === row.memberId)
      .map(toPermissionResponse),
  }))
}

async function getBusinessUser(businessId: string, memberId: string) {
  const [user] = await getBusinessUsers(businessId).then((rows) =>
    rows.filter((row) => row.memberId === memberId)
  )

  if (!user) {
    throw new HttpError(404, "User not found.")
  }

  return user
}

async function requireBusinessMember(businessId: string, memberId: string) {
  const member = await db.query.businessMembers.findFirst({
    where: and(eq(businessMembers.id, memberId), eq(businessMembers.businessId, businessId)),
  })

  if (!member) {
    throw new HttpError(404, "User not found.")
  }

  return member
}

async function findOrCreateUser(email: string, fullName: string) {
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  })

  if (existingUser) {
    if (!existingUser.fullName) {
      const [updatedUser] = await db
        .update(users)
        .set({
          fullName,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning()

      return updatedUser ?? existingUser
    }

    return existingUser
  }

  const [user] = await db
    .insert(users)
    .values({
      email,
      fullName,
      status: "active",
      ...createProfileImage(),
    })
    .returning()

  if (!user) {
    throw new HttpError(500, "Unable to create user account.")
  }

  return user
}

async function replacePermissions(
  businessMemberId: string,
  permissions: Array<typeof permissionSchema._output>
) {
  await db
    .delete(businessMemberPermissions)
    .where(eq(businessMemberPermissions.businessMemberId, businessMemberId))

  if (permissions.length === 0) {
    return
  }

  await db.insert(businessMemberPermissions).values(
    permissions.map((permission) => ({
      businessMemberId,
      module: permission.module,
      canView: permission.canView,
      canCreate: permission.canCreate,
      canEdit: permission.canEdit,
      canDelete: permission.canDelete,
    }))
  )
}

function toPermissionResponse(
  permission: typeof businessMemberPermissions.$inferSelect
) {
  return {
    module: permission.module,
    canView: permission.canView,
    canCreate: permission.canCreate,
    canEdit: permission.canEdit,
    canDelete: permission.canDelete,
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
