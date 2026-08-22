import {
  getInvoiceTemplateOption,
  getInvoiceTemplateOptions,
  type InvoiceTemplateCode,
} from "@/lib/invoices/templates/shared/template-options"
import { createReferencePurchaseInvoiceTemplate } from "@/lib/invoices/templates/purchase/reference-01"
import type { PurchaseInvoiceTemplateProps } from "@/lib/invoices/templates/purchase/types"

export type PurchaseInvoiceTemplateCode = InvoiceTemplateCode
export type {
  PurchaseInvoiceBusinessInfo,
  PurchaseInvoiceTemplateProps,
} from "@/lib/invoices/templates/purchase/types"

export function getPurchaseInvoiceTemplateOptions() {
  return getInvoiceTemplateOptions("purchase")
}

export function getPurchaseInvoiceTemplate(value?: string | null) {
  return getInvoiceTemplateOption(value)
}

export function createPurchaseInvoiceTemplate(props: PurchaseInvoiceTemplateProps) {
  switch (props.template.code) {
    case "reference-01":
    default:
      return createReferencePurchaseInvoiceTemplate(props)
  }
}
