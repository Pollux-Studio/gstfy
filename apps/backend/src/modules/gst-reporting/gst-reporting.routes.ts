import { createHash } from "node:crypto"
import { and, desc, eq, inArray, type SQL } from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { db, sql } from "../../db/client.js"
import {
  auditLogs,
  businessMemberPermissions,
  gstRegistrations,
  gstReportingExceptions,
  gstReportingExports,
  gstReportingFacts,
  gstReportingIdempotencyKeys,
  gstReportingRuns,
  type GstReportingRunRecord,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"
import {
  buildGstReportingRequestHash,
  createCsvExport,
  createJsonExport,
  createXlsxExport,
  formatCents,
  periodToRange,
  toCents,
  type GstReportingExportFormat,
  type ReportTable,
} from "./gst-reporting.domain.js"
import {
  approveReportingRunSchema,
  createGstReportingRunSchema,
  gstReportingRunParamsSchema,
  listReportingRunsQuerySchema,
  reopenReportingRunSchema,
  reportingDatasetQuerySchema,
  reportingDrilldownQuerySchema,
  reportingExceptionsQuerySchema,
  reportingExportQuerySchema,
  reportingRunActionSchema,
  resolveReportingExceptionSchema,
  type ListReportingRunsQueryInput,
  type ReportingDatasetQueryInput,
  type ReportingDrilldownQueryInput,
  type ReportingExceptionsQueryInput,
} from "./gst-reporting.schemas.js"

type BusinessAccess = Awaited<ReturnType<typeof requirePrimaryBusinessAccess>>
type GstAction = "view" | "create" | "edit" | "delete"

type ExportResponse = {
  fileName: string
  contentType: string
  content: string
  encoding: "utf8" | "base64"
}

type SqlExecutor = {
  (strings: TemplateStringsArray, ...parameters: unknown[]): unknown
}

type ReportingFactRow = {
  id: string
  sourceDocumentType: string
  sourceDocumentId: string | null
  sourceDocumentNumber: string
  sourceDocumentDate: string
  partyName: string | null
  partyGstin: string | null
  placeOfSupplyStateCode: string | null
  classification: string
  hsnSac: string | null
  description: string | null
  uqc: string | null
  quantity: string
  taxableValue: string
  cgst: string
  sgst: string
  igst: string
  cess: string
  totalTax: string
  reportingStatus: string
}

type SectionSummaryRow = {
  classification: string
  count: number
  taxableValue: string
  cgst: string
  sgst: string
  igst: string
  cess: string
  totalTax: string
}

type HsnSummaryRow = {
  hsnSac: string
  description: string
  uqc: string
  quantity: string
  taxableValue: string
  cgst: string
  sgst: string
  igst: string
  cess: string
  totalTax: string
}

type DocumentSummaryRow = {
  sourceDocumentType: string
  firstNumber: string
  lastNumber: string
  issuedCount: number
  taxableValue: string
  totalTax: string
}

type GstRegistrationForReporting = {
  id: string
  gstin: string
  registrationDate: string | null
  effectiveFrom: string | null
  effectiveTo: string | null
}

export async function registerGstReportingRoutes(app: FastifyInstance) {
  app.get("/gst-reporting/runs", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = listReportingRunsQuerySchema.parse(request.query)

    return listReportingRuns(access.business.id, query)
  })

  app.post("/gst-reporting/runs", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "create")
    const body = createGstReportingRunSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runReportingIdempotency(
      access,
      `gst-report-run:${body.gstRegistrationId}:${body.period}`,
      idempotencyKey,
      body,
      async () => {
        const registration = await requireGstRegistration(
          access.business.id,
          body.gstRegistrationId,
          body.period
        )
        const run = await createOrGetRun(access, body.period, registration)
        const refreshedRun = await refreshReportingRun(access, run, registration.gstin)

        return { run: refreshedRun }
      }
    )
  })

  app.get("/gst-reporting/runs/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const { id } = gstReportingRunParamsSchema.parse(request.params)

    return { run: await requireReportingRun(access.business.id, id) }
  })

  app.post("/gst-reporting/runs/:id/refresh", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstReportingRunParamsSchema.parse(request.params)
    const body = reportingRunActionSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runReportingIdempotency(
      access,
      `gst-report-refresh:${id}`,
      idempotencyKey,
      body,
      async () => {
        const run = await requireReportingRun(access.business.id, id)
        const registration = await requireGstRegistration(
          access.business.id,
          run.gstRegistrationId,
          run.period
        )
        const refreshedRun = await refreshReportingRun(access, run, registration.gstin)
        await insertAuditLog(
          access,
          refreshedRun.id,
          "GST_REPORT_RUN_REFRESHED",
          run,
          refreshedRun,
          body.reason
        )

        return { run: refreshedRun }
      }
    )
  })

  app.post("/gst-reporting/runs/:id/mark-ready", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstReportingRunParamsSchema.parse(request.params)
    const body = reportingRunActionSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runReportingIdempotency(
      access,
      `gst-report-ready:${id}`,
      idempotencyKey,
      body,
      async () => {
        const run = await requireReportingRun(access.business.id, id)
        assertRunCanAdvance(run, ["REVIEW"])
        await assertFilingGate(run)
        const [updated] = await db
          .update(gstReportingRuns)
          .set({ status: "READY_FOR_CA_REVIEW", updatedAt: new Date() })
          .where(and(eq(gstReportingRuns.businessId, access.business.id), eq(gstReportingRuns.id, id)))
          .returning()

        if (!updated) {
          throw new HttpError(404, "GST reporting run not found.")
        }

        await insertAuditLog(
          access,
          updated.id,
          "GST_REPORT_READY_FOR_CA_REVIEW",
          run,
          updated,
          body.reason
        )

        return { run: updated }
      }
    )
  })

  app.post("/gst-reporting/runs/:id/approve", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstReportingRunParamsSchema.parse(request.params)
    const body = approveReportingRunSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runReportingIdempotency(
      access,
      `gst-report-approve:${id}`,
      idempotencyKey,
      body,
      async () => {
        const run = await requireReportingRun(access.business.id, id)
        assertRunCanAdvance(run, ["READY_FOR_CA_REVIEW"])
        await assertFilingGate(run)

        const [updated] = await db
          .update(gstReportingRuns)
          .set({
            status: "CA_APPROVED",
            approvedAt: new Date(),
            approvedBy: access.userId,
            approvalComment: body.approvalComment,
            updatedAt: new Date(),
          })
          .where(and(eq(gstReportingRuns.businessId, access.business.id), eq(gstReportingRuns.id, id)))
          .returning()

        if (!updated) {
          throw new HttpError(404, "GST reporting run not found.")
        }

        await insertAuditLog(
          access,
          updated.id,
          "GST_REPORT_CA_APPROVED",
          run,
          updated,
          body.approvalComment
        )

        return { run: updated }
      }
    )
  })

  app.post("/gst-reporting/runs/:id/lock", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstReportingRunParamsSchema.parse(request.params)
    const body = reportingRunActionSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runReportingIdempotency(
      access,
      `gst-report-lock:${id}`,
      idempotencyKey,
      body,
      async () => {
        const run = await requireReportingRun(access.business.id, id)
        assertRunCanAdvance(run, ["CA_APPROVED"])
        await assertFilingGate(run)

        const [updated] = await db
          .update(gstReportingRuns)
          .set({
            status: "READY_FOR_SUBMISSION",
            lockedAt: new Date(),
            lockedBy: access.userId,
            readyForSubmissionAt: new Date(),
            readyForSubmissionBy: access.userId,
            updatedAt: new Date(),
          })
          .where(and(eq(gstReportingRuns.businessId, access.business.id), eq(gstReportingRuns.id, id)))
          .returning()

        if (!updated) {
          throw new HttpError(404, "GST reporting run not found.")
        }

        await insertAuditLog(
          access,
          updated.id,
          "GST_REPORT_READY_FOR_SUBMISSION",
          run,
          updated,
          body.reason
        )

        return { run: updated }
      }
    )
  })

  app.post("/gst-reporting/runs/:id/reopen", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "delete")
    const { id } = gstReportingRunParamsSchema.parse(request.params)
    const body = reopenReportingRunSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runReportingIdempotency(
      access,
      `gst-report-reopen:${id}`,
      idempotencyKey,
      body,
      async () => {
        const run = await requireReportingRun(access.business.id, id)
        const registration = await requireGstRegistration(
          access.business.id,
          run.gstRegistrationId,
          run.period
        )
        const range = periodToRange(run.period)
        const [latestVersion] = await db
          .select({ version: gstReportingRuns.version })
          .from(gstReportingRuns)
          .where(
            and(
              eq(gstReportingRuns.businessId, access.business.id),
              eq(gstReportingRuns.gstRegistrationId, run.gstRegistrationId),
              eq(gstReportingRuns.period, run.period)
            )
          )
          .orderBy(desc(gstReportingRuns.version))
          .limit(1)
        const [updated] = await db
          .insert(gstReportingRuns)
          .values({
            businessId: access.business.id,
            gstRegistrationId: run.gstRegistrationId,
            gstinSnapshot: registration.gstin,
            period: run.period,
            periodStart: range.start,
            periodEnd: range.endInclusive,
            version: (latestVersion?.version ?? run.version) + 1,
            status: "DRAFT",
            createdBy: access.userId,
            reopenedAt: new Date(),
            reopenedBy: access.userId,
            reopenReason: body.reason,
          })
          .returning()

        if (!updated) {
          throw new HttpError(404, "GST reporting run not found.")
        }

        const refreshed = await refreshReportingRun(access, updated, registration.gstin)

        await insertAuditLog(access, refreshed.id, "GST_REPORT_REOPENED", run, refreshed, body.reason)

        return { run: refreshed }
      }
    )
  })

  app.post("/gst-reporting/runs/:id/submit", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstReportingRunParamsSchema.parse(request.params)
    const body = reportingRunActionSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runReportingIdempotency(
      access,
      `gst-report-submit:${id}`,
      idempotencyKey,
      body,
      async () => {
        const run = await requireReportingRun(access.business.id, id)
        assertRunCanAdvance(run, ["READY_FOR_SUBMISSION"])

        const [updated] = await db
          .update(gstReportingRuns)
          .set({
            status: "SUBMITTED",
            submittedAt: new Date(),
            submittedBy: access.userId,
            updatedAt: new Date(),
          })
          .where(and(eq(gstReportingRuns.businessId, access.business.id), eq(gstReportingRuns.id, id)))
          .returning()

        if (!updated) {
          throw new HttpError(404, "GST reporting run not found.")
        }

        await insertAuditLog(access, updated.id, "GST_REPORT_SUBMITTED", run, updated, body.reason)

        return { run: updated }
      }
    )
  })

  app.post("/gst-reporting/runs/:id/mark-filed", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const { id } = gstReportingRunParamsSchema.parse(request.params)
    const body = reportingRunActionSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runReportingIdempotency(
      access,
      `gst-report-filed:${id}`,
      idempotencyKey,
      body,
      async () => {
        const run = await requireReportingRun(access.business.id, id)
        assertRunCanAdvance(run, ["SUBMITTED"])

        const [updated] = await db
          .update(gstReportingRuns)
          .set({
            status: "FILED",
            filedAt: new Date(),
            filedBy: access.userId,
            updatedAt: new Date(),
          })
          .where(and(eq(gstReportingRuns.businessId, access.business.id), eq(gstReportingRuns.id, id)))
          .returning()

        if (!updated) {
          throw new HttpError(404, "GST reporting run not found.")
        }

        await insertAuditLog(access, updated.id, "GST_REPORT_FILED", run, updated, body.reason)

        return { run: updated }
      }
    )
  })

  app.get("/gst-reporting/gstr1", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = reportingDatasetQuerySchema.parse(request.query)
    const run = await resolveRun(access.business.id, query)

    return getGstr1Dataset(run)
  })

  app.get("/gst-reporting/gstr1/export", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = reportingExportQuerySchema.parse(request.query)
    const run = await resolveRun(access.business.id, query)
    const dataset = await getGstr1Dataset(run)

    return persistExport(access, run, "gstr1", query.format, buildGstr1Export(dataset))
  })

  app.get("/gst-reporting/gstr3b", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = reportingDatasetQuerySchema.parse(request.query)
    const run = await resolveRun(access.business.id, query)

    return getGstr3bDataset(run)
  })

  app.get("/gst-reporting/gstr3b/export", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = reportingExportQuerySchema.parse(request.query)
    const run = await resolveRun(access.business.id, query)
    const dataset = await getGstr3bDataset(run)

    return persistExport(access, run, "gstr3b", query.format, buildGstr3bExport(dataset))
  })

  app.get("/gst-reporting/hsn-summary", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = reportingDatasetQuerySchema.parse(request.query)
    const run = await resolveRun(access.business.id, query)

    return { run, hsn: await getHsnSummary(run) }
  })

  app.get("/gst-reporting/document-summary", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = reportingDatasetQuerySchema.parse(request.query)
    const run = await resolveRun(access.business.id, query)

    return { run, documents: await getDocumentSummary(run) }
  })

  app.get("/gst-reporting/review", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = reportingDatasetQuerySchema.parse(request.query)
    const run = await resolveRun(access.business.id, query)

    return getFilingReview(run)
  })

  app.get("/gst-reporting/exceptions", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = reportingExceptionsQuerySchema.parse(request.query)
    const run = await resolveRun(access.business.id, query)

    return listReportingExceptions(run, query)
  })

  app.post("/gst-reporting/exceptions/resolve", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "edit")
    const body = resolveReportingExceptionSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runReportingIdempotency(
      access,
      `gst-report-exception:${body.exceptionId}`,
      idempotencyKey,
      body,
      async () => {
        const exception = await db.query.gstReportingExceptions.findFirst({
          where: and(
            eq(gstReportingExceptions.businessId, access.business.id),
            eq(gstReportingExceptions.id, body.exceptionId)
          ),
        })

        if (!exception) {
          throw new HttpError(404, "GST reporting exception not found.")
        }

        const run = await requireReportingRun(access.business.id, exception.runId)
        assertRunMutable(run)

        const [updated] = await db
          .update(gstReportingExceptions)
          .set({
            status: body.status,
            resolution: body.resolution,
            resolvedAt: body.status === "IN_REVIEW" ? null : new Date(),
            resolvedBy: body.status === "IN_REVIEW" ? null : access.userId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(gstReportingExceptions.businessId, access.business.id),
              eq(gstReportingExceptions.id, body.exceptionId)
            )
          )
          .returning()

        return { exception: updated }
      }
    )
  })

  app.get("/gst-reporting/drilldown", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseGst(access, "view")
    const query = reportingDrilldownQuerySchema.parse(request.query)
    const run = await resolveRun(access.business.id, query)

    return listReportingDrilldown(run, query)
  })
}

