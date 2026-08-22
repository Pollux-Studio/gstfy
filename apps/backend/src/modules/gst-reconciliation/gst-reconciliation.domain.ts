import { createHash } from "node:crypto"

export type ReconciliationStatus =
  | "NOT_MATCHED"
  | "MATCHED"
  | "PARTIAL_MATCH"
  | "VALUE_MISMATCH"
  | "TAX_MISMATCH"
  | "DATE_MISMATCH"
  | "DUPLICATE"
  | "BOOKS_ONLY"
  | "EXTERNAL_ONLY"
  | "MANUAL_REVIEW"

export type MatchStatus = Exclude<
  ReconciliationStatus,
  "NOT_MATCHED" | "BOOKS_ONLY" | "EXTERNAL_ONLY"
>

export type MatchConfidence = "EXACT" | "STRONG" | "PARTIAL" | "WEAK" | "NO_MATCH"
export type ItcStatus =
  | "NOT_REVIEWED"
  | "ELIGIBLE"
  | "PARTIALLY_ELIGIBLE"
  | "DEFERRED"
  | "INELIGIBLE"
  | "CLAIMED"
  | "REVERSED"
  | "REJECTED"

export type TaxComparisonInput = {
  supplierGstin: string | null
  documentNumber: string
  documentDate: string
  taxableValue: string | number
  cgst: string | number
  sgst: string | number
  igst: string | number
  cess: string | number
}

export type TaxDifferences = {
  taxableDifference: string
  cgstDifference: string
  sgstDifference: string
  igstDifference: string
  cessDifference: string
}

export type ReconciliationTolerances = {
  taxableValueToleranceCents: number
  cgstToleranceCents: number
  sgstToleranceCents: number
  igstToleranceCents: number
  cessToleranceCents: number
  dateToleranceDays: number
}

export const defaultReconciliationTolerances: ReconciliationTolerances = {
  taxableValueToleranceCents: 100,
  cgstToleranceCents: 100,
  sgstToleranceCents: 100,
  igstToleranceCents: 100,
  cessToleranceCents: 100,
  dateToleranceDays: 2,
}

const allowedItcTransitions: Record<ItcStatus, readonly ItcStatus[]> = {
  NOT_REVIEWED: ["ELIGIBLE", "PARTIALLY_ELIGIBLE", "DEFERRED", "INELIGIBLE", "REJECTED"],
  ELIGIBLE: ["CLAIMED"],
  PARTIALLY_ELIGIBLE: ["CLAIMED"],
  DEFERRED: ["ELIGIBLE", "PARTIALLY_ELIGIBLE", "INELIGIBLE", "REJECTED"],
  INELIGIBLE: [],
  CLAIMED: ["REVERSED"],
  REVERSED: [],
  REJECTED: [],
}

export function normalizeDocumentNumber(value: string) {
  return value.trim().toUpperCase().replace(/[\s_/-]+/g, "")
}

export function normalizeGstin(value: string | null | undefined) {
  return value?.trim().toUpperCase() || null
}

export function taxPeriodFromDate(value: string) {
  return value.slice(0, 7)
}

export function compareTaxRecords(
  book: TaxComparisonInput,
  external: TaxComparisonInput,
  options: Partial<ReconciliationTolerances> = {}
): {
  candidate: boolean
  matchStatus: MatchStatus | "NO_MATCH"
  matchConfidence: MatchConfidence
  differences: TaxDifferences
} {
  const tolerances = { ...defaultReconciliationTolerances, ...options }
  const sameGstin =
    normalizeGstin(book.supplierGstin) !== null &&
    normalizeGstin(book.supplierGstin) === normalizeGstin(external.supplierGstin)
  const sameDocument =
    normalizeDocumentNumber(book.documentNumber) ===
    normalizeDocumentNumber(external.documentNumber)

  const differences = buildTaxDifferences(book, external)

  if (!sameGstin || !sameDocument) {
    return {
      candidate: false,
      matchStatus: "NO_MATCH",
      matchConfidence: "NO_MATCH",
      differences,
    }
  }

  const dateDifference = Math.abs(
    dateToDayNumber(book.documentDate) - dateToDayNumber(external.documentDate)
  )

  if (dateDifference > tolerances.dateToleranceDays) {
    return {
      candidate: true,
      matchStatus: "DATE_MISMATCH",
      matchConfidence: "WEAK",
      differences,
    }
  }

  if (dateDifference > 0) {
    return {
      candidate: true,
      matchStatus: "DATE_MISMATCH",
      matchConfidence: "STRONG",
      differences,
    }
  }

  const taxableDiff = Math.abs(toCents(differences.taxableDifference))
  const componentDiffs = {
    cgst: Math.abs(toCents(differences.cgstDifference)),
    sgst: Math.abs(toCents(differences.sgstDifference)),
    igst: Math.abs(toCents(differences.igstDifference)),
    cess: Math.abs(toCents(differences.cessDifference)),
  }
  const taxableWithinTolerance = taxableDiff <= tolerances.taxableValueToleranceCents
  const taxWithinTolerance =
    componentDiffs.cgst <= tolerances.cgstToleranceCents &&
    componentDiffs.sgst <= tolerances.sgstToleranceCents &&
    componentDiffs.igst <= tolerances.igstToleranceCents &&
    componentDiffs.cess <= tolerances.cessToleranceCents

  if (taxableWithinTolerance && taxWithinTolerance) {
    return {
      candidate: true,
      matchStatus: "MATCHED",
      matchConfidence: "EXACT",
      differences,
    }
  }

  if (!taxWithinTolerance) {
    return {
      candidate: true,
      matchStatus: "TAX_MISMATCH",
      matchConfidence: taxableWithinTolerance ? "PARTIAL" : "WEAK",
      differences,
    }
  }

  return {
    candidate: true,
    matchStatus: "VALUE_MISMATCH",
    matchConfidence: "PARTIAL",
    differences,
  }
}

