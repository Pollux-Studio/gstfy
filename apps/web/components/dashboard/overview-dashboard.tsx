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
  UserPlusIcon,
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
  getDashboardLowStock,
  getDashboardRecentActivity,
  type BusinessDashboardOverview,
  type DashboardLowStockItem,
  type DashboardRecentDocument,
  type RevenueStatisticPoint,
} from "@/lib/dashboard/api"
import { cn } from "@/lib/utils"

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const noDecimalCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const compactFormatter = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
})

const compactCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
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
        <Skeleton className="size-28 rounded-full" />
      </div>
    ),
  }
)

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
  const lowStockQuery = useQuery({
    queryKey: ["dashboard", "low-stock", userId],
    queryFn: () => getDashboardLowStock(accessToken, 10),
    enabled: accessToken.length > 0 && userId.length > 0,
    staleTime: 1000 * 60,
  })
  const recentActivityQuery = useQuery({
    queryKey: ["dashboard", "recent-activity", userId],
    queryFn: () => getDashboardRecentActivity(accessToken, 3),
    enabled: accessToken.length > 0 && userId.length > 0,
    staleTime: 1000 * 60,
  })

  if (!storedSession || isLoading || !data) {
    return <OverviewDashboardSkeleton />
  }

  const lowStockItems = lowStockQuery.data?.items ?? []
  const lowStockTotalCount = Math.max(
    lowStockQuery.data?.totalCount ?? data.summary.lowStockCount,
    lowStockItems.length
  )

  return (
    <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <DashboardBentoSection data={data} />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <LowStockSection  
          items={lowStockItems}
          totalCount={lowStockTotalCount}
          isLoading={lowStockQuery.isLoading}
        />

        <RecentActivitySection
          sales={recentActivityQuery.data?.sales ?? []}
          purchases={recentActivityQuery.data?.purchases ?? []}
          isLoading={recentActivityQuery.isLoading}
        />
      </div>
    </div>
  )
})

