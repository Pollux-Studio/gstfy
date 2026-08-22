import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
  or,
  sql as drizzleSql,
  type SQL,
} from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { db } from "../../db/client.js"
import {
  accountingPeriods,
  auditLogs,
  businessMemberPermissions,
  externalGstImports,
  externalGstRecords,
  gstRegistrations,
  gstReconciliationExceptions,
  gstReconciliationIdempotencyKeys,
  gstReconciliationMatches,
  itcClaims,
  itcStatusEvents,
  partyGstRegistrations,
  purchaseBillLines,
  purchaseBills,
  purchaseTaxRecords,
  adjustmentDocuments,
  type ExternalGstRecord,
  type GstReconciliationExceptionRecord,
  type GstReconciliationMatchRecord,
  type PurchaseTaxRecord,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"
import {
  assertAllowedItcTransition,
  buildGstReconciliationRequestHash,
  compareTaxRecords,
  formatCents,
  normalizeDocumentNumber,
  resolveItcAmountsForStatus,
  taxPeriodFromDate,
  toCents,
  type ItcStatus,
  type MatchStatus,
} from "./gst-reconciliation.domain.js"
import {
  externalGstImportParamsSchema,
  gstReconciliationIdParamsSchema,
  importExternalGstSchema,
  itcClaimSchema,
  itcDecisionSchema,
  itcPartialEligibilitySchema,
  itcReverseSchema,
  listExternalGstImportsQuerySchema,
  listGstExceptionsQuerySchema,
  listGstReconciliationQuerySchema,
  manualMatchSchema,
  resolveExceptionSchema,
  unmatchSchema,
  type ImportExternalGstInput,
  type ItcClaimInput,
  type ItcDecisionInput,
  type ItcPartialEligibilityInput,
  type ItcReverseInput,
  type ListExternalGstImportsQueryInput,
  type ListGstExceptionsQueryInput,
  type ListGstReconciliationQueryInput,
  type ManualMatchInput,
  type ResolveExceptionInput,
  type UnmatchInput,
} from "./gst-reconciliation.schemas.js"

type BusinessAccess = Awaited<ReturnType<typeof requirePrimaryBusinessAccess>>
type GstAction = "view" | "create" | "edit" | "delete"

type CsvExportResponse = {
  fileName: string
  contentType: "text/csv"
  content: string
}

type ReconciliationRow = {
  record: PurchaseTaxRecord
  match: GstReconciliationMatchRecord | null
  externalRecord: ExternalGstRecord | null
  exception: GstReconciliationExceptionRecord | null
}

export async function registerGstReconciliationRoutes(app: FastifyInstance) {
  app.get("/gst-reconciliation", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = listGstReconciliationQuerySchema.parse(request.query)
    await syncPurchaseTaxRecords(access.business.id)

    return listReconciliationRecords(access.business.id, query)
  })

  app.get("/gst-reconciliation/export", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = listGstReconciliationQuerySchema.parse(request.query)
    await syncPurchaseTaxRecords(access.business.id)

    return exportReconciliationRecords(access.business.id, query)
  })

  app.get("/gst-reconciliation/imports", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = listExternalGstImportsQuerySchema.parse(request.query)

    return listExternalGstImports(access.business.id, query)
  })

  app.get("/gst-reconciliation/imports/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const { id } = externalGstImportParamsSchema.parse(request.params)

    return getExternalGstImportDetail(access.business.id, id)
  })

  app.post("/gst-reconciliation/import", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "create")
    const body = importExternalGstSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )
    const gstRegistrationId = await resolveImportGstRegistrationId(
      access.business.id,
      body.gstRegistrationId
    )
    await assertPeriodOpen(access.business.id, body.period, gstRegistrationId)

    return runGstOperationIdempotency(
      access,
      `gst-import:${gstRegistrationId ?? "default"}:${body.period}:${body.fileName}`,
      idempotencyKey,
      body,
      async () => {
        await syncPurchaseTaxRecords(access.business.id)
        const result = await importExternalGstRecords(access, body, gstRegistrationId)
        const autoMatch = await runAutomaticMatching(access, body.period, gstRegistrationId)

        return { ...result, autoMatch }
      }
    )
  })

  app.get("/gst-reconciliation/exceptions", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = listGstExceptionsQuerySchema.parse(request.query)
    await syncPurchaseTaxRecords(access.business.id)

    return listReconciliationExceptions(access.business.id, query)
  })

  app.get("/gst-reconciliation/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const { id } = gstReconciliationIdParamsSchema.parse(request.params)
    await syncPurchaseTaxRecords(access.business.id)

    return getReconciliationDetail(access.business.id, id)
  })

  app.post("/gst-reconciliation/:id/match", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstReconciliationIdParamsSchema.parse(request.params)
    const body = manualMatchSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )
    const record = await requirePurchaseTaxRecord(access.business.id, id)
    await assertPeriodOpen(access.business.id, record.taxPeriod, record.gstRegistrationId)

    return runGstOperationIdempotency(
      access,
      `gst-match:${id}`,
      idempotencyKey,
      body,
      async () => {
        await createManualMatch(access, record, body)

        return getReconciliationDetail(access.business.id, id)
      }
    )
  })

  app.post("/gst-reconciliation/:id/unmatch", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstReconciliationIdParamsSchema.parse(request.params)
    const body = unmatchSchema.parse(request.body)
    const record = await requirePurchaseTaxRecord(access.business.id, id)
    await assertPeriodOpen(access.business.id, record.taxPeriod, record.gstRegistrationId)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runGstOperationIdempotency(
      access,
      `gst-unmatch:${id}`,
      idempotencyKey,
      body,
      async () => {
        await unmatchRecord(access, id, body)

        return getReconciliationDetail(access.business.id, id)
      }
    )
  })

  app.post("/gst-reconciliation/:id/resolve", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstReconciliationIdParamsSchema.parse(request.params)
    const body = resolveExceptionSchema.parse(request.body)
    const record = await requirePurchaseTaxRecord(access.business.id, id)
    await assertPeriodOpen(access.business.id, record.taxPeriod, record.gstRegistrationId)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runGstOperationIdempotency(
      access,
      `gst-exception:${id}:resolve`,
      idempotencyKey,
      body,
      async () => {
        await resolveReconciliationException(access, id, body)

        return getReconciliationDetail(access.business.id, id)
      }
    )
  })

  app.get("/itc", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = listGstReconciliationQuerySchema.parse(request.query)
    await syncPurchaseTaxRecords(access.business.id)

    return listItcRecords(access.business.id, query)
  })

  app.get("/itc/export", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = listGstReconciliationQuerySchema.parse(request.query)
    await syncPurchaseTaxRecords(access.business.id)

    return exportItcRecords(access.business.id, query)
  })

  app.get("/itc/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const { id } = gstReconciliationIdParamsSchema.parse(request.params)
    await syncPurchaseTaxRecords(access.business.id)

    return getReconciliationDetail(access.business.id, id)
  })

  app.post("/itc/:id/mark-eligible", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstReconciliationIdParamsSchema.parse(request.params)
    const body = itcPartialEligibilitySchema.parse(request.body)
    const record = await requirePurchaseTaxRecord(access.business.id, id)
    await assertPeriodOpen(access.business.id, record.taxPeriod, record.gstRegistrationId)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runGstOperationIdempotency(
      access,
      `itc:${id}:eligible`,
      idempotencyKey,
      body,
      async () => {
        await updateItcStatus(access, record, resolveEligibleStatus(body), body)

        return getReconciliationDetail(access.business.id, id)
      }
    )
  })

  app.post("/itc/:id/defer", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstReconciliationIdParamsSchema.parse(request.params)
    const body = itcDecisionSchema.parse(request.body)
    const record = await requirePurchaseTaxRecord(access.business.id, id)
    await assertPeriodOpen(access.business.id, record.taxPeriod, record.gstRegistrationId)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runGstOperationIdempotency(
      access,
      `itc:${id}:defer`,
      idempotencyKey,
      body,
      async () => {
        await updateItcStatus(access, record, "DEFERRED", body)

        return getReconciliationDetail(access.business.id, id)
      }
    )
  })

  app.post("/itc/:id/reject", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstReconciliationIdParamsSchema.parse(request.params)
    const body = itcDecisionSchema.parse(request.body)
    const record = await requirePurchaseTaxRecord(access.business.id, id)
    await assertPeriodOpen(access.business.id, record.taxPeriod, record.gstRegistrationId)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runGstOperationIdempotency(
      access,
      `itc:${id}:reject`,
      idempotencyKey,
      body,
      async () => {
        await updateItcStatus(access, record, "REJECTED", body)

        return getReconciliationDetail(access.business.id, id)
      }
    )
  })

  app.post("/itc/:id/claim", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstReconciliationIdParamsSchema.parse(request.params)
    const body = itcClaimSchema.parse(request.body)
    const record = await requirePurchaseTaxRecord(access.business.id, id)
    await assertPeriodOpen(access.business.id, body.claimPeriod, record.gstRegistrationId)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runGstOperationIdempotency(
      access,
      `itc:${id}:claim`,
      idempotencyKey,
      body,
      async () => {
        await claimItc(access, record, body)

        return getReconciliationDetail(access.business.id, id)
      }
    )
  })

  app.post("/itc/:id/reverse", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "delete")
    const { id } = gstReconciliationIdParamsSchema.parse(request.params)
    const body = itcReverseSchema.parse(request.body)
    const record = await requirePurchaseTaxRecord(access.business.id, id)
    await assertPeriodOpen(access.business.id, record.taxPeriod, record.gstRegistrationId)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runGstOperationIdempotency(
      access,
      `itc:${id}:reverse`,
      idempotencyKey,
      body,
      async () => {
        await reverseItcClaim(access, record, body)

        return getReconciliationDetail(access.business.id, id)
      }
    )
  })
}

