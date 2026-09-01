import { apiRequest } from "@/lib/api/client"
import type { PaginationMeta } from "@/lib/sales/api"

export type EInvoiceSourceDocumentType = "sales_invoice" | "credit_note" | "debit_note"
export type EInvoiceSubmissionStatus =
  | "NOT_REQUIRED"
  | "ELIGIBLE"
  | "READY"
  | "VALIDATION_FAILED"
  | "SUBMITTING"
  | "PROCESSING"
  | "IRN_GENERATED"
  | "FAILED"
  | "CANCELLATION_REQUESTED"
  | "CANCELLED"
  | "CANCELLATION_FAILED"
export type EInvoiceEligibilityStatus =
  | "ELIGIBLE"
  | "NOT_ELIGIBLE"
  | "BLOCKED"
  | "ALREADY_GENERATED"

export type EInvoiceRecord = {
  id: string
  businessId: string
  gstRegistrationId: string
  sourceDocumentType: EInvoiceSourceDocumentType
  sourceDocumentId: string
  sourceVoucherId: string | null
  sourceDocumentNumber: string
  documentDate: string
  partyId: string | null
  partyGstin: string | null
  eligibilityStatus: EInvoiceEligibilityStatus
  submissionStatus: EInvoiceSubmissionStatus
  attemptNumber: number
  providerName: string
  providerMode: string | null
  providerReference: string | null
  payloadSchemaVersion: string | null
  payloadHash: string | null
  irn: string | null
  ackNumber: string | null
  ackDate: string | null
  signedInvoiceReference: string | null
  signedQrCode: string | null
  rawResponseReference: string | null
  rawExternalResponse: unknown
  validationResult: EInvoiceValidationResult | Record<string, unknown>
  errorCode: string | null
  errorMessage: string | null
  submittedAt: string | null
  generatedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
  updatedAt: string
}

export type EInvoiceValidationIssue = {
  code: string
  message: string
  severity: "blocking" | "warning"
}

export type EInvoiceValidationResult = {
  canSubmit: boolean
  blockingIssues: EInvoiceValidationIssue[]
  warnings: EInvoiceValidationIssue[]
  payloadHash: string
  schemaVersion: string
}

export type EInvoicePayload = {
  id: string
  eInvoiceRecordId: string
  businessId: string
  payloadType: "canonical" | "provider" | "response" | "cancellation"
  schemaVersion: string
  contentHash: string
  payload: unknown
  generatedAt: string
}

export type EInvoiceStatusEvent = {
  id: string
  eInvoiceRecordId: string
  previousStatus: string | null
  status: EInvoiceSubmissionStatus
  eventType: string
  message: string | null
  providerReference: string | null
  createdAt: string
}

export type EInvoiceDetailResponse = {
  eInvoice: EInvoiceRecord
  payloads: EInvoicePayload[]
  events: EInvoiceStatusEvent[]
}

export type EInvoiceListQuery = {
  search?: string
  status?: EInvoiceSubmissionStatus | "all"
  sourceDocumentType?: EInvoiceSourceDocumentType | "all"
  gstRegistrationId?: string
  page?: number
  limit?: number
}

export type EInvoiceEligibilityResponse = {
  eligibility: {
    status: EInvoiceEligibilityStatus
    reasonCode: string
    reason: string
    warnings: EInvoiceValidationIssue[]
  }
}

export function listEInvoices(accessToken: string, query: EInvoiceListQuery = {}) {
  const params = new URLSearchParams()

  if (query.search?.trim()) {
    params.set("search", query.search.trim())
  }

  if (query.status && query.status !== "all") {
    params.set("status", query.status)
  }

  if (query.sourceDocumentType && query.sourceDocumentType !== "all") {
    params.set("sourceDocumentType", query.sourceDocumentType)
  }

  if (query.gstRegistrationId) {
    params.set("gstRegistrationId", query.gstRegistrationId)
  }

  if (query.page) {
    params.set("page", String(query.page))
  }

  if (query.limit) {
    params.set("limit", String(query.limit))
  }

  return apiRequest<{ eInvoices: EInvoiceRecord[]; pagination: PaginationMeta }>(
    `/e-invoices${params.size ? `?${params.toString()}` : ""}`,
    { method: "GET", accessToken }
  )
}

export function getEInvoice(accessToken: string, eInvoiceId: string) {
  return apiRequest<EInvoiceDetailResponse>(`/e-invoices/${eInvoiceId}`, {
    method: "GET",
    accessToken,
  })
}

export function getEInvoiceEligibility(
  accessToken: string,
  sourceDocumentType: EInvoiceSourceDocumentType,
  sourceDocumentId: string
) {
  const params = new URLSearchParams({
    sourceDocumentType,
    sourceDocumentId,
  })

  return apiRequest<EInvoiceEligibilityResponse>(`/e-invoices/eligibility?${params}`, {
    method: "GET",
    accessToken,
  })
}

export function createEInvoiceRecord(
  accessToken: string,
  payload: {
    sourceDocumentType: EInvoiceSourceDocumentType
    sourceDocumentId: string
    idempotencyKey?: string
  }
) {
  return apiRequest<{ eInvoice: EInvoiceRecord }>("/e-invoices", {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function validateEInvoice(accessToken: string, eInvoiceId: string) {
  return apiRequest<{ eInvoice: EInvoiceRecord; validation: EInvoiceValidationResult }>(
    `/e-invoices/${eInvoiceId}/validate`,
    {
      method: "POST",
      accessToken,
      body: withIdempotency(),
    }
  )
}

export function generateEInvoice(
  accessToken: string,
  eInvoiceId: string
) {
  return apiRequest<{
    eInvoice: EInvoiceRecord
    validation?: EInvoiceValidationResult
    queued?: boolean
  }>(
    `/e-invoices/${eInvoiceId}/generate`,
    {
      method: "POST",
      accessToken,
      body: withIdempotency(),
    }
  )
}

export function pollEInvoiceStatus(accessToken: string, eInvoiceId: string) {
  return apiRequest<{ eInvoice: EInvoiceRecord }>(`/e-invoices/${eInvoiceId}/status`, {
    method: "POST",
    accessToken,
    body: withIdempotency(),
  })
}

export function retryEInvoice(accessToken: string, eInvoiceId: string, reason: string) {
  return apiRequest<{ eInvoice: EInvoiceRecord; queued?: boolean }>(`/e-invoices/${eInvoiceId}/retry`, {
    method: "POST",
    accessToken,
    body: withIdempotency({ reason }),
  })
}

export function cancelEInvoice(
  accessToken: string,
  eInvoiceId: string,
  reason: string
) {
  return apiRequest<{ eInvoice: EInvoiceRecord }>(`/e-invoices/${eInvoiceId}/cancel`, {
    method: "POST",
    accessToken,
    body: withIdempotency({ reason }),
  })
}

function withIdempotency<T extends Record<string, unknown>>(payload?: T) {
  return {
    ...(payload ?? {}),
    idempotencyKey: `web-${Date.now().toString(36)}-${crypto.randomUUID()}`,
  }
}
