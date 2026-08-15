import { apiRequest } from "@/lib/api/client"

export type AccountSettingsResponse = {
  user: {
    id: string
    email: string | null
    phoneE164: string | null
    displayName: string | null
    profileImageSeed: string | null
    profileImageStyle: "glyphs"
    locale: "en" | "ta" | "hi"
    lastLoginAt: string | null
  }
  securityActivity: {
    lastLoginAt: string | null
    recentSessions: Array<{
      id: string
      userAgent: string | null
      ipAddress: string | null
      expiresAt: string
      revokedAt: string | null
      createdAt: string
    }>
  }
}

export type UpdateAccountSettingsPayload = {
  displayName?: string | null
  locale: "en" | "ta" | "hi"
}

export type ChangeAccountPasswordPayload = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function getAccountSettings(accessToken: string) {
  return apiRequest<AccountSettingsResponse>("/account/settings", {
    method: "GET",
    accessToken,
  })
}

export function updateAccountSettings(
  payload: UpdateAccountSettingsPayload,
  accessToken: string
) {
  return apiRequest<AccountSettingsResponse>("/account/settings/user", {
    method: "PATCH",
    body: payload,
    accessToken,
  })
}

export function regenerateAccountProfileImage(accessToken: string) {
  return apiRequest<AccountSettingsResponse>("/account/settings/user/avatar", {
    method: "POST",
    accessToken,
  })
}

export function verifyAccountPhone(idToken: string, accessToken: string) {
  return apiRequest<AccountSettingsResponse>("/account/settings/user/phone/verify", {
    method: "POST",
    body: { idToken },
    accessToken,
  })
}

export function changeAccountPassword(
  payload: ChangeAccountPasswordPayload,
  accessToken: string
) {
  return apiRequest<{ success: true }>("/account/settings/user/password", {
    method: "POST",
    body: payload,
    accessToken,
  })
}
