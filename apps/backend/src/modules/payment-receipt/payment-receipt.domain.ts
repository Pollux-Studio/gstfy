import { createHash } from "node:crypto"

export type AllocationLimitInput = {
  targetOriginalCents: number
  targetActiveAllocatedCents: number
  documentAmountCents: number
  documentActiveAllocatedCents: number
  requestedCents: number
}

export function calculateOutstandingCents(
  originalAmountCents: number,
  activeAllocationCents: number
) {
  return Math.max(originalAmountCents - activeAllocationCents, 0)
}

export function validateAllocationLimits(input: AllocationLimitInput) {
  if (input.requestedCents <= 0) {
    return { valid: false, reason: "amount_not_positive" as const }
  }

  if (
    input.targetActiveAllocatedCents + input.requestedCents >
    input.targetOriginalCents
  ) {
    return { valid: false, reason: "target_over_allocated" as const }
  }

  if (
    input.documentActiveAllocatedCents + input.requestedCents >
    input.documentAmountCents
  ) {
    return { valid: false, reason: "document_over_allocated" as const }
  }

  return { valid: true, reason: null }
}

export function buildMoneyOperationRequestHash(payload: unknown) {
  return createHash("sha256")
    .update(stableStringify(removeIdempotencyKey(payload)))
    .digest("hex")
}

function removeIdempotencyKey(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => removeIdempotencyKey(item))
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
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}
