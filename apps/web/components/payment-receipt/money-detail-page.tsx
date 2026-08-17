"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BadgeIndianRupeeIcon,
  CalendarIcon,
  LandmarkIcon,
  ReceiptTextIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  getPayment,
  getReceipt,
  type MoneyDocument,
  type MoneyDocumentAllocation,
} from "@/lib/payment-receipt/api"

type MoneyDetailMode = "receipt" | "payment"

export function MoneyDetailPage({
  mode,
  documentId,
}: {
  mode: MoneyDetailMode
  documentId: string
}) {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const detailQuery = useQuery({
    queryKey: ["money", mode, documentId],
    queryFn: async () => {
      if (mode === "receipt") {
        const response = await getReceipt(accessToken, documentId)
        return response.receipt
      }

      const response = await getPayment(accessToken, documentId)
      return response.payment
    },
    enabled: accessToken.length > 0 && documentId.length > 0,
  })

  const document = detailQuery.data
  const documentNumber = document ? getDocumentNumber(mode, document) : ""
  const documentDate = document ? getDocumentDate(mode, document) : ""
  const allocations = document?.allocations ?? []

  return (
    <main className="min-w-0 space-y-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm hover:bg-muted"
          href={mode === "receipt" ? "/receipts" : "/payments"}
        >
          <ArrowLeftIcon className="size-4" />
          Back to {mode === "receipt" ? "receipts" : "payments"}
        </Link>
      </div>

      {detailQuery.isLoading ? (
        <DetailSkeleton />
      ) : !document ? (
        <section className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
          {mode === "receipt" ? "Receipt" : "Payment"} not found.
        </section>
      ) : (
        <>
          <section className="rounded-2xl border bg-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <Badge variant="outline" className="gap-1.5">
                  <ReceiptTextIcon className="size-3.5" />
                  {mode === "receipt" ? "Receipt detail" : "Payment detail"}
                </Badge>
                <div>
                  <h1 className="font-mono text-2xl font-semibold tracking-tight">
                    {documentNumber}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {document.partyNameSnapshot}
                  </p>
                </div>
              </div>
              <MoneyStatusBadge status={document.status} />
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            <MetricCard
              label="Amount"
              value={formatCurrency(document.amount)}
              icon={<BadgeIndianRupeeIcon className="size-4" />}
            />
            <MetricCard
              label="Allocated"
              value={formatCurrency(document.allocatedAmount)}
              icon={<ReceiptTextIcon className="size-4" />}
            />
            <MetricCard
              label="Unallocated"
              value={formatCurrency(document.unallocatedAmount)}
              icon={<LandmarkIcon className="size-4" />}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="rounded-2xl border bg-card">
              <div className="border-b p-4">
                <h2 className="font-medium">Allocations</h2>
                <p className="text-sm text-muted-foreground">
                  Active and reversed settlement links for this posted voucher.
                </p>
              </div>
              {allocations.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No allocations recorded for this {mode}.
                </div>
              ) : (
                <AllocationTable allocations={allocations} />
              )}
            </div>

            <div className="space-y-4">
              <DetailCard
                title="Document"
                rows={[
                  ["Date", formatDate(documentDate)],
                  ["Method", labelize(document.paymentMethod)],
                  ["Reference", document.referenceNumber || "Not added"],
                  ["Treatment", labelize(document.unallocatedTreatment)],
                ]}
              />
              <DetailCard
                title="Cash / bank"
                rows={[
                  [
                    "Account",
                    document.cashBankAccountSnapshot ?
                      `${document.cashBankAccountSnapshot.accountCode} · ${document.cashBankAccountSnapshot.accountName}`
                    : "Not available",
                  ],
                  ["Voucher", document.voucherId ?? "Draft not posted"],
                ]}
              />
              <DetailCard
                title="Audit"
                rows={[
                  ["Created", formatDateTime(document.createdAt)],
                  ["Posted", document.postedAt ? formatDateTime(document.postedAt) : "Not posted"],
                  [
                    "Reversed",
                    document.reversedAt ? formatDateTime(document.reversedAt) : "Not reversed",
                  ],
                  ["Reason", document.reversalReason || "None"],
                ]}
              />
            </div>
          </section>
        </>
      )}
    </main>
  )
}

function AllocationTable({ allocations }: { allocations: MoneyDocumentAllocation[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Target</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Allocated</TableHead>
          <TableHead className="text-right">Outstanding</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {allocations.map((allocation) => (
          <TableRow key={allocation.id}>
            <TableCell>
              <p className="font-mono text-xs">{allocation.target.voucherNumber}</p>
              <p className="text-xs text-muted-foreground">
                {labelize(allocation.target.voucherType)}
              </p>
            </TableCell>
            <TableCell>{formatDate(allocation.target.voucherDate)}</TableCell>
            <TableCell>
              <Badge variant={allocation.status === "active" ? "default" : "destructive"}>
                {labelize(allocation.status)}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-mono">
              {formatCurrency(allocation.allocatedAmount)}
            </TableCell>
            <TableCell className="text-right font-mono">
              {formatCurrency(allocation.target.outstandingAmount)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function DetailCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="font-medium">{title}</h2>
      <div className="mt-3 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="min-w-0 break-words">{value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="rounded-full bg-muted p-2 text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold">{value}</p>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 rounded-2xl" />
      <div className="grid gap-3 md:grid-cols-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  )
}

function MoneyStatusBadge({ status }: { status: MoneyDocument["status"] }) {
  return (
    <Badge
      variant={status === "posted" ? "default" : status === "reversed" ? "destructive" : "outline"}
      className="w-fit capitalize"
    >
      {status}
    </Badge>
  )
}

function getDocumentNumber(mode: MoneyDetailMode, document: MoneyDocument) {
  return mode === "receipt" ? document.receiptNumber ?? "DRAFT" : document.paymentNumber ?? "DRAFT"
}

function getDocumentDate(mode: MoneyDetailMode, document: MoneyDocument) {
  return mode === "receipt" ? document.receiptDate ?? "" : document.paymentDate ?? ""
}

function formatCurrency(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value || 0)

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function formatDate(value: string) {
  if (!value) {
    return "Not available"
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}
