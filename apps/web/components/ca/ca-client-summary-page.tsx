"use client"

import Link from "next/link"
import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  Building2Icon,
  FileTextIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getStoredAuthSession } from "@/lib/auth/session"
import { getCaClientSummary } from "@/lib/ca/api"

export function CaClientSummaryPage({ businessId }: { businessId: string }) {
  const [storedSession] = React.useState<ReturnType<
    typeof getStoredAuthSession
  >>(() => getStoredAuthSession())
  const accessToken = storedSession?.session.accessToken ?? ""
  const { data, isLoading, error } = useQuery({
    queryKey: ["ca", "client-summary", businessId],
    queryFn: () => getCaClientSummary(businessId, accessToken),
    enabled: accessToken.length > 0,
  })

  if (!storedSession || isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
        <section className="rounded-2xl border border-destructive/30 bg-card p-6">
          <h1 className="text-lg font-semibold">Client unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Unable to load this client."}
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 lg:p-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard" />}
        >
          <ArrowLeftIcon className="size-4" />
          CA clients
        </Button>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="gap-1.5">
              <ShieldCheckIcon className="size-3.5" />
              GST read/write access
            </Badge>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {data.business.legalName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {data.business.tradeName} • {data.business.branchCount} branch
                {data.business.branchCount === 1 ? "" : "es"}
              </p>
            </div>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {data.business.gstin ?? "GSTIN not added"}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<ReceiptTextIcon className="size-4" />}
          label="Monthly sales"
          value={formatCurrency(data.filingSnapshot.monthlySales)}
        />
        <SummaryCard
          icon={<Building2Icon className="size-4" />}
          label="Monthly purchases"
          value={formatCurrency(data.filingSnapshot.monthlyPurchases)}
        />
        <SummaryCard
          icon={<FileTextIcon className="size-4" />}
          label="Estimated GST payable"
          value={formatCurrency(data.filingSnapshot.estimatedTaxPayable)}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold">Pending filing work</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.filingSnapshot.pendingFilings.map((filing) => (
            <Badge key={filing} variant="outline">
              {filing}
            </Badge>
          ))}
        </div>
      </section>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-sm">{label}</p>
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold">{value}</p>
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
