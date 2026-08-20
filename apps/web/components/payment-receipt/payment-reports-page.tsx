"use client"

import * as React from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  BadgeIndianRupeeIcon,
  BarChart3Icon,
  CalendarIcon,
  DownloadIcon,
  LandmarkIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import type { DateRange } from "react-day-picker"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { cn } from "@/lib/utils"
import {
  exportAgingReport,
  exportCashFlowReport,
  getAgingReport,
  getCashFlowReport,
  type AgingReportResponse,
  type CashFlowReportResponse,
  type CsvExportResponse,
} from "@/lib/payment-receipt/api"

type AgingPeriod = AgingReportResponse["periods"][number]
type DatePreset = "month" | "quarter" | "financial_year" | "custom"

const datePresetOptions: Array<{ value: DatePreset; label: string }> = [
  { value: "month", label: "1 month" },
  { value: "quarter", label: "Quarter" },
  { value: "financial_year", label: "Financial year" },
  { value: "custom", label: "Custom" },
]

const cashMovementChartConfig = {
  amount: {
    label: "Amount",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

const agingChartConfig = {
  receivable: {
    label: "Customer due",
    color: "var(--chart-2)",
  },
  payable: {
    label: "Supplier due",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig

export function PaymentReportsPage() {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const initialRange = React.useMemo(() => getDateRangeForPreset("month"), [])
  const [datePreset, setDatePreset] = React.useState<DatePreset>("month")
  const [from, setFrom] = React.useState(initialRange.from)
  const [to, setTo] = React.useState(initialRange.to)
  const query = { from: from || undefined, to: to || undefined }

  function applyDatePreset(nextPreset: DatePreset) {
    setDatePreset(nextPreset)

    if (nextPreset === "custom") {
      return
    }

    const nextRange = getDateRangeForPreset(nextPreset)
    setFrom(nextRange.from)
    setTo(nextRange.to)
  }

  function updateCustomDateRange(nextFrom: string, nextTo: string) {
    setDatePreset("custom")
    setFrom(nextFrom)
    setTo(nextTo)
  }

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
      <ReportsHeader
        from={from}
        to={to}
        datePreset={datePreset}
        onPresetChange={applyDatePreset}
        onRangeChange={updateCustomDateRange}
        report={cashFlowQuery.data}
        loading={cashFlowQuery.isLoading}
        exporting={cashFlowExportMutation.isPending}
        onExport={() => cashFlowExportMutation.mutate()}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <CashMovementChartCard
          report={cashFlowQuery.data}
          loading={cashFlowQuery.isLoading}
        />
        <AgingComparisonChartCard
          receivableReport={receivableAgingQuery.data}
          payableReport={payableAgingQuery.data}
          loading={receivableAgingQuery.isLoading || payableAgingQuery.isLoading}
          onExportReceivable={() =>
            exportAgingReport(accessToken, "receivable", query).then(downloadCsv)
          }
          onExportPayable={() =>
            exportAgingReport(accessToken, "payable", query).then(downloadCsv)
          }
        />
      </section>

      <CashFlowCard report={cashFlowQuery.data} loading={cashFlowQuery.isLoading} />
    </main>
  )
}

function ReportsHeader({
  from,
  to,
  datePreset,
  onPresetChange,
  onRangeChange,
  report,
  loading,
  exporting,
  onExport,
}: {
  from: string
  to: string
  datePreset: DatePreset
  onPresetChange: (value: DatePreset) => void
  onRangeChange: (from: string, to: string) => void
  report?: CashFlowReportResponse
  loading: boolean
  exporting: boolean
  onExport: () => void
}) {
  const netAmount = toNumber(report?.totals.net ?? "0")
  const netTone = netAmount >= 0 ? "positive" : "danger"

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 bg-background">
              <BarChart3Icon className="size-3.5" />
              Compliance reports
            </Badge>
            <Badge
              variant="outline"
              className="gap-1.5 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
            >
              <span className="size-1.5 rounded-full bg-current" />
              Cash and dues
            </Badge>
          </div>
          <div className="mt-3 max-w-2xl space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Payment reports
            </h1>
            <p className="max-w-xl text-sm leading-5 text-muted-foreground">
              See money in, money out, customer dues, and supplier dues in one view.
            </p>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {datePresetOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={datePreset === option.value ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 rounded-full px-3 text-xs",
                    datePreset === option.value &&
                      "bg-blue-600 text-white hover:bg-blue-700"
                  )}
                  onClick={() => onPresetChange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <ReportDateRangePicker
                from={from}
                to={to}
                onChange={onRangeChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={exporting}
                onClick={onExport}
              >
                {exporting ? (
                  <Spinner className="size-4" />
                ) : (
                  <DownloadIcon className="size-4" />
                )}
                Export cash flow
              </Button>
            </div>
          </div>
        </div>
        <div className="border-t border-border bg-muted/10 p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="grid h-full content-center gap-3">
            <ReportSummaryRow
              label="Money in"
              value={formatCurrency(report?.totals.receipts ?? "0")}
              loading={loading}
              tone="positive"
              icon={<TrendingUpIcon className="size-4" />}
            />
            <ReportSummaryRow
              label="Money out"
              value={formatCurrency(report?.totals.payments ?? "0")}
              loading={loading}
              tone="danger"
              icon={<TrendingDownIcon className="size-4" />}
            />
            <ReportSummaryRow
              label="Net movement"
              value={formatCurrency(report?.totals.net ?? "0")}
              loading={loading}
              tone={netTone}
              icon={<BadgeIndianRupeeIcon className="size-4" />}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function CashMovementChartCard({
  report,
  loading,
}: {
  report?: CashFlowReportResponse
  loading: boolean
}) {
  const receipts = toNumber(report?.totals.receipts ?? "0")
  const payments = toNumber(report?.totals.payments ?? "0")
  const net = toNumber(report?.totals.net ?? "0")
  const chartData = [
    {
      name: "Money in",
      amount: receipts,
      fill: "var(--chart-2)",
    },
    {
      name: "Money out",
      amount: payments,
      fill: "var(--chart-5)",
    },
    {
      name: "Net",
      amount: Math.abs(net),
      fill: net >= 0 ? "var(--chart-3)" : "var(--chart-5)",
    },
  ]

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Cash movement</h2>
          <p className="text-xs text-muted-foreground">
            Quick picture of what came in and went out.
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "w-fit gap-1.5",
            net >= 0 ?
              "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
            : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          )}
        >
          <span className="size-1.5 rounded-full bg-current" />
          Net {formatCurrency(net)}
        </Badge>
      </div>
      {loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-3 p-4">
          <ChartContainer
            config={cashMovementChartConfig}
            className="h-64 w-full"
          >
            <BarChart
              accessibilityLayer
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 20, bottom: 0, left: 4 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => compactCurrency(Number(value))}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => String(label)}
                    formatter={(value) => formatCurrency(value)}
                  />
                }
              />
              <Bar
                dataKey="amount"
                name="Amount"
                radius={[0, 8, 8, 0]}
                barSize={26}
              />
            </BarChart>
          </ChartContainer>
          <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <LandmarkIcon className="size-3.5 text-blue-700 dark:text-blue-300" />
            Use this with bank records before month-end filing review.
          </div>
        </div>
      )}
    </section>
  )
}

