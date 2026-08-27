"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowDownIcon,
  ArrowDownUpIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  BadgeIndianRupeeIcon,
  CheckCircle2Icon,
  FileTextIcon,
  FileWarningIcon,
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getStoredAuthSession,
  subscribeToAuthSessionChange,
} from "@/lib/auth/session"
import {
  getBusinessDashboard,
  type BusinessDashboardOverview,
  type DashboardLowStockItem,
  type DashboardRecentDocument,
} from "@/lib/dashboard/api"
import { cn } from "@/lib/utils"

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

type SortDirection = "asc" | "desc"
type LowStockSortKey = "hsn" | "product" | "quantity" | "reorder" | "value"
type RecentDocumentSortKey =
  | "date"
  | "document"
  | "party"
  | "status"
  | "total"
  | "paid"
  | "due"

const dashboardTableClass =
  "w-full table-fixed text-[11px] sm:text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-2"
const dashboardTabTriggerClass =
  "relative h-7 min-w-0 rounded-none px-0 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none dark:data-[state=active]:text-blue-400 after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:scale-x-0 after:rounded-full after:bg-blue-600 after:transition-transform data-[state=active]:after:scale-x-100 dark:after:bg-blue-400"

const OverviewRevenueChart = dynamic(
  () =>
    import("@/components/dashboard/overview-revenue-chart").then(
      (module) => module.OverviewRevenueChart
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full grid-cols-12 items-end gap-2 px-2">
        {Array.from({ length: 12 }).map((_, index) => (
          <Skeleton
            key={index}
            className="rounded-t-lg"
            style={{ height: `${24 + (index % 5) * 12}%` }}
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
        <Skeleton className="size-44 rounded-full" />
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
    href: "/pos",
  },
  {
    label: "Record receipt",
    icon: WalletIcon,
    href: "/receipts",
  },
  {
    label: "Review GSTR",
    icon: ReceiptTextIcon,
    href: "/gst",
  },
  {
    label: "Add party",
    icon: UserPlusIcon,
    href: "/parties",
  },
]

export const OverviewDashboard = React.memo(function OverviewDashboard() {
  const storedSession = React.useSyncExternalStore(
    subscribeToAuthSessionChange,
    getStoredAuthSession,
    () => null
  )
  const userId = storedSession?.user.id ?? ""
  const accessToken = storedSession?.session.accessToken ?? ""

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "overview", userId],
    queryFn: () => getBusinessDashboard(accessToken),
    enabled: accessToken.length > 0 && userId.length > 0,
    staleTime: 1000 * 60 * 2,
  })

  if (!storedSession || isLoading || !data) {
    return <OverviewDashboardSkeleton />
  }

  const totals = buildTotals(data)

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
                    Live workspace
                  </Badge>
                  <Badge className="gap-1.5 bg-primary/10 text-primary dark:text-primary-foreground">
                    <Layers3Icon className="size-3.5" />
                    {data.period.label}
                  </Badge>
                  {data.business.gstin ?
                    <Badge
                      variant="outline"
                      className="font-mono text-[11px] tracking-[0.12em]"
                    >
                      {data.business.gstin}
                    </Badge>
                  : null}
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
                    {data.business.name} dashboard
                  </h1>
                  <p className="max-w-2xl text-sm text-muted-foreground lg:text-base">
                    Sales, purchases, GST payable, receivables, payables, and stock
                    pressure from your current business data.
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
                      nativeButton={false}
                      render={<Link href={action.href} />}
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
        {totals.map((item) => {
          const Icon = totalIconMap[item.id]

          return (
            <DashboardCard key={item.id}>
              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <h2 className="truncate font-mono text-xl font-semibold tracking-tight sm:text-2xl">
                      {formatValue(item.value, item.kind)}
                    </h2>
                  </div>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
                  Posted sales, purchases, and accounting income trend.
                </p>
              </div>
              <Badge variant="outline" className="gap-1.5">
                <ShoppingBagIcon className="size-3.5" />
                {compactFormatter.format(data.summary.sales)} sales booked
              </Badge>
            </div>
          </div>
          <div className="h-[340px] min-w-0 px-2 py-4 sm:px-4">
            <OverviewRevenueChart data={data.trend} />
          </div>
        </DashboardCard>

        <DashboardCard className="overflow-hidden">
          <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Business Mix</h2>
              <p className="text-sm text-muted-foreground">
                Where this period&apos;s business value is coming from.
              </p>
            </div>
          </div>
          {data.mix.length > 0 ?
            <div className="grid gap-4 p-4 sm:p-5 lg:p-6">
              <div className="h-[240px] min-w-0">
                <OverviewReportsPieChart data={data.mix} />
              </div>
              <div className="space-y-3">
                {data.mix.map((item) => (
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
          : <DashboardEmpty
              icon={<ReceiptTextIcon className="size-4" />}
              title="No posted business yet"
              description="Create a sale or purchase to see the business mix."
              actionHref="/pos"
              actionLabel="Create invoice"
            />}
        </DashboardCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <LowStockSection
          items={data.lowStockItems}
          totalCount={data.summary.lowStockCount}
        />

        <DashboardCard className="overflow-hidden">
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">GST Filing Readiness</h2>
              <p className="text-sm text-muted-foreground">
                Latest generated GST report and exception status.
              </p>
            </div>
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Latest report
                </p>
                <p className="text-lg font-semibold">
                  {data.filingReadiness.period ?? "Not generated"}
                </p>
              </div>
              <FilingStatusBadge
                status={data.filingReadiness.status}
                blocking={data.filingReadiness.blockingExceptions}
                open={data.filingReadiness.openExceptions}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Open exceptions</p>
                <p className="mt-1 font-mono text-xl font-semibold">
                  {data.filingReadiness.openExceptions}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Tax payable</p>
                <p className="mt-1 font-mono text-xl font-semibold">
                  {formatCurrency(data.summary.estimatedTaxPayable)}
                </p>
              </div>
            </div>
            <p className="rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm text-muted-foreground">
              {data.filingReadiness.nextAction}
            </p>
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={<Link href="/gst" />}
              className="w-full"
            >
              Open GST workspace
              <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        </DashboardCard>
      </div>

      <RecentActivitySection
        sales={data.recentSales}
        purchases={data.recentPurchases}
      />
    </div>
  )
})

function buildTotals(data: BusinessDashboardOverview) {
  return [
    {
      id: "sales" as const,
      label: "Total Sales",
      value: data.summary.sales,
      kind: "currency" as const,
      note: "Posted sales in this period",
    },
    {
      id: "purchase" as const,
      label: "Total Purchase",
      value: data.summary.purchases,
      kind: "currency" as const,
      note: "Posted supplier bills in this period",
    },
    {
      id: "income" as const,
      label: "Net Profit",
      value: data.summary.netProfit,
      kind: "currency" as const,
      note: "Based on posted accounting entries",
    },
    {
      id: "expenses" as const,
      label: "GST Payable",
      value: data.summary.estimatedTaxPayable,
      kind: "currency" as const,
      note: "Output GST minus available input GST",
    },
    {
      id: "customers" as const,
      label: "Customers",
      value: data.summary.customers,
      kind: "count" as const,
      note: "Active customer party profiles",
    },
    {
      id: "suppliers" as const,
      label: "Suppliers",
      value: data.summary.suppliers,
      kind: "count" as const,
      note: "Active supplier party profiles",
    },
    {
      id: "salesReturns" as const,
      label: "Sales Returns",
      value: data.summary.salesReturns,
      kind: "currency" as const,
      note: "Posted sales returns and credits",
    },
    {
      id: "purchaseReturns" as const,
      label: "Purchase Returns",
      value: data.summary.purchaseReturns,
      kind: "currency" as const,
      note: "Posted purchase returns and debits",
    },
  ]
}

function LowStockSection({
  items,
  totalCount,
}: {
  items: DashboardLowStockItem[]
  totalCount: number
}) {
  const [activeTab, setActiveTab] = React.useState<"all" | "reorder" | "negative">(
    "all"
  )
  const negativeItems = React.useMemo(
    () => items.filter((item) => numericValue(item.quantityOnHand) < 0),
    [items]
  )
  const reorderItems = React.useMemo(
    () =>
      items.filter(
        (item) =>
          numericValue(item.quantityOnHand) >= 0 &&
          numericValue(item.quantityOnHand) <= numericValue(item.reorderLevel)
      ),
    [items]
  )
  const activeCopy =
    activeTab === "negative" ?
      {
        title: "Negative stock",
        description: "Items where outward movement has gone below available stock.",
      }
    : activeTab === "reorder" ?
      {
        title: "Below reorder",
        description: "Products that need purchase or stock transfer attention.",
      }
    : {
        title: "Low stock",
        description: "Products below reorder level across warehouses.",
      }

  return (
    <Tabs
      value={activeTab}
      defaultValue="all"
      onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      className="min-w-0"
    >
      <DashboardCard className="overflow-hidden">
        <div className="border-b border-border px-4 py-3 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 space-y-1">
              <h2 className="text-base font-semibold">{activeCopy.title}</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {activeCopy.description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 xl:justify-end">
              <TabsList className="h-auto flex-wrap justify-start gap-4 rounded-none border-0 bg-transparent p-0 xl:justify-end">
                <TabsTrigger value="all" className={dashboardTabTriggerClass}>
                  All
                </TabsTrigger>
                <TabsTrigger value="reorder" className={dashboardTabTriggerClass}>
                  Reorder
                </TabsTrigger>
                <TabsTrigger value="negative" className={dashboardTabTriggerClass}>
                  Negative
                </TabsTrigger>
              </TabsList>
              <Badge className="gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                <FileWarningIcon className="size-3.5" />
                {totalCount} items
              </Badge>
            </div>
          </div>
        </div>
        <TabsContent value="all" className="m-0">
          <LowStockTable items={items} emptyKind="all" />
        </TabsContent>
        <TabsContent value="reorder" className="m-0">
          <LowStockTable items={reorderItems} emptyKind="reorder" />
        </TabsContent>
        <TabsContent value="negative" className="m-0">
          <LowStockTable items={negativeItems} emptyKind="negative" />
        </TabsContent>
      </DashboardCard>
    </Tabs>
  )
}

function LowStockTable({
  items,
  emptyKind,
}: {
  items: DashboardLowStockItem[]
  emptyKind: "all" | "reorder" | "negative"
}) {
  const [sortKey, setSortKey] = React.useState<LowStockSortKey>("quantity")
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc")
  const sortedItems = React.useMemo(
    () => sortLowStockItems(items, sortKey, sortDirection),
    [items, sortDirection, sortKey]
  )

  function handleSort(nextKey: LowStockSortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setSortKey(nextKey)
    setSortDirection(nextKey === "quantity" ? "asc" : "desc")
  }

  if (sortedItems.length === 0) {
    const copy =
      emptyKind === "negative" ?
        {
          title: "No negative stock",
          description: "Stock is not below zero for the loaded dashboard items.",
        }
      : emptyKind === "reorder" ?
        {
          title: "No reorder pressure",
          description: "Items are currently above their reorder threshold.",
        }
      : {
          title: "No low-stock pressure",
          description:
            "Tracked products are above reorder level or stock tracking is not enabled yet.",
        }

    return (
      <DashboardEmpty
        icon={<PackageSearchIcon className="size-4" />}
        title={copy.title}
        description={copy.description}
        actionHref="/inventory"
        actionLabel="Open inventory"
      />
    )
  }

  return (
    <>
      <div className="app-scrollbar max-h-[332px] overflow-auto">
        <Table className={dashboardTableClass}>
          <colgroup>
            <col className="w-[15%]" />
            <col className="w-[35%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
            <TableRow className="hover:bg-transparent">
              <SortableDashboardHead
                sortKey="hsn"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                HSN
              </SortableDashboardHead>
              <SortableDashboardHead
                sortKey="product"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                Product
              </SortableDashboardHead>
              <SortableDashboardHead
                sortKey="quantity"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                align="right"
                onSort={handleSort}
              >
                On hand
              </SortableDashboardHead>
              <SortableDashboardHead
                sortKey="reorder"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                align="right"
                onSort={handleSort}
              >
                Reorder
              </SortableDashboardHead>
              <SortableDashboardHead
                sortKey="value"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                align="right"
                onSort={handleSort}
              >
                Value
              </SortableDashboardHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((item) => (
              <TableRow key={item.itemId}>
                <TableCell className="font-mono text-muted-foreground">
                  {item.hsnCode || "-"}
                </TableCell>
                <TableCell>
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {item.sku}
                    </p>
                  </div>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono font-semibold",
                    numericValue(item.quantityOnHand) < 0 ?
                      "text-red-600 dark:text-red-400"
                    : "text-amber-700 dark:text-amber-300"
                  )}
                >
                  {formatQuantity(item.quantityOnHand)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatQuantity(item.reorderLevel)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(item.inventoryValue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground sm:px-5 lg:px-6">
        Showing {sortedItems.length} of {items.length} stock alerts
      </div>
    </>
  )
}

function RecentActivitySection({
  sales,
  purchases,
}: {
  sales: DashboardRecentDocument[]
  purchases: DashboardRecentDocument[]
}) {
  const [activeTab, setActiveTab] = React.useState<"sales" | "purchases">("sales")
  const activeCopy =
    activeTab === "purchases" ?
      {
        title: "Recent purchases",
        description: "Latest supplier bills posted in this workspace.",
      }
    : {
        title: "Recent sales",
        description: "Latest customer bills posted from POS and sales flows.",
      }

  return (
    <Tabs
      value={activeTab}
      defaultValue="sales"
      onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      className="min-w-0"
    >
      <DashboardCard className="overflow-hidden">
        <div className="border-b border-border px-4 py-3 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 space-y-1">
              <h2 className="text-base font-semibold">{activeCopy.title}</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {activeCopy.description}
              </p>
            </div>
            <TabsList className="h-auto flex-wrap justify-start gap-4 rounded-none border-0 bg-transparent p-0 xl:justify-end">
              <TabsTrigger value="sales" className={dashboardTabTriggerClass}>
                Sales
              </TabsTrigger>
              <TabsTrigger value="purchases" className={dashboardTabTriggerClass}>
                Purchases
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        <TabsContent value="sales" className="m-0">
          <RecentLedgerTable rows={sales} emptyKind="sales" />
        </TabsContent>
        <TabsContent value="purchases" className="m-0">
          <RecentLedgerTable rows={purchases} emptyKind="purchases" />
        </TabsContent>
      </DashboardCard>
    </Tabs>
  )
}

function RecentLedgerTable({
  rows,
  emptyKind,
}: {
  rows: DashboardRecentDocument[]
  emptyKind: "sales" | "purchases"
}) {
  const [sortKey, setSortKey] = React.useState<RecentDocumentSortKey>("date")
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc")
  const sortedRows = React.useMemo(
    () => sortRecentDocuments(rows, sortKey, sortDirection),
    [rows, sortDirection, sortKey]
  )

  function handleSort(nextKey: RecentDocumentSortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setSortKey(nextKey)
    setSortDirection(nextKey === "date" ? "desc" : "asc")
  }

  if (sortedRows.length === 0) {
    return (
      <DashboardEmpty
        icon={<ReceiptTextIcon className="size-4" />}
        title={`No recent ${emptyKind}`}
        description={`Posted ${emptyKind} will show here once transactions are created.`}
        actionHref={emptyKind === "sales" ? "/pos" : "/purchases"}
        actionLabel={emptyKind === "sales" ? "Create sale" : "Add purchase"}
      />
    )
  }

  return (
    <>
      <div className="app-scrollbar max-h-[332px] overflow-auto">
        <Table className={dashboardTableClass}>
          <colgroup>
            <col className="w-[13%]" />
            <col className="w-[16%]" />
            <col className="w-[22%]" />
            <col className="w-[11%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[13%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
            <TableRow className="hover:bg-transparent">
              <SortableDashboardHead
                sortKey="date"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                Date
              </SortableDashboardHead>
              <SortableDashboardHead
                sortKey="document"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                Document
              </SortableDashboardHead>
              <SortableDashboardHead
                sortKey="party"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                Party
              </SortableDashboardHead>
              <SortableDashboardHead
                sortKey="status"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              >
                Status
              </SortableDashboardHead>
              <SortableDashboardHead
                sortKey="total"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                align="right"
                onSort={handleSort}
              >
                Total
              </SortableDashboardHead>
              <SortableDashboardHead
                sortKey="paid"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                align="right"
                onSort={handleSort}
              >
                Paid
              </SortableDashboardHead>
              <SortableDashboardHead
                sortKey="due"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                align="right"
                onSort={handleSort}
              >
                Due
              </SortableDashboardHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground">
                  {formatDate(row.date)}
                </TableCell>
                <TableCell className="font-medium">{row.documentNumber}</TableCell>
                <TableCell className="truncate">{row.party}</TableCell>
                <TableCell>
                  <RecentStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatCurrency(row.total)}
                </TableCell>
                <TableCell className="text-right font-mono text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(row.paid)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono",
                    row.due > 0 && "font-semibold text-amber-700 dark:text-amber-300"
                  )}
                >
                  {formatCurrency(row.due)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground sm:px-5 lg:px-6">
        Showing {sortedRows.length} of {rows.length} recent {emptyKind}
      </div>
    </>
  )
}

function SortableDashboardHead<TSortKey extends string>({
  children,
  sortKey,
  activeSortKey,
  sortDirection,
  align = "left",
  onSort,
}: {
  children: React.ReactNode
  sortKey: TSortKey
  activeSortKey: TSortKey
  sortDirection: SortDirection
  align?: "left" | "right"
  onSort: (sortKey: TSortKey) => void
}) {
  const active = sortKey === activeSortKey
  const Icon = !active ? ArrowDownUpIcon : sortDirection === "asc" ? ArrowUpIcon : ArrowDownIcon

  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-md transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-primary" : "text-foreground",
          align === "right" && "ml-auto justify-end text-right"
        )}
        onClick={() => onSort(sortKey)}
      >
        <span className="truncate">{children}</span>
        <Icon className={cn("size-3 shrink-0", !active && "text-muted-foreground/70")} />
      </button>
    </TableHead>
  )
}

function RecentStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const className =
    normalized === "posted" || normalized === "paid" || normalized === "closed" ?
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
    : normalized === "draft" || normalized === "partial" ?
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
    : normalized === "cancelled" || normalized === "reversed" || normalized === "void" ?
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
    : "bg-background"

  return (
    <Badge variant="outline" className={cn("max-w-full truncate capitalize", className)}>
      {status}
    </Badge>
  )
}

function FilingStatusBadge({
  status,
  blocking,
  open,
}: {
  status: string
  blocking: number
  open: number
}) {
  if (status === "FILED" || status === "LOCKED" || status === "READY_FOR_SUBMISSION") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
      >
        <CheckCircle2Icon className="size-3.5" />
        Ready
      </Badge>
    )
  }

  if (blocking > 0 || open > 0) {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
      >
        <FileWarningIcon className="size-3.5" />
        Review
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="gap-1.5 bg-background">
      Not generated
    </Badge>
  )
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

function DashboardEmpty({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: React.ReactNode
  title: string
  description: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <Empty className="min-h-60 border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {actionHref && actionLabel ?
        <EmptyContent>
          <Button
            type="button"
            size="sm"
            nativeButton={false}
            render={<Link href={actionHref} />}
          >
            {actionLabel}
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </EmptyContent>
      : null}
    </Empty>
  )
}

function OverviewDashboardSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <Skeleton className="h-48 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.95fr)]">
        <Skeleton className="h-[420px] rounded-2xl" />
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  )
}

