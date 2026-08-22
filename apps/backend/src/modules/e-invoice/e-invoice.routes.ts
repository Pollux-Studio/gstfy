import {
  and,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql as drizzleSql,
  type SQL,
} from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { db } from "../../db/client.js"
import {
  adjustmentDocumentLines,
  adjustmentDocuments,
  auditLogs,
  businessLocations,
  businessMemberPermissions,
  businessProfiles,
  eInvoiceIdempotencyKeys,
  eInvoicePayloads,
  eInvoiceRecords,
  eInvoiceStatusEvents,
  gstRegistrations,
  parties,
  partyAddresses,
  partyGstRegistrations,
  salesInvoiceLines,
  salesInvoices,
  type EInvoiceRecord,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"
import { getEInvoiceProviderAdapter } from "./e-invoice.adapters.js"
import {
  assertEInvoiceStatusTransition,
  buildEInvoiceOperationRequestHash,
  canRetryEInvoiceTechnically,
  checkEInvoiceEligibility,
  eInvoiceSchemaVersion,
  hashPayload,
  shouldRecoverExistingEInvoiceSubmission,
  validateCanonicalEInvoicePayload,
  type CanonicalEInvoicePayload,
  type EInvoiceEligibilityResult,
  type EInvoiceMockMode,
  type EInvoicePartySnapshot,
  type EInvoiceSourceDocumentType,
  type EInvoiceSubmissionStatus,
  type EInvoiceValidationResult,
} from "./e-invoice.domain.js"
import {
  cancelEInvoiceSchema,
  createEInvoiceRecordSchema,
  eInvoiceActionSchema,
  eInvoiceEligibilityQuerySchema,
  eInvoiceRecordParamsSchema,
  generateEInvoiceSchema,
  listEInvoiceRecordsQuerySchema,
  type CreateEInvoiceRecordInput,
  type ListEInvoiceRecordsQueryInput,
} from "./e-invoice.schemas.js"

type BusinessAccess = Awaited<ReturnType<typeof requirePrimaryBusinessAccess>>
type GstAction = "view" | "create" | "edit" | "delete"

type SourceContext = {
  sourceDocumentType: EInvoiceSourceDocumentType
  sourceDocumentId: string
  sourceSalesInvoiceId: string | null
  sourceAdjustmentDocumentId: string | null
  voucherId: string | null
  documentNumber: string
  documentDate: string
  status: string
  gstRegistrationId: string | null
  branchId: string | null
  partyId: string | null
  partyGstin: string | null
  invoiceType: string | null
  supplyType: string | null
  placeOfSupplyStateCode: string | null
  totals: {
    taxableValue: string
    cgstAmount: string
    sgstAmount: string
    igstAmount: string
    cessAmount: string
    totalAmount: string
  }
  references: CanonicalEInvoicePayload["references"]
  lines: CanonicalEInvoicePayload["items"]
  supplier: EInvoicePartySnapshot
  recipient: EInvoicePartySnapshot
}

export async function registerEInvoiceRoutes(app: FastifyInstance) {
  app.get("/e-invoices", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseEInvoice(access, "view")
    const query = listEInvoiceRecordsQuerySchema.parse(request.query)

    return listEInvoiceRecords(access.business.id, query)
  })

  app.get("/e-invoices/eligibility", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseEInvoice(access, "view")
    const query = eInvoiceEligibilityQuerySchema.parse(request.query)

    return {
      eligibility: await getSourceEligibility(access.business.id, query),
    }
  })

  app.post("/e-invoices", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseEInvoice(access, "create")
    const body = createEInvoiceRecordSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runEInvoiceIdempotency(
      access,
      `e-invoice-create:${body.sourceDocumentType}:${body.sourceDocumentId}`,
      idempotencyKey,
      body,
      async () => ({ eInvoice: await createEInvoiceRecord(access, body) })
    )
  })

  app.get("/e-invoices/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseEInvoice(access, "view")
    const { id } = eInvoiceRecordParamsSchema.parse(request.params)

    return getEInvoiceDetail(access.business.id, id)
  })

  app.post("/e-invoices/:id/validate", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseEInvoice(access, "edit")
    const { id } = eInvoiceRecordParamsSchema.parse(request.params)
    const body = eInvoiceActionSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runEInvoiceIdempotency(
      access,
      `e-invoice-validate:${id}`,
      idempotencyKey,
      body,
      async () => validateEInvoiceRecord(access, id)
    )
  })

  app.post("/e-invoices/:id/generate", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseEInvoice(access, "edit")
    const { id } = eInvoiceRecordParamsSchema.parse(request.params)
    const body = generateEInvoiceSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runEInvoiceIdempotency(
      access,
      `e-invoice-generate:${id}`,
      idempotencyKey,
      body,
      async () => generateEInvoice(access, id, body.mockMode)
    )
  })

  app.post("/e-invoices/:id/status", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseEInvoice(access, "edit")
    const { id } = eInvoiceRecordParamsSchema.parse(request.params)
    const body = eInvoiceActionSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runEInvoiceIdempotency(
      access,
      `e-invoice-status:${id}`,
      idempotencyKey,
      body,
      async () => pollEInvoiceStatus(access, id)
    )
  })

  app.post("/e-invoices/:id/retry", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseEInvoice(access, "edit")
    const { id } = eInvoiceRecordParamsSchema.parse(request.params)
    const body = eInvoiceActionSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runEInvoiceIdempotency(
      access,
      `e-invoice-retry:${id}`,
      idempotencyKey,
      body,
      async () => ({ eInvoice: await retryEInvoice(access, id, body.reason) })
    )
  })

  app.post("/e-invoices/:id/cancel", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseEInvoice(access, "delete")
    const { id } = eInvoiceRecordParamsSchema.parse(request.params)
    const body = cancelEInvoiceSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runEInvoiceIdempotency(
      access,
      `e-invoice-cancel:${id}`,
      idempotencyKey,
      body,
      async () => cancelEInvoice(access, id, body.reason, body.mockMode)
    )
  })

  app.get("/e-invoices/:id/response", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseEInvoice(access, "view")
    const { id } = eInvoiceRecordParamsSchema.parse(request.params)
    const detail = await getEInvoiceDetail(access.business.id, id)

    return {
      response: detail.payloads.find((payload) => payload.payloadType === "response") ?? null,
      canonicalPayload:
        detail.payloads.find((payload) => payload.payloadType === "canonical") ?? null,
      events: detail.events,
    }
  })
}

