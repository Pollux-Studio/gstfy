"use client"

import { Badge } from "@/components/ui/badge"
import type {
  Gstr2bStatus,
  ItcEligibility,
  PaymentStatus,
  PurchaseBillStatus,
} from "@/lib/purchases/types"
import {
  gstr2bStatusLabels,
  itcEligibilityLabels,
  paymentStatusLabels,
} from "@/lib/purchases/utils"
import { cn } from "@/lib/utils"

export function PurchaseStatusBadge({ status }: { status: PurchaseBillStatus }) {
  return (
    <Badge
      variant={status === "draft" ? "secondary" : "outline"}
      className={cn(
        status === "saved" &&
          "bg-primary/10 text-primary dark:text-primary-foreground",
        status === "reconciled" &&
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      )}
    >
      {status === "draft" ? "Draft" : status === "saved" ? "Saved" : "Reconciled"}
    </Badge>
  )
}

export function PurchaseGstrBadge({ status }: { status: Gstr2bStatus }) {
  return (
    <Badge
      variant={status === "pending" ? "secondary" : "outline"}
      className={cn(
        status === "matched" &&
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        status === "unmatched" &&
          "bg-amber-500/10 text-amber-700 dark:text-amber-300",
        status === "rejected" &&
          "bg-destructive/10 text-destructive",
        status === "not_applicable" &&
          "bg-muted text-muted-foreground"
      )}
    >
      {gstr2bStatusLabels[status]}
    </Badge>
  )
}

export function PurchaseItcBadge({ eligibility }: { eligibility: ItcEligibility }) {
  return (
    <Badge
      variant={eligibility === "blocked" ? "destructive" : "outline"}
      className={cn(
        eligibility === "full" &&
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        eligibility === "partial" &&
          "bg-amber-500/10 text-amber-700 dark:text-amber-300"
      )}
    >
      {itcEligibilityLabels[eligibility]}
    </Badge>
  )
}

export function PurchasePaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge
      variant={status === "paid" ? "outline" : "secondary"}
      className={cn(
        status === "paid" &&
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        status === "partial" &&
          "bg-amber-500/10 text-amber-700 dark:text-amber-300"
      )}
    >
      {paymentStatusLabels[status]}
    </Badge>
  )
}
