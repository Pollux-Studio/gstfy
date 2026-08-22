import { and, desc, eq, type SQL } from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { db } from "../../db/client.js"
import {
  auditLogs,
  businessMemberPermissions,
  gstFilingIdempotencyKeys,
  gstFilingPayloads,
  gstFilingRuns,
  gstFilingStatusEvents,
  gstReportingRuns,
  type GstFilingRunRecord,
  type GstReportingRunRecord,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"
import {
  getGstr1Dataset,
  getGstr3bDataset,
} from "../gst-reporting/gst-reporting.routes.js"
import { getGstFilingAdapter } from "./gst-filing.adapters.js"
import {
  assertFilingStatusTransition,
  buildFilingOperationRequestHash,
  canRetryFilingTechnically,
  hashCanonicalPayload,
  hashPayload,
  requiresFilingBusinessCorrection,
  schemaVersionForReturnType,
  shouldRecoverExistingFilingSubmission,
  validateCanonicalPayload,
  type CanonicalFilingPayload,
  type GstFilingMockMode,
  type GstFilingReturnType,
  type GstFilingStatus,
  type MockAdapterResult,
} from "./gst-filing.domain.js"
import {
  createGstFilingRunSchema,
  filingRunActionSchema,
  gstFilingRunParamsSchema,
  listGstFilingRunsQuerySchema,
  submitGstFilingRunSchema,
  type ListGstFilingRunsQueryInput,
} from "./gst-filing.schemas.js"

type BusinessAccess = Awaited<ReturnType<typeof requirePrimaryBusinessAccess>>
type GstAction = "view" | "create" | "edit" | "delete"

const terminalStatuses = ["FILED", "REJECTED", "FAILED", "CANCELLED"] as const

export async function registerGstFilingRoutes(app: FastifyInstance) {
  app.get("/gst-filings/runs", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = listGstFilingRunsQuerySchema.parse(request.query)

    return listFilingRuns(access.business.id, query)
  })

  app.post("/gst-filings/runs", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "create")
    const body = createGstFilingRunSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runFilingIdempotency(
      access,
      `gst-filing-create:${body.reportingRunId}:${body.returnType}`,
      idempotencyKey,
      body,
      async () => ({ filingRun: await createFilingRun(access, body) })
    )
  })

  app.get("/gst-filings/runs/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const { id } = gstFilingRunParamsSchema.parse(request.params)

    return getFilingRunDetail(access.business.id, id)
  })

  app.post("/gst-filings/runs/:id/validate", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstFilingRunParamsSchema.parse(request.params)
    const body = filingRunActionSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runFilingIdempotency(
      access,
      `gst-filing-validate:${id}`,
      idempotencyKey,
      body,
      async () => validateFilingRun(access, id)
    )
  })

  app.post("/gst-filings/runs/:id/submit", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstFilingRunParamsSchema.parse(request.params)
    const body = submitGstFilingRunSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runFilingIdempotency(
      access,
      `gst-filing-submit:${id}`,
      idempotencyKey,
      body,
      async () => submitFilingRun(access, id, body.mockMode)
    )
  })

  app.post("/gst-filings/runs/:id/status", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstFilingRunParamsSchema.parse(request.params)
    const body = filingRunActionSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runFilingIdempotency(
      access,
      `gst-filing-status:${id}`,
      idempotencyKey,
      body,
      async () => pollFilingRunStatus(access, id)
    )
  })

  app.post("/gst-filings/runs/:id/retry", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstFilingRunParamsSchema.parse(request.params)
    const body = filingRunActionSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runFilingIdempotency(
      access,
      `gst-filing-retry:${id}`,
      idempotencyKey,
      body,
      async () => ({ filingRun: await retryFilingRun(access, id, body.reason) })
    )
  })

  app.post("/gst-filings/runs/:id/cancel", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "delete")
    const { id } = gstFilingRunParamsSchema.parse(request.params)
    const body = filingRunActionSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runFilingIdempotency(
      access,
      `gst-filing-cancel:${id}`,
      idempotencyKey,
      body,
      async () => ({ filingRun: await cancelFilingRun(access, id, body.reason) })
    )
  })

  app.get("/gst-filings/runs/:id/acknowledgement", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const { id } = gstFilingRunParamsSchema.parse(request.params)
    const filingRun = await requireFilingRun(access.business.id, id)

    if (!filingRun.acknowledgementNumber) {
      throw new HttpError(404, "GST filing acknowledgement is not available yet.")
    }

    return {
      acknowledgement: {
        acknowledgementNumber: filingRun.acknowledgementNumber,
        acknowledgementDate: filingRun.acknowledgementDate,
        externalReference: filingRun.externalReference,
        status: filingRun.status,
      },
    }
  })
}

