import { apiRequest } from "@/lib/api/client"

export type GstReportingRunStatus =
  | "DRAFT"
  | "REVIEW"
  | "READY_FOR_CA_REVIEW"
  | "CA_APPROVED"
  | "READY_FOR_SUBMISSION"
  | "SUBMITTED"
  | "FILED"
  | "LOCKED"
export type GstReportingExportFormat = "csv" | "json" | "xlsx"
export type GstReportingExceptionStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "IGNORED"
export type GstReportingExceptionSeverity = "HIGH" | "MEDIUM" | "LOW"

export type GstReportingRun = {
  id: string
  businessId: string
  gstRegistrationId: string
  period: string
  status: GstReportingRunStatus
  generatedAt: string | null
  sourceVersion: string
  sourceDataHash: string | null
  version: number
  periodStart: string | null
  periodEnd: string | null
  approvedAt: string | null
  approvalComment: string | null
  lockedAt: string | null
  summary: Record<string, unknown>
}

export type GstReportMoneyRow = {
  classification: string
  count: number
  taxableValue: string
  cgst: string
  sgst: string
  igst: string
  cess: string
  totalTax: string
}

export type GstHsnSummaryRow = {
  hsnSac: string
  description: string
  uqc: string
  quantity: string
  taxableValue: string
  cgst: string
  sgst: string
  igst: string
  cess: string
  totalTax: string
}

export type GstDocumentSummaryRow = {
  sourceDocumentType: string
  firstNumber: string
  lastNumber: string
  issuedCount: number
  taxableValue: string
  totalTax: string
}

export type GstReportingFact = {
  id: string
  sourceDocumentType: string
  sourceDocumentId: string | null
  sourceDocumentNumber: string
  sourceDocumentDate: string
  partyName: string | null
  partyGstin: string | null
  placeOfSupplyStateCode: string | null
  classification: string
  hsnSac: string | null
  description: string | null
  uqc: string | null
  quantity: string
  taxableValue: string
  cgst: string
  sgst: string
  igst: string
  cess: string
  totalTax: string
  reportingStatus: string
}

export type GstReportingException = {
  id: string
  runId: string
  exceptionType: string
  severity: GstReportingExceptionSeverity
  status: GstReportingExceptionStatus
  message: string
  recommendation: string | null
  isBlocking: boolean
  sourceDocumentType: string | null
  sourceDocumentId: string | null
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export type Gstr1Dataset = {
  run: GstReportingRun
  sections: GstReportMoneyRow[]
  hsn: GstHsnSummaryRow[]
  documents: GstDocumentSummaryRow[]
  rows: GstReportingFact[]
  totals: {
    taxableValue: string
    cgst: string
    sgst: string
    igst: string
    cess: string
    totalTax: string
  }
}

export type Gstr3bDataset = {
  run: GstReportingRun
  outward: GstReportMoneyRow[]
  itc: {
    availableCgst: string
    availableSgst: string
    availableIgst: string
    availableCess: string
    claimedCgst: string
    claimedSgst: string
    claimedIgst: string
    claimedCess: string
    deferredCgst: string
    deferredSgst: string
    deferredIgst: string
    deferredCess: string
    ineligibleCgst: string
    ineligibleSgst: string
    ineligibleIgst: string
    ineligibleCess: string
    rcmTax: string
  } | null
  totals: {
    outputTax: string
    claimedItc: string
    netGst: string
  }
}

export type GstFilingReview = {
  run: GstReportingRun
  status: {
    canMarkReady: boolean
    blockingCount: number
    exceptionCount: number
  }
  summary: {
    outputGst: string
    inputGst: string
    netGst: string
    rcm: string
    eligibleItc: string
    unresolvedExceptions: string
  }
  sections: {
    sales: GstReportMoneyRow[]
    hsn: GstHsnSummaryRow[]
    documents: GstDocumentSummaryRow[]
    exceptions: GstReportingException[]
  }
}

export type GstReportingExportResponse = {
  fileName: string
  contentType: string
  content: string
  encoding: "utf8" | "base64"
}

export function listGstReportingRuns(
  accessToken: string,
  query: { period?: string; gstRegistrationId?: string; status?: GstReportingRunStatus; page?: number; limit?: number } = {}
) {
  return apiRequest<{ runs: GstReportingRun[]; pagination: PaginationMeta }>(
    `/gst-reporting/runs${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export function createGstReportingRun(
  accessToken: string,
  payload: { period: string; gstRegistrationId: string }
) {
  return apiRequest<{ run: GstReportingRun }>("/gst-reporting/runs", {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function refreshGstReportingRun(accessToken: string, runId: string) {
  return apiRequest<{ run: GstReportingRun }>(`/gst-reporting/runs/${runId}/refresh`, {
    method: "POST",
    accessToken,
    body: withIdempotency({ reason: "Manual refresh" }),
  })
}

export function markGstReportingReady(accessToken: string, runId: string) {
  return apiRequest<{ run: GstReportingRun }>(`/gst-reporting/runs/${runId}/mark-ready`, {
    method: "POST",
    accessToken,
    body: withIdempotency({ reason: "Filing review completed" }),
  })
}

export function approveGstReportingRun(
  accessToken: string,
  runId: string,
  approvalComment: string
) {
  return apiRequest<{ run: GstReportingRun }>(`/gst-reporting/runs/${runId}/approve`, {
    method: "POST",
    accessToken,
    body: withIdempotency({ approvalComment }),
  })
}

export function lockGstReportingRun(accessToken: string, runId: string) {
  return apiRequest<{ run: GstReportingRun }>(`/gst-reporting/runs/${runId}/lock`, {
    method: "POST",
    accessToken,
    body: withIdempotency({ reason: "Ready for GST submission" }),
  })
}

export function getGstr1Dataset(
  accessToken: string,
  query: { runId?: string; period?: string; gstRegistrationId?: string }
) {
  return apiRequest<Gstr1Dataset>(
    `/gst-reporting/gstr1${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export function getGstr3bDataset(
  accessToken: string,
  query: { runId?: string; period?: string; gstRegistrationId?: string }
) {
  return apiRequest<Gstr3bDataset>(
    `/gst-reporting/gstr3b${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export function getGstFilingReview(
  accessToken: string,
  query: { runId?: string; period?: string; gstRegistrationId?: string }
) {
  return apiRequest<GstFilingReview>(
    `/gst-reporting/review${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export function exportGstr1(
  accessToken: string,
  query: { runId?: string; period?: string; gstRegistrationId?: string; format: GstReportingExportFormat }
) {
  return apiRequest<GstReportingExportResponse>(
    `/gst-reporting/gstr1/export${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export function exportGstr3b(
  accessToken: string,
  query: { runId?: string; period?: string; gstRegistrationId?: string; format: GstReportingExportFormat }
) {
  return apiRequest<GstReportingExportResponse>(
    `/gst-reporting/gstr3b/export${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export function downloadGstReportExport(response: GstReportingExportResponse) {
  const bytes =
    response.encoding === "base64" ?
      Uint8Array.from(atob(response.content), (char) => char.charCodeAt(0))
    : response.content
  const blob = new Blob([bytes], { type: response.contentType })
  const link = document.createElement("a")

  link.href = URL.createObjectURL(blob)
  link.download = response.fileName
  link.click()
  URL.revokeObjectURL(link.href)
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