async function createOrGetRun(
  access: BusinessAccess,
  period: string,
  registration: GstRegistrationForReporting
) {
  const range = periodToRange(period)
  const existingRuns = await db
    .select()
    .from(gstReportingRuns)
    .where(
      and(
        eq(gstReportingRuns.businessId, access.business.id),
        eq(gstReportingRuns.gstRegistrationId, registration.id),
        eq(gstReportingRuns.period, period)
      )
    )
    .orderBy(desc(gstReportingRuns.version), desc(gstReportingRuns.createdAt))
    .limit(1)
  const latestRun = existingRuns[0]

  if (latestRun && isRunRefreshable(latestRun)) {
    return latestRun
  }

  const nextVersion = latestRun ? latestRun.version + 1 : 1
  const [run] = await db
    .insert(gstReportingRuns)
    .values({
      businessId: access.business.id,
      gstRegistrationId: registration.id,
      gstinSnapshot: registration.gstin,
      period,
      periodStart: range.start,
      periodEnd: range.endInclusive,
      version: nextVersion,
      status: "DRAFT",
      createdBy: access.userId,
    })
    .returning()

  if (!run) {
    throw new HttpError(500, "Unable to create GST reporting run.")
  }

  await insertAuditLog(access, run.id, "GST_REPORT_RUN_CREATED", null, run, null)

  return run
}

