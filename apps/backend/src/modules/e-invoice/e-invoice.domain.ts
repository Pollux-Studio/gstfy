import { createHash } from "node:crypto"

export const eInvoiceSourceDocumentTypes = [
  "sales_invoice",
  "credit_note",
  "debit_note",
] as const
export const eInvoiceEligibilityStatuses = [
  "ELIGIBLE",
  "NOT_ELIGIBLE",
  "BLOCKED",
  "ALREADY_GENERATED",
] as const
export const eInvoiceSubmissionStatuses = [
  "NOT_REQUIRED",
  "ELIGIBLE",
  "READY",
  "VALIDATION_FAILED",
  "SUBMITTING",
  "PROCESSING",
  "IRN_GENERATED",
  "FAILED",
  "CANCELLATION_REQUESTED",
  "CANCELLED",
  "CANCELLATION_FAILED",
] as const

export type EInvoiceSourceDocumentType = (typeof eInvoiceSourceDocumentTypes)[number]
export type EInvoiceEligibilityStatus = (typeof eInvoiceEligibilityStatuses)[number]
export type EInvoiceSubmissionStatus = (typeof eInvoiceSubmissionStatuses)[number]

export type EInvoiceIssue = {
  code: string
  message: string
  severity: "blocking" | "warning"
}

export type EInvoiceValidationResult = {
  canSubmit: boolean
  blockingIssues: EInvoiceIssue[]
  warnings: EInvoiceIssue[]
  payloadHash: string
  schemaVersion: string
}

export type EInvoiceEligibilityResult = {
  status: EInvoiceEligibilityStatus
  reasonCode: string
  reason: string
  warnings: EInvoiceIssue[]
}

export type EInvoicePartySnapshot = {
  gstin: string | null
  legalName: string | null
  tradeName: string | null
  displayName: string | null
  addressLine1: string | null
  addressLine2: string | null
  locality: string | null
  city: string | null
  district: string | null
  state: string | null
  stateCode: string | null
  pincode: string | null
  country: string
}

export type CanonicalEInvoicePayload = {
  schemaVersion: string
  source: {
    documentType: EInvoiceSourceDocumentType
    documentId: string
    voucherId: string | null
  }
  supplier: EInvoicePartySnapshot
  recipient: EInvoicePartySnapshot
  document: {
    number: string
    date: string
    type: "INV" | "CRN" | "DBN"
    supplyType: string
    placeOfSupplyStateCode: string | null
  }
  items: Array<{
    serialNumber: number
    description: string
    hsnSac: string | null
    uqc: string
    quantity: string
    unitPrice: string
    discount: string
    taxableValue: string
    gstRate: string
    cgstAmount: string
    sgstAmount: string
    igstAmount: string
    cessAmount: string
    totalAmount: string
  }>
  totals: {
    taxableValue: string
    cgstAmount: string
    sgstAmount: string
    igstAmount: string
    cessAmount: string
    totalAmount: string
  }
  references: {
    originalDocumentNumber: string | null
    originalDocumentDate: string | null
    reason: string | null
  }
  generatedAt: string
}

export type EInvoiceProviderResult = {
  status: Extract<
    EInvoiceSubmissionStatus,
    "PROCESSING" | "IRN_GENERATED" | "FAILED" | "CANCELLED" | "CANCELLATION_FAILED"
  >
  providerReference: string | null
  irn: string | null
  ackNumber: string | null
  ackDate: string | null
  signedInvoiceReference: string | null
  signedQrCode: string | null
  errorCode: string | null
  errorMessage: string | null
  rawResponse: Record<string, unknown>
}

const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const hsnSacPattern = /^\d{4,8}$/
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const pincodePattern = /^\d{6}$/
const moneyTolerance = 0.01

export function eInvoiceSchemaVersion() {
  return "gstfy-einvoice:v1"
}

export function buildEInvoiceOperationRequestHash(payload: unknown) {
  return hashPayload(removeIdempotencyKey(payload))
}

export function hashPayload(payload: unknown) {
  return createHash("sha256").update(stableStringify(payload)).digest("hex")
}

export function hashCanonicalEInvoicePayload(payload: CanonicalEInvoicePayload) {
  const hashablePayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => key !== "generatedAt")
  )

  return hashPayload(hashablePayload)
}