function AgingComparisonChartCard({
  receivableReport,
  payableReport,
  loading,
  onExportReceivable,
  onExportPayable,
}: {
  receivableReport?: AgingReportResponse
  payableReport?: AgingReportResponse
  loading: boolean
  onExportReceivable: () => Promise<void>
  onExportPayable: () => Promise<void>
}) {
  const [exporting, setExporting] =
    React.useState<"receivable" | "payable" | null>(null)
  const granularity = receivableReport?.granularity ?? payableReport?.granularity ?? "day"
  const chartData = buildAgingChartData(receivableReport, payableReport)
  const chartDescription =
    granularity === "day" ?
      "Daily customer dues and supplier dues for this selected range."
    : "Monthly customer dues and supplier dues for this selected range."

  async function handleExport(type: "receivable" | "payable") {
    try {
      setExporting(type)
      if (type === "receivable") {
        await onExportReceivable()
        return
      }

      await onExportPayable()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setExporting(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Due ageing</h2>
          <p className="text-xs text-muted-foreground">{chartDescription}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={exporting !== null}
            onClick={() => void handleExport("receivable")}
          >
            {exporting === "receivable" ? (
              <Spinner className="size-4" />
            ) : (
              <DownloadIcon className="size-4" />
            )}
            Customers
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={exporting !== null}
            onClick={() => void handleExport("payable")}
          >
            {exporting === "payable" ? (
              <Spinner className="size-4" />
            ) : (
              <DownloadIcon className="size-4" />
            )}
            Suppliers
          </Button>
        </div>
      </div>
      {loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-3 p-4">
          <ChartContainer config={agingChartConfig} className="h-64 w-full">
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={72}
                tickFormatter={(value) => compactCurrency(Number(value))}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCurrency(value)}
                  />
                }
              />
              <Bar
                dataKey="receivable"
                radius={[8, 8, 0, 0]}
                fill="var(--color-receivable)"
                barSize={18}
              />
              <Bar
                dataKey="payable"
                radius={[8, 8, 0, 0]}
                fill="var(--color-payable)"
                barSize={18}
              />
            </BarChart>
          </ChartContainer>
          <div className="flex flex-wrap gap-3 text-xs">
            <ChartLegendDot
              label="Customer due"
              value={formatCurrency(receivableReport?.totals.outstanding ?? "0")}
              className="bg-[var(--color-receivable)]"
            />
            <ChartLegendDot
              label="Supplier due"
              value={formatCurrency(payableReport?.totals.outstanding ?? "0")}
              className="bg-[var(--color-payable)]"
            />
          </div>
        </div>
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
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Method-wise movement</h2>
        <p className="text-xs text-muted-foreground">
          Cash, UPI, card, cheque, and bank totals.
        </p>
      </div>
      {loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      ) : (
        <Table className="table-fixed text-xs [&_td]:py-2 [&_th]:h-8">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[24%]">Type</TableHead>
              <TableHead className="w-[18%]">Method</TableHead>
              <TableHead className="w-[12%] text-right">Count</TableHead>
              <TableHead className="w-[23%] text-right">Amount</TableHead>
              <TableHead className="w-[23%] text-right">Unapplied</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(report?.rows ?? []).map((row) => (
              <TableRow key={`${row.direction}-${row.paymentMethod}`}>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1.5",
                      row.direction === "receipt" ?
                        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {row.direction === "receipt" ? "Money in" : "Money out"}
                  </Badge>
                </TableCell>
                <TableCell>{paymentMethodLabel(row.paymentMethod)}</TableCell>
                <TableCell className="text-right">{row.count}</TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono",
                    row.direction === "receipt" ?
                      "text-emerald-700 dark:text-emerald-300"
                    : "text-red-700 dark:text-red-300"
                  )}
                >
                  {formatCurrency(row.amount)}
                </TableCell>
                <TableCell className="text-right font-mono text-amber-700 dark:text-amber-300">
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

function ReportSummaryRow({
  label,
  value,
  loading,
  tone,
  icon,
}: {
  label: string
  value: string
  loading: boolean
  tone: "positive" | "danger"
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/70 pb-3 last:border-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "rounded-full border bg-background p-1.5",
            tone === "positive" ?
              "text-emerald-700 dark:text-emerald-300"
            : "text-red-700 dark:text-red-300"
          )}
        >
          {icon}
        </span>
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      {loading ? (
        <Skeleton className="h-5 w-24" />
      ) : (
        <p
          className={cn(
            "shrink-0 font-mono text-sm font-semibold",
            tone === "positive" ?
              "text-emerald-700 dark:text-emerald-300"
            : "text-red-700 dark:text-red-300"
          )}
        >
          {value}
        </p>
      )}
    </div>
  )
}

function ChartLegendDot({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className: string
}) {
  return (
    <div className="inline-flex min-w-0 items-center gap-2 rounded-full border bg-background px-3 py-1.5">
      <span className={cn("size-2 rounded-full", className)} />
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  )
}

function buildAgingChartData(
  receivableReport?: AgingReportResponse,
  payableReport?: AgingReportResponse
) {
  const periods = new Map<
    string,
    {
      periodStart: string
      label: string
      receivable: number
      payable: number
    }
  >()

  addAgingPeriodsToMap(periods, receivableReport?.periods, "receivable")
  addAgingPeriodsToMap(periods, payableReport?.periods, "payable")

  return Array.from(periods.values()).sort((first, second) =>
    first.periodStart.localeCompare(second.periodStart)
  )
}

function addAgingPeriodsToMap(
  periods: Map<
    string,
    { periodStart: string; label: string; receivable: number; payable: number }
  >,
  sourcePeriods: AgingPeriod[] | undefined,
  key: "receivable" | "payable"
) {
  for (const period of sourcePeriods ?? []) {
    const current = periods.get(period.periodStart) ?? {
      periodStart: period.periodStart,
      label: period.label,
      receivable: 0,
      payable: 0,
    }

    current[key] = toNumber(period.outstanding)
    periods.set(period.periodStart, current)
  }
}

function ReportDateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selectedRange: DateRange = {
    from: parseDateValue(from),
    to: parseDateValue(to),
  }
  const rangeLabel =
    from && to ? `${formatDate(from)} - ${formatDate(to)}` : "Choose date range"

  function handleSelect(range: DateRange | undefined) {
    if (!range?.from) {
      return
    }

    const nextFrom = formatDateForInput(range.from)
    const nextTo = formatDateForInput(range.to ?? range.from)
    onChange(nextFrom, nextTo)

    if (range.to) {
      setOpen(false)
    }
  }

  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      Date range
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          type="button"
          className={cn(
            "flex h-8 w-full min-w-60 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 sm:w-80",
            (!from || !to) && "text-muted-foreground"
          )}
        >
          <span className="truncate">{rangeLabel}</span>
          <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={selectedRange}
            captionLayout="dropdown"
            numberOfMonths={2}
            onSelect={handleSelect}
          />
        </PopoverContent>
      </Popover>
    </label>
  )
}

