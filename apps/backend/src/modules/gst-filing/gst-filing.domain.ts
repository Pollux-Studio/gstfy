import { createHash } from "node:crypto"

export const gstFilingReturnTypes = ["GSTR1", "GSTR3B"] as const
export const gstFilingStatuses = [
  "DRAFT",
  "VALIDATED",
  "READY_FOR_SUBMISSION",
  "SUBMITTING",
  "SUBMITTED",
  "PROCESSING",
  "ACCEPTED",
  "FILED",
  "REJECTED",
  "FAILED",
  "CANCELLED",
] as const
export const gstFilingMockModes = [
  "MOCK_ACCEPT",
  "MOCK_REJECT",
  "MOCK_PROCESSING",
  "MOCK_TIMEOUT",
] as const
export const gstFilingExternalSubmissionProtectedStatuses = [
  "SUBMITTING",
  "SUBMITTED",
  "PROCESSING",
  "ACCEPTED",
  "FILED",
] as const

export type GstFilingReturnType = (typeof gstFilingReturnTypes)[number]
export type GstFilingStatus = (typeof gstFilingStatuses)[number]
export type GstFilingMockMode = (typeof gstFilingMockModes)[number]

export type GstFilingValidationIssue = {
  code: string
  message: string
  severity: "blocking" | "warning"
}

export type GstFilingValidationResult = {
  canSubmit: boolean
  blockingIssues: GstFilingValidationIssue[]
  warnings: GstFilingValidationIssue[]
  payloadHash: string
  schemaVersion: string
}

export type CanonicalFilingPayload = {
  returnType: GstFilingReturnType
  gstin: string
  period: string
  schemaVersion: string
  reportingRun: {
    id: string
    version: number
    sourceDataHash: string
    generatedAt: string | null
    approvedAt: string | null
    readyForSubmissionAt: string | null
  }
  sections: unknown
  totals: unknown
  generatedAt: string
}

export type MockAdapterResult = {
  status: Extract<
    GstFilingStatus,
    "PROCESSING" | "ACCEPTED" | "REJECTED" | "FAILED" | "FILED"
  >
  externalReference: string | null
  acknowledgementNumber: string | null
  acknowledgementDate: string | null
  errorCode: string | null
  errorMessage: string | null
  rawResponse: Record<string, unknown>
}

const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const hsnSacPattern = /^\d{4,8}$/
const moneyTolerance = 0.01

export function schemaVersionForReturnType(returnType: GstFilingReturnType) {
  return returnType === "GSTR1" ? "gstr1:v1" : "gstr3b:v1"
}

export function buildFilingOperationRequestHash(payload: unknown) {
  return hashPayload(removeIdempotencyKey(payload))
}

export function hashPayload(payload: unknown) {
  return createHash("sha256").update(stableStringify(payload)).digest("hex")
}