async function syncPurchaseTaxRecords(businessId: string) {
  await syncPurchaseBillTaxRecords(businessId)
  await syncPurchaseAdjustmentTaxRecords(businessId)
}

async function syncPurchaseBillTaxRecords(businessId: string) {
  const rows = await db
    .select({
      id: purchaseBills.id,
      voucherId: purchaseBills.voucherId,
      gstRegistrationId: purchaseBills.gstRegistrationId,
      branchId: purchaseBills.branchId,
      supplierId: purchaseBills.supplierId,
      supplierName: purchaseBills.supplierName,
      supplierGstin: partyGstRegistrations.gstin,
      billNumber: purchaseBills.billNumber,
      supplierInvoiceNumber: purchaseBills.supplierInvoiceNumber,
      invoiceDate: purchaseBills.invoiceDate,
      billDate: purchaseBills.billDate,
      taxableValue: purchaseBills.taxableValue,
      cgst: purchaseBills.cgstAmount,
      sgst: purchaseBills.sgstAmount,
      igst: purchaseBills.igstAmount,
      cess: purchaseBills.cessAmount,
      itcEligibleAmount: purchaseBills.itcEligibleAmount,
    })
    .from(purchaseBills)
    .leftJoin(
      partyGstRegistrations,
      and(
        eq(partyGstRegistrations.businessId, businessId),
        eq(partyGstRegistrations.partyId, purchaseBills.supplierId),
        eq(partyGstRegistrations.isPrimary, true),
        eq(partyGstRegistrations.status, "active")
      )
    )
    .where(
      and(
        eq(purchaseBills.businessId, businessId),
        eq(purchaseBills.status, "posted"),
        isNotNull(purchaseBills.voucherId)
      )
    )

  for (const row of rows) {
    if (!row.voucherId) {
      continue
    }

    const [{ reverseChargeCount = 0 } = {}] = await db
      .select({
        reverseChargeCount: drizzleSql<number>`count(*)::int`,
      })
      .from(purchaseBillLines)
      .where(
        and(
          eq(purchaseBillLines.businessId, businessId),
          eq(purchaseBillLines.purchaseBillId, row.id),
          eq(purchaseBillLines.reverseCharge, true)
        )
      )
    const sourceType = reverseChargeCount > 0 ? "rcm_purchase" : "purchase_bill"
    const inputType = reverseChargeCount > 0 ? "rcm" : "regular"
    const totalTaxCents =
      toCents(row.cgst) + toCents(row.sgst) + toCents(row.igst) + toCents(row.cess)
    const itcStatus: ItcStatus =
      totalTaxCents <= 0 || toCents(row.itcEligibleAmount) <= 0 ?
        "INELIGIBLE"
      : "NOT_REVIEWED"
    const itcAmounts =
      itcStatus === "INELIGIBLE" ?
        resolveItcAmountsForStatus("INELIGIBLE", row, { })
      : zeroItcAmounts()

    await upsertPurchaseTaxRecord({
      businessId,
      sourceType,
      purchaseBillId: row.id,
      adjustmentDocumentId: null,
      voucherId: row.voucherId,
      supplierId: row.supplierId,
      gstRegistrationId: row.gstRegistrationId,
      branchId: row.branchId,
      supplierName: row.supplierName,
      supplierGstin: row.supplierGstin,
      invoiceNumber: row.supplierInvoiceNumber || row.billNumber,
      normalizedInvoiceNumber: normalizeDocumentNumber(row.supplierInvoiceNumber || row.billNumber),
      invoiceDate: normalizeDate(row.invoiceDate || row.billDate),
      taxableValue: row.taxableValue,
      cgst: row.cgst,
      sgst: row.sgst,
      igst: row.igst,
      cess: row.cess,
      totalTax: formatCents(totalTaxCents),
      taxPeriod: taxPeriodFromDate(normalizeDate(row.invoiceDate || row.billDate)),
      itcStatus,
      inputType,
      sourceSnapshot: row,
      ...itcAmounts,
    })
  }
}

async function syncPurchaseAdjustmentTaxRecords(businessId: string) {
  const rows = await db
    .select({
      id: adjustmentDocuments.id,
      voucherId: adjustmentDocuments.voucherId,
      gstRegistrationId: adjustmentDocuments.gstRegistrationId,
      branchId: adjustmentDocuments.branchId,
      partyId: adjustmentDocuments.partyId,
      supplierGstin: partyGstRegistrations.gstin,
      adjustmentNumber: adjustmentDocuments.adjustmentNumber,
      adjustmentDate: adjustmentDocuments.adjustmentDate,
      adjustmentType: adjustmentDocuments.adjustmentType,
      taxableValue: adjustmentDocuments.taxableTotal,
      cgst: adjustmentDocuments.cgstTotal,
      sgst: adjustmentDocuments.sgstTotal,
      igst: adjustmentDocuments.igstTotal,
      cess: adjustmentDocuments.cessTotal,
      partySnapshot: adjustmentDocuments.partySnapshot,
    })
    .from(adjustmentDocuments)
    .leftJoin(
      partyGstRegistrations,
      and(
        eq(partyGstRegistrations.businessId, businessId),
        eq(partyGstRegistrations.partyId, adjustmentDocuments.partyId),
        eq(partyGstRegistrations.isPrimary, true),
        eq(partyGstRegistrations.status, "active")
      )
    )
    .where(
      and(
        eq(adjustmentDocuments.businessId, businessId),
        eq(adjustmentDocuments.status, "posted"),
        eq(adjustmentDocuments.sourceDocumentType, "purchase_bill"),
        isNotNull(adjustmentDocuments.voucherId)
      )
    )

  for (const row of rows) {
    if (!row.voucherId) {
      continue
    }

    const sign = row.adjustmentType === "PURCHASE_RETURN" ? -1 : 1
    const signed = {
      taxableValue: formatCents(sign * toCents(row.taxableValue)),
      cgst: formatCents(sign * toCents(row.cgst)),
      sgst: formatCents(sign * toCents(row.sgst)),
      igst: formatCents(sign * toCents(row.igst)),
      cess: formatCents(sign * toCents(row.cess)),
    }
    const totalTaxCents =
      toCents(signed.cgst) +
      toCents(signed.sgst) +
      toCents(signed.igst) +
      toCents(signed.cess)

    await upsertPurchaseTaxRecord({
      businessId,
      sourceType: "adjustment_document",
      purchaseBillId: null,
      adjustmentDocumentId: row.id,
      voucherId: row.voucherId,
      supplierId: row.partyId,
      gstRegistrationId: row.gstRegistrationId,
      branchId: row.branchId,
      supplierName: getSnapshotName(row.partySnapshot) ?? "Supplier",
      supplierGstin: row.supplierGstin,
      invoiceNumber: row.adjustmentNumber,
      normalizedInvoiceNumber: normalizeDocumentNumber(row.adjustmentNumber),
      invoiceDate: normalizeDate(row.adjustmentDate),
      taxableValue: signed.taxableValue,
      cgst: signed.cgst,
      sgst: signed.sgst,
      igst: signed.igst,
      cess: signed.cess,
      totalTax: formatCents(totalTaxCents),
      taxPeriod: taxPeriodFromDate(normalizeDate(row.adjustmentDate)),
      itcStatus: "NOT_REVIEWED",
      inputType: "adjustment",
      sourceSnapshot: row,
      ...zeroItcAmounts(),
    })
  }
}

