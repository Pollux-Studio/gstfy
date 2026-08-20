import { apiRequest } from "@/lib/api/client"

export type AdjustmentType =
  | "SALES_RETURN"
  | "PURCHASE_RETURN"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE"

export type AdjustmentStatus = "draft" | "posted" | "reversed"
export type AdjustmentMode = "sales-return" | "purchase-return" | "credit-note" | "debit-note"

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export type AdjustmentListRow = {
  id: string
  adjustmentNumber: string
  adjustmentType: AdjustmentType
  adjustmentDate: string
  sourceDocumentType: "sales_invoice" | "purchase_bill"
  sourceDocumentId: string | null
  sourceSnapshot: unknown
  status: AdjustmentStatus
  partyId: string | null
  partySnapshot: unknown
  taxableTotal: string
  cgstTotal: string
  sgstTotal: string
  igstTotal: string
  grandTotal: string
  reason: string | null
  postedAt: string | null
  reversedAt: string | null
  createdAt: string
}

export type AdjustmentLine = {
  id: string
  originalLineId: string | null
  descriptionSnapshot: string
  hsnSacSnapshot: string | null
  quantity: string
  unit: string
  rate: string
  taxableValue: string
  gstRateSnapshot: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  lineTotal: string
  inventoryEffect: "STOCK_IN" | "STOCK_OUT" | "NONE"
  inventoryWarehouseId: string | null
  reason: string | null
}

export type AdjustmentDetail = AdjustmentListRow & {
  voucherId: string | null
  originalVoucherId: string
  reasonCode: string | null
  issuerType: string
  documentDirection: string
  sourcePartyRole: string | null
  adjustmentContext: string
  sourceSnapshot: unknown
  taxSnapshot: unknown
  reversalReason: string | null
  lines: AdjustmentLine[]
  sourceVoucher: {
    id: string
    voucherNumber: string
    voucherType: string
    voucherDate: string
  } | null
  voucher: {
    id: string
    voucherNumber: string
    voucherType: string
    voucherDate: string
    status: string
  } | null
  journalEntries: Array<{
    id: string
    description: string | null
    entryDate: string
    lines: Array<{
      id: string
      accountCode: string
      accountName: string
      debit: string
      credit: string
      narration: string | null
    }>
  }>
  audit: Array<{
    id: string
    action: string
    reason: string | null
    createdAt: string
  }>
}

export type ReturnableSource = {
  sourceDocument: {
    id: string
    voucherId: string
    documentNumber: string
    documentDate: string
    partyName: string
    totalAmount: string
    sourceDocumentType: "sales_invoice" | "purchase_bill"
  }
  lines: Array<{
    id: string
    itemId: string | null
    itemName: string
    hsnSacCode: string | null
    originalQuantity: string
    previouslyReturnedQuantity: string
    remainingQuantity: string
    unit: string
    rate: string
    taxableValue: string
    gstRate: string
    cgstAmount: string
    sgstAmount: string
    igstAmount: string
    cessAmount: string
    lineTotal: string
  }>
}

export type CreateAdjustmentPayload = {
  idempotencyKey?: string
  sourceDocumentId: string
  adjustmentDate: string
  reasonCode?: string
  reason?: string | null
  adjustmentContext?: "goods_related" | "value_only" | "tax_adjustment"
  issuerType?: "GSTFY_BUSINESS" | "CUSTOMER" | "SUPPLIER"
  documentDirection?: "incoming" | "outgoing"
  sourcePartyRole?: "customer" | "supplier"
  lines: Array<{
    originalLineId: string
    quantity?: string
    taxableValue?: string
    rate?: string
    reason?: string | null
    inventoryEffect?: "STOCK_IN" | "STOCK_OUT" | "NONE"
    inventoryWarehouseId?: string | null
  }>
}

export type CsvExportResponse = {
  fileName: string
  contentType: "text/csv"
  content: string
}

const modeConfig = {
  "sales-return": {
    path: "/sales-returns",
    listKey: "salesReturns",
    detailKey: "salesReturn",
  },
  "purchase-return": {
    path: "/purchase-returns",
    listKey: "purchaseReturns",
    detailKey: "purchaseReturn",
  },
  "credit-note": {
    path: "/credit-notes",
    listKey: "creditNotes",
    detailKey: "creditNote",
  },
  "debit-note": {
    path: "/debit-notes",
    listKey: "debitNotes",
    detailKey: "debitNote",
  },
} as const

