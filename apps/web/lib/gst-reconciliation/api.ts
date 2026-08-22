import { apiRequest } from "@/lib/api/client"

export type ReconciliationStatus =
  | "NOT_MATCHED"
  | "MATCHED"
  | "PARTIAL_MATCH"
  | "VALUE_MISMATCH"
  | "TAX_MISMATCH"
  | "DATE_MISMATCH"
  | "DUPLICATE"
  | "BOOKS_ONLY"
  | "EXTERNAL_ONLY"
  | "MANUAL_REVIEW"

export type ItcStatus =
  | "NOT_REVIEWED"
  | "ELIGIBLE"
  | "PARTIALLY_ELIGIBLE"
  | "DEFERRED"
  | "INELIGIBLE"
  | "CLAIMED"
  | "REVERSED"
  | "REJECTED"

export type ExceptionStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "IGNORED"
export type ExceptionSeverity = "HIGH" | "MEDIUM" | "LOW"

export type PurchaseTaxRecord = {
  id: string
  sourceType: string
  purchaseBillId: string | null
  adjustmentDocumentId: string | null
  voucherId: string
  supplierId: string | null
  supplierName: string
  supplierGstin: string | null
  invoiceNumber: string
  normalizedInvoiceNumber: string
  invoiceDate: string
  taxableValue: string
  cgst: string
  sgst: string
  igst: string
  cess: string
  totalTax: string
  taxPeriod: string
  reconciliationStatus: ReconciliationStatus
  itcStatus: ItcStatus
  eligibleCgst: string
  eligibleSgst: string
  eligibleIgst: string
  eligibleCess: string
  ineligibleCgst: string
  ineligibleSgst: string
  ineligibleIgst: string
  ineligibleCess: string
  deferredCgst: string
  deferredSgst: string
  deferredIgst: string
  deferredCess: string
  inputType: string
}

export type ExternalGstRecord = {
  id: string
  importId: string
  gstRegistrationId: string | null
  supplierGstin: string
  supplierName: string | null
  documentNumber: string
  normalizedDocumentNumber: string
  documentDate: string
  taxableValue: string
  cgst: string
  sgst: string
  igst: string
  cess: string
  totalTax: string
  period: string
  source: string
  status: string
}

export type ReconciliationMatch = {
  id: string
  matchStatus: ReconciliationStatus
  matchConfidence: string
  taxableDifference: string
  cgstDifference: string
  sgstDifference: string
  igstDifference: string
  cessDifference: string
  manualOverride: boolean
  reason: string | null
}

export type ReconciliationException = {
  id: string
  matchId: string | null
  purchaseTaxRecordId: string | null
  externalGstRecordId: string | null
  exceptionType: string
  severity: ExceptionSeverity
  status: ExceptionStatus
  reason: string | null
  resolution: string | null
  resolvedAt: string | null
}

