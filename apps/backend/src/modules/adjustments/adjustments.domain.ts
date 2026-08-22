import { createHash } from "node:crypto"

export type AdjustmentType =
  | "SALES_RETURN"
  | "PURCHASE_RETURN"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE"

export type SourceDocumentType = "sales_invoice" | "purchase_bill"
export type AdjustmentStatus = "draft" | "posted" | "reversed"
export type InventoryEffect = "STOCK_IN" | "STOCK_OUT" | "NONE"
export type AdjustmentIssuerType = "GSTFY_BUSINESS" | "CUSTOMER" | "SUPPLIER"
export type AdjustmentDocumentDirection = "incoming" | "outgoing"
export type AdjustmentSourcePartyRole = "customer" | "supplier"

export type AdjustmentIssuerContext = {
  issuerType: AdjustmentIssuerType
  documentDirection: AdjustmentDocumentDirection
  sourcePartyRole: AdjustmentSourcePartyRole
}

export type AdjustmentFinancialDirection = {
  arApEntryType: "receivable" | "payable" | null
  arApEffect: "increase" | "decrease" | "none"
  taxKind: "input" | "output"
  taxSide: "debit" | "credit"
}

export type ReturnableLineInput = {
  originalQuantity: string | number
  previouslyReturnedQuantity: string | number
}

export function calculateReturnableQuantity(input: ReturnableLineInput) {
  return Math.max(
    toQuantityMilli(input.originalQuantity) -
      toQuantityMilli(input.previouslyReturnedQuantity),
    0
  )
}

export function assertReturnQuantityWithinLimit(input: {
  requestedQuantity: string | number
  originalQuantity: string | number
  previouslyReturnedQuantity: string | number
}) {
  const requested = toQuantityMilli(input.requestedQuantity)

  if (requested <= 0) {
    return { valid: false, reason: "quantity_not_positive" as const }
  }

  if (
    requested >
    calculateReturnableQuantity({
      originalQuantity: input.originalQuantity,
      previouslyReturnedQuantity: input.previouslyReturnedQuantity,
    })
  ) {
    return { valid: false, reason: "return_quantity_exceeded" as const }
  }

  return { valid: true, reason: null }
}

export function sourceDocumentTypeForAdjustment(type: AdjustmentType) {
  return type === "SALES_RETURN" || type === "CREDIT_NOTE" ?
      "sales_invoice"
    : "purchase_bill"
}

export function defaultIssuerContextForAdjustment(
  type: AdjustmentType,
  sourceDocumentType: SourceDocumentType
): AdjustmentIssuerContext {
  if (sourceDocumentType === "sales_invoice") {
    return {
      issuerType: "GSTFY_BUSINESS",
      documentDirection: "outgoing",
      sourcePartyRole: "customer",
    }
  }

  if (type === "PURCHASE_RETURN") {
    return {
      issuerType: "GSTFY_BUSINESS",
      documentDirection: "outgoing",
      sourcePartyRole: "supplier",
    }
  }

  return {
    issuerType: "SUPPLIER",
    documentDirection: "incoming",
    sourcePartyRole: "supplier",
  }
}

export function resolveAdjustmentIssuerContext(input: {
  type: AdjustmentType
  sourceDocumentType: SourceDocumentType
  issuerType?: AdjustmentIssuerType
  documentDirection?: AdjustmentDocumentDirection
  sourcePartyRole?: AdjustmentSourcePartyRole | null
}) {
  const defaults = defaultIssuerContextForAdjustment(
    input.type,
    input.sourceDocumentType
  )
  const context = {
    issuerType: input.issuerType ?? defaults.issuerType,
    documentDirection: input.documentDirection ?? defaults.documentDirection,
    sourcePartyRole: input.sourcePartyRole ?? defaults.sourcePartyRole,
  }

  if (input.sourceDocumentType === "sales_invoice" && context.sourcePartyRole !== "customer") {
    return {
      valid: false,
      reason: "Sales-source adjustments must target a customer." as const,
      context,
    }
  }

  if (input.sourceDocumentType === "purchase_bill" && context.sourcePartyRole !== "supplier") {
    return {
      valid: false,
      reason: "Purchase-source adjustments must target a supplier." as const,
      context,
    }
  }

  if (
    input.type === "DEBIT_NOTE" &&
    input.sourceDocumentType === "sales_invoice" &&
    (context.issuerType !== "GSTFY_BUSINESS" || context.documentDirection !== "outgoing")
  ) {
    return {
      valid: false,
      reason: "Customer debit notes must be GSTfy-issued outgoing documents." as const,
      context,
    }
  }

  if (
    input.type === "DEBIT_NOTE" &&
    input.sourceDocumentType === "purchase_bill" &&
    (context.issuerType !== "SUPPLIER" || context.documentDirection !== "incoming")
  ) {
    return {
      valid: false,
      reason: "Supplier debit notes must be incoming supplier-issued documents." as const,
      context,
    }
  }

  return { valid: true, reason: null, context }
}

export function resolveAdjustmentFinancialDirection(input: {
  type: AdjustmentType
  sourceDocumentType: SourceDocumentType
}): AdjustmentFinancialDirection {
  if (input.sourceDocumentType === "sales_invoice") {
    if (input.type === "DEBIT_NOTE") {
      return {
        arApEntryType: "receivable",
        arApEffect: "increase",
        taxKind: "output",
        taxSide: "credit",
      }
    }

    return {
      arApEntryType: "receivable",
      arApEffect: "decrease",
      taxKind: "output",
      taxSide: "debit",
    }
  }

  if (input.type === "DEBIT_NOTE") {
    return {
      arApEntryType: "payable",
      arApEffect: "increase",
      taxKind: "input",
      taxSide: "debit",
    }
  }

  return {
    arApEntryType: "payable",
    arApEffect: "decrease",
    taxKind: "input",
    taxSide: "credit",
  }
}

export function voucherTypeForAdjustment(type: AdjustmentType) {
  return type
}

export function documentTypeForAdjustment(type: AdjustmentType) {
  const values: Record<AdjustmentType, string> = {
    SALES_RETURN: "sales_return",
    PURCHASE_RETURN: "purchase_return",
    CREDIT_NOTE: "credit_note",
    DEBIT_NOTE: "debit_note",
  }

  return values[type]
}

export function draftPrefixForAdjustment(type: AdjustmentType) {
  const values: Record<AdjustmentType, string> = {
    SALES_RETURN: "SR",
    PURCHASE_RETURN: "PR",
    CREDIT_NOTE: "CN",
    DEBIT_NOTE: "DN",
  }

  return values[type]
}

export function buildAdjustmentOperationRequestHash(payload: unknown) {
  return createHash("sha256")
    .update(stableStringify(removeIdempotencyKey(payload)))
    .digest("hex")
}

export function toQuantityMilli(value: string | number) {
  const normalized = String(value).trim()

  if (!normalized) {
    return 0
  }

  return Math.round(Number(normalized) * 1000)
}

export function formatQuantity(milli: number) {
  return (milli / 1000).toFixed(3).replace(/\.?0+$/, "")
}

function removeIdempotencyKey(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => removeIdempotencyKey(entry))
  }

  if (!value || typeof value !== "object") {
    return value
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
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}
