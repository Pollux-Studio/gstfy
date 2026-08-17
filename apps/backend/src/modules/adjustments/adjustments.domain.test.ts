import assert from "node:assert/strict"
import test from "node:test"

import {
  assertReturnQuantityWithinLimit,
  buildAdjustmentOperationRequestHash,
  calculateReturnableQuantity,
  formatQuantity,
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
