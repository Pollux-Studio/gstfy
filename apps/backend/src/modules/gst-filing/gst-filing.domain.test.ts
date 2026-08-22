import assert from "node:assert/strict"
import test from "node:test"

import {
  assertFilingStatusTransition,
  buildFilingOperationRequestHash,
  canRetryFilingTechnically,
  hashCanonicalPayload,
  requiresFilingBusinessCorrection,
  schemaVersionForReturnType,
  shouldRecoverExistingFilingSubmission,
  validateCanonicalPayload,
  type CanonicalFilingPayload,
} from "./gst-filing.domain.js"
import { mockGstFilingAdapter } from "./gst-filing.adapters.js"

test("filing operation hash ignores idempotency key and object key order", () => {
  const left = buildFilingOperationRequestHash({
    idempotencyKey: "first-key",
    returnType: "GSTR1",
    reportingRunId: "run-1",
  })
  const right = buildFilingOperationRequestHash({
    reportingRunId: "run-1",
    returnType: "GSTR1",
    idempotencyKey: "second-key",
  })

  assert.equal(left, right)
})

test("canonical payload hash ignores generated timestamp", () => {
  const base = makeCanonicalPayload()

  assert.equal(
    hashCanonicalPayload(base),
    hashCanonicalPayload({ ...base, generatedAt: "2026-08-22T11:00:00.000Z" })
  )
})

test("filing validation blocks payloads without approval and source hash", () => {
  const result = validateCanonicalPayload({
    ...makeCanonicalPayload(),
    reportingRun: {
      ...makeCanonicalPayload().reportingRun,
      sourceDataHash: "",
      approvedAt: null,
    },
  })

  assert.equal(result.canSubmit, false)
  assert.deepEqual(
    result.blockingIssues.map((issue) => issue.code).sort(),
    ["CA_APPROVAL_REQUIRED", "SOURCE_HASH_REQUIRED"].sort()
  )
})

test("filing validation accepts a ready canonical payload", () => {
  const result = validateCanonicalPayload(makeCanonicalPayload())

  assert.equal(result.canSubmit, true)
  assert.equal(result.schemaVersion, "gstr1:v1")
  assert.equal(result.blockingIssues.length, 0)
})

test("filing validation accepts a valid GSTR-3B payload", () => {
  const result = validateCanonicalPayload(makeGstr3bPayload())

  assert.equal(result.canSubmit, true)
  assert.equal(result.schemaVersion, "gstr3b:v1")
  assert.equal(result.blockingIssues.length, 0)
})

test("filing validation accepts generated GSTR-1 object sections", () => {
  const result = validateCanonicalPayload({
    ...makeCanonicalPayload(),
    sections: {
      sections: [
        {
          classification: "B2B",
          taxableValue: "1000.00",
          totalTax: "180.00",
        },
      ],
      hsn: [],
      documents: [],
      rows: [],
    },
  })

  assert.equal(result.canSubmit, true)
  assert.equal(result.blockingIssues.length, 0)
})

test("filing validation blocks invalid GSTIN", () => {
  const result = validateCanonicalPayload({
    ...makeCanonicalPayload(),
    gstin: "INVALID",
  })

  assert.equal(result.canSubmit, false)
  assert.ok(result.blockingIssues.some((issue) => issue.code === "GSTIN_INVALID"))
})

test("filing validation blocks schema version mismatch", () => {
  const result = validateCanonicalPayload({
    ...makeCanonicalPayload(),
    schemaVersion: "gstr1:v2",
  })

  assert.equal(result.canSubmit, false)
  assert.ok(result.blockingIssues.some((issue) => issue.code === "SCHEMA_VERSION_MISMATCH"))
})

test("filing validation blocks GSTR-1 tax mismatch", () => {
  const result = validateCanonicalPayload({
    ...makeCanonicalPayload(),
    totals: {
      taxableValue: "1000.00",
      totalTax: "179.00",
    },
  })

  assert.equal(result.canSubmit, false)
  assert.ok(result.blockingIssues.some((issue) => issue.code === "TAX_TOTAL_MISMATCH"))
})

test("filing validation blocks GSTR-3B ITC mismatch", () => {
  const result = validateCanonicalPayload({
    ...makeGstr3bPayload(),
    totals: {
      outputTax: "180.00",
      claimedItc: "100.00",
      netGst: "80.00",
    },
  })

  assert.equal(result.canSubmit, false)
  assert.ok(result.blockingIssues.some((issue) => issue.code === "ITC_TOTAL_MISMATCH"))
})

test("filing validation blocks invalid HSN/SAC rows", () => {
  const result = validateCanonicalPayload({
    ...makeCanonicalPayload(),
    sections: {
      sections: [
        {
          classification: "B2B",
          taxableValue: "1000.00",
          totalTax: "180.00",
        },
      ],
      hsn: [{ hsnSac: "ABC", totalTax: "180.00" }],
      documents: [],
      rows: [],
    },
  })

  assert.equal(result.canSubmit, false)
  assert.ok(result.blockingIssues.some((issue) => issue.code === "INVALID_HSN_SAC"))
})

