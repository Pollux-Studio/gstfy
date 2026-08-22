import { apiRequest } from "@/lib/api/client"

export type GstFilingReturnType = "GSTR1" | "GSTR3B"
export type GstFilingStatus =
  | "DRAFT"
  | "VALIDATED"
  | "READY_FOR_SUBMISSION"
  | "SUBMITTING"
  | "SUBMITTED"
  | "PROCESSING"
  | "ACCEPTED"
  | "FILED"
  | "REJECTED"
  | "FAILED"
  | "CANCELLED"
export type GstFilingMockMode =
  | "MOCK_ACCEPT"
  | "MOCK_REJECT"
  | "MOCK_PROCESSING"
  | "MOCK_TIMEOUT"

export type GstFilingValidationIssue = {
  code: string
  message: string
  severity: "blocking" | "warning"
}

export type GstFilingValidationResult = {
  canSubmit: boolean
  blockingIssues: GstFilingValidationIssue[]
  warnings: GstFilingValidationIssue[]
  payloadHash: string
  schemaVersion: string
}

export type GstFilingRun = {
  id: string
  businessId: string
  gstRegistrationId: string
  reportingRunId: string
  returnType: GstFilingReturnType
  period: string
  status: GstFilingStatus
  attemptNumber: number
  adapterName: string
  adapterMode: GstFilingMockMode | null
  schemaVersion: string | null
  payloadHash: string | null
  validationResult: GstFilingValidationResult | null
  externalReference: string | null
  acknowledgementNumber: string | null
  acknowledgementDate: string | null
  submittedAt: string | null
  acceptedAt: string | null
  filedAt: string | null
  rejectedAt: string | null
  failedAt: string | null
  cancelledAt: string | null
  lastPolledAt: string | null
  errorCode: string | null
  errorMessage: string | null
  externalResponseReceivedAt: string | null
  acknowledgementArtifactId: string | null
  correctionRequiredAt: string | null
  correctionReason: string | null
  createdAt: string
  updatedAt: string
}

export type GstFilingPayload = {
  id: string
  filingRunId: string
  businessId: string
  reportingRunId: string
  returnType: GstFilingReturnType
  payloadType: "canonical" | "external"
  schemaVersion: string
  contentHash: string
  payload: Record<string, unknown>
  generatedAt: string
}

export type GstFilingStatusEvent = {
  id: string
  filingRunId: string
  businessId: string
  previousStatus: GstFilingStatus | null
  status: GstFilingStatus
  eventType: string
  message: string | null
  externalReference: string | null
  createdAt: string
}

export type GstFilingRunDetail = {
  filingRun: GstFilingRun
  payloads: GstFilingPayload[]
  events: GstFilingStatusEvent[]
}

export type GstFilingPaginationMeta = {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export type GstFilingAcknowledgement = {
  acknowledgementNumber: string
  acknowledgementDate: string | null
  externalReference: string | null
  status: GstFilingStatus
}

export function listGstFilingRuns(
  accessToken: string,
  query: {
    period?: string
    gstRegistrationId?: string
    reportingRunId?: string
    returnType?: GstFilingReturnType
    status?: GstFilingStatus
    page?: number
    limit?: number
  } = {}
) {
  return apiRequest<{ filingRuns: GstFilingRun[]; pagination: GstFilingPaginationMeta }>(
    `/gst-filings/runs${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export function getGstFilingRun(accessToken: string, runId: string) {
  return apiRequest<GstFilingRunDetail>(`/gst-filings/runs/${runId}`, {
    method: "GET",
    accessToken,
  })
}

export function createGstFilingRun(
  accessToken: string,
  payload: { reportingRunId: string; returnType: GstFilingReturnType }
) {
  return apiRequest<{ filingRun: GstFilingRun }>("/gst-filings/runs", {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function validateGstFilingRun(accessToken: string, runId: string) {
  return apiRequest<{ filingRun: GstFilingRun; validation: GstFilingValidationResult }>(
    `/gst-filings/runs/${runId}/validate`,
    {
      method: "POST",
      accessToken,
      body: withIdempotency({ reason: "Validated from GST filing history" }),
    }
  )
}

export function submitGstFilingRun(
  accessToken: string,
  runId: string,
  mockMode: GstFilingMockMode = "MOCK_ACCEPT"
) {
  return apiRequest<{ filingRun: GstFilingRun; submission: Record<string, unknown> }>(
    `/gst-filings/runs/${runId}/submit`,
    {
      method: "POST",
      accessToken,
      body: withIdempotency({ mockMode }),
    }
  )
}

export function pollGstFilingRunStatus(accessToken: string, runId: string) {
  return apiRequest<{ filingRun: GstFilingRun; status: Record<string, unknown> | null }>(
    `/gst-filings/runs/${runId}/status`,
    {
      method: "POST",
      accessToken,
      body: withIdempotency({ reason: "Manual filing status check" }),
    }
  )
}

export function retryGstFilingRun(accessToken: string, runId: string, reason: string) {
  return apiRequest<{ filingRun: GstFilingRun }>(`/gst-filings/runs/${runId}/retry`, {
    method: "POST",
    accessToken,
    body: withIdempotency({ reason }),
  })
}

export function cancelGstFilingRun(accessToken: string, runId: string, reason: string) {
  return apiRequest<{ filingRun: GstFilingRun }>(`/gst-filings/runs/${runId}/cancel`, {
    method: "POST",
    accessToken,
    body: withIdempotency({ reason }),
  })
}

export function getGstFilingAcknowledgement(accessToken: string, runId: string) {
  return apiRequest<{ acknowledgement: GstFilingAcknowledgement }>(
    `/gst-filings/runs/${runId}/acknowledgement`,
    { method: "GET", accessToken }
  )
}

function withIdempotency<T extends Record<string, unknown>>(payload: T) {
  return {
    ...payload,
    idempotencyKey:
      typeof crypto !== "undefined" && "randomUUID" in crypto ?
        crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }
}

function toQueryString(query: Record<string, unknown>) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "" || value === "all") {
      continue
    }

    params.set(key, String(value))
  }

  const value = params.toString()
  return value ? `?${value}` : ""
}
