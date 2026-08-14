"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  BadgeCheckIcon,
  FilePlus2Icon,
  IndianRupeeIcon,
  PackagePlusIcon,
  PlusIcon,
  ReceiptTextIcon,
  SaveIcon,
  ShieldCheckIcon,
  Trash2Icon,
  TruckIcon,
} from "lucide-react"

import { PurchaseGstrBadge, PurchaseItcBadge, PurchasePaymentBadge, PurchaseStatusBadge } from "@/components/purchases/purchase-badges"
import { PurchaseNotice } from "@/components/purchases/purchase-notice"
import { usePurchases } from "@/components/purchases/purchases-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { IndianPhoneInput } from "@/components/ui/indian-phone-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type {
  ItcEligibility,
  ItcFlag,
  PaymentMode,
  PaymentStatus,
  PurchaseBill,
  PurchaseBillLineItem,
  PurchaseSupplier,
} from "@/lib/purchases/types"
import {
  mockUnregisteredSupplier,
  paymentModeOptions,
  purchaseLookupItems,
  purchaseUnits,
} from "@/lib/purchases/mock-data"
import { getAllGstStates, getGstStateMeta } from "@/lib/gst-state"
import {
  billTotalsMatch,
  calculateBillTotals,
  calculateLineItem,
  createPurchaseNotice,
  derivePlaceOfSupply,
  deriveSupplyType,
  formatCurrency,
  getDefaultEnteredBillTotal,
  getFinancialYear,
  getInvoiceDateWarnings,
  getSupplierStateNameFromGstin,
  getTaxPeriod,
  hasRcmSuggestion,
  registeredBusinessGstin,
  roundCurrency,
  supplierInvoiceNumberPattern,
  verifiedGstinPattern,
} from "@/lib/purchases/utils"

type PurchaseFormPageProps = {
  mode: "create" | "edit"
  billId?: string
}

type SupplierDraft = {
  gstin: string
  legalName: string
  tradeName: string
  phone: string
}

type FormErrors = {
  supplier?: string
  supplierInvoiceNumber?: string
  invoiceDate?: string
  billEntryDate?: string
  lineItems?: string
}

const businessStateCode = registeredBusinessGstin.slice(0, 2)

function findLookupItem(code: string) {
  return purchaseLookupItems.find((item) => item.code === code) ?? purchaseLookupItems[0]
}

function createBlankLineItem(
  purchaseBillId: string,
  sortOrder: number,
  seed?: Partial<PurchaseBillLineItem>
) {
  const lookupItem = findLookupItem(seed?.hsnSacCode ?? purchaseLookupItems[0].code)

  return {
    id: `${purchaseBillId}_line_${sortOrder}_${Math.random().toString(36).slice(2, 6)}`,
    purchaseBillId,
    itemDescription: seed?.itemDescription ?? lookupItem.title,
    hsnSacCode: seed?.hsnSacCode ?? lookupItem.code,
    quantity: seed?.quantity ?? 1,
    unit: seed?.unit ?? "Nos",
    ratePerUnit: seed?.ratePerUnit ?? 0,
    taxableAmount: 0,
    gstRate: seed?.gstRate ?? lookupItem.defaultGstRate,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    totalAmount: 0,
    itcFlag: seed?.itcFlag ?? lookupItem.itcFlag ?? "eligible",
    itcClaimAmount: seed?.itcClaimAmount,
    sortOrder,
  } satisfies PurchaseBillLineItem
}

function recalculateBillDraft(draft: PurchaseBill) {
  const recalculatedLineItems = draft.lineItems.map((lineItem) =>
    calculateLineItem(lineItem, draft.supplyType)
  )
  const totals = calculateBillTotals(recalculatedLineItems, draft.itcEligibility)
  const invoiceDate = new Date(draft.invoiceDate)

  return {
    ...draft,
    lineItems: recalculatedLineItems,
    taxableValue: totals.taxableValue,
    cgstAmount: totals.cgstAmount,
    sgstAmount: totals.sgstAmount,
    igstAmount: totals.igstAmount,
    totalAmount: totals.totalAmount,
    enteredBillTotal:
      draft.enteredBillTotal === null ?
        getDefaultEnteredBillTotal(totals.totalAmount)
      : draft.enteredBillTotal,
    itcEligibleAmount: totals.itcEligibleAmount,
    itcBlockedAmount: totals.itcBlockedAmount,
    paymentStatus:
      draft.amountPaid <= 0 ? "unpaid"
      : draft.amountPaid >= totals.totalAmount ? "paid"
      : "partial",
    gstr2bStatus: draft.isRcm ? "not_applicable" : draft.gstr2bStatus,
    financialYear: getFinancialYear(invoiceDate),
    taxPeriod: getTaxPeriod(invoiceDate),
  } satisfies PurchaseBill
}

