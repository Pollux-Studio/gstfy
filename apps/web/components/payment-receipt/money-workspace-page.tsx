"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowDownLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BadgeIndianRupeeIcon,
  ClipboardCheckIcon,
  HandCoinsIcon,
  ReceiptTextIcon,
  WalletCardsIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  getAgingReport,
  getCashFlowReport,
  listBankReconciliation,
} from "@/lib/payment-receipt/api"
import { cn } from "@/lib/utils"

const moneyActions = [
  {
    title: "Money in",
    description: "Record customer payment and settle sales invoices.",
    href: "/receipts",
    action: "Record money in",
    icon: ArrowDownLeftIcon,
    tone: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900/60",
  },
  {
    title: "Money out",
    description: "Record supplier payment and settle purchase bills.",
    href: "/payments",
    action: "Record money out",
    icon: ArrowUpRightIcon,
    tone: "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/40 dark:border-red-900/60",
  },
  {
    title: "Customer dues",
    description: "See who has to pay you and follow up faster.",
    href: "/receivables",
    action: "View customers",
    icon: ReceiptTextIcon,
    tone: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-900/60",
  },
  {
    title: "Supplier dues",
    description: "See what you have to pay and avoid missed bills.",
    href: "/payables",
    action: "View suppliers",
    icon: HandCoinsIcon,
    tone: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-900/60",
  },
  {
    title: "Match statement",
    description: "Import statement rows and match them with recorded money movement.",
    href: "/bank-reconciliation",
    action: "Match entries",
    icon: ClipboardCheckIcon,
    tone: "text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-300 dark:bg-cyan-950/40 dark:border-cyan-900/60",
  },
]

export function MoneyWorkspacePage() {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""

  const cashFlowQuery = useQuery({
    queryKey: ["money", "workspace", "cash-flow"],
    queryFn: () => getCashFlowReport(accessToken),
    enabled: accessToken.length > 0,
  })
  const receivableAgingQuery = useQuery({
    queryKey: ["money", "workspace", "aging", "receivable"],
    queryFn: () => getAgingReport(accessToken, "receivable"),
    enabled: accessToken.length > 0,
  })
  const payableAgingQuery = useQuery({
    queryKey: ["money", "workspace", "aging", "payable"],
    queryFn: () => getAgingReport(accessToken, "payable"),
    enabled: accessToken.length > 0,
  })
  const statementMatchQuery = useQuery({
    queryKey: ["money", "workspace", "statement-match"],
    queryFn: () => listBankReconciliation(accessToken, { status: "unmatched" }),
    enabled: accessToken.length > 0,
  })

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 bg-background">
                <BadgeIndianRupeeIcon className="size-3.5" />
                Money
              </Badge>
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <span className="size-1.5 rounded-full bg-current" />
                Auto from invoices and purchases
              </Badge>
            </div>
            <div className="mt-3 max-w-2xl space-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Money
              </h1>
              <p className="max-w-xl text-sm leading-5 text-muted-foreground">
                One place for customer payments, supplier payments, dues, statement
                matching, and reports.
              </p>
            </div>
          </div>
          <div className="border-t border-border bg-muted/10 p-4 sm:p-5 lg:border-l lg:border-t-0">
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-muted p-2 text-muted-foreground">
                  <WalletCardsIcon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Suggested daily flow</p>
                  <p className="text-xs text-muted-foreground">
                    Record money only when cash, UPI, cheque, or transfer is received or paid.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MoneyMetric
          label="Money in"
          value={formatCurrency(cashFlowQuery.data?.totals.receipts ?? "0")}
          loading={cashFlowQuery.isLoading}
          tone="positive"
        />
        <MoneyMetric
          label="Money out"
          value={formatCurrency(cashFlowQuery.data?.totals.payments ?? "0")}
          loading={cashFlowQuery.isLoading}
          tone="danger"
        />
        <MoneyMetric
          label="Customer dues"
          value={formatCurrency(receivableAgingQuery.data?.totals.outstanding ?? "0")}
          loading={receivableAgingQuery.isLoading}
          tone="warning"
        />
        <MoneyMetric
          label="Supplier dues"
          value={formatCurrency(payableAgingQuery.data?.totals.outstanding ?? "0")}
          loading={payableAgingQuery.isLoading}
          tone="muted"
        />
        <MoneyMetric
          label="Unmatched"
          value={String(statementMatchQuery.data?.totals.count ?? 0)}
          loading={statementMatchQuery.isLoading}
          tone={(statementMatchQuery.data?.totals.count ?? 0) > 0 ? "warning" : "positive"}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {moneyActions.map((item) => {
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-muted/20"
            >
              <div className="flex h-full flex-col gap-4">
                <div className="flex items-start gap-3">
                  <span className={cn("rounded-xl border p-2", item.tone)}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-sm font-semibold">{item.title}</h2>
                    <p className="text-sm leading-5 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
                <span className="mt-auto inline-flex h-8 w-fit items-center gap-1.5 text-sm font-medium text-primary">
                  {item.action}
                  <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          )
        })}
      </section>
    </main>
  )
}

function MoneyMetric({
  label,
  value,
  loading,
  tone,
}: {
  label: string
  value: string
  loading: boolean
  tone: "positive" | "danger" | "warning" | "muted"
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {loading ?
        <Skeleton className="mt-2 h-6 w-28" />
      : <p
          className={cn(
            "mt-2 truncate font-mono text-lg font-semibold",
            tone === "positive" && "text-emerald-700 dark:text-emerald-300",
            tone === "danger" && "text-red-700 dark:text-red-300",
            tone === "warning" && "text-amber-700 dark:text-amber-300",
            tone === "muted" && "text-foreground"
          )}
        >
          {value}
        </p>}
    </div>
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
