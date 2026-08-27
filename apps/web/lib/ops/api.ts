import { apiRequest } from "@/lib/api/client"

export type OpsLogLevel = "info" | "warn" | "error"

export type OpsLogEntry = {
  id: string
  timestamp: string
  level: OpsLogLevel
  message: string
  requestId: string | null
  method: string | null
  url: string | null
  statusCode: number | null
  durationMs: number | null
}

export type OpsAutomationJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "retry_scheduled"
  | "skipped"

export type OpsAutomationJob = {
  id: string
  businessId: string
  jobType: string
  sourceType: string
  sourceId: string
  status: OpsAutomationJobStatus
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

export type OpsAutomationJobEvent = {
  id: string
  jobId: string
  businessId: string
  eventType: string
  message: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type OpsOverview = {
  server: {
    environment: string
    logLevel: string
    redisConfigured: boolean
    queueWorkerEnabled: boolean
    queueConcurrency: number
    queueJobTimeoutMs: number
    queueMaxAttempts: number
  }
  logs: {
    retained: number
    maxRetained: number
    requests: number
    warnings: number
    errors: number
    recentErrors: number
    averageDurationMs: number
    lastErrorAt: string | null
  }
  queues: {
    name: string
    dueJobs: number
    statusCounts: Record<OpsAutomationJobStatus, number>
  }
  migrations: {
    migrationsDirectory: string
    ledgerExists: boolean
    total: number
    applied: number
    pending: number
    checksumMismatches: number
    recent: Array<{
      name: string
      checksum: string
      appliedChecksum: string | null
      appliedAt: string | null
      status: "pending" | "applied" | "checksum_mismatch"
    }>
  }
}

export function getOpsOverview(accessToken: string) {
  return apiRequest<OpsOverview>("/ops/overview", {
    method: "GET",
    accessToken,
    retry: 1,
  })
}

export function getOpsLogs(
  accessToken: string,
  input: { level: OpsLogLevel | "all"; limit?: number }
) {
  const params = new URLSearchParams({
    level: input.level,
    limit: String(input.limit ?? 80),
  })

  return apiRequest<{ logs: OpsLogEntry[] }>(`/ops/logs?${params}`, {
    method: "GET",
    accessToken,
    retry: 1,
  })
}

export function getOpsQueue(
  accessToken: string,
  input: { status: OpsAutomationJobStatus | "all"; limit?: number }
) {
  const params = new URLSearchParams({
    status: input.status,
    limit: String(input.limit ?? 60),
  })

  return apiRequest<{
    queue: OpsOverview["queues"]
    jobs: OpsAutomationJob[]
  }>(`/ops/queues?${params}`, {
    method: "GET",
    accessToken,
    retry: 1,
  })
}

export function getOpsJobEvents(accessToken: string, jobId: string) {
  return apiRequest<{
    job: OpsAutomationJob
    events: OpsAutomationJobEvent[]
  }>(`/ops/queues/jobs/${jobId}/events`, {
    method: "GET",
    accessToken,
    retry: 1,
  })
}

export function requeueDueOpsJobs(accessToken: string) {
  return apiRequest<{ queued: number }>("/ops/queues/requeue-due", {
    method: "POST",
    accessToken,
    body: { idempotencyKey: crypto.randomUUID() },
  })
}

export function retryOpsJob(accessToken: string, jobId: string) {
  return apiRequest<{ job: OpsAutomationJob }>(`/ops/queues/jobs/${jobId}/retry`, {
    method: "POST",
    accessToken,
    body: { idempotencyKey: crypto.randomUUID() },
  })
}

export function runOpsJobNow(accessToken: string, jobId: string) {
  return apiRequest<{ result: Record<string, unknown> }>(
    `/ops/queues/jobs/${jobId}/run-now`,
    {
      method: "POST",
      accessToken,
      body: { idempotencyKey: crypto.randomUUID() },
      timeoutMs: 60_000,
    }
  )
}
