import { getGstStateMeta } from "@/lib/gst-state"
import type {
  PaymentMode,
  PurchaseBill,
  PurchaseBillLineItem,
  PurchaseLookupItem,
  PurchaseSupplier,
} from "@/lib/purchases/types"
import {
  calculateBillTotals,
  calculateLineItem,
  derivePlaceOfSupply,
  deriveSupplyType,
  getFinancialYear,
  getTaxPeriod,
  roundCurrency,
} from "@/lib/purchases/utils"

export const purchaseLookupItems: PurchaseLookupItem[] = [
  { code: "392390", title: "Packaging trays", type: "hsn", defaultGstRate: 18 },
  { code: "210690", title: "Nutritional supplement mix", type: "hsn", defaultGstRate: 12 },
  { code: "190531", title: "Biscuits and cookies", type: "hsn", defaultGstRate: 18 },
  { code: "996511", title: "Road freight / GTA services", type: "sac", defaultGstRate: 5, itcFlag: "check" },
  { code: "998313", title: "Advertising services", type: "sac", defaultGstRate: 18 },
  { code: "870322", title: "Passenger vehicle", type: "hsn", defaultGstRate: 28, itcFlag: "check" },
]

export const purchaseUnits = ["Nos", "Box", "Pack", "Kg", "Litre", "Service"] as const

export const paymentModeOptions: Exclude<PaymentMode, null>[] = [
  "cash",
  "upi",
  "bank",
  "cheque",
]

function supplierState(code: string) {
  const stateMeta = getGstStateMeta(`${code}AAAAA0000A1Z0`)

  return {
    stateCode: code,
    stateName: stateMeta?.name ?? "Unknown state",
  }
}

export const mockPurchaseSuppliers: PurchaseSupplier[] = [
  {
    id: "sup_01",
    legalName: "Arun Packaging Co",
    tradeName: "Arun Packaging",
    gstin: "33AAHCA1901M1Z7",
    isRegistered: true,
    ...supplierState("33"),
    phone: "+91 98410 22110",
  },
  {
    id: "sup_02",
    legalName: "Om Traders",
    tradeName: "Om Traders",
    gstin: "29AABCO2904P1Z2",
    isRegistered: true,
    ...supplierState("29"),
    phone: "+91 99862 55001",
  },
  {
    id: "sup_03",
    legalName: "South Coast Supplies Pvt Ltd",
    tradeName: "South Coast Supplies",
    gstin: "33ABBCS4176J1Z9",
    isRegistered: true,
    ...supplierState("33"),
    phone: "+91 98403 11331",
  },
  {
    id: "sup_04",
    legalName: "Elite Wholesale Hub",
    tradeName: "Elite Wholesale Hub",
    gstin: "27AABCE5509M1ZG",
    isRegistered: true,
    ...supplierState("27"),
    phone: "+91 98928 44021",
  },
  {
    id: "sup_05",
    legalName: "Nila Distributors",
    tradeName: "Nila Distributors",
    gstin: "33AAFCN6481B1Z8",
    isRegistered: true,
    ...supplierState("33"),
    phone: "+91 98844 21990",
  },
]

function createLineItem(
  purchaseBillId: string,
  values: Partial<PurchaseBillLineItem> & Pick<PurchaseBillLineItem, "itemDescription" | "hsnSacCode" | "quantity" | "unit" | "ratePerUnit" | "gstRate" | "sortOrder">
): PurchaseBillLineItem {
  return {
    id: `${purchaseBillId}_line_${values.sortOrder}`,
    purchaseBillId,
    itemDescription: values.itemDescription,
    hsnSacCode: values.hsnSacCode,
    quantity: values.quantity,
    unit: values.unit,
    ratePerUnit: values.ratePerUnit,
    taxableAmount: 0,
    gstRate: values.gstRate,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    totalAmount: 0,
    itcFlag: values.itcFlag ?? "eligible",
    itcClaimAmount: values.itcClaimAmount,
    sortOrder: values.sortOrder,
  }
}

