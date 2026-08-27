export const automationJobTypes = [
  "stock.posted-document.sync",
  "stock.opening-stock.sync",
  "einvoice.generate",
  "bank-reconciliation.auto-match",
  "gst-report.refresh",
  "filing-review.prepare",
] as const

export const automationJobStatuses = [
  "queued",
  "running",
  "completed",
  "failed",
  "retry_scheduled",
  "skipped",
] as const

export type AutomationJobType = (typeof automationJobTypes)[number]
export type AutomationJobStatus = (typeof automationJobStatuses)[number]

export type AutomationPayload = Record<string, unknown>

export type AutomationJobData = {
  jobId: string
}

export type AutomationQueueInput = {
  businessId: string
  jobType: AutomationJobType
  sourceType: string
  sourceId: string
  payload?: AutomationPayload
  createdBy?: string | null
  priority?: number
  maxAttempts?: number
}

export type AutomationLogger = {
  info: (payload: Record<string, unknown>, message: string) => void
  warn: (payload: Record<string, unknown>, message: string) => void
  error: (payload: Record<string, unknown>, message: string) => void
}