async function createFilingRun(
  access: BusinessAccess,
  input: { reportingRunId: string; returnType: GstFilingReturnType }
) {
  const reportingRun = await requireReportingRunForFiling(
    access.business.id,
    input.reportingRunId
  )
  assertReportingRunReady(reportingRun)

  const latest = await findLatestFilingRun(
    access.business.id,
    reportingRun.id,
    input.returnType
  )

  if (latest && latest.status === "FILED") {
    return latest
  }

  if (latest && latest.status === "REJECTED") {
    throw new HttpError(
      409,
      "Rejected GST filings require source correction and a new reporting run before resubmission."
    )
  }

  if (latest && !isTerminalFilingStatus(latest.status)) {
    return latest
  }

  const [filingRun] = await db
    .insert(gstFilingRuns)
    .values({
      businessId: access.business.id,
      gstRegistrationId: reportingRun.gstRegistrationId,
      reportingRunId: reportingRun.id,
      returnType: input.returnType,
      period: reportingRun.period,
      attemptNumber: (latest?.attemptNumber ?? 0) + 1,
      createdBy: access.userId,
    })
    .returning()

  if (!filingRun) {
    throw new HttpError(500, "Unable to create GST filing run.")
  }

  await insertStatusEvent(access, filingRun, null, "FILING_RUN_CREATED", null)
  await insertAuditLog(access, filingRun.id, "FILING_RUN_CREATED", null, filingRun, null)

  return filingRun
}

async function validateFilingRun(access: BusinessAccess, id: string) {
  const filingRun = await requireFilingRun(access.business.id, id)
  const transition = assertFilingStatusTransition(
    filingRun.status,
    ["DRAFT", "VALIDATED", "READY_FOR_SUBMISSION"],
    "be validated"
  )

  if (!transition.valid) {
    throw new HttpError(409, transition.message ?? "GST filing run cannot be validated.")
  }

  const reportingRun = await requireReportingRunForFiling(
    access.business.id,
    filingRun.reportingRunId
  )
  assertReportingRunReady(reportingRun)
  const payloads = await ensureFilingPayloads(access, filingRun, reportingRun)
  const validation = validateCanonicalPayload(payloads.canonicalPayload)
  const nextStatus = validation.canSubmit ? "READY_FOR_SUBMISSION" : "VALIDATED"
  const [updated] = await db
    .update(gstFilingRuns)
    .set({
      status: nextStatus,
      schemaVersion: validation.schemaVersion,
      payloadHash: validation.payloadHash,
      validationResult: validation,
      updatedAt: new Date(),
    })
    .where(and(eq(gstFilingRuns.businessId, access.business.id), eq(gstFilingRuns.id, id)))
    .returning()

  if (!updated) {
    throw new HttpError(404, "GST filing run not found.")
  }

  await insertStatusEvent(access, updated, filingRun.status, "FILING_VALIDATED", validation)
  await insertAuditLog(access, updated.id, "FILING_VALIDATED", filingRun, updated, null)

  return { filingRun: updated, validation }
}