async function upsertPurchaseTaxRecord(input: typeof purchaseTaxRecords.$inferInsert) {
  const existing = await db.query.purchaseTaxRecords.findFirst({
    where:
      input.purchaseBillId ?
        and(
          eq(purchaseTaxRecords.businessId, input.businessId),
          eq(purchaseTaxRecords.purchaseBillId, input.purchaseBillId)
        )
      : input.adjustmentDocumentId ?
        and(
          eq(purchaseTaxRecords.businessId, input.businessId),
          eq(purchaseTaxRecords.adjustmentDocumentId, input.adjustmentDocumentId)
        )
      : undefined,
  })

  if (!existing) {
    await db.insert(purchaseTaxRecords).values(input)
    return
  }

  await db
    .update(purchaseTaxRecords)
    .set({
      voucherId: input.voucherId,
      supplierId: input.supplierId,
      gstRegistrationId: input.gstRegistrationId,
      branchId: input.branchId,
      supplierName: input.supplierName,
      supplierGstin: input.supplierGstin,
      invoiceNumber: input.invoiceNumber,
      normalizedInvoiceNumber: input.normalizedInvoiceNumber,
      invoiceDate: input.invoiceDate,
      taxableValue: input.taxableValue,
      cgst: input.cgst,
      sgst: input.sgst,
      igst: input.igst,
      cess: input.cess,
      totalTax: input.totalTax,
      taxPeriod: input.taxPeriod,
      sourceSnapshot: input.sourceSnapshot,
      updatedAt: new Date(),
    })
    .where(eq(purchaseTaxRecords.id, existing.id))
}

async function importExternalGstRecords(
  access: BusinessAccess,
  body: ImportExternalGstInput,
  gstRegistrationId: string | null
) {
  const [createdImport] = await db
    .insert(externalGstImports)
    .values({
      businessId: access.business.id,
      source: body.source,
      period: body.period,
      gstRegistrationId,
      fileName: body.fileName,
      recordCount: body.records.length,
      importedBy: access.userId,
      rawMetadata: { normalized: true },
    })
    .returning()

  if (!createdImport) {
    throw new HttpError(500, "Unable to create GST import.")
  }

  const importedRows = await db
    .insert(externalGstRecords)
    .values(
      body.records.map((record) => ({
        businessId: access.business.id,
        importId: createdImport.id,
        gstRegistrationId,
        supplierGstin: record.supplierGstin,
        supplierName: record.supplierName,
        documentNumber: record.documentNumber,
        normalizedDocumentNumber: normalizeDocumentNumber(record.documentNumber),
        documentDate: record.documentDate,
        taxableValue: record.taxableValue,
        cgst: record.cgst,
        sgst: record.sgst,
        igst: record.igst,
        cess: record.cess,
        totalTax: formatCents(
          toCents(record.cgst) +
            toCents(record.sgst) +
            toCents(record.igst) +
            toCents(record.cess)
        ),
        period: body.period,
        source: body.source,
        rawReference: record.rawReference,
      }))
    )
    .onConflictDoNothing()
    .returning()
  const duplicateCount = await markDuplicateExternalRecords(
    access,
    body.period,
    gstRegistrationId,
    body.source
  )

  await insertAuditLog(
    access,
    "external_gst_import",
    createdImport.id,
    "GST_IMPORT_CREATED",
    null,
    { import: createdImport, imported: importedRows.length, duplicates: duplicateCount },
    `Imported ${importedRows.length} GST records`
  )

  return {
    import: createdImport,
    imported: importedRows.length,
    skipped: body.records.length - importedRows.length,
    duplicates: duplicateCount,
  }
}

async function runAutomaticMatching(
  access: BusinessAccess,
  period: string,
  gstRegistrationId: string | null
) {
  const books = await db
    .select()
    .from(purchaseTaxRecords)
    .where(
      and(
        eq(purchaseTaxRecords.businessId, access.business.id),
        eq(purchaseTaxRecords.taxPeriod, period),
        gstRegistrationId ?
          eq(purchaseTaxRecords.gstRegistrationId, gstRegistrationId)
        : drizzleSql`${purchaseTaxRecords.gstRegistrationId} is null`,
        drizzleSql`${purchaseTaxRecords.inputType} <> 'rcm'`
      )
    )
  const externals = await db
    .select()
    .from(externalGstRecords)
    .where(
      and(
        eq(externalGstRecords.businessId, access.business.id),
        eq(externalGstRecords.period, period),
        gstRegistrationId ?
          eq(externalGstRecords.gstRegistrationId, gstRegistrationId)
        : drizzleSql`${externalGstRecords.gstRegistrationId} is null`,
        eq(externalGstRecords.status, "available")
      )
    )

  let matched = 0
  let exceptions = 0

  for (const book of books) {
    const existingMatch = await getActiveMatch(access.business.id, book.id)

    if (existingMatch) {
      continue
    }

    const candidates = externals.filter(
      (external) =>
        external.status === "available" &&
        book.supplierGstin &&
        external.supplierGstin === book.supplierGstin &&
        external.normalizedDocumentNumber === book.normalizedInvoiceNumber
    )

    if (candidates.length > 1) {
      await markBookException(access, book, "DUPLICATE", "HIGH", "Multiple external records match this invoice number.")
      exceptions += 1
      continue
    }

    const external = candidates[0]

    if (!external) {
      await markBookException(access, book, "BOOKS_ONLY", "MEDIUM", "Purchase exists in books but not in the imported GST dataset.")
      exceptions += 1
      continue
    }

    const comparison = compareTaxRecords(
      {
        supplierGstin: book.supplierGstin,
        documentNumber: book.invoiceNumber,
        documentDate: book.invoiceDate,
        taxableValue: book.taxableValue,
        cgst: book.cgst,
        sgst: book.sgst,
        igst: book.igst,
        cess: book.cess,
      },
      {
        supplierGstin: external.supplierGstin,
        documentNumber: external.documentNumber,
        documentDate: external.documentDate,
        taxableValue: external.taxableValue,
        cgst: external.cgst,
        sgst: external.sgst,
        igst: external.igst,
        cess: external.cess,
      }
    )

    if (!comparison.candidate || comparison.matchStatus === "NO_MATCH") {
      continue
    }

    await createMatch(access, book, external, comparison.matchStatus, comparison.matchConfidence, comparison.differences, false, "Automatic GST reconciliation match")
    matched += 1

    if (comparison.matchStatus !== "MATCHED") {
      await markMatchedException(
        access,
        book,
        external,
        comparison.matchStatus,
        comparison.matchStatus === "DATE_MISMATCH" ? "LOW" : "HIGH",
        "External GST data differs from the purchase book record."
      )
      exceptions += 1
    }
  }

  const matchedExternalIds = new Set(
    (
      await db
        .select({ id: gstReconciliationMatches.externalGstRecordId })
        .from(gstReconciliationMatches)
        .where(
          and(
            eq(gstReconciliationMatches.businessId, access.business.id),
            eq(gstReconciliationMatches.status, "active")
          )
        )
    ).map((row) => row.id)
  )

  for (const external of externals) {
    if (!matchedExternalIds.has(external.id) && external.status === "available") {
      await markExternalException(access, external, "EXTERNAL_ONLY", "MEDIUM", "GST portal record exists but no matching purchase is recorded in GSTfy.")
      exceptions += 1
    }
  }

  return { matched, exceptions }
}

