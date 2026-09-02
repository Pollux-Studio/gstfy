import { getEnv } from "./config/env.js"
import { startMonitoringWorker } from "./monitoring/worker.js"
import { startNotificationWorker } from "./notifications/worker.js"

const env = getEnv()

if (env.STATUS_WORKER_KIND === "notifications") {
  await startNotificationWorker()
} else {
  await startMonitoringWorker()
}
