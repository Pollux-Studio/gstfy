import { and, eq, inArray } from "drizzle-orm"
import type { FastifyInstance } from "fastify"
import { z } from "zod"

import { db } from "../../db/client.js"
import {
  businessBranches,
  businessLocations,
  businessMemberBranches,
  businessMemberPermissions,
  businessMembers,
  users,
} from "../../db/schema/index.js"
import { createProfileImage } from "../../utils/avatar.js"
import { HttpError } from "../../utils/http-error.js"
import {
  assertCanManageBusiness,
  requirePrimaryBusinessAccess,
} from "../businesses/business-access.js"
import {
  createUserSchema,
  type PermissionMapInput,
  updateUserSchema,
} from "./users.schemas.js"

const memberParamsSchema = z.object({
  memberId: z.uuid(),
})

const userPresets = [
  {
    key: "manager",
    label: "Manager",
    description:
      "Operational control across branch sales, purchases, contacts, inventory, and GST workflows.",
    defaultDesignation: "Branch Manager",
    branchSelection: "required",
  },
  {
    key: "cashier",
    label: "Cashier",
    description:
      "Front-counter billing access with invoice creation and customer lookup for a specific branch.",
    defaultDesignation: "Cashier",
    branchSelection: "required",
  },
  {
    key: "accountant",
    label: "Accountant",
    description:
      "Finance and compliance access for purchases, expenses, GST returns, and reporting.",
    defaultDesignation: "Accountant",
    branchSelection: "optional",
  },
  {
    key: "operations",
    label: "Operations",
    description:
      "Stock movement and branch support access focused on inventory and inward supply operations.",
    defaultDesignation: "Operations",
    branchSelection: "required",
  },
  {
    key: "custom",
    label: "Custom",
    description: "Start with a blank permission set and assign module actions manually.",
    defaultDesignation: "Team Member",
    branchSelection: "optional",
  },
] as const

type PermissionPreset = (typeof userPresets)[number]["key"] | "owner"

export async function registerUsersRoutes(app: FastifyInstance) {
  app.get("/users", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)

    return buildUsersResponse(access.business.id, access.business.tradeName, access.membership.role)
  })

  app.post("/users", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const body = createUserSchema.parse(request.body)
    const email = normalizeEmail(body.contact)

    await validateBranchScope(
      access.business.id,
      body.permissionPreset,
      body.branchIds,
      body.primaryBranchId ?? null
    )

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

    const user = await findOrCreateUser(email, body.name)
    const [member] = await db
      .insert(businessMembers)
      .values({
        businessId: access.business.id,
        userId: user.id,
        role: roleFromPreset(body.permissionPreset),
        designation: body.designation,
        permissionPreset: body.permissionPreset,
        status: toDatabaseStatus(body.status),
      })
      .returning()

    if (!member) {
      throw new HttpError(500, "Unable to add user to the business.")
    }

    await replacePermissions(member.id, permissionMapToRows(body.permissions))
    await replaceBranchScope(member.id, body.branchIds, body.primaryBranchId ?? null)

    return {
      ...(await buildUsersResponse(
        access.business.id,
        access.business.tradeName,
        access.membership.role
      )),
      provisioning: {
        authUserId: user.id,
        identifier: email,
        loginMethod: "password",
        temporaryPassword: null,
        authUserCreated: true,
        linkedExistingAuthUser: Boolean(user.emailVerifiedAt || user.lastLoginAt),
      },
    }
  })

  app.patch("/users/:memberId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const { memberId } = memberParamsSchema.parse(request.params)
    const member = await requireBusinessMember(access.business.id, memberId)

    if (member.role === "owner") {
      throw new HttpError(403, "Owner permissions cannot be edited.")
    }

    const body = updateUserSchema.parse(request.body)
    const existingBranchScope = await getMemberBranchScope(memberId)
    const nextPreset = body.permissionPreset ?? normalizePreset(member.role, member.permissionPreset)
    const nextBranchIds = body.branchIds ?? existingBranchScope.branchIds
    const nextPrimaryBranchId =
      body.primaryBranchId === undefined ?
        existingBranchScope.primaryBranchId
      : body.primaryBranchId

    await validateBranchScope(
      access.business.id,
      nextPreset,
      nextBranchIds,
      nextPrimaryBranchId ?? null
    )

    if (body.name) {
      await db
        .update(users)
        .set({
          fullName: body.name,
          updatedAt: new Date(),
        })
        .where(eq(users.id, member.userId))
    }

    await db
      .update(businessMembers)
      .set({
        role: body.permissionPreset ? roleFromPreset(body.permissionPreset) : member.role,
        designation: body.designation ?? member.designation,
        permissionPreset: body.permissionPreset ?? member.permissionPreset,
        status: body.status ? toDatabaseStatus(body.status) : member.status,
        updatedAt: new Date(),
      })
      .where(eq(businessMembers.id, memberId))

    if (body.permissions) {
      await replacePermissions(memberId, permissionMapToRows(body.permissions))
    }

    if (body.branchIds || body.primaryBranchId !== undefined) {
      await replaceBranchScope(memberId, nextBranchIds, nextPrimaryBranchId ?? null)
    }

    return {
      ...(await buildUsersResponse(
        access.business.id,
        access.business.tradeName,
        access.membership.role
      )),
      provisioning: null,
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
      ...(await buildUsersResponse(
        access.business.id,
        access.business.tradeName,
        access.membership.role
      )),
      provisioning: null,
    }
  })
}