async function submitFilingRun(
  access: BusinessAccess,
  id: string,
  mockMode: GstFilingMockMode
) {
  const existingRun = await requireFilingRun(access.business.id, id)

  if (hasExternalSubmission(existingRun)) {
    return {
      filingRun: existingRun,
      submission: {
        recovered: true,
        status: existingRun.status,
        externalReference: existingRun.externalReference,
      },
    }
  }

  const validationResult = await validateFilingRun(access, id)
  const filingRun = validationResult.filingRun

  if (!validationResult.validation.canSubmit) {
    throw new HttpError(409, "Resolve filing validation issues before submission.")
  }

  const transition = assertFilingStatusTransition(
    filingRun.status,
    ["READY_FOR_SUBMISSION"],
    "be submitted"
  )

  if (!transition.valid) {
    throw new HttpError(409, transition.message ?? "GST filing run cannot be submitted.")
  }

  const [submittingRun] = await db
    .update(gstFilingRuns)
    .set({
      status: "SUBMITTING",
      adapterMode: mockMode,
      updatedAt: new Date(),
    })
    .where(
      and(eq(gstFilingRuns.businessId, access.business.id), eq(gstFilingRuns.id, id))
    )
    .returning()

  if (!submittingRun) {
    throw new HttpError(404, "GST filing run not found.")
  }

  const adapter = getGstFilingAdapter(submittingRun.adapterName)
  const adapterResult = adapter.submit({
    mode: mockMode,
    returnType: submittingRun.returnType as GstFilingReturnType,
    period: submittingRun.period,
  })
  const updated = await applyAdapterResult(
    access,
    submittingRun,
    adapterResult,
    "FILING_SUBMITTED"
  )

  if (["PROCESSING", "ACCEPTED", "REJECTED"].includes(updated.status)) {
    await markReportingRunSubmitted(access, updated.reportingRunId)
  }

  return { filingRun: updated, submission: adapterResult }
}

async function pollFilingRunStatus(access: BusinessAccess, id: string) {
  const filingRun = await requireFilingRun(access.business.id, id)
  const transition = assertFilingStatusTransition(
    filingRun.status,
    ["SUBMITTED", "PROCESSING", "ACCEPTED", "FILED", "REJECTED", "FAILED"],
    "poll status"
  )

  if (!transition.valid) {
    throw new HttpError(409, transition.message ?? "GST filing status cannot be polled.")
  }

  if (["FILED", "REJECTED", "FAILED"].includes(filingRun.status)) {
    return { filingRun, status: null }
  }

  const adapter = getGstFilingAdapter(filingRun.adapterName)
  const adapterResult = adapter.getStatus({
    currentStatus: filingRun.status as GstFilingStatus,
    mode: (filingRun.adapterMode as GstFilingMockMode | null) ?? null,
    externalReference: filingRun.externalReference,
  })
  const updated = await applyAdapterResult(
    access,
    filingRun,
    adapterResult,
    "FILING_STATUS_UPDATED"
  )

  if (updated.status === "FILED") {
    await markReportingRunFiled(access, updated.reportingRunId)
  }

  return { filingRun: updated, status: adapterResult }
}

async function retryFilingRun(
  access: BusinessAccess,
  id: string,
  reason: string | null
) {
  const filingRun = await requireFilingRun(access.business.id, id)

  if (requiresFilingBusinessCorrection(filingRun.status)) {
    throw new HttpError(
      409,
      "Rejected GST filings require source correction and a new reporting run before resubmission."
    )
  }

  if (!canRetryFilingTechnically(filingRun.status)) {
    throw new HttpError(
      409,
      `GST filing run status ${filingRun.status} cannot be technically retried.`
    )
  }

  const transition = assertFilingStatusTransition(
    filingRun.status,
    ["FAILED"],
    "be retried"
  )

  if (!transition.valid) {
    throw new HttpError(409, transition.message ?? "GST filing run cannot be retried.")
  }

  const reportingRun = await requireReportingRunForFiling(
    access.business.id,
    filingRun.reportingRunId
  )
  const latest = await findLatestFilingRun(
    access.business.id,
    reportingRun.id,
    filingRun.returnType as GstFilingReturnType
  )
  const [retryRun] = await db
    .insert(gstFilingRuns)
    .values({
      businessId: access.business.id,
      gstRegistrationId: reportingRun.gstRegistrationId,
      reportingRunId: reportingRun.id,
      returnType: filingRun.returnType,
      period: reportingRun.period,
      attemptNumber: (latest?.attemptNumber ?? filingRun.attemptNumber) + 1,
      createdBy: access.userId,
    })
    .returning()

  if (!retryRun) {
    throw new HttpError(500, "Unable to create GST filing retry.")
  }

  await insertStatusEvent(access, retryRun, filingRun.status, "FILING_RETRY", { reason })
  await insertAuditLog(access, retryRun.id, "FILING_RETRY", filingRun, retryRun, reason)

  return retryRun
}