function paymentMethodLabel(method: CashFlowReportResponse["rows"][number]["paymentMethod"]) {
  const labels: Record<CashFlowReportResponse["rows"][number]["paymentMethod"], string> = {
    cash: "Cash",
    bank: "Bank",
    upi: "UPI",
    card: "Card",
    cheque: "Cheque",
    other: "Other",
  }

  return labels[method] ?? method
}

function getDateRangeForPreset(preset: Exclude<DatePreset, "custom">) {
  const today = new Date()
  const to = formatDateForInput(today)

  if (preset === "month") {
    const from = new Date(today)
    from.setDate(from.getDate() - 30)
    return { from: formatDateForInput(from), to }
  }

  if (preset === "quarter") {
    const from = new Date(today)
    from.setMonth(from.getMonth() - 3)
    return { from: formatDateForInput(from), to }
  }

  const financialYearStartYear =
    today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
  return {
    from: formatDateForInput(new Date(financialYearStartYear, 3, 1)),
    to,
  }
}

function parseDateValue(value: string) {
  if (!value) {
    return undefined
  }

  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) {
    return undefined
  }

  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function formatDateForInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
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

function toNumber(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value || 0)
  return Number.isFinite(amount) ? amount : 0
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

function formatCurrency(value: string | number) {
  const amount = toNumber(value)

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount)
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
