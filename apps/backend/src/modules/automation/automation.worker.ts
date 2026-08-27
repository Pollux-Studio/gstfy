import { Worker } from "bullmq"

import { getEnv } from "../../config/env.js"
import {
  automationQueueName,
  closeAutomationQueue,
  createRedisConnection,
  requeueDueAutomationJobs,
} from "./automation.queue.js"
import { processAutomationJob } from "./automation.processor.js"
import type { AutomationJobData, AutomationLogger } from "./automation.types.js"

type AutomationWorkerHandle = {
  close: () => Promise<void>
}

export async function startAutomationWorker(
  logger: AutomationLogger
): Promise<AutomationWorkerHandle | null> {
  const env = getEnv()

  if (!env.QUEUE_WORKER_ENABLED) {
    logger.info({ queueWorkerEnabled: false }, "automation worker disabled")
    return null
  }

  const connection = createRedisConnection()

  if (!connection) {
    logger.warn(
      { queueWorkerEnabled: true },
      "automation worker enabled but redis is not configured"
    )
    return null
  }

  connection.on("error", (error: unknown) => {
    logger.warn({ err: error }, "automation worker redis connection error")
  })

  const worker = new Worker<AutomationJobData>(
    automationQueueName,
    async (job) => processAutomationJob(job.data),
    {
      connection,
      concurrency: env.QUEUE_CONCURRENCY,
    }
  )

  worker.on("completed", (job) => {
    logger.info(
      {
        bullJobId: job.id,
        automationJobId: job.data.jobId,
      },
      "automation worker job completed"
    )
  })

  worker.on("failed", (job, error) => {
    logger.warn(
      {
        bullJobId: job?.id ?? null,
        automationJobId: job?.data.jobId ?? null,
        err: error,
      },
      "automation worker job failed"
    )
  })

  const requeued = await requeueDueAutomationJobs(logger)
  logger.info(
    {
      concurrency: env.QUEUE_CONCURRENCY,
      requeued: requeued.queued,
    },
    "automation worker started"
  )

  return {
    close: async () => {
      await worker.close()
      connection.disconnect()
      await closeAutomationQueue()
    },
  }
}