async function buildUsersResponse(
  businessId: string,
  businessName: string,
  requesterRole: string
) {
  const branches = await listBranches(businessId)
  const usersList = await listBusinessUsers(businessId, branches)

  return {
    meta: {
      role: requesterRole,
      canManageUsers: requesterRole === "owner" || requesterRole === "admin",
      plan: "small",
      businessName,
    },
    presets: userPresets,
    branches,
    users: usersList,
  }
}

async function listBranches(businessId: string) {
  const rows = await db
    .select({
      id: businessBranches.id,
      name: businessBranches.name,
      code: businessBranches.branchCode,
      type: businessBranches.branchType,
      stateCode: businessLocations.stateCode,
      status: businessBranches.status,
    })
    .from(businessBranches)
    .innerJoin(businessLocations, eq(businessLocations.id, businessBranches.locationId))
    .where(eq(businessBranches.businessId, businessId))

  return rows.map((branch) => ({
    id: branch.id,
    name: branch.name,
    code: branch.code,
    type: branch.type,
    stateCode: branch.stateCode ?? "",
    storageModel: "independent",
    isPrimary: branch.code === "MAIN",
    status: branch.status,
  }))
}

async function listBusinessUsers(
  businessId: string,
  branches: Awaited<ReturnType<typeof listBranches>>
) {
  const rows = await db
    .select({
      memberId: businessMembers.id,
      userId: users.id,
      email: users.email,
      phoneE164: users.phoneE164,
      fullName: users.fullName,
      role: businessMembers.role,
      designation: businessMembers.designation,
      permissionPreset: businessMembers.permissionPreset,
      status: businessMembers.status,
      createdAt: businessMembers.createdAt,
    })
    .from(businessMembers)
    .innerJoin(users, eq(users.id, businessMembers.userId))
    .where(eq(businessMembers.businessId, businessId))

  const memberIds = rows.map((row) => row.memberId)
  const permissions =
    memberIds.length > 0 ?
      await db
        .select()
        .from(businessMemberPermissions)
        .where(inArray(businessMemberPermissions.businessMemberId, memberIds))
    : []

  const branchScopes =
    memberIds.length > 0 ?
      await db
        .select({
          businessMemberId: businessMemberBranches.businessMemberId,
          branchId: businessMemberBranches.branchId,
          isPrimary: businessMemberBranches.isPrimary,
          branchName: businessBranches.name,
        })
        .from(businessMemberBranches)
        .innerJoin(
          businessBranches,
          eq(businessBranches.id, businessMemberBranches.branchId)
        )
        .where(inArray(businessMemberBranches.businessMemberId, memberIds))
    : []

  return rows.map((row) => {
    const preset = normalizePreset(row.role, row.permissionPreset)
    const memberBranchScopes = branchScopes.filter(
      (scope) => scope.businessMemberId === row.memberId
    )
    const branchIds = memberBranchScopes.map((scope) => scope.branchId)
    const primaryBranch =
      memberBranchScopes.find((scope) => scope.isPrimary) ?? memberBranchScopes[0]

    return {
      id: row.memberId,
      authUserId: row.userId,
      name: row.fullName ?? row.email ?? row.phoneE164 ?? "GSTFY user",
      contact: row.email ?? row.phoneE164 ?? "",
      designation: row.designation ?? designationFromPreset(preset),
      status: toDisplayStatus(row.status),
      permissionPreset: preset,
      permissions: toPermissionMap(
        permissions.filter((permission) => permission.businessMemberId === row.memberId)
      ),
      branchIds,
      primaryBranchId: primaryBranch?.branchId ?? null,
      branchNames:
        memberBranchScopes.length > 0 ?
          memberBranchScopes.map((scope) => scope.branchName)
        : [row.role === "owner" ? "All branches" : branches[0]?.name ?? "No branch assigned"],
      canEdit: row.role !== "owner",
      canDelete: row.role !== "owner",
      isSystemManaged: row.role === "owner",
      linkedAuthUser: true,
    }
  })
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
  permissions: Array<{
    module: string
    canView: boolean
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
  }>
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

async function replaceBranchScope(
  businessMemberId: string,
  branchIds: string[],
  primaryBranchId: string | null
) {
  const uniqueBranchIds = Array.from(new Set(branchIds))
  await db
    .delete(businessMemberBranches)
    .where(eq(businessMemberBranches.businessMemberId, businessMemberId))

  if (uniqueBranchIds.length === 0) {
    return
  }

  const primary = primaryBranchId ?? uniqueBranchIds[0]
  await db.insert(businessMemberBranches).values(
    uniqueBranchIds.map((branchId) => ({
      businessMemberId,
      branchId,
      isPrimary: branchId === primary,
    }))
  )
}

async function getMemberBranchScope(businessMemberId: string) {
  const rows = await db
    .select()
    .from(businessMemberBranches)
    .where(eq(businessMemberBranches.businessMemberId, businessMemberId))

  return {
    branchIds: rows.map((row) => row.branchId),
    primaryBranchId: rows.find((row) => row.isPrimary)?.branchId ?? rows[0]?.branchId ?? null,
  }
}

async function validateBranchScope(
  businessId: string,
  preset: PermissionPreset,
  branchIds: string[],
  primaryBranchId: string | null
) {
  const uniqueBranchIds = Array.from(new Set(branchIds))

  if (
    ["manager", "cashier", "operations"].includes(preset) &&
    uniqueBranchIds.length === 0
  ) {
    throw new HttpError(400, "Select at least one branch for this preset.")
  }

  if (primaryBranchId && !uniqueBranchIds.includes(primaryBranchId)) {
    throw new HttpError(400, "Primary branch must be one of the selected branches.")
  }

  if (uniqueBranchIds.length === 0) {
    return
  }

  const ownedBranches = await db
    .select({ id: businessBranches.id })
    .from(businessBranches)
    .where(
      and(
        eq(businessBranches.businessId, businessId),
        inArray(businessBranches.id, uniqueBranchIds)
      )
    )

  if (ownedBranches.length !== uniqueBranchIds.length) {
    throw new HttpError(400, "One or more branches do not belong to this business.")
  }
}

function permissionMapToRows(permissionMap: PermissionMapInput) {
  return Object.entries(permissionMap).map(([module, permission]) => ({
    module,
    canView: permission.view,
    canCreate: permission.create,
    canEdit: permission.edit,
    canDelete: permission.delete,
  }))
}

function toPermissionMap(
  permissions: Array<typeof businessMemberPermissions.$inferSelect>
) {
  return Object.fromEntries(
    permissions.map((permission) => [
      permission.module,
      {
        view: permission.canView,
        create: permission.canCreate,
        edit: permission.canEdit,
        delete: permission.canDelete,
      },
    ])
  )
}

function roleFromPreset(preset: Exclude<PermissionPreset, "owner">) {
  if (preset === "cashier" || preset === "accountant") {
    return preset
  }

  return "staff"
}

function normalizePreset(role: string, preset: string | null): PermissionPreset {
  if (role === "owner") {
    return "owner"
  }

  if (
    preset === "manager" ||
    preset === "cashier" ||
    preset === "accountant" ||
    preset === "operations" ||
    preset === "custom"
  ) {
    return preset
  }

  if (role === "cashier" || role === "accountant") {
    return role
  }

  return "custom"
}

function designationFromPreset(preset: PermissionPreset) {
  if (preset === "owner") {
    return "Owner"
  }

  return userPresets.find((item) => item.key === preset)?.defaultDesignation ?? "Team Member"
}

function toDatabaseStatus(status: "active" | "inactive" | "invited") {
  return status === "inactive" ? "disabled" : status
}

function toDisplayStatus(status: string) {
  if (status === "invited") {
    return "Invited"
  }

  if (status === "disabled" || status === "inactive") {
    return "Inactive"
  }

  return "Active"
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
