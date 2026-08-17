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

export type CaInviteEmailDelivery = {
  attempted: boolean
  sent: boolean
  skipped: boolean
  recipient: string | null
  reason: string | null
}

export type CaCreatedInvite = {
  referralCode: string
  inviteUrl: string
  emailDelivery: CaInviteEmailDelivery
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export type CaDashboardResponse = {
  practice: CaPracticeRecord
  summary: {
    clientsTotal: number
    activeClientsTotal: number
    invitesTotal: number
    pendingInvitesTotal: number
    acceptedInvitesTotal: number
  }
  clientsPagination: PaginationMeta
  invitesPagination: PaginationMeta
  clients: CaClientRecord[]
  invites: CaClientInviteRecord[]
  createdInvite?: CaCreatedInvite
}

type RawCaClientRecord = Omit<CaClientRecord, "businessId"> & {
  businessId?: string | null
  business_id?: string | null
  acceptedBusinessId?: string | null
  accepted_business_id?: string | null
}

type RawCaClientInviteRecord = Omit<CaClientInviteRecord, "acceptedBusinessId"> & {
  acceptedBusinessId?: string | null
  accepted_business_id?: string | null
}

type RawCaDashboardResponse = Omit<CaDashboardResponse, "clients" | "invites"> & {
  clients: RawCaClientRecord[]
  invites: RawCaClientInviteRecord[]
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

export function getCaDashboard(
  accessToken: string,
  filters: {
    clientsPage?: number
    clientsLimit?: number
    invitesPage?: number
    invitesLimit?: number
  } = {}
) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, String(value))
    }
  }

  const query = params.size ? `?${params.toString()}` : ""

  return apiRequest<RawCaDashboardResponse>(`/ca/clients${query}`, {
    method: "GET",
    accessToken,
  }).then(normalizeCaDashboardResponse)
}

export function createCaClient(
  payload: CreateCaClientPayload,
  accessToken: string
) {
  return apiRequest<RawCaDashboardResponse>("/ca/clients", {
    method: "POST",
    body: payload,
    accessToken,
  }).then(normalizeCaDashboardResponse)
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
  return apiRequest<RawCaDashboardResponse>(`/ca/clients/${businessId}/revoke`, {
    method: "POST",
    accessToken,
  }).then(normalizeCaDashboardResponse)
}

export function getCaInviteCreationToast(invite?: CaCreatedInvite) {
  const delivery = invite?.emailDelivery

  if (!delivery?.attempted) {
    return {
      type: "success" as const,
      title: "Referral code generated.",
    }
  }

  if (delivery.sent) {
    return {
      type: "success" as const,
      title: `Invite email sent to ${delivery.recipient}.`,
    }
  }

  return {
    type: "warning" as const,
    title:
      delivery.skipped ?
        "Referral code generated, but email was skipped."
      : "Referral code generated, but email could not be sent.",
    description:
      delivery.reason ??
      "Copy the referral code or invite link and share it manually.",
  }
}

function normalizeCaDashboardResponse(response: RawCaDashboardResponse): CaDashboardResponse {
  return {
    ...response,
    clients: response.clients.map((client) => ({
      ...client,
      businessId:
        client.businessId ??
        client.business_id ??
        client.acceptedBusinessId ??
        client.accepted_business_id ??
        "",
    })),
    invites: response.invites.map((invite) => ({
      ...invite,
      acceptedBusinessId:
        invite.acceptedBusinessId ?? invite.accepted_business_id ?? null,
    })),
  }
}
