import { and, eq, sql as drizzleSql } from "drizzle-orm"

import { getEnv } from "../../config/env.js"
import { db } from "../../db/client.js"
import {
  inventoryTransactions,
  type AutomationJobRecord,
} from "../../db/schema/index.js"
import { resolveAutomationBusinessAccess } from "./automation.access.js"
import {
  getAutomationJob,
  markAutomationJobCompleted,
  markAutomationJobFailed,
  markAutomationJobRunning,
  markAutomationJobSkipped,
} from "./automation.repository.js"
import type { AutomationJobData } from "./automation.types.js"
import { processEInvoiceAutomation } from "../e-invoice/e-invoice.routes.js"
import { processBankAutoMatchAutomation } from "../payment-receipt/payment-receipt.routes.js"

export async function processAutomationJob(data: AutomationJobData) {
  const job = await getAutomationJob(data.jobId)

  if (!job) {
    return { status: "skipped", reason: "Automation job no longer exists." }
  }

  if (job.status === "completed" || job.status === "skipped") {
    return { status: job.status, reason: "Automation job already finished." }
  }

  const runningJob = await markAutomationJobRunning(job)
  const currentJob = runningJob ?? job

  try {
    const result = await withTimeout(
      runAutomationProcessor(currentJob),
      getEnv().QUEUE_JOB_TIMEOUT_MS
    )

    if (isSkippedAutomationResult(result)) {
      await markAutomationJobSkipped(currentJob, result)
      return result
    }

    await markAutomationJobCompleted(currentJob, result)
    return result
  } catch (error) {
    const normalized = normalizeAutomationError(error)
    const attemptCount = currentJob.attemptCount
    const willRetry = attemptCount < currentJob.maxAttempts
    const nextRetryAt =
      willRetry ?
        new Date(Date.now() + getEnv().QUEUE_BACKOFF_BASE_MS * 2 ** Math.max(attemptCount - 1, 0))
      : null

    await markAutomationJobFailed(currentJob, {
      code: normalized.code,
      message: normalized.message,
      willRetry,
      nextRetryAt,
    })

    throw error
  }
}

async function runAutomationProcessor(job: AutomationJobRecord) {
  if (job.jobType === "stock.posted-document.sync") {
    return verifyPostedDocumentStock(job)
  }

  if (job.jobType === "stock.opening-stock.sync") {
    return verifyOpeningStock(job)
  }

  if (job.jobType === "einvoice.generate") {
    const access = await resolveAutomationBusinessAccess(job.businessId, job.createdBy)
    const sourceDocumentType = getPayloadString(job.payload, "sourceDocumentType")
    const sourceDocumentId = getPayloadString(job.payload, "sourceDocumentId")

    if (!sourceDocumentType || !sourceDocumentId) {
      return {
        status: "skipped",
        reason: "E-invoice automation job has no source document.",
      }
    }

    return processEInvoiceAutomation(access, {
      sourceDocumentType,
      sourceDocumentId,
    })
  }

  if (job.jobType === "bank-reconciliation.auto-match") {
    const access = await resolveAutomationBusinessAccess(job.businessId, job.createdBy)

    return processBankAutoMatchAutomation(access, {
      importId: getPayloadString(job.payload, "importId"),
      cashBankAccountId: getPayloadString(job.payload, "cashBankAccountId"),
      dateToleranceDays: getPayloadNumber(job.payload, "dateToleranceDays") ?? 3,
    })
  }

  return {
    status: "skipped",
    reason: `${job.jobType} is queued for a future automation processor.`,
  }
}

async function verifyPostedDocumentStock(job: AutomationJobRecord) {
  const voucherId = getPayloadString(job.payload, "voucherId")

  if (!voucherId) {
    return {
      status: "skipped",
      reason: "Posted document has no voucher to verify.",
    }
  }

  const [countRow] = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(inventoryTransactions)
    .where(
      and(
        eq(inventoryTransactions.businessId, job.businessId),
        eq(inventoryTransactions.voucherId, voucherId)
      )
    )

  return {
    status: "completed",
    voucherId,
    inventoryTransactionCount: countRow?.count ?? 0,
  }
}

async function verifyOpeningStock(job: AutomationJobRecord) {
  const sourceId = getPayloadString(job.payload, "sourceId")

  if (!sourceId) {
    return {
      status: "skipped",
      reason: "Opening stock job has no source movement.",
    }
  }

  const [countRow] = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(inventoryTransactions)
    .where(
      and(
        eq(inventoryTransactions.businessId, job.businessId),
        eq(inventoryTransactions.sourceType, "OPENING_STOCK"),
        eq(inventoryTransactions.sourceId, sourceId)
      )
    )

  return {
    status: "completed",
    sourceId,
    inventoryTransactionCount: countRow?.count ?? 0,
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Automation job timed out after ${timeoutMs}ms.`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

function getPayloadString(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || !(key in payload)) {
    return null
  }

  const value = (payload as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function getPayloadNumber(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || !(key in payload)) {
    return null
  }

  const value = (payload as Record<string, unknown>)[key]
  const numberValue = typeof value === "number" ? value : Number(value)

  return Number.isFinite(numberValue) ? numberValue : null
}

function normalizeAutomationError(error: unknown) {
  if (error instanceof Error) {
    return {
      code: error.name || "AUTOMATION_ERROR",
      message: error.message,
    }
  }

  return {
    code: "AUTOMATION_ERROR",
    message: "Automation job failed.",
  }
}

function isSkippedAutomationResult(
  result: unknown
): result is { status: "skipped"; reason?: string } {
  return (
    result !== null &&
    typeof result === "object" &&
    "status" in result &&
    (result as { status?: unknown }).status === "skipped"
  )
}