export function validateCanonicalPayload(payload: CanonicalFilingPayload) {
  const blockingIssues: GstFilingValidationIssue[] = []
  const warnings: GstFilingValidationIssue[] = []

  if (!payload.gstin) {
    blockingIssues.push({
      code: "GSTIN_REQUIRED",
      message: "GSTIN snapshot is required before filing.",
      severity: "blocking",
    })
  } else if (!gstinPattern.test(payload.gstin)) {
    blockingIssues.push({
      code: "GSTIN_INVALID",
      message: "GSTIN snapshot is not in a valid GSTIN format.",
      severity: "blocking",
    })
  }

  if (payload.schemaVersion !== schemaVersionForReturnType(payload.returnType)) {
    blockingIssues.push({
      code: "SCHEMA_VERSION_MISMATCH",
      message: "Filing payload schema version does not match the return type.",
      severity: "blocking",
    })
  }

  if (!payload.reportingRun.sourceDataHash) {
    blockingIssues.push({
      code: "SOURCE_HASH_REQUIRED",
      message: "Reporting source hash is required before filing.",
      severity: "blocking",
    })
  }

  if (!payload.reportingRun.approvedAt) {
    blockingIssues.push({
      code: "CA_APPROVAL_REQUIRED",
      message: "CA approval is required before filing submission.",
      severity: "blocking",
    })
  }

  if (!payload.reportingRun.readyForSubmissionAt) {
    blockingIssues.push({
      code: "READY_FOR_SUBMISSION_REQUIRED",
      message: "The GST report must be marked ready for submission first.",
      severity: "blocking",
    })
  }

  const gstr1Sections = getGstr1Sections(payload.sections)
  const gstr1HsnRows = getArrayProperty(payload.sections, "hsn")
  const gstr1FactRows = getArrayProperty(payload.sections, "rows")

  if (payload.returnType === "GSTR1" && !Array.isArray(gstr1Sections)) {
    blockingIssues.push({
      code: "GSTR1_SECTIONS_REQUIRED",
      message: "GSTR-1 filing payload needs section rows.",
      severity: "blocking",
    })
  }

  if (payload.returnType === "GSTR3B" && !payload.totals) {
    blockingIssues.push({
      code: "GSTR3B_TOTALS_REQUIRED",
      message: "GSTR-3B filing payload needs tax totals.",
      severity: "blocking",
    })
  }

  if (payload.returnType === "GSTR1") {
    validateGstr1Totals(payload, gstr1Sections, blockingIssues)
    validateHsnSacRows([...gstr1HsnRows, ...gstr1FactRows], blockingIssues)
    validateBlockingExceptions(payload.sections, blockingIssues)
  }

  if (payload.returnType === "GSTR3B") {
    validateGstr3bTotals(payload, blockingIssues)
  }

  if (payload.returnType === "GSTR1" && Array.isArray(gstr1Sections) && gstr1Sections.length === 0) {
    warnings.push({
      code: "EMPTY_GSTR1",
      message: "GSTR-1 has no outward supply rows for this period.",
      severity: "warning",
    })
  }

  return {
    canSubmit: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    payloadHash: hashCanonicalPayload(payload),
    schemaVersion: payload.schemaVersion,
  } satisfies GstFilingValidationResult
}

function getGstr1Sections(sections: unknown) {
  if (Array.isArray(sections)) {
    return sections
  }

  if (sections && typeof sections === "object" && "sections" in sections) {
    return (sections as { sections?: unknown }).sections
  }

  return null
}

function validateGstr1Totals(
  payload: CanonicalFilingPayload,
  sections: unknown,
  blockingIssues: GstFilingValidationIssue[]
) {
  if (!Array.isArray(sections)) {
    return
  }

  const sectionTax = sumNumericField(sections, "totalTax")
  const totalTax = getNumericProperty(payload.totals, "totalTax")

  if (totalTax !== null && Math.abs(sectionTax - totalTax) > moneyTolerance) {
    blockingIssues.push({
      code: "TAX_TOTAL_MISMATCH",
      message: "GSTR-1 section tax total does not match the payload tax total.",
      severity: "blocking",
    })
  }
}

function validateGstr3bTotals(
  payload: CanonicalFilingPayload,
  blockingIssues: GstFilingValidationIssue[]
) {
  const outward = getArrayProperty(payload.sections, "outward")
  const outputTax = getNumericProperty(payload.totals, "outputTax")

  if (outputTax !== null && outward.length > 0) {
    const outwardTax = sumNumericField(outward, "totalTax")

    if (Math.abs(outwardTax - outputTax) > moneyTolerance) {
      blockingIssues.push({
        code: "TAX_TOTAL_MISMATCH",
        message: "GSTR-3B outward tax total does not match the payload output tax.",
        severity: "blocking",
      })
    }
  }

  const itc = getObjectProperty(payload.sections, "itc")
  const claimedItc = getNumericProperty(payload.totals, "claimedItc")

  if (claimedItc !== null && itc) {
    const componentTotal = [
      "claimedCgst",
      "claimedSgst",
      "claimedIgst",
      "claimedCess",
    ].reduce((total, key) => total + (getNumericProperty(itc, key) ?? 0), 0)

    if (Math.abs(componentTotal - claimedItc) > moneyTolerance) {
      blockingIssues.push({
        code: "ITC_TOTAL_MISMATCH",
        message: "GSTR-3B claimed ITC total does not match the ITC component totals.",
        severity: "blocking",
      })
    }
  }
}

