import { HttpError } from "../../utils/http-error.js"
import { formatCents, toCents } from "../core/core.validation.js"
import { resolveBusinessTaxLines, resolveTaxRule } from "./tax-rules.service.js"
import {
  type TaxBreakupEntry,
  type TaxCalculationContext,
  type TaxCalculationResult,
  type TaxClassification,
  type TaxComponent,
  type TaxLineInput,
  type SupplyLocationTreatment,
  type TaxResultLine,
} from "./tax.types.js"
import {
  calculateLineAmountCents,
  formatMoney,
  formatRate,
  normalizeDiscountCents,
  validateTaxContext,
} from "./tax.validation.js"

export async function calculateTaxForBusiness(
  businessId: string,
  lines: TaxLineInput[],
  context: TaxCalculationContext
): Promise<TaxCalculationResult> {
  const resolvedLines = await resolveBusinessTaxLines(businessId, lines, context)

  return calculateTax(resolvedLines, context)
}

export function calculateTax(
  lines: TaxLineInput[],
  context: TaxCalculationContext
): TaxCalculationResult {
  validateTaxContext(lines, context)

  if (lines.length === 0) {
    throw new HttpError(400, "At least one transaction line is required.")
  }

  const supplyLocationTreatment = resolveSupplyLocationTreatment(context)
  const calculatedLines = lines.map((line, index) =>
    calculateLineTax(line, index + 1, context, supplyLocationTreatment)
  )
  const totals = calculatedLines.reduce(
    (current, line) => ({
      grossValue: current.grossValue + toCents(line.grossValue),
      discountAmount: current.discountAmount + toCents(line.discountAmount),
      taxableCharges: current.taxableCharges + toCents(line.taxableCharges),
      nonTaxableCharges: current.nonTaxableCharges + toCents(line.nonTaxableCharges),
      taxableValue: current.taxableValue + toCents(line.taxableValue),
      cgstAmount: current.cgstAmount + toCents(line.cgstAmount),
      sgstAmount: current.sgstAmount + toCents(line.sgstAmount),
      igstAmount: current.igstAmount + toCents(line.igstAmount),
      cessAmount: current.cessAmount + toCents(line.cessAmount),
      totalTax: current.totalTax + toCents(line.totalTax),
      roundOff: current.roundOff + toCents(line.roundOff),
      totalAmount: current.totalAmount + toCents(line.totalValue),
    }),
    {
      grossValue: 0,
      discountAmount: 0,
      taxableCharges: 0,
      nonTaxableCharges: 0,
      taxableValue: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      cessAmount: 0,
      totalTax: 0,
      roundOff: 0,
      totalAmount: 0,
    }
  )

  return {
    lines: calculatedLines,
    totals: {
      grossValue: formatCents(totals.grossValue),
      discountAmount: formatCents(totals.discountAmount),
      taxableCharges: formatCents(totals.taxableCharges),
      nonTaxableCharges: formatCents(totals.nonTaxableCharges),
      taxableValue: formatCents(totals.taxableValue),
      cgstAmount: formatCents(totals.cgstAmount),
      sgstAmount: formatCents(totals.sgstAmount),
      igstAmount: formatCents(totals.igstAmount),
      cessAmount: formatCents(totals.cessAmount),
      totalTax: formatCents(totals.totalTax),
      roundOff: formatCents(totals.roundOff),
      totalAmount: formatCents(totals.totalAmount),
    },
    classification: resolveSummaryClassification(calculatedLines, context),
    supplyLocationTreatment,
    placeOfSupply: context.placeOfSupplyStateCode,
    reverseCharge: Boolean(context.reverseCharge),
    taxRuleVersion: resolveResultRuleVersion(calculatedLines),
    taxBreakup: buildTaxBreakup(calculatedLines, context),
  }
}