async function createEInvoiceRecord(
  access: BusinessAccess,
  input: CreateEInvoiceRecordInput
) {
  const existing = await findExistingEInvoiceRecord(
    access.business.id,
    input.sourceDocumentType,
    input.sourceDocumentId
  )

  if (existing) {
    return existing
  }

  const source = await buildSourceContext(
    access.business.id,
    input.sourceDocumentType,
    input.sourceDocumentId
  )
  const eligibility = checkEInvoiceEligibility({
    sourceDocumentType: source.sourceDocumentType,
    status: source.status,
    gstRegistrationId: source.gstRegistrationId,
    partyGstin: source.partyGstin,
    invoiceType: source.invoiceType,
    supplyType: source.supplyType,
    documentDate: source.documentDate,
    linesCount: source.lines.length,
  })
  const payload = buildCanonicalPayload(source)
  const validation = validateCanonicalEInvoicePayload(payload)
  const submissionStatus = initialSubmissionStatus(eligibility, validation)

  if (!source.gstRegistrationId) {
    throw new HttpError(409, "Supplier GST registration is required.")
  }

  const [record] = await db
    .insert(eInvoiceRecords)
    .values({
      businessId: access.business.id,
      gstRegistrationId: source.gstRegistrationId,
      sourceDocumentType: source.sourceDocumentType,
      sourceDocumentId: source.sourceDocumentId,
      sourceSalesInvoiceId: source.sourceSalesInvoiceId,
      sourceAdjustmentDocumentId: source.sourceAdjustmentDocumentId,
      sourceVoucherId: source.voucherId,
      sourceDocumentNumber: source.documentNumber,
      documentDate: source.documentDate,
      partyId: source.partyId,
      partyGstin: source.partyGstin,
      eligibilityStatus: eligibility.status,
      submissionStatus,
      payloadSchemaVersion: payload.schemaVersion,
      payloadHash: validation.payloadHash,
      validationResult: validation,
      createdBy: access.userId,
    })
    .returning()

  if (!record) {
    throw new HttpError(500, "Unable to create e-invoice record.")
  }

  await upsertPayload(access, record, "canonical", payload.schemaVersion, payload)
  await insertStatusEvent(access, record, null, "EINV_ELIGIBILITY_CHECKED", {
    eligibility,
    validation,
  })
  await insertAuditLog(access, record.id, "EINV_RECORD_CREATED", null, record, null)

  return record
}

async function validateEInvoiceRecord(access: BusinessAccess, id: string) {
  const record = await requireEInvoiceRecord(access.business.id, id)
  const transition = assertEInvoiceStatusTransition(
    record.submissionStatus,
    ["ELIGIBLE", "READY", "VALIDATION_FAILED", "FAILED"],
    "be validated"
  )

  if (!transition.valid) {
    throw new HttpError(409, transition.message ?? "E-invoice cannot be validated.")
  }

  const payload = await getOrBuildCanonicalPayload(access, record)
  const validation = validateCanonicalEInvoicePayload(payload)
  const previousStatus = record.submissionStatus
  const [updated] = await db
    .update(eInvoiceRecords)
    .set({
      submissionStatus: validation.canSubmit ? "READY" : "VALIDATION_FAILED",
      payloadSchemaVersion: validation.schemaVersion,
      payloadHash: validation.payloadHash,
      validationResult: validation,
      errorCode: validation.canSubmit ? null : "VALIDATION_FAILED",
      errorMessage:
        validation.canSubmit ? null : validation.blockingIssues[0]?.message ?? "Validation failed.",
      updatedAt: new Date(),
    })
    .where(and(eq(eInvoiceRecords.businessId, access.business.id), eq(eInvoiceRecords.id, id)))
    .returning()

  if (!updated) {
    throw new HttpError(404, "E-invoice record not found.")
  }

  await insertStatusEvent(access, updated, previousStatus, "EINV_VALIDATED", validation)
  await insertAuditLog(access, updated.id, "EINV_VALIDATED", record, updated, null)

  return { eInvoice: updated, validation }
}

