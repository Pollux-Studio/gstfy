import { randomBytes } from "node:crypto"

import argon2 from "argon2"
import { and, eq, inArray } from "drizzle-orm"
import type { FastifyInstance, FastifyRequest } from "fastify"
import { z } from "zod"

import { getEnv } from "../../config/env.js"
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
import { buildActionEmailHtml, MailService } from "../mail/mail.service.js"
import {
  createUserSchema,
  listUsersQuerySchema,
  type ListUsersQueryInput,
  type PermissionMapInput,
  updateUserSchema,
} from "./users.schemas.js"

const memberParamsSchema = z.object({
  memberId: z.uuid(),
})

const mailService = new MailService()

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
type TeamMemberEmailDelivery = {
  attempted: boolean
  sent: boolean
  skipped: boolean
  recipient: string | null
  reason: string | null
}

export async function registerUsersRoutes(app: FastifyInstance) {
  app.get("/users", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const query = listUsersQuerySchema.parse(request.query)

    return buildUsersResponse(
      access.business.id,
      access.business.tradeName,
      access.membership.role,
      query
    )
  })

  app.post("/users", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const body = createUserSchema.parse(request.body)
    const contact = normalizeContact(body.contact)

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
        and(
          eq(businessMembers.businessId, access.business.id),
          contact.kind === "email" ?
            eq(users.email, contact.email)
          : eq(users.phoneE164, contact.phoneE164)
        )
      )
      .limit(1)

    if (existingMember) {
      throw new HttpError(409, "This user is already part of the business.")
    }

    const userProvisioning = await findOrCreateUser(contact, body.name)
    const user = userProvisioning.user
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

    const emailDelivery = await sendProvisioningEmail({
      contact,
      businessName: access.business.tradeName,
      temporaryPassword: userProvisioning.temporaryPassword,
      request,
    })

    return {
      ...(await buildUsersResponse(
        access.business.id,
        access.business.tradeName,
        access.membership.role
      )),
      provisioning: {
        authUserId: user.id,
        identifier: contact.email ?? contact.phoneE164,
        loginMethod: contact.email ? "password" : "otp",
        temporaryPassword: userProvisioning.temporaryPassword,
        authUserCreated: userProvisioning.created,
        linkedExistingAuthUser: Boolean(
          !userProvisioning.created &&
            (user.emailVerifiedAt || user.phoneVerifiedAt || user.lastLoginAt)
        ),
        emailDelivery,
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

    await db.delete(businessMembers).where(eq(businessMembers.id, memberId))

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
  requesterRole: string,
  query?: ListUsersQueryInput
) {
  const branches = await listBranches(businessId)
  const usersList = await listBusinessUsers(businessId, branches, query)

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
  branches: Awaited<ReturnType<typeof listBranches>>,
  query: ListUsersQueryInput = listUsersQuerySchema.parse({})
) {
  const rows = await db
    .select({
      memberId: businessMembers.id,
      userId: users.id,
      email: users.email,
      phoneE164: users.phoneE164,
      fullName: users.fullName,
      profileImageSeed: users.profileImageSeed,
      profileImageStyle: users.profileImageStyle,
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

  const usersList = rows.map((row) => {
    const preset = normalizePreset(row.role, row.permissionPreset, row.designation)
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
      profileImageSeed: row.profileImageSeed,
      profileImageStyle: row.profileImageStyle,
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

  return applyUserListQuery(usersList, query)
}

function applyUserListQuery<
  TUser extends {
    name: string
    contact: string
    designation: string
    status: string
    permissionPreset: PermissionPreset
    branchIds: string[]
    branchNames: string[]
    isSystemManaged: boolean
  },
>(usersList: TUser[], query: ListUsersQueryInput) {
  const search = query.search.trim().toLowerCase()
  let result = usersList

  if (search) {
    result = result.filter((user) =>
      [
        user.name,
        user.contact,
        user.designation,
        user.status,
        user.permissionPreset,
        user.branchNames.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(search)
    )
  }

  if (query.status !== "all") {
    result = result.filter((user) => user.status === toDisplayStatus(query.status))
  }

  if (query.preset !== "all") {
    result = result.filter((user) => user.permissionPreset === query.preset)
  }

  if (query.branchId !== "all") {
    result = result.filter(
      (user) => user.isSystemManaged || user.branchIds.includes(query.branchId)
    )
  }

  return [...result].sort((firstUser, secondUser) => {
    const firstValue = getUserSortValue(firstUser, query.sortBy)
    const secondValue = getUserSortValue(secondUser, query.sortBy)
    const comparison = firstValue.localeCompare(secondValue, "en", {
      numeric: true,
      sensitivity: "base",
    })

    return query.sortDir === "asc" ? comparison : -comparison
  })
}

function getUserSortValue(
  user: {
    name: string
    contact: string
    designation: string
    status: string
    permissionPreset: PermissionPreset
    branchNames: string[]
  },
  sortBy: ListUsersQueryInput["sortBy"]
) {
  switch (sortBy) {
    case "branch":
      return user.branchNames[0] ?? ""
    case "contact":
      return user.contact
    case "designation":
      return user.designation
    case "preset":
      return user.permissionPreset
    case "status":
      return user.status
    case "name":
      return user.name
  }
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

type NormalizedContact =
  | {
      kind: "email"
      email: string
      phoneE164: null
    }
  | {
      kind: "phone"
      email: null
      phoneE164: string
    }

async function findOrCreateUser(contact: NormalizedContact, fullName: string) {
  const existingUser = await db.query.users.findFirst({
    where:
      contact.kind === "email" ?
        eq(users.email, contact.email)
      : eq(users.phoneE164, contact.phoneE164),
  })

  if (existingUser) {
    const temporaryPassword =
      contact.kind === "email" && !existingUser.passwordHash ?
        createTemporaryPassword()
      : null
    const passwordHash =
      temporaryPassword ?
        await argon2.hash(temporaryPassword, {
          type: argon2.argon2id,
        })
      : undefined

    if (!existingUser.fullName || passwordHash) {
      const [updatedUser] = await db
        .update(users)
        .set({
          fullName: existingUser.fullName || fullName,
          ...(passwordHash ? { passwordHash } : {}),
          ...(passwordHash ? { mustChangePassword: true } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning()

      return {
        user: updatedUser ?? existingUser,
        created: false,
        temporaryPassword,
      }
    }

    return {
      user: existingUser,
      created: false,
      temporaryPassword,
    }
  }

  const temporaryPassword =
    contact.kind === "email" ? createTemporaryPassword() : null
  const passwordHash =
    temporaryPassword ?
      await argon2.hash(temporaryPassword, {
        type: argon2.argon2id,
      })
    : null

  const [user] = await db
    .insert(users)
    .values({
      email: contact.email,
      phoneE164: contact.phoneE164,
      passwordHash,
      mustChangePassword: Boolean(temporaryPassword),
      fullName,
      status: "active",
      ...createProfileImage(),
    })
    .returning()

  if (!user) {
    throw new HttpError(500, "Unable to create user account.")
  }

  return {
    user,
    created: true,
    temporaryPassword,
  }
}

async function sendProvisioningEmail(input: {
  contact: NormalizedContact
  businessName: string
  temporaryPassword: string | null
  request: FastifyRequest
}): Promise<TeamMemberEmailDelivery> {
  if (input.contact.kind !== "email" || !input.temporaryPassword) {
    return {
      attempted: false,
      sent: false,
      skipped: false,
      recipient: input.contact.kind === "email" ? input.contact.email : null,
      reason:
        input.contact.kind === "phone" ?
          "Phone users sign in with OTP. No email sent."
        : "Existing email user already has login credentials.",
    }
  }

  const recipient = input.contact.email
  const loginUrl = new URL("/auth/login", getEnv().WEB_ORIGIN).toString()

  try {
    const delivery = await mailService.sendMail({
      to: recipient,
      subject: `Your GSTFY login for ${input.businessName}`,
      text: [
        `You have been added to ${input.businessName} on GSTFY.`,
        `Login email: ${recipient}`,
        `Temporary password: ${input.temporaryPassword}`,
        `Sign in: ${loginUrl}`,
        "Change this password after your first login.",
      ].join("\n\n"),
      html: buildActionEmailHtml({
        eyebrow: "GSTFY team access",
        title: `Your ${input.businessName} login is ready`,
        body: `You have been added to ${input.businessName} on GSTFY. Use login email ${recipient} and temporary password ${input.temporaryPassword}. Change this password after your first login.`,
        actionLabel: "Sign in to GSTFY",
        actionUrl: loginUrl,
        footer: "If you do not recognize this business, ignore this email.",
      }),
    })

    const emailDelivery = {
      attempted: true,
      sent: !delivery.skipped,
      skipped: delivery.skipped,
      recipient,
      reason: delivery.reason,
    }

    if (delivery.skipped) {
      input.request.log.warn({ recipient }, "Team member login email skipped")
    } else {
      input.request.log.info({ recipient }, "Team member login email sent")
    }

    return emailDelivery
  } catch (error) {
    const reason = getMailDeliveryErrorReason(error)
    input.request.log.warn(
      { err: error, recipient, reason },
      "Team member login email could not be sent"
    )

    return {
      attempted: true,
      sent: false,
      skipped: false,
      recipient,
      reason,
    }
  }
}

function createTemporaryPassword() {
  return `Gstfy@${randomBytes(6).toString("base64url").slice(0, 8)}7`
}

function getMailDeliveryErrorReason(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Email delivery failed."
  }

  const smtpError = error as {
    code?: unknown
    command?: unknown
    responseCode?: unknown
    response?: unknown
    message?: unknown
  }
  const details = [
    typeof smtpError.code === "string" ? smtpError.code : null,
    typeof smtpError.command === "string" ? smtpError.command : null,
    typeof smtpError.responseCode === "number" ? String(smtpError.responseCode) : null,
    typeof smtpError.response === "string" ? smtpError.response : null,
    typeof smtpError.message === "string" ? smtpError.message.split(/\r?\n/)[0] : null,
  ].filter(Boolean)

  return details.join(" - ") || "Email delivery failed."
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

function normalizePreset(
  role: string,
  preset: string | null,
  designation?: string | null
): PermissionPreset {
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

  const designationPreset = presetFromDesignation(designation)

  if (designationPreset) {
    return designationPreset
  }

  if (role === "cashier" || role === "accountant") {
    return role
  }

  return "custom"
}

function presetFromDesignation(designation?: string | null) {
  switch (designation?.trim().toLowerCase()) {
    case "cashier":
      return "cashier" as const
    case "branch manager":
    case "manager":
      return "manager" as const
    case "accountant":
      return "accountant" as const
    case "operations":
      return "operations" as const
    default:
      return null
  }
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

function normalizeContact(contact: string): NormalizedContact {
  const trimmedContact = contact.trim()

  if (isPhoneContact(trimmedContact)) {
    return {
      kind: "phone",
      email: null,
      phoneE164: toIndianE164(trimmedContact),
    }
  }

  return {
    kind: "email",
    email: trimmedContact.toLowerCase(),
    phoneE164: null,
  }
}

function isPhoneContact(contact: string) {
  return /^(?:\+91)?[6-9]\d{9}$/.test(contact)
}

function toIndianE164(phone: string) {
  const digits = phone.replace(/\D/g, "")
  const localNumber =
    digits.startsWith("91") && digits.length > 10 ? digits.slice(2) : digits

  return `+91${localNumber.slice(0, 10)}`
}
