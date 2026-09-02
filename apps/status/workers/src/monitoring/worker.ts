import { pathToFileURL } from "node:url"

import { getEnv } from "../config/env.js"
import { createLogger } from "../logger.js"
import { sleep, StatusApiClient } from "../status-api.js"
import { runMonitorCheck } from "./checks.js"

const env = getEnv()
const logger = createLogger(env)
const api = new StatusApiClient(env)
const lastCheckedAtByMonitor = new Map<string, number>()

export async function startMonitoringWorker() {
  logger.info(
    {
      workerId: env.STATUS_WORKER_ID,
      region: env.STATUS_WORKER_REGION,
    },
    "status monitoring worker starting"
  )

  await api.heartbeat({
    workerType: "monitoring",
    status: "starting",
  })

  let stopped = false
  const stop = () => {
    stopped = true
  }

  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)

  while (!stopped) {
    try {
      const { items: monitors } = await api.listMonitors()
      const now = Date.now()

      for (const monitor of monitors) {
        const lastCheckedAt = lastCheckedAtByMonitor.get(monitor.id) ?? 0
        const dueAt = lastCheckedAt + monitor.intervalSeconds * 1_000

        if (dueAt > now) {
          continue
        }

        lastCheckedAtByMonitor.set(monitor.id, now)
        const result = await runMonitorCheck(monitor, env.STATUS_WORKER_REGION)
        await api.recordMonitorResult(result)

        logger.info(
          {
            monitorId: monitor.id,
            monitorName: monitor.name,
            status: result.status,
            responseTimeMs: result.responseTimeMs,
          },
          "status monitor result recorded"
        )
      }

      await api.heartbeat({
        workerType: "monitoring",
        status: "healthy",
        metadata: {
          monitors: monitors.length,
          lastLoopAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      logger.error(
        {
          err: error,
        },
        "status monitoring worker loop failed"
      )
      await api.heartbeat({
        workerType: "monitoring",
        status: "degraded",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }).catch(() => undefined)
    }

    await sleep(env.STATUS_WORKER_POLL_SECONDS * 1_000)
  }

  await api.heartbeat({
    workerType: "monitoring",
    status: "stopped",
  }).catch(() => undefined)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startMonitoringWorker()
}