async function generateEInvoice(
  access: BusinessAccess,
  id: string,
  mockMode: EInvoiceMockMode
) {
  const record = await requireEInvoiceRecord(access.business.id, id)
  const transition = assertEInvoiceStatusTransition(
    record.submissionStatus,
    ["READY", "FAILED"],
    "generate IRN"
  )

  if (!transition.valid) {
    if (
      shouldRecoverExistingEInvoiceSubmission({
        status: record.submissionStatus,
        providerReference: record.providerReference,
        irn: record.irn,
      })
    ) {
      return { eInvoice: record, recovered: true }
    }

    throw new HttpError(409, transition.message ?? "E-invoice cannot be generated.")
  }

  const payload = await getOrBuildCanonicalPayload(access, record)
  const validation = validateCanonicalEInvoicePayload(payload)

  if (!validation.canSubmit) {
    const [updated] = await db
      .update(eInvoiceRecords)
      .set({
        submissionStatus: "VALIDATION_FAILED",
        validationResult: validation,
        errorCode: "VALIDATION_FAILED",
        errorMessage: validation.blockingIssues[0]?.message ?? "Validation failed.",
        updatedAt: new Date(),
      })
      .where(and(eq(eInvoiceRecords.businessId, access.business.id), eq(eInvoiceRecords.id, id)))
      .returning()

    if (!updated) {
      throw new HttpError(404, "E-invoice record not found.")
    }

    await insertStatusEvent(access, updated, record.submissionStatus, "EINV_VALIDATED", validation)
    return { eInvoice: updated, validation }
  }

  const adapter = getEInvoiceProviderAdapter(record.providerName)
  const providerPayload = toProviderPayload(payload)
  const providerValidation = adapter.validate(payload)
  const submittedAt = new Date()
  const submitResult = adapter.generateIRN({
    mode: mockMode,
    payload,
    payloadHash: validation.payloadHash,
  })
  const nextStatus = submitResult.status
  const [updated] = await db
    .update(eInvoiceRecords)
    .set({
      submissionStatus: nextStatus,
      providerMode: mockMode,
      providerReference: submitResult.providerReference,
      payloadSchemaVersion: validation.schemaVersion,
      payloadHash: validation.payloadHash,
      validationResult: validation,
      irn: submitResult.irn,
      ackNumber: submitResult.ackNumber,
      ackDate: submitResult.ackDate ? new Date(submitResult.ackDate) : null,
      signedInvoiceReference: submitResult.signedInvoiceReference,
      signedQrCode: submitResult.signedQrCode,
      rawResponseReference:
        submitResult.providerReference ? `mock://response/${submitResult.providerReference}` : null,
      errorCode: submitResult.errorCode,
      errorMessage: submitResult.errorMessage,
      rawExternalResponse: submitResult.rawResponse,
      externalResponseReceivedAt: new Date(),
      submittedAt,
      submittedBy: access.userId,
      generatedAt: nextStatus === "IRN_GENERATED" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(eInvoiceRecords.businessId, access.business.id), eq(eInvoiceRecords.id, id)))
    .returning()

  if (!updated) {
    throw new HttpError(404, "E-invoice record not found.")
  }

  await upsertPayload(access, updated, "provider", payload.schemaVersion, providerPayload)
  await upsertPayload(access, updated, "response", payload.schemaVersion, submitResult.rawResponse)
  await insertStatusEvent(access, updated, record.submissionStatus, "EINV_SUBMITTED", {
    providerValidation,
    submitResult,
  })
  await insertAuditLog(access, updated.id, "EINV_SUBMITTED", record, updated, null)

  return { eInvoice: updated, validation }
}

async function pollEInvoiceStatus(access: BusinessAccess, id: string) {
  const record = await requireEInvoiceRecord(access.business.id, id)
  const transition = assertEInvoiceStatusTransition(
    record.submissionStatus,
    ["SUBMITTING", "PROCESSING", "IRN_GENERATED"],
    "poll provider status"
  )

  if (!transition.valid) {
    throw new HttpError(409, transition.message ?? "E-invoice status cannot be polled.")
  }

  const adapter = getEInvoiceProviderAdapter(record.providerName)
  const statusResult = adapter.getStatus({
    currentStatus: record.submissionStatus as EInvoiceSubmissionStatus,
    mode: record.providerMode as EInvoiceMockMode | null,
    providerReference: record.providerReference,
    irn: record.irn,
  })
  const [updated] = await db
    .update(eInvoiceRecords)
    .set({
      submissionStatus: statusResult.status,
      providerReference: statusResult.providerReference,
      irn: statusResult.irn,
      ackNumber: statusResult.ackNumber,
      ackDate: statusResult.ackDate ? new Date(statusResult.ackDate) : record.ackDate,
      signedInvoiceReference: statusResult.signedInvoiceReference,
      signedQrCode: statusResult.signedQrCode,
      errorCode: statusResult.errorCode,
      errorMessage: statusResult.errorMessage,
      rawExternalResponse: statusResult.rawResponse,
      externalResponseReceivedAt: new Date(),
      generatedAt:
        statusResult.status === "IRN_GENERATED" && !record.generatedAt ?
          new Date()
        : record.generatedAt,
      updatedAt: new Date(),
    })
    .where(and(eq(eInvoiceRecords.businessId, access.business.id), eq(eInvoiceRecords.id, id)))
    .returning()

  if (!updated) {
    throw new HttpError(404, "E-invoice record not found.")
  }

  await upsertPayload(access, updated, "response", updated.payloadSchemaVersion ?? eInvoiceSchemaVersion(), statusResult.rawResponse)
  await insertStatusEvent(access, updated, record.submissionStatus, "EINV_STATUS_UPDATED", statusResult)
  await insertAuditLog(access, updated.id, "EINV_STATUS_UPDATED", record, updated, null)

  return { eInvoice: updated }
}