async function refreshReportingRun(
  access: BusinessAccess,
  run: GstReportingRunRecord,
  gstin: string
) {
  assertRunCanRefresh(run)

  await sql.begin(async (transaction) => {
    await transaction`delete from public.gst_reporting_exceptions where run_id = ${run.id}`
    await transaction`delete from public.gst_reporting_facts where run_id = ${run.id}`
    await insertSalesFacts(transaction, run)
    await insertPosFacts(transaction, run)
    await insertAdjustmentFacts(transaction, run)
    await insertGeneratedExceptions(transaction, run)
    await insertSourceCompletenessExceptions(transaction, run)
  })

  const sourceDataHash = await buildSourceDataHash(run)
  const summary = await buildRunSummary(run)
  const range = periodToRange(run.period)
  const [updated] = await db
    .update(gstReportingRuns)
    .set({
      status: "REVIEW",
      generatedAt: new Date(),
      gstinSnapshot: run.gstinSnapshot ?? gstin,
      periodStart: run.periodStart ?? range.start,
      periodEnd: run.periodEnd ?? range.endInclusive,
      sourceDataHash,
      summary,
      updatedAt: new Date(),
    })
    .where(and(eq(gstReportingRuns.businessId, run.businessId), eq(gstReportingRuns.id, run.id)))
    .returning()

  if (!updated) {
    throw new HttpError(404, "GST reporting run not found.")
  }

  return updated
}

async function insertSalesFacts(
  transaction: SqlExecutor,
  run: GstReportingRunRecord
) {
  const range = periodToRange(run.period)

  await transaction`
    insert into public.gst_reporting_facts (
      run_id, business_id, gst_registration_id, period, source_voucher_id,
      source_document_id, source_document_type, source_document_number,
      source_document_date, source_line_id, party_id, party_name, party_gstin,
      place_of_supply_state_code, classification, hsn_sac, description, uqc,
      quantity, taxable_value, cgst, sgst, igst, cess, total_tax,
      reverse_charge, itc_category, reporting_status, source_snapshot
    )
    select
      ${run.id}, invoice.business_id, invoice.gst_registration_id, ${run.period},
      invoice.voucher_id, invoice.id, 'sales_invoice', invoice.invoice_number,
      invoice.invoice_date::date, line.id, invoice.party_id, invoice.customer_name,
      nullif(invoice.party_snapshot->>'gstin', ''),
      invoice.place_of_supply_state_code,
      case
        when upper(line.taxability) = 'NIL_RATED' then 'NIL_RATED'
        when upper(line.taxability) = 'EXEMPT' then 'EXEMPT'
        when upper(line.taxability) = 'NON_GST' then 'NON_GST'
        when lower(invoice.supply_type) = 'export' or lower(invoice.invoice_type) = 'export' then 'EXPORT'
        when lower(invoice.supply_type) = 'sez' or lower(invoice.invoice_type) = 'sez' then 'SEZ'
        when lower(invoice.supply_type) = 'deemed_export' or lower(invoice.invoice_type) = 'deemed_export' then 'DEEMED_EXPORT'
        when lower(invoice.supply_type) = 'b2b' or nullif(invoice.party_snapshot->>'gstin', '') is not null then 'B2B'
        else 'B2C'
      end,
      line.hsn_sac_code, line.item_name_snapshot, line.unit, line.quantity,
      line.taxable_value, line.cgst_amount, line.sgst_amount, line.igst_amount,
      line.cess_amount,
      line.cgst_amount + line.sgst_amount + line.igst_amount + line.cess_amount,
      line.reverse_charge, null, 'included',
      jsonb_build_object(
        'invoiceType', invoice.invoice_type,
        'supplyType', invoice.supply_type,
        'taxability', line.taxability,
        'lineTotal', line.line_total
      )
    from public.sales_invoices invoice
    join public.sales_invoice_lines line
      on line.sales_invoice_id = invoice.id
      and line.business_id = invoice.business_id
    where invoice.business_id = ${run.businessId}
      and invoice.gst_registration_id = ${run.gstRegistrationId}
      and invoice.status = 'posted'
      and invoice.invoice_date >= ${range.start}
      and invoice.invoice_date < ${range.endExclusive}
  `
}

async function insertPosFacts(
  transaction: SqlExecutor,
  run: GstReportingRunRecord
) {
  const range = periodToRange(run.period)

  await transaction`
    insert into public.gst_reporting_facts (
      run_id, business_id, gst_registration_id, period, source_voucher_id,
      source_document_id, source_document_type, source_document_number,
      source_document_date, source_line_id, party_id, party_name, party_gstin,
      place_of_supply_state_code, classification, hsn_sac, description, uqc,
      quantity, taxable_value, cgst, sgst, igst, cess, total_tax,
      reverse_charge, itc_category, reporting_status, source_snapshot
    )
    select
      ${run.id}, sale.business_id, sale.gst_registration_id, ${run.period},
      sale.voucher_id, sale.id, 'pos_sale', sale.receipt_number,
      sale.receipt_date::date, line.id, sale.party_id, sale.customer_name,
      nullif(sale.party_snapshot->>'gstin', ''),
      sale.place_of_supply_state_code,
      case
        when upper(line.taxability) = 'NIL_RATED' then 'NIL_RATED'
        when upper(line.taxability) = 'EXEMPT' then 'EXEMPT'
        when upper(line.taxability) = 'NON_GST' then 'NON_GST'
        when nullif(sale.party_snapshot->>'gstin', '') is not null then 'B2B'
        else 'B2C'
      end,
      line.hsn_sac_code, line.item_name_snapshot, line.unit, line.quantity,
      line.taxable_value, line.cgst_amount, line.sgst_amount, line.igst_amount,
      line.cess_amount,
      line.cgst_amount + line.sgst_amount + line.igst_amount + line.cess_amount,
      line.reverse_charge, null, 'included',
      jsonb_build_object(
        'source', 'pos',
        'taxability', line.taxability,
        'lineTotal', line.line_total
      )
    from public.pos_sales sale
    join public.pos_sale_lines line
      on line.pos_sale_id = sale.id
      and line.business_id = sale.business_id
    where sale.business_id = ${run.businessId}
      and sale.gst_registration_id = ${run.gstRegistrationId}
      and sale.status = 'posted'
      and sale.receipt_date >= ${range.start}
      and sale.receipt_date < ${range.endExclusive}
  `
}

async function insertAdjustmentFacts(
  transaction: SqlExecutor,
  run: GstReportingRunRecord
) {
  const range = periodToRange(run.period)

  await transaction`
    insert into public.gst_reporting_facts (
      run_id, business_id, gst_registration_id, period, source_voucher_id,
      source_document_id, source_document_type, source_document_number,
      source_document_date, source_line_id, party_id, party_name, party_gstin,
      place_of_supply_state_code, classification, hsn_sac, description, uqc,
      quantity, taxable_value, cgst, sgst, igst, cess, total_tax,
      reverse_charge, itc_category, reporting_status, source_snapshot
    )
    select
      ${run.id}, document.business_id, document.gst_registration_id, ${run.period},
      document.voucher_id, document.id, lower(document.adjustment_type), document.adjustment_number,
      document.adjustment_date, line.id, document.party_id,
      coalesce(nullif(document.party_snapshot->>'displayName', ''), 'Counterparty'),
      nullif(document.party_snapshot->>'gstin', ''),
      coalesce(nullif(document.party_snapshot->>'stateCode', ''), nullif(document.source_snapshot->>'placeOfSupplyStateCode', '')),
      case
        when document.source_party_role = 'customer' and document.adjustment_type in ('CREDIT_NOTE', 'SALES_RETURN') then 'CREDIT_NOTE'
        when document.source_party_role = 'customer' and document.adjustment_type = 'DEBIT_NOTE' then 'DEBIT_NOTE'
        when document.source_party_role = 'supplier' and document.adjustment_type in ('CREDIT_NOTE', 'PURCHASE_RETURN') then 'PURCHASE_CREDIT_ADJUSTMENT'
        when document.source_party_role = 'supplier' and document.adjustment_type = 'DEBIT_NOTE' then 'PURCHASE_DEBIT_ADJUSTMENT'
        else document.adjustment_type
      end,
      line.hsn_sac_snapshot, line.description_snapshot, coalesce(line.uqc_snapshot, line.unit),
      line.quantity, line.taxable_value, line.cgst_amount, line.sgst_amount,
      line.igst_amount, line.cess_amount,
      line.cgst_amount + line.sgst_amount + line.igst_amount + line.cess_amount,
      false, document.source_party_role, 'included',
      jsonb_build_object(
        'adjustmentType', document.adjustment_type,
        'issuerType', document.issuer_type,
        'documentDirection', document.document_direction,
        'sourcePartyRole', document.source_party_role,
        'reasonCode', document.reason_code
      )
    from public.adjustment_documents document
    join public.adjustment_document_lines line
      on line.adjustment_document_id = document.id
      and line.business_id = document.business_id
    where document.business_id = ${run.businessId}
      and document.gst_registration_id = ${run.gstRegistrationId}
      and document.status = 'posted'
      and document.adjustment_date >= ${range.start}::date
      and document.adjustment_date < ${range.endExclusive}::date
  `
}

