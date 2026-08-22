import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  classifyAdjustment,
  classifyOutwardSupply,
  createXlsxExport,
  periodToRange,
} from "./gst-reporting.domain.js"

describe("gst-reporting domain", () => {
  it("classifies outward supplies without using report-specific logic in source modules", () => {
    assert.equal(classifyOutwardSupply({ supplyType: "b2b" }), "B2B")
    assert.equal(classifyOutwardSupply({ partyGstin: "33ABCDE1234F1Z5" }), "B2B")
    assert.equal(classifyOutwardSupply({ supplyType: "b2c" }), "B2C")
    assert.equal(classifyOutwardSupply({ supplyType: "export" }), "EXPORT")
    assert.equal(classifyOutwardSupply({ invoiceType: "sez" }), "SEZ")
    assert.equal(classifyOutwardSupply({ taxability: "NIL_RATED" }), "NIL_RATED")
    assert.equal(classifyOutwardSupply({ taxability: "EXEMPT" }), "EXEMPT")
    assert.equal(classifyOutwardSupply({ taxability: "NON_GST" }), "NON_GST")
  })

  it("maps adjustments into report-facing note classifications", () => {
    assert.equal(classifyAdjustment("SALES_RETURN"), "CREDIT_NOTE")
    assert.equal(classifyAdjustment("CREDIT_NOTE"), "CREDIT_NOTE")
    assert.equal(classifyAdjustment("PURCHASE_RETURN"), "DEBIT_NOTE")
    assert.equal(classifyAdjustment("DEBIT_NOTE"), "DEBIT_NOTE")
  })

  it("converts GST period to inclusive/exclusive date range", () => {
    assert.deepEqual(periodToRange("2026-08"), {
      start: "2026-08-01",
      endInclusive: "2026-08-31",
      endExclusive: "2026-09-01",
    })
  })

  it("creates a real xlsx zip payload without external dependencies", () => {
    const result = createXlsxExport("gstr1.xlsx", [
      {
        name: "GSTR-1",
        headers: ["Section", "Tax"],
        rows: [["B2B", "100.00"]],
      },
    ])
    const bytes = Buffer.from(result.content, "base64")

    assert.equal(result.contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    assert.equal(bytes.subarray(0, 2).toString("utf8"), "PK")
    assert.ok(bytes.length > 100)
  })
})
