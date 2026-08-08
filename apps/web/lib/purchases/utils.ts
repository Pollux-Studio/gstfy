import { addDays, format, isAfter, parseISO, subDays } from "date-fns"

import { getGstStateMeta } from "@/lib/gst-state"
import { overviewDashboardData } from "@/lib/dashboard/mock-overview"
import type {
  Gstr2bStatus,
  ItcEligibility,
  ItcFlag,
  PurchaseBill,
  PurchaseBillLineItem,
  PurchaseModuleNotice,
  PurchaseSupplyType,
} from "@/lib/purchases/types"

export const supplierInvoiceNumberPattern = /^[a-zA-Z0-9\-_./]{1,16}$/
export const verifiedGstinPattern =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/

export const paymentModeLabels = {
  cash: "Cash",
  upi: "UPI",
  bank: "Bank transfer",
  cheque: "Cheque",
} as const

export const paymentStatusLabels = {
  paid: "Paid",
  partial: "Partially paid",
  unpaid: "Unpaid",
} as const

export const gstr2bStatusLabels: Record<Gstr2bStatus, string> = {
  pending: "Pending",
  matched: "Matched in GSTR-2B",
  unmatched: "Not in GSTR-2B",
  rejected: "Rejected in IMS",
  not_applicable: "RCM - does not appear in GSTR-2B",
}

export const itcEligibilityLabels: Record<ItcEligibility, string> = {
  full: "Fully eligible",
  partial: "Partially eligible",
  blocked: "Blocked (Section 17(5))",
}

export const itcFlagLabels: Record<ItcFlag, string> = {
  eligible: "Yes",
  check: "Check",
  blocked: "Blocked",
}

export const supplyTypeLabels: Record<PurchaseSupplyType, string> = {
  intra: "Intra-state",
  inter: "Inter-state",
}

export const registeredBusinessGstin = overviewDashboardData.business.gstin

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDisplayDate(value: string) {
  return format(parseISO(value), "dd MMM yyyy")
}

export function getFinancialYear(date: Date): string {
  const month = date.getMonth() + 1
  const year = date.getFullYear()

  if (month >= 4) {
    return `${year}-${String(year + 1).slice(-2)}`
  }

  return `${year - 1}-${String(year).slice(-2)}`
}

export function getTaxPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function getGstStateCodeFromGstin(gstin: string) {
  return gstin.slice(0, 2)
}

export function deriveSupplyType(supplierGstin: string) {
  return getGstStateCodeFromGstin(supplierGstin) ===
      getGstStateCodeFromGstin(registeredBusinessGstin) ?
      "intra"
    : "inter"
}

