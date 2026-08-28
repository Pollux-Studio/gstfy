"use client"

import { Badge } from "@/components/ui/badge"
import type { PartyStatus } from "@/lib/parties/api"
import { cn } from "@/lib/utils"
import { statusLabels } from "./party-types"

export function PartyStatusBadge({
  compact,
  status,
}: {
  compact?: boolean
  status: PartyStatus
}) {
  const statusClassName =
    status === "active" ?
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "inactive" ?
        "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "bg-muted text-muted-foreground"

  return (
    <Badge
      variant="secondary"
      className={cn(
        "border-transparent",
        compact ? "px-1 py-0 text-[10px]" : "px-2 py-0.5 text-xs",
        statusClassName
      )}
    >
      {statusLabels[status]}
    </Badge>
  )
}
