import assert from "node:assert/strict"
import test from "node:test"

import { HttpError } from "../../utils/http-error.js"
import {
  assertInternalPostingKey,
  validateBalancedJournal,
} from "./core.validation.js"

test("missing internal posting key is rejected", () => {
  assert.throws(
    () => assertInternalPostingKey(undefined, "expected-key"),
    (error) => error instanceof HttpError && error.statusCode === 403
  )
})

test("invalid internal posting key is rejected", () => {
  assert.throws(
    () => assertInternalPostingKey("wrong-key", "expected-key"),
    (error) => error instanceof HttpError && error.statusCode === 403
  )
})

test("valid internal posting key is accepted", () => {
  assert.doesNotThrow(() => assertInternalPostingKey("expected-key", "expected-key"))
})

test("balanced debit-only and credit-only journal lines are accepted", () => {
  assert.doesNotThrow(() =>
    validateBalancedJournal({
      journal: {
        lines: [
          { debit: "1000.00", credit: "0" },
          { debit: "0", credit: "1000.00" },
        ],
      },
    })
  )
})

test("journal line with both debit and credit is rejected", () => {
  assert.throws(
    () =>
      validateBalancedJournal({
        journal: {
          lines: [
            { debit: "1000.00", credit: "100.00" },
            { debit: "0", credit: "900.00" },
          ],
        },
      }),
    (error) => error instanceof HttpError && error.statusCode === 400
  )
})

test("negative journal values are rejected", () => {
  assert.throws(
    () =>
      validateBalancedJournal({
        journal: {
          lines: [
            { debit: "-1000.00", credit: "0" },
            { debit: "0", credit: "1000.00" },
          ],
        },
      }),
    (error) => error instanceof HttpError && error.statusCode === 400
  )
})

test("unbalanced journal is rejected", () => {
  assert.throws(
    () =>
      validateBalancedJournal({
        journal: {
          lines: [
            { debit: "1000.00", credit: "0" },
            { debit: "0", credit: "900.00" },
          ],
        },
      }),
    (error) => error instanceof HttpError && error.statusCode === 400
  )
})
