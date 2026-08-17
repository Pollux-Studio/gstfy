"use client"

import * as React from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  BadgeIndianRupeeIcon,
  BarChart3Icon,
  CalendarIcon,
  DownloadIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  exportAgingReport,
  exportCashFlowReport,
  getAgingReport,
  getCashFlowReport,
  type AgingReportResponse,
  type CashFlowReportResponse,
  type CsvExportResponse,
} from "@/lib/payment-receipt/api"
import { toast } from "@/components/ui/toast"

const bucketLabels: Record<AgingReportResponse["buckets"][number]["bucket"], string> = {
  current: "Current",
  "1_30": "1-30 days",
  "31_60": "31-60 days",
  "61_90": "61-90 days",
  "90_plus": "90+ days",
}

export function PaymentReportsPage() {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState("")
  const query = { from: from || undefined, to: to || undefined }

  const receivableAgingQuery = useQuery({
    queryKey: ["money", "reports", "aging", "receivable", query],
    queryFn: () => getAgingReport(accessToken, "receivable", query),
    enabled: accessToken.length > 0,
  })
  const payableAgingQuery = useQuery({
    queryKey: ["money", "reports", "aging", "payable", query],
    queryFn: () => getAgingReport(accessToken, "payable", query),
    enabled: accessToken.length > 0,
  })
  const cashFlowQuery = useQuery({
    queryKey: ["money", "reports", "cash-flow", query],
    queryFn: () => getCashFlowReport(accessToken, query),
    enabled: accessToken.length > 0,
  })
  const cashFlowExportMutation = useMutation({
    mutationFn: () => exportCashFlowReport(accessToken, query),
    onSuccess: downloadCsv,
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <main className="min-w-0 space-y-5 p-4 sm:p-6">
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="gap-1.5">
              <BarChart3Icon className="size-3.5" />
              Money intelligence
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Payment reports
              </h1>
              <p className="text-sm text-muted-foreground">
                Aging, cash movement, and unapplied money from posted documents.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <DateField label="From" value={from} onChange={setFrom} />
            <DateField label="To" value={to} onChange={setTo} />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={cashFlowExportMutation.isPending}
            onClick={() => cashFlowExportMutation.mutate()}
          >
            {cashFlowExportMutation.isPending ? (
              <Spinner className="size-4" />
            ) : (
              <DownloadIcon className="size-4" />
            )}
            Export cash-flow
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Receipts"
          value={formatCurrency(cashFlowQuery.data?.totals.receipts ?? "0")}
          icon={<TrendingUpIcon className="size-4" />}
        />
        <MetricCard
          label="Payments"
          value={formatCurrency(cashFlowQuery.data?.totals.payments ?? "0")}
          icon={<TrendingDownIcon className="size-4" />}
        />
        <MetricCard
          label="Net movement"
          value={formatCurrency(cashFlowQuery.data?.totals.net ?? "0")}
          icon={<BadgeIndianRupeeIcon className="size-4" />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <AgingCard
          title="Receivable aging"
          report={receivableAgingQuery.data}
          loading={receivableAgingQuery.isLoading}
          onExport={() =>
            exportAgingReport(accessToken, "receivable", query).then(downloadCsv)
          }
        />
        <AgingCard
          title="Payable aging"
          report={payableAgingQuery.data}
          loading={payableAgingQuery.isLoading}
          onExport={() => exportAgingReport(accessToken, "payable", query).then(downloadCsv)}
        />
      </section>

      <CashFlowCard report={cashFlowQuery.data} loading={cashFlowQuery.isLoading} />
    </main>
  )
}

function AgingCard({
  title,
  report,
  loading,
  onExport,
}: {
  title: string
  report?: AgingReportResponse
  loading: boolean
  onExport: () => Promise<void>
}) {
  const [exporting, setExporting] = React.useState(false)

  async function handleExport() {
    try {
      setExporting(true)
      await onExport()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="text-sm text-muted-foreground">
            Outstanding grouped by due-date age.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={exporting}
          onClick={handleExport}
        >
          {exporting ? <Spinner className="size-4" /> : <DownloadIcon className="size-4" />}
          Export
        </Button>
      </div>
      {loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bucket</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(report?.buckets ?? []).map((bucket) => (
              <TableRow key={bucket.bucket}>
                <TableCell>{bucketLabels[bucket.bucket]}</TableCell>
                <TableCell className="text-right">{bucket.count}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(bucket.outstanding)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}

function CashFlowCard({
  report,
  loading,
}: {
  report?: CashFlowReportResponse
  loading: boolean
}) {
  return (
    <section className="rounded-2xl border bg-card">
      <div className="border-b p-4">
        <h2 className="font-medium">Cash-flow by method</h2>
        <p className="text-sm text-muted-foreground">
          Posted receipts and payments grouped by payment method.
        </p>
      </div>
      {loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Direction</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Unallocated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(report?.rows ?? []).map((row) => (
              <TableRow key={`${row.direction}-${row.paymentMethod}`}>
                <TableCell className="capitalize">{row.direction}</TableCell>
                <TableCell className="capitalize">{row.paymentMethod}</TableCell>
                <TableCell className="text-right">{row.count}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(row.amount)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(row.unallocated)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
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

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <div className="relative">
        <CalendarIcon className="absolute top-2 left-2.5 size-4" />
        <Input
          className="h-8 pl-8"
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  )
}

function formatCurrency(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value || 0)

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function downloadCsv(file: CsvExportResponse) {
  const blob = new Blob([file.content], { type: file.contentType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = url
  anchor.download = file.fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong. Please try again."
}