function DashboardBentoSection({ data }: { data: BusinessDashboardOverview }) {
  const primaryMixItems = data.mix.slice(0, 2)
  const secondaryMixItems = data.mix.slice(2)
  const revenueTrend = getRevenueTrend(data.trend)

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6 xl:auto-rows-[104px] xl:grid-flow-row-dense">
      <BentoTile tone="workspace" className="xl:col-span-2 xl:row-span-2">
        <div className="flex h-full flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="h-5 gap-1 bg-white/70 px-1.5 text-[10px]">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Live
              </Badge>
              <Badge className="h-5 gap-1 bg-blue-600 px-1.5 text-[10px] text-white">
                <Layers3Icon className="size-2.5" />
                {data.period.label}
              </Badge>
              {data.business.gstin ?
                <Badge
                  variant="outline"
                  className="h-5 bg-white/70 px-1.5 font-mono text-[9px] tracking-[0.1em]"
                >
                  {data.business.gstin}
                </Badge>
              : null}
            </div>
            <div className="space-y-1">
              <h1 className="line-clamp-2 text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">
                {data.business.name}
              </h1>
              <p className="line-clamp-2 max-w-md text-xs leading-4 text-slate-600">
                One view for money, GST, stock, and latest business movement.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {quickActions.map((action) => {
              const Icon = action.icon

              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="group/action flex h-7 items-center justify-between gap-1.5 rounded-lg border border-white/70 bg-white/70 px-2 text-[11px] font-medium text-slate-800 no-underline backdrop-blur transition-colors hover:bg-white"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Icon className="size-3 shrink-0 text-blue-700" />
                    <span className="truncate">{action.label}</span>
                  </span>
                  <ArrowRightIcon className="size-3 shrink-0 text-slate-400 transition-transform group-hover/action:translate-x-0.5" />
                </Link>
              )
            })}
          </div>
        </div>
      </BentoTile>

      <BentoMetricTile
        href="/sales"
        icon={StoreIcon}
        label="Sales"
        note="Posted bills"
        tone="sales"
        value={formatCompactCurrency(data.summary.sales)}
      />
      <BentoMetricTile
        href="/purchases"
        icon={ShoppingCartIcon}
        label="Purchases"
        note="Supplier bills"
        tone="purchase"
        value={formatCompactCurrency(data.summary.purchases)}
      />
      <BentoMetricTile
        href="/accounting"
        icon={WalletIcon}
        label="Net profit"
        note="Books derived"
        tone={data.summary.netProfit >= 0 ? "profit" : "danger"}
        value={formatCompactCurrency(data.summary.netProfit)}
      />

      <BentoTile href="/gst" tone="gst" className="xl:row-span-2">
        <div className="flex h-full flex-col justify-between gap-2.5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-1.5">
              <span className="flex size-7 items-center justify-center rounded-lg bg-white/70 text-blue-700">
                <ReceiptTextIcon className="size-3.5" />
              </span>
              <FilingStatusBadge
                status={data.filingReadiness.status}
                blocking={data.filingReadiness.blockingExceptions}
                open={data.filingReadiness.openExceptions}
              />
            </div>
            <div>
              <p className="text-xs font-medium text-blue-950/70">GST readiness</p>
              <p className="mt-0.5 truncate text-base font-semibold text-blue-950">
                {data.filingReadiness.period ?? "Not generated"}
              </p>
            </div>
          </div>
          <div className="grid gap-1.5 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-white/65 px-2 py-1.5 text-blue-950">
              <span>Exceptions</span>
              <span className="font-mono font-semibold">
                {data.filingReadiness.openExceptions}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white/65 px-2 py-1.5 text-blue-950">
              <span>Payable</span>
              <span className="font-mono font-semibold">
                {formatCompactCurrency(data.summary.estimatedTaxPayable)}
              </span>
            </div>
          </div>
        </div>
      </BentoTile>

      <BentoMetricTile
        href="/receivables"
        icon={BadgeIndianRupeeIcon}
        label="Receivable"
        note="To collect"
        tone="receivable"
        value={formatCompactCurrency(data.summary.receivables)}
      />
      <BentoMetricTile
        href="/payables"
        icon={TruckIcon}
        label="Payable"
        note="To vendors"
        tone="payable"
        value={formatCompactCurrency(data.summary.payables)}
      />
      <BentoMetricTile
        href="/inventory"
        icon={PackageSearchIcon}
        label="Stock value"
        note={`${formatCompactNumber(data.summary.skuCount)} SKUs`}
        tone="stock"
        value={formatCompactCurrency(data.summary.inventoryValue)}
      />

      <BentoTile tone="chart" className="p-0 xl:col-span-4 xl:row-span-3">
        <div className="flex h-full min-h-[336px] flex-col">
          <div className="border-b border-border/70 px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Revenue trend</h2>
                <p className="truncate text-xs text-muted-foreground">
                  Sales, purchases, and income by month.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="h-7 gap-1.5 bg-background/70 text-xs"
                >
                  <ShoppingBagIcon className="size-3.5" />
                  {formatCompactCurrency(data.summary.sales)}
                </Badge>
                <RevenueTrendBadge trend={revenueTrend} />
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 px-2 py-3 sm:px-4">
            <OverviewRevenueChart data={data.trend} />
          </div>
        </div>
      </BentoTile>

      <BentoTile tone="mix" className="xl:col-span-2 xl:row-span-3">
        <div className="flex h-full min-h-[336px] flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Business mix</h2>
              <p className="text-xs text-slate-600">Value split for this period.</p>
            </div>
            <span className="flex size-7 items-center justify-center rounded-lg bg-white/70 text-sky-700">
              <ArrowDownUpIcon className="size-3.5" />
            </span>
          </div>
          {data.mix.length > 0 ?
            <>
              <div className="grid grid-cols-[minmax(150px,1fr)_minmax(0,1fr)] items-center gap-2">
                <OverviewReportsPieChart
                  data={data.mix}
                  className="justify-self-center"
                  innerRadius={38}
                  minHeight={150}
                  minWidth={150}
                  outerRadius={62}
                />
                <div className="grid gap-1.5">
                  {primaryMixItems.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-white/70 bg-white/65 px-2 py-1.5 text-[11px] text-slate-700 backdrop-blur"
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: item.fill }}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <p className="mt-0.5 font-mono text-xs font-semibold text-slate-950">
                        {formatCompactCurrency(item.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {secondaryMixItems.length > 0 ?
                <div className="grid grid-cols-2 gap-1.5">
                  {secondaryMixItems.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-white/70 bg-white/65 px-2 py-1.5 text-[11px] text-slate-700 backdrop-blur"
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: item.fill }}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <p className="mt-0.5 font-mono text-xs font-semibold text-slate-950">
                        {formatCompactCurrency(item.value)}
                      </p>
                    </div>
                  ))}
                </div>
              : null}
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <div className="flex items-center justify-between gap-2 rounded-lg border border-white/70 bg-white/55 px-2 py-1.5 text-[11px] text-slate-600">
                  <span className="truncate">Customers</span>
                  <span className="shrink-0 font-mono text-xs font-semibold text-slate-950">
                    {formatCompactNumber(data.summary.customers)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-white/70 bg-white/55 px-2 py-1.5 text-[11px] text-slate-600">
                  <span className="truncate">Suppliers</span>
                  <span className="shrink-0 font-mono text-xs font-semibold text-slate-950">
                    {formatCompactNumber(data.summary.suppliers)}
                  </span>
                </div>
              </div>
            </>
          : <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-sky-200 bg-white/55 p-4 text-center">
              <ReceiptTextIcon className="size-7 text-sky-700" />
              <p className="mt-2 text-sm font-medium text-slate-950">
                No posted business yet
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Create a sale or purchase to see the split.
              </p>
            </div>}
        </div>
      </BentoTile>
    </section>
  )
}