function buildBillRecord({
  id,
  supplier,
  supplierInvoiceNumber,
  invoiceDate,
  billEntryDate,
  purchaseType,
  isRcm = false,
  itcEligibility = "full",
  paymentStatus = "unpaid",
  amountPaid = 0,
  paymentDate = null,
  paymentMode = null,
  gstr2bStatus = "pending",
  purchaseOrderRef = null,
  notes = null,
  attachmentName = null,
  status = "saved",
  lineItems,
  isUnregisteredSupplier = false,
  enteredBillTotal = null,
}: {
  id: string
  supplier: PurchaseSupplier | { id: string; legalName: string; tradeName: string; gstin: string; phone?: string }
  supplierInvoiceNumber: string
  invoiceDate: string
  billEntryDate: string
  purchaseType: PurchaseBill["purchaseType"]
  isRcm?: boolean
  itcEligibility?: PurchaseBill["itcEligibility"]
  paymentStatus?: PurchaseBill["paymentStatus"]
  amountPaid?: number
  paymentDate?: string | null
  paymentMode?: PaymentMode
  gstr2bStatus?: PurchaseBill["gstr2bStatus"]
  purchaseOrderRef?: string | null
  notes?: string | null
  attachmentName?: string | null
  status?: PurchaseBill["status"]
  lineItems: PurchaseBillLineItem[]
  isUnregisteredSupplier?: boolean
  enteredBillTotal?: number | null
}) {
  const supplyType = isUnregisteredSupplier ? "intra" : deriveSupplyType(supplier.gstin)
  const recalculatedItems = lineItems.map((item) => calculateLineItem(item, supplyType))
  const totals = calculateBillTotals(recalculatedItems, itcEligibility)
  const invoiceDateValue = new Date(invoiceDate)

  return {
    id,
    businessId: "biz_01",
    billNumber: id.toUpperCase(),
    supplierId: supplier.id,
    supplierGstin: isUnregisteredSupplier ? "" : supplier.gstin,
    supplierName: supplier.legalName,
    supplierTradeName: supplier.tradeName,
    supplierPhone: supplier.phone,
    isUnregisteredSupplier,
    supplierInvoiceNumber,
    invoiceDate,
    billEntryDate,
    placeOfSupply: isUnregisteredSupplier ? "33" : derivePlaceOfSupply(supplier.gstin),
    supplyType,
    purchaseType,
    isRcm,
    itcEligibility,
    itcEligibleAmount: totals.itcEligibleAmount,
    itcBlockedAmount: totals.itcBlockedAmount,
    taxableValue: totals.taxableValue,
    cgstAmount: totals.cgstAmount,
    sgstAmount: totals.sgstAmount,
    igstAmount: totals.igstAmount,
    totalAmount: totals.totalAmount,
    enteredBillTotal:
      enteredBillTotal === null ? roundCurrency(totals.totalAmount) : enteredBillTotal,
    paymentStatus,
    amountPaid,
    paymentDate,
    paymentMode,
    gstr2bStatus: isRcm ? "not_applicable" : gstr2bStatus,
    purchaseOrderRef,
    notes,
    attachmentUrl: attachmentName ? `mock://attachments/${attachmentName}` : null,
    attachmentName,
    financialYear: getFinancialYear(invoiceDateValue),
    taxPeriod: getTaxPeriod(invoiceDateValue),
    status,
    createdAt: `${billEntryDate}T10:00:00.000Z`,
    updatedAt: `${billEntryDate}T10:00:00.000Z`,
    createdBy: "owner@gstfy.in",
    lineItems: recalculatedItems,
  } satisfies PurchaseBill
}

