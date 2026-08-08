"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  CopyPlusIcon,
  EyeIcon,
  FileDownIcon,
  MailIcon,
  MapPinIcon,
  MoreHorizontalIcon,
  PencilLineIcon,
  PrinterIcon,
  ReceiptTextIcon,
  RefreshCcwIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { PurchaseActionDialogs, type PurchaseActionDialogState } from "@/components/purchases/purchase-action-dialogs"
import {
  PurchaseGstrBadge,
  PurchaseItcBadge,
  PurchasePaymentBadge,
  PurchaseStatusBadge,
} from "@/components/purchases/purchase-badges"
import { PurchaseNotice } from "@/components/purchases/purchase-notice"
import { usePurchases } from "@/components/purchases/purchases-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDisplayDate } from "@/lib/purchases/utils"

function DetailSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="p-4 sm:p-5 lg:p-6">{children}</div>
    </section>
  )
}

function MetaRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

export function PurchaseDetailPage({
  billId,
}: {
  billId: string
}) {
  const router = useRouter()
  const {
    getBillById,
    notice,
    setNotice,
    duplicateBill,
    updateGstr2bStatus,
    markAsReconciled,
  } = usePurchases()
  const [actionDialog, setActionDialog] =
    React.useState<PurchaseActionDialogState>(null)

  const bill = getBillById(billId)

  if (!bill) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">Purchase bill not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This bill is not available in the current frontend session.
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

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
        {notice ? <PurchaseNotice notice={notice} onDismiss={() => setNotice(null)} /> : null}

        <section className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between lg:p-6">
            <div className="space-y-2">
              <Badge variant="outline" className="gap-1.5 bg-background/70">
                <EyeIcon className="size-3.5" />
                Purchase detail
              </Badge>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">{bill.billNumber}</h1>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Supplier invoice {bill.supplierInvoiceNumber} from {bill.supplierName}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PurchaseStatusBadge status={bill.status} />
                <PurchaseGstrBadge status={bill.gstr2bStatus} />
                <PurchaseItcBadge eligibility={bill.itcEligibility} />
                <PurchasePaymentBadge status={bill.paymentStatus} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                render={<Link href="/purchases" />}
              >
                <ArrowLeftIcon className="size-4" />
                Back
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push(`/purchases/edit/${bill.id}`)}>
                <PencilLineIcon className="size-4" />
                Edit
              </Button>
              <Button type="button" variant="outline" onClick={() => setActionDialog({ type: "print", bill })}>
                <PrinterIcon className="size-4" />
                Print
              </Button>
              <Button type="button" variant="outline" onClick={() => setActionDialog({ type: "pdf", bill })}>
                <FileDownIcon className="size-4" />
                PDF
              </Button>
              <Button type="button" variant="outline" onClick={() => setActionDialog({ type: "email", bill })}>
                <MailIcon className="size-4" />
                Send Email
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button type="button" variant="outline" />}
                >
                  <MoreHorizontalIcon className="size-4" />
                  More
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-52">
                  <DropdownMenuItem
                    onClick={() => {
                      const duplicatedBill = duplicateBill(bill.id)
                      if (duplicatedBill) {
                        router.push(`/purchases/edit/${duplicatedBill.id}`)
                      }
                    }}
                  >
                    <CopyPlusIcon className="text-muted-foreground" />
                    <span>Duplicate bill</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActionDialog({ type: "gstr2b", bill })}>
                    <RefreshCcwIcon className="text-muted-foreground" />
                    <span>Update GSTR-2B status</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActionDialog({ type: "reconcile", bill })}>
                    <ReceiptTextIcon className="text-muted-foreground" />
                    <span>Mark as reconciled</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)] xl:items-start">
          <div className="space-y-4">
            <DetailSection title="Supplier summary">
              <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{bill.supplierName}</p>
                    {!bill.isUnregisteredSupplier ? (
                      <Badge className="gap-1.5 border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <ShieldCheckIcon className="size-3.5" />
                        GSTIN verified
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {bill.supplierTradeName || bill.supplierName}
                  </p>
                  <p className="font-mono text-sm uppercase tracking-[0.18em] text-foreground">
                    {bill.isUnregisteredSupplier ? "UNREGISTERED" : bill.supplierGstin}
                  </p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPinIcon className="size-4" />
                    <span>Place of supply</span>
                  </div>
                  <p className="font-medium text-foreground">{bill.placeOfSupply}</p>
                  <p className="text-muted-foreground">
                    {bill.supplierPhone || "No phone recorded"}
                  </p>
                </div>
              </div>
            </DetailSection>

            <DetailSection title="Bill details">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <MetaRow label="Supplier invoice number" value={bill.supplierInvoiceNumber} />
                  <MetaRow label="Invoice date" value={formatDisplayDate(bill.invoiceDate)} />
                  <MetaRow label="Bill entry date" value={formatDisplayDate(bill.billEntryDate)} />
                  <MetaRow label="Purchase type" value={bill.purchaseType} />
                </div>
                <div className="space-y-3">
                  <MetaRow label="Supply type" value={bill.supplyType} />
                  <MetaRow label="PO reference" value={bill.purchaseOrderRef || "-"} />
                  <MetaRow label="Financial year" value={bill.financialYear} />
                  <MetaRow label="Tax period" value={bill.taxPeriod} />
                </div>
              </div>
            </DetailSection>

            <DetailSection title="Line items">
              <div className="app-scrollbar overflow-x-auto">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Description</TableHead>
                      <TableHead>HSN/SAC</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Taxable</TableHead>
                      <TableHead className="text-right">GST %</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bill.lineItems.map((lineItem) => (
                      <TableRow key={lineItem.id}>
                        <TableCell>{lineItem.itemDescription}</TableCell>
                        <TableCell>{lineItem.hsnSacCode}</TableCell>
                        <TableCell className="text-right">{lineItem.quantity}</TableCell>
                        <TableCell>{lineItem.unit}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(lineItem.ratePerUnit)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(lineItem.taxableAmount)}
                        </TableCell>
                        <TableCell className="text-right">{lineItem.gstRate}%</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(
                            lineItem.cgstAmount + lineItem.sgstAmount + lineItem.igstAmount
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatCurrency(lineItem.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </DetailSection>
          </div>

          <div className="space-y-4 xl:sticky xl:top-24">
            <DetailSection title="Totals and reconciliation">
              <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
                <MetaRow label="Taxable value" value={formatCurrency(bill.taxableValue)} />
                <MetaRow label="CGST" value={formatCurrency(bill.cgstAmount)} />
                <MetaRow label="SGST" value={formatCurrency(bill.sgstAmount)} />
                <MetaRow label="IGST" value={formatCurrency(bill.igstAmount)} />
                <MetaRow label="Bill total" value={formatCurrency(bill.totalAmount)} />
                <MetaRow
                  label="Entered bill total"
                  value={formatCurrency(bill.enteredBillTotal ?? bill.totalAmount)}
                />
              </div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">Eligible ITC</p>
                  <p className="mt-2 font-mono text-lg font-semibold">
                    {formatCurrency(bill.itcEligibleAmount)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">Blocked ITC</p>
                  <p className="mt-2 font-mono text-lg font-semibold">
                    {formatCurrency(bill.itcBlockedAmount)}
                  </p>
                </div>
              </div>
            </DetailSection>

            <DetailSection title="Payment and notes">
              <div className="space-y-3">
                <MetaRow label="Payment status" value={<PurchasePaymentBadge status={bill.paymentStatus} />} />
                <MetaRow label="Amount paid" value={formatCurrency(bill.amountPaid)} />
                <MetaRow
                  label="Payment date"
                  value={bill.paymentDate ? formatDisplayDate(bill.paymentDate) : "-"}
                />
                <MetaRow label="Payment mode" value={bill.paymentMode || "-"} />
                <MetaRow label="RCM" value={bill.isRcm ? "Enabled" : "Disabled"} />
                <MetaRow
                  label="Attachment"
                  value={bill.attachmentName || "No attachment uploaded"}
                />
              </div>
              {bill.notes ? (
                <div className="mt-4 rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                  {bill.notes}
                </div>
              ) : null}
            </DetailSection>
          </div>
        </div>
      </div>

      <PurchaseActionDialogs
        state={actionDialog}
        onClose={() => setActionDialog(null)}
        onUpdateGstr2bStatus={(targetBill, status) => updateGstr2bStatus(targetBill.id, status)}
        onMarkAsReconciled={(targetBill) => markAsReconciled(targetBill.id)}
      />
    </>
  )
}
