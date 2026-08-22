export const invoiceTemplateCodes = [
  "reference-01",
] as const

export type InvoiceTemplateCode = (typeof invoiceTemplateCodes)[number]
export type InvoiceTemplateDocumentType = "sales" | "purchase"

export type InvoiceTemplateOption = {
  code: InvoiceTemplateCode
  label: string
  description: string
  sourcePage: number
  sampleSeller: string
  supportedDocuments: InvoiceTemplateDocumentType[]
}

export const invoiceTemplateOptions: InvoiceTemplateOption[] = [
  {
    code: "reference-01",
    label: "Standard GST Invoice",
    description: "Tally-style GST invoice layout based on the shared purchase invoice document.",
    sourcePage: 1,
    sampleSeller: "Rahul Sales Corporation",
    supportedDocuments: ["sales", "purchase"],
  },
]

export function getInvoiceTemplateOptions(
  documentType: InvoiceTemplateDocumentType
) {
  return invoiceTemplateOptions.filter((template) =>
    template.supportedDocuments.includes(documentType)
  )
}

export function normalizeInvoiceTemplateCode(value?: string | null): InvoiceTemplateCode {
  if (invoiceTemplateCodes.includes(value as InvoiceTemplateCode)) {
    return value as InvoiceTemplateCode
  }

  return "reference-01"
}

export function getInvoiceTemplateOption(value?: string | null) {
  const code = normalizeInvoiceTemplateCode(value)
  return invoiceTemplateOptions.find((template) => template.code === code) ?? invoiceTemplateOptions[0]!
}