async function listReconciliationRecords(
  businessId: string,
  query: ListGstReconciliationQueryInput
) {
  const conditions = await buildReconciliationConditions(businessId, query)
  const where = and(...conditions)
  const [{ count = 0 } = {}] = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(purchaseTaxRecords)
    .where(where)
  const rows = await db
    .select()
    .from(purchaseTaxRecords)
    .where(where)
    .orderBy(resolveReconciliationSort(query))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)

  return {
    items: await enrichReconciliationRows(businessId, rows),
    summary: await getGstReconciliationSummary(businessId, query.period),
    pagination: createPaginationMeta(query.page, query.limit, count),
  }
}

async function listItcRecords(businessId: string, query: ListGstReconciliationQueryInput) {
  return listReconciliationRecords(businessId, query)
}

async function enrichReconciliationRows(businessId: string, rows: PurchaseTaxRecord[]) {
  const enriched: ReconciliationRow[] = []

  for (const record of rows) {
    const match = await getActiveMatch(businessId, record.id)
    const externalRecord =
      match ?
        await db.query.externalGstRecords.findFirst({
          where: and(
            eq(externalGstRecords.businessId, businessId),
            eq(externalGstRecords.id, match.externalGstRecordId)
          ),
        })
      : null
    const exception = await db.query.gstReconciliationExceptions.findFirst({
      where: and(
        eq(gstReconciliationExceptions.businessId, businessId),
        eq(gstReconciliationExceptions.purchaseTaxRecordId, record.id),
        inArray(gstReconciliationExceptions.status, ["OPEN", "IN_REVIEW"])
      ),
      orderBy: [desc(gstReconciliationExceptions.createdAt)],
    })

    enriched.push({
      record,
      match: match ?? null,
      externalRecord: externalRecord ?? null,
      exception: exception ?? null,
    })
  }

  return enriched
}

async function getReconciliationDetail(businessId: string, id: string) {
  const record = await requirePurchaseTaxRecord(businessId, id)
  const [row] = await enrichReconciliationRows(businessId, [record])
  const exceptions = await db
    .select()
    .from(gstReconciliationExceptions)
    .where(
      and(
        eq(gstReconciliationExceptions.businessId, businessId),
        eq(gstReconciliationExceptions.purchaseTaxRecordId, id)
      )
    )
    .orderBy(desc(gstReconciliationExceptions.createdAt))
  const events = await db
    .select()
    .from(itcStatusEvents)
    .where(and(eq(itcStatusEvents.businessId, businessId), eq(itcStatusEvents.purchaseTaxRecordId, id)))
    .orderBy(desc(itcStatusEvents.createdAt))
  const claims = await db
    .select()
    .from(itcClaims)
    .where(and(eq(itcClaims.businessId, businessId), eq(itcClaims.purchaseTaxRecordId, id)))
    .orderBy(desc(itcClaims.claimedAt))

  return {
    ...row,
    exceptions,
    itcEvents: events,
    claims,
  }
}

async function listExternalGstImports(
  businessId: string,
  query: ListExternalGstImportsQueryInput
) {
  const conditions: SQL[] = [eq(externalGstImports.businessId, businessId)]

  if (query.period) {
    conditions.push(eq(externalGstImports.period, query.period))
  }

  if (query.source) {
    conditions.push(eq(externalGstImports.source, query.source))
  }

  if (query.gstRegistrationId) {
    conditions.push(eq(externalGstImports.gstRegistrationId, query.gstRegistrationId))
  }

  const where = and(...conditions)
  const [{ count = 0 } = {}] = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(externalGstImports)
    .where(where)
  const imports = await db
    .select()
    .from(externalGstImports)
    .where(where)
    .orderBy(desc(externalGstImports.importedAt))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)

  return {
    imports,
    pagination: createPaginationMeta(query.page, query.limit, count),
  }
}

async function getExternalGstImportDetail(businessId: string, id: string) {
  const importRecord = await db.query.externalGstImports.findFirst({
    where: and(eq(externalGstImports.businessId, businessId), eq(externalGstImports.id, id)),
  })

  if (!importRecord) {
    throw new HttpError(404, "GST import not found.")
  }

  const records = await db
    .select()
    .from(externalGstRecords)
    .where(and(eq(externalGstRecords.businessId, businessId), eq(externalGstRecords.importId, id)))
    .orderBy(asc(externalGstRecords.supplierGstin), asc(externalGstRecords.documentDate))

  return { import: importRecord, records }
}

async function listReconciliationExceptions(
  businessId: string,
  query: ListGstExceptionsQueryInput
) {
  const conditions: SQL[] = [eq(gstReconciliationExceptions.businessId, businessId)]

  if (query.status) {
    conditions.push(eq(gstReconciliationExceptions.status, query.status))
  }

  if (query.severity) {
    conditions.push(eq(gstReconciliationExceptions.severity, query.severity))
  }

  if (query.period) {
    const matchingRecords = await db
      .select({ id: purchaseTaxRecords.id })
      .from(purchaseTaxRecords)
      .where(and(eq(purchaseTaxRecords.businessId, businessId), eq(purchaseTaxRecords.taxPeriod, query.period)))

    if (matchingRecords.length === 0) {
      return {
        exceptions: [],
        pagination: createPaginationMeta(query.page, query.limit, 0),
      }
    }

    conditions.push(
      inArray(
        gstReconciliationExceptions.purchaseTaxRecordId,
        matchingRecords.map((record) => record.id)
      )
    )
  }

  const where = and(...conditions)
  const [{ count = 0 } = {}] = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(gstReconciliationExceptions)
    .where(where)
  const exceptions = await db
    .select()
    .from(gstReconciliationExceptions)
    .where(where)
    .orderBy(desc(gstReconciliationExceptions.createdAt))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)

  return {
    exceptions,
    pagination: createPaginationMeta(query.page, query.limit, count),
  }
}

async function createManualMatch(
  access: BusinessAccess,
  record: PurchaseTaxRecord,
  body: ManualMatchInput
) {
  const external = await db.query.externalGstRecords.findFirst({
    where: and(
      eq(externalGstRecords.businessId, access.business.id),
      eq(externalGstRecords.id, body.externalGstRecordId)
    ),
  })

  if (!external) {
    throw new HttpError(404, "External GST record not found.")
  }

  assertManualMatchAllowed(record, external)

  const comparison = compareTaxRecords(
    {
      supplierGstin: record.supplierGstin,
      documentNumber: record.invoiceNumber,
      documentDate: record.invoiceDate,
      taxableValue: record.taxableValue,
      cgst: record.cgst,
      sgst: record.sgst,
      igst: record.igst,
      cess: record.cess,
    },
    {
      supplierGstin: external.supplierGstin,
      documentNumber: external.documentNumber,
      documentDate: external.documentDate,
      taxableValue: external.taxableValue,
      cgst: external.cgst,
      sgst: external.sgst,
      igst: external.igst,
      cess: external.cess,
    }
  )
  const status =
    comparison.matchStatus === "NO_MATCH" ? "MANUAL_REVIEW" : comparison.matchStatus

  await createMatch(
    access,
    record,
    external,
    status,
    comparison.candidate ? comparison.matchConfidence : "WEAK",
    comparison.differences,
    true,
    body.reason
  )
}

