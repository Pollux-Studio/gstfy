import { apiRequest } from "@/lib/api/client"
import type { PaginationMeta, PartyListItem } from "@/lib/parties/api"

export type MoneyDocumentStatus = "draft" | "posted" | "reversed"
export type PaymentMethod = "cash" | "bank" | "upi" | "card" | "cheque" | "other"
export type UnallocatedTreatment = "advance" | "unallocated"
export type ReceivablePayableStatus =
  | "open"
  | "partially_settled"
  | "settled"
  | "closed"
  | "cancelled"

export type MoneyDocumentAllocation = {
  id: string
  businessId: string
  paymentVoucherId: string
  documentVoucherId: string
  receivablePayableEntryId: string | null
  allocatedAmount: string
  allocatedAt: string
  status: "active" | "reversed"
  target: {
    id: string
    entryType: "receivable" | "payable"
    originalAmount: string
    settledAmount: string
    outstandingAmount: string
    status: ReceivablePayableStatus
    voucherId: string
    voucherNumber: string
    voucherDate: string
    voucherType: string
  }
}

export type MoneyDocument = {
  id: string
  businessId: string
  voucherId: string | null
  partyId: string
  branchId: string | null
  gstRegistrationId: string | null
  cashBankAccountId: string
  receiptNumber?: string
  receiptDate?: string
  paymentNumber?: string
  paymentDate?: string
  paymentMethod: PaymentMethod
  amount: string
  allocatedAmount: string
  unallocatedAmount: string
  unallocatedTreatment: UnallocatedTreatment
  referenceNumber: string | null
  notes: string | null
  status: MoneyDocumentStatus
  partyNameSnapshot: string
  partySnapshot: PartyListItem | null
  cashBankAccountSnapshot: {
    id: string
    accountCode: string
    accountName: string
    accountGroup: string
  } | null
  postedAt: string | null
  reversedAt: string | null
  reversalReason: string | null
  createdAt: string
  updatedAt: string
  allocations?: MoneyDocumentAllocation[]
}

export type ReceivablePayableEntry = {
  id: string
  businessId: string
  voucherId: string
  partyId: string | null
  partyNameSnapshot: string
  partySnapshot: unknown
  entryType: "receivable" | "payable"
  originalAmount: string
  settledAmount: string
  outstandingAmount: string
  dueDate: string | null
  status: ReceivablePayableStatus
  createdAt: string
  voucherNumber: string
  voucherDate: string
  voucherType: string
}

export type ReceivablePayableResponse = {
  entries: ReceivablePayableEntry[]
  totals: {
    original: string
    settled: string
    outstanding: string
  }
  pagination: PaginationMeta
}

export type AgingReportResponse = {
  entryType: "receivable" | "payable"
  granularity: "day" | "month"
  periods: Array<{
    periodStart: string
    periodEnd: string
    label: string
    count: number
    outstanding: string
  }>
  totals: {
    outstanding: string
    count: number
  }
}

export type CashFlowReportResponse = {
  rows: Array<{
    direction: "receipt" | "payment"
    paymentMethod: PaymentMethod
    count: number
    amount: string
    allocated: string
    unallocated: string
  }>
  totals: {
    receipts: string
    payments: string
    net: string
  }
}

export type BankReconciliationItem = {
  documentType: "receipt" | "payment"
  documentId: string
  documentNumber: string
  documentDate: string
  partyName: string
  paymentMethod: PaymentMethod
  amount: string
  referenceNumber: string | null
  cashBankAccountId: string
  matchId: string | null
  statementDate: string | null
  bankReference: string | null
  notes: string | null
  reconciledAt: string | null
}

export type BankStatementLine = {
  id: string
  importId: string
  fileName: string
  cashBankAccountId: string
  statementDate: string
  description: string
  bankReference: string | null
  direction: "credit" | "debit"
  amount: string
  matchStatus: "unmatched" | "matched" | "ignored"
  matchedReceiptId: string | null
  matchedPaymentId: string | null
  matchedAt: string | null
  matchId: string | null
  matchedDocumentNumber: string | null
  matchedDocumentType: "receipt" | "payment" | null
  createdAt: string
}

export type BankReconciliationResponse = {
  items: BankReconciliationItem[]
  totals: {
    reconciled: string
    unmatched: string
    count: number
  }
}

export type BankStatementLinesResponse = {
  lines: BankStatementLine[]
  totals: {
    matched: string
    unmatched: string
    count: number
  }
  pagination: PaginationMeta
}

