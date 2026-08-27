import { and, desc, eq, inArray, lte, sql as drizzleSql } from "drizzle-orm"

import { db } from "../../db/client.js"
import {
  automationJobEvents,
  automationJobs,
  businessAutomationSettings,
  type AutomationJobRecord,
  type BusinessAutomationSettingsRecord,
} from "../../db/schema/index.js"
import { getEnv } from "../../config/env.js"
import type {
  AutomationJobStatus,
  AutomationPayload,
  AutomationQueueInput,
} from "./automation.types.js"

type AutomationSettingsUpdate = Partial<
  Pick<
    BusinessAutomationSettingsRecord,
    | "autoStockAccountingEnabled"
    | "autoEInvoiceEnabled"
    | "bankAutoMatchHighConfidenceEnabled"
    | "notifyAutomationFailures"
  >
>

export async function ensureAutomationSettings(businessId: string) {
  const existing = await db.query.businessAutomationSettings.findFirst({
    where: eq(businessAutomationSettings.businessId, businessId),
  })

  if (existing) {
    return existing
  }

  const [settings] = await db
    .insert(businessAutomationSettings)
    .values({ businessId })
    .onConflictDoNothing()
    .returning()

  const resolvedSettings =
    settings ??
    (await db.query.businessAutomationSettings.findFirst({
      where: eq(businessAutomationSettings.businessId, businessId),
    }))

  if (!resolvedSettings) {
    throw new Error("Unable to create automation settings.")
  }

  return resolvedSettings
}

export async function updateAutomationSettings(
  businessId: string,
  update: AutomationSettingsUpdate
) {
  await ensureAutomationSettings(businessId)

  const [settings] = await db
    .update(businessAutomationSettings)
    .set({
      ...update,
      updatedAt: new Date(),
    })
    .where(eq(businessAutomationSettings.businessId, businessId))
    .returning()

  if (!settings) {
    throw new Error("Unable to update automation settings.")
  }

  return settings
}

export async function createOrReuseAutomationJob(input: AutomationQueueInput) {
  const env = getEnv()
  const payload = input.payload ?? {}
  const maxAttempts = input.maxAttempts ?? env.QUEUE_MAX_ATTEMPTS
  const existing = await db.query.automationJobs.findFirst({
    where: and(
      eq(automationJobs.businessId, input.businessId),
      eq(automationJobs.jobType, input.jobType),
      eq(automationJobs.sourceType, input.sourceType),
      eq(automationJobs.sourceId, input.sourceId)
    ),
  })

  if (existing) {
    if (existing.status === "failed" || existing.status === "retry_scheduled") {
      const [updated] = await db
        .update(automationJobs)
        .set({
          status: "queued",
          priority: input.priority ?? existing.priority,
          maxAttempts,
          runAfter: new Date(),
          failedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          payload,
          result: null,
          updatedAt: new Date(),
        })
        .where(eq(automationJobs.id, existing.id))
        .returning()

      if (updated) {
        await recordAutomationEvent(updated, "requeued", "Automation job was requeued.", {
          source: "create_or_reuse",
        })
        return updated
      }
    }

    return existing
  }

  const [job] = await db
    .insert(automationJobs)
    .values({
      businessId: input.businessId,
      jobType: input.jobType,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      status: "queued",
      priority: input.priority ?? 0,
      maxAttempts,
      payload,
      createdBy: input.createdBy ?? null,
    })
    .onConflictDoNothing()
    .returning()

  const resolvedJob =
    job ??
    (await db.query.automationJobs.findFirst({
      where: and(
        eq(automationJobs.businessId, input.businessId),
        eq(automationJobs.jobType, input.jobType),
        eq(automationJobs.sourceType, input.sourceType),
        eq(automationJobs.sourceId, input.sourceId)
      ),
    }))

  if (!resolvedJob) {
    throw new Error("Unable to create automation job.")
  }

  await recordAutomationEvent(resolvedJob, "queued", "Automation job was queued.", {
    payload,
  })
  return resolvedJob
}

export async function getAutomationJob(jobId: string) {
  return db.query.automationJobs.findFirst({
    where: eq(automationJobs.id, jobId),
  })
}

export async function listAutomationJobs(
  businessId: string,
  input: {
    status?: AutomationJobStatus | "all"
    limit?: number
  } = {}
) {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100)
  const conditions = [eq(automationJobs.businessId, businessId)]

  if (input.status && input.status !== "all") {
    conditions.push(eq(automationJobs.status, input.status))
  }

  return db
    .select()
    .from(automationJobs)
    .where(and(...conditions))
    .orderBy(desc(automationJobs.createdAt))
    .limit(limit)
}

