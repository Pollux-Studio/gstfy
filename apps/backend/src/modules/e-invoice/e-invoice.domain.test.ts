import test from "node:test"
import assert from "node:assert/strict"

import { mockEInvoiceProviderAdapter } from "./e-invoice.adapters.js"
import {
  assertEInvoiceStatusTransition,
  buildEInvoiceOperationRequestHash,
  canRetryEInvoiceTechnically,
  checkEInvoiceEligibility,
  eInvoiceSchemaVersion,
  hashCanonicalEInvoicePayload,
  shouldRecoverExistingEInvoiceSubmission,
  validateCanonicalEInvoicePayload,
  type CanonicalEInvoicePayload,
} from "./e-invoice.domain.js"

test("eligible posted B2B tax invoice can enter e-invoice workflow", () => {
  const result = checkEInvoiceEligibility({
    sourceDocumentType: "sales_invoice",
    status: "posted",
    gstRegistrationId: "8b5f43a8-e99b-4dc4-885e-f96a8b32a9af",
    partyGstin: "33AAAAA0000A1Z5",
    invoiceType: "tax_invoice",
    supplyType: "b2b",
    documentDate: "2026-08-22",
    linesCount: 1,
  })

  assert.equal(result.status, "ELIGIBLE")
  assert.equal(result.reasonCode, "ELIGIBLE_REGISTERED_RECIPIENT")
})

test("B2C sales invoice is not eligible for e-invoice", () => {
  const result = checkEInvoiceEligibility({
    sourceDocumentType: "sales_invoice",
    status: "posted",
    gstRegistrationId: "8b5f43a8-e99b-4dc4-885e-f96a8b32a9af",
    partyGstin: "33AAAAA0000A1Z5",
    invoiceType: "tax_invoice",
    supplyType: "b2c",
    documentDate: "2026-08-22",
    linesCount: 1,
  })

  assert.equal(result.status, "NOT_ELIGIBLE")
  assert.equal(result.reasonCode, "B2B_SUPPLY_REQUIRED")
})

test("existing IRN blocks duplicate generation", () => {
  const result = checkEInvoiceEligibility({
    sourceDocumentType: "sales_invoice",
    status: "posted",
    existingSubmissionStatus: "IRN_GENERATED",
    gstRegistrationId: "8b5f43a8-e99b-4dc4-885e-f96a8b32a9af",
    partyGstin: "33AAAAA0000A1Z5",
    invoiceType: "tax_invoice",
    supplyType: "b2b",
    documentDate: "2026-08-22",
    linesCount: 1,
  })

  assert.equal(result.status, "ALREADY_GENERATED")
})

test("canonical e-invoice payload validates required GST and line totals", () => {
  const payload = buildPayload()
  const result = validateCanonicalEInvoicePayload(payload)

  assert.equal(result.canSubmit, true)
  assert.equal(result.blockingIssues.length, 0)
  assert.equal(result.schemaVersion, eInvoiceSchemaVersion())
})

test("canonical e-invoice payload blocks invalid HSN", () => {
  const payload = buildPayload()
  const firstItem = payload.items[0]
  assert.ok(firstItem)
  payload.items[0] = { ...firstItem, hsnSac: "ABC" }
  const result = validateCanonicalEInvoicePayload(payload)

  assert.equal(result.canSubmit, false)
  assert.equal(result.blockingIssues[0]?.code, "HSN_SAC_INVALID")
})

test("canonical payload hash ignores generatedAt", () => {
  const left = buildPayload()
  const right = { ...left, generatedAt: "2026-08-22T10:00:00.000Z" }

  assert.equal(hashCanonicalEInvoicePayload(left), hashCanonicalEInvoicePayload(right))
})

test("operation hash ignores idempotency key", () => {
  const left = buildEInvoiceOperationRequestHash({
    idempotencyKey: "retry-one",
    sourceDocumentId: "doc-1",
  })
  const right = buildEInvoiceOperationRequestHash({
    idempotencyKey: "retry-two",
    sourceDocumentId: "doc-1",
  })

  assert.equal(left, right)
})