async function cancelFilingRun(
  access: BusinessAccess,
  id: string,
  reason: string | null
) {
  const filingRun = await requireFilingRun(access.business.id, id)
  const transition = assertFilingStatusTransition(
    filingRun.status,
    ["DRAFT", "VALIDATED", "READY_FOR_SUBMISSION", "FAILED"],
    "be cancelled"
  )

  if (!transition.valid) {
    throw new HttpError(409, transition.message ?? "GST filing run cannot be cancelled.")
  }

  const [updated] = await db
    .update(gstFilingRuns)
    .set({
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledBy: access.userId,
      updatedAt: new Date(),
    })
    .where(and(eq(gstFilingRuns.businessId, access.business.id), eq(gstFilingRuns.id, id)))
    .returning()

  if (!updated) {
    throw new HttpError(404, "GST filing run not found.")
  }

  await insertStatusEvent(access, updated, filingRun.status, "FILING_CANCELLED", { reason })
  await insertAuditLog(access, updated.id, "FILING_CANCELLED", filingRun, updated, reason)

  return updated
}

function hasExternalSubmission(filingRun: GstFilingRunRecord) {
  return shouldRecoverExistingFilingSubmission({
    status: filingRun.status,
    externalReference: filingRun.externalReference,
  })
}

function isTerminalFilingStatus(status: string) {
  return terminalStatuses.some((terminalStatus) => terminalStatus === status)
}

async function ensureFilingPayloads(
  access: BusinessAccess,
  filingRun: GstFilingRunRecord,
  reportingRun: GstReportingRunRecord
) {
  const existingCanonical = await db.query.gstFilingPayloads.findFirst({
    where: and(
      eq(gstFilingPayloads.filingRunId, filingRun.id),
      eq(gstFilingPayloads.payloadType, "canonical")
    ),
  })
  const canonicalPayload =
    existingCanonical?.payload ?
      (existingCanonical.payload as CanonicalFilingPayload)
    : await buildCanonicalPayload(filingRun, reportingRun)
  const canonicalHash = existingCanonical?.contentHash ?? hashCanonicalPayload(canonicalPayload)
  const externalPayload = adaptExternalPayload(canonicalPayload)
  const externalHash = hashPayload(externalPayload)

  if (!existingCanonical) {
    await db.insert(gstFilingPayloads).values({
      filingRunId: filingRun.id,
      businessId: access.business.id,
      reportingRunId: reportingRun.id,
      returnType: filingRun.returnType,
      payloadType: "canonical",
      schemaVersion: canonicalPayload.schemaVersion,
      contentHash: canonicalHash,
      payload: canonicalPayload,
      generatedBy: access.userId,
    })
  }

  const existingExternal = await db.query.gstFilingPayloads.findFirst({
    where: and(
      eq(gstFilingPayloads.filingRunId, filingRun.id),
      eq(gstFilingPayloads.payloadType, "external")
    ),
  })

  if (!existingExternal) {
    await db.insert(gstFilingPayloads).values({
      filingRunId: filingRun.id,
      businessId: access.business.id,
      reportingRunId: reportingRun.id,
      returnType: filingRun.returnType,
      payloadType: "external",
      schemaVersion: canonicalPayload.schemaVersion,
      contentHash: externalHash,
      payload: externalPayload,
      generatedBy: access.userId,
    })
  }

  return { canonicalPayload, canonicalHash, externalPayload, externalHash }
}

