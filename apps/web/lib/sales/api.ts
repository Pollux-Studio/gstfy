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
  taxability?: "TAXABLE" | "EXEMPT" | "NIL_RATED" | "NON_GST" | "ZERO_RATED"
  cessRuleId?: string | null
  pricingMode?: "tax_exclusive" | "tax_inclusive"
  discountAmount?: string | null
  otherCharges?: Array<{
    chargeType: string
    amount: string
    taxTreatment: "taxable" | "non_taxable"
  }>
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

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export async function listSalesInvoices(
  accessToken: string,
  filters: {
    search?: string
    status?: SalesInvoiceStatus
    page?: number
    limit?: number
  } = {}
) {
  const query = new URLSearchParams()

  if (filters.search?.trim()) {
    query.set("search", filters.search.trim())
  }

  if (filters.status) {
    query.set("status", filters.status)
  }

  if (filters.page) {
    query.set("page", String(filters.page))
  }

  if (filters.limit) {
    query.set("limit", String(filters.limit))
  }

  return apiRequest<{ invoices: SalesInvoice[]; pagination: PaginationMeta }>(
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
