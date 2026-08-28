"use client"

import * as React from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import Link from "next/link"
import {
  ArrowLeftIcon,
  BookOpenTextIcon,
  FileTextIcon,
  LandmarkIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  getAccountLedger,
  type LedgerAccountType,
  type LedgerLine,
} from "@/lib/accounting/api"
import { getStoredAuthSession } from "@/lib/auth/session"
import { cn } from "@/lib/utils"

const ledgerPageSize = 15

const accountTypeLabels: Record<LedgerAccountType, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENSE: "Expenses",
}

export function AccountingAccountDetailPage({ accountId }: { accountId: string }) {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""

  const ledgerQuery = useInfiniteQuery({
    queryKey: ["accounting", "ledger", accountId],
    queryFn: ({ pageParam }) =>
      getAccountLedger(accessToken, accountId, {
        page: pageParam,
        limit: ledgerPageSize,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: accessToken.length > 0 && accountId.length > 0,
  })

  const account = ledgerQuery.data?.pages[0]?.account ?? null
  const lines = ledgerQuery.data?.pages.flatMap((page) => page.lines) ?? []
  const totalLinesCount = ledgerQuery.data?.pages[0]?.pagination.total ?? lines.length

  function handleLedgerScroll(event: React.UIEvent<HTMLDivElement>) {
    if (!ledgerQuery.hasNextPage || ledgerQuery.isFetchingNextPage) {
      return
    }

    const target = event.currentTarget
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight

    if (remaining < 160) {
      void ledgerQuery.fetchNextPage()
    }
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
        <div className="flex flex-col gap-4 p-3.5 sm:p-4 lg:p-5">
          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="w-fit"
            render={<Link href="/accounting" />}
          >
            <ArrowLeftIcon className="size-4" />
            Back to accounting
          </Button>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5 bg-background">
                  <BookOpenTextIcon className="size-3.5" />
                  Ledger records
                </Badge>
                {account ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1.5 bg-background",
                      account.status === "active" &&
                      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {humanize(account.status)}
                  </Badge>
                ) : null}
              </div>
              <div className="space-y-1.5">
                {ledgerQuery.isLoading ? (
                  <>
                    <Skeleton className="h-7 w-64 rounded-lg" />
                    <Skeleton className="h-4 w-80 rounded-lg" />
                  </>
                ) : account ? (
                  <>
                    <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                      {account.accountCode} · {account.accountName}
                    </h1>
                    <p className="max-w-xl text-sm leading-5 text-muted-foreground">
                      Review posted journal lines for this ledger account. These rows
                      come from vouchers and cannot be edited here.
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                      Ledger account not found
                    </h1>
                    <p className="max-w-xl text-sm leading-5 text-muted-foreground">
                      The account may be inactive, deleted, or unavailable to this workspace.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              <DetailMetric
                icon={<LandmarkIcon className="size-4" />}
                label="Type"
                value={account ? accountTypeLabels[account.accountType] : "-"}
              />
              <DetailMetric
                icon={<FileTextIcon className="size-4" />}
                label="Records"
                value={totalLinesCount.toString()}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
        <div className="border-b border-border px-4 py-3 sm:px-5 lg:px-6">
          <h2 className="text-base font-semibold">Posted ledger lines</h2>
          <p className="text-sm text-muted-foreground">
            Debit, credit, and running balance by voucher date.
          </p>
        </div>
        <LedgerLinesTable
          lines={lines}
          isLoading={ledgerQuery.isLoading}
          isFetchingNextPage={ledgerQuery.isFetchingNextPage}
          hasNextPage={ledgerQuery.hasNextPage}
          totalLinesCount={totalLinesCount}
          onScroll={handleLedgerScroll}
        />
      </section>
    </main>
  )
}

function LedgerLinesTable({
  lines,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  totalLinesCount,
  onScroll,
}: {
  lines: LedgerLine[]
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  totalLinesCount: number
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void
}) {
  if (isLoading) {
    return <TableSkeleton columns={6} />
  }

  if (lines.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
          <FileTextIcon className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="font-medium">No posted records yet</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            Journal lines will appear here after a posted voucher touches this account.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className="app-scrollbar max-h-[35rem] overflow-y-auto overflow-x-hidden"
        onScroll={onScroll}
      >
        <Table className="w-full table-fixed text-[11px] sm:text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-2">
          <colgroup>
            <col className="w-[13%]" />
            <col className="w-[20%]" />
            <col className="w-[27%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[14%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
            <TableRow className="hover:bg-transparent">
              <TableHead>Date</TableHead>
              <TableHead>Voucher</TableHead>
              <TableHead>Narration</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="pr-3 text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>{formatDate(line.date)}</TableCell>
                <TableCell>
                  <div className="min-w-0 space-y-0.5">
                    <div className="truncate font-mono text-xs">{line.voucherNumber}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {line.voucherType}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="truncate text-muted-foreground">
                  {line.narration ?? "Posted voucher line"}
                </TableCell>
                <AmountCell value={line.debit} />
                <AmountCell value={line.credit} />
                <AmountCell value={line.runningBalance} className="pr-3" />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <InfiniteTableFooter
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        loadedCount={lines.length}
        totalCount={totalLinesCount}
        noun="ledger lines"
      />
    </>
  )
}

function DetailMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground">
          {icon}
        </span>
      </div>
      <p className="mt-1 truncate text-sm font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function InfiniteTableFooter({
  isFetchingNextPage,
  hasNextPage,
  loadedCount,
  totalCount,
  noun,
}: {
  isFetchingNextPage: boolean
  hasNextPage: boolean
  loadedCount: number
  totalCount: number
  noun: string
}) {
  return (
    <div className="flex items-center justify-center border-t px-4 py-3 text-xs text-muted-foreground">
      {isFetchingNextPage ? (
        <span className="inline-flex items-center gap-2">
          <Spinner className="size-3.5" />
          Loading more {noun}
        </span>
      ) : hasNextPage ? (
        <span>Scroll to load more {noun}</span>
      ) : (
        <span>
          Showing {loadedCount} of {totalCount} {noun}
        </span>
      )}
    </div>
  )
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton key={columnIndex} className="h-8 rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  )
}

function AmountCell({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  return (
    <TableCell className={cn("text-right font-mono tabular-nums", className)}>
      {formatCurrency(value)}
    </TableCell>
  )
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatCurrency(value: string | number) {
  const amount = typeof value === "number" ? value : toNumber(value)

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount)
}

function toNumber(value: string | undefined) {
  const parsed = Number(value ?? "0")
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-")

  if (!year || !month || !day) {
    return value
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1, Number(day)))
}