function calculateLineTax(
  line: TaxLineInput,
  lineNumber: number,
  context: TaxCalculationContext,
  supplyLocationTreatment: SupplyLocationTreatment
): TaxResultLine {
  const rule = resolveTaxRule(line, context)
  const lineAmountCents = calculateLineAmountCents(line.quantity, line.rate, lineNumber)
  const discountCents = normalizeDiscountCents(line.discountAmount)
  const otherCharges = resolveOtherCharges(line, lineNumber)

  if (discountCents >= lineAmountCents) {
    throw new HttpError(400, `Line ${lineNumber} discount must be lower than the line amount.`)
  }

  const taxableBaseCents = lineAmountCents - discountCents + otherCharges.taxableCents
  const nonTaxableCents = otherCharges.nonTaxableCents
  const gstRate = Number(rule.gstRate)
  const isTaxInclusive = line.pricingMode === "tax_inclusive"
  const taxableCents =
    isTaxInclusive && gstRate > 0 ?
      Math.round((taxableBaseCents * 100) / (100 + gstRate))
    : taxableBaseCents
  const totalTaxCents =
    isTaxInclusive && gstRate > 0 ?
      taxableBaseCents - taxableCents
    : Math.round((taxableCents * gstRate) / 100)
  const componentRates = resolveComponentRates(rule.gstRate, supplyLocationTreatment)
  const cgstCents =
    supplyLocationTreatment === "INTRA_STATE" ? Math.round(totalTaxCents / 2) : 0
  const sgstCents =
    supplyLocationTreatment === "INTRA_STATE" ? totalTaxCents - cgstCents : 0
  const igstCents = supplyLocationTreatment === "INTER_STATE" ? totalTaxCents : 0
  const totalValueCents = taxableCents + totalTaxCents + nonTaxableCents

  return {
    ...line,
    itemId: line.itemId ?? null,
    unit: line.unit?.trim() || "PCS",
    taxability: rule.taxability,
    classification: resolveLineClassification(rule.taxability, context),
    supplyLocationTreatment,
    grossValue: formatMoney(lineAmountCents),
    discountAmount: formatMoney(discountCents),
    taxableCharges: formatMoney(otherCharges.taxableCents),
    nonTaxableCharges: formatMoney(nonTaxableCents),
    taxableValue: formatMoney(taxableCents),
    gstRate: rule.gstRate,
    cgstRate: componentRates.cgstRate,
    cgstAmount: formatMoney(cgstCents),
    sgstRate: componentRates.sgstRate,
    sgstAmount: formatMoney(sgstCents),
    igstRate: componentRates.igstRate,
    igstAmount: formatMoney(igstCents),
    cessRuleId: rule.cessRuleId,
    cessAmount: "0.00",
    totalTax: formatMoney(totalTaxCents),
    roundOff: "0.00",
    lineTotal: formatMoney(totalValueCents),
    totalValue: formatMoney(totalValueCents),
    placeOfSupply: context.placeOfSupplyStateCode,
    reverseCharge: Boolean(context.reverseCharge),
    taxRuleId: rule.taxRuleId,
    taxRuleVersion: rule.taxRuleVersion,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
  }
}

function resolveClassification(context: TaxCalculationContext): TaxClassification {
  if (context.reverseCharge) {
    return "RCM"
  }

  const supplyType = context.supplyType ?? (context.transactionType === "pos" ? "b2c" : "b2b")
  const classificationBySupplyType: Record<string, TaxClassification> = {
    b2b: "B2B",
    b2c: "B2C",
    export_with_payment: "EXPORT_WITH_PAYMENT",
    export_without_payment: "EXPORT_WITHOUT_PAYMENT",
    sez_with_payment: "SEZ_WITH_PAYMENT",
    sez_without_payment: "SEZ_WITHOUT_PAYMENT",
    deemed_export: "DEEMED_EXPORT",
  }

  return classificationBySupplyType[supplyType] ?? "B2C"
}

function resolveLineClassification(
  taxability: TaxResultLine["taxability"],
  context: TaxCalculationContext
): TaxClassification {
  const zeroTaxClassifications: Partial<Record<TaxResultLine["taxability"], TaxClassification>> = {
    EXEMPT: "EXEMPT",
    NIL_RATED: "NIL_RATED",
    NON_GST: "NON_GST",
    ZERO_RATED: "ZERO_RATED",
  }

  return zeroTaxClassifications[taxability] ?? resolveClassification(context)
}