async function buildCanonicalPayload(
  filingRun: GstFilingRunRecord,
  reportingRun: GstReportingRunRecord
): Promise<CanonicalFilingPayload> {
  const returnType = filingRun.returnType as GstFilingReturnType

  if (returnType === "GSTR1") {
    const dataset = await getGstr1Dataset(reportingRun)

    return {
      returnType,
      gstin: reportingRun.gstinSnapshot ?? "",
      period: reportingRun.period,
      schemaVersion: schemaVersionForReturnType(returnType),
      reportingRun: reportingRunSnapshot(reportingRun),
      sections: {
        sections: dataset.sections,
        hsn: dataset.hsn,
        documents: dataset.documents,
        rows: dataset.rows,
      },
      totals: dataset.totals,
      generatedAt: new Date().toISOString(),
    }
  }

  const dataset = await getGstr3bDataset(reportingRun)

  return {
    returnType,
    gstin: reportingRun.gstinSnapshot ?? "",
    period: reportingRun.period,
    schemaVersion: schemaVersionForReturnType(returnType),
    reportingRun: reportingRunSnapshot(reportingRun),
    sections: {
      outward: dataset.outward,
      itc: dataset.itc,
    },
    totals: dataset.totals,
    generatedAt: new Date().toISOString(),
  }
}

function adaptExternalPayload(payload: CanonicalFilingPayload) {
  return {
    schemaVersion: payload.schemaVersion,
    returnType: payload.returnType,
    gstin: payload.gstin,
    fp: payload.period.replace("-", ""),
    source: {
      reportingRunId: payload.reportingRun.id,
      reportingRunVersion: payload.reportingRun.version,
      sourceDataHash: payload.reportingRun.sourceDataHash,
    },
    data: payload.sections,
    totals: payload.totals,
  }
}

function reportingRunSnapshot(run: GstReportingRunRecord) {
  return {
    id: run.id,
    version: run.version,
    sourceDataHash: run.sourceDataHash ?? "",
    generatedAt: run.generatedAt?.toISOString() ?? null,
    approvedAt: run.approvedAt?.toISOString() ?? null,
    readyForSubmissionAt: run.readyForSubmissionAt?.toISOString() ?? null,
  }
}

async function applyAdapterResult(
  access: BusinessAccess,
  filingRun: GstFilingRunRecord,
  result: MockAdapterResult,
  eventType: string
) {
  const now = new Date()
  const [updated] = await db
    .update(gstFilingRuns)
    .set({
      status: result.status,
      externalReference: result.externalReference ?? filingRun.externalReference,
      acknowledgementNumber:
        result.acknowledgementNumber ?? filingRun.acknowledgementNumber,
      acknowledgementDate:
        result.acknowledgementDate ? new Date(result.acknowledgementDate) : filingRun.acknowledgementDate,
      submittedAt: filingRun.submittedAt ?? now,
      submittedBy: filingRun.submittedBy ?? access.userId,
      acceptedAt: result.status === "ACCEPTED" ? now : filingRun.acceptedAt,
      filedAt: result.status === "FILED" ? now : filingRun.filedAt,
      rejectedAt: result.status === "REJECTED" ? now : filingRun.rejectedAt,
      failedAt: result.status === "FAILED" ? now : filingRun.failedAt,
      lastPolledAt: eventType === "FILING_STATUS_UPDATED" ? now : filingRun.lastPolledAt,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      rawExternalResponse: result.rawResponse,
      externalResponseReceivedAt: now,
      correctionRequiredAt:
        result.status === "REJECTED" ? now : filingRun.correctionRequiredAt,
      correctionReason:
        result.status === "REJECTED" ? result.errorMessage : filingRun.correctionReason,
      updatedAt: now,
    })
    .where(
      and(
        eq(gstFilingRuns.businessId, access.business.id),
        eq(gstFilingRuns.id, filingRun.id)
      )
    )
    .returning()

  if (!updated) {
    throw new HttpError(404, "GST filing run not found.")
  }

  await insertStatusEvent(access, updated, filingRun.status, eventType, result)
  await insertAuditLog(access, updated.id, eventType, filingRun, updated, result.errorMessage)

  return updated
}

async function markReportingRunSubmitted(access: BusinessAccess, reportingRunId: string) {
  await db
    .update(gstReportingRuns)
    .set({
      status: "SUBMITTED",
      submittedAt: new Date(),
      submittedBy: access.userId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(gstReportingRuns.businessId, access.business.id),
        eq(gstReportingRuns.id, reportingRunId),
        eq(gstReportingRuns.status, "READY_FOR_SUBMISSION")
      )
    )
}