function BentoMetricTile({
  href,
  icon: Icon,
  label,
  note,
  tone,
  value,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  note: string
  tone: BentoTone
  value: string
}) {
  return (
    <BentoTile href={href} tone={tone}>
      <div className="flex h-full flex-col justify-between gap-2 pb-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-slate-700">{label}</p>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/70 text-slate-800">
            <Icon className="size-3.5" />
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate font-mono text-lg font-semibold leading-tight tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-1 truncate text-xs leading-4 text-slate-600">{note}</p>
        </div>
      </div>
    </BentoTile>
  )
}

type RevenueTrend = {
  direction: "up" | "down" | "flat"
  percent: number
}

function RevenueTrendBadge({ trend }: { trend: RevenueTrend | null }) {
  const direction = trend?.direction ?? "flat"
  const Icon =
    direction === "up" ? ArrowUpIcon
    : direction === "down" ? ArrowDownIcon
    : ArrowDownUpIcon

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-7 gap-1 bg-background/70 px-2 text-[11px]",
        direction === "up" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        direction === "down" && "border-red-200 bg-red-50 text-red-700"
      )}
    >
      <Icon className="size-3" />
      {trend ? `${formatTrendPercentage(trend.percent)} ${direction}` : "No trend"}
    </Badge>
  )
}

type BentoTone =
  | "workspace"
  | "sales"
  | "purchase"
  | "profit"
  | "danger"
  | "gst"
  | "receivable"
  | "payable"
  | "stock"
  | "chart"
  | "mix"