function validateHsnSacRows(
  rows: unknown[],
  blockingIssues: GstFilingValidationIssue[]
) {
  const invalidRow = rows.find((row) => {
    const value = getStringProperty(row, "hsnSac")

    return value !== null && value.length > 0 && !hsnSacPattern.test(value)
  })

  if (invalidRow) {
    blockingIssues.push({
      code: "INVALID_HSN_SAC",
      message: "GSTR-1 contains an invalid HSN/SAC code.",
      severity: "blocking",
    })
  }
}

function validateBlockingExceptions(
  sections: unknown,
  blockingIssues: GstFilingValidationIssue[]
) {
  const exceptions = getArrayProperty(sections, "exceptions")
  const hasBlockingException = exceptions.some((exception) => {
    if (!exception || typeof exception !== "object") {
      return false
    }

    return (exception as { isBlocking?: unknown }).isBlocking === true
  })

  if (hasBlockingException) {
    blockingIssues.push({
      code: "BLOCKING_EXCEPTION",
      message: "Resolve blocking filing exceptions before submission.",
      severity: "blocking",
    })
  }
}

function getArrayProperty(value: unknown, property: string) {
  if (!value || typeof value !== "object" || !(property in value)) {
    return []
  }

  const entry = (value as Record<string, unknown>)[property]
  return Array.isArray(entry) ? entry : []
}

function getObjectProperty(value: unknown, property: string) {
  if (!value || typeof value !== "object" || !(property in value)) {
    return null
  }

  const entry = (value as Record<string, unknown>)[property]
  return entry && typeof entry === "object" && !Array.isArray(entry) ? entry : null
}

function getNumericProperty(value: unknown, property: string) {
  if (!value || typeof value !== "object" || !(property in value)) {
    return null
  }

  const rawValue = (value as Record<string, unknown>)[property]
  const parsed = Number(rawValue)

  return Number.isFinite(parsed) ? parsed : null
}

function getStringProperty(value: unknown, property: string) {
  if (!value || typeof value !== "object" || !(property in value)) {
    return null
  }

  const rawValue = (value as Record<string, unknown>)[property]

  return typeof rawValue === "string" ? rawValue.trim() : null
}

function sumNumericField(rows: unknown[], property: string): number {
  return rows.reduce<number>(
    (total, row) => total + (getNumericProperty(row, property) ?? 0),
    0
  )
}

export function hashCanonicalPayload(payload: CanonicalFilingPayload) {
  const hashablePayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => key !== "generatedAt")
  )

  return hashPayload(hashablePayload)
}

export function assertFilingStatusTransition(
  currentStatus: string,
  allowedStatuses: GstFilingStatus[],
  action: string
) {
  if (!allowedStatuses.includes(currentStatus as GstFilingStatus)) {
    return {
      valid: false,
      message: `GST filing run status ${currentStatus} cannot ${action}.`,
    }
  }

  return { valid: true, message: null }
}

export function shouldRecoverExistingFilingSubmission(input: {
  status: string
  externalReference: string | null
}) {
  return (
    gstFilingExternalSubmissionProtectedStatuses.some(
      (status) => status === input.status
    ) || Boolean(input.externalReference)
  )
}

export function canRetryFilingTechnically(status: string) {
  return status === "FAILED"
}

export function requiresFilingBusinessCorrection(status: string) {
  return status === "REJECTED"
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
