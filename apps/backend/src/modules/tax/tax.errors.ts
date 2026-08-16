import { HttpError } from "../../utils/http-error.js"

export type TaxErrorCode =
  | "TAX_REGISTRATION_NOT_FOUND"
  | "INVALID_TAX_REGISTRATION"
  | "PARTY_GST_REGISTRATION_NOT_FOUND"
  | "INVALID_HSN_SAC"
  | "INVALID_TAXABILITY"
  | "TAX_RULE_NOT_FOUND"
  | "AMBIGUOUS_TAX_RULE"
  | "TAX_RULE_EXPIRED"
  | "PLACE_OF_SUPPLY_REQUIRED"
  | "PLACE_OF_SUPPLY_INVALID"
  | "INVALID_GST_RATE"
  | "INVALID_CESS_RULE"
  | "INVALID_REVERSE_CHARGE_CONTEXT"
  | "TAXABLE_VALUE_MISMATCH"
  | "TAX_CALCULATION_MISMATCH"

export function taxError(
  code: TaxErrorCode,
  message: string,
  field?: string,
  statusCode = 400
) {
  return new HttpError(statusCode, message, {
    code,
    field,
    severity: "error",
  })
}
