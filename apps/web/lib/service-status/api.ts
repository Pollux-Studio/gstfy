import { apiRequest } from "@/lib/api/client"

export type ServiceStatus = "operational" | "degraded" | "unavailable"

export type ServiceHealth = {
  key: string
  label: string
  status: ServiceStatus
  latencyMs: number | null
  message: string | null
}

export type ServiceHealthResponse = {
  status: ServiceStatus
  checkedAt: string
  services: ServiceHealth[]
}

export function getServiceHealth() {
  return apiRequest<ServiceHealthResponse>("/health/services", {
    method: "GET",
    timeoutMs: 8_000,
    retry: 1,
  })
}