async function createMatch(
  access: BusinessAccess,
  record: PurchaseTaxRecord,
  external: ExternalGstRecord,
  status: MatchStatus,
  confidence: string,
  differences: {
    taxableDifference: string
    cgstDifference: string
    sgstDifference: string
    igstDifference: string
    cessDifference: string
  },
  manualOverride: boolean,
  reason: string
) {
  if (record.itcStatus === "CLAIMED") {
    throw new HttpError(409, "Claimed ITC cannot be rematched. Reverse the claim first.")
  }

  assertManualMatchAllowed(record, external)

  const activeMatch = await getActiveMatch(access.business.id, record.id)

  if (activeMatch) {
    throw new HttpError(409, "This book record is already matched.")
  }

  const activeExternalMatch = await db.query.gstReconciliationMatches.findFirst({
    where: and(
      eq(gstReconciliationMatches.businessId, access.business.id),
      eq(gstReconciliationMatches.externalGstRecordId, external.id),
      eq(gstReconciliationMatches.status, "active")
    ),
  })

  if (activeExternalMatch) {
    throw new HttpError(409, "This external GST record is already matched.")
  }

  const [match] = await db
    .insert(gstReconciliationMatches)
    .values({
      businessId: access.business.id,
      purchaseTaxRecordId: record.id,
      externalGstRecordId: external.id,
      matchStatus: status,
      matchConfidence: confidence,
      taxableDifference: differences.taxableDifference,
      cgstDifference: differences.cgstDifference,
      sgstDifference: differences.sgstDifference,
      igstDifference: differences.igstDifference,
      cessDifference: differences.cessDifference,
      matchedBy: access.userId,
      manualOverride,
      reason,
    })
    .returning()

  await db
    .update(purchaseTaxRecords)
    .set({ reconciliationStatus: status, updatedAt: new Date() })
    .where(eq(purchaseTaxRecords.id, record.id))
  await db
    .update(externalGstRecords)
    .set({ status: "matched", updatedAt: new Date() })
    .where(eq(externalGstRecords.id, external.id))

  await insertAuditLog(
    access,
    "gst_reconciliation_match",
    match?.id ?? record.id,
    manualOverride ? "GST_MATCH_OVERRIDDEN" : "GST_MATCH_CREATED",
    null,
    match,
    reason
  )
}

async function unmatchRecord(access: BusinessAccess, recordId: string, body: UnmatchInput) {
  const record = await requirePurchaseTaxRecord(access.business.id, recordId)

  if (record.itcStatus === "CLAIMED") {
    throw new HttpError(409, "Claimed ITC cannot be unmatched. Reverse the claim first, then correct reconciliation.")
  }

  const match = await getActiveMatch(access.business.id, recordId)

  if (!match) {
    throw new HttpError(404, "Active match not found.")
  }

  await db
    .update(gstReconciliationMatches)
    .set({ status: "reversed", reason: body.reason, updatedAt: new Date() })
    .where(eq(gstReconciliationMatches.id, match.id))
  await db
    .update(purchaseTaxRecords)
    .set({ reconciliationStatus: "NOT_MATCHED", updatedAt: new Date() })
    .where(eq(purchaseTaxRecords.id, recordId))
  await db
    .update(externalGstRecords)
    .set({ status: "available", updatedAt: new Date() })
    .where(eq(externalGstRecords.id, match.externalGstRecordId))

  await insertAuditLog(
    access,
    "gst_reconciliation_match",
    match.id,
    "GST_MATCH_REVERSED",
    match,
    null,
    body.reason
  )
}

