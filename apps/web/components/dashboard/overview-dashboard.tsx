"use client"

import { memo } from "react"
import dynamic from "next/dynamic"
import {
  ArrowRightIcon,
  BadgeIndianRupeeIcon,
  FileWarningIcon,
  FileTextIcon,
  Layers3Icon,
  PackageSearchIcon,
  ReceiptTextIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  StoreIcon,
  TruckIcon,
  Undo2Icon,
  UserPlusIcon,
  UsersIcon,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

const OverviewRevenueChart = dynamic(
  () =>
    import("@/components/dashboard/overview-revenue-chart").then(
      (module) => module.OverviewRevenueChart
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full grid-cols-12 items-end gap-2 px-2">
        {overviewDashboardData.revenueStatistics.map((item) => (
          <div
            key={item.month}
            className="rounded-t-lg bg-muted/70"
            style={{ height: `${Math.max(item.sales / 7000, 18)}%` }}
          />
        ))}
      </div>
    ),
  }
)

const OverviewReportsPieChart = dynamic(
  () =>
    import("@/components/dashboard/overview-reports-pie-chart").then(
      (module) => module.OverviewReportsPieChart
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="size-44 rounded-full border-16 border-muted/70 border-t-primary/70" />
      </div>
    ),
  }
)

const totalIconMap = {
  sales: StoreIcon,
  purchase: ShoppingCartIcon,
  income: WalletIcon,
  expenses: BadgeIndianRupeeIcon,
  customers: UsersIcon,
  suppliers: TruckIcon,
  salesReturns: Undo2Icon,
  purchaseReturns: PackageSearchIcon,
} as const

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

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function formatValue(value: number, kind: "currency" | "count") {
  return kind === "currency" ? formatCurrency(value) : value.toLocaleString("en-IN")
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

function RecentLedgerTable({
  rows,
}: {
  rows: typeof overviewDashboardData.recentSales
}) {
  return (
    <div className="app-scrollbar max-h-[332px] overflow-y-auto overflow-x-auto rounded-xl border border-border/70">
      <Table className="min-w-[720px]">
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow className="hover:bg-transparent">
            <TableHead>Date</TableHead>
            <TableHead>Invoice Number</TableHead>
            <TableHead>Party</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="text-muted-foreground">{row.date}</TableCell>
              <TableCell className="font-medium">{row.invoiceNumber}</TableCell>
              <TableCell>{row.party}</TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {formatCurrency(row.total)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(row.paid)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(row.due)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export const OverviewDashboard = memo(function OverviewDashboard() {
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewDashboardData.totals.map((item) => {
          const Icon = totalIconMap[item.id]

          return (
            <DashboardCard key={item.id}>
              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <h2 className="font-mono text-xl font-semibold tracking-tight sm:text-2xl">
                      {formatValue(item.value, item.kind)}
                    </h2>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{item.note}</p>
              </div>
            </DashboardCard>
          )
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.95fr)]">
        <DashboardCard className="overflow-hidden">
          <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Revenue Statistic</h2>
                <p className="text-sm text-muted-foreground">
                  Sales, purchase, and net income trend through the year.
                </p>
              </div>
              <Badge variant="outline" className="gap-1.5">
                <ShoppingBagIcon className="size-3.5" />
                {compactFormatter.format(
                  overviewDashboardData.revenueStatistics.reduce(
                    (total, item) => total + item.sales,
                    0
                  )
                )}{" "}
                sales booked
              </Badge>
            </div>
          </div>
          <div className="h-[340px] min-w-0 px-2 py-4 sm:px-4">
            <OverviewRevenueChart data={overviewDashboardData.revenueStatistics} />
          </div>
        </DashboardCard>

        <DashboardCard className="overflow-hidden">
          <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Overall Reports</h2>
              <p className="text-sm text-muted-foreground">
                Business mix across sales, purchase, and expenses.
              </p>
            </div>
          </div>
          <div className="grid gap-4 p-4 sm:p-5 lg:p-6">
            <div className="h-[240px] min-w-0">
              <OverviewReportsPieChart data={overviewDashboardData.overallReports} />
            </div>
            <div className="space-y-3">
              {overviewDashboardData.overallReports.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-semibold">
                    {formatCurrency(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </DashboardCard>
      </div>

      <DashboardCard className="overflow-hidden">
        <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Low Stock</h2>
              <p className="text-sm text-muted-foreground">
                Top 10 products that need immediate replenishment.
              </p>
            </div>
            <Badge className="gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <FileWarningIcon className="size-3.5" />
              10 low-stock items
            </Badge>
          </div>
        </div>
        <div className="app-scrollbar max-h-[332px] overflow-y-auto overflow-x-auto">
          <Table className="min-w-[620px]">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead>HSN Code</TableHead>
                <TableHead>Name of Product</TableHead>
                <TableHead className="text-right">Current Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overviewDashboardData.lowStockItems.map((item) => (
                <TableRow key={`${item.hsnCode}-${item.productName}`}>
                  <TableCell className="font-mono">{item.hsnCode}</TableCell>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {item.currentStock}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DashboardCard>

      <DashboardCard className="overflow-hidden">
        <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Recent Activity</h2>
            <p className="text-sm text-muted-foreground">
              Switch between recent sales and purchase documents.
            </p>
          </div>
        </div>
        <div className="p-4 sm:p-5 lg:p-6">
          <Tabs defaultValue="sales" className="gap-4">
            <TabsList>
              <TabsTrigger value="sales">Recent Sales</TabsTrigger>
              <TabsTrigger value="purchases">Recent Purchase</TabsTrigger>
            </TabsList>
            <TabsContent value="sales" className="min-w-0">
              <RecentLedgerTable rows={overviewDashboardData.recentSales} />
            </TabsContent>
            <TabsContent value="purchases" className="min-w-0">
              <RecentLedgerTable rows={overviewDashboardData.recentPurchases} />
            </TabsContent>
          </Tabs>
        </div>
      </DashboardCard>
    </div>
  )
})