export function endpointForAdjustmentMode(mode: AdjustmentMode) {
  return modeConfig[mode].path
}

export async function listAdjustments(
  accessToken: string,
  mode: AdjustmentMode,
  filters: {
    search?: string
    status?: "all" | AdjustmentStatus
    page?: number
    limit?: number
  } = {}
) {
  const query = new URLSearchParams()

  if (filters.search?.trim()) {
    query.set("search", filters.search.trim())
  }

  if (filters.status && filters.status !== "all") {
    query.set("status", filters.status)
  }

  if (filters.page) {
    query.set("page", String(filters.page))
  }

  if (filters.limit) {
    query.set("limit", String(filters.limit))
  }

  const config = modeConfig[mode]
  const response = await apiRequest<
    Record<typeof config.listKey, AdjustmentListRow[]> & { pagination: PaginationMeta }
  >(`${config.path}${query.size ? `?${query.toString()}` : ""}`, {
    method: "GET",
    accessToken,
  })

  return {
    adjustments: response[config.listKey],
    pagination: response.pagination,
  }
}

export async function getAdjustment(
  accessToken: string,
  mode: AdjustmentMode,
  adjustmentId: string
) {
  const config = modeConfig[mode]
  const response = await apiRequest<Record<typeof config.detailKey, AdjustmentDetail>>(
    `${config.path}/${adjustmentId}`,
    { method: "GET", accessToken }
  )

  return response[config.detailKey]
}

export async function createAdjustment(
  accessToken: string,
  mode: AdjustmentMode,
  payload: CreateAdjustmentPayload
) {
  const config = modeConfig[mode]
  const response = await apiRequest<Record<typeof config.detailKey, AdjustmentDetail>>(
    config.path,
    { method: "POST", accessToken, body: payload }
  )

  return response[config.detailKey]
}

export async function postAdjustment(
  accessToken: string,
  mode: AdjustmentMode,
  adjustmentId: string
) {
  const config = modeConfig[mode]
  const response = await apiRequest<Record<typeof config.detailKey, AdjustmentDetail>>(
    `${config.path}/${adjustmentId}/post`,
    {
      method: "POST",
      accessToken,
      body: { idempotencyKey: crypto.randomUUID() },
    }
  )

  return response[config.detailKey]
}

export async function reverseAdjustment(
  accessToken: string,
  mode: AdjustmentMode,
  adjustmentId: string,
  reason: string
) {
  const config = modeConfig[mode]
  const response = await apiRequest<Record<typeof config.detailKey, AdjustmentDetail>>(
    `${config.path}/${adjustmentId}/reverse`,
    {
      method: "POST",
      accessToken,
      body: { reason, idempotencyKey: crypto.randomUUID() },
    }
  )

  return response[config.detailKey]
}

export async function deleteAdjustment(
  accessToken: string,
  mode: AdjustmentMode,
  adjustmentId: string
) {
  return apiRequest<{ success: true }>(`${modeConfig[mode].path}/${adjustmentId}`, {
    method: "DELETE",
    accessToken,
  })
}

export async function exportAdjustments(
  accessToken: string,
  mode: AdjustmentMode,
  filters: { search?: string; status?: "all" | AdjustmentStatus } = {}
) {
  const query = new URLSearchParams()

  if (filters.search?.trim()) {
    query.set("search", filters.search.trim())
  }

  if (filters.status && filters.status !== "all") {
    query.set("status", filters.status)
  }

  return apiRequest<CsvExportResponse>(
    `${modeConfig[mode].path}/export${query.size ? `?${query.toString()}` : ""}`,
    { method: "GET", accessToken }
  )
}

export async function getSalesInvoiceReturnable(
  accessToken: string,
  invoiceId: string
) {
  return apiRequest<ReturnableSource>(`/sales-invoices/${invoiceId}/returnable`, {
    method: "GET",
    accessToken,
  })
}

export async function getPurchaseBillReturnable(accessToken: string, billId: string) {
  return apiRequest<ReturnableSource>(`/purchase-bills/${billId}/returnable`, {
    method: "GET",
    accessToken,
  })
}
