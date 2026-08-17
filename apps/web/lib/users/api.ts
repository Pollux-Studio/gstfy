import { apiRequest } from "@/lib/api/client"
import type {
  PermissionActionKey,
  PermissionModuleKey,
} from "@/lib/dashboard/modules"

export type UserStatus = "Active" | "Inactive" | "Invited"
export type UserStatusValue = "active" | "inactive" | "invited"
export type PermissionPresetKey =
  | "owner"
  | "manager"
  | "cashier"
  | "accountant"
  | "operations"
  | "custom"

export type ModulePermissionState = Record<PermissionActionKey, boolean>
export type UserPermissionMap = Partial<
  Record<PermissionModuleKey, ModulePermissionState>
>

export type UserRecord = {
  id: string
  authUserId: string | null
  name: string
  contact: string
  profileImageSeed: string | null
  profileImageStyle: string | null
  designation: string
  status: UserStatus
  permissionPreset: PermissionPresetKey
  permissions: UserPermissionMap
  branchIds: string[]
  primaryBranchId: string | null
  branchNames: string[]
  canEdit: boolean
  canDelete: boolean
  isSystemManaged: boolean
  linkedAuthUser: boolean
}

export type UserBranchRecord = {
  id: string
  name: string
  code: string
  type: string
  stateCode: string
  storageModel: string
  isPrimary: boolean
  status: string
}

export type UserPresetRecord = {
  key: Exclude<PermissionPresetKey, "owner">
  label: string
  description: string
  defaultDesignation: string
  branchSelection: "required" | "optional"
}

export type UserProvisioningRecord = {
  authUserId: string
  identifier: string
  loginMethod: "password" | "otp"
  temporaryPassword: string | null
  authUserCreated: boolean
  linkedExistingAuthUser: boolean
  emailDelivery?: {
    attempted: boolean
    sent: boolean
    skipped: boolean
    recipient: string | null
    reason: string | null
  }
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export type UsersResponse = {
  meta: {
    role: string
    canManageUsers: boolean
    plan: string
    businessName: string
  }
  presets: UserPresetRecord[]
  branches: UserBranchRecord[]
  users: UserRecord[]
  pagination: PaginationMeta
}

export type UsersMutationResponse = UsersResponse & {
  provisioning: UserProvisioningRecord | null
}

export type UsersQueryParams = {
  search?: string
  status?: UserStatusValue
  preset?: PermissionPresetKey
  branchId?: string
  sortBy?: "name" | "contact" | "designation" | "status" | "preset" | "branch"
  sortDir?: "asc" | "desc"
  page?: number
  limit?: number
}

export type UpsertUserPayload = {
  name: string
  contact: string
  designation: string
  status: UserStatusValue
  permissionPreset: Exclude<PermissionPresetKey, "owner">
  branchIds: string[]
  primaryBranchId?: string
  permissions?: UserPermissionMap
}

export function getUsers(accessToken: string, query?: UsersQueryParams) {
  const searchParams = new URLSearchParams()

  if (query?.search) {
    searchParams.set("search", query.search)
  }

  if (query?.status) {
    searchParams.set("status", query.status)
  }

  if (query?.preset) {
    searchParams.set("preset", query.preset)
  }

  if (query?.branchId) {
    searchParams.set("branchId", query.branchId)
  }

  if (query?.sortBy) {
    searchParams.set("sortBy", query.sortBy)
  }

  if (query?.sortDir) {
    searchParams.set("sortDir", query.sortDir)
  }

  if (query?.page) {
    searchParams.set("page", String(query.page))
  }

  if (query?.limit) {
    searchParams.set("limit", String(query.limit))
  }

  const queryString = searchParams.toString()

  return apiRequest<UsersResponse>(`/users${queryString ? `?${queryString}` : ""}`, {
    method: "GET",
    accessToken,
  })
}

export function createUser(payload: UpsertUserPayload, accessToken: string) {
  return apiRequest<UsersMutationResponse>("/users", {
    method: "POST",
    body: payload,
    accessToken,
  })
}

export function updateUser(
  userId: string,
  payload: UpsertUserPayload,
  accessToken: string
) {
  return apiRequest<UsersMutationResponse>(`/users/${userId}`, {
    method: "PATCH",
    body: payload,
    accessToken,
  })
}

export function deleteUser(userId: string, accessToken: string) {
  return apiRequest<UsersMutationResponse>(`/users/${userId}`, {
    method: "DELETE",
    accessToken,
  })
}