async function insertGeneratedExceptions(
  transaction: SqlExecutor,
  run: GstReportingRunRecord
) {
  const range = periodToRange(run.period)

  await transaction`
    insert into public.gst_reporting_exceptions (
      run_id, business_id, gst_registration_id, period, fact_id, source_document_type,
      source_document_id, exception_type, severity, status, message, recommendation,
      is_blocking
    )
    select
      ${run.id}, business_id, gst_registration_id, period, id, source_document_type,
      source_document_id, 'MISSING_HSN', 'HIGH', 'OPEN',
      'HSN/SAC is missing for a reportable GST line.',
      'Edit the source document or reverse and recreate it with HSN/SAC before filing.',
      true
    from public.gst_reporting_facts
    where run_id = ${run.id}
      and classification in ('B2B', 'CREDIT_NOTE', 'DEBIT_NOTE')
      and nullif(hsn_sac, '') is null
  `

  await transaction`
    insert into public.gst_reporting_exceptions (
      run_id, business_id, gst_registration_id, period, fact_id, source_document_type,
      source_document_id, exception_type, severity, status, message, recommendation,
      is_blocking
    )
    select
      ${run.id}, business_id, gst_registration_id, period, id, source_document_type,
      source_document_id, 'MISSING_GSTIN', 'HIGH', 'OPEN',
      'A B2B or note record is missing the counterparty GSTIN.',
      'Add the party GSTIN or correct the supply classification before filing.',
      true
    from public.gst_reporting_facts
    where run_id = ${run.id}
      and classification in ('B2B', 'CREDIT_NOTE', 'DEBIT_NOTE')
      and nullif(party_gstin, '') is null
  `

  await transaction`
    insert into public.gst_reporting_exceptions (
      run_id, business_id, gst_registration_id, period, fact_id, source_document_type,
      source_document_id, exception_type, severity, status, message, recommendation,
      is_blocking
    )
    select
      ${run.id}, business_id, gst_registration_id, period, id, source_document_type,
      source_document_id, 'INVALID_TAX_SPLIT', 'HIGH', 'OPEN',
      'CGST and SGST are not equal on an intra-state tax split.',
      'Review the source transaction tax split before marking the return ready.',
      true
    from public.gst_reporting_facts
    where run_id = ${run.id}
      and cgst > 0
      and sgst > 0
      and abs(cgst - sgst) > 1
  `

  await transaction`
    insert into public.gst_reporting_exceptions (
      run_id, business_id, gst_registration_id, period, source_document_type,
      source_document_id, exception_type, severity, status, message, recommendation,
      is_blocking
    )
    select
      ${run.id}, ${run.businessId}, ${run.gstRegistrationId}, ${run.period},
      'gst_reconciliation_exception', exception.id,
      'GST_RECONCILIATION_EXCEPTION', exception.severity, 'OPEN',
      'There is an unresolved GST reconciliation exception for this period.',
      'Resolve high-severity GSTR-2B reconciliation issues before filing review is ready.',
      case when exception.severity = 'HIGH' then true else false end
    from public.gst_reconciliation_exceptions exception
    left join public.purchase_tax_records record
      on record.id = exception.purchase_tax_record_id
      and record.business_id = exception.business_id
    where exception.business_id = ${run.businessId}
      and exception.status in ('OPEN', 'IN_REVIEW')
      and record.gst_registration_id = ${run.gstRegistrationId}
      and record.tax_period = ${run.period}
  `

  await transaction`
    insert into public.gst_reporting_exceptions (
      run_id, business_id, gst_registration_id, period, source_document_type,
      exception_type, severity, status, message, recommendation, is_blocking
    )
    select
      ${run.id}, ${run.businessId}, ${run.gstRegistrationId}, ${run.period},
      'purchase_tax_record', 'INCOMPLETE_ITC_DECISION', 'HIGH', 'OPEN',
      count(*)::text || ' purchase GST record(s) still need ITC review.',
      'Mark ITC as eligible, deferred, ineligible, rejected, or claimed before filing.',
      true
    from public.purchase_tax_records
    where business_id = ${run.businessId}
      and gst_registration_id = ${run.gstRegistrationId}
      and tax_period = ${run.period}
      and itc_status = 'NOT_REVIEWED'
    having count(*) > 0
  `

  await transaction`
    insert into public.gst_reporting_exceptions (
      run_id, business_id, gst_registration_id, period, source_document_type,
      exception_type, severity, status, message, recommendation, is_blocking
    )
    select
      ${run.id}, ${run.businessId}, ${run.gstRegistrationId}, ${run.period},
      source_type, 'UNPOSTED_PERIOD_DOCUMENT', 'HIGH', 'OPEN',
      count(*)::text || ' draft document(s) exist in this return period.',
      'Post, delete, or move draft documents before locking the GST report.',
      true
    from (
      select 'sales_invoice' as source_type
      from public.sales_invoices
      where business_id = ${run.businessId}
        and gst_registration_id = ${run.gstRegistrationId}
        and status = 'draft'
        and invoice_date >= ${range.start}
        and invoice_date < ${range.endExclusive}
      union all
      select 'purchase_bill' as source_type
      from public.purchase_bills
      where business_id = ${run.businessId}
        and gst_registration_id = ${run.gstRegistrationId}
        and status = 'draft'
        and bill_date >= ${range.start}
        and bill_date < ${range.endExclusive}
      union all
      select 'adjustment_document' as source_type
      from public.adjustment_documents
      where business_id = ${run.businessId}
        and gst_registration_id = ${run.gstRegistrationId}
        and status = 'draft'
        and adjustment_date >= ${range.start}::date
        and adjustment_date < ${range.endExclusive}::date
    ) drafts
    group by source_type
  `
}

