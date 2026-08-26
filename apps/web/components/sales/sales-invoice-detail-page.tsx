"use client"

import * as React from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeftIcon, CheckCircle2Icon, ReceiptTextIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
  getSalesInvoice,
  postSalesInvoice,
  type SalesInvoiceDetail,
} from "@/lib/sales/api"
import { cn } from "@/lib/utils"

export function SalesInvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const queryClient = useQueryClient()
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const invoiceQuery = useQuery({
    queryKey: ["sales", "invoice", invoiceId],
    queryFn: () => getSalesInvoice(accessToken, invoiceId),
    enabled: accessToken.length > 0,
  })
  const postMutation = useMutation({
    mutationFn: () => postSalesInvoice(accessToken, invoiceId),
    onSuccess: async () => {
      toast.success("Invoice posted to accounting.")
      await queryClient.invalidateQueries({ queryKey: ["sales"] })
      await queryClient.invalidateQueries({ queryKey: ["accounting"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to post invoice."),
  })

  const invoice = invoiceQuery.data?.invoice

  if (invoiceQuery.isLoading) {
    return (
      <main className="space-y-4 p-4 sm:p-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </main>
    )
  }

  if (!invoice) {
    return (
      <main className="p-4 sm:p-6">
        <div className="rounded-2xl border p-8 text-center text-muted-foreground">
          Invoice not found.
        </div>
      </main>
    )
  }

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6">
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/sales">
              <ArrowLeftIcon />
              Back to sales
            </Link>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5">
                  <ReceiptTextIcon className="size-3.5" />
                  {invoice.invoiceNumber}
                </Badge>
                <StatusBadge status={invoice.status} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {invoice.customerName}
              </h1>
              <p className="text-sm text-muted-foreground">
                Invoice date {formatDate(invoice.invoiceDate)}
              </p>
            </div>
          </div>
          {invoice.status === "draft" || invoice.status === "quotation" ? (
            <Button onClick={() => postMutation.mutate()} disabled={postMutation.isPending}>
              {postMutation.isPending ? <Spinner /> : <CheckCircle2Icon />}
              Post to accounting
            </Button>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border bg-card">
          <div className="border-b p-4">
            <h2 className="text-sm font-semibold">Line items</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>HSN/SAC</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-medium">{line.itemNameSnapshot}</TableCell>
                    <TableCell>{line.hsnSacCode ?? "-"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(line.quantity).toLocaleString("en-IN")} {line.unit}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(line.rate)}
                    </TableCell>
                    <TableCell className="text-right font-mono">{line.gstRate}%</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(line.lineTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <InvoiceSummary invoice={invoice} />
      </div>
    </main>
  )
}

function InvoiceSummary({ invoice }: { invoice: SalesInvoiceDetail }) {
  return (
    <aside className="h-fit rounded-2xl border bg-card p-5">
      <h2 className="text-sm font-semibold">Accounting summary</h2>
      <div className="mt-4 space-y-3 text-sm">
        <SummaryRow label="Taxable value" value={formatCurrency(invoice.taxableValue)} />
        <SummaryRow label="CGST" value={formatCurrency(invoice.cgstAmount)} />
        <SummaryRow label="SGST" value={formatCurrency(invoice.sgstAmount)} />
        <SummaryRow label="IGST" value={formatCurrency(invoice.igstAmount)} />
        <div className="border-t pt-3">
          <SummaryRow label="Total" value={formatCurrency(invoice.totalAmount)} strong />
        </div>
        <SummaryRow label="Paid" value={formatCurrency(invoice.amountPaid)} />
        <SummaryRow label="Due" value={formatCurrency(invoice.amountDue)} />
      </div>
      {invoice.payments.length > 0 ? (
        <div className="mt-5 rounded-xl bg-muted/40 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Payments
          </p>
          <div className="mt-2 space-y-2">
            {invoice.payments.map((payment) => (
              <div key={payment.id} className="flex justify-between text-sm">
                <span className="capitalize">{payment.paymentMode}</span>
                <span className="font-mono">{formatCurrency(payment.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  )
}

function StatusBadge({ status }: { status: SalesInvoiceDetail["status"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "posted" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
        status === "quotation" &&
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
        status === "draft" &&
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
      )}
    >
      {status === "posted" ? "Posted"
      : status === "quotation" ? "Quotation"
      : status === "draft" ? "Draft"
      : "Cancelled"}
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