const bentoToneClassNames = {
  workspace:
    "border-blue-200/70 bg-[radial-gradient(circle_at_0%_0%,rgba(37,99,235,0.22),transparent_44%),linear-gradient(135deg,rgba(239,246,255,0.98),rgba(255,255,255,0.96))]",
  sales:
    "border-emerald-200/70 bg-[radial-gradient(circle_at_100%_0%,rgba(16,185,129,0.22),transparent_44%),linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.96))]",
  purchase:
    "border-amber-200/70 bg-[radial-gradient(circle_at_100%_0%,rgba(245,158,11,0.22),transparent_44%),linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.96))]",
  profit:
    "border-teal-200/70 bg-[radial-gradient(circle_at_100%_0%,rgba(20,184,166,0.2),transparent_42%),linear-gradient(135deg,rgba(240,253,250,0.98),rgba(255,255,255,0.96))]",
  danger:
    "border-red-200/70 bg-[radial-gradient(circle_at_100%_0%,rgba(239,68,68,0.18),transparent_42%),linear-gradient(135deg,rgba(254,242,242,0.98),rgba(255,255,255,0.96))]",
  gst:
    "border-blue-200/70 bg-[radial-gradient(circle_at_100%_0%,rgba(59,130,246,0.2),transparent_42%),linear-gradient(135deg,rgba(239,246,255,0.98),rgba(255,255,255,0.96))]",
  receivable:
    "border-cyan-200/70 bg-[radial-gradient(circle_at_100%_0%,rgba(6,182,212,0.2),transparent_42%),linear-gradient(135deg,rgba(236,254,255,0.98),rgba(255,255,255,0.96))]",
  payable:
    "border-orange-200/70 bg-[radial-gradient(circle_at_100%_0%,rgba(249,115,22,0.2),transparent_42%),linear-gradient(135deg,rgba(255,247,237,0.98),rgba(255,255,255,0.96))]",
  stock:
    "border-indigo-200/70 bg-[radial-gradient(circle_at_100%_0%,rgba(99,102,241,0.2),transparent_42%),linear-gradient(135deg,rgba(238,242,255,0.98),rgba(255,255,255,0.96))]",
  chart:
    "border-border bg-card",
  mix:
    "border-sky-200/70 bg-[radial-gradient(circle_at_0%_0%,rgba(14,165,233,0.18),transparent_44%),linear-gradient(135deg,rgba(240,249,255,0.98),rgba(255,255,255,0.96))]",
} as const satisfies Record<BentoTone, string>

function BentoTile({
  children,
  className,
  href,
  tone,
}: {
  children: React.ReactNode
  className?: string
  href?: string
  tone: BentoTone
}) {
  const tileClassName = cn(
    "relative block min-h-[104px] overflow-hidden rounded-2xl border p-3 text-card-foreground no-underline",
    bentoToneClassNames[tone],
    className
  )

  if (href) {
    return (
      <Link href={href} className={tileClassName}>
        {children}
      </Link>
    )
  }

  return <section className={tileClassName}>{children}</section>
}