async function insertSourceCompletenessExceptions(
  transaction: SqlExecutor,
  run: GstReportingRunRecord
) {
  const range = periodToRange(run.period)

  await transaction`
    insert into public.gst_reporting_exceptions (
      run_id, business_id, gst_registration_id, period, source_document_type,
      exception_type, severity, status, message, recommendation, is_blocking
    )
    select
      ${run.id}, ${run.businessId}, ${run.gstRegistrationId}, ${run.period},
      'source_map', 'SOURCE_COMPLETENESS_MISMATCH', 'HIGH', 'OPEN',
      'Posted source line count does not match GST reporting fact count.',
      'Refresh the report. If the issue remains, review the source documents before CA approval.',
      true
    from (
      select
        (
          select count(*)::int
          from public.sales_invoices invoice
          join public.sales_invoice_lines line
            on line.sales_invoice_id = invoice.id
            and line.business_id = invoice.business_id
          where invoice.business_id = ${run.businessId}
            and invoice.gst_registration_id = ${run.gstRegistrationId}
            and invoice.status = 'posted'
            and invoice.invoice_date >= ${range.start}
            and invoice.invoice_date < ${range.endExclusive}
        ) +
        (
          select count(*)::int
          from public.pos_sales sale
          join public.pos_sale_lines line
            on line.pos_sale_id = sale.id
            and line.business_id = sale.business_id
          where sale.business_id = ${run.businessId}
            and sale.gst_registration_id = ${run.gstRegistrationId}
            and sale.status = 'posted'
            and sale.receipt_date >= ${range.start}
            and sale.receipt_date < ${range.endExclusive}
        ) +
        (
          select count(*)::int
          from public.adjustment_documents document
          join public.adjustment_document_lines line
            on line.adjustment_document_id = document.id
            and line.business_id = document.business_id
          where document.business_id = ${run.businessId}
            and document.gst_registration_id = ${run.gstRegistrationId}
            and document.status = 'posted'
            and document.adjustment_date >= ${range.start}::date
            and document.adjustment_date < ${range.endExclusive}::date
        ) as expected_count,
        (
          select count(*)::int
          from public.gst_reporting_facts fact
          where fact.run_id = ${run.id}
            and fact.reporting_status = 'included'
        ) as actual_count
    ) counts
    where counts.expected_count <> counts.actual_count
  `

  await transaction`
    insert into public.gst_reporting_exceptions (
      run_id, business_id, gst_registration_id, period, source_document_type,
      exception_type, severity, status, message, recommendation, is_blocking
    )
    select
      ${run.id}, ${run.businessId}, ${run.gstRegistrationId}, ${run.period},
      duplicate.source_document_type, 'DUPLICATE_REPORTING_FACT', 'HIGH', 'OPEN',
      'The same source document line appears more than once in this GST report.',
      'Reopen or refresh the report and verify adjustment/source identity before filing.',
      true
    from (
      select source_document_type, source_document_id, source_line_id, count(*) as duplicate_count
      from public.gst_reporting_facts
      where run_id = ${run.id}
        and source_document_id is not null
        and source_line_id is not null
      group by source_document_type, source_document_id, source_line_id
      having count(*) > 1
    ) duplicate
  `

  await transaction`
    insert into public.gst_reporting_exceptions (
      run_id, business_id, gst_registration_id, period, source_document_type,
      exception_type, severity, status, message, recommendation, is_blocking
    )
    select
      ${run.id}, ${run.businessId}, ${run.gstRegistrationId}, ${run.period},
      'tax_cross_check', 'SOURCE_TAX_TOTAL_MISMATCH', 'HIGH', 'OPEN',
      'GST report totals do not match posted source tax totals.',
      'Do not approve filing until report totals and posted tax facts match.',
      true
    from (
      select
        (
          select coalesce(sum(
            line.cgst_amount + line.sgst_amount + line.igst_amount + line.cess_amount
          ), 0)
          from public.sales_invoices invoice
          join public.sales_invoice_lines line
            on line.sales_invoice_id = invoice.id
            and line.business_id = invoice.business_id
          where invoice.business_id = ${run.businessId}
            and invoice.gst_registration_id = ${run.gstRegistrationId}
            and invoice.status = 'posted'
            and invoice.invoice_date >= ${range.start}
            and invoice.invoice_date < ${range.endExclusive}
        ) +
        (
          select coalesce(sum(
            line.cgst_amount + line.sgst_amount + line.igst_amount + line.cess_amount
          ), 0)
          from public.pos_sales sale
          join public.pos_sale_lines line
            on line.pos_sale_id = sale.id
            and line.business_id = sale.business_id
          where sale.business_id = ${run.businessId}
            and sale.gst_registration_id = ${run.gstRegistrationId}
            and sale.status = 'posted'
            and sale.receipt_date >= ${range.start}
            and sale.receipt_date < ${range.endExclusive}
        ) +
        (
          select coalesce(sum(
            line.cgst_amount + line.sgst_amount + line.igst_amount + line.cess_amount
          ), 0)
          from public.adjustment_documents document
          join public.adjustment_document_lines line
            on line.adjustment_document_id = document.id
            and line.business_id = document.business_id
          where document.business_id = ${run.businessId}
            and document.gst_registration_id = ${run.gstRegistrationId}
            and document.status = 'posted'
            and document.adjustment_date >= ${range.start}::date
            and document.adjustment_date < ${range.endExclusive}::date
        ) as source_total,
        (
          select coalesce(sum(total_tax), 0)
          from public.gst_reporting_facts
          where run_id = ${run.id}
            and reporting_status = 'included'
        ) as report_total
    ) totals
    where totals.source_total <> totals.report_total
  `
}

export async function getGstr1Dataset(run: GstReportingRunRecord) {
  const [sections, hsn, documents] = await Promise.all([
    getSectionSummaries(run),
    getHsnSummary(run),
    getDocumentSummary(run),
  ])
  const rows = await sql<ReportingFactRow[]>`
    select
      id::text as "id",
      source_document_type as "sourceDocumentType",
      source_document_id::text as "sourceDocumentId",
      source_document_number as "sourceDocumentNumber",
      source_document_date::text as "sourceDocumentDate",
      party_name as "partyName",
      party_gstin as "partyGstin",
      place_of_supply_state_code as "placeOfSupplyStateCode",
      classification,
      hsn_sac as "hsnSac",
      description,
      uqc,
      quantity::text as "quantity",
      taxable_value::text as "taxableValue",
      cgst::text,
      sgst::text,
      igst::text,
      cess::text,
      total_tax::text as "totalTax",
      reporting_status as "reportingStatus"
    from public.gst_reporting_facts
    where run_id = ${run.id}
      and reporting_status = 'included'
      and classification in ('B2B', 'B2C', 'EXPORT', 'SEZ', 'DEEMED_EXPORT', 'NIL_RATED', 'EXEMPT', 'NON_GST', 'CREDIT_NOTE', 'DEBIT_NOTE')
    order by source_document_date desc, source_document_number desc
    limit 5000
  `

  return {
    run,
    sections,
    hsn,
    documents,
    rows,
    totals: totalRows(rows),
  }
}

export async function getGstr3bDataset(run: GstReportingRunRecord) {
  const outwardRows = await sql<SectionSummaryRow[]>`
    select
      classification,
      count(*)::int as count,
      coalesce(sum(
        case when classification in ('CREDIT_NOTE') then -taxable_value else taxable_value end
      ), 0)::text as "taxableValue",
      coalesce(sum(
        case when classification in ('CREDIT_NOTE') then -cgst else cgst end
      ), 0)::text as cgst,
      coalesce(sum(
        case when classification in ('CREDIT_NOTE') then -sgst else sgst end
      ), 0)::text as sgst,
      coalesce(sum(
        case when classification in ('CREDIT_NOTE') then -igst else igst end
      ), 0)::text as igst,
      coalesce(sum(
        case when classification in ('CREDIT_NOTE') then -cess else cess end
      ), 0)::text as cess,
      coalesce(sum(
        case when classification in ('CREDIT_NOTE') then -total_tax else total_tax end
      ), 0)::text as "totalTax"
    from public.gst_reporting_facts
    where run_id = ${run.id}
      and reporting_status = 'included'
      and classification not in ('PURCHASE_CREDIT_ADJUSTMENT', 'PURCHASE_DEBIT_ADJUSTMENT')
    group by classification
    order by classification
  `
  const [itc] = await sql<Array<{
    availableCgst: string
    availableSgst: string
    availableIgst: string
    availableCess: string
    claimedCgst: string
    claimedSgst: string
    claimedIgst: string
    claimedCess: string
    deferredCgst: string
    deferredSgst: string
    deferredIgst: string
    deferredCess: string
    ineligibleCgst: string
    ineligibleSgst: string
    ineligibleIgst: string
    ineligibleCess: string
    rcmTax: string
  }>>`
    select
      coalesce(sum(record.eligible_cgst), 0)::text as "availableCgst",
      coalesce(sum(record.eligible_sgst), 0)::text as "availableSgst",
      coalesce(sum(record.eligible_igst), 0)::text as "availableIgst",
      coalesce(sum(record.eligible_cess), 0)::text as "availableCess",
      coalesce(sum(claim.claimed_cgst) filter (where claim.status = 'active'), 0)::text as "claimedCgst",
      coalesce(sum(claim.claimed_sgst) filter (where claim.status = 'active'), 0)::text as "claimedSgst",
      coalesce(sum(claim.claimed_igst) filter (where claim.status = 'active'), 0)::text as "claimedIgst",
      coalesce(sum(claim.claimed_cess) filter (where claim.status = 'active'), 0)::text as "claimedCess",
      coalesce(sum(record.deferred_cgst), 0)::text as "deferredCgst",
      coalesce(sum(record.deferred_sgst), 0)::text as "deferredSgst",
      coalesce(sum(record.deferred_igst), 0)::text as "deferredIgst",
      coalesce(sum(record.deferred_cess), 0)::text as "deferredCess",
      coalesce(sum(record.ineligible_cgst), 0)::text as "ineligibleCgst",
      coalesce(sum(record.ineligible_sgst), 0)::text as "ineligibleSgst",
      coalesce(sum(record.ineligible_igst), 0)::text as "ineligibleIgst",
      coalesce(sum(record.ineligible_cess), 0)::text as "ineligibleCess",
      coalesce(sum(record.total_tax) filter (where record.input_type = 'rcm'), 0)::text as "rcmTax"
    from public.purchase_tax_records record
    left join public.itc_claims claim
      on claim.purchase_tax_record_id = record.id
      and claim.business_id = record.business_id
      and claim.claim_period = ${run.period}
    where record.business_id = ${run.businessId}
      and record.gst_registration_id = ${run.gstRegistrationId}
      and record.tax_period = ${run.period}
  `
  const outputTaxCents = outwardRows.reduce(
    (sum, row) =>
      sum +
      toCents(row.cgst) +
      toCents(row.sgst) +
      toCents(row.igst) +
      toCents(row.cess),
    0
  )
  const claimedItcCents =
    toCents(itc?.claimedCgst) +
    toCents(itc?.claimedSgst) +
    toCents(itc?.claimedIgst) +
    toCents(itc?.claimedCess)

  return {
    run,
    outward: outwardRows,
    itc: itc ?? null,
    totals: {
      outputTax: formatCents(outputTaxCents),
      claimedItc: formatCents(claimedItcCents),
      netGst: formatCents(outputTaxCents - claimedItcCents),
    },
  }
}