test("mock adapter generates IRN and signed QR metadata", () => {
  const payload = buildPayload()
  const payloadHash = hashCanonicalEInvoicePayload(payload)
  const result = mockEInvoiceProviderAdapter.generateIRN({
    mode: "MOCK_GENERATE",
    payload,
    payloadHash,
  })

  assert.equal(result.status, "IRN_GENERATED")
  assert.equal(result.irn?.length, 64)
  assert.ok(result.ackNumber?.startsWith("ACK-"))
  assert.ok(result.signedQrCode)
})

test("mock adapter supports processing status recovery", () => {
  const result = mockEInvoiceProviderAdapter.getStatus({
    currentStatus: "PROCESSING",
    mode: "MOCK_PROCESSING",
    providerReference: "MOCK-EINV-INV1-123",
    irn: null,
  })

  assert.equal(result.status, "IRN_GENERATED")
  assert.ok(result.irn)
})

test("status transition guard rejects cancellation before IRN", () => {
  const transition = assertEInvoiceStatusTransition("READY", ["IRN_GENERATED"], "cancel")

  assert.equal(transition.valid, false)
})

test("technical retry is limited to failed statuses", () => {
  assert.equal(canRetryEInvoiceTechnically("FAILED"), true)
  assert.equal(canRetryEInvoiceTechnically("READY"), false)
})

test("existing provider reference is recoverable", () => {
  assert.equal(
    shouldRecoverExistingEInvoiceSubmission({
      status: "PROCESSING",
      providerReference: "MOCK-1",
      irn: null,
    }),
    true
  )
})

function buildPayload(): CanonicalEInvoicePayload {
  return {
    schemaVersion: eInvoiceSchemaVersion(),
    source: {
      documentType: "sales_invoice",
      documentId: "7a1f43a8-e99b-4dc4-885e-f96a8b32a9af",
      voucherId: "8b5f43a8-e99b-4dc4-885e-f96a8b32a9af",
    },
    supplier: {
      gstin: "33BBBBB0000B1Z5",
      legalName: "GSTFY Seller Private Limited",
      tradeName: "GSTFY Seller",
      displayName: "GSTFY Seller",
      addressLine1: "Seller Street",
      addressLine2: null,
      locality: "T Nagar",
      city: "Chennai",
      district: "Chennai",
      state: "Tamil Nadu",
      stateCode: "33",
      pincode: "600017",
      country: "India",
    },
    recipient: {
      gstin: "33AAAAA0000A1Z5",
      legalName: "Buyer Private Limited",
      tradeName: "Buyer",
      displayName: "Buyer",
      addressLine1: "Buyer Street",
      addressLine2: null,
      locality: "Pallavaram",
      city: "Chennai",
      district: "Chengalpattu",
      state: "Tamil Nadu",
      stateCode: "33",
      pincode: "600117",
      country: "India",
    },
    document: {
      number: "INV-2026-0001",
      date: "2026-08-22",
      type: "INV",
      supplyType: "b2b",
      placeOfSupplyStateCode: "33",
    },
    items: [
      {
        serialNumber: 1,
        description: "Retail sale item",
        hsnSac: "210690",
        uqc: "PCS",
        quantity: "1.000",
        unitPrice: "1000.00",
        discount: "0.00",
        taxableValue: "1000.00",
        gstRate: "18.00",
        cgstAmount: "90.00",
        sgstAmount: "90.00",
        igstAmount: "0.00",
        cessAmount: "0.00",
        totalAmount: "1180.00",
      },
    ],
    totals: {
      taxableValue: "1000.00",
      cgstAmount: "90.00",
      sgstAmount: "90.00",
      igstAmount: "0.00",
      cessAmount: "0.00",
      totalAmount: "1180.00",
    },
    references: {
      originalDocumentNumber: null,
      originalDocumentDate: null,
      reason: null,
    },
    generatedAt: "2026-08-22T09:00:00.000Z",
  }
}
