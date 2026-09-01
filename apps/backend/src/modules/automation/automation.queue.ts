import { Queue } from "bullmq"
import { Redis } from "ioredis"

import { getEnv } from "../../config/env.js"
import {
  createOrReuseAutomationJob,
  listDueAutomationJobs,
} from "./automation.repository.js"
import type {
  AutomationJobData,
  AutomationLogger,
  AutomationQueueInput,
} from "./automation.types.js"

export const automationQueueName = "gstfy-automation"

let queue: Queue<AutomationJobData> | null = null
let queueConnection: Redis | null = null

export async function enqueueAutomationJob(
  input: AutomationQueueInput,
  logger?: AutomationLogger
) {
  const jobRecord = await createOrReuseAutomationJob(input)

  if (jobRecord.status === "completed" || jobRecord.status === "skipped") {
    return { ...jobRecord, queueAdded: true }
  }

  const queueInstance = getAutomationQueue(logger)

  if (!queueInstance) {
    logger?.warn(
      {
        automationJobId: jobRecord.id,
        jobType: jobRecord.jobType,
        sourceType: jobRecord.sourceType,
        sourceId: jobRecord.sourceId,
      },
      "automation job persisted without redis queue"
    )
    return { ...jobRecord, queueAdded: false }
  }

  try {
    await addAutomationBullJob(queueInstance, jobRecord)
    return { ...jobRecord, queueAdded: true }
  } catch (error: unknown) {
    logger?.warn(
      {
        automationJobId: jobRecord.id,
        err: error,
      },
      "automation job persisted but could not be added to redis queue"
    )
    return { ...jobRecord, queueAdded: false }
  }
}

export async function requeueDueAutomationJobs(logger?: AutomationLogger) {
  const queueInstance = getAutomationQueue(logger)

  if (!queueInstance) {
    return { queued: 0 }
  }

  const jobs = await listDueAutomationJobs()
  let queued = 0

  for (const job of jobs) {
    try {
      await addAutomationBullJob(queueInstance, job)
      queued += 1
    } catch (error: unknown) {
      logger?.warn(
        {
          automationJobId: job.id,
          err: error,
        },
        "failed to requeue persisted automation job"
      )
    }
  }

  return { queued }
}

export function createRedisConnection() {
  const redisUrl = getEnv().REDIS_URL

  if (!redisUrl) {
    return null
  }

  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  })
}

export async function closeAutomationQueue() {
  await queue?.close()
  queue = null
  queueConnection?.disconnect()
  queueConnection = null
}

function getAutomationQueue(logger?: AutomationLogger) {
  const env = getEnv()

  if (!env.REDIS_URL) {
    return null
  }

  if (queue) {
    return queue
  }

  queueConnection = createRedisConnection()

  if (!queueConnection) {
    return null
  }

  queueConnection.on("error", (error: unknown) => {
    logger?.warn({ err: error }, "redis queue connection error")
  })

  queue = new Queue<AutomationJobData>(automationQueueName, {
    connection: queueConnection,
  })

  return queue
}

async function addAutomationBullJob(
  queueInstance: Queue<AutomationJobData>,
  jobRecord: {
    id: string
    jobType: string
    maxAttempts: number
    priority: number
  }
) {
  const existingBullJob = await queueInstance.getJob(jobRecord.id)

  if (existingBullJob) {
    const state = await existingBullJob.getState()

    if (state === "failed" || state === "completed") {
      await existingBullJob.remove()
    } else {
      return
    }
  }

  await queueInstance.add(
    jobRecord.jobType,
    { jobId: jobRecord.id },
    {
      jobId: jobRecord.id,
      attempts: jobRecord.maxAttempts,
      backoff: {
        type: "exponential",
        delay: getEnv().QUEUE_BACKOFF_BASE_MS,
      },
      priority: jobRecord.priority,
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    }
  )
}