async function getFilingReview(run: GstReportingRunRecord) {
  const [gstr1, gstr3b, exceptions] = await Promise.all([
    getGstr1Dataset(run),
    getGstr3bDataset(run),
    listReportingExceptions(run, { page: 1, limit: 100 } as ReportingExceptionsQueryInput),
  ])
  const blockingCount = exceptions.exceptions.filter(
    (exception) => exception.isBlocking && ["OPEN", "IN_REVIEW"].includes(exception.status)
  ).length

  return {
    run,
    status: {
      canMarkReady: blockingCount === 0,
      blockingCount,
      exceptionCount: exceptions.pagination.total,
    },
    summary: {
      outputGst: gstr3b.totals.outputTax,
      inputGst: gstr3b.totals.claimedItc,
      netGst: gstr3b.totals.netGst,
      rcm: gstr3b.itc?.rcmTax ?? "0.00",
      eligibleItc: formatCents(
        toCents(gstr3b.itc?.availableCgst) +
          toCents(gstr3b.itc?.availableSgst) +
          toCents(gstr3b.itc?.availableIgst) +
          toCents(gstr3b.itc?.availableCess)
      ),
      unresolvedExceptions: String(blockingCount),
    },
    sections: {
      sales: gstr1.sections,
      hsn: gstr1.hsn,
      documents: gstr1.documents,
      exceptions: exceptions.exceptions,
    },
  }
}

async function getSectionSummaries(run: GstReportingRunRecord) {
  return sql<SectionSummaryRow[]>`
    select
      classification,
      count(*)::int as count,
      coalesce(sum(taxable_value), 0)::text as "taxableValue",
      coalesce(sum(cgst), 0)::text as cgst,
      coalesce(sum(sgst), 0)::text as sgst,
      coalesce(sum(igst), 0)::text as igst,
      coalesce(sum(cess), 0)::text as cess,
      coalesce(sum(total_tax), 0)::text as "totalTax"
    from public.gst_reporting_facts
    where run_id = ${run.id}
      and reporting_status = 'included'
    group by classification
    order by classification
  `
}

async function getHsnSummary(run: GstReportingRunRecord) {
  return sql<HsnSummaryRow[]>`
    select
      coalesce(nullif(hsn_sac, ''), 'UNMAPPED') as "hsnSac",
      coalesce(max(nullif(description, '')), 'Unmapped item') as description,
      coalesce(nullif(uqc, ''), 'PCS') as uqc,
      coalesce(sum(quantity), 0)::text as quantity,
      coalesce(sum(taxable_value), 0)::text as "taxableValue",
      coalesce(sum(cgst), 0)::text as cgst,
      coalesce(sum(sgst), 0)::text as sgst,
      coalesce(sum(igst), 0)::text as igst,
      coalesce(sum(cess), 0)::text as cess,
      coalesce(sum(total_tax), 0)::text as "totalTax"
    from public.gst_reporting_facts
    where run_id = ${run.id}
      and reporting_status = 'included'
      and classification in ('B2B', 'B2C', 'EXPORT', 'SEZ', 'DEEMED_EXPORT', 'NIL_RATED', 'EXEMPT', 'NON_GST', 'CREDIT_NOTE', 'DEBIT_NOTE')
    group by coalesce(nullif(hsn_sac, ''), 'UNMAPPED'), coalesce(nullif(uqc, ''), 'PCS')
    order by "hsnSac"
  `
}

async function getDocumentSummary(run: GstReportingRunRecord) {
  return sql<DocumentSummaryRow[]>`
    select
      source_document_type as "sourceDocumentType",
      min(source_document_number) as "firstNumber",
      max(source_document_number) as "lastNumber",
      count(distinct source_document_id)::int as "issuedCount",
      coalesce(sum(taxable_value), 0)::text as "taxableValue",
      coalesce(sum(total_tax), 0)::text as "totalTax"
    from public.gst_reporting_facts
    where run_id = ${run.id}
      and reporting_status = 'included'
    group by source_document_type
    order by source_document_type
  `
}

async function listReportingExceptions(
  run: GstReportingRunRecord,
  query: ReportingExceptionsQueryInput
) {
  const offset = (query.page - 1) * query.limit
  const conditions: SQL[] = [eq(gstReportingExceptions.runId, run.id)]

  if (query.status) {
    conditions.push(eq(gstReportingExceptions.status, query.status))
  }

  if (query.severity) {
    conditions.push(eq(gstReportingExceptions.severity, query.severity))
  }

  const [items, countRows] = await Promise.all([
    db
      .select()
      .from(gstReportingExceptions)
      .where(and(...conditions))
      .orderBy(desc(gstReportingExceptions.isBlocking), desc(gstReportingExceptions.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ id: gstReportingExceptions.id })
      .from(gstReportingExceptions)
      .where(and(...conditions)),
  ])

  return {
    exceptions: items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: countRows.length,
      hasMore: offset + items.length < countRows.length,
    },
  }
}

async function listReportingDrilldown(
  run: GstReportingRunRecord,
  query: ReportingDrilldownQueryInput
) {
  const offset = (query.page - 1) * query.limit
  const conditions: SQL[] = [eq(gstReportingFacts.runId, run.id)]

  if (query.classification) {
    conditions.push(eq(gstReportingFacts.classification, query.classification))
  }

  if (query.sourceDocumentType) {
    conditions.push(eq(gstReportingFacts.sourceDocumentType, query.sourceDocumentType))
  }

  if (query.hsnSac) {
    conditions.push(eq(gstReportingFacts.hsnSac, query.hsnSac))
  }

  const [items, countRows] = await Promise.all([
    db
      .select()
      .from(gstReportingFacts)
      .where(and(...conditions))
      .orderBy(desc(gstReportingFacts.sourceDocumentDate))
      .limit(query.limit)
      .offset(offset),
    db.select({ id: gstReportingFacts.id }).from(gstReportingFacts).where(and(...conditions)),
  ])

  return {
    run,
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: countRows.length,
      hasMore: offset + items.length < countRows.length,
    },
  }
}

