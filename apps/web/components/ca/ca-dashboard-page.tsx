"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  BriefcaseBusinessIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  KeyRoundIcon,
  ReceiptTextIcon,
  TriangleAlertIcon,
  UsersRoundIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import {
  getStoredAuthSession,
  subscribeToAuthSessionChange,
} from "@/lib/auth/session"
import {
  getCaDashboardOverview,
  type CaDashboardClientReadiness,
} from "@/lib/dashboard/api"

export function CaDashboardPage() {
  const storedSession = React.useSyncExternalStore(
    subscribeToAuthSessionChange,
    getStoredAuthSession,
    () => null
  )
  const userId = storedSession?.user.id ?? ""
  const accessToken = storedSession?.session.accessToken ?? ""

  const { data, isLoading, error } = useQuery({
    queryKey: ["ca", "dashboard", userId],
    queryFn: () => getCaDashboardOverview(accessToken),
    enabled: accessToken.length > 0 && userId.length > 0,
    staleTime: 1000 * 60 * 3,
  })

  if (!storedSession || isLoading) {
    return <CaDashboardSkeleton />
  }

  if (!data) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
        <section className="rounded-2xl border border-destructive/30 bg-card p-6">
          <h1 className="text-lg font-semibold">CA dashboard unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {getErrorMessage(error) || "Unable to load CA filing data right now."}
          </p>
        </section>
      </div>
    )
  }

  const filingQueue = data.clientReadiness
  const readyQueue = filingQueue.filter((item) => item.readinessStatus === "ready")
  const reviewQueue = filingQueue.filter((item) => item.readinessStatus !== "ready")

  return (
    <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-6">
          <div className="space-y-4">
            <Badge variant="outline" className="w-fit gap-1.5 bg-background/80">
              <BriefcaseBusinessIcon className="size-3.5" />
              CA filing workspace
            </Badge>
            <div className="max-w-3xl space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                GST filing control room
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                Track which client data is ready to extract, which GST returns need
                review, and which workspaces require action before filing.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                nativeButton={false}
                render={<Link href="/dashboard/clients" />}
              >
                <UsersRoundIcon className="size-4" />
                Manage clients
              </Button>
              <Button
                type="button"
                variant="outline"
                nativeButton={false}
                render={<Link href="/dashboard/referral-codes" />}
              >
                <KeyRoundIcon className="size-4" />
                Referral codes
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/25 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Current filing period
                </p>
                <p className="mt-1 text-xl font-semibold">{data.period.label}</p>
              </div>
              <ReceiptTextIcon className="size-8 text-muted-foreground" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <DeadlinePill label="GSTR-1" date={formatDate(data.deadlines.gstr1)} />
              <DeadlinePill label="GSTR-3B" date={formatDate(data.deadlines.gstr3b)} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric
          icon={<UsersRoundIcon className="size-4" />}
          label="Active clients"
          value={data.summary.activeClientsTotal}
          helper="Linked businesses ready for CA access"
        />
        <DashboardMetric
          icon={<DownloadIcon className="size-4" />}
          label="Data extracts ready"
          value={data.summary.readyClientsTotal}
          helper="Client workspaces ready to download"
        />
        <DashboardMetric
          icon={<CalendarClockIcon className="size-4" />}
          label="Returns due"
          value={data.summary.returnsDueTotal}
          helper="GSTR-1 and GSTR-3B for this period"
        />
        <DashboardMetric
          icon={<TriangleAlertIcon className="size-4" />}
          label="Needs action"
          value={reviewQueue.length + data.summary.pendingInvitesTotal}
          helper="Review gaps plus pending onboarding"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Extraction pipeline</h2>
                <p className="text-sm text-muted-foreground">
                  Download the records needed to prepare GST filing workpapers.
                </p>
              </div>
              <Badge variant="outline" className="w-fit">
                {readyQueue.length} ready
              </Badge>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {[
              {
                title: "Sales register",
                description: "B2B, B2C, taxable value, and tax split for GSTR-1.",
                icon: <FileSpreadsheetIcon className="size-4" />,
              },
              {
                title: "Purchase and ITC",
                description: "Supplier invoices, eligible ITC, and mismatch checks.",
                icon: <DatabaseIcon className="size-4" />,
              },
              {
                title: "GSTR-1 JSON",
                description: "Portal-ready outward supplies extract for filing.",
                icon: <ReceiptTextIcon className="size-4" />,
              },
              {
                title: "GSTR-3B worksheet",
                description: "Tax payable, ITC claim, and cash liability summary.",
                icon: <FileTextIcon className="size-4" />,
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-border p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    {item.icon}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-sm font-medium">{item.title}</h3>
                    <p className="text-sm leading-5 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => toast.success(`${item.title} export queued.`)}
                >
                  <DownloadIcon className="size-3.5" />
                  Export
                </Button>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <CalendarClockIcon className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Filing focus</h2>
          </div>
          <div className="mt-4 space-y-3">
            <FocusItem
              label="GSTR-1"
              value={`Due ${formatShortDate(data.deadlines.gstr1)}`}
              tone="warning"
              description="Export outward supplies and HSN summary before filing."
            />
            <FocusItem
              label="GSTR-3B"
              value={`Due ${formatShortDate(data.deadlines.gstr3b)}`}
              tone="success"
              description="Confirm ITC, tax payable, and challan amount."
            />
            <FocusItem
              label="Client onboarding"
              value={`${data.summary.pendingInvitesTotal} pending`}
              tone="neutral"
              description="Pending referral codes still need business acceptance."
            />
          </div>
        </aside>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Client filing queue</h2>
              <p className="text-sm text-muted-foreground">
                Open a client workspace or export the current period records.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/dashboard/clients" />}
            >
              View all clients
              <ExternalLinkIcon className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="app-scrollbar overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Client</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="w-48 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filingQueue.length > 0 ?
                filingQueue.slice(0, 6).map((item) => (
                  <TableRow key={item.client.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{item.client.businessName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.client.tradeName}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs uppercase tracking-[0.18em]">
                      {item.client.gstin ?? "Not added"}
                    </TableCell>
                    <TableCell>{item.period}</TableCell>
                    <TableCell>
                      <FilingStatusBadge status={item.readinessStatus} />
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.salesAmount)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.purchaseAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={
                            <Link href={`/dashboard/clients/${item.client.businessId}`} />
                          }
                        >
                          Open
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toast.success(`${item.client.tradeName} export queued.`)
                          }
                        >
                          <DownloadIcon className="size-3.5" />
                          Export
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Add clients to start preparing GST filing extracts.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}

function DashboardMetric({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode
  label: string
  value: number
  helper: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </span>
        <p className="font-mono text-2xl font-semibold">{value}</p>
      </div>
      <p className="mt-3 text-sm font-medium">{label}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p>
    </div>
  )
}

function DeadlinePill({ label, date }: { label: string; date: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{date}</p>
    </div>
  )
}

function FocusItem({
  label,
  value,
  description,
  tone,
}: {
  label: string
  value: string
  description: string
  tone: "success" | "warning" | "neutral"
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <Badge
          variant="outline"
          className={
            tone === "success" ?
              "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
            : tone === "warning" ?
              "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
            : "bg-background"
          }
        >
          {value}
        </Badge>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  )
}

function FilingStatusBadge({
  status,
}: {
  status: CaDashboardClientReadiness["readinessStatus"]
}) {
  if (status === "ready") {
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

  if (status === "missing-gstin") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
      >
        <TriangleAlertIcon className="size-3.5" />
        GSTIN missing
      </Badge>
    )
  }

  if (status === "blocked") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-destructive/30 bg-destructive/10 text-destructive"
      >
        <TriangleAlertIcon className="size-3.5" />
        Blocked
      </Badge>
    )
  }

  if (status === "no-data") {
    return (
      <Badge variant="outline" className="gap-1.5 bg-background">
        <TriangleAlertIcon className="size-3.5" />
        No data
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="gap-1.5 bg-background">
      <TriangleAlertIcon className="size-3.5" />
      Review
    </Badge>
  )
}

function CaDashboardSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <Skeleton className="h-48 rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string) {
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

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(date)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}
