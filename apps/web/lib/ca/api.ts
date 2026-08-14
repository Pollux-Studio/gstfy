import { apiRequest } from "@/lib/api/client"

export type CaPracticeRecord = {
  id: string
  name: string
  contactEmail: string | null
  contactPhone: string | null
  status: string
}

export type CaClientRecord = {
  id: string
  businessId: string
  businessName: string
  tradeName: string
  gstin: string | null
  accessScope: "gst_read_write"
  status: "active" | "revoked"
  acceptedAt: string
}

export type CaClientInviteRecord = {
  id: string
  clientName: string
  clientEmail: string | null
  clientGstin: string | null
  referralCode: string
  inviteUrl: string
  status: "pending" | "accepted" | "expired" | "revoked"
  expiresAt: string
  acceptedBusinessId: string | null
  acceptedAt: string | null
  createdAt: string
}

export type CaDashboardResponse = {
  practice: CaPracticeRecord
  clients: CaClientRecord[]
  invites: CaClientInviteRecord[]
  createdInvite?: {
    referralCode: string
    inviteUrl: string
  }
}

export type CreateCaClientPayload = {
  clientName: string
  clientEmail?: string
  clientGstin?: string
}

export type CaClientSummaryResponse = {
  business: {
    id: string
    legalName: string
    tradeName: string
    businessEmail: string | null
    primaryContactName: string
    primaryContactMobile: string
    gstin: string | null
    stateCode: string | null
    branchCount: number
  }
  accessScope: "gst_read_write"
  filingSnapshot: {
    monthlySales: number
    monthlyPurchases: number
    estimatedTaxPayable: number
    pendingFilings: string[]
  }
}

export function getCaDashboard(accessToken: string) {
  return apiRequest<CaDashboardResponse>("/ca/clients", {
    method: "GET",
    accessToken,
  })
}

export function createCaClient(
  payload: CreateCaClientPayload,
  accessToken: string
) {
  return apiRequest<CaDashboardResponse>("/ca/clients", {
    method: "POST",
    body: payload,
    accessToken,
  })
}

export function acceptCaInvite(referralCode: string, accessToken: string) {
  return apiRequest<{ success: true; linkId: string | null }>("/ca/invites/accept", {
    method: "POST",
    body: { referralCode },
    accessToken,
  })
}

export function getCaClientSummary(businessId: string, accessToken: string) {
  return apiRequest<CaClientSummaryResponse>(`/ca/clients/${businessId}/summary`, {
    method: "GET",
    accessToken,
  })
}

export function revokeCaClient(businessId: string, accessToken: string) {
  return apiRequest<CaDashboardResponse>(`/ca/clients/${businessId}/revoke`, {
    method: "POST",
    accessToken,
  })
}