async function buildRunSummary(run: GstReportingRunRecord) {
  const [sections, exceptionRows] = await Promise.all([
    getSectionSummaries(run),
    db
      .select()
      .from(gstReportingExceptions)
      .where(eq(gstReportingExceptions.runId, run.id)),
  ])
  const outputTax = sections.reduce((sum, section) => sum + toCents(section.totalTax), 0)
  const blockingExceptions = exceptionRows.filter(
    (row) => row.isBlocking && ["OPEN", "IN_REVIEW"].includes(row.status)
  ).length

  return {
    outputTax: formatCents(outputTax),
    sourceFacts: sections.reduce((sum, section) => sum + section.count, 0),
    blockingExceptions,
    exceptionCount: exceptionRows.length,
  }
}

async function buildSourceDataHash(run: GstReportingRunRecord) {
  const [facts, itc, exceptions] = await Promise.all([
    sql<Array<Record<string, unknown>>>`
      select
        source_voucher_id::text as source_voucher_id,
        source_document_type,
        source_document_id::text as source_document_id,
        source_line_id::text as source_line_id,
        source_document_number,
        source_document_date::text as source_document_date,
        classification,
        hsn_sac,
        uqc,
        quantity::text as quantity,
        taxable_value::text as taxable_value,
        cgst::text as cgst,
        sgst::text as sgst,
        igst::text as igst,
        cess::text as cess,
        total_tax::text as total_tax
      from public.gst_reporting_facts
      where run_id = ${run.id}
      order by source_document_type, source_document_id, source_line_id
    `,
    sql<Array<Record<string, unknown>>>`
      select
        record.id::text,
        record.purchase_bill_id::text,
        record.supplier_gstin,
        record.invoice_number,
        record.invoice_date::text,
        record.taxable_value::text,
        record.cgst::text,
        record.sgst::text,
        record.igst::text,
        record.cess::text,
        record.total_tax::text,
        record.itc_status,
        coalesce(sum(claim.claimed_cgst) filter (where claim.status = 'active'), 0)::text as claimed_cgst,
        coalesce(sum(claim.claimed_sgst) filter (where claim.status = 'active'), 0)::text as claimed_sgst,
        coalesce(sum(claim.claimed_igst) filter (where claim.status = 'active'), 0)::text as claimed_igst,
        coalesce(sum(claim.claimed_cess) filter (where claim.status = 'active'), 0)::text as claimed_cess
      from public.purchase_tax_records record
      left join public.itc_claims claim
        on claim.purchase_tax_record_id = record.id
        and claim.business_id = record.business_id
        and claim.claim_period = ${run.period}
      where record.business_id = ${run.businessId}
        and record.gst_registration_id = ${run.gstRegistrationId}
        and record.tax_period = ${run.period}
      group by record.id
      order by record.supplier_gstin, record.document_number, record.document_date
    `,
    sql<Array<Record<string, unknown>>>`
      select
        exception_type,
        severity,
        status,
        is_blocking,
        source_document_type,
        source_document_id::text as source_document_id
      from public.gst_reporting_exceptions
      where run_id = ${run.id}
      order by exception_type, source_document_type, source_document_id
    `,
  ])

  return createHash("sha256")
    .update(JSON.stringify({ facts, itc, exceptions }))
    .digest("hex")
}

async function assertFilingGate(run: GstReportingRunRecord) {
  await assertNoBlockingExceptions(run)
  await assertNoDuplicateFacts(run)

  if (!run.sourceDataHash) {
    throw new HttpError(409, "Refresh the GST report before moving it forward.")
  }
}

async function assertNoBlockingExceptions(run: GstReportingRunRecord) {
  const rows = await db
    .select({ id: gstReportingExceptions.id })
    .from(gstReportingExceptions)
    .where(
      and(
        eq(gstReportingExceptions.runId, run.id),
        eq(gstReportingExceptions.isBlocking, true),
        inArray(gstReportingExceptions.status, ["OPEN", "IN_REVIEW"])
      )
    )

  if (rows.length > 0) {
    throw new HttpError(
      409,
      "Resolve blocking GST reporting exceptions before marking this return ready."
    )
  }
}

async function assertNoDuplicateFacts(run: GstReportingRunRecord) {
  const rows = await sql<Array<{ duplicateCount: string }>>`
    select count(*)::text as "duplicateCount"
    from (
      select source_document_type, source_document_id, source_line_id
      from public.gst_reporting_facts
      where run_id = ${run.id}
        and source_document_id is not null
        and source_line_id is not null
      group by source_document_type, source_document_id, source_line_id
      having count(*) > 1
    ) duplicate
  `
  const duplicateCount = Number(rows[0]?.duplicateCount ?? "0")

  if (duplicateCount > 0) {
    throw new HttpError(409, "Duplicate GST reporting facts must be fixed before approval.")
  }
}

async function listReportingRuns(
  businessId: string,
  query: ListReportingRunsQueryInput
) {
  const conditions: SQL[] = [eq(gstReportingRuns.businessId, businessId)]

  if (query.period) {
    conditions.push(eq(gstReportingRuns.period, query.period))
  }

  if (query.gstRegistrationId) {
    conditions.push(eq(gstReportingRuns.gstRegistrationId, query.gstRegistrationId))
  }

  if (query.status) {
    conditions.push(eq(gstReportingRuns.status, query.status))
  }

  const offset = (query.page - 1) * query.limit
  const [runs, countRows] = await Promise.all([
    db
      .select()
      .from(gstReportingRuns)
      .where(and(...conditions))
      .orderBy(
        desc(gstReportingRuns.period),
        desc(gstReportingRuns.version),
        desc(gstReportingRuns.createdAt)
      )
      .limit(query.limit)
      .offset(offset),
    db.select({ id: gstReportingRuns.id }).from(gstReportingRuns).where(and(...conditions)),
  ])

  return {
    runs,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: countRows.length,
      hasMore: offset + runs.length < countRows.length,
    },
  }
}

async function resolveRun(
  businessId: string,
  query: ReportingDatasetQueryInput
) {
  if (query.runId) {
    return requireReportingRun(businessId, query.runId)
  }

  if (!query.period || !query.gstRegistrationId) {
    throw new HttpError(400, "Run id or GST registration and period are required.")
  }

  const [run] = await db
    .select()
    .from(gstReportingRuns)
    .where(
      and(
        eq(gstReportingRuns.businessId, businessId),
        eq(gstReportingRuns.gstRegistrationId, query.gstRegistrationId),
        eq(gstReportingRuns.period, query.period)
      )
    )
    .orderBy(desc(gstReportingRuns.version), desc(gstReportingRuns.createdAt))
    .limit(1)

  if (!run) {
    throw new HttpError(404, "Generate a GST reporting run for this period first.")
  }

  return run
}

async function requireReportingRun(businessId: string, id: string) {
  const run = await db.query.gstReportingRuns.findFirst({
    where: and(eq(gstReportingRuns.businessId, businessId), eq(gstReportingRuns.id, id)),
  })

  if (!run) {
    throw new HttpError(404, "GST reporting run not found.")
  }

  return run
}

async function requireGstRegistration(businessId: string, id: string, period?: string) {
  const registration = await db.query.gstRegistrations.findFirst({
    where: and(
      eq(gstRegistrations.businessId, businessId),
      eq(gstRegistrations.id, id),
      eq(gstRegistrations.status, "active")
    ),
  })

  if (!registration) {
    throw new HttpError(400, "Selected GST registration is not active for this business.")
  }

  if (period) {
    assertGstRegistrationCoversPeriod(registration, period)
  }

  return registration
}

function assertGstRegistrationCoversPeriod(
  registration: GstRegistrationForReporting,
  period: string
) {
  const range = periodToRange(period)
  const effectiveFrom = registration.effectiveFrom || registration.registrationDate
  const effectiveTo = registration.effectiveTo

  if (effectiveFrom && effectiveFrom > range.endInclusive) {
    throw new HttpError(
      400,
      "Selected GST registration was not effective during this return period."
    )
  }

  if (effectiveTo && effectiveTo < range.start) {
    throw new HttpError(
      400,
      "Selected GST registration expired before this return period."
    )
  }
}