function createEmptyBill(billNumber: string): PurchaseBill {
  const id = crypto.randomUUID()
  const today = new Date()
  const dateValue = today.toISOString().slice(0, 10)
  const lineItems = [createBlankLineItem(id, 1)]

  return recalculateBillDraft({
    id,
    businessId: "biz_01",
    billNumber,
    supplierId: "",
    supplierGstin: "",
    supplierName: "",
    supplierTradeName: "",
    supplierPhone: "",
    isUnregisteredSupplier: false,
    supplierInvoiceNumber: "",
    invoiceDate: dateValue,
    billEntryDate: dateValue,
    placeOfSupply: businessStateCode,
    supplyType: "intra",
    purchaseType: "goods",
    isRcm: false,
    itcEligibility: "full",
    itcEligibleAmount: 0,
    itcBlockedAmount: 0,
    taxableValue: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    totalAmount: 0,
    enteredBillTotal: 0,
    paymentStatus: "unpaid",
    amountPaid: 0,
    paymentDate: null,
    paymentMode: null,
    gstr2bStatus: "pending",
    purchaseOrderRef: null,
    notes: null,
    attachmentUrl: null,
    attachmentName: null,
    financialYear: getFinancialYear(today),
    taxPeriod: getTaxPeriod(today),
    status: "draft",
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
    createdBy: "owner@gstfy.in",
    lineItems,
  })
}

function normalizeSupplierFromSelection(
  supplier: PurchaseSupplier | typeof mockUnregisteredSupplier,
  currentBill: PurchaseBill
) {
  const supplierPhone = "phone" in supplier ? (supplier.phone ?? "") : ""

  if (!supplier.gstin) {
    return recalculateBillDraft({
      ...currentBill,
      supplierId: supplier.id,
      supplierName: supplier.legalName,
      supplierTradeName: supplier.tradeName,
      supplierPhone: "",
      supplierGstin: "",
      isUnregisteredSupplier: true,
      placeOfSupply: businessStateCode,
      supplyType: "intra",
      gstr2bStatus: currentBill.isRcm ? "not_applicable" : "pending",
    })
  }

  return recalculateBillDraft({
    ...currentBill,
    supplierId: supplier.id,
    supplierName: supplier.legalName,
    supplierTradeName: supplier.tradeName,
    supplierPhone,
    supplierGstin: supplier.gstin,
    isUnregisteredSupplier: false,
    placeOfSupply: derivePlaceOfSupply(supplier.gstin),
    supplyType: deriveSupplyType(supplier.gstin),
    gstr2bStatus: currentBill.isRcm ? "not_applicable" : currentBill.gstr2bStatus,
  })
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="p-4 sm:p-5 lg:p-6">{children}</div>
    </section>
  )
}