function sortLowStockItems(
  items: DashboardLowStockItem[],
  sortKey: LowStockSortKey,
  sortDirection: SortDirection
) {
  return [...items].sort((first, second) => {
    const direction = sortDirection === "asc" ? 1 : -1

    if (sortKey === "product") {
      return first.name.localeCompare(second.name) * direction
    }

    if (sortKey === "hsn") {
      return (first.hsnCode || "").localeCompare(second.hsnCode || "") * direction
    }

    const firstValue =
      sortKey === "quantity" ? numericValue(first.quantityOnHand)
      : sortKey === "reorder" ? numericValue(first.reorderLevel)
      : first.inventoryValue
    const secondValue =
      sortKey === "quantity" ? numericValue(second.quantityOnHand)
      : sortKey === "reorder" ? numericValue(second.reorderLevel)
      : second.inventoryValue

    return (firstValue - secondValue) * direction
  })
}

function sortRecentDocuments(
  rows: DashboardRecentDocument[],
  sortKey: RecentDocumentSortKey,
  sortDirection: SortDirection
) {
  return [...rows].sort((first, second) => {
    const direction = sortDirection === "asc" ? 1 : -1

    if (sortKey === "date") {
      return (Date.parse(first.date) - Date.parse(second.date)) * direction
    }

    if (sortKey === "document") {
      return first.documentNumber.localeCompare(second.documentNumber) * direction
    }

    if (sortKey === "party") {
      return first.party.localeCompare(second.party) * direction
    }

    if (sortKey === "status") {
      return first.status.localeCompare(second.status) * direction
    }

    const firstValue =
      sortKey === "total" ? first.total
      : sortKey === "paid" ? first.paid
      : first.due
    const secondValue =
      sortKey === "total" ? second.total
      : sortKey === "paid" ? second.paid
      : second.due

    return (firstValue - secondValue) * direction
  })
}

function numericValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function formatValue(value: number, kind: "currency" | "count") {
  return kind === "currency" ? formatCurrency(value) : value.toLocaleString("en-IN")
}

function formatDate(value: string) {
  if (!value) {
    return "-"
  }

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function formatQuantity(value: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return value
  }

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 3,
  }).format(parsed)
}
