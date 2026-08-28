"use client"

import { useQuery } from "@tanstack/react-query"
import { CheckCircle2Icon, RefreshCwIcon } from "lucide-react"

import { StatusDot } from "@/components/ui/status-dot"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getServiceHealth, type ServiceHealth, type ServiceStatus } from "@/lib/service-status/api"

const serviceStatusQueryKey = ["service-health"] as const

export function ServiceStatusCenter() {
  const serviceHealthQuery = useQuery({
    queryKey: serviceStatusQueryKey,
    queryFn: getServiceHealth,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const response = serviceHealthQuery.data
  const overallStatus: ServiceStatus = serviceHealthQuery.isError ?
    "unavailable"
  : response?.status ?? "degraded"

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="group inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={`Service status: ${formatStatus(overallStatus)}`}
          />
        }
      >
        <StatusDot
          aria-hidden="true"
          size="sm"
          state={getStatusDotState(overallStatus)}
          tone={overallStatus === "degraded" ? "warning" : undefined}
        />
        <CompactStatusLabel status={overallStatus} hideOnMobile />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(calc(100vw-1.5rem),21rem)] overflow-hidden p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <StatusDot
              aria-hidden="true"
              size="sm"
              state={getStatusDotState(overallStatus)}
              tone={overallStatus === "degraded" ? "warning" : undefined}
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-4">Service status</p>
              <p className="truncate text-[11px] leading-4 text-muted-foreground">
                {serviceHealthQuery.isLoading ? "Checking services..." : <CompactStatusLabel status={overallStatus} />}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            aria-label="Refresh service status"
            onClick={() => void serviceHealthQuery.refetch()}
          >
            <RefreshCwIcon className={serviceHealthQuery.isFetching ? "size-3 animate-spin" : "size-3"} />
          </Button>
        </div>

        <div className="px-3.5 py-2.5">
          {serviceHealthQuery.isError ? (
            <div className="px-1 py-2 text-xs leading-5 text-destructive">
              Unable to reach the service health endpoint. Try again shortly.
            </div>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-border/70">
              <div className="pr-3">
                {response?.services.filter((_, index) => index % 2 === 0).map((service) => (
                  <ServiceStatusRow key={service.key} service={service} />
                ))}
              </div>
              <div className="pl-3">
                {response?.services.filter((_, index) => index % 2 === 1).map((service) => (
                  <ServiceStatusRow key={service.key} service={service} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          <CheckCircle2Icon className="size-3.5" />
          {response ? `Checked ${formatCheckedAt(response.checkedAt)}` : "Waiting for first check"}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ServiceStatusRow({ service }: { service: ServiceHealth }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 border-b border-border/60 py-2 last:border-b-0">
      <StatusDot
        size="sm"
        state={getStatusDotState(service.status)}
        tone={service.status === "degraded" ? "warning" : undefined}
        label={`${service.label}: ${formatStatus(service.status)}`}
      />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{service.label}</span>
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
        {service.latencyMs === null ? service.message ?? "Unavailable" : `${service.latencyMs} ms`}
      </span>
    </div>
  )
}

function getStatusDotState(status: ServiceStatus) {
  return status === "operational" ? "READY" : status === "unavailable" ? "ERROR" : "BUILDING"
}

function CompactStatusLabel({
  status,
  hideOnMobile = false,
}: {
  status: ServiceStatus
  hideOnMobile?: boolean
}) {
  const visibilityClass = hideOnMobile ? "hidden sm:inline" : "inline"

  if (status === "operational") {
    return <span className={`${visibilityClass} text-muted-foreground`}>All systems good</span>
  }

  return <span className={visibilityClass}>{getCompactStatusLabel(status)}</span>
}

function formatStatus(status: ServiceStatus) {
  return status === "operational" ? "All systems operational" : status === "degraded" ? "Some services degraded" : "Service unavailable"
}

function getCompactStatusLabel(status: ServiceStatus) {
  return status === "operational" ? "All systems good" : status === "degraded" ? "Attention needed" : "Service issue"
}

function formatCheckedAt(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "just now" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}
