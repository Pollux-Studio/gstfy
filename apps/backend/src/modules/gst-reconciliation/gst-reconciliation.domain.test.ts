import test from "node:test"
import assert from "node:assert/strict"

import {
  assertAllowedItcTransition,
  buildGstReconciliationRequestHash,
  compareTaxRecords,
  getAllowedItcTransitions,
  normalizeDocumentNumber,
  resolveItcAmountsForStatus,
} from "./gst-reconciliation.domain.js"

const bookRecord = {
  supplierGstin: "33ABCDE1234F1Z5",
  documentNumber: "INV-001/24",
  documentDate: "2026-08-17",
  taxableValue: "10000.00",
  cgst: "900.00",
  sgst: "900.00",
  igst: "0.00",
  cess: "0.00",
}

test("document number normalization removes separators and preserves identity", () => {
  assert.equal(normalizeDocumentNumber(" inv-001/24 "), "INV00124")
  assert.equal(normalizeDocumentNumber("INV#001"), "INV#001")
})

test("tax comparison returns exact match for equal book and external values", () => {
  assert.deepEqual(compareTaxRecords(bookRecord, bookRecord), {
    candidate: true,
    matchStatus: "MATCHED",
    matchConfidence: "EXACT",
    differences: {
      taxableDifference: "0.00",
      cgstDifference: "0.00",
      sgstDifference: "0.00",
      igstDifference: "0.00",
      cessDifference: "0.00",
    },
  })
})

test("tax comparison identifies taxable value mismatch separately", () => {
  const result = compareTaxRecords(bookRecord, {
    ...bookRecord,
    taxableValue: "9900.00",
  })

  assert.equal(result.candidate, true)
  assert.equal(result.matchStatus, "VALUE_MISMATCH")
  assert.equal(result.matchConfidence, "PARTIAL")
  assert.equal(result.differences.taxableDifference, "100.00")
})

test("tax comparison identifies component tax mismatch", () => {
  const result = compareTaxRecords(bookRecord, {
    ...bookRecord,
    cgst: "850.00",
  })

  assert.equal(result.candidate, true)
  assert.equal(result.matchStatus, "TAX_MISMATCH")
  assert.equal(result.differences.cgstDifference, "50.00")
})

test("tax comparison uses component-specific tolerances", () => {
  const result = compareTaxRecords(
    bookRecord,
    {
      ...bookRecord,
      cgst: "899.50",
      sgst: "899.50",
    },
    {
      taxableValueToleranceCents: 0,
      cgstToleranceCents: 50,
      sgstToleranceCents: 50,
      igstToleranceCents: 0,
      cessToleranceCents: 0,
      dateToleranceDays: 0,
    }
  )

  assert.equal(result.matchStatus, "MATCHED")
})

test("tax comparison rejects non-candidate GSTIN or document mismatch", () => {
  const result = compareTaxRecords(bookRecord, {
    ...bookRecord,
    supplierGstin: "33ABCDE1234F1Z6",
  })

  assert.equal(result.candidate, false)
  assert.equal(result.matchStatus, "NO_MATCH")
})

test("partial ITC allocation clamps eligible values to source tax", () => {
  assert.deepEqual(
    resolveItcAmountsForStatus(
      "PARTIALLY_ELIGIBLE",
      { cgst: "900", sgst: "900", igst: "0", cess: "0" },
      { eligibleCgst: "500", eligibleSgst: "1200" }
    ),
    {
      eligibleCgst: "500.00",
      eligibleSgst: "900.00",
      eligibleIgst: "0.00",
      eligibleCess: "0.00",
      ineligibleCgst: "400.00",
      ineligibleSgst: "0.00",
      ineligibleIgst: "0.00",
      ineligibleCess: "0.00",
      deferredCgst: "0.00",
      deferredSgst: "0.00",
      deferredIgst: "0.00",
      deferredCess: "0.00",
    }
  )
})

test("reconciliation idempotency hash ignores idempotency key and object order", () => {
  const left = buildGstReconciliationRequestHash({
    idempotencyKey: "retry-1",
    period: "2026-08",
    records: [{ documentNumber: "INV-1", tax: "100.00" }],
  })
  const right = buildGstReconciliationRequestHash({
    records: [{ tax: "100.00", documentNumber: "INV-1" }],
    period: "2026-08",
    idempotencyKey: "retry-2",
  })

  assert.equal(left, right)
})

test("ITC state machine allows only controlled transitions", () => {
  assert.deepEqual(getAllowedItcTransitions("NOT_REVIEWED"), [
    "ELIGIBLE",
    "PARTIALLY_ELIGIBLE",
    "DEFERRED",
    "INELIGIBLE",
    "REJECTED",
  ])
  assert.doesNotThrow(() => assertAllowedItcTransition("ELIGIBLE", "CLAIMED"))
  assert.doesNotThrow(() => assertAllowedItcTransition("CLAIMED", "REVERSED"))
  assert.throws(() => assertAllowedItcTransition("REVERSED", "CLAIMED"))
  assert.throws(() => assertAllowedItcTransition("REJECTED", "CLAIMED"))
  assert.throws(() => assertAllowedItcTransition("CLAIMED", "ELIGIBLE"))
})
