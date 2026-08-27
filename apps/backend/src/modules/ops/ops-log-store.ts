import { randomUUID } from "node:crypto"

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

type OpsLogInput = Omit<OpsLogEntry, "id" | "timestamp">

const maxLogEntries = 600
const logEntries: OpsLogEntry[] = []

export function recordOpsLog(input: OpsLogInput) {
  logEntries.unshift({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...input,
  })

  if (logEntries.length > maxLogEntries) {
    logEntries.length = maxLogEntries
  }
}

export function listOpsLogs(input: {
  level?: OpsLogLevel | "all"
  limit?: number
} = {}) {
  const level = input.level ?? "all"
  const limit = Math.min(Math.max(input.limit ?? 80, 1), 200)
  const logs =
    level === "all" ?
      logEntries
    : logEntries.filter((entry) => entry.level === level)

  return logs.slice(0, limit)
}

export function getOpsLogSummary() {
  const completedRequests = logEntries.filter(
    (entry) => typeof entry.durationMs === "number"
  )
  const durations = completedRequests
    .map((entry) => entry.durationMs)
    .filter((duration): duration is number => typeof duration === "number")
  const averageDurationMs =
    durations.length > 0 ?
      Math.round(
        durations.reduce((total, duration) => total + duration, 0) /
          durations.length
      )
    : 0
  const errors = logEntries.filter((entry) => entry.level === "error")
  const warnings = logEntries.filter((entry) => entry.level === "warn")
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000

  return {
    retained: logEntries.length,
    maxRetained: maxLogEntries,
    requests: completedRequests.length,
    warnings: warnings.length,
    errors: errors.length,
    recentErrors: errors.filter(
      (entry) => new Date(entry.timestamp).getTime() >= fiveMinutesAgo
    ).length,
    averageDurationMs,
    lastErrorAt: errors[0]?.timestamp ?? null,
  }
}
