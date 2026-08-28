export const serviceStatusValues = [
  "operational",
  "degraded",
  "unavailable",
] as const

export type ServiceStatus = (typeof serviceStatusValues)[number]

export type ServiceHealth = {
  key: string
  label: string
  status: ServiceStatus
  latencyMs: number | null
  message: string | null
}
