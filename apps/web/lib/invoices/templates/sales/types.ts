import type { InvoiceTemplateOption } from "@/lib/invoices/templates/shared/template-options"
import type { SalesInvoiceDetail } from "@/lib/sales/api"

export type SalesInvoiceBusinessInfo = {
  legalName?: string | null
  tradeName?: string | null
  gstin?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  locality?: string | null
  district?: string | null
  pincode?: string | null
  stateCode?: string | null
}

export type SalesInvoiceTemplateProps = {
  invoice: SalesInvoiceDetail
  seller: SalesInvoiceBusinessInfo | null
  template: InvoiceTemplateOption
  watermarkText?: string | null
}