async function markReportingRunFiled(access: BusinessAccess, reportingRunId: string) {
  await db
    .update(gstReportingRuns)
    .set({
      status: "FILED",
      filedAt: new Date(),
      filedBy: access.userId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(gstReportingRuns.businessId, access.business.id),
        eq(gstReportingRuns.id, reportingRunId)
      )
    )
}

async function requireReportingRunForFiling(businessId: string, id: string) {
  const reportingRun = await db.query.gstReportingRuns.findFirst({
    where: and(eq(gstReportingRuns.businessId, businessId), eq(gstReportingRuns.id, id)),
  })

  if (!reportingRun) {
    throw new HttpError(404, "GST reporting run not found.")
  }

  return reportingRun
}

function assertReportingRunReady(reportingRun: GstReportingRunRecord) {
  if (reportingRun.status !== "READY_FOR_SUBMISSION") {
    throw new HttpError(
      409,
      "GST report must be ready for submission before creating a filing run."
    )
  }

  if (!reportingRun.sourceDataHash) {
    throw new HttpError(409, "GST report source hash is missing. Refresh the report.")
  }

  if (!reportingRun.approvedAt) {
    throw new HttpError(409, "CA approval is required before filing.")
  }
}

async function requireFilingRun(businessId: string, id: string) {
  const filingRun = await db.query.gstFilingRuns.findFirst({
    where: and(eq(gstFilingRuns.businessId, businessId), eq(gstFilingRuns.id, id)),
  })

  if (!filingRun) {
    throw new HttpError(404, "GST filing run not found.")
  }

  return filingRun
}

async function findLatestFilingRun(
  businessId: string,
  reportingRunId: string,
  returnType: GstFilingReturnType
) {
  const [latest] = await db
    .select()
    .from(gstFilingRuns)
    .where(
      and(
        eq(gstFilingRuns.businessId, businessId),
        eq(gstFilingRuns.reportingRunId, reportingRunId),
        eq(gstFilingRuns.returnType, returnType)
      )
    )
    .orderBy(desc(gstFilingRuns.attemptNumber), desc(gstFilingRuns.createdAt))
    .limit(1)

  return latest ?? null
}

