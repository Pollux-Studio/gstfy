"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BookOpenTextIcon,
  CalendarClockIcon,
  ReceiptTextIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectDisplayValue,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
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
  getPartyLedger,
  type PartyLedgerEntry,
  type PartyLedgerTotals,
} from "@/lib/parties/api"
import { cn } from "@/lib/utils"

type LedgerEntryType = "all" | "receivable" | "payable"
type LedgerStatus = "all" | "open" | "partially_settled" | "settled" | "closed" | "cancelled"

const entryTypeOptions: Array<{ value: LedgerEntryType; label: string }> = [
  { value: "all", label: "All entries" },
  { value: "receivable", label: "Receivables" },
  { value: "payable", label: "Payables" },
]

const statusOptions: Array<{ value: LedgerStatus; label: string }> = [
  { value: "all", label: "All status" },
  { value: "open", label: "Open" },
  { value: "partially_settled", label: "Partially settled" },
  { value: "settled", label: "Settled" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
]

export function PartyLedgerPage({ partyId }: { partyId: string }) {
  const storedSession = getStoredAuthSession()
  const accessToken = storedSession?.session.accessToken ?? ""
  const [entryType, setEntryType] = React.useState<LedgerEntryType>("all")
  const [status, setStatus] = React.useState<LedgerStatus>("all")

  const ledgerQuery = useQuery({
    queryKey: ["parties", partyId, "ledger", entryType, status],
    queryFn: () =>
      getPartyLedger(partyId, accessToken, {
        entryType,
        status,
        limit: 150,
      }),
    enabled: accessToken.length > 0 && partyId.length > 0,
    staleTime: 1000 * 60,
  })

  const data = ledgerQuery.data
  const entries = data?.entries ?? []

  return (
    <main className="min-w-0 space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <Button
            nativeButton={false}
            render={<Link href="/parties" />}
            size="sm"
            variant="ghost"
            className="-ml-2 w-fit"
          >
            <ArrowLeftIcon className="size-4" />
            Back to parties
          </Button>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <BookOpenTextIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                Party ledger
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {data?.party.displayName ??
                  "Receivable and payable movement for this party."}
              </p>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Select
            value={entryType}
            onValueChange={(value) => setEntryType((value as LedgerEntryType | null) ?? "all")}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectDisplayValue
                value={entryType}
                options={entryTypeOptions}
                placeholder="Entry type"
              />
            </SelectTrigger>
            <SelectContent align="end" sideOffset={8}>
              {entryTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => setStatus((value as LedgerStatus | null) ?? "all")}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectDisplayValue
                value={status}
                options={statusOptions}
                placeholder="Status"
              />
            </SelectTrigger>
            <SelectContent align="end" sideOffset={8}>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {ledgerQuery.isLoading ? (
        <LedgerSkeleton />
      ) : ledgerQuery.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Unable to load party ledger.
        </div>
      ) : (
        <>
          <LedgerTotals totals={data?.totals} />
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-medium">Ledger entries</h2>
                <p className="text-xs text-muted-foreground">
                  Derived from receivable and payable entries. Balances are not stored on the party.
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {entries.length} rows
              </Badge>
            </div>
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                <ReceiptTextIcon className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">No ledger movement yet</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Sales, purchases, receipts, and payments will appear here after posting.
                </p>
              </div>
            ) : (
              <div className="app-scrollbar max-h-[34rem] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Voucher</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Original</TableHead>
                      <TableHead className="text-right">Settled</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <LedgerEntryRow key={entry.id} entry={entry} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}

function LedgerTotals({ totals }: { totals?: PartyLedgerTotals }) {
  const cards = [
    {
      label: "Receivable",
      value: totals?.receivableOutstanding ?? "0",
      helper: `${formatCurrency(totals?.receivableSettled ?? "0")} settled`,
      tone: "success",
    },
    {
      label: "Payable",
      value: totals?.payableOutstanding ?? "0",
      helper: `${formatCurrency(totals?.payableSettled ?? "0")} settled`,
      tone: "warning",
    },
    {
      label: "Net outstanding",
      value: totals?.netOutstanding ?? "0",
      helper: "Receivable minus payable",
      tone: "default",
    },
  ] as const

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {card.label}
            </p>
            <span
              className={cn(
                "size-2 rounded-full bg-muted-foreground/50",
                card.tone === "success" && "bg-emerald-500",
                card.tone === "warning" && "bg-amber-500"
              )}
            />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">
            {formatCurrency(card.value)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{card.helper}</p>
        </div>
      ))}
    </div>
  )
}

function LedgerEntryRow({ entry }: { entry: PartyLedgerEntry }) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-xs">
        {formatDate(entry.voucherDate ?? entry.createdAt)}
      </TableCell>
      <TableCell>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">
            {entry.voucherNumber ?? "Unnumbered voucher"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {entry.voucherType ?? "Voucher"}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={cn(
            "capitalize",
            entry.entryType === "receivable" &&
              "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            entry.entryType === "payable" &&
              "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          )}
        >
          {entry.entryType}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono text-xs">
        {formatCurrency(entry.originalAmount)}
      </TableCell>
      <TableCell className="text-right font-mono text-xs">
        {formatCurrency(entry.settledAmount)}
      </TableCell>
      <TableCell className="text-right font-mono text-xs font-medium">
        {formatCurrency(entry.outstandingAmount)}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize">
          {entry.status.replaceAll("_", " ")}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarClockIcon className="size-3" />
          {entry.dueDate ? formatDate(entry.dueDate) : "No due date"}
        </span>
      </TableCell>
    </TableRow>
  )
}

function LedgerSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  )
}

function formatCurrency(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value)

  if (!Number.isFinite(amount)) {
    return "₹0.00"
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(value: string | Date) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Not dated"
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}
