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
    locale: "en" | "ta" | "hi"
  }
  invoiceSettings: {
    invoiceTemplate: "classic" | "modern" | "compact"
    invoicePrefix: string
    previewInvoiceNumber: string
  }
  gstRateSettings: {
    defaultGstSlab: 5 | 12 | 18 | 28
    enabledGstSlabs: Array<5 | 12 | 18 | 28>
    cgstRate: number
    sgstRate: number
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
}

export type UpdateUserSettingsPayload = {
  displayName?: string | null
  locale: "en" | "ta" | "hi"
  phoneE164?: string
}

export type UpdateInvoiceSettingsPayload = {
  invoiceTemplate: "classic" | "modern" | "compact"
  invoicePrefix: string
}

export type UpdateGstRateSettingsPayload = {
  defaultGstSlab: 5 | 12 | 18 | 28
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
