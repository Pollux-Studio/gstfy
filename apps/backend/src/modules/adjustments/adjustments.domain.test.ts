import assert from "node:assert/strict"
import test from "node:test"

import {
  assertReturnQuantityWithinLimit,
  buildAdjustmentOperationRequestHash,
  calculateReturnableQuantity,
  formatQuantity,
  resolveAdjustmentFinancialDirection,
  resolveAdjustmentIssuerContext,
} from "./adjustments.domain.js"

test("calculateReturnableQuantity subtracts previous valid returns", () => {
  assert.equal(
    formatQuantity(
      calculateReturnableQuantity({
        originalQuantity: "10",
        previouslyReturnedQuantity: "2.500",
      })
    ),
    "7.5"
  )
})

test("assertReturnQuantityWithinLimit blocks over-return", () => {
  assert.deepEqual(
    assertReturnQuantityWithinLimit({
      requestedQuantity: "8",
      originalQuantity: "10",
      previouslyReturnedQuantity: "3",
    }),
    { valid: false, reason: "return_quantity_exceeded" }
  )
})

test("assertReturnQuantityWithinLimit accepts remaining quantity", () => {
  assert.deepEqual(
    assertReturnQuantityWithinLimit({
      requestedQuantity: "7",
      originalQuantity: "10",
      previouslyReturnedQuantity: "3",
    }),
    { valid: true, reason: null }
  )
})

test("buildAdjustmentOperationRequestHash ignores idempotency key", () => {
  const left = buildAdjustmentOperationRequestHash({
    idempotencyKey: "first",
    lines: [{ quantity: "1", originalLineId: "line-1" }],
  })
  const right = buildAdjustmentOperationRequestHash({
    idempotencyKey: "second",
    lines: [{ originalLineId: "line-1", quantity: "1" }],
  })

  assert.equal(left, right)
})

test("customer debit note increases receivable and output tax", () => {
  assert.deepEqual(
    resolveAdjustmentIssuerContext({
      type: "DEBIT_NOTE",
      sourceDocumentType: "sales_invoice",
      issuerType: "GSTFY_BUSINESS",
      documentDirection: "outgoing",
      sourcePartyRole: "customer",
    }),
    {
      valid: true,
      reason: null,
      context: {
        issuerType: "GSTFY_BUSINESS",
        documentDirection: "outgoing",
        sourcePartyRole: "customer",
      },
    }
  )
  assert.deepEqual(
    resolveAdjustmentFinancialDirection({
      type: "DEBIT_NOTE",
      sourceDocumentType: "sales_invoice",
    }),
    {
      arApEntryType: "receivable",
      arApEffect: "increase",
      taxKind: "output",
      taxSide: "credit",
    }
  )
})

test("supplier debit note increases payable and input tax", () => {
  assert.deepEqual(
    resolveAdjustmentIssuerContext({
      type: "DEBIT_NOTE",
      sourceDocumentType: "purchase_bill",
      issuerType: "SUPPLIER",
      documentDirection: "incoming",
      sourcePartyRole: "supplier",
    }),
    {
      valid: true,
      reason: null,
      context: {
        issuerType: "SUPPLIER",
        documentDirection: "incoming",
        sourcePartyRole: "supplier",
      },
    }
  )
  assert.deepEqual(
    resolveAdjustmentFinancialDirection({
      type: "DEBIT_NOTE",
      sourceDocumentType: "purchase_bill",
    }),
    {
      arApEntryType: "payable",
      arApEffect: "increase",
      taxKind: "input",
      taxSide: "debit",
    }
  )
})

test("debit note context rejects wrong issuer direction for purchase source", () => {
  const result = resolveAdjustmentIssuerContext({
    type: "DEBIT_NOTE",
    sourceDocumentType: "purchase_bill",
    issuerType: "GSTFY_BUSINESS",
    documentDirection: "outgoing",
    sourcePartyRole: "supplier",
  })

  assert.equal(result.valid, false)
  assert.equal(
    result.reason,
    "Supplier debit notes must be incoming supplier-issued documents."
  )
})