function assertRunMutable(run: GstReportingRunRecord) {
  if (!isRunRefreshable(run)) {
    throw new HttpError(
      409,
      "This GST reporting run is no longer editable. Reopen it to create a new version."
    )
  }
}

function assertRunCanRefresh(run: GstReportingRunRecord) {
  if (!isRunRefreshable(run)) {
    throw new HttpError(
      409,
      "Only draft or review GST reporting runs can be refreshed. Reopen to create a new version."
    )
  }
}

function assertRunCanAdvance(
  run: GstReportingRunRecord,
  allowedStatuses: string[]
) {
  if (!allowedStatuses.includes(run.status)) {
    throw new HttpError(
      409,
      `GST reporting run status ${run.status} cannot move through this action.`
    )
  }
}

function isRunRefreshable(run: GstReportingRunRecord) {
  return (
    ["DRAFT", "REVIEW"].includes(run.status) &&
    !run.lockedAt &&
    !run.submittedAt &&
    !run.filedAt
  )
}

async function persistExport(
  access: BusinessAccess,
  run: GstReportingRunRecord,
  reportType: "gstr1" | "gstr3b" | "hsn" | "documents" | "review",
  format: GstReportingExportFormat,
  exportData: { payload: unknown; tables: ReportTable[] }
): Promise<ExportResponse> {
  const fileBase = `${reportType}-${run.gstinSnapshot ?? run.gstRegistrationId}-${run.period}-v${run.version}`
  const response =
    format === "json" ? createJsonExport(`${fileBase}.json`, exportData.payload)
    : format === "xlsx" ? createXlsxExport(`${fileBase}.xlsx`, exportData.tables)
    : createCsvExport(`${fileBase}.csv`, exportData.tables)
  const hash = createHash("sha256").update(response.content).digest("hex")

  await db.insert(gstReportingExports).values({
    runId: run.id,
    businessId: run.businessId,
    gstRegistrationId: run.gstRegistrationId,
    gstinSnapshot: run.gstinSnapshot,
    period: run.period,
    reportType,
    exportFormat: format,
    fileName: response.fileName,
    contentType: response.contentType,
    contentHash: hash,
    exportedBy: access.userId,
    metadata: {
      encoding: response.encoding,
      gstin: run.gstinSnapshot,
      sourceDataHash: run.sourceDataHash,
      version: run.version,
    },
  })

  await insertAuditLog(access, run.id, "GST_REPORT_EXPORTED", null, {
    reportType,
    format,
    fileName: response.fileName,
  }, null)

  return response
}

function buildGstr1Export(dataset: Awaited<ReturnType<typeof getGstr1Dataset>>) {
  const tables: ReportTable[] = [
    {
      name: "GSTR-1 Sections",
      headers: ["Section", "Records", "Taxable", "CGST", "SGST", "IGST", "Cess", "Tax"],
      rows: dataset.sections.map((row) => [
        row.classification,
        row.count,
        row.taxableValue,
        row.cgst,
        row.sgst,
        row.igst,
        row.cess,
        row.totalTax,
      ]),
    },
    {
      name: "HSN/SAC",
      headers: ["HSN/SAC", "Description", "UQC", "Quantity", "Taxable", "CGST", "SGST", "IGST", "Cess", "Tax"],
      rows: dataset.hsn.map((row) => [
        row.hsnSac,
        row.description,
        row.uqc,
        row.quantity,
        row.taxableValue,
        row.cgst,
        row.sgst,
        row.igst,
        row.cess,
        row.totalTax,
      ]),
    },
    {
      name: "Document Summary",
      headers: ["Type", "First", "Last", "Count", "Taxable", "Tax"],
      rows: dataset.documents.map((row) => [
        row.sourceDocumentType,
        row.firstNumber,
        row.lastNumber,
        row.issuedCount,
        row.taxableValue,
        row.totalTax,
      ]),
    },
  ]

  return { payload: dataset, tables }
}

function buildGstr3bExport(dataset: Awaited<ReturnType<typeof getGstr3bDataset>>) {
  const tables: ReportTable[] = [
    {
      name: "GSTR-3B Outward",
      headers: ["Section", "Records", "Taxable", "CGST", "SGST", "IGST", "Cess", "Tax"],
      rows: dataset.outward.map((row) => [
        row.classification,
        row.count,
        row.taxableValue,
        row.cgst,
        row.sgst,
        row.igst,
        row.cess,
        row.totalTax,
      ]),
    },
    {
      name: "ITC",
      headers: ["Metric", "CGST", "SGST", "IGST", "Cess"],
      rows: [
        [
          "Available",
          dataset.itc?.availableCgst ?? "0.00",
          dataset.itc?.availableSgst ?? "0.00",
          dataset.itc?.availableIgst ?? "0.00",
          dataset.itc?.availableCess ?? "0.00",
        ],
        [
          "Claimed",
          dataset.itc?.claimedCgst ?? "0.00",
          dataset.itc?.claimedSgst ?? "0.00",
          dataset.itc?.claimedIgst ?? "0.00",
          dataset.itc?.claimedCess ?? "0.00",
        ],
        [
          "Deferred",
          dataset.itc?.deferredCgst ?? "0.00",
          dataset.itc?.deferredSgst ?? "0.00",
          dataset.itc?.deferredIgst ?? "0.00",
          dataset.itc?.deferredCess ?? "0.00",
        ],
        [
          "Ineligible",
          dataset.itc?.ineligibleCgst ?? "0.00",
          dataset.itc?.ineligibleSgst ?? "0.00",
          dataset.itc?.ineligibleIgst ?? "0.00",
          dataset.itc?.ineligibleCess ?? "0.00",
        ],
      ],
    },
    {
      name: "Net",
      headers: ["Output GST", "Claimed ITC", "Net GST"],
      rows: [[dataset.totals.outputTax, dataset.totals.claimedItc, dataset.totals.netGst]],
    },
  ]

  return { payload: dataset, tables }
}

function totalRows(rows: ReportingFactRow[]) {
  return {
    taxableValue: formatCents(rows.reduce((sum, row) => sum + toCents(row.taxableValue), 0)),
    cgst: formatCents(rows.reduce((sum, row) => sum + toCents(row.cgst), 0)),
    sgst: formatCents(rows.reduce((sum, row) => sum + toCents(row.sgst), 0)),
    igst: formatCents(rows.reduce((sum, row) => sum + toCents(row.igst), 0)),
    cess: formatCents(rows.reduce((sum, row) => sum + toCents(row.cess), 0)),
    totalTax: formatCents(rows.reduce((sum, row) => sum + toCents(row.totalTax), 0)),
  }
}

async function runReportingIdempotency<T>(
  access: BusinessAccess,
  operationScope: string,
  idempotencyKey: string,
  payload: unknown,
  handler: () => Promise<T>
) {
  const requestHash = buildGstReportingRequestHash(payload)
  const existing = await db.query.gstReportingIdempotencyKeys.findFirst({
    where: and(
      eq(gstReportingIdempotencyKeys.businessId, access.business.id),
      eq(gstReportingIdempotencyKeys.operationScope, operationScope),
      eq(gstReportingIdempotencyKeys.idempotencyKey, idempotencyKey)
    ),
  })

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new HttpError(409, "This idempotency key was already used with another payload.")
    }

    return existing.responseBody as T
  }

  await db.insert(gstReportingIdempotencyKeys).values({
    businessId: access.business.id,
    operationScope,
    idempotencyKey,
    requestHash,
    status: "processing",
  })

  const result = await handler()

  await db
    .update(gstReportingIdempotencyKeys)
    .set({
      responseBody: result as Record<string, unknown>,
      status: "completed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(gstReportingIdempotencyKeys.businessId, access.business.id),
        eq(gstReportingIdempotencyKeys.operationScope, operationScope),
        eq(gstReportingIdempotencyKeys.idempotencyKey, idempotencyKey)
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
    throw new HttpError(403, "You do not have permission to access GST reports.")
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
    entityType: "gst_reporting_run",
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
