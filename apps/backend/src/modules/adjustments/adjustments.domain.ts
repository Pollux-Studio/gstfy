import { createHash } from "node:crypto"

export type AdjustmentType =
  | "SALES_RETURN"
  | "PURCHASE_RETURN"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE"

export type SourceDocumentType = "sales_invoice" | "purchase_bill"
export type AdjustmentStatus = "draft" | "posted" | "reversed"
export type InventoryEffect = "STOCK_IN" | "STOCK_OUT" | "NONE"

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