export const mockPurchaseBills: PurchaseBill[] = [
  buildBillRecord({
    id: "PUR-2026-0087",
    supplier: mockPurchaseSuppliers[0],
    supplierInvoiceNumber: "APC/26-27/118",
    invoiceDate: "2026-05-11",
    billEntryDate: "2026-05-11",
    purchaseType: "goods",
    paymentStatus: "partial",
    amountPaid: 12000,
    paymentDate: "2026-05-12",
    paymentMode: "bank",
    gstr2bStatus: "matched",
    purchaseOrderRef: "PO-2026-041",
    notes: "Primary packaging stock refill.",
    attachmentName: "apc-bill-may.pdf",
    status: "saved",
    lineItems: [
      createLineItem("PUR-2026-0087", {
        itemDescription: "Packaging trays",
        hsnSacCode: "392390",
        quantity: 120,
        unit: "Nos",
        ratePerUnit: 95,
        gstRate: 18,
        sortOrder: 1,
      }),
      createLineItem("PUR-2026-0087", {
        itemDescription: "Printed cartons",
        hsnSacCode: "481910",
        quantity: 80,
        unit: "Nos",
        ratePerUnit: 120,
        gstRate: 18,
        sortOrder: 2,
      }),
    ],
  }),
  buildBillRecord({
    id: "PUR-2026-0086",
    supplier: mockPurchaseSuppliers[1],
    supplierInvoiceNumber: "OT-2198",
    invoiceDate: "2026-05-10",
    billEntryDate: "2026-05-10",
    purchaseType: "both",
    paymentStatus: "paid",
    amountPaid: 38100,
    paymentDate: "2026-05-10",
    paymentMode: "upi",
    gstr2bStatus: "unmatched",
    notes: "Awaiting supplier filing in GSTR-1.",
    status: "saved",
    lineItems: [
      createLineItem("PUR-2026-0086", {
        itemDescription: "Nutritional mix",
        hsnSacCode: "210690",
        quantity: 150,
        unit: "Pack",
        ratePerUnit: 180,
        gstRate: 12,
        sortOrder: 1,
      }),
      createLineItem("PUR-2026-0086", {
        itemDescription: "Branding support",
        hsnSacCode: "998313",
        quantity: 1,
        unit: "Service",
        ratePerUnit: 8000,
        gstRate: 18,
        sortOrder: 2,
      }),
    ],
  }),
  buildBillRecord({
    id: "PUR-2026-0085",
    supplier: mockPurchaseSuppliers[2],
    supplierInvoiceNumber: "SCS-8441",
    invoiceDate: "2026-05-09",
    billEntryDate: "2026-05-09",
    purchaseType: "services",
    isRcm: true,
    paymentStatus: "partial",
    amountPaid: 9500,
    paymentDate: "2026-05-11",
    paymentMode: "bank",
    status: "saved",
    lineItems: [
      createLineItem("PUR-2026-0085", {
        itemDescription: "Road freight charges",
        hsnSacCode: "996511",
        quantity: 1,
        unit: "Service",
        ratePerUnit: 18500,
        gstRate: 5,
        itcFlag: "check",
        sortOrder: 1,
      }),
    ],
  }),
  buildBillRecord({
    id: "PUR-2026-0084",
    supplier: mockPurchaseSuppliers[3],
    supplierInvoiceNumber: "EWH-4402",
    invoiceDate: "2026-05-09",
    billEntryDate: "2026-05-09",
    purchaseType: "goods",
    paymentStatus: "unpaid",
    gstr2bStatus: "rejected",
    notes: "Rejected in IMS due to invoice date mismatch.",
    status: "reconciled",
    lineItems: [
      createLineItem("PUR-2026-0084", {
        itemDescription: "Passenger vehicle for admin use",
        hsnSacCode: "870322",
        quantity: 1,
        unit: "Nos",
        ratePerUnit: 34500,
        gstRate: 28,
        itcFlag: "blocked",
        sortOrder: 1,
      }),
    ],
    itcEligibility: "blocked",
  }),
  buildBillRecord({
    id: "PUR-2026-0083",
    supplier: mockPurchaseSuppliers[4],
    supplierInvoiceNumber: "ND-1803",
    invoiceDate: "2026-05-08",
    billEntryDate: "2026-05-08",
    purchaseType: "goods",
    paymentStatus: "unpaid",
    gstr2bStatus: "pending",
    status: "draft",
    lineItems: [
      createLineItem("PUR-2026-0083", {
        itemDescription: "Butter cookies box",
        hsnSacCode: "190531",
        quantity: 65,
        unit: "Box",
        ratePerUnit: 220,
        gstRate: 18,
        sortOrder: 1,
      }),
    ],
  }),
]

export const mockUnregisteredSupplier = {
  id: "sup_unregistered",
  legalName: "Walk-in vendor",
  tradeName: "Walk-in vendor",
  gstin: "",
}