export function derivePlaceOfSupply(supplierGstin: string) {
  return getGstStateCodeFromGstin(supplierGstin)
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

export function calculateLineItem(
  lineItem: PurchaseBillLineItem,
  supplyType: PurchaseSupplyType
): PurchaseBillLineItem {
  const taxableAmount = roundCurrency(lineItem.quantity * lineItem.ratePerUnit)
  const taxAmount = roundCurrency((taxableAmount * lineItem.gstRate) / 100)

  const cgstAmount =
    supplyType === "intra" ? roundCurrency(taxAmount / 2) : 0
  const sgstAmount =
    supplyType === "intra" ? roundCurrency(taxAmount / 2) : 0
  const igstAmount = supplyType === "inter" ? taxAmount : 0
  const totalAmount = roundCurrency(
    taxableAmount + cgstAmount + sgstAmount + igstAmount
  )

  const totalTax = cgstAmount + sgstAmount + igstAmount

  return {
    ...lineItem,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount,
    itcClaimAmount:
      lineItem.itcFlag === "blocked" ?
        0
      : lineItem.itcClaimAmount === undefined ?
        totalTax
      : roundCurrency(Math.min(Math.max(lineItem.itcClaimAmount, 0), totalTax)),
  }
}

export function calculateBillTotals(
  lineItems: PurchaseBillLineItem[],
  itcEligibility: ItcEligibility
) {
  const taxableValue = roundCurrency(
    lineItems.reduce((sum, item) => sum + item.taxableAmount, 0)
  )
  const cgstAmount = roundCurrency(
    lineItems.reduce((sum, item) => sum + item.cgstAmount, 0)
  )
  const sgstAmount = roundCurrency(
    lineItems.reduce((sum, item) => sum + item.sgstAmount, 0)
  )
  const igstAmount = roundCurrency(
    lineItems.reduce((sum, item) => sum + item.igstAmount, 0)
  )
  const totalTax = roundCurrency(cgstAmount + sgstAmount + igstAmount)
  const totalAmount = roundCurrency(taxableValue + totalTax)

  let itcEligibleAmount = 0
  let itcBlockedAmount = 0

  if (itcEligibility === "blocked") {
    itcEligibleAmount = 0
    itcBlockedAmount = totalTax
  } else if (itcEligibility === "partial") {
    itcEligibleAmount = roundCurrency(
      lineItems.reduce((sum, item) => sum + (item.itcClaimAmount ?? 0), 0)
    )
    itcBlockedAmount = roundCurrency(Math.max(totalTax - itcEligibleAmount, 0))
  } else {
    const blockedByLines = roundCurrency(
      lineItems
        .filter((item) => item.itcFlag === "blocked")
        .reduce(
          (sum, item) => sum + item.cgstAmount + item.sgstAmount + item.igstAmount,
          0
        )
    )
    itcEligibleAmount = roundCurrency(Math.max(totalTax - blockedByLines, 0))
    itcBlockedAmount = blockedByLines
  }

  return {
    taxableValue,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount,
    itcEligibleAmount,
    itcBlockedAmount,
  }
}

export function getInvoiceDateWarnings(invoiceDate: string) {
  const parsedDate = parseISO(invoiceDate)
  const warnings: string[] = []

  if (isAfter(parsedDate, new Date())) {
    warnings.push("Invoice date cannot be in the future.")
  }

  const olderThan180Days = parsedDate < subDays(new Date(), 180)
  if (olderThan180Days) {
    warnings.push(
      `This bill is older than 6 months. Claim ITC before ${format(addDays(parsedDate, 180), "dd MMM yyyy")} to avoid permanent lapse.`
    )
  }

  return warnings
}

export function hasRcmSuggestion(
  gstin: string,
  lineItems: PurchaseBillLineItem[],
  totalAmount: number,
  isUnregisteredSupplier?: boolean
) {
  const hasFreightLine = lineItems.some((item) => item.hsnSacCode.startsWith("9965"))
  const unregisteredThreshold = Boolean(isUnregisteredSupplier && totalAmount > 5000)

  return {
    suggested: hasFreightLine || unregisteredThreshold,
    reason:
      hasFreightLine ?
        "RCM may apply because one or more line items fall under freight / GTA services."
      : unregisteredThreshold ?
        "RCM may apply because the supplier is unregistered and the bill total exceeds Rs.5,000."
      : null,
  }
}

export function getDefaultEnteredBillTotal(totalAmount: number) {
  return totalAmount
}

export function billTotalsMatch(totalAmount: number, enteredBillTotal: number | null) {
  if (enteredBillTotal === null) {
    return true
  }

  return Math.abs(totalAmount - enteredBillTotal) <= 1
}

export function createPurchaseNotice(
  title: string,
  message: string,
  variant: PurchaseModuleNotice["variant"] = "success"
): PurchaseModuleNotice {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    message,
    variant,
  }
}

export function getSupplierStateNameFromGstin(gstin: string) {
  return getGstStateMeta(gstin)?.name ?? "Unknown state"
}

export function getSaveSuccessMessage(
  bill: Pick<PurchaseBill, "billNumber" | "itcEligibleAmount" | "itcBlockedAmount" | "invoiceDate" | "itcEligibility">
) {
  const monthYear = format(parseISO(bill.invoiceDate), "MMMM yyyy")

  if (bill.itcEligibility === "blocked") {
    return createPurchaseNotice(
      "Purchase bill saved",
      `Bill ${bill.billNumber} saved. GST of ${formatCurrency(bill.itcBlockedAmount)} is blocked - not added to ITC.`
    )
  }

  return createPurchaseNotice(
    "Purchase bill saved",
    `Bill ${bill.billNumber} saved. ITC of ${formatCurrency(bill.itcEligibleAmount)} added to ${monthYear}.`
  )
}
