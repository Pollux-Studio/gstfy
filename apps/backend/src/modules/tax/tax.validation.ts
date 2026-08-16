import { HttpError } from "../../utils/http-error.js"
import { formatCents, toCents } from "../core/core.validation.js"
import type { TaxCalculationContext, TaxLineInput } from "./tax.types.js"
import { taxError } from "./tax.errors.js"

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const stateCodePattern = /^\d{2}$/

export function parsePositiveQuantity(value: string, lineNumber: number) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new HttpError(400, `Line ${lineNumber} must have a positive quantity.`)
  }

  return parsed
}

export function parseNonNegativeRate(value: string, label: string) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new HttpError(400, `${label} must be a valid non-negative number.`)
  }

  return parsed
}

export function calculateLineAmountCents(quantity: string, rate: string, lineNumber: number) {
  const quantityValue = parsePositiveQuantity(quantity, lineNumber)
  const rateValue = parseNonNegativeRate(rate, `Line ${lineNumber} rate`)
  const amountCents = Math.round(quantityValue * rateValue * 100)

  if (amountCents <= 0) {
    throw new HttpError(400, `Line ${lineNumber} must have a positive taxable value.`)
  }

  return amountCents
}

export function normalizeRate(value: string | null | undefined) {
  const rate = parseNonNegativeRate(String(value ?? "0").trim() || "0", "GST rate")

  if (rate > 100) {
    throw taxError("INVALID_GST_RATE", "GST rate cannot exceed 100%.", "gstRate")
  }

  return formatRate(rate)
}

export function normalizeDiscountCents(value: string | null | undefined) {
  if (!value) {
    return 0
  }

  const cents = toCents(value)

  if (cents < 0) {
    throw new HttpError(400, "Discount amount must be a valid non-negative number.")
  }

  return cents
}

export function formatRate(value: number) {
  return value.toFixed(2)
}

export function formatMoney(value: number) {
  return formatCents(value)
}

export function validateTaxContext(
  lines: TaxLineInput[],
  context: TaxCalculationContext
) {
  if (!datePattern.test(context.transactionDate)) {
    throw new HttpError(400, "Transaction date must be in YYYY-MM-DD format.")
  }

  if (!stateCodePattern.test(context.sellerStateCode)) {
    throw taxError(
      "INVALID_TAX_REGISTRATION",
      "Seller GST state code is invalid.",
      "sellerStateCode"
    )
  }

  if (!context.placeOfSupplyStateCode) {
    throw taxError(
      "PLACE_OF_SUPPLY_REQUIRED",
      "Place of supply is required for GST calculation.",
      "placeOfSupplyStateCode"
    )
  }

  if (!stateCodePattern.test(context.placeOfSupplyStateCode)) {
    throw taxError(
      "PLACE_OF_SUPPLY_INVALID",
      "Place of supply state code is invalid.",
      "placeOfSupplyStateCode"
    )
  }

  if (context.reverseCharge && context.transactionType !== "purchase") {
    throw taxError(
      "INVALID_REVERSE_CHARGE_CONTEXT",
      "Reverse charge is only supported for purchase-side tax treatment.",
      "reverseCharge"
    )
  }

  for (const [index, line] of lines.entries()) {
    if (line.taxability === "TAXABLE" && line.hsnSacCode !== undefined && line.hsnSacCode !== null) {
      const code = line.hsnSacCode.trim()

      if (code.length > 0 && !/^\d{4,8}$/.test(code)) {
        throw taxError(
          "INVALID_HSN_SAC",
          `Line ${index + 1} has an invalid HSN/SAC code.`,
          `lines.${index}.hsnSacCode`
        )
      }
    }
  }
}
