import { apiRequest } from "@/lib/api/client"
import type { PaymentMode } from "@/lib/sales/api"

export type PurchaseBillStatus = "draft" | "posted" | "reconciled" | "cancelled"

export type PurchaseBillLinePayload = {
  itemId?: string | null
  itemName: string
  hsnSacCode?: string | null
  quantity: string
  unit?: string
  rate: string
  gstRate: string
  itcEligible?: boolean
}

export type PurchasePaymentPayload = {
  paymentMode: PaymentMode
  amount: string
  referenceNumber?: string | null
}

export type CreatePurchaseBillPayload = {
  status: "draft" | "posted"
  supplierId?: string | null
  supplierName?: string | null
  supplierInvoiceNumber?: string | null
  invoiceDate: string
  billDate: string
  gstRegistrationId?: string | null
  branchId?: string | null
  warehouseId?: string | null
  placeOfSupplyStateCode?: string | null
  purchaseType: "goods" | "services" | "expense"
  notes?: string | null
  lines: PurchaseBillLinePayload[]
  payments: PurchasePaymentPayload[]
}

export type PurchaseBill = {
  id: string
  billNumber: string
  supplierInvoiceNumber: string | null
  invoiceDate: string
  billDate: string
  supplierName: string
  status: PurchaseBillStatus
  taxableValue: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  totalAmount: string
  amountPaid: string
  amountDue: string
  itcEligibleAmount: string
  createdAt: string
}

export type PurchaseBillDetail = PurchaseBill & {
  purchaseType: string
  notes: string | null
  lines: Array<{
    id: string
    itemNameSnapshot: string
    hsnSacCode: string | null
    quantity: string
    unit: string
    rate: string
    taxableValue: string
    gstRate: string
    cgstAmount: string
    sgstAmount: string
    igstAmount: string
    lineTotal: string
    itcEligible: boolean
  }>
  payments: Array<{
    id: string
    paymentMode: PaymentMode
    amount: string
    referenceNumber: string | null
  }>
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export async function listPurchaseBills(
  accessToken: string,
  filters: {
    search?: string
    page?: number
    limit?: number
  } = {}
) {
  const query = new URLSearchParams()

  if (filters.search?.trim()) {
    query.set("search", filters.search.trim())
  }

  if (filters.page) {
    query.set("page", String(filters.page))
  }

  if (filters.limit) {
    query.set("limit", String(filters.limit))
  }

  return apiRequest<{ bills: PurchaseBill[]; pagination: PaginationMeta }>(
    `/purchase-bills${query.size ? `?${query.toString()}` : ""}`,
    { method: "GET", accessToken }
  )
}

export async function createPurchaseBill(
  accessToken: string,
  payload: CreatePurchaseBillPayload
) {
  return apiRequest<{ bill: PurchaseBillDetail }>("/purchase-bills", {
    method: "POST",
    accessToken,
    body: payload,
  })
}

export async function getPurchaseBill(accessToken: string, billId: string) {
  return apiRequest<{ bill: PurchaseBillDetail }>(`/purchase-bills/${billId}`, {
    method: "GET",
    accessToken,
  })
}

export async function postPurchaseBill(accessToken: string, billId: string) {
  return apiRequest<{ bill: PurchaseBillDetail }>(`/purchase-bills/${billId}/post`, {
    method: "POST",
    accessToken,
  })
}
