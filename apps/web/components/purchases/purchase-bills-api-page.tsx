"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FilePlus2Icon, ReceiptTextIcon, SearchIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  createPurchaseBill,
  listPurchaseBills,
  postPurchaseBill,
  type CreatePurchaseBillPayload,
  type PurchaseBill,
} from "@/lib/purchases/api"
import type { PaymentMode } from "@/lib/sales/api"
import { cn } from "@/lib/utils"

type FormState = {
  supplierName: string
  supplierInvoiceNumber: string
  invoiceDate: string
  billDate: string
  placeOfSupplyStateCode: string
  itemName: string
  hsnSacCode: string
  quantity: string
  rate: string
  gstRate: string
  amountPaid: string
  paymentMode: PaymentMode
}

const today = new Date().toISOString().slice(0, 10)
const initialForm: FormState = {
  supplierName: "",
  supplierInvoiceNumber: "",
  invoiceDate: today,
  billDate: today,
  placeOfSupplyStateCode: "33",
  itemName: "Purchase item",
  hsnSacCode: "210690",
  quantity: "1",
  rate: "1000",
  gstRate: "18",
  amountPaid: "",
  paymentMode: "bank",
}

export function PurchaseBillsApiPage() {
  const queryClient = useQueryClient()
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const [search, setSearch] = React.useState("")
  const [form, setForm] = React.useState<FormState>(initialForm)

  const billsQuery = useQuery({
    queryKey: ["purchase-bills", search],
    queryFn: () => listPurchaseBills(accessToken, search),
    enabled: accessToken.length > 0,
  })
  const createMutation = useMutation({
    mutationFn: (payload: CreatePurchaseBillPayload) =>
      createPurchaseBill(accessToken, payload),
    onSuccess: async ({ bill }) => {
      toast.success(
        bill.status === "posted" ? "Purchase bill posted." : "Purchase draft saved."
      )
      setForm(initialForm)
      await queryClient.invalidateQueries({ queryKey: ["purchase-bills"] })
      await queryClient.invalidateQueries({ queryKey: ["accounting"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to save purchase bill."),
  })
  const postMutation = useMutation({
    mutationFn: (billId: string) => postPurchaseBill(accessToken, billId),
    onSuccess: async () => {
      toast.success("Purchase bill posted.")
      await queryClient.invalidateQueries({ queryKey: ["purchase-bills"] })
      await queryClient.invalidateQueries({ queryKey: ["accounting"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to post bill."),
  })

  const bills = billsQuery.data?.bills ?? []
  const estimated = estimateTotal(form)

  function submit(status: "draft" | "posted") {
    createMutation.mutate({
      status,
      supplierName: form.supplierName || null,
      supplierInvoiceNumber: form.supplierInvoiceNumber || null,
      invoiceDate: form.invoiceDate,
      billDate: form.billDate,
      placeOfSupplyStateCode: form.placeOfSupplyStateCode,
      purchaseType: "goods",
      lines: [
        {
          itemName: form.itemName,
          hsnSacCode: form.hsnSacCode || null,
          quantity: form.quantity,
          unit: "PCS",
          rate: form.rate,
          gstRate: form.gstRate,
          itcEligible: true,
        },
      ],
      payments:
        form.amountPaid && Number(form.amountPaid) > 0 ?
          [{ paymentMode: form.paymentMode, amount: form.amountPaid }]
        : [],
    })
  }

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6">
      <section className="rounded-2xl border bg-card p-5">
        <div className="space-y-2">
          <Badge variant="outline" className="gap-1.5">
            <ReceiptTextIcon className="size-3.5" />
            Purchase accounting
          </Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Purchases</h1>
            <p className="text-sm text-muted-foreground">
              Capture supplier bills and post input GST, payable, and payment entries.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border bg-card">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search bill or supplier"
                className="pl-8"
              />
            </div>
            <p className="text-sm text-muted-foreground">{bills.length} bills</p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead className="w-24 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billsQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : bills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No purchase bills found.
                    </TableCell>
                  </TableRow>
                ) : (
                  bills.map((bill) => (
                    <BillRow
                      key={bill.id}
                      bill={bill}
                      isPosting={postMutation.isPending}
                      onPost={() => postMutation.mutate(bill.id)}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <aside className="h-fit rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <FilePlus2Icon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Quick purchase bill</h2>
          </div>
          <div className="grid gap-3">
            <Input
              value={form.supplierName}
              onChange={(event) => setFormValue("supplierName", event.target.value, setForm)}
              placeholder="Supplier name"
            />
            <Input
              value={form.supplierInvoiceNumber}
              onChange={(event) =>
                setFormValue("supplierInvoiceNumber", event.target.value, setForm)
              }
              placeholder="Supplier invoice no."
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={form.invoiceDate}
                onChange={(event) => setFormValue("invoiceDate", event.target.value, setForm)}
              />
              <Input
                type="date"
                value={form.billDate}
                onChange={(event) => setFormValue("billDate", event.target.value, setForm)}
              />
            </div>
            <Input
              value={form.itemName}
              onChange={(event) => setFormValue("itemName", event.target.value, setForm)}
              placeholder="Item"
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                value={form.quantity}
                onChange={(event) => setFormValue("quantity", event.target.value, setForm)}
                placeholder="Qty"
              />
              <Input
                value={form.rate}
                onChange={(event) => setFormValue("rate", event.target.value, setForm)}
                placeholder="Rate"
              />
              <Input
                value={form.gstRate}
                onChange={(event) => setFormValue("gstRate", event.target.value, setForm)}
                placeholder="GST"
              />
            </div>
            <div className="grid grid-cols-[1fr_1fr] gap-2">
              <Select
                value={form.paymentMode}
                onValueChange={(value) =>
                  setFormValue("paymentMode", value as PaymentMode, setForm)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={form.amountPaid}
                onChange={(event) => setFormValue("amountPaid", event.target.value, setForm)}
                placeholder="Paid"
              />
            </div>
            <div className="rounded-xl bg-muted/40 p-3 text-sm">
              <SummaryRow label="Estimated total" value={formatCurrency(estimated)} strong />
            </div>
            <div className="grid gap-2">
              <Button
                variant="outline"
                disabled={createMutation.isPending}
                onClick={() => submit("draft")}
              >
                {createMutation.isPending ? <Spinner /> : "Save draft"}
              </Button>
              <Button disabled={createMutation.isPending} onClick={() => submit("posted")}>
                {createMutation.isPending ? <Spinner /> : "Post bill"}
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}

function BillRow({
  bill,
  isPosting,
  onPost,
}: {
  bill: PurchaseBill
  isPosting: boolean
  onPost: () => void
}) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{bill.billNumber}</TableCell>
      <TableCell className="font-medium">{bill.supplierName}</TableCell>
      <TableCell>{formatDate(bill.billDate)}</TableCell>
      <TableCell>
        <StatusBadge status={bill.status} />
      </TableCell>
      <TableCell className="text-right font-mono">{formatCurrency(bill.totalAmount)}</TableCell>
      <TableCell className="text-right font-mono">{formatCurrency(bill.amountDue)}</TableCell>
      <TableCell className="text-right">
        {bill.status === "draft" ? (
          <Button size="sm" variant="outline" disabled={isPosting} onClick={onPost}>
            {isPosting ? <Spinner /> : "Post"}
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  )
}

function StatusBadge({ status }: { status: PurchaseBill["status"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "posted" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
      )}
    >
      {status === "posted" ? "Posted" : status === "draft" ? "Draft" : status}
    </Badge>
  )
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-mono font-semibold" : "font-mono"}>{value}</span>
    </div>
  )
}

function setFormValue<K extends keyof FormState>(
  key: K,
  value: FormState[K],
  setForm: React.Dispatch<React.SetStateAction<FormState>>
) {
  setForm((current) => ({ ...current, [key]: value }))
}

function estimateTotal(form: FormState) {
  const taxable = Number(form.quantity || 0) * Number(form.rate || 0)
  return taxable + taxable * (Number(form.gstRate || 0) / 100)
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`))
}
