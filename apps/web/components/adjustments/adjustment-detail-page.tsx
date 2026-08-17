"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BadgeIndianRupeeIcon,
  FileTextIcon,
  HistoryIcon,
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
import { getAdjustment, type AdjustmentDetail, type AdjustmentMode } from "@/lib/adjustments/api"
import { getStoredAuthSession } from "@/lib/auth/session"

export function AdjustmentDetailPage({
  mode,
  adjustmentId,
}: {
  mode: AdjustmentMode
  adjustmentId: string
}) {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const detailQuery = useQuery({
    queryKey: ["adjustments", mode, adjustmentId],
    queryFn: () => getAdjustment(accessToken, mode, adjustmentId),
    enabled: accessToken.length > 0 && adjustmentId.length > 0,
  })
  const adjustment = detailQuery.data

  return (
    <main className="min-w-0 space-y-5 p-4 sm:p-6">
      <Link
        href={`/${modePath(mode)}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm hover:bg-muted"
      >
        <ArrowLeftIcon className="size-4" />
        Back to {labelForMode(mode)}
      </Link>

      {detailQuery.isLoading ? (
        <DetailSkeleton />
      ) : !adjustment ? (
        <section className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
          Adjustment document not found.
        </section>
      ) : (
        <>
          <section className="rounded-2xl border bg-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <Badge variant="outline" className="gap-1.5">
                  <ReceiptTextIcon className="size-3.5" />
                  {labelize(adjustment.adjustmentType)}
                </Badge>
                <div>
                  <h1 className="font-mono text-2xl font-semibold tracking-tight">
                    {adjustment.adjustmentNumber}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {getSourceSummary(adjustment)}
                  </p>
                </div>
              </div>
              <StatusBadge status={adjustment.status} />
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Taxable" value={formatCurrency(adjustment.taxableTotal)} />
            <MetricCard label="CGST" value={formatCurrency(adjustment.cgstTotal)} />
            <MetricCard label="SGST / IGST" value={formatCurrency(Number(adjustment.sgstTotal) + Number(adjustment.igstTotal))} />
            <MetricCard label="Total" value={formatCurrency(adjustment.grandTotal)} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-4">
              <section className="rounded-2xl border bg-card">
                <SectionHeader
                  icon={<FileTextIcon className="size-4" />}
                  title="Adjusted lines"
                  description="Historical item, GST, and inventory snapshots used for this document."
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Taxable</TableHead>
                      <TableHead className="text-right">GST</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Inventory</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustment.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <p className="font-medium">{line.descriptionSnapshot}</p>
                          <p className="text-xs text-muted-foreground">
                            {line.hsnSacSnapshot || "No HSN"} · GST {line.gstRateSnapshot}%
                          </p>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {line.quantity} {line.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(line.taxableValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(
                            Number(line.cgstAmount) +
                              Number(line.sgstAmount) +
                              Number(line.igstAmount) +
                              Number(line.cessAmount)
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(line.lineTotal)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{labelize(line.inventoryEffect)}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>

              <section className="rounded-2xl border bg-card">
                <SectionHeader
                  icon={<BadgeIndianRupeeIcon className="size-4" />}
                  title="Accounting"
                  description="Journal entries created by the posting boundary."
                />
                {adjustment.journalEntries.length === 0 ? (
                  <EmptyLine text="No accounting entries yet. Drafts do not post journals." />
                ) : (
                  <div className="divide-y">
                    {adjustment.journalEntries.map((entry) => (
                      <div key={entry.id} className="p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{entry.description || "Journal entry"}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(entry.entryDate)}</p>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Account</TableHead>
                              <TableHead className="text-right">Debit</TableHead>
                              <TableHead className="text-right">Credit</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entry.lines.map((line) => (
                              <TableRow key={line.id}>
                                <TableCell>
                                  <p className="font-mono text-xs">{line.accountCode}</p>
                                  <p className="text-sm">{line.accountName}</p>
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(line.debit)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(line.credit)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-4">
              <DetailCard
                title="Document"
                rows={[
                  ["Date", formatDate(adjustment.adjustmentDate)],
                  ["Context", labelize(adjustment.adjustmentContext)],
                  ["Issuer", labelize(adjustment.issuerType)],
                  ["Direction", labelize(adjustment.documentDirection)],
                  ["Reason", adjustment.reason || "Not added"],
                ]}
              />
              <DetailCard
                title="Source"
                rows={[
                  ["Source type", labelize(adjustment.sourceDocumentType)],
                  ["Source voucher", adjustment.sourceVoucher?.voucherNumber ?? "Not available"],
                  ["Posted voucher", adjustment.voucher?.voucherNumber ?? "Draft not posted"],
                ]}
              />
              <section className="rounded-2xl border bg-card">
                <SectionHeader
                  icon={<HistoryIcon className="size-4" />}
                  title="Audit"
                  description="Lifecycle events for this adjustment."
                />
                {adjustment.audit.length === 0 ? (
                  <EmptyLine text="No audit events recorded." />
                ) : (
                  <div className="divide-y">
                    {adjustment.audit.map((event) => (
                      <div key={event.id} className="p-4 text-sm">
                        <p className="font-medium">{labelize(event.action)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(event.createdAt)}
                        </p>
                        {event.reason ? (
                          <p className="mt-1 text-muted-foreground">{event.reason}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </section>
        </>
      )}
    </main>
  )
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 border-b p-4">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-xl font-semibold">{value}</p>
    </section>
  )
}

function DetailCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="font-medium">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </span>
            <span className="break-words">{value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: AdjustmentDetail["status"] }) {
  const className =
    status === "posted" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : status === "reversed" ? "bg-red-500/10 text-red-700 dark:text-red-300"
    : "bg-amber-500/10 text-amber-700 dark:text-amber-300"

  return (
    <Badge variant="outline" className={className}>
      {labelize(status)}
    </Badge>
  )
}

function EmptyLine({ text }: { text: string }) {
  return <div className="p-6 text-center text-sm text-muted-foreground">{text}</div>
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 rounded-2xl" />
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  )
}

function getSourceSummary(adjustment: AdjustmentDetail) {
  const snapshot = adjustment.sourceSnapshot

  if (snapshot && typeof snapshot === "object") {
    const record = snapshot as Record<string, unknown>
    const documentNumber = String(record.documentNumber ?? "")
    const partyName = String(record.partyName ?? "")
    return [partyName, documentNumber].filter(Boolean).join(" · ")
  }

  return "Source document snapshot unavailable"
}

function modePath(mode: AdjustmentMode) {
  const paths: Record<AdjustmentMode, string> = {
    "sales-return": "sales-returns",
    "purchase-return": "purchase-returns",
    "credit-note": "credit-notes",
    "debit-note": "debit-notes",
  }

  return paths[mode]
}

function labelForMode(mode: AdjustmentMode) {
  const labels: Record<AdjustmentMode, string> = {
    "sales-return": "sales returns",
    "purchase-return": "purchase returns",
    "credit-note": "credit notes",
    "debit-note": "debit notes",
  }

  return labels[mode]
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDate(value: string) {
  if (!value) {
    return "Not set"
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function formatDateTime(value: string) {
  if (!value) {
    return "Not set"
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function labelize(value: string) {
  return value
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ")
}