async function listFilingRuns(
  businessId: string,
  query: ListGstFilingRunsQueryInput
) {
  const conditions: SQL[] = [eq(gstFilingRuns.businessId, businessId)]

  if (query.period) {
    conditions.push(eq(gstFilingRuns.period, query.period))
  }

  if (query.gstRegistrationId) {
    conditions.push(eq(gstFilingRuns.gstRegistrationId, query.gstRegistrationId))
  }

  if (query.reportingRunId) {
    conditions.push(eq(gstFilingRuns.reportingRunId, query.reportingRunId))
  }

  if (query.returnType) {
    conditions.push(eq(gstFilingRuns.returnType, query.returnType))
  }

  if (query.status) {
    conditions.push(eq(gstFilingRuns.status, query.status))
  }

  const offset = (query.page - 1) * query.limit
  const [runs, countRows] = await Promise.all([
    db
      .select()
      .from(gstFilingRuns)
      .where(and(...conditions))
      .orderBy(desc(gstFilingRuns.period), desc(gstFilingRuns.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.select({ id: gstFilingRuns.id }).from(gstFilingRuns).where(and(...conditions)),
  ])

  return {
    filingRuns: runs,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: countRows.length,
      hasMore: offset + runs.length < countRows.length,
    },
  }
}

async function getFilingRunDetail(businessId: string, id: string) {
  const filingRun = await requireFilingRun(businessId, id)
  const [payloads, events] = await Promise.all([
    db
      .select()
      .from(gstFilingPayloads)
      .where(eq(gstFilingPayloads.filingRunId, id))
      .orderBy(desc(gstFilingPayloads.generatedAt)),
    db
      .select()
      .from(gstFilingStatusEvents)
      .where(eq(gstFilingStatusEvents.filingRunId, id))
      .orderBy(desc(gstFilingStatusEvents.createdAt)),
  ])

  return { filingRun, payloads, events }
}

async function insertStatusEvent(
  access: BusinessAccess,
  filingRun: GstFilingRunRecord,
  previousStatus: string | null,
  eventType: string,
  payload: unknown
) {
  await db.insert(gstFilingStatusEvents).values({
    businessId: access.business.id,
    filingRunId: filingRun.id,
    previousStatus,
    status: filingRun.status,
    eventType,
    message: eventMessage(eventType, filingRun.status),
    externalReference: filingRun.externalReference,
    rawResponse: toJsonObject(payload),
    createdBy: access.userId,
  })
}

async function runFilingIdempotency<T>(
  access: BusinessAccess,
  operationScope: string,
  idempotencyKey: string,
  payload: unknown,
  handler: () => Promise<T>
) {
  const requestHash = buildFilingOperationRequestHash(payload)
  const existing = await db.query.gstFilingIdempotencyKeys.findFirst({
    where: and(
      eq(gstFilingIdempotencyKeys.businessId, access.business.id),
      eq(gstFilingIdempotencyKeys.operationScope, operationScope),
      eq(gstFilingIdempotencyKeys.idempotencyKey, idempotencyKey)
    ),
  })

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new HttpError(409, "This idempotency key was already used with another payload.")
    }

    return existing.responseBody as T
  }

  await db.insert(gstFilingIdempotencyKeys).values({
    businessId: access.business.id,
    operationScope,
    idempotencyKey,
    requestHash,
    status: "processing",
  })

  const result = await handler()

  await db
    .update(gstFilingIdempotencyKeys)
    .set({
      responseBody: result as Record<string, unknown>,
      status: "completed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(gstFilingIdempotencyKeys.businessId, access.business.id),
        eq(gstFilingIdempotencyKeys.operationScope, operationScope),
        eq(gstFilingIdempotencyKeys.idempotencyKey, idempotencyKey)
      )
    )

  return result
}

async function assertCanUseGst(access: BusinessAccess, action: GstAction) {
  if (access.membership.role === "owner" || access.membership.role === "admin") {
    return
  }

  const permissionColumn =
    action === "view" ? businessMemberPermissions.canView
    : action === "create" ? businessMemberPermissions.canCreate
    : action === "edit" ? businessMemberPermissions.canEdit
    : businessMemberPermissions.canDelete

  const permission = await db.query.businessMemberPermissions.findFirst({
    where: and(
      eq(businessMemberPermissions.businessMemberId, access.membership.id),
      eq(businessMemberPermissions.module, "gstr"),
      eq(permissionColumn, true)
    ),
  })

  if (!permission) {
    throw new HttpError(403, "You do not have permission to access GST filing.")
  }
}

async function insertAuditLog(
  access: BusinessAccess,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown,
  reason: string | null
) {
  await db.insert(auditLogs).values({
    businessId: access.business.id,
    entityType: "gst_filing_run",
    entityId,
    action,
    userId: access.userId,
    before: toJsonObject(before),
    after: toJsonObject(after),
    reason,
  })
}

function resolveOperationIdempotencyKey(
  headerValue: string | string[] | undefined,
  bodyValue: string | undefined
) {
  const resolvedHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue
  const key = bodyValue ?? resolvedHeader

  if (!key) {
    throw new HttpError(400, "Idempotency key is required.")
  }

  return key
}

function eventMessage(eventType: string, status: string) {
  const labels: Record<string, string> = {
    FILING_RUN_CREATED: "GST filing run created.",
    FILING_VALIDATED: "GST filing payload validated.",
    FILING_SUBMITTED: "GST filing submitted to the configured adapter.",
    FILING_STATUS_UPDATED: "GST filing status updated from the adapter.",
    FILING_RETRY: "GST filing retry created.",
    FILING_CANCELLED: "GST filing run cancelled.",
  }

  return labels[eventType] ?? `GST filing status is ${status}.`
}

function toJsonObject(value: unknown) {
  if (!value || typeof value !== "object") {
    return value === undefined ? null : { value }
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}
