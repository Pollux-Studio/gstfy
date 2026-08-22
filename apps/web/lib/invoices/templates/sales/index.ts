import {
  getInvoiceTemplateOption,
  getInvoiceTemplateOptions,
  normalizeInvoiceTemplateCode,
  type InvoiceTemplateCode,
} from "@/lib/invoices/templates/shared/template-options"

export type SalesInvoiceTemplateCode = InvoiceTemplateCode

export function getSalesInvoiceTemplateOptions() {
  return getInvoiceTemplateOptions("sales")
}

export function getSalesInvoiceTemplate() {
  return getInvoiceTemplateOption()
}

export function normalizeSalesInvoiceTemplateCode() {
  return normalizeInvoiceTemplateCode()
}