async function resolveReconciliationException(
  access: BusinessAccess,
  recordId: string,
  body: ResolveExceptionInput
) {
  const exception =
    body.exceptionId ?
      await db.query.gstReconciliationExceptions.findFirst({
        where: and(
          eq(gstReconciliationExceptions.businessId, access.business.id),
          eq(gstReconciliationExceptions.id, body.exceptionId)
        ),
      })
    : await db.query.gstReconciliationExceptions.findFirst({
        where: and(
          eq(gstReconciliationExceptions.businessId, access.business.id),
          eq(gstReconciliationExceptions.purchaseTaxRecordId, recordId),
          inArray(gstReconciliationExceptions.status, ["OPEN", "IN_REVIEW"])
        ),
        orderBy: [desc(gstReconciliationExceptions.createdAt)],
      })

  if (!exception) {
    throw new HttpError(404, "Reconciliation exception not found.")
  }

  const [updated] = await db
    .update(gstReconciliationExceptions)
    .set({
      status: body.status,
      resolution: body.resolution,
      resolvedBy: body.status === "IN_REVIEW" ? null : access.userId,
      resolvedAt: body.status === "IN_REVIEW" ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(gstReconciliationExceptions.id, exception.id))
    .returning()

  await insertAuditLog(
    access,
    "gst_reconciliation_exception",
    exception.id,
    "EXCEPTION_RESOLVED",
    exception,
    updated,
    body.resolution
  )
}

async function updateItcStatus(
  access: BusinessAccess,
  record: PurchaseTaxRecord,
  status: "ELIGIBLE" | "PARTIALLY_ELIGIBLE" | "DEFERRED" | "INELIGIBLE" | "REJECTED",
  body: ItcDecisionInput | ItcPartialEligibilityInput
) {
  const current = await requirePurchaseTaxRecord(access.business.id, record.id)
  assertNormalItcLifecycle(current)
  assertItcTransitionAllowed(current.itcStatus, status)

  const eligibilityOverrides =
    status === "ELIGIBLE" || status === "PARTIALLY_ELIGIBLE" ?
      {
        eligibleCgst: "eligibleCgst" in body ? body.eligibleCgst : undefined,
        eligibleSgst: "eligibleSgst" in body ? body.eligibleSgst : undefined,
        eligibleIgst: "eligibleIgst" in body ? body.eligibleIgst : undefined,
        eligibleCess: "eligibleCess" in body ? body.eligibleCess : undefined,
      }
    : undefined
  const amounts = resolveItcAmountsForStatus(status, current, eligibilityOverrides)
  const [updated] = await db
    .update(purchaseTaxRecords)
    .set({
      itcStatus: status,
      ...amounts,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(purchaseTaxRecords.businessId, access.business.id),
        eq(purchaseTaxRecords.id, current.id),
        eq(purchaseTaxRecords.itcStatus, current.itcStatus)
      )
    )
    .returning()

  if (!updated) {
    throw new HttpError(409, "ITC status changed while saving. Refresh and try again.")
  }

  await db.insert(itcStatusEvents).values({
    businessId: access.business.id,
    purchaseTaxRecordId: current.id,
    fromStatus: current.itcStatus,
    toStatus: status,
    ...getPreviousItcAuditAmounts(current),
    ...amounts,
    reason: body.reason,
    userId: access.userId,
  })

  await insertAuditLog(
    access,
    "purchase_tax_record",
    current.id,
    status === "ELIGIBLE" || status === "PARTIALLY_ELIGIBLE" ?
      "ITC_MARKED_ELIGIBLE"
    : status === "DEFERRED" ?
      "ITC_DEFERRED"
    : "ITC_REJECTED",
    current,
    updated,
    body.reason
  )
}

async function claimItc(
  access: BusinessAccess,
  record: PurchaseTaxRecord,
  body: ItcClaimInput
) {
  const current = await requirePurchaseTaxRecord(access.business.id, record.id)
  assertNormalItcLifecycle(current)
  assertItcTransitionAllowed(current.itcStatus, "CLAIMED")

  const eligibleCents =
    toCents(current.eligibleCgst) +
    toCents(current.eligibleSgst) +
    toCents(current.eligibleIgst) +
    toCents(current.eligibleCess)

  if (eligibleCents <= 0) {
    throw new HttpError(409, "There is no eligible ITC amount to claim.")
  }

  const existing = await db.query.itcClaims.findFirst({
    where: and(
      eq(itcClaims.businessId, access.business.id),
      eq(itcClaims.purchaseTaxRecordId, current.id),
      eq(itcClaims.status, "active")
    ),
  })

  if (existing) {
    throw new HttpError(409, "ITC is already claimed for this record.")
  }

  assertClaimWithinRemainingTax(current)

  const [updated] = await db
    .update(purchaseTaxRecords)
    .set({ itcStatus: "CLAIMED", updatedAt: new Date() })
    .where(
      and(
        eq(purchaseTaxRecords.businessId, access.business.id),
        eq(purchaseTaxRecords.id, current.id),
        eq(purchaseTaxRecords.itcStatus, current.itcStatus)
      )
    )
    .returning()

  if (!updated) {
    throw new HttpError(409, "ITC status changed while claiming. Refresh and try again.")
  }

  const [claim] = await db
    .insert(itcClaims)
    .values({
      businessId: access.business.id,
      purchaseTaxRecordId: current.id,
      claimPeriod: body.claimPeriod,
      claimedCgst: current.eligibleCgst,
      claimedSgst: current.eligibleSgst,
      claimedIgst: current.eligibleIgst,
      claimedCess: current.eligibleCess,
      sourceTaxRecord: current,
      claimedBy: access.userId,
    })
    .returning()

  await db.insert(itcStatusEvents).values({
    businessId: access.business.id,
    purchaseTaxRecordId: current.id,
    fromStatus: current.itcStatus,
    toStatus: "CLAIMED",
    ...getPreviousItcAuditAmounts(current),
    eligibleCgst: current.eligibleCgst,
    eligibleSgst: current.eligibleSgst,
    eligibleIgst: current.eligibleIgst,
    eligibleCess: current.eligibleCess,
    reason: body.reason,
    userId: access.userId,
  })

  await insertAuditLog(
    access,
    "itc_claim",
    claim?.id ?? current.id,
    "ITC_CLAIMED",
    current,
    updated,
    body.reason
  )
}

async function reverseItcClaim(
  access: BusinessAccess,
  record: PurchaseTaxRecord,
  body: ItcReverseInput
) {
  const current = await requirePurchaseTaxRecord(access.business.id, record.id)
  assertItcTransitionAllowed(current.itcStatus, "REVERSED")
  const claim = await db.query.itcClaims.findFirst({
    where: and(
      eq(itcClaims.businessId, access.business.id),
      eq(itcClaims.purchaseTaxRecordId, current.id),
      eq(itcClaims.status, "active")
    ),
  })

  if (!claim) {
    throw new HttpError(404, "Active ITC claim not found.")
  }

  const [updatedClaim] = await db
    .update(itcClaims)
    .set({
      status: "reversed",
      reversedBy: access.userId,
      reversedAt: new Date(),
      reversalReason: body.reason,
      updatedAt: new Date(),
    })
    .where(and(eq(itcClaims.id, claim.id), eq(itcClaims.status, "active")))
    .returning()
  if (!updatedClaim) {
    throw new HttpError(409, "ITC claim changed while reversing. Refresh and try again.")
  }

  const [updatedRecord] = await db
    .update(purchaseTaxRecords)
    .set({ itcStatus: "REVERSED", updatedAt: new Date() })
    .where(
      and(
        eq(purchaseTaxRecords.businessId, access.business.id),
        eq(purchaseTaxRecords.id, current.id),
        eq(purchaseTaxRecords.itcStatus, "CLAIMED")
      )
    )
    .returning()
  if (!updatedRecord) {
    throw new HttpError(409, "ITC status changed while reversing. Refresh and try again.")
  }

  await db.insert(itcStatusEvents).values({
    businessId: access.business.id,
    purchaseTaxRecordId: current.id,
    fromStatus: current.itcStatus,
    toStatus: "REVERSED",
    ...getPreviousItcAuditAmounts(current),
    reason: body.reason,
    userId: access.userId,
  })

  await insertAuditLog(
    access,
    "itc_claim",
    claim.id,
    "ITC_REVERSED",
    claim,
    { claim: updatedClaim, record: updatedRecord },
    body.reason
  )
}

async function exportReconciliationRecords(
  businessId: string,
  query: ListGstReconciliationQueryInput
): Promise<CsvExportResponse> {
  const rows = await listReconciliationRecords(businessId, { ...query, page: 1, limit: 100 })

  return buildCsvExport(
    `gst-reconciliation-${query.period ?? "all"}.csv`,
    [
      "Supplier",
      "GSTIN",
      "Invoice",
      "Date",
      "Book Tax",
      "External Tax",
      "Difference",
      "Match Status",
      "ITC Status",
    ],
    rows.items.map((row) => [
      row.record.supplierName,
      row.record.supplierGstin ?? "",
      row.record.invoiceNumber,
      row.record.invoiceDate,
      row.record.totalTax,
      row.externalRecord?.totalTax ?? "",
      row.match ? sumDifference(row.match) : "",
      row.record.reconciliationStatus,
      row.record.itcStatus,
    ])
  )
}

async function exportItcRecords(
  businessId: string,
  query: ListGstReconciliationQueryInput
): Promise<CsvExportResponse> {
  const rows = await listItcRecords(businessId, { ...query, page: 1, limit: 100 })

  return buildCsvExport(
    `itc-register-${query.period ?? "all"}.csv`,
    [
      "Supplier",
      "GSTIN",
      "Invoice",
      "Date",
      "CGST",
      "SGST",
      "IGST",
      "Cess",
      "Eligible ITC",
      "ITC Status",
      "Reconciliation",
    ],
    rows.items.map((row) => [
      row.record.supplierName,
      row.record.supplierGstin ?? "",
      row.record.invoiceNumber,
      row.record.invoiceDate,
      row.record.cgst,
      row.record.sgst,
      row.record.igst,
      row.record.cess,
      formatCents(
        toCents(row.record.eligibleCgst) +
          toCents(row.record.eligibleSgst) +
          toCents(row.record.eligibleIgst) +
          toCents(row.record.eligibleCess)
      ),
      row.record.itcStatus,
      row.record.reconciliationStatus,
    ])
  )
}

async function buildReconciliationConditions(
  businessId: string,
  query: ListGstReconciliationQueryInput
) {
  const conditions: SQL[] = [eq(purchaseTaxRecords.businessId, businessId)]

  if (query.period) {
    conditions.push(eq(purchaseTaxRecords.taxPeriod, query.period))
  }

  if (query.supplierId) {
    conditions.push(eq(purchaseTaxRecords.supplierId, query.supplierId))
  }

  if (query.matchStatus) {
    conditions.push(eq(purchaseTaxRecords.reconciliationStatus, query.matchStatus))
  }

  if (query.itcStatus) {
    conditions.push(eq(purchaseTaxRecords.itcStatus, query.itcStatus))
  }

  if (query.branchId) {
    conditions.push(eq(purchaseTaxRecords.branchId, query.branchId))
  }

  if (query.gstRegistrationId) {
    conditions.push(eq(purchaseTaxRecords.gstRegistrationId, query.gstRegistrationId))
  }

  if (query.search) {
    const term = `%${escapeLikeTerm(query.search)}%`
    conditions.push(
      or(
        ilike(purchaseTaxRecords.supplierName, term),
        ilike(purchaseTaxRecords.supplierGstin, term),
        ilike(purchaseTaxRecords.invoiceNumber, term)
      ) as SQL
    )
  }

  if (query.severity) {
    const exceptionRows = await db
      .select({ id: gstReconciliationExceptions.purchaseTaxRecordId })
      .from(gstReconciliationExceptions)
      .where(
        and(
          eq(gstReconciliationExceptions.businessId, businessId),
          eq(gstReconciliationExceptions.severity, query.severity),
          inArray(gstReconciliationExceptions.status, ["OPEN", "IN_REVIEW"])
        )
      )
    const ids = exceptionRows
      .map((row) => row.id)
      .filter((value): value is string => Boolean(value))

    conditions.push(ids.length ? inArray(purchaseTaxRecords.id, ids) : drizzleSql`false`)
  }

  return conditions
}

function resolveReconciliationSort(query: ListGstReconciliationQueryInput) {
  const direction = query.sortDir === "asc" ? asc : desc

  switch (query.sortBy) {
    case "supplier":
      return direction(purchaseTaxRecords.supplierName)
    case "invoiceNumber":
      return direction(purchaseTaxRecords.invoiceNumber)
    case "bookTax":
      return direction(purchaseTaxRecords.totalTax)
    case "status":
      return direction(purchaseTaxRecords.reconciliationStatus)
    default:
      return direction(purchaseTaxRecords.invoiceDate)
  }
}

async function getGstReconciliationSummary(businessId: string, period?: string) {
  const conditions = [eq(purchaseTaxRecords.businessId, businessId)]

  if (period) {
    conditions.push(eq(purchaseTaxRecords.taxPeriod, period))
  }

  const rows = await db
    .select()
    .from(purchaseTaxRecords)
    .where(and(...conditions))
  const externalConditions = [eq(externalGstRecords.businessId, businessId)]

  if (period) {
    externalConditions.push(eq(externalGstRecords.period, period))
  }

  const externalRows = (
    await db
    .select()
    .from(externalGstRecords)
    .where(and(...externalConditions))
  ).filter((row) => row.status !== "ignored")

  return {
    booksItc: formatCents(rows.reduce((sum, row) => sum + toCents(row.totalTax), 0)),
    externalItc: formatCents(
      externalRows.reduce((sum, row) => sum + toCents(row.totalTax), 0)
    ),
    matched: rows.filter((row) => row.reconciliationStatus === "MATCHED").length,
    mismatch: rows.filter((row) =>
      ["VALUE_MISMATCH", "TAX_MISMATCH", "DATE_MISMATCH", "PARTIAL_MATCH"].includes(
        row.reconciliationStatus
      )
    ).length,
    booksOnly: rows.filter((row) => row.reconciliationStatus === "BOOKS_ONLY").length,
    externalOnly: externalRows.filter((row) => row.status === "available").length,
    duplicate: rows.filter((row) => row.reconciliationStatus === "DUPLICATE").length,
    manualReview: rows.filter((row) => row.reconciliationStatus === "MANUAL_REVIEW").length,
    eligible: rows.filter((row) =>
      ["ELIGIBLE", "PARTIALLY_ELIGIBLE"].includes(row.itcStatus)
    ).length,
    deferred: rows.filter((row) => row.itcStatus === "DEFERRED").length,
    claimed: rows.filter((row) => row.itcStatus === "CLAIMED").length,
  }
}

async function getActiveMatch(businessId: string, purchaseTaxRecordId: string) {
  return db.query.gstReconciliationMatches.findFirst({
    where: and(
      eq(gstReconciliationMatches.businessId, businessId),
      eq(gstReconciliationMatches.purchaseTaxRecordId, purchaseTaxRecordId),
      eq(gstReconciliationMatches.status, "active")
    ),
  })
}

async function resolveImportGstRegistrationId(
  businessId: string,
  requestedId: string | undefined
) {
  if (requestedId) {
    const registration = await db.query.gstRegistrations.findFirst({
      where: and(
        eq(gstRegistrations.businessId, businessId),
        eq(gstRegistrations.id, requestedId),
        eq(gstRegistrations.status, "active")
      ),
    })

    if (!registration) {
      throw new HttpError(400, "Selected GST registration is not active for this business.")
    }

    return registration.id
  }

  const registration = await db.query.gstRegistrations.findFirst({
    where: and(eq(gstRegistrations.businessId, businessId), eq(gstRegistrations.status, "active")),
    orderBy: [asc(gstRegistrations.createdAt)],
  })

  if (!registration) {
    throw new HttpError(409, "Add an active GST registration before importing GSTR records.")
  }

  return registration.id
}

async function markDuplicateExternalRecords(
  access: BusinessAccess,
  period: string,
  gstRegistrationId: string | null,
  source: string
) {
  const records = await db
    .select()
    .from(externalGstRecords)
    .where(
      and(
        eq(externalGstRecords.businessId, access.business.id),
        eq(externalGstRecords.period, period),
        eq(externalGstRecords.source, source),
        gstRegistrationId ?
          eq(externalGstRecords.gstRegistrationId, gstRegistrationId)
        : drizzleSql`${externalGstRecords.gstRegistrationId} is null`
      )
    )
    .orderBy(asc(externalGstRecords.createdAt))
  const seen = new Map<string, ExternalGstRecord>()
  let duplicates = 0

  for (const record of records) {
    const key = [
      record.gstRegistrationId ?? "",
      record.supplierGstin,
      record.normalizedDocumentNumber,
      record.documentDate,
      record.taxableValue,
      record.totalTax,
    ].join("|")
    const first = seen.get(key)

    if (!first) {
      seen.set(key, record)
      continue
    }

    if (record.status !== "ignored") {
      await db
        .update(externalGstRecords)
        .set({ status: "ignored", updatedAt: new Date() })
        .where(eq(externalGstRecords.id, record.id))
      duplicates += 1
    }

    await markExternalException(
      access,
      record,
      "DUPLICATE",
      "HIGH",
      `Duplicate external GST record for ${record.documentNumber}; first record ${first.id} remains available.`
    )
  }

  return duplicates
}

function assertManualMatchAllowed(record: PurchaseTaxRecord, external: ExternalGstRecord) {
  if (record.inputType === "rcm") {
    throw new HttpError(409, "RCM records use a separate ITC lifecycle and cannot be matched to supplier GSTR-2B rows.")
  }

  if (external.status !== "available") {
    throw new HttpError(409, "External GST record is not available for matching.")
  }

  if ((record.gstRegistrationId ?? null) !== (external.gstRegistrationId ?? null)) {
    throw new HttpError(409, "Book and external GST records belong to different GST registrations.")
  }

  if (!record.supplierGstin || record.supplierGstin !== external.supplierGstin) {
    throw new HttpError(409, "Supplier GSTIN must match for manual reconciliation.")
  }

  if (record.normalizedInvoiceNumber !== external.normalizedDocumentNumber) {
    throw new HttpError(409, "Document number must be compatible for manual reconciliation.")
  }
}

function assertItcTransitionAllowed(from: string, to: ItcStatus) {
  try {
    assertAllowedItcTransition(from as ItcStatus, to)
  } catch {
    throw new HttpError(409, `Invalid ITC transition: ${from} -> ${to}`)
  }
}

function assertNormalItcLifecycle(record: PurchaseTaxRecord) {
  if (record.inputType === "rcm") {
    throw new HttpError(409, "RCM ITC must be handled through the RCM tax liability workflow.")
  }
}

function getPreviousItcAuditAmounts(record: PurchaseTaxRecord) {
  return {
    previousEligibleCgst: record.eligibleCgst,
    previousEligibleSgst: record.eligibleSgst,
    previousEligibleIgst: record.eligibleIgst,
    previousEligibleCess: record.eligibleCess,
    previousIneligibleCgst: record.ineligibleCgst,
    previousIneligibleSgst: record.ineligibleSgst,
    previousIneligibleIgst: record.ineligibleIgst,
    previousIneligibleCess: record.ineligibleCess,
    previousDeferredCgst: record.deferredCgst,
    previousDeferredSgst: record.deferredSgst,
    previousDeferredIgst: record.deferredIgst,
    previousDeferredCess: record.deferredCess,
  }
}

function assertClaimWithinRemainingTax(record: PurchaseTaxRecord) {
  const components = [
    ["CGST", record.eligibleCgst, record.cgst],
    ["SGST", record.eligibleSgst, record.sgst],
    ["IGST", record.eligibleIgst, record.igst],
    ["CESS", record.eligibleCess, record.cess],
  ] as const

  for (const [label, claimable, source] of components) {
    if (toCents(claimable) > Math.max(toCents(source), 0)) {
      throw new HttpError(409, `${label} claim exceeds remaining claimable tax.`)
    }
  }
}

async function requirePurchaseTaxRecord(businessId: string, id: string) {
  const record = await db.query.purchaseTaxRecords.findFirst({
    where: and(eq(purchaseTaxRecords.businessId, businessId), eq(purchaseTaxRecords.id, id)),
  })

  if (!record) {
    throw new HttpError(404, "Purchase tax record not found.")
  }

  return record
}

async function markBookException(
  access: BusinessAccess,
  record: PurchaseTaxRecord,
  type: string,
  severity: "HIGH" | "MEDIUM" | "LOW",
  reason: string
) {
  await db
    .update(purchaseTaxRecords)
    .set({ reconciliationStatus: type, updatedAt: new Date() })
    .where(eq(purchaseTaxRecords.id, record.id))
  await ensureOpenException(access, {
    purchaseTaxRecordId: record.id,
    externalGstRecordId: null,
    matchId: null,
    exceptionType: type,
    severity,
    reason,
  })
}

async function markMatchedException(
  access: BusinessAccess,
  record: PurchaseTaxRecord,
  external: ExternalGstRecord,
  type: string,
  severity: "HIGH" | "MEDIUM" | "LOW",
  reason: string
) {
  const match = await getActiveMatch(access.business.id, record.id)
  await ensureOpenException(access, {
    purchaseTaxRecordId: record.id,
    externalGstRecordId: external.id,
    matchId: match?.id ?? null,
    exceptionType: type,
    severity,
    reason,
  })
}

async function markExternalException(
  access: BusinessAccess,
  external: ExternalGstRecord,
  type: string,
  severity: "HIGH" | "MEDIUM" | "LOW",
  reason: string
) {
  await ensureOpenException(access, {
    purchaseTaxRecordId: null,
    externalGstRecordId: external.id,
    matchId: null,
    exceptionType: type,
    severity,
    reason,
  })
}

async function ensureOpenException(
  access: BusinessAccess,
  input: {
    purchaseTaxRecordId: string | null
    externalGstRecordId: string | null
    matchId: string | null
    exceptionType: string
    severity: "HIGH" | "MEDIUM" | "LOW"
    reason: string
  }
) {
  const existing = await db.query.gstReconciliationExceptions.findFirst({
    where: and(
      eq(gstReconciliationExceptions.businessId, access.business.id),
      eq(gstReconciliationExceptions.exceptionType, input.exceptionType),
      input.purchaseTaxRecordId ?
        eq(gstReconciliationExceptions.purchaseTaxRecordId, input.purchaseTaxRecordId)
      : drizzleSql`${gstReconciliationExceptions.purchaseTaxRecordId} is null`,
      input.externalGstRecordId ?
        eq(gstReconciliationExceptions.externalGstRecordId, input.externalGstRecordId)
      : drizzleSql`${gstReconciliationExceptions.externalGstRecordId} is null`,
      inArray(gstReconciliationExceptions.status, ["OPEN", "IN_REVIEW"])
    ),
  })

  if (existing) {
    return existing
  }

  const [created] = await db
    .insert(gstReconciliationExceptions)
    .values({
      businessId: access.business.id,
      purchaseTaxRecordId: input.purchaseTaxRecordId,
      externalGstRecordId: input.externalGstRecordId,
      matchId: input.matchId,
      exceptionType: input.exceptionType,
      severity: input.severity,
      reason: input.reason,
    })
    .returning()

  await insertAuditLog(
    access,
    "gst_reconciliation_exception",
    created?.id ?? input.purchaseTaxRecordId ?? input.externalGstRecordId ?? access.business.id,
    "EXCEPTION_CREATED",
    null,
    created,
    input.reason
  )

  return created
}

async function assertPeriodOpen(
  businessId: string,
  period: string,
  gstRegistrationId?: string | null
) {
  const periodStart = `${period}-01`
  const lockedPeriod = await db.query.accountingPeriods.findFirst({
    where: and(
      eq(accountingPeriods.businessId, businessId),
      lte(accountingPeriods.periodStart, periodStart),
      gte(accountingPeriods.periodEnd, periodStart),
      eq(accountingPeriods.status, "locked"),
      or(
        drizzleSql`${accountingPeriods.gstRegistrationId} is null`,
        gstRegistrationId ?
          eq(accountingPeriods.gstRegistrationId, gstRegistrationId)
        : drizzleSql`false`
      )
    ),
  })

  if (lockedPeriod) {
    throw new HttpError(409, "This GST period is locked. Reopen the period before changing ITC reconciliation.")
  }
}

async function runGstOperationIdempotency<T>(
  access: BusinessAccess,
  scope: string,
  idempotencyKey: string,
  payload: unknown,
  operation: () => Promise<T>
) {
  const requestHash = buildGstReconciliationRequestHash(payload)
  const existing = await db.query.gstReconciliationIdempotencyKeys.findFirst({
    where: and(
      eq(gstReconciliationIdempotencyKeys.businessId, access.business.id),
      eq(gstReconciliationIdempotencyKeys.operationScope, scope),
      eq(gstReconciliationIdempotencyKeys.idempotencyKey, idempotencyKey)
    ),
  })

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new HttpError(409, "Idempotency key was already used with a different payload.")
    }

    if (existing.responseBody) {
      return existing.responseBody as T
    }
  }

  const result = await operation()

  await db
    .insert(gstReconciliationIdempotencyKeys)
    .values({
      businessId: access.business.id,
      operationScope: scope,
      idempotencyKey,
      requestHash,
      responseBody: result as Record<string, unknown>,
      status: "completed",
    })
    .onConflictDoUpdate({
      target: [
        gstReconciliationIdempotencyKeys.businessId,
        gstReconciliationIdempotencyKeys.operationScope,
        gstReconciliationIdempotencyKeys.idempotencyKey,
      ],
      set: {
        responseBody: result as Record<string, unknown>,
        status: "completed",
        updatedAt: new Date(),
      },
    })

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
    throw new HttpError(403, "You do not have permission to manage GST reconciliation.")
  }
}