export type CsvExportResponse = {
  fileName: string
  contentType: "text/csv"
  content: string
}

export type MoneyDocumentPayload = {
  partyId: string
  branchId?: string | null
  gstRegistrationId?: string | null
  cashBankAccountId: string
  documentDate: string
  paymentMethod: PaymentMethod
  amount: string
  unallocatedTreatment?: UnallocatedTreatment
  referenceNumber?: string | null
  notes?: string | null
}

export type MoneyAllocationPayload = {
  receivablePayableEntryId: string
  allocatedAmount: string
}

export type MoneyDocumentQuery = {
  search?: string
  status?: "all" | MoneyDocumentStatus
  paymentMethod?: "all" | PaymentMethod
  from?: string
  to?: string
  page?: number
  limit?: number
}

export type ReceivablePayableQuery = {
  search?: string
  status?: "all" | ReceivablePayableStatus
  partyId?: string | null
  from?: string
  to?: string
  page?: number
  limit?: number
}

export type DateRangeQuery = {
  from?: string
  to?: string
}

export type BankReconciliationQuery = DateRangeQuery & {
  status?: "all" | "reconciled" | "unmatched"
  accountId?: string | null
  search?: string
}

export type BankStatementLinesQuery = DateRangeQuery & {
  status?: "all" | "unmatched" | "matched" | "ignored"
  accountId?: string | null
  importId?: string | null
  search?: string
  page?: number
  limit?: number
}

