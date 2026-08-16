import assert from "node:assert/strict"
import test from "node:test"

import { calculateTax } from "./tax-engine.service.js"

const baseLine = {
  itemName: "Test item",
  quantity: "2",
  unit: "PCS",
  rate: "1000.00",
  gstRate: "18.00",
}

test("calculates intra-state GST as equal CGST and SGST", () => {
  const result = calculateTax([baseLine], {
    transactionDate: "2026-08-16",
    transactionType: "sales",
    sellerStateCode: "33",
    placeOfSupplyStateCode: "33",
  })

  assert.equal(result.classification, "B2B")
  assert.equal(result.supplyLocationTreatment, "INTRA_STATE")
  assert.equal(result.totals.taxableValue, "2000.00")
  assert.equal(result.totals.cgstAmount, "180.00")
  assert.equal(result.totals.sgstAmount, "180.00")
  assert.equal(result.totals.igstAmount, "0.00")
  assert.equal(result.totals.totalAmount, "2360.00")
})

test("calculates inter-state GST as IGST", () => {
  const result = calculateTax([baseLine], {
    transactionDate: "2026-08-16",
    transactionType: "sales",
    sellerStateCode: "33",
    placeOfSupplyStateCode: "29",
  })

  assert.equal(result.classification, "B2B")
  assert.equal(result.supplyLocationTreatment, "INTER_STATE")
  assert.equal(result.totals.cgstAmount, "0.00")
  assert.equal(result.totals.sgstAmount, "0.00")
  assert.equal(result.totals.igstAmount, "360.00")
  assert.equal(result.taxBreakup[0]?.taxRate, "18.00")
})

test("keeps multiple GST rates as separate tax breakup rows", () => {
  const result = calculateTax(
    [
      baseLine,
      {
        ...baseLine,
        itemName: "Reduced GST item",
        quantity: "1",
        gstRate: "5.00",
      },
    ],
    {
      transactionDate: "2026-08-16",
      transactionType: "sales",
      sellerStateCode: "33",
      placeOfSupplyStateCode: "33",
    }
  )

  const cgstBreakup = result.taxBreakup.filter((entry) => entry.component === "cgst")

  assert.equal(cgstBreakup.length, 2)
  assert.deepEqual(
    cgstBreakup.map((entry) => entry.taxRate).sort(),
    ["2.50", "9.00"]
  )
})

test("supports exempt and nil-rated lines without tax", () => {
  const result = calculateTax(
    [
      {
        ...baseLine,
        taxability: "EXEMPT",
        gstRate: "18.00",
      },
      {
        ...baseLine,
        taxability: "NIL_RATED",
        gstRate: "5.00",
      },
    ],
    {
      transactionDate: "2026-08-16",
      transactionType: "sales",
      sellerStateCode: "33",
      placeOfSupplyStateCode: "33",
    }
  )

  assert.equal(result.totals.taxableValue, "4000.00")
  assert.equal(result.totals.totalTax, "0.00")
  assert.equal(result.taxBreakup.length, 0)
})

test("calculates tax-inclusive pricing using the same engine", () => {
  const result = calculateTax(
    [
      {
        ...baseLine,
        quantity: "1",
        rate: "1180.00",
        pricingMode: "tax_inclusive",
      },
    ],
    {
      transactionDate: "2026-08-16",
      transactionType: "pos",
      sellerStateCode: "33",
      placeOfSupplyStateCode: "33",
    }
  )

  assert.equal(result.totals.taxableValue, "1000.00")
  assert.equal(result.totals.totalTax, "180.00")
  assert.equal(result.totals.totalAmount, "1180.00")
})

test("applies line discounts before tax", () => {
  const result = calculateTax(
    [
      {
        ...baseLine,
        quantity: "1",
        discountAmount: "100.00",
      },
    ],
    {
      transactionDate: "2026-08-16",
      transactionType: "sales",
      sellerStateCode: "33",
      placeOfSupplyStateCode: "33",
    }
  )

  assert.equal(result.lines[0]?.grossValue, "1000.00")
  assert.equal(result.lines[0]?.discountAmount, "100.00")
  assert.equal(result.totals.taxableValue, "900.00")
  assert.equal(result.totals.totalTax, "162.00")
})

test("separates taxable and non-taxable charges", () => {
  const result = calculateTax(
    [
      {
        ...baseLine,
        quantity: "1",
        otherCharges: [
          {
            chargeType: "packing",
            amount: "50.00",
            taxTreatment: "taxable",
          },
          {
            chargeType: "rounding_adjustment",
            amount: "20.00",
            taxTreatment: "non_taxable",
          },
        ],
      },
    ],
    {
      transactionDate: "2026-08-16",
      transactionType: "sales",
      sellerStateCode: "33",
      placeOfSupplyStateCode: "33",
    }
  )

  assert.equal(result.lines[0]?.taxableCharges, "50.00")
  assert.equal(result.lines[0]?.nonTaxableCharges, "20.00")
  assert.equal(result.totals.taxableValue, "1050.00")
  assert.equal(result.totals.totalAmount, "1259.00")
})
