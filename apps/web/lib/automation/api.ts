import { apiRequest } from "@/lib/api/client"

export type AutomationSettings = {
  businessId: string
  autoStockAccountingEnabled: boolean
  autoEInvoiceEnabled: boolean
  bankAutoMatchHighConfidenceEnabled: boolean
  notifyAutomationFailures: boolean
  createdAt: string
  updatedAt: string
}

export type AutomationJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "retry_scheduled"
  | "skipped"

export type AutomationJob = {
  id: string
  businessId: string
  jobType: string
  sourceType: string
  sourceId: string
  status: AutomationJobStatus
  priority: number
  attemptCount: number
  maxAttempts: number
  runAfter: string
  lockedAt: string | null
  completedAt: string | null
  failedAt: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type UpdateAutomationSettingsPayload = Partial<
  Pick<
    AutomationSettings,
    | "autoStockAccountingEnabled"
    | "autoEInvoiceEnabled"
    | "bankAutoMatchHighConfidenceEnabled"
    | "notifyAutomationFailures"
  >
>

export function getAutomationSettings(accessToken: string) {
  return apiRequest<{ settings: AutomationSettings }>("/automation/settings", {
    method: "GET",
    accessToken,
  })
}

export function updateAutomationSettings(
  payload: UpdateAutomationSettingsPayload,
  accessToken: string
) {
  return apiRequest<{ settings: AutomationSettings }>("/automation/settings", {
    method: "PATCH",
    body: payload,
    accessToken,
  })
}

export function getAutomationJobs(accessToken: string) {
  return apiRequest<{ jobs: AutomationJob[] }>("/automation/jobs?limit=6", {
    method: "GET",
    accessToken,
  })
}

