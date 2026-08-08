"use client"

import * as React from "react"
import {
  CheckCircle2Icon,
  DownloadIcon,
  MailIcon,
  PrinterIcon,
  RefreshCcwIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { PurchaseBill, Gstr2bStatus } from "@/lib/purchases/types"
import {
  formatCurrency,
  formatDisplayDate,
  gstr2bStatusLabels,
} from "@/lib/purchases/utils"

export type PurchaseActionDialogState =
  | { type: "print"; bill: PurchaseBill }
  | { type: "pdf"; bill: PurchaseBill }
  | { type: "email"; bill: PurchaseBill }
  | { type: "gstr2b"; bill: PurchaseBill }
  | { type: "reconcile"; bill: PurchaseBill }
  | { type: "delete"; bill: PurchaseBill }
  | null

const editableGstrStatuses: Gstr2bStatus[] = [
  "pending",
  "matched",
  "unmatched",
  "rejected",
  "not_applicable",
]

export function PurchaseActionDialogs({
  state,
  onClose,
  onDelete,
  onUpdateGstr2bStatus,
  onMarkAsReconciled,
}: {
  state: PurchaseActionDialogState
  onClose: () => void
  onDelete?: (bill: PurchaseBill) => void
  onUpdateGstr2bStatus?: (bill: PurchaseBill, status: Gstr2bStatus) => void
  onMarkAsReconciled?: (bill: PurchaseBill) => void
}) {
  function handleDownloadPdf() {
    if (!state || state.type !== "pdf") {
      return
    }

    const blob = new Blob(
      [
        [
          `Purchase Bill: ${state.bill.billNumber}`,
          `Supplier: ${state.bill.supplierName}`,
          `Invoice Number: ${state.bill.supplierInvoiceNumber}`,
          `Invoice Date: ${formatDisplayDate(state.bill.invoiceDate)}`,
          `Total: ${formatCurrency(state.bill.totalAmount)}`,
        ].join("\n"),
      ],
      { type: "text/plain;charset=utf-8" }
    )
    const blobUrl = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = blobUrl
    anchor.download = `${state.bill.billNumber}.txt`
    anchor.click()
    URL.revokeObjectURL(blobUrl)
    onClose()
  }

  function handlePrint() {
    window.print()
    onClose()
  }

  const open = state !== null

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      {state?.type === "print" ? (
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Print purchase bill</DialogTitle>
            <DialogDescription>
              Preview the bill summary and open the browser print dialog.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Bill:</span> {state.bill.billNumber}</p>
              <p><span className="font-medium">Supplier:</span> {state.bill.supplierName}</p>
              <p><span className="font-medium">Invoice date:</span> {formatDisplayDate(state.bill.invoiceDate)}</p>
              <p><span className="font-medium">Bill total:</span> {formatCurrency(state.bill.totalAmount)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={handlePrint}>
              <PrinterIcon className="size-4" />
              Open print dialog
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}

      {state?.type === "pdf" ? (
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Download bill export</DialogTitle>
            <DialogDescription>
              Create a mock export file for this purchase bill.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            A frontend-only export will be generated for {state.bill.billNumber}.
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={handleDownloadPdf}>
              <DownloadIcon className="size-4" />
              Download mock PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}

      {state?.type === "email" ? (
        <PurchaseEmailDialogContent bill={state.bill} onClose={onClose} />
      ) : null}

      {state?.type === "gstr2b" ? (
        <PurchaseGstrDialogContent
          bill={state.bill}
          onClose={onClose}
          onUpdateGstr2bStatus={onUpdateGstr2bStatus}
        />
      ) : null}

      {state?.type === "reconcile" ? (
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Mark as reconciled</DialogTitle>
            <DialogDescription>
              Confirm that {state.bill.billNumber} is ready to move to reconciled status.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="button"
              onClick={() => {
                onMarkAsReconciled?.(state.bill)
                onClose()
              }}
            >
              <CheckCircle2Icon className="size-4" />
              Mark reconciled
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}

      {state?.type === "delete" ? (
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete draft bill</DialogTitle>
            <DialogDescription>
              Remove {state.bill.billNumber} from the purchase register? Only draft bills can be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onDelete?.(state.bill)
                onClose()
              }}
            >
              Delete draft
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function PurchaseEmailDialogContent({
  bill,
  onClose,
}: {
  bill: PurchaseBill
  onClose: () => void
}) {
  const [emailTo, setEmailTo] = React.useState(
    bill.supplierPhone ?? "accounts@supplier.example"
  )
  const [emailSubject, setEmailSubject] = React.useState(
    `Purchase bill ${bill.billNumber}`
  )
  const [emailBody, setEmailBody] = React.useState(
    `Hello,\n\nPlease find the purchase bill reference ${bill.billNumber} for ${bill.supplierName}.\n\nRegards,\nGSTFY`
  )

  return (
    <DialogContent showCloseButton={false}>
      <DialogHeader>
        <DialogTitle>Send purchase bill</DialogTitle>
        <DialogDescription>
          Review the email details before sending this mock message.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <Field>
          <FieldLabel htmlFor="purchase-email-to">To</FieldLabel>
          <Input id="purchase-email-to" value={emailTo} onChange={(event) => setEmailTo(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="purchase-email-subject">Subject</FieldLabel>
          <Input
            id="purchase-email-subject"
            value={emailSubject}
            onChange={(event) => setEmailSubject(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="purchase-email-body">Message</FieldLabel>
          <Textarea
            id="purchase-email-body"
            value={emailBody}
            onChange={(event) => setEmailBody(event.target.value)}
            className="min-h-28"
          />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={onClose}>
          <MailIcon className="size-4" />
          Send mock email
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function PurchaseGstrDialogContent({
  bill,
  onClose,
  onUpdateGstr2bStatus,
}: {
  bill: PurchaseBill
  onClose: () => void
  onUpdateGstr2bStatus?: (bill: PurchaseBill, status: Gstr2bStatus) => void
}) {
  const [gstrStatus, setGstrStatus] = React.useState<Gstr2bStatus>(bill.gstr2bStatus)

  return (
    <DialogContent showCloseButton={false}>
      <DialogHeader>
        <DialogTitle>Update GSTR-2B status</DialogTitle>
        <DialogDescription>
          Change the reconciliation status for {bill.billNumber}.
        </DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="gstr-status">Status</FieldLabel>
        <Select value={gstrStatus} onValueChange={(value) => setGstrStatus((value as Gstr2bStatus | null) ?? gstrStatus)}>
          <SelectTrigger id="gstr-status" className="w-full">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent align="start" sideOffset={8}>
            {editableGstrStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {gstr2bStatusLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          type="button"
          onClick={() => {
            onUpdateGstr2bStatus?.(bill, gstrStatus)
            onClose()
          }}
        >
          <RefreshCcwIcon className="size-4" />
          Update status
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
