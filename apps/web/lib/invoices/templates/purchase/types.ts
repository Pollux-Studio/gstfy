import type { InvoiceTemplateOption } from "@/lib/invoices/templates/shared/template-options"
import type { PurchaseBillDetail } from "@/lib/purchases/api"

export type PurchaseInvoiceBusinessInfo = {
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

export type PurchaseInvoiceTemplateProps = {
  bill: PurchaseBillDetail
  buyer: PurchaseInvoiceBusinessInfo | null
  template: InvoiceTemplateOption
}
