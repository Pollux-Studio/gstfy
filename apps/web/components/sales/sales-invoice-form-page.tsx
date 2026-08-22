"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeftIcon, PlusIcon, ReceiptTextIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  createSalesInvoice,
  type CreateSalesInvoicePayload,
  type PaymentMode,
  type SalesInvoiceLinePayload,
} from "@/lib/sales/api"

type FormState = {
  customerName: string
  invoiceDate: string
  dueDate: string
  placeOfSupplyStateCode: string
  supplyType: "b2b" | "b2c"
  notes: string
  lines: SalesInvoiceLinePayload[]
  paymentMode: PaymentMode
  amountPaid: string
}

const today = new Date().toISOString().slice(0, 10)
const initialLine: SalesInvoiceLinePayload = {
  itemName: "Retail sale item",
  hsnSacCode: "210690",
  quantity: "1",
  unit: "PCS",
  rate: "1000",
  gstRate: "18",
}

export function SalesInvoiceFormPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const [form, setForm] = React.useState<FormState>({
    customerName: "",
    invoiceDate: today,
    dueDate: "",
    placeOfSupplyStateCode: "33",
    supplyType: "b2c",
    notes: "",
    lines: [initialLine],
    paymentMode: "upi",
    amountPaid: "",
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateSalesInvoicePayload) =>
      createSalesInvoice(accessToken, payload),
    onSuccess: async ({ invoice }) => {
      toast.success(
        invoice.status === "posted" ? "Invoice posted to accounting." : "Draft invoice saved."
      )
      await queryClient.invalidateQueries({ queryKey: ["sales", "invoices"] })
      await queryClient.invalidateQueries({ queryKey: ["accounting"] })
      router.push(`/invoices/${invoice.id}`)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to save invoice."),
  })

  const estimated = estimateTotals(form.lines, form.placeOfSupplyStateCode === "33")

  function submit(status: "draft" | "posted") {
    createMutation.mutate({
      status,
      customerName: form.customerName || null,
      invoiceDate: form.invoiceDate,
      dueDate: form.dueDate || null,
      placeOfSupplyStateCode: form.placeOfSupplyStateCode,
      supplyType: form.supplyType,
      invoiceType: "tax_invoice",
      notes: form.notes || null,
      lines: form.lines,
      payments:
        form.amountPaid && Number(form.amountPaid) > 0 ?
          [
            {
              paymentMode: form.paymentMode,
              amount: form.amountPaid,
            },
          ]
        : [],
    })
  }

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="gap-1.5">
            <ReceiptTextIcon className="size-3.5" />
            New sales invoice
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">Create invoice</h1>
        </div>
        <Link className={buttonVariants({ variant: "outline" })} href="/sales">
          <ArrowLeftIcon />
          Back
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-5 rounded-2xl border bg-card p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <LabeledInput
              label="Customer name"
              value={form.customerName}
              placeholder="Walk-in customer or business name"
              onChange={(value) => setForm((current) => ({ ...current, customerName: value }))}
            />
            <div className="grid gap-2">
              <label className="text-sm font-medium">Supply type</label>
              <Select
                value={form.supplyType}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, supplyType: value as "b2b" | "b2c" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="b2c">B2C</SelectItem>
                  <SelectItem value="b2b">B2B</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <LabeledInput
              label="Invoice date"
              type="date"
              value={form.invoiceDate}
              onChange={(value) => setForm((current) => ({ ...current, invoiceDate: value }))}
            />
            <LabeledInput
              label="Due date"
              type="date"
              value={form.dueDate}
              onChange={(value) => setForm((current) => ({ ...current, dueDate: value }))}
            />
            <LabeledInput
              label="Place of supply state code"
              value={form.placeOfSupplyStateCode}
              maxLength={2}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  placeOfSupplyStateCode: value.replace(/\D/g, "").slice(0, 2),
                }))
              }
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Line items</h2>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    lines: [...current.lines, { ...initialLine, itemName: "" }],
                  }))
                }
              >
                <PlusIcon />
                Add line
              </Button>
            </div>
            <div className="space-y-3">
              {form.lines.map((line, index) => (
                <div key={index} className="rounded-xl border bg-background p-3">
                  <div className="grid gap-3 md:grid-cols-[1.4fr_0.7fr_0.6fr_0.7fr_0.6fr_auto]">
                    <LabeledInput
                      label="Item"
                      value={line.itemName}
                      onChange={(value) => updateLine(index, "itemName", value, setForm)}
                    />
                    <LabeledInput
                      label="HSN/SAC"
                      value={line.hsnSacCode ?? ""}
                      onChange={(value) => updateLine(index, "hsnSacCode", value, setForm)}
                    />
                    <LabeledInput
                      label="Qty"
                      value={line.quantity}
                      onChange={(value) => updateLine(index, "quantity", value, setForm)}
                    />
                    <LabeledInput
                      label="Rate"
                      value={line.rate}
                      onChange={(value) => updateLine(index, "rate", value, setForm)}
                    />
                    <LabeledInput
                      label="GST %"
                      value={line.gstRate}
                      onChange={(value) => updateLine(index, "gstRate", value, setForm)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-6"
                      disabled={form.lines.length === 1}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          lines: current.lines.filter((_, lineIndex) => lineIndex !== index),
                        }))
                      }
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_180px_180px]">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Optional invoice note"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Payment mode</label>
              <Select
                value={form.paymentMode}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, paymentMode: value as PaymentMode }))
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
            </div>
            <LabeledInput
              label="Amount paid"
              value={form.amountPaid}
              placeholder="0.00"
              onChange={(value) => setForm((current) => ({ ...current, amountPaid: value }))}
            />
          </div>
        </section>

        <aside className="h-fit rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Invoice summary</h2>
          <div className="mt-4 space-y-3 text-sm">
            <SummaryRow label="Taxable value" value={formatCurrency(estimated.taxable)} />
            <SummaryRow label="CGST" value={formatCurrency(estimated.cgst)} />
            <SummaryRow label="SGST" value={formatCurrency(estimated.sgst)} />
            <SummaryRow label="IGST" value={formatCurrency(estimated.igst)} />
            <div className="border-t pt-3">
              <SummaryRow label="Total" value={formatCurrency(estimated.total)} strong />
            </div>
          </div>
          <div className="mt-5 grid gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={createMutation.isPending}
              onClick={() => submit("draft")}
            >
              {createMutation.isPending ? <Spinner /> : "Save draft"}
            </Button>
            <Button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => submit("posted")}
            >
              {createMutation.isPending ? <Spinner /> : "Post invoice"}
            </Button>
          </div>
        </aside>
      </div>
    </main>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  maxLength,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  maxLength?: number
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium">{label}</label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function updateLine<K extends keyof SalesInvoiceLinePayload>(
  index: number,
  key: K,
  value: SalesInvoiceLinePayload[K],
  setForm: React.Dispatch<React.SetStateAction<FormState>>
) {
  setForm((current) => ({
    ...current,
    lines: current.lines.map((line, lineIndex) =>
      lineIndex === index ? { ...line, [key]: value } : line
    ),
  }))
}

function estimateTotals(lines: SalesInvoiceLinePayload[], isIntraState: boolean) {
  return lines.reduce(
    (total, line) => {
      const taxable = Number(line.quantity || 0) * Number(line.rate || 0)
      const tax = taxable * (Number(line.gstRate || 0) / 100)
      const cgst = isIntraState ? tax / 2 : 0
      const sgst = isIntraState ? tax / 2 : 0
      const igst = isIntraState ? 0 : tax

      return {
        taxable: total.taxable + taxable,
        cgst: total.cgst + cgst,
        sgst: total.sgst + sgst,
        igst: total.igst + igst,
        total: total.total + taxable + tax,
      }
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
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

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value))
}