export type ReconciliationRow = {
  record: PurchaseTaxRecord
  match: ReconciliationMatch | null
  externalRecord: ExternalGstRecord | null
  exception: ReconciliationException | null
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export type ReconciliationSummary = {
  booksItc: string
  externalItc: string
  matched: number
  mismatch: number
  booksOnly: number
  externalOnly: number
  duplicate: number
  manualReview: number
  eligible: number
  deferred: number
  claimed: number
}

export type ReconciliationQuery = {
  period?: string
  search?: string
  matchStatus?: ReconciliationStatus | "all"
  itcStatus?: ItcStatus | "all"
  severity?: ExceptionSeverity | "all"
  page?: number
  limit?: number
  sortBy?: "invoiceDate" | "supplier" | "invoiceNumber" | "bookTax" | "difference" | "status"
  sortDir?: "asc" | "desc"
}

export type ReconciliationResponse = {
  items: ReconciliationRow[]
  summary: ReconciliationSummary
  pagination: PaginationMeta
}

export type ExternalGstImport = {
  id: string
  source: string
  period: string
  gstRegistrationId: string | null
  fileName: string
  recordCount: number
  status: string
  importedAt: string
}

export type CsvExportResponse = {
  fileName: string
  contentType: "text/csv"
  content: string
}

export type ExternalGstImportPayload = {
  source?: "gstr_2b" | "gstr_2a" | "manual" | "other"
  period: string
  gstRegistrationId?: string
  fileName: string
  records: Array<{
    supplierGstin: string
    supplierName?: string | null
    documentNumber: string
    documentDate: string
    taxableValue: string
    cgst: string
    sgst: string
    igst: string
    cess: string
  }>
}

export function listGstReconciliation(
  accessToken: string,
  query: ReconciliationQuery = {}
) {
  return apiRequest<ReconciliationResponse>(
    `/gst-reconciliation${toQueryString(normalizeQuery(query))}`,
    { method: "GET", accessToken }
  )
}

export function exportGstReconciliation(
  accessToken: string,
  query: ReconciliationQuery = {}
) {
  return apiRequest<CsvExportResponse>(
    `/gst-reconciliation/export${toQueryString(normalizeQuery(query))}`,
    { method: "GET", accessToken }
  )
}

export function getGstReconciliationDetail(accessToken: string, id: string) {
  return apiRequest<
    ReconciliationRow & {
      exceptions: ReconciliationException[]
      itcEvents: unknown[]
      claims: unknown[]
    }
  >(`/gst-reconciliation/${id}`, { method: "GET", accessToken })
}

export function importExternalGstRecords(
  accessToken: string,
  payload: ExternalGstImportPayload
) {
  return apiRequest<{
    import: ExternalGstImport
    imported: number
    skipped: number
    duplicates: number
    autoMatch: { matched: number; exceptions: number }
  }>("/gst-reconciliation/import", {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function listExternalGstImports(
  accessToken: string,
  query: { period?: string; source?: string; gstRegistrationId?: string; page?: number; limit?: number } = {}
) {
  return apiRequest<{ imports: ExternalGstImport[]; pagination: PaginationMeta }>(
    `/gst-reconciliation/imports${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export function listGstExceptions(
  accessToken: string,
  query: { period?: string; status?: ExceptionStatus | "all"; severity?: ExceptionSeverity | "all"; page?: number; limit?: number } = {}
) {
  return apiRequest<{
    exceptions: ReconciliationException[]
    pagination: PaginationMeta
  }>(`/gst-reconciliation/exceptions${toQueryString(normalizeQuery(query))}`, {
    method: "GET",
    accessToken,
  })
}

export function manualMatchGstRecord(
  accessToken: string,
  id: string,
  payload: { externalGstRecordId: string; reason: string }
) {
  return apiRequest<unknown>(`/gst-reconciliation/${id}/match`, {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function unmatchGstRecord(
  accessToken: string,
  id: string,
  payload: { reason: string }
) {
  return apiRequest<unknown>(`/gst-reconciliation/${id}/unmatch`, {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function resolveGstException(
  accessToken: string,
  id: string,
  payload: { exceptionId?: string; status: "RESOLVED" | "IGNORED" | "IN_REVIEW"; resolution: string }
) {
  return apiRequest<unknown>(`/gst-reconciliation/${id}/resolve`, {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function listItc(accessToken: string, query: ReconciliationQuery = {}) {
  return apiRequest<ReconciliationResponse>(`/itc${toQueryString(normalizeQuery(query))}`, {
    method: "GET",
    accessToken,
  })
}

export function exportItc(accessToken: string, query: ReconciliationQuery = {}) {
  return apiRequest<CsvExportResponse>(
    `/itc/export${toQueryString(normalizeQuery(query))}`,
    { method: "GET", accessToken }
  )
}

export function markItcEligible(
  accessToken: string,
  id: string,
  payload: {
    reason: string
    eligibleCgst?: string
    eligibleSgst?: string
    eligibleIgst?: string
    eligibleCess?: string
  }
) {
  return apiRequest<unknown>(`/itc/${id}/mark-eligible`, {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function deferItc(accessToken: string, id: string, payload: { reason: string }) {
  return apiRequest<unknown>(`/itc/${id}/defer`, {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function rejectItc(accessToken: string, id: string, payload: { reason: string }) {
  return apiRequest<unknown>(`/itc/${id}/reject`, {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function claimItc(
  accessToken: string,
  id: string,
  payload: { claimPeriod: string; reason?: string | null }
) {
  return apiRequest<unknown>(`/itc/${id}/claim`, {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function reverseItc(accessToken: string, id: string, payload: { reason: string }) {
  return apiRequest<unknown>(`/itc/${id}/reverse`, {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function downloadCsvExport(response: CsvExportResponse) {
  const blob = new Blob([response.content], { type: response.contentType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = response.fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function toQueryString(query: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value))
    }
  }

  return params.size ? `?${params.toString()}` : ""
}

function normalizeQuery<T extends Record<string, unknown>>(query: T) {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== "all")
  ) as Record<string, string | number | null | undefined>
}

function withIdempotency<T extends object>(payload: T) {
  return {
    ...payload,
    idempotencyKey: createIdempotencyKey(),
  }
}

function createIdempotencyKey() {
  return `gst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
