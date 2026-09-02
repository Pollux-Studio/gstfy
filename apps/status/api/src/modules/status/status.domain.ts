export const serviceStatuses = [
  "operational",
  "degraded_performance",
  "partial_outage",
  "major_outage",
  "maintenance",
  "unknown",
] as const

export const overallStatuses = [
  "operational",
  "degraded",
  "partial_outage",
  "major_outage",
  "maintenance",
  "unknown",
] as const

export const incidentStatuses = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const

export const incidentSeverities = ["minor", "major", "critical"] as const
export const incidentImpacts = ["none", "degraded", "partial", "major"] as const
export const maintenanceStatuses = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const
export const monitorCheckTypes = ["http", "tcp", "dns", "ssl", "health"] as const
export const monitorResultStatuses = [
  "success",
  "failed",
  "degraded",
  "timeout",
  "skipped",
] as const
export const subscriptionTypes = ["email", "webhook", "slack", "teams"] as const

export type ServiceStatus = (typeof serviceStatuses)[number]
export type OverallStatus = (typeof overallStatuses)[number]
export type IncidentStatus = (typeof incidentStatuses)[number]
export type IncidentSeverity = (typeof incidentSeverities)[number]
export type IncidentImpact = (typeof incidentImpacts)[number]
export type MaintenanceStatus = (typeof maintenanceStatuses)[number]
export type MonitorResultStatus = (typeof monitorResultStatuses)[number]

export type PublicServiceStatusInput = {
  isPublic: boolean
  status: ServiceStatus
}

const overallPrecedence: ServiceStatus[] = [
  "major_outage",
  "partial_outage",
  "degraded_performance",
  "maintenance",
  "unknown",
  "operational",
]

export function calculateOverallStatus(services: PublicServiceStatusInput[]): OverallStatus {
  const publicServices = services.filter((service) => service.isPublic)

  if (publicServices.length === 0) {
    return "unknown"
  }

  const strongestStatus = overallPrecedence.find((status) =>
    publicServices.some((service) => service.status === status)
  )

  return mapServiceStatusToOverall(strongestStatus ?? "unknown")
}

export function mapServiceStatusToOverall(status: ServiceStatus): OverallStatus {
  if (status === "degraded_performance") {
    return "degraded"
  }

  return status
}

export function getOverallStatusLabel(status: OverallStatus) {
  switch (status) {
    case "operational":
      return "All Systems Operational"
    case "degraded":
      return "Degraded Performance"
    case "partial_outage":
      return "Partial Outage"
    case "major_outage":
      return "Major Outage"
    case "maintenance":
      return "Scheduled Maintenance"
    case "unknown":
      return "Status Unknown"
  }
}

export function getServiceStatusLabel(status: ServiceStatus) {
  switch (status) {
    case "operational":
      return "Operational"
    case "degraded_performance":
      return "Degraded Performance"
    case "partial_outage":
      return "Partial Outage"
    case "major_outage":
      return "Major Outage"
    case "maintenance":
      return "Maintenance"
    case "unknown":
      return "Unknown"
  }
}

export function deriveServiceStatusFromMonitorResult(
  status: MonitorResultStatus,
  consecutiveFailures: number,
  failureThreshold: number,
  consecutiveSuccesses: number,
  recoveryThreshold: number
): ServiceStatus | null {
  if (status === "success" && consecutiveSuccesses >= recoveryThreshold) {
    return "operational"
  }

  if (status === "degraded" && consecutiveFailures >= failureThreshold) {
    return "degraded_performance"
  }

  if (
    (status === "failed" || status === "timeout") &&
    consecutiveFailures >= failureThreshold
  ) {
    return "major_outage"
  }

  return null
}