export function isAllowedItcTransition(from: ItcStatus, to: ItcStatus) {
  return allowedItcTransitions[from]?.includes(to) ?? false
}

export function assertAllowedItcTransition(from: ItcStatus, to: ItcStatus) {
  if (!isAllowedItcTransition(from, to)) {
    throw new Error(`Invalid ITC transition: ${from} -> ${to}`)
  }
}

export function getAllowedItcTransitions(from: ItcStatus) {
  return [...(allowedItcTransitions[from] ?? [])]
}

export function resolveItcAmountsForStatus(
  status: "ELIGIBLE" | "PARTIALLY_ELIGIBLE" | "DEFERRED" | "INELIGIBLE" | "REJECTED",
  source: {
    cgst: string | number
    sgst: string | number
    igst: string | number
    cess: string | number
  },
  partial?: {
    eligibleCgst?: string | number
    eligibleSgst?: string | number
    eligibleIgst?: string | number
    eligibleCess?: string | number
  }
) {
  const sourceAmounts = {
    cgst: Math.max(toCents(source.cgst), 0),
    sgst: Math.max(toCents(source.sgst), 0),
    igst: Math.max(toCents(source.igst), 0),
    cess: Math.max(toCents(source.cess), 0),
  }
  const eligible =
    status === "ELIGIBLE" ? sourceAmounts
    : status === "PARTIALLY_ELIGIBLE" ?
      {
        cgst: clampCents(toCents(partial?.eligibleCgst ?? 0), sourceAmounts.cgst),
        sgst: clampCents(toCents(partial?.eligibleSgst ?? 0), sourceAmounts.sgst),
        igst: clampCents(toCents(partial?.eligibleIgst ?? 0), sourceAmounts.igst),
        cess: clampCents(toCents(partial?.eligibleCess ?? 0), sourceAmounts.cess),
      }
    : zeroComponentAmounts()
  const deferred = status === "DEFERRED" ? sourceAmounts : zeroComponentAmounts()
  const ineligible =
    status === "INELIGIBLE" || status === "REJECTED" ?
      sourceAmounts
    : {
      cgst: Math.max(sourceAmounts.cgst - eligible.cgst - deferred.cgst, 0),
      sgst: Math.max(sourceAmounts.sgst - eligible.sgst - deferred.sgst, 0),
      igst: Math.max(sourceAmounts.igst - eligible.igst - deferred.igst, 0),
      cess: Math.max(sourceAmounts.cess - eligible.cess - deferred.cess, 0),
    }

  return {
    eligibleCgst: formatCents(eligible.cgst),
    eligibleSgst: formatCents(eligible.sgst),
    eligibleIgst: formatCents(eligible.igst),
    eligibleCess: formatCents(eligible.cess),
    ineligibleCgst: formatCents(ineligible.cgst),
    ineligibleSgst: formatCents(ineligible.sgst),
    ineligibleIgst: formatCents(ineligible.igst),
    ineligibleCess: formatCents(ineligible.cess),
    deferredCgst: formatCents(deferred.cgst),
    deferredSgst: formatCents(deferred.sgst),
    deferredIgst: formatCents(deferred.igst),
    deferredCess: formatCents(deferred.cess),
  }
}

export function buildGstReconciliationRequestHash(payload: unknown) {
  return createHash("sha256")
    .update(stableStringify(removeIdempotencyKey(payload)))
    .digest("hex")
}

export function toCents(value: string | number | null | undefined) {
  const normalized = String(value ?? "0").trim()

  if (!normalized) {
    return 0
  }

  return Math.round(Number(normalized) * 100)
}

export function formatCents(cents: number) {
  return (cents / 100).toFixed(2)
}

function buildTaxDifferences(
  book: TaxComparisonInput,
  external: TaxComparisonInput
): TaxDifferences {
  return {
    taxableDifference: formatCents(toCents(book.taxableValue) - toCents(external.taxableValue)),
    cgstDifference: formatCents(toCents(book.cgst) - toCents(external.cgst)),
    sgstDifference: formatCents(toCents(book.sgst) - toCents(external.sgst)),
    igstDifference: formatCents(toCents(book.igst) - toCents(external.igst)),
    cessDifference: formatCents(toCents(book.cess) - toCents(external.cess)),
  }
}

function dateToDayNumber(value: string) {
  return Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / 86_400_000)
}

function zeroComponentAmounts() {
  return {
    cgst: 0,
    sgst: 0,
    igst: 0,
    cess: 0,
  }
}

function clampCents(value: number, max: number) {
  return Math.min(Math.max(value, 0), max)
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