function LowStockSection({
  items,
  isLoading,
  totalCount,
}: {
  items: DashboardLowStockItem[]
  isLoading: boolean
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
      <DashboardCard className="h-full overflow-hidden">
        <div className="border-b border-border px-3 py-2.5 sm:px-4">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-sm font-semibold">{activeCopy.title}</h2>
              <p className="line-clamp-1 max-w-xl text-xs text-muted-foreground">
                {activeCopy.description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              <TabsList className="h-auto flex-wrap justify-start gap-3 rounded-none border-0 bg-transparent p-0 xl:justify-end">
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
              <Badge className="h-6 gap-1 bg-amber-500/10 px-2 text-[11px] text-amber-700 dark:text-amber-300">
                <FileWarningIcon className="size-3" />
                {totalCount} items
              </Badge>
            </div>
          </div>
        </div>
        <TabsContent value="all" className="m-0">
          <LowStockTable items={items} emptyKind="all" isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="reorder" className="m-0">
          <LowStockTable
            items={reorderItems}
            emptyKind="reorder"
            isLoading={isLoading}
          />
        </TabsContent>
        <TabsContent value="negative" className="m-0">
          <LowStockTable
            items={negativeItems}
            emptyKind="negative"
            isLoading={isLoading}
          />
        </TabsContent>
      </DashboardCard>
    </Tabs>
  )
}

function LowStockTable({
  items,
  emptyKind,
  isLoading,
}: {
  items: DashboardLowStockItem[]
  emptyKind: "all" | "reorder" | "negative"
  isLoading: boolean
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

  if (isLoading) {
    return <DashboardTableSkeleton columns={5} rows={3} />
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
      <div className="app-scrollbar max-h-[158px] overflow-auto">
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
                  <span className="block truncate">
                    {formatNoDecimalCurrency(item.inventoryValue)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground sm:px-5 lg:px-6">
        Showing {sortedItems.length} of {items.length} stock alerts
      </div>
    </>
  )
}

function RecentActivitySection({
  isLoading,
  sales,
  purchases,
}: {
  isLoading: boolean
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
      <DashboardCard className="h-full overflow-hidden">
        <div className="border-b border-border px-3 py-2.5 sm:px-4">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-sm font-semibold">{activeCopy.title}</h2>
              <p className="line-clamp-1 max-w-xl text-xs text-muted-foreground">
                {activeCopy.description}
              </p>
            </div>
            <TabsList className="h-auto flex-wrap justify-start gap-3 rounded-none border-0 bg-transparent p-0 xl:justify-end">
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
          <RecentLedgerTable rows={sales} emptyKind="sales" isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="purchases" className="m-0">
          <RecentLedgerTable
            rows={purchases}
            emptyKind="purchases"
            isLoading={isLoading}
          />
        </TabsContent>
      </DashboardCard>
    </Tabs>
  )
}

function RecentLedgerTable({
  rows,
  emptyKind,
  isLoading,
}: {
  rows: DashboardRecentDocument[]
  emptyKind: "sales" | "purchases"
  isLoading: boolean
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

  if (isLoading) {
    return <DashboardTableSkeleton columns={7} rows={3} />
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
      <div className="app-scrollbar max-h-[168px] overflow-auto">
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
                <TableCell className="font-medium">
                  <span className="block truncate">{row.documentNumber}</span>
                </TableCell>
                <TableCell className="truncate">{row.party}</TableCell>
                <TableCell>
                  <RecentStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  <span className="block truncate">
                    {formatNoDecimalCurrency(row.total)}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-emerald-700 dark:text-emerald-300">
                  <span className="block truncate">
                    {formatNoDecimalCurrency(row.paid)}
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono",
                    row.due > 0 && "font-semibold text-amber-700 dark:text-amber-300"
                  )}
                >
                  <span className="block truncate">
                    {formatNoDecimalCurrency(row.due)}
                  </span>
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

function DashboardTableSkeleton({
  columns,
  rows,
}: {
  columns: number
  rows: number
}) {
  return (
    <div className="app-scrollbar max-h-[168px] overflow-hidden">
      <Table className={dashboardTableClass}>
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: columns }).map((_, index) => (
              <TableHead key={index}>
                <Skeleton className="h-3 w-14" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columns }).map((_, columnIndex) => (
                <TableCell key={columnIndex}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
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
    <Empty className="mx-auto min-h-[150px] max-w-xs gap-2 border-0 px-3 py-3">
      <EmptyHeader className="gap-1.5">
        <EmptyMedia variant="icon" className="mb-0 size-7">
          {icon}
        </EmptyMedia>
        <EmptyTitle className="text-xs">{title}</EmptyTitle>
        <EmptyDescription className="text-xs/5">{description}</EmptyDescription>
      </EmptyHeader>
      {actionHref && actionLabel ?
        <EmptyContent className="gap-1.5">
          <Button
            type="button"
            size="sm"
            className="h-7 px-2 text-xs"
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

function formatNoDecimalCurrency(value: number) {
  return noDecimalCurrencyFormatter.format(value)
}

function formatCompactCurrency(value: number) {
  return compactCurrencyFormatter.format(value)
}

function formatCompactNumber(value: number) {
  return compactFormatter.format(value)
}

function getRevenueTrend(data: RevenueStatisticPoint[]): RevenueTrend | null {
  if (data.length < 2) {
    return null
  }

  const current = data[data.length - 1]?.sales ?? 0
  const previous = data[data.length - 2]?.sales ?? 0

  if (previous === 0 && current === 0) {
    return { direction: "flat", percent: 0 }
  }

  if (previous === 0) {
    return { direction: "up", percent: 100 }
  }

  const change = ((current - previous) / Math.abs(previous)) * 100

  return {
    direction:
      change > 0.05 ? "up"
      : change < -0.05 ? "down"
      : "flat",
    percent: Math.abs(change),
  }
}

function formatTrendPercentage(value: number) {
  const fractionDigits = value >= 10 || value === 0 ? 0 : 1

  return `${value.toFixed(fractionDigits)}%`
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