async function retryEInvoice(
  access: BusinessAccess,
  id: string,
  reason: string | null
) {
  const record = await requireEInvoiceRecord(access.business.id, id)

  if (!canRetryEInvoiceTechnically(record.submissionStatus)) {
    throw new HttpError(409, "Only failed e-invoice operations can be retried.")
  }

  const nextStatus =
    record.submissionStatus === "CANCELLATION_FAILED" ? "IRN_GENERATED" : "READY"
  const [updated] = await db
    .update(eInvoiceRecords)
    .set({
      submissionStatus: nextStatus,
      attemptNumber: record.attemptNumber + 1,
      errorCode: null,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(and(eq(eInvoiceRecords.businessId, access.business.id), eq(eInvoiceRecords.id, id)))
    .returning()

  if (!updated) {
    throw new HttpError(404, "E-invoice record not found.")
  }

  await insertStatusEvent(access, updated, record.submissionStatus, "EINV_RETRY", { reason })
  await insertAuditLog(access, updated.id, "EINV_RETRY", record, updated, reason)

  return updated
}

async function cancelEInvoice(
  access: BusinessAccess,
  id: string,
  reason: string,
  mockMode: EInvoiceMockMode
) {
  const record = await requireEInvoiceRecord(access.business.id, id)
  const transition = assertEInvoiceStatusTransition(
    record.submissionStatus,
    ["IRN_GENERATED"],
    "be cancelled"
  )

  if (!transition.valid) {
    throw new HttpError(409, transition.message ?? "E-invoice cannot be cancelled.")
  }

  if (!record.irn) {
    throw new HttpError(409, "IRN is required before cancellation.")
  }

  if (!canCancelIrn(record.generatedAt)) {
    throw new HttpError(409, "IRN cancellation window has expired.")
  }

  const adapter = getEInvoiceProviderAdapter(record.providerName)
  const cancelResult = adapter.cancelIRN({
    mode: mockMode,
    providerReference: record.providerReference,
    irn: record.irn,
    reason,
  })
  const [updated] = await db
    .update(eInvoiceRecords)
    .set({
      submissionStatus: cancelResult.status,
      providerMode: mockMode,
      errorCode: cancelResult.errorCode,
      errorMessage: cancelResult.errorMessage,
      rawExternalResponse: cancelResult.rawResponse,
      externalResponseReceivedAt: new Date(),
      cancelledAt: cancelResult.status === "CANCELLED" ? new Date() : null,
      cancelledBy: cancelResult.status === "CANCELLED" ? access.userId : null,
      cancelReason: reason,
      updatedAt: new Date(),
    })
    .where(and(eq(eInvoiceRecords.businessId, access.business.id), eq(eInvoiceRecords.id, id)))
    .returning()

  if (!updated) {
    throw new HttpError(404, "E-invoice record not found.")
  }

  await upsertPayload(access, updated, "cancellation", updated.payloadSchemaVersion ?? eInvoiceSchemaVersion(), cancelResult.rawResponse)
  await insertStatusEvent(
    access,
    updated,
    record.submissionStatus,
    cancelResult.status === "CANCELLED" ? "EINV_CANCELLED" : "EINV_CANCEL_FAILED",
    cancelResult
  )
  await insertAuditLog(access, updated.id, "EINV_CANCELLED", record, updated, reason)

  return { eInvoice: updated }
}

async function listEInvoiceRecords(
  businessId: string,
  query: ListEInvoiceRecordsQueryInput
) {
  const conditions: SQL[] = [eq(eInvoiceRecords.businessId, businessId)]

  if (query.status) {
    conditions.push(eq(eInvoiceRecords.submissionStatus, query.status))
  }

  if (query.sourceDocumentType) {
    conditions.push(eq(eInvoiceRecords.sourceDocumentType, query.sourceDocumentType))
  }

  if (query.gstRegistrationId) {
    conditions.push(eq(eInvoiceRecords.gstRegistrationId, query.gstRegistrationId))
  }

  if (query.fromDate) {
    conditions.push(gte(eInvoiceRecords.documentDate, query.fromDate))
  }

  if (query.toDate) {
    conditions.push(lte(eInvoiceRecords.documentDate, query.toDate))
  }

  if (query.search) {
    const term = `%${escapeLikeTerm(query.search)}%`
    const searchCondition = or(
      ilike(eInvoiceRecords.sourceDocumentNumber, term),
      ilike(eInvoiceRecords.partyGstin, term),
      ilike(eInvoiceRecords.irn, term),
      ilike(eInvoiceRecords.ackNumber, term)
    )

    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  const offset = (query.page - 1) * query.limit
  const [countRow, records] = await Promise.all([
    db
      .select({ total: drizzleSql<number>`count(*)::int` })
      .from(eInvoiceRecords)
      .where(and(...conditions)),
    db
      .select()
      .from(eInvoiceRecords)
      .where(and(...conditions))
      .orderBy(desc(eInvoiceRecords.documentDate), desc(eInvoiceRecords.createdAt))
      .limit(query.limit)
      .offset(offset),
  ])

  return {
    eInvoices: records,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: countRow[0]?.total ?? 0,
      hasMore: query.page * query.limit < (countRow[0]?.total ?? 0),
    },
  }
}

async function getEInvoiceDetail(businessId: string, id: string) {
  const eInvoice = await requireEInvoiceRecord(businessId, id)
  const [payloads, events] = await Promise.all([
    db
      .select()
      .from(eInvoicePayloads)
      .where(eq(eInvoicePayloads.eInvoiceRecordId, id))
      .orderBy(desc(eInvoicePayloads.generatedAt)),
    db
      .select()
      .from(eInvoiceStatusEvents)
      .where(eq(eInvoiceStatusEvents.eInvoiceRecordId, id))
      .orderBy(desc(eInvoiceStatusEvents.createdAt)),
  ])

  return { eInvoice, payloads, events }
}

async function getSourceEligibility(
  businessId: string,
  input: { sourceDocumentType: EInvoiceSourceDocumentType; sourceDocumentId: string }
) {
  const existing = await findExistingEInvoiceRecord(
    businessId,
    input.sourceDocumentType,
    input.sourceDocumentId
  )
  const source = await buildSourceContext(
    businessId,
    input.sourceDocumentType,
    input.sourceDocumentId
  )

  return checkEInvoiceEligibility({
    sourceDocumentType: source.sourceDocumentType,
    status: source.status,
    existingSubmissionStatus: existing?.submissionStatus,
    gstRegistrationId: source.gstRegistrationId,
    partyGstin: source.partyGstin,
    invoiceType: source.invoiceType,
    supplyType: source.supplyType,
    documentDate: source.documentDate,
    linesCount: source.lines.length,
  })
}

async function buildSourceContext(
  businessId: string,
  sourceDocumentType: EInvoiceSourceDocumentType,
  sourceDocumentId: string
): Promise<SourceContext> {
  if (sourceDocumentType === "sales_invoice") {
    const invoice = await db.query.salesInvoices.findFirst({
      where: and(eq(salesInvoices.businessId, businessId), eq(salesInvoices.id, sourceDocumentId)),
    })

    if (!invoice) {
      throw new HttpError(404, "Sales invoice not found.")
    }

    const lines = await db
      .select()
      .from(salesInvoiceLines)
      .where(eq(salesInvoiceLines.salesInvoiceId, sourceDocumentId))
      .orderBy(salesInvoiceLines.sortOrder)
    const supplier = await resolveSupplierSnapshot(businessId, invoice.gstRegistrationId)
    const recipient = await resolveRecipientSnapshot(
      businessId,
      invoice.partyId,
      invoice.partySnapshot,
      invoice.customerName
    )

    return {
      sourceDocumentType,
      sourceDocumentId,
      sourceSalesInvoiceId: sourceDocumentId,
      sourceAdjustmentDocumentId: null,
      voucherId: invoice.voucherId,
      documentNumber: invoice.invoiceNumber,
      documentDate: invoice.invoiceDate,
      status: invoice.status,
      gstRegistrationId: invoice.gstRegistrationId,
      branchId: invoice.branchId,
      partyId: invoice.partyId,
      partyGstin: recipient.gstin,
      invoiceType: invoice.invoiceType,
      supplyType: invoice.supplyType,
      placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
      totals: {
        taxableValue: invoice.taxableValue,
        cgstAmount: invoice.cgstAmount,
        sgstAmount: invoice.sgstAmount,
        igstAmount: invoice.igstAmount,
        cessAmount: invoice.cessAmount,
        totalAmount: invoice.totalAmount,
      },
      references: {
        originalDocumentNumber: null,
        originalDocumentDate: null,
        reason: invoice.notes,
      },
      lines: lines.map((line, index) => ({
        serialNumber: index + 1,
        description: line.itemNameSnapshot,
        hsnSac: line.hsnSacCode,
        uqc: line.unit,
        quantity: line.quantity,
        unitPrice: line.rate,
        discount: line.discountAmount,
        taxableValue: line.taxableValue,
        gstRate: line.gstRate,
        cgstAmount: line.cgstAmount,
        sgstAmount: line.sgstAmount,
        igstAmount: line.igstAmount,
        cessAmount: line.cessAmount,
        totalAmount: line.lineTotal,
      })),
      supplier,
      recipient,
    }
  }

  return buildAdjustmentSourceContext(businessId, sourceDocumentType, sourceDocumentId)
}

async function buildAdjustmentSourceContext(
  businessId: string,
  sourceDocumentType: Extract<EInvoiceSourceDocumentType, "credit_note" | "debit_note">,
  sourceDocumentId: string
): Promise<SourceContext> {
  const adjustment = await db.query.adjustmentDocuments.findFirst({
    where: and(
      eq(adjustmentDocuments.businessId, businessId),
      eq(adjustmentDocuments.id, sourceDocumentId)
    ),
  })

  if (!adjustment) {
    throw new HttpError(404, "Adjustment document not found.")
  }

  const expectedType = sourceDocumentType === "credit_note" ? "CREDIT_NOTE" : "DEBIT_NOTE"

  if (adjustment.adjustmentType !== expectedType) {
    throw new HttpError(400, "Adjustment type does not match the e-invoice source type.")
  }

  const lines = await db
    .select()
    .from(adjustmentDocumentLines)
    .where(eq(adjustmentDocumentLines.adjustmentDocumentId, sourceDocumentId))
    .orderBy(adjustmentDocumentLines.sortOrder)
  const supplier = await resolveSupplierSnapshot(businessId, adjustment.gstRegistrationId)
  const recipient = await resolveRecipientSnapshot(
    businessId,
    adjustment.partyId,
    adjustment.partySnapshot,
    "Registered recipient"
  )

  return {
    sourceDocumentType,
    sourceDocumentId,
    sourceSalesInvoiceId: null,
    sourceAdjustmentDocumentId: sourceDocumentId,
    voucherId: adjustment.voucherId,
    documentNumber: adjustment.adjustmentNumber,
    documentDate: formatDateValue(adjustment.adjustmentDate),
    status: adjustment.status,
    gstRegistrationId: adjustment.gstRegistrationId,
    branchId: adjustment.branchId,
    partyId: adjustment.partyId,
    partyGstin: recipient.gstin,
    invoiceType: expectedType.toLowerCase(),
    supplyType: "b2b",
    placeOfSupplyStateCode: recipient.stateCode,
    totals: {
      taxableValue: adjustment.taxableTotal,
      cgstAmount: adjustment.cgstTotal,
      sgstAmount: adjustment.sgstTotal,
      igstAmount: adjustment.igstTotal,
      cessAmount: adjustment.cessTotal,
      totalAmount: adjustment.grandTotal,
    },
    references: {
      originalDocumentNumber: getSnapshotString(adjustment.sourceSnapshot, "documentNumber"),
      originalDocumentDate: getSnapshotString(adjustment.sourceSnapshot, "documentDate"),
      reason: adjustment.reason,
    },
    lines: lines.map((line, index) => ({
      serialNumber: index + 1,
      description: line.descriptionSnapshot,
      hsnSac: line.hsnSacSnapshot,
      uqc: line.uqcSnapshot ?? line.unit,
      quantity: line.quantity,
      unitPrice: line.rate,
      discount: line.discount,
      taxableValue: line.taxableValue,
      gstRate: line.gstRateSnapshot,
      cgstAmount: line.cgstAmount,
      sgstAmount: line.sgstAmount,
      igstAmount: line.igstAmount,
      cessAmount: line.cessAmount,
      totalAmount: line.lineTotal,
    })),
    supplier,
    recipient,
  }
}

function buildCanonicalPayload(source: SourceContext): CanonicalEInvoicePayload {
  return {
    schemaVersion: eInvoiceSchemaVersion(),
    source: {
      documentType: source.sourceDocumentType,
      documentId: source.sourceDocumentId,
      voucherId: source.voucherId,
    },
    supplier: source.supplier,
    recipient: source.recipient,
    document: {
      number: source.documentNumber,
      date: source.documentDate,
      type: documentTypeCode(source.sourceDocumentType),
      supplyType: source.supplyType ?? "b2b",
      placeOfSupplyStateCode: source.placeOfSupplyStateCode,
    },
    items: source.lines,
    totals: source.totals,
    references: source.references,
    generatedAt: new Date().toISOString(),
  }
}

async function resolveSupplierSnapshot(
  businessId: string,
  gstRegistrationId: string | null
): Promise<EInvoicePartySnapshot> {
  if (!gstRegistrationId) {
    throw new HttpError(409, "Supplier GST registration is required.")
  }

  const registration = await db.query.gstRegistrations.findFirst({
    where: and(
      eq(gstRegistrations.businessId, businessId),
      eq(gstRegistrations.id, gstRegistrationId)
    ),
  })

  if (!registration) {
    throw new HttpError(404, "Supplier GST registration not found.")
  }

  const [location, profile] = await Promise.all([
    registration.principalLocationId ?
      db.query.businessLocations.findFirst({
        where: and(
          eq(businessLocations.businessId, businessId),
          eq(businessLocations.id, registration.principalLocationId)
        ),
      })
    : null,
    db.query.businessProfiles.findFirst({
      where: eq(businessProfiles.businessId, businessId),
    }),
  ])

  return {
    gstin: registration.gstin,
    legalName: registration.legalName,
    tradeName: registration.tradeName,
    displayName: registration.tradeName || registration.legalName,
    addressLine1: location?.addressLine1 ?? profile?.addressLine1 ?? null,
    addressLine2: location?.addressLine2 ?? profile?.addressLine2 ?? null,
    locality: location?.locality ?? profile?.locality ?? null,
    city: location?.city ?? null,
    district: location?.district ?? profile?.district ?? null,
    state: location?.state ?? registration.state,
    stateCode: location?.stateCode ?? profile?.stateCode ?? registration.stateCode,
    pincode: location?.pincode ?? profile?.pincode ?? null,
    country: location?.country ?? "India",
  }
}

async function resolveRecipientSnapshot(
  businessId: string,
  partyId: string | null,
  sourcePartySnapshot: unknown,
  fallbackName: string
): Promise<EInvoicePartySnapshot> {
  const snapshot = toRecord(sourcePartySnapshot)

  if (!partyId) {
    return {
      gstin: getRecordString(snapshot, "gstin"),
      legalName: getRecordString(snapshot, "legalName"),
      tradeName: getRecordString(snapshot, "tradeName"),
      displayName: getRecordString(snapshot, "displayName") ?? fallbackName,
      addressLine1: null,
      addressLine2: null,
      locality: null,
      city: null,
      district: null,
      state: null,
      stateCode: getRecordString(snapshot, "stateCode"),
      pincode: null,
      country: "India",
    }
  }

  const [party, gstRows, addressRows] = await Promise.all([
    db.query.parties.findFirst({
      where: and(eq(parties.businessId, businessId), eq(parties.id, partyId)),
    }),
    db
      .select()
      .from(partyGstRegistrations)
      .where(and(eq(partyGstRegistrations.businessId, businessId), eq(partyGstRegistrations.partyId, partyId))),
    db
      .select()
      .from(partyAddresses)
      .where(and(eq(partyAddresses.businessId, businessId), eq(partyAddresses.partyId, partyId))),
  ])

  const gstSnapshotValue = getRecordString(snapshot, "gstin")
  const gst =
    gstRows.find((row) => row.gstin === gstSnapshotValue) ??
    gstRows.find((row) => row.isPrimary && row.status === "active") ??
    gstRows.find((row) => row.status === "active") ??
    null
  const address =
    addressRows.find((row) => row.id === gst?.registeredAddressId) ??
    addressRows.find((row) => row.isPrimary && row.isActive) ??
    addressRows.find((row) => row.isActive) ??
    null

  return {
    gstin: gst?.gstin ?? gstSnapshotValue,
    legalName: gst?.legalName ?? party?.legalName ?? getRecordString(snapshot, "legalName"),
    tradeName: gst?.tradeName ?? party?.tradeName ?? getRecordString(snapshot, "tradeName"),
    displayName: party?.displayName ?? getRecordString(snapshot, "displayName") ?? fallbackName,
    addressLine1: address?.addressLine1 ?? null,
    addressLine2: address?.addressLine2 ?? null,
    locality: address?.locality ?? null,
    city: address?.city ?? null,
    district: address?.district ?? null,
    state: address?.state ?? gst?.state ?? null,
    stateCode: address?.stateCode ?? gst?.stateCode ?? getRecordString(snapshot, "stateCode"),
    pincode: address?.pincode ?? null,
    country: address?.country ?? "India",
  }
}

async function getOrBuildCanonicalPayload(
  access: BusinessAccess,
  record: EInvoiceRecord
) {
  const stored = await db.query.eInvoicePayloads.findFirst({
    where: and(
      eq(eInvoicePayloads.businessId, access.business.id),
      eq(eInvoicePayloads.eInvoiceRecordId, record.id),
      eq(eInvoicePayloads.payloadType, "canonical")
    ),
  })

  if (stored?.payload) {
    return stored.payload as CanonicalEInvoicePayload
  }

  const source = await buildSourceContext(
    access.business.id,
    record.sourceDocumentType as EInvoiceSourceDocumentType,
    record.sourceDocumentId
  )
  const payload = buildCanonicalPayload(source)
  await upsertPayload(access, record, "canonical", payload.schemaVersion, payload)
  return payload
}

async function upsertPayload(
  access: BusinessAccess,
  record: EInvoiceRecord,
  payloadType: "canonical" | "provider" | "response" | "cancellation",
  schemaVersion: string,
  payload: unknown
) {
  const contentHash = hashPayload(payload)
  await db
    .insert(eInvoicePayloads)
    .values({
      businessId: access.business.id,
      eInvoiceRecordId: record.id,
      payloadType,
      schemaVersion,
      contentHash,
      payload: toJsonObject(payload),
      generatedBy: access.userId,
    })
    .onConflictDoUpdate({
      target: [eInvoicePayloads.eInvoiceRecordId, eInvoicePayloads.payloadType],
      set: {
        schemaVersion,
        contentHash,
        payload: toJsonObject(payload),
        generatedBy: access.userId,
        generatedAt: new Date(),
        updatedAt: new Date(),
      },
    })
}

async function findExistingEInvoiceRecord(
  businessId: string,
  sourceDocumentType: EInvoiceSourceDocumentType,
  sourceDocumentId: string
) {
  return db.query.eInvoiceRecords.findFirst({
    where: and(
      eq(eInvoiceRecords.businessId, businessId),
      eq(eInvoiceRecords.sourceDocumentType, sourceDocumentType),
      eq(eInvoiceRecords.sourceDocumentId, sourceDocumentId)
    ),
  })
}

async function requireEInvoiceRecord(businessId: string, id: string) {
  const record = await db.query.eInvoiceRecords.findFirst({
    where: and(eq(eInvoiceRecords.businessId, businessId), eq(eInvoiceRecords.id, id)),
  })

  if (!record) {
    throw new HttpError(404, "E-invoice record not found.")
  }

  return record
}

async function runEInvoiceIdempotency<T>(
  access: BusinessAccess,
  operationScope: string,
  idempotencyKey: string,
  payload: unknown,
  handler: () => Promise<T>
) {
  const requestHash = buildEInvoiceOperationRequestHash(payload)
  const existing = await db.query.eInvoiceIdempotencyKeys.findFirst({
    where: and(
      eq(eInvoiceIdempotencyKeys.businessId, access.business.id),
      eq(eInvoiceIdempotencyKeys.operationScope, operationScope),
      eq(eInvoiceIdempotencyKeys.idempotencyKey, idempotencyKey)
    ),
  })

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new HttpError(409, "This idempotency key was already used with another payload.")
    }

    return existing.responseBody as T
  }

  await db.insert(eInvoiceIdempotencyKeys).values({
    businessId: access.business.id,
    operationScope,
    idempotencyKey,
    requestHash,
    status: "processing",
  })

  const result = await handler()

  await db
    .update(eInvoiceIdempotencyKeys)
    .set({
      responseBody: result as Record<string, unknown>,
      status: "completed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(eInvoiceIdempotencyKeys.businessId, access.business.id),
        eq(eInvoiceIdempotencyKeys.operationScope, operationScope),
        eq(eInvoiceIdempotencyKeys.idempotencyKey, idempotencyKey)
      )
    )

  return result
}