export function listReceipts(accessToken: string, query: MoneyDocumentQuery = {}) {
  return apiRequest<{ receipts: MoneyDocument[]; pagination: PaginationMeta }>(
    `/receipts${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export function listPayments(accessToken: string, query: MoneyDocumentQuery = {}) {
  return apiRequest<{ payments: MoneyDocument[]; pagination: PaginationMeta }>(
    `/payments${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export function getReceipt(accessToken: string, receiptId: string) {
  return apiRequest<{ receipt: MoneyDocument }>(`/receipts/${receiptId}`, {
    method: "GET",
    accessToken,
  })
}

export function getPayment(accessToken: string, paymentId: string) {
  return apiRequest<{ payment: MoneyDocument }>(`/payments/${paymentId}`, {
    method: "GET",
    accessToken,
  })
}

export function createReceipt(accessToken: string, payload: MoneyDocumentPayload) {
  return apiRequest<{ receipt: MoneyDocument }>("/receipts", {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function createPayment(accessToken: string, payload: MoneyDocumentPayload) {
  return apiRequest<{ payment: MoneyDocument }>("/payments", {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function postReceipt(
  accessToken: string,
  receiptId: string,
  allocations: MoneyAllocationPayload[]
) {
  return apiRequest<{ receipt: MoneyDocument }>(`/receipts/${receiptId}/post`, {
    method: "POST",
    accessToken,
    body: withIdempotency({ allocations }),
  })
}

export function postPayment(
  accessToken: string,
  paymentId: string,
  allocations: MoneyAllocationPayload[]
) {
  return apiRequest<{ payment: MoneyDocument }>(`/payments/${paymentId}/post`, {
    method: "POST",
    accessToken,
    body: withIdempotency({ allocations }),
  })
}

export function addReceiptAllocation(
  accessToken: string,
  receiptId: string,
  payload: MoneyAllocationPayload
) {
  return apiRequest<{ receipt: MoneyDocument }>(`/receipts/${receiptId}/allocations`, {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function addPaymentAllocation(
  accessToken: string,
  paymentId: string,
  payload: MoneyAllocationPayload
) {
  return apiRequest<{ payment: MoneyDocument }>(`/payments/${paymentId}/allocations`, {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function deleteReceipt(accessToken: string, receiptId: string) {
  return apiRequest<{ success: true }>(`/receipts/${receiptId}`, {
    method: "DELETE",
    accessToken,
  })
}

export function deletePayment(accessToken: string, paymentId: string) {
  return apiRequest<{ success: true }>(`/payments/${paymentId}`, {
    method: "DELETE",
    accessToken,
  })
}

export function reverseReceipt(accessToken: string, receiptId: string, reason: string) {
  return apiRequest<{ receipt: MoneyDocument }>(`/receipts/${receiptId}/reverse`, {
    method: "POST",
    accessToken,
    body: withIdempotency({ reason }),
  })
}

export function reversePayment(accessToken: string, paymentId: string, reason: string) {
  return apiRequest<{ payment: MoneyDocument }>(`/payments/${paymentId}/reverse`, {
    method: "POST",
    accessToken,
    body: withIdempotency({ reason }),
  })
}

export function exportReceipts(accessToken: string, query: MoneyDocumentQuery = {}) {
  return apiRequest<CsvExportResponse>(`/receipts/export${toQueryString(query)}`, {
    method: "GET",
    accessToken,
  })
}

export function exportPayments(accessToken: string, query: MoneyDocumentQuery = {}) {
  return apiRequest<CsvExportResponse>(`/payments/export${toQueryString(query)}`, {
    method: "GET",
    accessToken,
  })
}

export function listReceivables(
  accessToken: string,
  query: ReceivablePayableQuery = {}
) {
  return apiRequest<ReceivablePayableResponse>(
    `/receivables${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export function listPayables(accessToken: string, query: ReceivablePayableQuery = {}) {
  return apiRequest<ReceivablePayableResponse>(
    `/payables${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export function exportReceivables(
  accessToken: string,
  query: ReceivablePayableQuery = {}
) {
  return apiRequest<CsvExportResponse>(`/receivables/export${toQueryString(query)}`, {
    method: "GET",
    accessToken,
  })
}

export function exportPayables(accessToken: string, query: ReceivablePayableQuery = {}) {
  return apiRequest<CsvExportResponse>(`/payables/export${toQueryString(query)}`, {
    method: "GET",
    accessToken,
  })
}

export function getAgingReport(
  accessToken: string,
  entryType: "receivable" | "payable",
  query: DateRangeQuery = {}
) {
  return apiRequest<AgingReportResponse>(
    `/payment-reports/aging${toQueryString({ ...query, entryType })}`,
    { method: "GET", accessToken }
  )
}

export function exportAgingReport(
  accessToken: string,
  entryType: "receivable" | "payable",
  query: DateRangeQuery = {}
) {
  return apiRequest<CsvExportResponse>(
    `/payment-reports/aging/export${toQueryString({ ...query, entryType })}`,
    { method: "GET", accessToken }
  )
}

export function getCashFlowReport(accessToken: string, query: DateRangeQuery = {}) {
  return apiRequest<CashFlowReportResponse>(
    `/payment-reports/cash-flow${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export function exportCashFlowReport(accessToken: string, query: DateRangeQuery = {}) {
  return apiRequest<CsvExportResponse>(
    `/payment-reports/cash-flow/export${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export function listBankReconciliation(
  accessToken: string,
  query: BankReconciliationQuery = {}
) {
  return apiRequest<BankReconciliationResponse>(
    `/bank-reconciliation${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export function listBankStatementLines(
  accessToken: string,
  query: BankStatementLinesQuery = {}
) {
  return apiRequest<BankStatementLinesResponse>(
    `/bank-reconciliation/statement-lines${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export function reconcileBankDocument(
  accessToken: string,
  payload: {
    documentType: "receipt" | "payment"
    documentId: string
    statementLineId?: string | null
    statementDate: string
    bankReference?: string | null
    notes?: string | null
  }
) {
  return apiRequest<{ match: unknown }>("/bank-reconciliation", {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function importBankStatement(
  accessToken: string,
  payload: {
    cashBankAccountId: string
    fileName: string
    csvText: string
  }
) {
  return apiRequest<{
    import: {
      id: string
      fileName: string
      statementFrom: string | null
      statementTo: string | null
    }
    imported: number
  }>("/bank-reconciliation/import", {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function autoMatchBankStatementLines(
  accessToken: string,
  payload: {
    importId?: string | null
    cashBankAccountId?: string | null
    dateToleranceDays?: number
  } = {}
) {
  return apiRequest<{
    matched: number
    skipped: number
    matches: Array<{
      statementLineId: string
      documentType: "receipt" | "payment"
      documentId: string
      documentNumber: string
      matchId: string
    }>
  }>("/bank-reconciliation/auto-match", {
    method: "POST",
    accessToken,
    body: withIdempotency(payload),
  })
}

export function unreconcileBankDocument(accessToken: string, matchId: string) {
  return apiRequest<{ success: true }>(`/bank-reconciliation/${matchId}`, {
    method: "DELETE",
    accessToken,
  })
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

function withIdempotency<T extends object>(payload: T) {
  return {
    ...payload,
    idempotencyKey: createIdempotencyKey(),
  }
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
