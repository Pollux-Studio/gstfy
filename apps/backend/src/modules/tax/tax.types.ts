export const taxabilities = [
  "TAXABLE",
  "EXEMPT",
  "NIL_RATED",
  "NON_GST",
  "ZERO_RATED",
] as const

export const supplyLocationTreatments = ["INTRA_STATE", "INTER_STATE"] as const
export const taxClassifications = [
  "B2B",
  "B2C",
  "EXPORT_WITH_PAYMENT",
  "EXPORT_WITHOUT_PAYMENT",
  "SEZ_WITH_PAYMENT",
  "SEZ_WITHOUT_PAYMENT",
  "DEEMED_EXPORT",
  "RCM",
  "EXEMPT",
  "NIL_RATED",
  "NON_GST",
  "ZERO_RATED",
] as const
export const taxComponents = ["cgst", "sgst", "igst", "cess"] as const
export const transactionTypes = ["sales", "purchase", "pos"] as const
export const pricingModes = ["tax_exclusive", "tax_inclusive"] as const
export const supplyTypes = [
  "b2b",
  "b2c",
  "export_with_payment",
  "export_without_payment",
  "sez_with_payment",
  "sez_without_payment",
  "deemed_export",
] as const

export type Taxability = (typeof taxabilities)[number]
export type TaxClassification = (typeof taxClassifications)[number]
export type SupplyLocationTreatment = (typeof supplyLocationTreatments)[number]
export type TaxComponent = (typeof taxComponents)[number]
export type TransactionType = (typeof transactionTypes)[number]
export type PricingMode = (typeof pricingModes)[number]
export type SupplyType = (typeof supplyTypes)[number]

export type OtherChargeInput = {
  chargeType: string
  amount: string
  taxTreatment: "taxable" | "non_taxable"
}

export type TaxLineInput = {
  itemId?: string | null
  itemName: string
  hsnSacCode?: string | null
  quantity: string
  unit?: string
  rate: string
  gstRate?: string | null
  taxability?: Taxability | null
  cessRuleId?: string | null
  itcEligible?: boolean
  pricingMode?: PricingMode
  discountAmount?: string | null
  otherCharges?: OtherChargeInput[]
  resolvedTaxRule?: TaxRuleResolution
}

export type TaxCalculationContext = {
  transactionDate: string
  transactionType: TransactionType
  supplyType?: SupplyType
  partyRegistrationType?: "registered" | "unregistered"
  sellerGstin?: string | null
  sellerStateCode: string
  placeOfSupplyStateCode: string
  reverseCharge?: boolean
}

export type TaxRuleResolution = {
  taxRuleId: string
  taxRuleVersion: string
  effectiveFrom: string
  effectiveTo: string | null
  taxability: Taxability
  gstRate: string
  cessRuleId: string | null
}

export type TaxResultLine = TaxLineInput & {
  itemId: string | null
  unit: string
  taxability: Taxability
  classification: TaxClassification
  supplyLocationTreatment: SupplyLocationTreatment
  grossValue: string
  discountAmount: string
  taxableCharges: string
  nonTaxableCharges: string
  taxableValue: string
  gstRate: string
  cgstRate: string
  cgstAmount: string
  sgstRate: string
  sgstAmount: string
  igstRate: string
  igstAmount: string
  cessRuleId: string | null
  cessAmount: string
  totalTax: string
  roundOff: string
  lineTotal: string
  totalValue: string
  placeOfSupply: string
  reverseCharge: boolean
  taxRuleId: string
  taxRuleVersion: string
  effectiveFrom: string
  effectiveTo: string | null
}

export type TaxBreakupEntry = {
  component: TaxComponent
  taxRate: string
  taxableValue: string
  taxAmount: string
  placeOfSupplyStateCode: string
  itcEligibility?: "eligible" | "ineligible" | "pending_2b" | "blocked"
  taxRuleId: string
  taxRuleVersion: string
}

export type TaxCalculationResult = {
  lines: TaxResultLine[]
  totals: {
    grossValue: string
    discountAmount: string
    taxableCharges: string
    nonTaxableCharges: string
    taxableValue: string
    cgstAmount: string
    sgstAmount: string
    igstAmount: string
    cessAmount: string
    totalTax: string
    roundOff: string
    totalAmount: string
  }
  classification: TaxClassification
  supplyLocationTreatment: SupplyLocationTreatment
  placeOfSupply: string
  reverseCharge: boolean
  taxRuleVersion: string
  taxBreakup: TaxBreakupEntry[]
}