async function insertStatusEvent(
  access: BusinessAccess,
  record: EInvoiceRecord,
  previousStatus: string | null,
  eventType: string,
  payload: unknown
) {
  await db.insert(eInvoiceStatusEvents).values({
    businessId: access.business.id,
    eInvoiceRecordId: record.id,
    previousStatus,
    status: record.submissionStatus,
    eventType,
    message: eventMessage(eventType, record.submissionStatus),
    providerReference: record.providerReference,
    rawResponse: toJsonObject(payload),
    createdBy: access.userId,
  })
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
    entityType: "e_invoice_record",
    entityId,
    action,
    userId: access.userId,
    before: toJsonObject(before),
    after: toJsonObject(after),
    reason,
  })
}

async function assertCanUseEInvoice(access: BusinessAccess, action: GstAction) {
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
      eq(businessMemberPermissions.module, "einvoice"),
      eq(permissionColumn, true)
    ),
  })

  if (!permission) {
    throw new HttpError(403, "You do not have permission to access e-invoice.")
  }
}

function initialSubmissionStatus(
  eligibility: EInvoiceEligibilityResult,
  validation: EInvoiceValidationResult
): EInvoiceSubmissionStatus {
  if (eligibility.status === "NOT_ELIGIBLE") {
    return "NOT_REQUIRED"
  }

  if (eligibility.status === "BLOCKED" || !validation.canSubmit) {
    return "VALIDATION_FAILED"
  }

  if (eligibility.status === "ALREADY_GENERATED") {
    return "IRN_GENERATED"
  }

  return "ELIGIBLE"
}

