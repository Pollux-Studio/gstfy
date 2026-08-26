import {
  getInvoiceTemplateOption,
  getInvoiceTemplateOptions,
  type InvoiceTemplateCode,
} from "@/lib/invoices/templates/shared/template-options"
import { createReferenceSalesInvoiceTemplate } from "@/lib/invoices/templates/sales/reference-01"
import type { SalesInvoiceTemplateProps } from "@/lib/invoices/templates/sales/types"

export type SalesInvoiceTemplateCode = InvoiceTemplateCode
export type {
  SalesInvoiceBusinessInfo,
  SalesInvoiceTemplateProps,
} from "@/lib/invoices/templates/sales/types"

export function getSalesInvoiceTemplateOptions() {
  return getInvoiceTemplateOptions("sales")
}

export function getSalesInvoiceTemplate(value?: string | null) {
  return getInvoiceTemplateOption(value)
}

export function createSalesInvoiceTemplate(props: SalesInvoiceTemplateProps) {
  switch (props.template.code) {
    case "reference-01":
    default:
      return createReferenceSalesInvoiceTemplate(props)
  }
}
