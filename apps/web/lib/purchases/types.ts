export type PurchaseSupplyType = "intra" | "inter"
export type PurchaseType = "goods" | "services" | "both"
export type ItcEligibility = "full" | "partial" | "blocked"
export type PaymentStatus = "paid" | "partial" | "unpaid"
export type PaymentMode = "cash" | "upi" | "bank" | "cheque" | null
export type Gstr2bStatus =
  | "pending"
  | "matched"
  | "unmatched"
  | "rejected"
  | "not_applicable"
export type PurchaseBillStatus = "draft" | "saved" | "reconciled"
export type ItcFlag = "eligible" | "check" | "blocked"

export type PurchaseSupplier = {
  id: string
  legalName: string
  tradeName: string
  gstin: string
  stateCode: string
  stateName: string
  isRegistered: boolean
  phone?: string
}

export type PurchaseBillLineItem = {
  id: string
  purchaseBillId: string
  itemDescription: string
  hsnSacCode: string
  quantity: number
  unit: string
  ratePerUnit: number
  taxableAmount: number
  gstRate: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalAmount: number
  itcFlag: ItcFlag
  itcClaimAmount?: number
  sortOrder: number
}

export type PurchaseBill = {
  id: string
  businessId: string
  billNumber: string
  supplierId: string
  supplierGstin: string
  supplierName: string
  supplierTradeName: string
  supplierPhone?: string
  isUnregisteredSupplier?: boolean
  supplierInvoiceNumber: string
  invoiceDate: string
  billEntryDate: string
  placeOfSupply: string
  supplyType: PurchaseSupplyType
  purchaseType: PurchaseType
  isRcm: boolean
  itcEligibility: ItcEligibility
  itcEligibleAmount: number
  itcBlockedAmount: number
  taxableValue: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalAmount: number
  enteredBillTotal: number | null
  paymentStatus: PaymentStatus
  amountPaid: number
  paymentDate: string | null
  paymentMode: PaymentMode
  gstr2bStatus: Gstr2bStatus
  purchaseOrderRef: string | null
  notes: string | null
  attachmentUrl: string | null
  attachmentName: string | null
  financialYear: string
  taxPeriod: string
  status: PurchaseBillStatus
  createdAt: string
  updatedAt: string
  createdBy: string
  lineItems: PurchaseBillLineItem[]
}

export type PurchaseLookupItem = {
  code: string
  title: string
  type: "hsn" | "sac"
  defaultGstRate: number
  itcFlag?: ItcFlag
}

export type PurchaseModuleNotice = {
  id: string
  title: string
  message: string
  variant: "success" | "warning" | "info"
}