function toProviderPayload(payload: CanonicalEInvoicePayload) {
  return {
    version: payload.schemaVersion,
    tranDtls: {
      taxSch: "GST",
      supTyp: payload.document.supplyType.toUpperCase(),
    },
    docDtls: {
      typ: payload.document.type,
      no: payload.document.number,
      dt: payload.document.date,
    },
    sellerDtls: payload.supplier,
    buyerDtls: payload.recipient,
    itemList: payload.items,
    valDtls: payload.totals,
    refDtls: payload.references,
  }
}

function documentTypeCode(sourceDocumentType: EInvoiceSourceDocumentType) {
  if (sourceDocumentType === "credit_note") {
    return "CRN"
  }

  if (sourceDocumentType === "debit_note") {
    return "DBN"
  }

  return "INV"
}

function canCancelIrn(generatedAt: Date | null) {
  if (!generatedAt) {
    return true
  }

  const ageMs = Date.now() - generatedAt.getTime()
  return ageMs <= 24 * 60 * 60 * 1000
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
    EINV_ELIGIBILITY_CHECKED: "E-invoice eligibility checked.",
    EINV_VALIDATED: "E-invoice payload validated.",
    EINV_SUBMITTED: "E-invoice submitted to the configured adapter.",
    EINV_STATUS_UPDATED: "E-invoice status updated from the adapter.",
    EINV_RETRY: "E-invoice retry requested.",
    EINV_CANCELLED: "E-invoice cancelled through the configured adapter.",
    EINV_CANCEL_FAILED: "E-invoice cancellation failed.",
  }

  return labels[eventType] ?? `E-invoice status is ${status}.`
}

function formatDateValue(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return value
}

function getSnapshotString(value: unknown, key: string) {
  const record = toRecord(value)
  return getRecordString(record, key)
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ?
      (value as Record<string, unknown>)
    : null
}

function getRecordString(value: Record<string, unknown> | null, key: string) {
  const entry = value?.[key]
  return typeof entry === "string" && entry.trim() ? entry.trim() : null
}

function toJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}
