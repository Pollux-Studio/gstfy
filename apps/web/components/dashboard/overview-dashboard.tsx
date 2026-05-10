"use client"

import dynamic from "next/dynamic"
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  Clock3Icon,
  FileTextIcon,
  Layers3Icon,
  ReceiptTextIcon,
  UserPlusIcon,
  WalletIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { overviewDashboardData } from "@/lib/dashboard/mock-overview"

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compactFormatter = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
})

const MonthlySalesChart = dynamic(
  () =>
    import("@/components/dashboard/monthly-sales-chart").then(
      (module) => module.MonthlySalesChart
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full grid-cols-12 items-end gap-2 px-2">
        {overviewDashboardData.monthlySales.map((item, index) => (
          <div
            key={item.month}
            className={cn(
              "rounded-t-lg bg-muted/70",
              index === overviewDashboardData.monthlySales.length - 1 &&
                "bg-primary/70"
            )}
            style={{
              height: `${Math.max(item.sales / 7500, 18)}%`,
            }}
          />
        ))}
      </div>
    ),
  }
)

const quickActions = [
  {
    label: "Create invoice",
    icon: FileTextIcon,
  },
  {
    label: "Record payment",
    icon: WalletIcon,
  },
  {
    label: "Review GSTR",
    icon: ReceiptTextIcon,
  },
  {
    label: "Add party",
    icon: UserPlusIcon,
  },
]

const transactionBadgeClassMap = {
  Sale: "bg-primary/10 text-primary",
  Payment: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Refund: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
} as const

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function DashboardCard({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card text-card-foreground shadow-sm",
        className
      )}
    >
      {children}
    </section>
  )
}

export function OverviewDashboard() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <DashboardCard className="overflow-hidden">
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-primary/5 to-transparent" />
          <div className="relative flex flex-col gap-5 p-4 sm:p-5 lg:gap-6 lg:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1.5 bg-background/70">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    Core
                  </Badge>
                  <Badge className="gap-1.5 bg-primary/10 text-primary dark:text-primary-foreground">
                    <Layers3Icon className="size-3.5" />
                    Executive summary
                  </Badge>
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
                    {overviewDashboardData.intro.title}
                  </h1>
                  <p className="max-w-2xl text-sm text-muted-foreground lg:text-base">
                    {overviewDashboardData.intro.description}
                  </p>
                </div>
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-2">
                {quickActions.map((action) => {
                  const Icon = action.icon

                  return (
                    <Button
                      key={action.label}
                      type="button"
                      variant="outline"
                      className="h-10 justify-between rounded-xl bg-background/80 px-3"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        <span>{action.label}</span>
                      </span>
                      <ArrowRightIcon className="size-4 text-muted-foreground" />
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </DashboardCard>

      <div className="grid gap-4 md:grid-cols-3">
        <DashboardCard>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {overviewDashboardData.gstOwed.label}
                </p>
                <h2 className="font-mono text-2xl font-semibold tracking-tight">
                  {formatCurrency(overviewDashboardData.gstOwed.value)}
                </h2>
              </div>
              <Badge className="gap-1.5 bg-primary/10 text-primary dark:text-primary-foreground">
                <ArrowUpRightIcon className="size-3.5" />
                {overviewDashboardData.gstOwed.trend}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {overviewDashboardData.gstOwed.note}
            </p>
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Filing deadline countdown
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {overviewDashboardData.filingDeadline.daysRemaining} days
                </h2>
              </div>
              <Badge className="gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                <Clock3Icon className="size-3.5" />
                Due soon
              </Badge>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>{overviewDashboardData.filingDeadline.dueDate}</p>
              <p>{overviewDashboardData.filingDeadline.note}</p>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Outstanding invoices
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                {overviewDashboardData.outstandingInvoices.count}
              </h2>
            </div>
            <div className="space-y-1">
              <p className="font-mono text-lg font-semibold">
                {formatCurrency(overviewDashboardData.outstandingInvoices.amount)}
              </p>
              <p className="text-sm text-muted-foreground">
                {overviewDashboardData.outstandingInvoices.note}
              </p>
            </div>
          </div>
        </DashboardCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
        <DashboardCard className="overflow-hidden">
          <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Monthly sales chart</h2>
                <p className="text-sm text-muted-foreground">
                  Sales trend across the current financial year.
                </p>
              </div>
              <Badge variant="outline">
                {compactFormatter.format(
                  overviewDashboardData.monthlySales.reduce(
                    (total, item) => total + item.sales,
                    0
                  )
                )}{" "}
                booked
              </Badge>
            </div>
          </div>
          <div className="h-80 min-w-0 px-2 py-4 sm:px-4">
            <MonthlySalesChart data={overviewDashboardData.monthlySales} />
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Shopify sales chart</h2>
              <p className="text-sm text-muted-foreground">
                Marketplace channel performance appears here when connected.
              </p>
            </div>
          </div>
          <div className="flex h-[22rem] flex-col items-center justify-center gap-4 px-4 text-center sm:px-5 lg:px-6">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
              <ReceiptTextIcon className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Shopify not connected</h3>
              <p className="max-w-xs text-sm text-muted-foreground">
                {overviewDashboardData.shopify.note}
              </p>
            </div>
            <Button type="button" variant="outline">
              Connect Shopify
            </Button>
          </div>
        </DashboardCard>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <DashboardCard className="min-w-0 overflow-hidden">
          <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Top customers by revenue</h2>
              <p className="text-sm text-muted-foreground">
                Highest-value buyers for the current month.
              </p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {overviewDashboardData.topCustomers.map((customer, index) => (
              <div
                key={customer.name}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6"
              >
                <div className="min-w-0 w-full">
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {customer.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {customer.invoiceCount} invoices
                      </p>
                    </div>
                  </div>
                </div>
                <p className="shrink-0 pl-10 font-mono text-sm font-semibold sm:pl-0">
                  {formatCurrency(customer.revenue)}
                </p>
              </div>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard className="min-w-0 overflow-hidden">
          <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Recent transactions</h2>
              <p className="text-sm text-muted-foreground">
                Latest invoices, payments, and credit activity.
              </p>
            </div>
          </div>
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Type</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overviewDashboardData.recentTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    <Badge
                      className={cn(
                        "gap-1.5 border-transparent",
                        transactionBadgeClassMap[transaction.type]
                      )}
                    >
                      {transaction.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {transaction.party}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {transaction.date}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatCurrency(transaction.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="sm">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DashboardCard>
      </div>
    </div>
  )
}
