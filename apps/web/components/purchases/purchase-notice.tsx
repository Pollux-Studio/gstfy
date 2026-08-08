"use client"

import { InfoIcon, TriangleAlertIcon, CircleCheckBigIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PurchaseModuleNotice } from "@/lib/purchases/types"
import { cn } from "@/lib/utils"

const noticeIconMap = {
  success: CircleCheckBigIcon,
  warning: TriangleAlertIcon,
  info: InfoIcon,
} as const

export function PurchaseNotice({
  notice,
  onDismiss,
}: {
  notice: PurchaseModuleNotice
  onDismiss: () => void
}) {
  const Icon = noticeIconMap[notice.variant]

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm",
        notice.variant === "success" &&
          "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100",
        notice.variant === "warning" &&
          "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
        notice.variant === "info" &&
          "border-border bg-card text-card-foreground"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-background/80">
          <Icon className="size-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{notice.title}</p>
          <p className="text-sm text-current/80">{notice.message}</p>
        </div>
      </div>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onDismiss}>
        <XIcon className="size-4" />
        <span className="sr-only">Dismiss message</span>
      </Button>
    </div>
  )
}