export function PurchaseFormPage({
  mode,
  billId,
}: PurchaseFormPageProps) {
  const router = useRouter()
  const {
    bills,
    suppliers,
    notice,
    setNotice,
    getBillById,
    saveBill,
    addSupplier,
    getNextBillNumber,
  } = usePurchases()

  const existingBill = mode === "edit" && billId ? getBillById(billId) : null
  const [draft, setDraft] = React.useState<PurchaseBill | null>(() => {
    if (mode === "edit") {
      return existingBill
    }

    return createEmptyBill(getNextBillNumber())
  })
  const [supplierSearch, setSupplierSearch] = React.useState("")
  const [showNewSupplier, setShowNewSupplier] = React.useState(false)
  const [supplierDraft, setSupplierDraft] = React.useState<SupplierDraft>({
    gstin: "",
    legalName: "",
    tradeName: "",
    phone: "",
  })
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [gstConfirmationOpen, setGstConfirmationOpen] = React.useState(false)
  const [pendingStatus, setPendingStatus] = React.useState<"draft" | "saved" | null>(null)

  const initialSnapshot = React.useMemo(
    () =>
      existingBill ?
        JSON.stringify({
          supplierGstin: existingBill.supplierGstin,
          supplierInvoiceNumber: existingBill.supplierInvoiceNumber,
          invoiceDate: existingBill.invoiceDate,
          isRcm: existingBill.isRcm,
          lineItems: existingBill.lineItems.map((item) => ({
            description: item.itemDescription,
            hsnSacCode: item.hsnSacCode,
            quantity: item.quantity,
            ratePerUnit: item.ratePerUnit,
            gstRate: item.gstRate,
          })),
        })
      : null,
    [existingBill]
  )

  const availableSuppliers = React.useMemo(() => {
    const query = supplierSearch.trim().toLowerCase()

    if (!query) {
      return suppliers
    }

    return suppliers.filter((supplier) => {
      const haystack = [
        supplier.legalName,
        supplier.tradeName,
        supplier.gstin,
        supplier.phone ?? "",
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [supplierSearch, suppliers])

  const duplicateInvoiceBill = React.useMemo(() => {
    if (!draft?.supplierGstin || !draft.supplierInvoiceNumber.trim()) {
      return null
    }

    return (
      bills.find(
        (bill) =>
          bill.id !== draft.id &&
          bill.supplierGstin === draft.supplierGstin &&
          bill.supplierInvoiceNumber.trim().toLowerCase() ===
            draft.supplierInvoiceNumber.trim().toLowerCase()
      ) ?? null
    )
  }, [bills, draft])

  const invoiceWarnings = React.useMemo(
    () => (draft ? getInvoiceDateWarnings(draft.invoiceDate) : []),
    [draft]
  )

  const mismatchWarning = React.useMemo(() => {
    if (!draft || billTotalsMatch(draft.totalAmount, draft.enteredBillTotal)) {
      return null
    }

    return `Entered bill total ${formatCurrency(draft.enteredBillTotal ?? 0)} does not match the computed total ${formatCurrency(draft.totalAmount)}. A variance of more than Rs.1 is not allowed.`
  }, [draft])

  const rcmSuggestion = React.useMemo(() => {
    if (!draft) {
      return { suggested: false, reason: null }
    }

    return hasRcmSuggestion(
      draft.supplierGstin,
      draft.lineItems,
      draft.totalAmount,
      draft.isUnregisteredSupplier
    )
  }, [draft])

  const gstCriticalChanges = React.useMemo(() => {
    if (!draft || !initialSnapshot) {
      return false
    }

    const currentSnapshot = JSON.stringify({
      supplierGstin: draft.supplierGstin,
      supplierInvoiceNumber: draft.supplierInvoiceNumber,
      invoiceDate: draft.invoiceDate,
      isRcm: draft.isRcm,
      lineItems: draft.lineItems.map((item) => ({
        description: item.itemDescription,
        hsnSacCode: item.hsnSacCode,
        quantity: item.quantity,
        ratePerUnit: item.ratePerUnit,
        gstRate: item.gstRate,
      })),
    })

    return currentSnapshot !== initialSnapshot
  }, [draft, initialSnapshot])

  const selectedSupplierName = draft?.supplierName || "Select a supplier"

  function updateDraft(mutator: (currentDraft: PurchaseBill) => PurchaseBill) {
    setDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft
      }

      return recalculateBillDraft(mutator(currentDraft))
    })
  }

  function handleLineItemChange(
    lineItemId: string,
    updater: (lineItem: PurchaseBillLineItem) => PurchaseBillLineItem
  ) {
    updateDraft((currentDraft) => ({
      ...currentDraft,
      lineItems: currentDraft.lineItems.map((lineItem) =>
        lineItem.id === lineItemId ? updater(lineItem) : lineItem
      ),
    }))
  }

  function handleSelectSupplier(supplier: PurchaseSupplier | typeof mockUnregisteredSupplier) {
    setSupplierSearch("")
    setShowNewSupplier(false)
    setSupplierDraft({
      gstin: "",
      legalName: "",
      tradeName: "",
      phone: "",
    })
    updateDraft((currentDraft) => normalizeSupplierFromSelection(supplier, currentDraft))
  }

  function handleVerifyNewSupplier() {
    const gstin = supplierDraft.gstin.trim().toUpperCase()
    if (!verifiedGstinPattern.test(gstin)) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        supplier: "Enter a valid 15-character GSTIN before verifying the supplier.",
      }))
      return
    }

    const stateMeta = getGstStateMeta(gstin)
    if (!stateMeta) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        supplier: "Unable to map the GSTIN state code. Check the first two GSTIN digits.",
      }))
      return
    }

    const newSupplier: PurchaseSupplier = {
      id: crypto.randomUUID(),
      legalName: supplierDraft.legalName || "New supplier",
      tradeName: supplierDraft.tradeName || supplierDraft.legalName || "New supplier",
      gstin,
      phone: supplierDraft.phone || undefined,
      isRegistered: true,
      stateCode: stateMeta.code,
      stateName: stateMeta.name,
    }

    addSupplier(newSupplier)
    setErrors((currentErrors) => ({ ...currentErrors, supplier: undefined }))
    handleSelectSupplier(newSupplier)
    setNotice(
      createPurchaseNotice(
        "Supplier verified",
        `${newSupplier.legalName} has been added with GSTIN ${newSupplier.gstin}.`,
        "success"
      )
    )
  }

  function handleAddLineItem() {
    updateDraft((currentDraft) => ({
      ...currentDraft,
      lineItems: [
        ...currentDraft.lineItems,
        createBlankLineItem(currentDraft.id, currentDraft.lineItems.length + 1),
      ],
    }))
  }

  function handleRemoveLineItem(lineItemId: string) {
    updateDraft((currentDraft) => ({
      ...currentDraft,
      lineItems:
        currentDraft.lineItems.length === 1 ?
          currentDraft.lineItems
        : currentDraft.lineItems
            .filter((lineItem) => lineItem.id !== lineItemId)
            .map((lineItem, index) => ({
              ...lineItem,
              sortOrder: index + 1,
            })),
    }))
  }

  function validateDraft(currentDraft: PurchaseBill) {
    const nextErrors: FormErrors = {}

    if (!currentDraft.supplierName) {
      nextErrors.supplier = "Select a supplier or mark the bill as unregistered supplier."
    }

    if (!supplierInvoiceNumberPattern.test(currentDraft.supplierInvoiceNumber.trim())) {
      nextErrors.supplierInvoiceNumber =
        "Supplier invoice number must be 1 to 16 characters and can include letters, numbers, -, _, ., /."
    }

    if (!currentDraft.invoiceDate) {
      nextErrors.invoiceDate = "Invoice date is required."
    }

    if (!currentDraft.billEntryDate) {
      nextErrors.billEntryDate = "Bill entry date is required."
    }

    if (currentDraft.lineItems.length === 0) {
      nextErrors.lineItems = "Add at least one line item before saving the bill."
    }

    if (duplicateInvoiceBill) {
      nextErrors.supplierInvoiceNumber = `This invoice already exists in ${duplicateInvoiceBill.billNumber}.`
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function commitSave(targetStatus: "draft" | "saved") {
    if (!draft) {
      return
    }

    const normalizedBill = recalculateBillDraft({
      ...draft,
      status: targetStatus,
      gstr2bStatus: draft.isRcm ? "not_applicable" : draft.gstr2bStatus,
      updatedAt: new Date().toISOString(),
    })

    const savedBill = saveBill(normalizedBill)
    router.push(`/purchases/view/${savedBill.id}`)
  }

  function handleSave(targetStatus: "draft" | "saved") {
    if (!draft || !validateDraft(draft)) {
      return
    }

    if (
      mode === "edit" &&
      draft.status !== "draft" &&
      gstCriticalChanges &&
      !draft.isRcm &&
      draft.gstr2bStatus !== "pending"
    ) {
      setPendingStatus(targetStatus)
      setGstConfirmationOpen(true)
      return
    }

    commitSave(targetStatus)
  }

  if (mode === "edit" && !existingBill) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">Purchase bill not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The bill you are trying to edit is no longer available in this session.
          </p>
          <Button
            className="mt-4"
            render={<Link href="/purchases" />}
          >
            Back to purchases
          </Button>
        </div>
      </div>
    )
  }

  if (!draft) {
    return null
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
        {notice ? <PurchaseNotice notice={notice} onDismiss={() => setNotice(null)} /> : null}

        <section className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
            <div className="space-y-2">
              <Badge variant="outline" className="gap-1.5 bg-background/70">
                {mode === "create" ? (
                  <FilePlus2Icon className="size-3.5" />
                ) : (
                  <ReceiptTextIcon className="size-3.5" />
                )}
                {mode === "create" ? "New purchase bill" : "Edit purchase bill"}
              </Badge>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {mode === "create" ? "Create purchase bill" : draft.billNumber}
                </h1>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Capture supplier details, tax treatment, payment status, and GSTR-2B reconciliation in one GST-ready workflow.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PurchaseStatusBadge status={draft.status} />
              <PurchaseGstrBadge status={draft.gstr2bStatus} />
              <PurchaseItcBadge eligibility={draft.itcEligibility} />
              <Button
                type="button"
                variant="outline"
                render={<Link href="/purchases" />}
              >
                <ArrowLeftIcon className="size-4" />
                Back to purchases
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)] xl:items-start">
          <div className="space-y-4">
            <FormSection
              title="Supplier details"
              description="Search an existing supplier first. If the supplier is not listed, add and verify the GSTIN inline."
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="supplier-search">Supplier search</FieldLabel>
                  <Input
                    id="supplier-search"
                    value={supplierSearch}
                    onChange={(event) => setSupplierSearch(event.target.value)}
                    placeholder="Search by supplier, GSTIN, or phone number"
                  />
                  <FieldDescription>
                    Current supplier: <span className="font-medium text-foreground">{selectedSupplierName}</span>
                  </FieldDescription>
                  <FieldError>{errors.supplier}</FieldError>
                </Field>

                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-left transition-colors hover:border-foreground/30 hover:bg-muted/50"
                    onClick={() => handleSelectSupplier(mockUnregisteredSupplier)}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <TruckIcon className="size-4 text-muted-foreground" />
                      Unregistered supplier purchase
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Use this when the supplier does not have a GSTIN. ITC and RCM checks will adjust automatically.
                    </p>
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-left transition-colors hover:border-foreground/30 hover:bg-muted/50"
                    onClick={() => setShowNewSupplier((currentValue) => !currentValue)}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <PlusIcon className="size-4 text-muted-foreground" />
                      Add verified supplier
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Verify a GSTIN locally, then add supplier details into the purchase register for reuse.
                    </p>
                  </button>
                </div>

                {availableSuppliers.length > 0 ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {availableSuppliers.map((supplier) => (
                      <button
                        key={supplier.id}
                        type="button"
                        onClick={() => handleSelectSupplier(supplier)}
                        className="rounded-2xl border border-border bg-background p-4 text-left transition-colors hover:border-foreground/20 hover:bg-muted/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-medium">{supplier.legalName}</p>
                            <p className="text-sm text-muted-foreground">{supplier.tradeName}</p>
                          </div>
                          <Badge variant="outline" className="gap-1.5">
                            <BadgeCheckIcon className="size-3.5 text-emerald-600" />
                            Verified
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                          <p className="font-mono uppercase tracking-[0.18em] text-foreground/80">
                            {supplier.gstin}
                          </p>
                          <p>{supplier.stateName}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-sm text-muted-foreground">
                    No suppliers match the search. Verify a GSTIN below or switch to unregistered supplier mode.
                  </div>
                )}

                {showNewSupplier ? (
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                      <ShieldCheckIcon className="size-4 text-emerald-600" />
                      Add verified supplier
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="new-supplier-gstin">Supplier GSTIN</FieldLabel>
                        <Input
                          id="new-supplier-gstin"
                          value={supplierDraft.gstin}
                          onChange={(event) =>
                            setSupplierDraft((currentDraft) => ({
                              ...currentDraft,
                              gstin: event.target.value.toUpperCase(),
                            }))
                          }
                          placeholder="33ABCDE1234F1Z5"
                          className="font-mono uppercase tracking-[0.18em]"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="new-supplier-name">Business legal name</FieldLabel>
                        <Input
                          id="new-supplier-name"
                          value={supplierDraft.legalName}
                          onChange={(event) =>
                            setSupplierDraft((currentDraft) => ({
                              ...currentDraft,
                              legalName: event.target.value,
                            }))
                          }
                          placeholder="Supplier legal name"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="new-supplier-trade">Trade name</FieldLabel>
                        <Input
                          id="new-supplier-trade"
                          value={supplierDraft.tradeName}
                          onChange={(event) =>
                            setSupplierDraft((currentDraft) => ({
                              ...currentDraft,
                              tradeName: event.target.value,
                            }))
                          }
                          placeholder="Trade name"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="new-supplier-phone">Phone number</FieldLabel>
                        <IndianPhoneInput
                          id="new-supplier-phone"
                          value={supplierDraft.phone}
                          onChange={(event) =>
                            setSupplierDraft((currentDraft) => ({
                              ...currentDraft,
                              phone: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" onClick={handleVerifyNewSupplier}>
                        <ShieldCheckIcon className="size-4" />
                        Verify and use supplier
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowNewSupplier(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                {draft.supplierName ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{draft.supplierName}</p>
                          {!draft.isUnregisteredSupplier ? (
                            <Badge className="gap-1.5 border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <BadgeCheckIcon className="size-3.5" />
                              GSTIN verified
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {draft.supplierTradeName || draft.supplierName}
                        </p>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p className="font-mono uppercase tracking-[0.18em] text-foreground">
                          {draft.isUnregisteredSupplier ? "UNREGISTERED" : draft.supplierGstin}
                        </p>
                        <p className="text-muted-foreground">
                          {draft.isUnregisteredSupplier ?
                            "No GSTIN available for this supplier"
                          : getSupplierStateNameFromGstin(draft.supplierGstin)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </FieldGroup>
            </FormSection>

            <FormSection
              title="Bill details"
              description="Capture the invoice identity, dates, place of supply, and purchase classification."
            >
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="bill-number">Internal bill number</FieldLabel>
                  <Input id="bill-number" value={draft.billNumber} readOnly />
                </Field>
                <Field>
                  <FieldLabel htmlFor="supplier-invoice-number">Supplier invoice number</FieldLabel>
                  <Input
                    id="supplier-invoice-number"
                    value={draft.supplierInvoiceNumber}
                    onChange={(event) =>
                      setDraft((currentDraft) =>
                        currentDraft ?
                          {
                            ...currentDraft,
                            supplierInvoiceNumber: event.target.value.toUpperCase(),
                          }
                        : currentDraft
                      )
                    }
                    placeholder="INV/26-27/001"
                  />
                  <FieldError>{errors.supplierInvoiceNumber}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="invoice-date">Invoice date</FieldLabel>
                  <Input
                    id="invoice-date"
                    type="date"
                    value={draft.invoiceDate}
                    onChange={(event) =>
                      updateDraft((currentDraft) => ({
                        ...currentDraft,
                        invoiceDate: event.target.value,
                      }))
                    }
                  />
                  <FieldError>{errors.invoiceDate}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="bill-entry-date">Bill entry date</FieldLabel>
                  <Input
                    id="bill-entry-date"
                    type="date"
                    value={draft.billEntryDate}
                    onChange={(event) =>
                      setDraft((currentDraft) =>
                        currentDraft ?
                          {
                            ...currentDraft,
                            billEntryDate: event.target.value,
                          }
                        : currentDraft
                      )
                    }
                  />
                  <FieldError>{errors.billEntryDate}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="place-of-supply">Place of supply</FieldLabel>
                  <Select
                    value={draft.placeOfSupply}
                    onValueChange={(value) =>
                      updateDraft((currentDraft) => ({
                        ...currentDraft,
                        placeOfSupply: value ?? businessStateCode,
                        supplyType:
                          (value ?? businessStateCode) === businessStateCode ? "intra" : "inter",
                      }))
                    }
                  >
                    <SelectTrigger id="place-of-supply" className="w-full">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {getAllGstStates().map((stateMeta) => (
                        <SelectItem key={stateMeta.code} value={stateMeta.code}>
                          {stateMeta.code} - {stateMeta.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="supply-type">Supply type</FieldLabel>
                  <Input
                    id="supply-type"
                    value={draft.supplyType === "intra" ? "Intra-state" : "Inter-state"}
                    readOnly
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="purchase-type">Purchase type</FieldLabel>
                  <Select
                    value={draft.purchaseType}
                    onValueChange={(value) =>
                      setDraft((currentDraft) =>
                        currentDraft && value ?
                          {
                            ...currentDraft,
                            purchaseType: value as PurchaseBill["purchaseType"],
                          }
                        : currentDraft
                      )
                    }
                  >
                    <SelectTrigger id="purchase-type" className="w-full">
                      <SelectValue placeholder="Select purchase type" />
                    </SelectTrigger>
                    <SelectContent align="start">
                      <SelectItem value="goods">Goods</SelectItem>
                      <SelectItem value="services">Services</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="purchase-order-ref">PO reference</FieldLabel>
                  <Input
                    id="purchase-order-ref"
                    value={draft.purchaseOrderRef ?? ""}
                    onChange={(event) =>
                      setDraft((currentDraft) =>
                        currentDraft ?
                          {
                            ...currentDraft,
                            purchaseOrderRef: event.target.value || null,
                          }
                        : currentDraft
                      )
                    }
                    placeholder="Optional PO reference"
                  />
                </Field>
              </FieldGroup>

              {invoiceWarnings.length > 0 || duplicateInvoiceBill ? (
                <div className="mt-4 space-y-3">
                  {invoiceWarnings.map((warningMessage) => (
                    <div
                      key={warningMessage}
                      className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100"
                    >
                      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                      <p>{warningMessage}</p>
                    </div>
                  ))}
                  {duplicateInvoiceBill ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                      <p>
                        Possible duplicate invoice detected. This supplier invoice number already exists in{" "}
                        <span className="font-medium">{duplicateInvoiceBill.billNumber}</span>.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </FormSection>

            <FormSection
              title="Line items"
              description="Add every taxable item or service on the supplier bill. HSN or SAC drives the GST defaults."
            >
              <FieldError>{errors.lineItems}</FieldError>
              <div className="app-scrollbar overflow-x-auto">
                <div className="min-w-[1080px] space-y-3">
                  {draft.lineItems.map((lineItem) => (
                    <div
                      key={lineItem.id}
                      className="grid gap-3 rounded-2xl border border-border bg-background p-4 md:grid-cols-[minmax(180px,1.4fr)_minmax(150px,1.1fr)_70px_86px_110px_110px_96px_112px_112px_52px]"
                    >
                      <Field>
                        <FieldLabel>Description</FieldLabel>
                        <Input
                          value={lineItem.itemDescription}
                          onChange={(event) =>
                            handleLineItemChange(lineItem.id, (currentLineItem) => ({
                              ...currentLineItem,
                              itemDescription: event.target.value,
                            }))
                          }
                          placeholder="Item description"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>HSN / SAC</FieldLabel>
                        <Select
                          value={lineItem.hsnSacCode}
                          onValueChange={(value) => {
                            const lookupItem = findLookupItem(value ?? purchaseLookupItems[0].code)
                            handleLineItemChange(lineItem.id, (currentLineItem) => ({
                              ...currentLineItem,
                              hsnSacCode: lookupItem.code,
                              itemDescription:
                                currentLineItem.itemDescription ===
                                  findLookupItem(currentLineItem.hsnSacCode).title ||
                                currentLineItem.itemDescription.length === 0 ?
                                  lookupItem.title
                                : currentLineItem.itemDescription,
                              gstRate: lookupItem.defaultGstRate,
                              itcFlag: lookupItem.itcFlag ?? currentLineItem.itcFlag,
                            }))
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose HSN/SAC" />
                          </SelectTrigger>
                          <SelectContent align="start">
                            {purchaseLookupItems.map((lookupItem) => (
                              <SelectItem key={lookupItem.code} value={lookupItem.code}>
                                {lookupItem.code} - {lookupItem.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>Qty</FieldLabel>
                        <Input
                          type="number"
                          min="0"
                          value={lineItem.quantity}
                          onChange={(event) =>
                            handleLineItemChange(lineItem.id, (currentLineItem) => ({
                              ...currentLineItem,
                              quantity: Number(event.target.value || 0),
                            }))
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Unit</FieldLabel>
                        <Select
                          value={lineItem.unit}
                          onValueChange={(value) =>
                            handleLineItemChange(lineItem.id, (currentLineItem) => ({
                              ...currentLineItem,
                              unit: value ?? currentLineItem.unit,
                            }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent align="start">
                            {purchaseUnits.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>Rate / unit</FieldLabel>
                        <Input
                          type="number"
                          min="0"
                          value={lineItem.ratePerUnit}
                          onChange={(event) =>
                            handleLineItemChange(lineItem.id, (currentLineItem) => ({
                              ...currentLineItem,
                              ratePerUnit: Number(event.target.value || 0),
                            }))
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Taxable</FieldLabel>
                        <Input value={formatCurrency(lineItem.taxableAmount)} readOnly />
                      </Field>
                      <Field>
                        <FieldLabel>GST %</FieldLabel>
                        <Input
                          type="number"
                          min="0"
                          value={lineItem.gstRate}
                          onChange={(event) =>
                            handleLineItemChange(lineItem.id, (currentLineItem) => ({
                              ...currentLineItem,
                              gstRate: Number(event.target.value || 0),
                            }))
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel>ITC flag</FieldLabel>
                        <Select
                          value={lineItem.itcFlag}
                          onValueChange={(value) =>
                            handleLineItemChange(lineItem.id, (currentLineItem) => ({
                              ...currentLineItem,
                              itcFlag: (value as ItcFlag | null) ?? currentLineItem.itcFlag,
                              itcClaimAmount:
                                value === "blocked" ? 0 : currentLineItem.itcClaimAmount,
                            }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="ITC flag" />
                          </SelectTrigger>
                          <SelectContent align="start">
                            <SelectItem value="eligible">Eligible</SelectItem>
                            <SelectItem value="check">Check</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>Total</FieldLabel>
                        <Input value={formatCurrency(lineItem.totalAmount)} readOnly />
                      </Field>
                      <div className="flex items-end justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={draft.lineItems.length === 1}
                          onClick={() => handleRemoveLineItem(lineItem.id)}
                        >
                          <Trash2Icon className="size-4" />
                          <span className="sr-only">Remove line item</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleAddLineItem}>
                  <PackagePlusIcon className="size-4" />
                  Add line item
                </Button>
              </div>
            </FormSection>

            <FormSection
              title="Tax treatment and payment"
              description="Control reverse charge, ITC eligibility, and payment completion for this bill."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">Reverse charge mechanism</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Enable RCM when the tax must be paid by you instead of the supplier. GSTR-2B status will become not applicable.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant={draft.isRcm ? "default" : "outline"}
                        onClick={() =>
                          updateDraft((currentDraft) => ({
                            ...currentDraft,
                            isRcm: !currentDraft.isRcm,
                            gstr2bStatus:
                              !currentDraft.isRcm ? "not_applicable" : "pending",
                          }))
                        }
                      >
                        {draft.isRcm ? "RCM enabled" : "Enable RCM"}
                      </Button>
                    </div>
                    {rcmSuggestion.reason ? (
                      <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
                        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                        <p>{rcmSuggestion.reason}</p>
                      </div>
                    ) : null}
                  </div>

                  <Field>
                    <FieldLabel htmlFor="itc-eligibility">ITC eligibility</FieldLabel>
                    <Select
                      value={draft.itcEligibility}
                      onValueChange={(value) =>
                        updateDraft((currentDraft) => ({
                          ...currentDraft,
                          itcEligibility: (value as ItcEligibility | null) ?? currentDraft.itcEligibility,
                        }))
                      }
                    >
                      <SelectTrigger id="itc-eligibility" className="w-full">
                        <SelectValue placeholder="Select ITC eligibility" />
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectItem value="full">Fully eligible</SelectItem>
                        <SelectItem value="partial">Partially eligible</SelectItem>
                        <SelectItem value="blocked">Blocked (Section 17(5))</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {draft.itcEligibility === "blocked" ?
                        "Blocked ITC will be treated as a cost and excluded from claimable credit."
                      : draft.itcEligibility === "partial" ?
                        "Enter claimable ITC per line item below."
                      : "All eligible GST from this bill will flow into input tax credit."}
                    </FieldDescription>
                  </Field>

                  {draft.itcEligibility === "partial" ? (
                    <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="text-sm font-medium">Partial ITC allocation</div>
                      {draft.lineItems.map((lineItem) => {
                        const lineTax = roundCurrency(
                          lineItem.cgstAmount + lineItem.sgstAmount + lineItem.igstAmount
                        )
                        return (
                          <div
                            key={`itc_${lineItem.id}`}
                            className="grid gap-3 rounded-xl border border-border bg-background p-3 md:grid-cols-[minmax(0,1fr)_160px_160px]"
                          >
                            <div>
                              <p className="font-medium">{lineItem.itemDescription}</p>
                              <p className="text-sm text-muted-foreground">
                                {lineItem.hsnSacCode} • Tax available {formatCurrency(lineTax)}
                              </p>
                            </div>
                            <Input value={formatCurrency(lineTax)} readOnly />
                            <Input
                              type="number"
                              min="0"
                              max={lineTax}
                              value={lineItem.itcClaimAmount ?? lineTax}
                              onChange={(event) =>
                                handleLineItemChange(lineItem.id, (currentLineItem) => ({
                                  ...currentLineItem,
                                  itcClaimAmount: Number(event.target.value || 0),
                                }))
                              }
                            />
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <Field>
                    <FieldLabel htmlFor="payment-status">Payment status</FieldLabel>
                    <Select
                      value={draft.paymentStatus}
                      onValueChange={(value) =>
                        setDraft((currentDraft) =>
                          currentDraft && value ?
                            {
                              ...currentDraft,
                              paymentStatus: value as PaymentStatus,
                            }
                          : currentDraft
                        )
                      }
                    >
                      <SelectTrigger id="payment-status" className="w-full">
                        <SelectValue placeholder="Select payment status" />
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="amount-paid">Amount paid</FieldLabel>
                    <Input
                      id="amount-paid"
                      type="number"
                      min="0"
                      value={draft.amountPaid}
                      onChange={(event) =>
                        updateDraft((currentDraft) => ({
                          ...currentDraft,
                          amountPaid: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="payment-date">Payment date</FieldLabel>
                    <Input
                      id="payment-date"
                      type="date"
                      value={draft.paymentDate ?? ""}
                      onChange={(event) =>
                        setDraft((currentDraft) =>
                          currentDraft ?
                            {
                              ...currentDraft,
                              paymentDate: event.target.value || null,
                            }
                          : currentDraft
                        )
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="payment-mode">Payment mode</FieldLabel>
                    <Select
                      value={draft.paymentMode ?? "none"}
                      onValueChange={(value) =>
                        setDraft((currentDraft) =>
                          currentDraft ?
                            {
                              ...currentDraft,
                              paymentMode:
                                !value || value === "none" ? null : (value as PaymentMode),
                            }
                          : currentDraft
                        )
                      }
                    >
                      <SelectTrigger id="payment-mode" className="w-full">
                        <SelectValue placeholder="Select payment mode" />
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectItem value="none">No mode selected</SelectItem>
                        {paymentModeOptions.map((paymentMode) => (
                          <SelectItem key={paymentMode} value={paymentMode}>
                            {paymentMode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Attachments and notes"
              description="Store the local file name for the supplier bill and add internal notes for finance or audit teams."
            >
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="bill-attachment">Attachment</FieldLabel>
                  <Input
                    id="bill-attachment"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(event) => {
                      const selectedFile = event.target.files?.[0] ?? null
                      setDraft((currentDraft) =>
                        currentDraft ?
                          {
                            ...currentDraft,
                            attachmentName: selectedFile?.name ?? null,
                            attachmentUrl:
                              selectedFile ? `mock://attachments/${selectedFile.name}` : null,
                          }
                        : currentDraft
                      )
                    }}
                  />
                  <FieldDescription>
                    {draft.attachmentName ?
                      `Attached file: ${draft.attachmentName}`
                    : "Accepted formats: PDF, JPG, PNG. Stored only in local form state for now."}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="internal-notes">Internal notes</FieldLabel>
                  <Textarea
                    id="internal-notes"
                    value={draft.notes ?? ""}
                    onChange={(event) =>
                      setDraft((currentDraft) =>
                        currentDraft ?
                          {
                            ...currentDraft,
                            notes: event.target.value || null,
                          }
                        : currentDraft
                      )
                    }
                    placeholder="Notes for follow-up, supplier reconciliation, or audit comments"
                    className="min-h-24"
                  />
                </Field>
              </FieldGroup>
            </FormSection>
          </div>

          <div className="space-y-4 xl:sticky xl:top-24">
            <FormSection
              title="Bill summary"
              description="Auto-calculated from the line items and the selected GST treatment."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Taxable value</span>
                    <span className="font-mono font-semibold">
                      {formatCurrency(draft.taxableValue)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                    <div className="rounded-xl bg-muted/30 p-3">
                      <p className="text-muted-foreground">CGST</p>
                      <p className="mt-1 font-mono">{formatCurrency(draft.cgstAmount)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/30 p-3">
                      <p className="text-muted-foreground">SGST</p>
                      <p className="mt-1 font-mono">{formatCurrency(draft.sgstAmount)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/30 p-3">
                      <p className="text-muted-foreground">IGST</p>
                      <p className="mt-1 font-mono">{formatCurrency(draft.igstAmount)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/5 p-3">
                    <span className="text-sm font-medium">Bill total</span>
                    <span className="font-mono text-lg font-semibold">
                      {formatCurrency(draft.totalAmount)}
                    </span>
                  </div>
                </div>

                <Field>
                  <FieldLabel htmlFor="entered-bill-total">Entered supplier bill total</FieldLabel>
                  <Input
                    id="entered-bill-total"
                    type="number"
                    value={draft.enteredBillTotal ?? 0}
                    onChange={(event) =>
                      setDraft((currentDraft) =>
                        currentDraft ?
                          {
                            ...currentDraft,
                            enteredBillTotal: Number(event.target.value || 0),
                          }
                        : currentDraft
                      )
                    }
                  />
                  <FieldDescription>
                    Use this when the supplier PDF or bill amount must match the computed total before saving.
                  </FieldDescription>
                </Field>

                {mismatchWarning ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                    {mismatchWarning}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ShieldCheckIcon className="size-4 text-emerald-600" />
                      Eligible ITC
                    </div>
                    <p className="mt-3 font-mono text-lg font-semibold">
                      {formatCurrency(draft.itcEligibleAmount)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <AlertTriangleIcon className="size-4 text-amber-600" />
                      Blocked ITC
                    </div>
                    <p className="mt-3 font-mono text-lg font-semibold">
                      {formatCurrency(draft.itcBlockedAmount)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ReceiptTextIcon className="size-4 text-muted-foreground" />
                      Filing tags
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <PurchasePaymentBadge status={draft.paymentStatus} />
                      <PurchaseGstrBadge status={draft.gstr2bStatus} />
                      <PurchaseItcBadge eligibility={draft.itcEligibility} />
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Financial year</span>
                        <span className="font-medium text-foreground">{draft.financialYear}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Tax period</span>
                        <span className="font-medium text-foreground">{draft.taxPeriod}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <IndianRupeeIcon className="size-4 text-muted-foreground" />
                      Actions
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                      <Button type="button" onClick={() => handleSave("saved")}>
                        <SaveIcon className="size-4" />
                        Save bill
                      </Button>
                      <Button type="button" variant="outline" onClick={() => handleSave("draft")}>
                        <ReceiptTextIcon className="size-4" />
                        Save as draft
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </FormSection>
          </div>
        </div>
      </div>

      <Dialog
        open={gstConfirmationOpen}
        onOpenChange={(open) => {
          setGstConfirmationOpen(open)
          if (!open) {
            setPendingStatus(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset GSTR-2B status?</DialogTitle>
            <DialogDescription>
              You changed GST-critical fields on an existing bill. Saving now will reset the GSTR-2B status back to pending so reconciliation can happen again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setGstConfirmationOpen(false)
                setPendingStatus(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!draft || !pendingStatus) {
                  return
                }

                setDraft((currentDraft) =>
                  currentDraft ?
                    {
                      ...currentDraft,
                      gstr2bStatus: currentDraft.isRcm ? "not_applicable" : "pending",
                    }
                  : currentDraft
                )
                setGstConfirmationOpen(false)
                setPendingStatus(null)
                setTimeout(() => commitSave(pendingStatus), 0)
              }}
            >
              Reset and save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
