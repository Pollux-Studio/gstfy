import type { StatusWorkerEnv } from "./config/env.js"

export type StatusMonitor = {
  id: string
  serviceId: string
  name: string
  checkType: "http" | "tcp" | "dns" | "ssl" | "health"
  target: string
  intervalSeconds: number
  timeoutSeconds: number
  expectedStatus: number | null
  expectedBody: string | null
  expectedHeaders: Record<string, string>
  regions: string[]
  retryCount: number
}

export type MonitorResultPayload = {
  monitorId: string
  region: string
  status: "success" | "failed" | "degraded" | "timeout" | "skipped"
  httpStatus?: number | null
  responseTimeMs?: number | null
  error?: string | null
  checkedAt?: string
}

export type PendingNotificationDelivery = {
  id: string
  subscriptionType: "email" | "webhook" | "slack" | "teams" | null
  event: string
  target: string
  payload: Record<string, unknown>
  headers: Record<string, string>
  deliveryId: string
  destination: {
    email: string | null
    webhookUrl: string | null
    slackWebhookUrl: string | null
    teamsWebhookUrl: string | null
    signingSecret: string | null
  }
}

export class StatusApiClient {
  constructor(private readonly env: StatusWorkerEnv) {}

  async heartbeat(input: {
    workerType: "monitoring" | "notifications" | "incident-engine"
    status: "starting" | "healthy" | "degraded" | "stopped"
    metadata?: Record<string, unknown>
  }) {
    return this.request("/api/v1/monitoring/heartbeats", {
      method: "POST",
      body: {
        workerId: this.env.STATUS_WORKER_ID,
        workerType: input.workerType,
        region: this.env.STATUS_WORKER_REGION,
        version: this.env.STATUS_WORKER_VERSION,
        status: input.status,
        metadata: input.metadata ?? {},
      },
    })
  }

  async listMonitors() {
    return this.request<{ items: StatusMonitor[] }>(
      `/api/v1/monitoring/monitors?q=${encodeURIComponent(this.env.STATUS_WORKER_REGION)}`
    )
  }

  async recordMonitorResult(input: MonitorResultPayload) {
    return this.request("/api/v1/monitoring/results", {
      method: "POST",
      body: input,
    })
  }

  async listPendingNotifications(limit = 25) {
    return this.request<{ items: PendingNotificationDelivery[] }>(
      `/api/v1/worker/notifications/pending?limit=${limit}`
    )
  }

  async markNotificationDelivered(id: string) {
    return this.request(`/api/v1/worker/notifications/${id}/delivered`, {
      method: "POST",
    })
  }

  async markNotificationFailed(id: string, error: string) {
    return this.request(`/api/v1/worker/notifications/${id}/failed`, {
      method: "POST",
      body: { error },
    })
  }

  private async request<T = unknown>(
    path: string,
    init: {
      method?: "GET" | "POST"
      body?: unknown
      timeoutMs?: number
    } = {}
  ): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      init.timeoutMs ?? 30_000
    )

    try {
      const response = await fetch(new URL(path, this.env.STATUS_API_BASE_URL), {
        method: init.method ?? "GET",
        headers: {
          Authorization: `Bearer ${this.env.STATUS_MONITORING_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      })

      const text = await response.text()
      const payload = text ? (JSON.parse(text) as unknown) : null

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "message" in payload &&
          typeof payload.message === "string" ?
            payload.message
          : `Status API returned ${response.status}.`
        throw new Error(message)
      }

      return payload as T
    } finally {
      clearTimeout(timeout)
    }
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