test("filing validation blocks unresolved filing exceptions", () => {
  const result = validateCanonicalPayload({
    ...makeCanonicalPayload(),
    sections: {
      sections: [
        {
          classification: "B2B",
          taxableValue: "1000.00",
          totalTax: "180.00",
        },
      ],
      exceptions: [{ isBlocking: true }],
    },
  })

  assert.equal(result.canSubmit, false)
  assert.ok(result.blockingIssues.some((issue) => issue.code === "BLOCKING_EXCEPTION"))
})

test("filing status transition guard blocks invalid action", () => {
  assert.deepEqual(
    assertFilingStatusTransition("FILED", ["DRAFT"], "be edited"),
    {
      valid: false,
      message: "GST filing run status FILED cannot be edited.",
    }
  )
})

test("filing retry rules separate technical failure from business rejection", () => {
  assert.equal(canRetryFilingTechnically("FAILED"), true)
  assert.equal(canRetryFilingTechnically("REJECTED"), false)
  assert.equal(requiresFilingBusinessCorrection("REJECTED"), true)
  assert.equal(requiresFilingBusinessCorrection("FAILED"), false)
})

test("filing submission recovery protects processing and externally referenced runs", () => {
  assert.equal(
    shouldRecoverExistingFilingSubmission({
      status: "PROCESSING",
      externalReference: null,
    }),
    true
  )
  assert.equal(
    shouldRecoverExistingFilingSubmission({
      status: "FAILED",
      externalReference: "GSTN-123",
    }),
    true
  )
  assert.equal(
    shouldRecoverExistingFilingSubmission({
      status: "READY_FOR_SUBMISSION",
      externalReference: null,
    }),
    false
  )
})

test("mock adapter supports accept, reject, processing, and filed polling", () => {
  const accepted = mockGstFilingAdapter.submit({
    mode: "MOCK_ACCEPT",
    returnType: "GSTR1",
    period: "2026-08",
  })
  const rejected = mockGstFilingAdapter.submit({
    mode: "MOCK_REJECT",
    returnType: "GSTR3B",
    period: "2026-08",
  })
  const processing = mockGstFilingAdapter.submit({
    mode: "MOCK_PROCESSING",
    returnType: "GSTR1",
    period: "2026-08",
  })
  const timeout = mockGstFilingAdapter.submit({
    mode: "MOCK_TIMEOUT",
    returnType: "GSTR1",
    period: "2026-08",
  })

  assert.equal(accepted.status, "ACCEPTED")
  assert.match(accepted.acknowledgementNumber ?? "", /^ACK-/)
  assert.equal(rejected.status, "REJECTED")
  assert.equal(rejected.errorCode, "MOCK_REJECTED")
  assert.equal(processing.status, "PROCESSING")
  assert.equal(timeout.status, "FAILED")
  assert.equal(timeout.errorCode, "MOCK_TIMEOUT")

  const polled = mockGstFilingAdapter.getStatus({
    currentStatus: "ACCEPTED",
    mode: "MOCK_ACCEPT",
    externalReference: accepted.externalReference,
  })

  assert.equal(polled.status, "FILED")
})

test("return type schema versions are stable", () => {
  assert.equal(schemaVersionForReturnType("GSTR1"), "gstr1:v1")
  assert.equal(schemaVersionForReturnType("GSTR3B"), "gstr3b:v1")
})

function makeCanonicalPayload(): CanonicalFilingPayload {
  return {
    returnType: "GSTR1",
    gstin: "33ABCDE1234F1Z5",
    period: "2026-08",
    schemaVersion: "gstr1:v1",
    reportingRun: {
      id: "report-run-1",
      version: 1,
      sourceDataHash: "source-hash",
      generatedAt: "2026-08-22T10:00:00.000Z",
      approvedAt: "2026-08-22T10:05:00.000Z",
      readyForSubmissionAt: "2026-08-22T10:10:00.000Z",
    },
    sections: [
      {
        classification: "B2B",
        taxableValue: "1000.00",
        totalTax: "180.00",
      },
    ],
    totals: {
      taxableValue: "1000.00",
      totalTax: "180.00",
    },
    generatedAt: "2026-08-22T10:15:00.000Z",
  }
}

function makeGstr3bPayload(): CanonicalFilingPayload {
  return {
    returnType: "GSTR3B",
    gstin: "33ABCDE1234F1Z5",
    period: "2026-08",
    schemaVersion: "gstr3b:v1",
    reportingRun: {
      id: "report-run-1",
      version: 1,
      sourceDataHash: "source-hash",
      generatedAt: "2026-08-22T10:00:00.000Z",
      approvedAt: "2026-08-22T10:05:00.000Z",
      readyForSubmissionAt: "2026-08-22T10:10:00.000Z",
    },
    sections: {
      outward: [
        {
          classification: "B2B",
          taxableValue: "1000.00",
          totalTax: "180.00",
        },
      ],
      itc: {
        claimedCgst: "40.00",
        claimedSgst: "40.00",
        claimedIgst: "10.00",
        claimedCess: "0.00",
      },
    },
    totals: {
      outputTax: "180.00",
      claimedItc: "90.00",
      netGst: "90.00",
    },
    generatedAt: "2026-08-22T10:15:00.000Z",
  }
}