export function validateCanonicalEInvoicePayload(
  payload: CanonicalEInvoicePayload
): EInvoiceValidationResult {
  const blockingIssues: EInvoiceIssue[] = []
  const warnings: EInvoiceIssue[] = []

  validatePartySnapshot("supplier", payload.supplier, blockingIssues)
  validatePartySnapshot("recipient", payload.recipient, blockingIssues)

  if (payload.schemaVersion !== eInvoiceSchemaVersion()) {
    blockingIssues.push({
      code: "SCHEMA_VERSION_MISMATCH",
      message: "E-invoice payload schema version is not supported.",
      severity: "blocking",
    })
  }

  if (!payload.document.number.trim()) {
    blockingIssues.push({
      code: "DOCUMENT_NUMBER_REQUIRED",
      message: "Document number is required for e-invoice generation.",
      severity: "blocking",
    })
  }

  if (!datePattern.test(payload.document.date)) {
    blockingIssues.push({
      code: "DOCUMENT_DATE_INVALID",
      message: "Document date must be a valid YYYY-MM-DD date.",
      severity: "blocking",
    })
  }

  if (payload.items.length === 0) {
    blockingIssues.push({
      code: "ITEMS_REQUIRED",
      message: "At least one item line is required.",
      severity: "blocking",
    })
  }

  for (const item of payload.items) {
    if (!item.description.trim()) {
      blockingIssues.push({
        code: "ITEM_DESCRIPTION_REQUIRED",
        message: `Line ${item.serialNumber} needs an item description.`,
        severity: "blocking",
      })
    }

    if (!item.hsnSac || !hsnSacPattern.test(item.hsnSac)) {
      blockingIssues.push({
        code: "HSN_SAC_INVALID",
        message: `Line ${item.serialNumber} needs a valid HSN/SAC code.`,
        severity: "blocking",
      })
    }

    if (toNumber(item.quantity) <= 0) {
      blockingIssues.push({
        code: "QUANTITY_INVALID",
        message: `Line ${item.serialNumber} quantity must be greater than zero.`,
        severity: "blocking",
      })
    }
  }

  validateTotals(payload, blockingIssues)

  if (payload.document.supplyType !== "b2b") {
    warnings.push({
      code: "NON_B2B_SUPPLY",
      message: "Only eligible registered-recipient supplies should be submitted for e-invoice.",
      severity: "warning",
    })
  }

  return {
    canSubmit: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    payloadHash: hashCanonicalEInvoicePayload(payload),
    schemaVersion: payload.schemaVersion,
  }
}

export function checkEInvoiceEligibility(input: {
  sourceDocumentType: EInvoiceSourceDocumentType
  status: string
  existingSubmissionStatus?: string | null
  gstRegistrationId: string | null
  partyGstin: string | null
  invoiceType?: string | null
  supplyType?: string | null
  documentDate: string | null
  linesCount: number
}): EInvoiceEligibilityResult {
  if (input.existingSubmissionStatus === "IRN_GENERATED") {
    return {
      status: "ALREADY_GENERATED",
      reasonCode: "IRN_ALREADY_GENERATED",
      reason:
        "This document already has an IRN. The GST e-invoice system allows only one IRN for the same document.",
      warnings: [],
    }
  }

  if (input.status !== "posted") {
    return {
      status: "BLOCKED",
      reasonCode: "SOURCE_NOT_POSTED",
      reason: "Only posted source documents can be submitted for e-invoice.",
      warnings: [],
    }
  }

  if (!input.gstRegistrationId) {
    return {
      status: "BLOCKED",
      reasonCode: "SUPPLIER_GST_REQUIRED",
      reason: "Supplier GST registration is required before e-invoice generation.",
      warnings: [],
    }
  }

  if (!input.documentDate || !datePattern.test(input.documentDate)) {
    return {
      status: "BLOCKED",
      reasonCode: "DOCUMENT_DATE_INVALID",
      reason: "A valid source document date is required.",
      warnings: [],
    }
  }

  if (input.linesCount === 0) {
    return {
      status: "BLOCKED",
      reasonCode: "LINES_REQUIRED",
      reason: "Source document must contain line items.",
      warnings: [],
    }
  }

  if (!input.partyGstin || !gstinPattern.test(input.partyGstin)) {
    return {
      status: "NOT_ELIGIBLE",
      reasonCode: "REGISTERED_RECIPIENT_REQUIRED",
      reason: "E-invoice is only prepared for registered recipient documents with a valid GSTIN.",
      warnings: [],
    }
  }

  if (input.sourceDocumentType === "sales_invoice" && input.supplyType !== "b2b") {
    return {
      status: "NOT_ELIGIBLE",
      reasonCode: "B2B_SUPPLY_REQUIRED",
      reason: "Sales invoice must be B2B to enter the e-invoice workflow.",
      warnings: [],
    }
  }

  if (input.sourceDocumentType === "sales_invoice" && input.invoiceType === "bill_of_supply") {
    return {
      status: "NOT_ELIGIBLE",
      reasonCode: "TAX_INVOICE_REQUIRED",
      reason: "Bill of supply documents are not submitted as tax e-invoices.",
      warnings: [],
    }
  }

  return {
    status: "ELIGIBLE",
    reasonCode: "ELIGIBLE_REGISTERED_RECIPIENT",
    reason: "Document has the required posted status, supplier GSTIN, recipient GSTIN, and tax lines.",
    warnings: [
      {
        code: "TURNOVER_RULE_CONFIGURABLE",
        message:
          "E-invoice turnover setting is not confirmed for this business. Confirm the e-invoice requirement in Settings before using live IRN generation.",
        severity: "warning",
      },
    ],
  }
}

