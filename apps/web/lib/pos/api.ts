import { apiRequest } from "@/lib/api/client"
import type { PaymentMode } from "@/lib/sales/api"
import type { Taxability } from "@/lib/products/api"

export type PosCheckoutLinePayload = {
  itemId?: string | null
  itemName: string
  hsnSacCode?: string | null
  quantity: string
  unit?: string
  rate: string
  gstRate: string
  taxability?: Taxability
  cessRuleId?: string | null
  pricingMode?: "tax_exclusive" | "tax_inclusive"
}

export type PosPaymentPayload = {
  paymentMode: PaymentMode
  amount: string
  referenceNumber?: string | null
}

export type PosCheckoutPayload = {
  partyId?: string | null
  customerName?: string | null
  receiptDate: string
  gstRegistrationId?: string | null
  branchId?: string | null
  warehouseId?: string | null
  placeOfSupplyStateCode?: string | null
  notes?: string | null
  lines: PosCheckoutLinePayload[]
  payments: PosPaymentPayload[]
}

export type PosSale = {
  id: string
  receiptNumber: string
  receiptDate: string
  partySnapshot?: unknown
  customerName: string
  status: "posted"
  taxableValue: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  totalAmount: string
  amountPaid: string
  amountDue: string
  createdAt: string
}

export type PosSaleDetail = PosSale & {
  lines: Array<{
    id: string
    itemNameSnapshot: string
    hsnSacCode: string | null
    quantity: string
    unit: string
    rate: string
    gstRate: string
    lineTotal: string
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

export async function listPosSales(
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

  return apiRequest<{ sales: PosSale[]; pagination: PaginationMeta }>(
    `/pos/sales${query.size ? `?${query.toString()}` : ""}`,
    { method: "GET", accessToken }
  )
}

export async function checkoutPosSale(accessToken: string, payload: PosCheckoutPayload) {
  return apiRequest<{ sale: PosSaleDetail }>("/pos/checkout", {
    method: "POST",
    accessToken,
    body: payload,
  })
}
