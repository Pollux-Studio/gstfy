import type { FastifyInstance } from "fastify"

import { getEnv } from "../../config/env.js"
import { getMigrationStatus } from "../../db/migrations.js"
import { HttpError } from "../../utils/http-error.js"
import {
  enqueueAutomationJob,
  requeueDueAutomationJobs,
  automationQueueName,
} from "../automation/automation.queue.js"
import { processAutomationJob } from "../automation/automation.processor.js"
import {
  getAutomationJob,
  getAutomationJobStatusCounts,
  getDueAutomationJobCount,
  listAutomationJobEvents,
  listOpsAutomationJobs,
} from "../automation/automation.repository.js"
import {
  automationJobStatuses,
  type AutomationJobStatus,
  type AutomationJobType,
} from "../automation/automation.types.js"
import { requireOpsAdmin } from "./ops-auth.js"
import { getOpsLogSummary, listOpsLogs } from "./ops-log-store.js"
import {
  opsJobParamsSchema,
  opsLogsQuerySchema,
  opsQueueQuerySchema,
} from "./ops.schemas.js"

export async function registerOpsRoutes(app: FastifyInstance) {
  app.get("/ops/overview", async (request) => {
    await requireOpsAdmin(request)

    const env = getEnv()
    const [migrationStatus, statusRows, dueJobs] = await Promise.all([
      getMigrationStatus(),
      getAutomationJobStatusCounts(),
      getDueAutomationJobCount(),
    ])

    return {
      server: {
        environment: env.NODE_ENV,
        logLevel: env.LOG_LEVEL,
        redisConfigured: Boolean(env.REDIS_URL),
        queueWorkerEnabled: env.QUEUE_WORKER_ENABLED,
        queueConcurrency: env.QUEUE_CONCURRENCY,
        queueJobTimeoutMs: env.QUEUE_JOB_TIMEOUT_MS,
        queueMaxAttempts: env.QUEUE_MAX_ATTEMPTS,
      },
      logs: getOpsLogSummary(),
      queues: {
        name: automationQueueName,
        dueJobs,
        statusCounts: normalizeStatusCounts(statusRows),
      },
      migrations: {
        migrationsDirectory: migrationStatus.migrationsDirectory,
        ledgerExists: migrationStatus.ledgerExists,
        total: migrationStatus.total,
        applied: migrationStatus.applied,
        pending: migrationStatus.pending,
        checksumMismatches: migrationStatus.checksumMismatches,
        recent: migrationStatus.migrations.slice(-12),
      },
    }
  })

  app.get("/ops/logs", async (request) => {
    await requireOpsAdmin(request)
    const query = opsLogsQuerySchema.parse(request.query)

    return {
      logs: listOpsLogs(query),
    }
  })

  app.get("/ops/queues", async (request) => {
    await requireOpsAdmin(request)
    const query = opsQueueQuerySchema.parse(request.query)
    const [jobs, statusRows, dueJobs] = await Promise.all([
      listOpsAutomationJobs(query),
      getAutomationJobStatusCounts(),
      getDueAutomationJobCount(),
    ])

    return {
      queue: {
        name: automationQueueName,
        dueJobs,
        statusCounts: normalizeStatusCounts(statusRows),
      },
      jobs,
    }
  })

  app.get("/ops/queues/jobs/:id/events", async (request) => {
    await requireOpsAdmin(request)
    const { id } = opsJobParamsSchema.parse(request.params)
    const job = await getAutomationJob(id)

    if (!job) {
      throw new HttpError(404, "Automation job not found.")
    }

    return {
      job,
      events: await listAutomationJobEvents(id),
    }
  })

  app.post("/ops/queues/requeue-due", async (request) => {
    await requireOpsAdmin(request)

    return requeueDueAutomationJobs(request.log)
  })

  app.post("/ops/queues/jobs/:id/retry", async (request) => {
    const user = await requireOpsAdmin(request)
    const { id } = opsJobParamsSchema.parse(request.params)
    const job = await getAutomationJob(id)

    if (!job) {
      throw new HttpError(404, "Automation job not found.")
    }

    if (job.status !== "failed" && job.status !== "retry_scheduled") {
      throw new HttpError(409, "Only failed automation jobs can be retried.")
    }

    return {
      job: await enqueueAutomationJob(
        {
          businessId: job.businessId,
          jobType: job.jobType as AutomationJobType,
          sourceType: job.sourceType,
          sourceId: job.sourceId,
          payload: toPayloadRecord(job.payload),
          createdBy: user.id,
          priority: job.priority,
          maxAttempts: job.maxAttempts,
        },
        request.log
      ),
    }
  })

  app.post("/ops/queues/jobs/:id/run-now", async (request) => {
    await requireOpsAdmin(request)
    const { id } = opsJobParamsSchema.parse(request.params)
    const job = await getAutomationJob(id)

    if (!job) {
      throw new HttpError(404, "Automation job not found.")
    }

    if (job.status === "running") {
      throw new HttpError(409, "Automation job is already running.")
    }

    return {
      result: await processAutomationJob({ jobId: id }),
    }
  })
}

function normalizeStatusCounts(
  rows: Array<{ status: string; count: number }>
): Record<AutomationJobStatus, number> {
  const counts = Object.fromEntries(
    automationJobStatuses.map((status) => [status, 0])
  ) as Record<AutomationJobStatus, number>

  for (const row of rows) {
    if (isAutomationJobStatus(row.status)) {
      counts[row.status] = Number(row.count) || 0
    }
  }

  return counts
}

function isAutomationJobStatus(value: string): value is AutomationJobStatus {
  return automationJobStatuses.includes(value as AutomationJobStatus)
}

function toPayloadRecord(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {}
  }

  return payload as Record<string, unknown>
}