export function assertEInvoiceStatusTransition(
  currentStatus: string,
  allowedStatuses: EInvoiceSubmissionStatus[],
  action: string
) {
  if (!allowedStatuses.includes(currentStatus as EInvoiceSubmissionStatus)) {
    return {
      valid: false,
      message: `E-invoice status ${currentStatus} cannot ${action}.`,
    }
  }

  return { valid: true, message: null }
}

export function shouldRecoverExistingEInvoiceSubmission(input: {
  status: string
  providerReference: string | null
  irn: string | null
}) {
  return (
    ["SUBMITTING", "PROCESSING", "IRN_GENERATED"].includes(input.status) ||
    Boolean(input.providerReference) ||
    Boolean(input.irn)
  )
}

export function canRetryEInvoiceTechnically(status: string) {
  return status === "FAILED" || status === "CANCELLATION_FAILED"
}

function validatePartySnapshot(
  role: "supplier" | "recipient",
  snapshot: EInvoicePartySnapshot,
  blockingIssues: EInvoiceIssue[]
) {
  const label = role === "supplier" ? "Supplier" : "Recipient"

  if (!snapshot.gstin || !gstinPattern.test(snapshot.gstin)) {
    blockingIssues.push({
      code: `${role.toUpperCase()}_GSTIN_INVALID`,
      message: `${label} GSTIN is required and must be valid.`,
      severity: "blocking",
    })
  }

  if (!snapshot.legalName && !snapshot.tradeName && !snapshot.displayName) {
    blockingIssues.push({
      code: `${role.toUpperCase()}_NAME_REQUIRED`,
      message: `${label} legal or trade name is required.`,
      severity: "blocking",
    })
  }

  if (!snapshot.stateCode || snapshot.stateCode.length !== 2) {
    blockingIssues.push({
      code: `${role.toUpperCase()}_STATE_REQUIRED`,
      message: `${label} state code is required.`,
      severity: "blocking",
    })
  }

  if (snapshot.pincode && !pincodePattern.test(snapshot.pincode)) {
    blockingIssues.push({
      code: `${role.toUpperCase()}_PINCODE_INVALID`,
      message: `${label} pincode must be 6 digits when provided.`,
      severity: "blocking",
    })
  }
}

function validateTotals(
  payload: CanonicalEInvoicePayload,
  blockingIssues: EInvoiceIssue[]
) {
  const sumTaxable = sumItems(payload, "taxableValue")
  const sumCgst = sumItems(payload, "cgstAmount")
  const sumSgst = sumItems(payload, "sgstAmount")
  const sumIgst = sumItems(payload, "igstAmount")
  const sumCess = sumItems(payload, "cessAmount")
  const sumTotal = sumItems(payload, "totalAmount")

  validateMoneyMatch("TAXABLE_TOTAL_MISMATCH", sumTaxable, payload.totals.taxableValue, blockingIssues)
  validateMoneyMatch("CGST_TOTAL_MISMATCH", sumCgst, payload.totals.cgstAmount, blockingIssues)
  validateMoneyMatch("SGST_TOTAL_MISMATCH", sumSgst, payload.totals.sgstAmount, blockingIssues)
  validateMoneyMatch("IGST_TOTAL_MISMATCH", sumIgst, payload.totals.igstAmount, blockingIssues)
  validateMoneyMatch("CESS_TOTAL_MISMATCH", sumCess, payload.totals.cessAmount, blockingIssues)
  validateMoneyMatch("GRAND_TOTAL_MISMATCH", sumTotal, payload.totals.totalAmount, blockingIssues)
}

function validateMoneyMatch(
  code: string,
  expected: number,
  actual: string,
  blockingIssues: EInvoiceIssue[]
) {
  if (Math.abs(expected - toNumber(actual)) > moneyTolerance) {
    blockingIssues.push({
      code,
      message: `${code.replace(/_/g, " ").toLowerCase()} in e-invoice payload.`,
      severity: "blocking",
    })
  }
}

function sumItems(
  payload: CanonicalEInvoicePayload,
  property: keyof CanonicalEInvoicePayload["items"][number]
) {
  return payload.items.reduce((total, item) => total + toNumber(item[property]), 0)
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function removeIdempotencyKey(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => removeIdempotencyKey(entry))
  }

  if (!value || typeof value !== "object") {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  const result: Record<string, unknown> = {}

  for (const [key, entryValue] of Object.entries(value)) {
    if (key === "idempotencyKey") {
      continue
    }

    result[key] = removeIdempotencyKey(entryValue)
  }

  return result
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString())
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}
