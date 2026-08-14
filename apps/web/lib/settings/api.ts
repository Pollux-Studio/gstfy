import { apiRequest } from "@/lib/api/client"

export type SettingsResponse = {
  business: {
    id: string
    legalName: string
    tradeName: string
    pan: string
    constitution: string
    businessEmail: string | null
    businessMobile: string | null
    primaryContactName: string
    primaryContactMobile: string
    primaryContactEmail: string
  }
  registration: {
    id: string
    gstin: string
    taxpayerType: string
    registrationDate: string
    principalAddressLine1: string
    principalAddressLine2: string | null
    locality: string
    district: string
    pincode: string
    stateCode: string
    possessionType: string
    locationSource: string
  }
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
  caReferral: {
    referralCode: string | null
    practiceName: string | null
    status: "linked" | "not_linked"
    linkedAt: string | null
    canAdd: boolean
  }
  invoiceSettings: {
    invoiceTemplate: "classic" | "modern" | "compact"
    invoicePrefix: string
    previewInvoiceNumber: string
  }
  gstRateSettings: {
    enabledGstSlabs: Array<5 | 12 | 18 | 28>
  }
  printerSettings: {
    paperSize: "A4" | "A5" | "THERMAL_80MM"
    printOrientation: "portrait" | "landscape"
    autoOpenPrintDialog: boolean
    compactPrintLayout: boolean
  }
  permissions: {
    canEditBusiness: boolean
    role: string
  }
}

export type UpdateBusinessDetailsPayload = {
  businessEmail?: string | null
  businessMobile?: string | null
  primaryContactName: string
  primaryContactMobile: string
  primaryContactEmail: string
  principalAddressLine1: string
  principalAddressLine2?: string | null
  locality: string
  district: string
  pincode: string
  possessionType: string
  registrationDate?: string | null
}

export type UpdateUserSettingsPayload = {
  displayName?: string | null
  locale: "en" | "ta" | "hi"
}

export type VerifyBusinessCaReferralPayload = {
  referralCode: string
}

export type ChangeUserPasswordPayload = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export type UpdateInvoiceSettingsPayload = {
  invoiceTemplate: "classic" | "modern" | "compact"
  invoicePrefix: string
}

export type UpdateGstRateSettingsPayload = {
  enabledGstSlabs: Array<5 | 12 | 18 | 28>
}

export type UpdatePrinterSettingsPayload = {
  paperSize: "A4" | "A5" | "THERMAL_80MM"
  printOrientation: "portrait" | "landscape"
  autoOpenPrintDialog: boolean
  compactPrintLayout: boolean
}

export function getSettings(accessToken: string) {
  return apiRequest<SettingsResponse>("/settings", {
    method: "GET",
    accessToken,
  })
}

export function updateBusinessDetails(
  payload: UpdateBusinessDetailsPayload,
  accessToken: string
) {
  return apiRequest<SettingsResponse>("/settings/business", {
    method: "PATCH",
    body: payload,
    accessToken,
  })
}

export function updateUserSettings(
  payload: UpdateUserSettingsPayload,
  accessToken: string
) {
  return apiRequest<SettingsResponse>("/settings/user", {
    method: "PATCH",
    body: payload,
    accessToken,
  })
}

export function verifyBusinessCaReferral(
  payload: VerifyBusinessCaReferralPayload,
  accessToken: string
) {
  return apiRequest<SettingsResponse>("/settings/business/ca-referral", {
    method: "POST",
    body: payload,
    accessToken,
  })
}

export function regenerateUserProfileImage(accessToken: string) {
  return apiRequest<SettingsResponse>("/settings/user/avatar", {
    method: "POST",
    accessToken,
  })
}

export function verifyUserPhone(idToken: string, accessToken: string) {
  return apiRequest<SettingsResponse>("/settings/user/phone/verify", {
    method: "POST",
    body: { idToken },
    accessToken,
  })
}

export function changeUserPassword(
  payload: ChangeUserPasswordPayload,
  accessToken: string
) {
  return apiRequest<{ success: true }>("/settings/user/password", {
    method: "POST",
    body: payload,
    accessToken,
  })
}

export function updateInvoiceSettings(
  payload: UpdateInvoiceSettingsPayload,
  accessToken: string
) {
  return apiRequest<SettingsResponse>("/settings/invoice", {
    method: "PATCH",
    body: payload,
    accessToken,
  })
}

export function updateGstRateSettings(
  payload: UpdateGstRateSettingsPayload,
  accessToken: string
) {
  return apiRequest<SettingsResponse>("/settings/gst-presets", {
    method: "PATCH",
    body: payload,
    accessToken,
  })
}

export function updatePrinterSettings(
  payload: UpdatePrinterSettingsPayload,
  accessToken: string
) {
  return apiRequest<SettingsResponse>("/settings/printer", {
    method: "PATCH",
    body: payload,
    accessToken,
  })
}
