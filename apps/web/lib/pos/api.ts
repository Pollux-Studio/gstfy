import { apiRequest } from "@/lib/api/client"
import type { PaymentMode } from "@/lib/sales/api"

export type PosCheckoutLinePayload = {
  itemId?: string | null
  itemName: string
  hsnSacCode?: string | null
  quantity: string
  unit?: string
  rate: string
  gstRate: string
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

export async function listPosSales(accessToken: string, search = "") {
  const query = new URLSearchParams()

  if (search.trim()) {
    query.set("search", search.trim())
  }

  return apiRequest<{ sales: PosSale[] }>(
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
