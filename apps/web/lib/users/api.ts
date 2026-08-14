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
}

export type UsersMutationResponse = UsersResponse & {
  provisioning: UserProvisioningRecord | null
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

export function getUsers(accessToken: string) {
  return apiRequest<UsersResponse>("/users", {
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
