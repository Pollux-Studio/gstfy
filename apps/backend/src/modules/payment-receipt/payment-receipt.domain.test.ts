import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import assert from "node:assert/strict"

import {
  buildMoneyOperationRequestHash,
  calculateOutstandingCents,
  validateAllocationLimits,
} from "./payment-receipt.domain.js"

test("settlement outstanding uses active allocations only", () => {
  assert.equal(calculateOutstandingCents(50_000, 40_000), 10_000)
  assert.equal(calculateOutstandingCents(50_000, 50_000), 0)
  assert.equal(calculateOutstandingCents(50_000, 70_000), 0)
})

test("allocation limit validation rejects non-positive amounts", () => {
  assert.deepEqual(
    validateAllocationLimits({
      targetOriginalCents: 50_000,
      targetActiveAllocatedCents: 0,
      documentAmountCents: 50_000,
      documentActiveAllocatedCents: 0,
      requestedCents: 0,
    }),
    { valid: false, reason: "amount_not_positive" }
  )
})

test("allocation limit validation rejects target over-allocation", () => {
  assert.deepEqual(
    validateAllocationLimits({
      targetOriginalCents: 50_000,
      targetActiveAllocatedCents: 40_000,
      documentAmountCents: 80_000,
      documentActiveAllocatedCents: 0,
      requestedCents: 30_000,
    }),
    { valid: false, reason: "target_over_allocated" }
  )
})

test("allocation limit validation rejects source document over-allocation", () => {
  assert.deepEqual(
    validateAllocationLimits({
      targetOriginalCents: 90_000,
      targetActiveAllocatedCents: 0,
      documentAmountCents: 50_000,
      documentActiveAllocatedCents: 40_000,
      requestedCents: 20_000,
    }),
    { valid: false, reason: "document_over_allocated" }
  )
})

test("allocation limit validation allows exact settlement", () => {
  assert.deepEqual(
    validateAllocationLimits({
      targetOriginalCents: 50_000,
      targetActiveAllocatedCents: 20_000,
      documentAmountCents: 40_000,
      documentActiveAllocatedCents: 10_000,
      requestedCents: 30_000,
    }),
    { valid: true, reason: null }
  )
})

test("idempotency hash ignores idempotencyKey and object key order", () => {
  const left = buildMoneyOperationRequestHash({
    idempotencyKey: "retry-1",
    amount: "100.00",
    allocations: [{ receivablePayableEntryId: "entry-1", allocatedAmount: "50.00" }],
  })
  const right = buildMoneyOperationRequestHash({
    allocations: [{ allocatedAmount: "50.00", receivablePayableEntryId: "entry-1" }],
    amount: "100.00",
    idempotencyKey: "retry-2",
  })

  assert.equal(left, right)
})

test("idempotency hash changes when meaningful payload changes", () => {
  assert.notEqual(
    buildMoneyOperationRequestHash({ amount: "100.00" }),
    buildMoneyOperationRequestHash({ amount: "101.00" })
  )
})

test("production migration contains row locks and over-allocation guards", async () => {
  const migration = await readFile(
    join(process.cwd(), "drizzle", "0035_payment_receipt_production_guards.sql"),
    "utf8"
  )

  assert.match(migration, /for update/i)
  assert.match(migration, /Allocation exceeds target outstanding amount/i)
  assert.match(migration, /Allocation exceeds receipt amount/i)
  assert.match(migration, /Allocation exceeds payment amount/i)
})
