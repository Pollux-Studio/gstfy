import { apiRequest } from "@/lib/api/client"

export type PaymentMode = "cash" | "upi" | "card" | "bank" | "cheque"
export type SalesInvoiceStatus = "draft" | "posted" | "cancelled"

export type SalesInvoiceLinePayload = {
  itemId?: string | null
  itemName: string
  hsnSacCode?: string | null
  quantity: string
  unit?: string
  rate: string
  gstRate: string
}

export type SalesPaymentPayload = {
  paymentMode: PaymentMode
  amount: string
  referenceNumber?: string | null
}

export type CreateSalesInvoicePayload = {
  status: "draft" | "posted"
  partyId?: string | null
  customerName?: string | null
  invoiceDate: string
  dueDate?: string | null
  gstRegistrationId?: string | null
  branchId?: string | null
  warehouseId?: string | null
  placeOfSupplyStateCode?: string | null
  supplyType: "b2b" | "b2c"
  invoiceType: "tax_invoice" | "bill_of_supply"
  notes?: string | null
  lines: SalesInvoiceLinePayload[]
  payments: SalesPaymentPayload[]
}

export type SalesInvoice = {
  id: string
  invoiceNumber: string
  invoiceDate: string
  customerName: string
  status: SalesInvoiceStatus
  taxableValue: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  totalAmount: string
  amountPaid: string
  amountDue: string
  createdAt: string
}

export type SalesInvoiceDetail = SalesInvoice & {
  dueDate: string | null
  placeOfSupplyStateCode: string | null
  supplyType: string
  invoiceType: string
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
  }>
  payments: Array<{
    id: string
    paymentMode: PaymentMode
    amount: string
    referenceNumber: string | null
  }>
}

export async function listSalesInvoices(accessToken: string, search = "") {
  const query = new URLSearchParams()

  if (search.trim()) {
    query.set("search", search.trim())
  }

  return apiRequest<{ invoices: SalesInvoice[] }>(
    `/sales/invoices${query.size ? `?${query.toString()}` : ""}`,
    { method: "GET", accessToken }
  )
}

export async function createSalesInvoice(
  accessToken: string,
  payload: CreateSalesInvoicePayload
) {
  return apiRequest<{ invoice: SalesInvoiceDetail }>("/sales/invoices", {
    method: "POST",
    accessToken,
    body: payload,
  })
}

export async function getSalesInvoice(accessToken: string, invoiceId: string) {
  return apiRequest<{ invoice: SalesInvoiceDetail }>(`/sales/invoices/${invoiceId}`, {
    method: "GET",
    accessToken,
  })
}

export async function postSalesInvoice(accessToken: string, invoiceId: string) {
  return apiRequest<{ invoice: SalesInvoiceDetail }>(
    `/sales/invoices/${invoiceId}/post`,
    {
      method: "POST",
      accessToken,
    }
  )
}