export async function listOpsAutomationJobs(
  input: {
    status?: AutomationJobStatus | "all"
    limit?: number
  } = {}
) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)
  const conditions = []

  if (input.status && input.status !== "all") {
    conditions.push(eq(automationJobs.status, input.status))
  }

  return db
    .select()
    .from(automationJobs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(automationJobs.createdAt))
    .limit(limit)
}

export async function getAutomationJobStatusCounts() {
  return db
    .select({
      status: automationJobs.status,
      count: drizzleSql<number>`count(*)::int`,
    })
    .from(automationJobs)
    .groupBy(automationJobs.status)
}

export async function getDueAutomationJobCount() {
  const [row] = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(automationJobs)
    .where(
      and(
        inArray(automationJobs.status, ["queued", "retry_scheduled"]),
        lte(automationJobs.runAfter, new Date())
      )
    )

  return row?.count ?? 0
}

export async function listAutomationJobEvents(jobId: string, limit = 30) {
  return db
    .select()
    .from(automationJobEvents)
    .where(eq(automationJobEvents.jobId, jobId))
    .orderBy(desc(automationJobEvents.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100))
}

export async function listDueAutomationJobs(limit = 250) {
  return db
    .select()
    .from(automationJobs)
    .where(
      and(
        inArray(automationJobs.status, ["queued", "retry_scheduled"]),
        lte(automationJobs.runAfter, new Date())
      )
    )
    .orderBy(desc(automationJobs.priority), automationJobs.createdAt)
    .limit(limit)
}

export async function markAutomationJobRunning(job: AutomationJobRecord) {
  const [updated] = await db
    .update(automationJobs)
    .set({
      status: "running",
      attemptCount: drizzleSql`${automationJobs.attemptCount} + 1`,
      lockedAt: new Date(),
      failedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(automationJobs.id, job.id))
    .returning()

  if (updated) {
    await recordAutomationEvent(updated, "started", "Automation job started.", {})
  }

  return updated
}

export async function markAutomationJobCompleted(
  job: AutomationJobRecord,
  result: AutomationPayload
) {
  const [updated] = await db
    .update(automationJobs)
    .set({
      status: "completed",
      completedAt: new Date(),
      lockedAt: null,
      failedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      result,
      updatedAt: new Date(),
    })
    .where(eq(automationJobs.id, job.id))
    .returning()

  if (updated) {
    await recordAutomationEvent(updated, "completed", "Automation job completed.", {
      result,
    })
  }

  return updated
}

export async function markAutomationJobSkipped(
  job: AutomationJobRecord,
  result: AutomationPayload
) {
  const [updated] = await db
    .update(automationJobs)
    .set({
      status: "skipped",
      completedAt: new Date(),
      lockedAt: null,
      failedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      result,
      updatedAt: new Date(),
    })
    .where(eq(automationJobs.id, job.id))
    .returning()

  if (updated) {
    await recordAutomationEvent(updated, "skipped", "Automation job skipped.", {
      result,
    })
  }

  return updated
}

export async function markAutomationJobFailed(
  job: AutomationJobRecord,
  input: {
    code: string
    message: string
    willRetry: boolean
    nextRetryAt: Date | null
  }
) {
  const [updated] = await db
    .update(automationJobs)
    .set({
      status: input.willRetry ? "retry_scheduled" : "failed",
      runAfter: input.nextRetryAt ?? new Date(),
      lockedAt: null,
      failedAt: new Date(),
      lastErrorCode: input.code,
      lastErrorMessage: input.message,
      updatedAt: new Date(),
    })
    .where(eq(automationJobs.id, job.id))
    .returning()

  if (updated) {
    await recordAutomationEvent(
      updated,
      input.willRetry ? "retry_scheduled" : "failed",
      input.message,
      {
        code: input.code,
        nextRetryAt: input.nextRetryAt?.toISOString() ?? null,
      }
    )
  }

  return updated
}

async function recordAutomationEvent(
  job: AutomationJobRecord,
  eventType: string,
  message: string,
  metadata: AutomationPayload
) {
  await db.insert(automationJobEvents).values({
    jobId: job.id,
    businessId: job.businessId,
    eventType,
    message,
    metadata,
  })
}