function resolveSummaryClassification(
  lines: TaxResultLine[],
  context: TaxCalculationContext
): TaxClassification {
  const taxableClassification = resolveClassification(context)

  return lines.some((line) => line.classification === taxableClassification) ?
      taxableClassification
    : lines[0]?.classification ?? taxableClassification
}

function resolveSupplyLocationTreatment(
  context: TaxCalculationContext
): SupplyLocationTreatment {
  return context.placeOfSupplyStateCode === context.sellerStateCode ?
      "INTRA_STATE"
    : "INTER_STATE"
}

function resolveComponentRates(gstRate: string, classification: SupplyLocationTreatment) {
  const rate = Number(gstRate)

  if (classification === "INTRA_STATE") {
    return {
      cgstRate: formatRate(rate / 2),
      sgstRate: formatRate(rate / 2),
      igstRate: "0.00",
    }
  }

  return {
    cgstRate: "0.00",
    sgstRate: "0.00",
    igstRate: formatRate(rate),
  }
}

function buildTaxBreakup(
  lines: TaxResultLine[],
  context: TaxCalculationContext
): TaxBreakupEntry[] {
  const grouped = new Map<
    string,
    {
      component: TaxComponent
      taxRate: string
      taxableValue: number
      taxAmount: number
      itcEligibility?: "eligible" | "ineligible"
      taxRuleId: string
      taxRuleVersion: string
    }
  >()

  for (const line of lines) {
    for (const component of ["cgst", "sgst", "igst", "cess"] as const) {
      const taxAmount = toCents(componentAmount(line, component))

      if (taxAmount <= 0) {
        continue
      }

      const itcEligibility =
        context.transactionType === "purchase" ?
          line.itcEligible === false ? "ineligible" : "eligible"
        : undefined
      const taxRate = componentRate(line, component)
      const groupKey = [
        component,
        taxRate,
        itcEligibility ?? "na",
        line.taxRuleId,
        line.taxRuleVersion,
      ].join(":")
      const current = grouped.get(groupKey) ?? {
        component,
        taxRate,
        taxableValue: 0,
        taxAmount: 0,
        itcEligibility,
        taxRuleId: line.taxRuleId,
        taxRuleVersion: line.taxRuleVersion,
      }

      current.taxableValue += toCents(line.taxableValue)
      current.taxAmount += taxAmount
      grouped.set(groupKey, current)
    }
  }

  return Array.from(grouped.values()).map((entry) => ({
    component: entry.component,
    taxRate: entry.taxRate,
    taxableValue: formatCents(entry.taxableValue),
    taxAmount: formatCents(entry.taxAmount),
    placeOfSupplyStateCode: context.placeOfSupplyStateCode,
    itcEligibility: entry.itcEligibility,
    taxRuleId: entry.taxRuleId,
    taxRuleVersion: entry.taxRuleVersion,
  }))
}

function resolveOtherCharges(line: TaxLineInput, lineNumber: number) {
  let taxableCents = 0
  let nonTaxableCents = 0

  for (const charge of line.otherCharges ?? []) {
    const chargeCents = toCents(charge.amount)

    if (chargeCents < 0) {
      throw new HttpError(400, `Line ${lineNumber} charge amount must be non-negative.`)
    }

    if (charge.taxTreatment === "taxable") {
      taxableCents += chargeCents
    } else {
      nonTaxableCents += chargeCents
    }
  }

  return {
    taxableCents,
    nonTaxableCents,
  }
}

function componentAmount(line: TaxResultLine, component: TaxComponent) {
  const amounts = {
    cgst: line.cgstAmount,
    sgst: line.sgstAmount,
    igst: line.igstAmount,
    cess: line.cessAmount,
  }

  return amounts[component]
}

function componentRate(line: TaxResultLine, component: TaxComponent) {
  const rates = {
    cgst: line.cgstRate,
    sgst: line.sgstRate,
    igst: line.igstRate,
    cess: "0.00",
  }

  return rates[component]
}

function resolveResultRuleVersion(lines: TaxResultLine[]) {
  const versions = new Set(lines.map((line) => line.taxRuleVersion))

  return versions.size === 1 ? Array.from(versions)[0] ?? "UNKNOWN" : "MIXED"
}