async function insertAuditLog(
  access: BusinessAccess,
  entityType: string,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown,
  reason: string | null
) {
  await db.insert(auditLogs).values({
    businessId: access.business.id,
    entityType,
    entityId,
    action,
    userId: access.userId,
    before,
    after,
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

function createPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    hasMore: page * limit < total,
  }
}

function resolveEligibleStatus(body: ItcPartialEligibilityInput) {
  const partialCents =
    toCents(body.eligibleCgst) +
    toCents(body.eligibleSgst) +
    toCents(body.eligibleIgst) +
    toCents(body.eligibleCess)

  return partialCents > 0 ? "PARTIALLY_ELIGIBLE" : "ELIGIBLE"
}

function zeroItcAmounts() {
  return {
    eligibleCgst: "0.00",
    eligibleSgst: "0.00",
    eligibleIgst: "0.00",
    eligibleCess: "0.00",
    ineligibleCgst: "0.00",
    ineligibleSgst: "0.00",
    ineligibleIgst: "0.00",
    ineligibleCess: "0.00",
    deferredCgst: "0.00",
    deferredSgst: "0.00",
    deferredIgst: "0.00",
    deferredCess: "0.00",
  }
}

function getSnapshotName(value: unknown) {
  if (!value || typeof value !== "object") {
    return null
  }

  const snapshot = value as Record<string, unknown>
  return (
    (typeof snapshot.displayName === "string" && snapshot.displayName) ||
    (typeof snapshot.tradeName === "string" && snapshot.tradeName) ||
    (typeof snapshot.legalName === "string" && snapshot.legalName) ||
    null
  )
}

function normalizeDate(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10)
}

function sumDifference(match: GstReconciliationMatchRecord) {
  return formatCents(
    Math.abs(toCents(match.taxableDifference)) +
      Math.abs(toCents(match.cgstDifference)) +
      Math.abs(toCents(match.sgstDifference)) +
      Math.abs(toCents(match.igstDifference)) +
      Math.abs(toCents(match.cessDifference))
  )
}

function buildCsvExport(
  fileName: string,
  headers: string[],
  rows: Array<Array<string | number | null>>
): CsvExportResponse {
  return {
    fileName,
    contentType: "text/csv",
    content: [headers, ...rows]
      .map((row) => row.map((value) => csvCell(value)).join(","))
      .join("\n"),
  }
}

function csvCell(value: string | number | null) {
  const text = String(value ?? "")
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}
