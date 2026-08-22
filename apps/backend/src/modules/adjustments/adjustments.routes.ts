import { randomUUID } from "node:crypto"

import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
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
  businessMemberPermissions,
  invoiceSeries,
  journalEntries,
  journalEntryLines,
  moneyOperationIdempotencyKeys,
  paymentAllocations,
  purchaseBillLines,
  purchaseBills,
  receivablePayableAdjustmentEffects,
  receivablePayableEntries,
  salesInvoiceLines,
  salesInvoices,
  vouchers,
  type AdjustmentDocumentLineRecord,
  type AdjustmentDocumentRecord,
  type LedgerAccountRecord,
  type PurchaseBillLineRecord,
  type PurchaseBillRecord,
  type SalesInvoiceLineRecord,
  type SalesInvoiceRecord,
  type VoucherRecord,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import {
  createDraftDocumentNumber,
  ensureDefaultLedgerAccountMap,
  resolveTransactionContext,
} from "../accounting/accounting-domain.service.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"
import { postVoucher } from "../core/core.routes.js"
import { formatCents, normalizeMoney, toCents } from "../core/core.validation.js"
import {
  assertReturnQuantityWithinLimit,
  buildAdjustmentOperationRequestHash,
  documentTypeForAdjustment,
  draftPrefixForAdjustment,
  formatQuantity,
  resolveAdjustmentFinancialDirection,
  resolveAdjustmentIssuerContext,
  sourceDocumentTypeForAdjustment,
  type AdjustmentType,
  type SourceDocumentType,
} from "./adjustments.domain.js"
import {
  createAdjustmentSchema,
  idParamsSchema,
  listAdjustmentsQuerySchema,
  postAdjustmentSchema,
  returnableParamsSchema,
  reverseAdjustmentSchema,
  updateAdjustmentSchema,
  type CreateAdjustmentInput,
  type ListAdjustmentsQueryInput,
  type PostAdjustmentInput,
  type ReverseAdjustmentInput,
  type UpdateAdjustmentInput,
} from "./adjustments.schemas.js"

type BusinessAccess = Awaited<ReturnType<typeof requirePrimaryBusinessAccess>>
type AdjustmentDbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type AdjustmentAction = "view" | "create" | "edit" | "delete"

type SalesSource = {
  sourceDocumentType: "sales_invoice"
  document: SalesInvoiceRecord
  lines: SalesInvoiceLineRecord[]
  voucher: VoucherRecord
}

type PurchaseSource = {
  sourceDocumentType: "purchase_bill"
  document: PurchaseBillRecord
  lines: PurchaseBillLineRecord[]
  voucher: VoucherRecord
}

type AdjustmentSource = SalesSource | PurchaseSource
type SourceLine = SalesInvoiceLineRecord | PurchaseBillLineRecord

type AdjustmentLineDraft = {
  originalLineId: string
  originalLineType: "sales_invoice_line" | "purchase_bill_line"
  itemId: string | null
  descriptionSnapshot: string
  hsnSacSnapshot: string | null
  uqcSnapshot: string
  quantity: string
  unit: string
  rate: string
  discount: string
  taxableValue: string
  gstRateSnapshot: string
  cgstRate: string
  sgstRate: string
  igstRate: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  lineTotal: string
  inventoryEffect: "STOCK_IN" | "STOCK_OUT" | "NONE"
  inventoryWarehouseId: string | null
  reason: string | null
  sortOrder: number
  taxProfileSnapshot: Record<string, unknown>
}

type AdjustmentCalculation = {
  lines: AdjustmentLineDraft[]
  totals: {
    subtotal: string
    discountTotal: string
    taxableTotal: string
    cgstTotal: string
    sgstTotal: string
    igstTotal: string
    cessTotal: string
    roundOff: string
    grandTotal: string
  }
}

type CsvExportResponse = {
  fileName: string
  contentType: "text/csv"
  content: string
}

const routeConfig: Record<
  string,
  {
    type: AdjustmentType
    listKey: "salesReturns" | "purchaseReturns" | "creditNotes" | "debitNotes"
    detailKey: "salesReturn" | "purchaseReturn" | "creditNote" | "debitNote"
  }
> = {
  "/sales-returns": {
    type: "SALES_RETURN",
    listKey: "salesReturns",
    detailKey: "salesReturn",
  },
  "/purchase-returns": {
    type: "PURCHASE_RETURN",
    listKey: "purchaseReturns",
    detailKey: "purchaseReturn",
  },
  "/credit-notes": {
    type: "CREDIT_NOTE",
    listKey: "creditNotes",
    detailKey: "creditNote",
  },
  "/debit-notes": {
    type: "DEBIT_NOTE",
    listKey: "debitNotes",
    detailKey: "debitNote",
  },
}

export async function registerAdjustmentRoutes(app: FastifyInstance) {
  for (const [basePath, config] of Object.entries(routeConfig)) {
    app.get(basePath, async (request) => {
      const access = await requirePrimaryBusinessAccess(request)
      await assertCanUseAdjustment(access, config.type, "view")
      const query = listAdjustmentsQuerySchema.parse(request.query)

      return {
        [config.listKey]: await listAdjustments(access.business.id, config.type, query),
        pagination: await getAdjustmentPagination(access.business.id, config.type, query),
      }
    })

    app.post(basePath, async (request) => {
      const access = await requirePrimaryBusinessAccess(request)
      await assertCanUseAdjustment(access, config.type, "create")
      const body = createAdjustmentSchema.parse(request.body)
      const idempotencyKey = resolveOperationIdempotencyKey(
        request.headers["idempotency-key"],
        body.idempotencyKey
      )

      return runAdjustmentOperationIdempotency(
        access,
        `${config.type}:create`,
        idempotencyKey,
        body,
        async () => {
          const adjustment = await createAdjustment(access, config.type, body)

          return {
            [config.detailKey]: await getAdjustmentDetail(
              access.business.id,
              adjustment.id
            ),
          }
        }
      )
    })

    app.get(`${basePath}/export`, async (request) => {
      const access = await requirePrimaryBusinessAccess(request)
      await assertCanUseAdjustment(access, config.type, "view")
      const query = listAdjustmentsQuerySchema.parse(request.query)

      return exportAdjustments(access.business.id, config.type, query)
    })

    app.get(`${basePath}/:id`, async (request) => {
      const access = await requirePrimaryBusinessAccess(request)
      await assertCanUseAdjustment(access, config.type, "view")
      const { id } = idParamsSchema.parse(request.params)

      return {
        [config.detailKey]: await getAdjustmentDetail(access.business.id, id),
      }
    })

    app.patch(`${basePath}/:id`, async (request) => {
      const access = await requirePrimaryBusinessAccess(request)
      await assertCanUseAdjustment(access, config.type, "edit")
      const { id } = idParamsSchema.parse(request.params)
      const body = updateAdjustmentSchema.parse(request.body)
      const adjustment = await updateAdjustment(access, config.type, id, body)

      return {
        [config.detailKey]: await getAdjustmentDetail(
          access.business.id,
          adjustment.id
        ),
      }
    })

    app.delete(`${basePath}/:id`, async (request) => {
      const access = await requirePrimaryBusinessAccess(request)
      await assertCanUseAdjustment(access, config.type, "delete")
      const { id } = idParamsSchema.parse(request.params)
      await deleteDraftAdjustment(access, config.type, id)

      return { success: true }
    })

    app.post(`${basePath}/:id/post`, async (request) => {
      const access = await requirePrimaryBusinessAccess(request)
      await assertCanUseAdjustment(access, config.type, "create")
      const { id } = idParamsSchema.parse(request.params)
      const body = postAdjustmentSchema.parse(request.body)
      const idempotencyKey = resolveOperationIdempotencyKey(
        request.headers["idempotency-key"],
        body.idempotencyKey
      )

      return runAdjustmentOperationIdempotency(
        access,
        `${config.type}:${id}:post`,
        idempotencyKey,
        body,
        async () => {
          const adjustment = await postAdjustment(access, config.type, id, body)

          return {
            [config.detailKey]: await getAdjustmentDetail(
              access.business.id,
              adjustment.id
            ),
          }
        }
      )
    })

    app.post(`${basePath}/:id/reverse`, async (request) => {
      const access = await requirePrimaryBusinessAccess(request)
      await assertCanUseAdjustment(access, config.type, "delete")
      const { id } = idParamsSchema.parse(request.params)
      const body = reverseAdjustmentSchema.parse(request.body)
      const idempotencyKey = resolveOperationIdempotencyKey(
        request.headers["idempotency-key"],
        body.idempotencyKey
      )

      return runAdjustmentOperationIdempotency(
        access,
        `${config.type}:${id}:reverse`,
        idempotencyKey,
        body,
        async () => {
          const adjustment = await reverseAdjustment(access, config.type, id, body)

          return {
            [config.detailKey]: await getAdjustmentDetail(
              access.business.id,
              adjustment.id
            ),
          }
        }
      )
    })
  }

  app.get("/sales-invoices/:id/returnable", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseAdjustment(access, "SALES_RETURN", "view")
    const { id } = returnableParamsSchema.parse(request.params)

    return getReturnableSource(access.business.id, "sales_invoice", id)
  })

  app.get("/sales/invoices/:id/returnable", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseAdjustment(access, "SALES_RETURN", "view")
    const { id } = returnableParamsSchema.parse(request.params)

    return getReturnableSource(access.business.id, "sales_invoice", id)
  })

  app.get("/purchase-bills/:id/returnable", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseAdjustment(access, "PURCHASE_RETURN", "view")
    const { id } = returnableParamsSchema.parse(request.params)

    return getReturnableSource(access.business.id, "purchase_bill", id)
  })
}

async function listAdjustments(
  businessId: string,
  type: AdjustmentType,
  query: ListAdjustmentsQueryInput
) {
  const offset = (query.page - 1) * query.limit

  return db
    .select({
      id: adjustmentDocuments.id,
      adjustmentNumber: adjustmentDocuments.adjustmentNumber,
      adjustmentType: adjustmentDocuments.adjustmentType,
      adjustmentDate: adjustmentDocuments.adjustmentDate,
      sourceDocumentType: adjustmentDocuments.sourceDocumentType,
      sourceDocumentId: adjustmentDocuments.sourceDocumentId,
      sourceSnapshot: adjustmentDocuments.sourceSnapshot,
      status: adjustmentDocuments.status,
      partyId: adjustmentDocuments.partyId,
      partySnapshot: adjustmentDocuments.partySnapshot,
      taxableTotal: adjustmentDocuments.taxableTotal,
      cgstTotal: adjustmentDocuments.cgstTotal,
      sgstTotal: adjustmentDocuments.sgstTotal,
      igstTotal: adjustmentDocuments.igstTotal,
      grandTotal: adjustmentDocuments.grandTotal,
      settlementEffectAmount: adjustmentDocuments.settlementEffectAmount,
      excessCreditAmount: adjustmentDocuments.excessCreditAmount,
      reason: adjustmentDocuments.reason,
      postedAt: adjustmentDocuments.postedAt,
      reversedAt: adjustmentDocuments.reversedAt,
      createdAt: adjustmentDocuments.createdAt,
    })
    .from(adjustmentDocuments)
    .where(and(...buildAdjustmentWhere(businessId, type, query)))
    .orderBy(desc(adjustmentDocuments.createdAt))
    .limit(query.limit)
    .offset(offset)
}

async function getAdjustmentPagination(
  businessId: string,
  type: AdjustmentType,
  query: ListAdjustmentsQueryInput
) {
  const [{ count = 0 } = {}] = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(adjustmentDocuments)
    .where(and(...buildAdjustmentWhere(businessId, type, query)))

  return {
    page: query.page,
    limit: query.limit,
    total: count,
    hasMore: query.page * query.limit < count,
  }
}

function buildAdjustmentWhere(
  businessId: string,
  type: AdjustmentType,
  query: ListAdjustmentsQueryInput
) {
  const conditions: SQL[] = [
    eq(adjustmentDocuments.businessId, businessId),
    eq(adjustmentDocuments.adjustmentType, type),
  ]

  if (query.status) {
    conditions.push(eq(adjustmentDocuments.status, query.status))
  }

  if (query.fromDate) {
    conditions.push(gte(adjustmentDocuments.adjustmentDate, query.fromDate))
  }

  if (query.toDate) {
    conditions.push(lte(adjustmentDocuments.adjustmentDate, query.toDate))
  }

  if (query.search) {
    const term = `%${escapeLikeTerm(query.search)}%`
    conditions.push(
      or(
        ilike(adjustmentDocuments.adjustmentNumber, term),
        ilike(adjustmentDocuments.reason, term)
      ) as SQL
    )
  }

  return conditions
}

async function getAdjustmentDetail(businessId: string, id: string) {
  const adjustment = await db.query.adjustmentDocuments.findFirst({
    where: and(
      eq(adjustmentDocuments.businessId, businessId),
      eq(adjustmentDocuments.id, id)
    ),
  })

  if (!adjustment) {
    throw new HttpError(404, "Adjustment document not found.")
  }

  const lines = await db
    .select()
    .from(adjustmentDocumentLines)
    .where(eq(adjustmentDocumentLines.adjustmentDocumentId, id))
    .orderBy(adjustmentDocumentLines.sortOrder)

  const sourceVoucher = await db.query.vouchers.findFirst({
    where: and(
      eq(vouchers.businessId, businessId),
      eq(vouchers.id, adjustment.originalVoucherId)
    ),
  })

  const voucher =
    adjustment.voucherId ?
      await db.query.vouchers.findFirst({
        where: and(
          eq(vouchers.businessId, businessId),
          eq(vouchers.id, adjustment.voucherId)
        ),
      })
      : null

  const journalEntryRows =
    adjustment.voucherId ?
      await db
        .select()
        .from(journalEntries)
        .where(eq(journalEntries.voucherId, adjustment.voucherId))
      : []
  const journalEntryIds = journalEntryRows.map((entry) => entry.id)
  const journalLines =
    journalEntryIds.length > 0 ?
      await db
        .select()
        .from(journalEntryLines)
        .where(inArray(journalEntryLines.journalEntryId, journalEntryIds))
      : []

  const audit = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.businessId, businessId),
        eq(auditLogs.entityType, "adjustment_document"),
        eq(auditLogs.entityId, id)
      )
    )
    .orderBy(desc(auditLogs.createdAt))
  const settlementEffects = await db
    .select({
      id: receivablePayableAdjustmentEffects.id,
      adjustmentDocumentId: receivablePayableAdjustmentEffects.adjustmentDocumentId,
      adjustmentVoucherId: receivablePayableAdjustmentEffects.adjustmentVoucherId,
      sourceVoucherId: receivablePayableAdjustmentEffects.sourceVoucherId,
      receivablePayableEntryId:
        receivablePayableAdjustmentEffects.receivablePayableEntryId,
      effectKind: receivablePayableAdjustmentEffects.effectKind,
      amount: receivablePayableAdjustmentEffects.amount,
      status: receivablePayableAdjustmentEffects.status,
      reversedAt: receivablePayableAdjustmentEffects.reversedAt,
      reversalReason: receivablePayableAdjustmentEffects.reversalReason,
      createdAt: receivablePayableAdjustmentEffects.createdAt,
      entryOriginalAmount: receivablePayableEntries.originalAmount,
      entryAdjustmentAmount: receivablePayableEntries.adjustmentAmount,
      entryEffectiveAmount: receivablePayableEntries.effectiveAmount,
      entrySettledAmount: receivablePayableEntries.settledAmount,
      entryOutstandingAmount: receivablePayableEntries.outstandingAmount,
      entryExcessSettledAmount: receivablePayableEntries.excessSettledAmount,
    })
    .from(receivablePayableAdjustmentEffects)
    .innerJoin(
      receivablePayableEntries,
      eq(
        receivablePayableEntries.id,
        receivablePayableAdjustmentEffects.receivablePayableEntryId
      )
    )
    .where(
      and(
        eq(receivablePayableAdjustmentEffects.businessId, businessId),
        eq(receivablePayableAdjustmentEffects.adjustmentDocumentId, id)
      )
    )
    .orderBy(desc(receivablePayableAdjustmentEffects.createdAt))

  return {
    ...adjustment,
    lines,
    sourceVoucher,
    voucher,
    settlementEffects,
    journalEntries: journalEntryRows.map((entry) => ({
      ...entry,
      lines: journalLines.filter((line) => line.journalEntryId === entry.id),
    })),
    audit,
  }
}

async function createAdjustment(
  access: BusinessAccess,
  type: AdjustmentType,
  body: CreateAdjustmentInput
) {
  const source = await getSourceDocument(
    access.business.id,
    sourceDocumentTypeForAdjustment(type),
    body.sourceDocumentId
  )
  const issuerContext = resolveAdjustmentIssuerContext({
    type,
    sourceDocumentType: source.sourceDocumentType,
    issuerType: body.sourcePartyRole ? body.issuerType : undefined,
    documentDirection: body.sourcePartyRole ? body.documentDirection : undefined,
    sourcePartyRole: body.sourcePartyRole,
  })

  if (!issuerContext.valid) {
    throw new HttpError(400, issuerContext.reason ?? "Invalid adjustment issuer context.")
  }

  const calculation = await calculateAdjustment(access.business.id, type, source, body)
  const adjustmentNumber = createDraftDocumentNumber(draftPrefixForAdjustment(type))
  const partyId = getSourcePartyId(source)

  return db.transaction(async (tx) => {
    const [adjustment] = await tx
      .insert(adjustmentDocuments)
      .values({
        businessId: access.business.id,
        adjustmentNumber,
        adjustmentType: type,
        originalVoucherId: source.voucher.id,
        sourceDocumentId: body.sourceDocumentId,
        sourceDocumentType: source.sourceDocumentType,
        partyId,
        branchId: getSourceBranchId(source),
        gstRegistrationId: getSourceGstRegistrationId(source),
        adjustmentDate: body.adjustmentDate,
        reasonCode: body.reasonCode ?? null,
        reason: body.reason ?? null,
        issuerType: issuerContext.context.issuerType,
        documentDirection: issuerContext.context.documentDirection,
        sourcePartyRole: issuerContext.context.sourcePartyRole,
        adjustmentContext: body.adjustmentContext,
        ...calculation.totals,
        partySnapshot: getSourcePartySnapshot(source),
        sourceSnapshot: buildSourceSnapshot(source),
        taxSnapshot: buildTaxSnapshot(source, calculation),
        createdBy: access.userId,
      })
      .returning()

    if (!adjustment) {
      throw new HttpError(500, "Unable to create adjustment document.")
    }

    await tx.insert(adjustmentDocumentLines).values(
      calculation.lines.map((line) => ({
        businessId: access.business.id,
        adjustmentDocumentId: adjustment.id,
        ...line,
      }))
    )

    await insertAuditLog(
      access,
      adjustment.id,
      `${type}_CREATED`,
      null,
      adjustment,
      body.reason ?? null
    )

    return adjustment
  })
}

async function updateAdjustment(
  access: BusinessAccess,
  type: AdjustmentType,
  id: string,
  body: UpdateAdjustmentInput
) {
  const existing = await requireAdjustment(access.business.id, type, id)

  if (existing.status !== "draft") {
    throw new HttpError(409, "Only draft adjustment documents can be edited.")
  }

  const source = await getSourceDocument(
    access.business.id,
    existing.sourceDocumentType as SourceDocumentType,
    existing.sourceDocumentId ?? ""
  )
  const createLikeBody: CreateAdjustmentInput = {
    sourceDocumentId: existing.sourceDocumentId ?? "",
    adjustmentDate: body.adjustmentDate ?? existing.adjustmentDate,
    reasonCode: body.reasonCode ?? existing.reasonCode ?? undefined,
    reason: body.reason ?? existing.reason ?? undefined,
    adjustmentContext:
      body.adjustmentContext ??
      (existing.adjustmentContext as CreateAdjustmentInput["adjustmentContext"]),
    issuerType:
      body.issuerType ?? (existing.issuerType as CreateAdjustmentInput["issuerType"]),
    documentDirection:
      body.documentDirection ??
      (existing.documentDirection as CreateAdjustmentInput["documentDirection"]),
    sourcePartyRole:
      body.sourcePartyRole ??
      (existing.sourcePartyRole as CreateAdjustmentInput["sourcePartyRole"]),
    lines:
      body.lines ??
      (await getExistingDraftInputLines(access.business.id, existing.id)),
  }
  const hasExplicitIssuerContext =
    body.issuerType !== undefined ||
    body.documentDirection !== undefined ||
    body.sourcePartyRole !== undefined
  const issuerContext = resolveAdjustmentIssuerContext({
    type,
    sourceDocumentType: source.sourceDocumentType,
    issuerType: hasExplicitIssuerContext ? createLikeBody.issuerType : undefined,
    documentDirection:
      hasExplicitIssuerContext ? createLikeBody.documentDirection : undefined,
    sourcePartyRole: hasExplicitIssuerContext ? createLikeBody.sourcePartyRole : undefined,
  })

  if (!issuerContext.valid) {
    throw new HttpError(400, issuerContext.reason ?? "Invalid adjustment issuer context.")
  }

  const calculation = await calculateAdjustment(
    access.business.id,
    type,
    source,
    createLikeBody
  )

  return db.transaction(async (tx) => {
    await tx
      .delete(adjustmentDocumentLines)
      .where(eq(adjustmentDocumentLines.adjustmentDocumentId, existing.id))

    await tx.insert(adjustmentDocumentLines).values(
      calculation.lines.map((line) => ({
        businessId: access.business.id,
        adjustmentDocumentId: existing.id,
        ...line,
      }))
    )

    const [updated] = await tx
      .update(adjustmentDocuments)
      .set({
        adjustmentDate: createLikeBody.adjustmentDate,
        reasonCode: createLikeBody.reasonCode ?? null,
        reason: createLikeBody.reason ?? null,
        issuerType: issuerContext.context.issuerType,
        documentDirection: issuerContext.context.documentDirection,
        sourcePartyRole: issuerContext.context.sourcePartyRole,
        adjustmentContext: createLikeBody.adjustmentContext,
        ...calculation.totals,
        taxSnapshot: buildTaxSnapshot(source, calculation),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(adjustmentDocuments.businessId, access.business.id),
          eq(adjustmentDocuments.id, existing.id)
        )
      )
      .returning()

    if (!updated) {
      throw new HttpError(500, "Unable to update adjustment document.")
    }

    await insertAuditLog(
      access,
      updated.id,
      `${type}_UPDATED`,
      existing,
      updated,
      createLikeBody.reason ?? null
    )

    return updated
  })
}

async function deleteDraftAdjustment(
  access: BusinessAccess,
  type: AdjustmentType,
  id: string
) {
  const existing = await requireAdjustment(access.business.id, type, id)

  if (existing.status !== "draft") {
    throw new HttpError(409, "Only draft adjustment documents can be deleted.")
  }

  await db
    .delete(adjustmentDocuments)
    .where(
      and(
        eq(adjustmentDocuments.businessId, access.business.id),
        eq(adjustmentDocuments.id, id)
      )
    )
}

async function postAdjustment(
  access: BusinessAccess,
  type: AdjustmentType,
  id: string,
  body: PostAdjustmentInput
) {
  const adjustment = await requireAdjustment(access.business.id, type, id)

  if (adjustment.status !== "draft") {
    throw new HttpError(409, "Only draft adjustment documents can be posted.")
  }

  const source = await getSourceDocument(
    access.business.id,
    adjustment.sourceDocumentType as SourceDocumentType,
    adjustment.sourceDocumentId ?? ""
  )
  await assertAdjustmentStillReturnable(access.business.id, type, id, source)

  const lines = await getAdjustmentLines(access.business.id, id)
  const context = await resolveTransactionContext(access, {
    transactionDate: adjustment.adjustmentDate,
    gstRegistrationId: adjustment.gstRegistrationId,
    branchId: adjustment.branchId,
    warehouseId: getPrimaryWarehouseId(lines),
    placeOfSupplyStateCode: getSourcePlaceOfSupply(source),
  })
  await ensureAdjustmentSeries(
    access.business.id,
    context.financialYearId,
    context.gstRegistration.id,
    documentTypeForAdjustment(type),
    draftPrefixForAdjustment(type)
  )

  const accountMap = await ensureDefaultLedgerAccountMap(access.business.id)
  let postedAdjustment: AdjustmentDocumentRecord | null = null
  await postVoucher(
    access,
    {
      idempotencyKey: body.idempotencyKey ?? randomUUID(),
      voucherType: type,
      documentType: documentTypeForAdjustment(type),
      voucherDate: adjustment.adjustmentDate,
      financialYearId: context.financialYearId,
      gstRegistrationId: context.gstRegistration.id,
      branchId: context.branch?.id ?? null,
      warehouseId: context.warehouseId,
      referenceVoucherId: adjustment.originalVoucherId,
      seriesCode: "DEFAULT",
      notes: adjustment.reason ?? undefined,
      snapshots: {
        seller: {
          businessId: access.business.id,
          legalName: access.business.legalName,
          tradeName: access.business.tradeName,
          gstin: context.gstRegistration.gstin,
        },
        branch: context.branch ?? undefined,
        party: adjustment.partySnapshot as Record<string, unknown> | undefined,
        tax: adjustment.taxSnapshot as Record<string, unknown> | undefined,
      },
      journal: {
        description: `${type} - ${getPartyName(adjustment)}`,
        lines: buildJournalLines(type, adjustment, accountMap, context),
      },
      inventoryEntries: buildInventoryEntries(type, lines, adjustment.adjustmentDate),
      gstEntries: buildGstEntries(adjustment, lines, context.branch?.id ?? null),
      receivablePayableEntries: buildReceivablePayableEntries(type, adjustment),
      paymentAllocations: [],
    },
    {
      beforePost: async (tx) => {
        await assertAdjustmentStillReturnableInTransaction(
          tx,
          access.business.id,
          type,
          adjustment.id,
          source
        )
      },
      afterPost: async ({ tx, voucher, postedAt }) => {
        const settlement = await applyAdjustmentSettlementEffects(
          tx,
          access,
          type,
          adjustment,
          voucher.id
        )
        const [updated] = await tx
          .update(adjustmentDocuments)
          .set({
            voucherId: voucher.id,
            adjustmentNumber: voucher.voucherNumber,
            status: "posted",
            postedBy: access.userId,
            postedAt,
            settlementEffectAmount: settlement.appliedAmount,
            excessCreditAmount: settlement.excessAmount,
            updatedAt: postedAt,
          })
          .where(
            and(
              eq(adjustmentDocuments.businessId, access.business.id),
              eq(adjustmentDocuments.id, adjustment.id)
            )
          )
          .returning()

        if (!updated) {
          throw new HttpError(500, "Unable to mark adjustment as posted.")
        }

        await tx.insert(auditLogs).values({
          businessId: access.business.id,
          entityType: "adjustment_document",
          entityId: updated.id,
          action: `${type}_POSTED`,
          userId: access.userId,
          before: adjustment,
          after: updated,
          reason: adjustment.reason,
        })
        postedAdjustment = updated
      },
    }
  )

  return postedAdjustment ?? requireAdjustment(access.business.id, type, id)
}

async function reverseAdjustment(
  access: BusinessAccess,
  type: AdjustmentType,
  id: string,
  body: ReverseAdjustmentInput
) {
  const adjustment = await requireAdjustment(access.business.id, type, id)

  if (adjustment.status !== "posted" || !adjustment.voucherId) {
    throw new HttpError(409, "Only posted adjustment documents can be reversed.")
  }

  const adjustmentVoucherId = adjustment.voucherId
  await createReversalVoucher(access, adjustmentVoucherId, body.reason)

  return db.transaction(async (tx) => {
    const reversedAt = new Date()
    const reversedEffects = await tx
      .update(receivablePayableAdjustmentEffects)
      .set({
        status: "reversed",
        reversedBy: access.userId,
        reversedAt,
        reversalReason: body.reason,
        updatedAt: reversedAt,
      })
      .where(
        and(
          eq(receivablePayableAdjustmentEffects.businessId, access.business.id),
          eq(receivablePayableAdjustmentEffects.adjustmentDocumentId, id),
          eq(receivablePayableAdjustmentEffects.status, "active")
        )
      )
      .returning({
        entryId: receivablePayableAdjustmentEffects.receivablePayableEntryId,
      })

    await refreshReceivablePayableSettlementsInTransaction(
      tx,
      access.business.id,
      reversedEffects.map((effect) => effect.entryId)
    )

    const [updated] = await tx
      .update(adjustmentDocuments)
      .set({
        status: "reversed",
        reversedBy: access.userId,
        reversedAt,
        reversalReason: body.reason,
        updatedAt: reversedAt,
      })
      .where(
        and(
          eq(adjustmentDocuments.businessId, access.business.id),
          eq(adjustmentDocuments.id, id)
        )
      )
      .returning()

    if (!updated) {
      throw new HttpError(500, "Unable to reverse adjustment document.")
    }

    await tx
      .update(vouchers)
      .set({
        status: "reversed",
        cancelledAt: reversedAt,
        updatedAt: reversedAt,
      })
      .where(
        and(
          eq(vouchers.businessId, access.business.id),
          eq(vouchers.id, adjustmentVoucherId)
        )
      )

    await tx.insert(auditLogs).values({
      businessId: access.business.id,
      entityType: "adjustment_document",
      entityId: updated.id,
      action: `${type}_REVERSED`,
      userId: access.userId,
      before: adjustment,
      after: updated,
      reason: body.reason,
    })

    return updated
  })
}

async function getReturnableSource(
  businessId: string,
  sourceDocumentType: SourceDocumentType,
  id: string
) {
  const source = await getSourceDocument(businessId, sourceDocumentType, id)
  const returnedByLineId = await getPostedReturnedQuantities(
    businessId,
    source.sourceDocumentType,
    source.lines.map((line) => line.id)
  )

  return {
    sourceDocument: buildSourceSnapshot(source),
    lines: source.lines.map((line) => {
      const returnedQuantity = returnedByLineId.get(line.id) ?? "0"
      const remainingMilli =
        Number(line.quantity) * 1000 - Number(returnedQuantity) * 1000

      return {
        id: line.id,
        itemId: line.itemId,
        itemName: line.itemNameSnapshot,
        hsnSacCode: line.hsnSacCode,
        originalQuantity: line.quantity,
        previouslyReturnedQuantity: returnedQuantity,
        remainingQuantity: formatQuantity(Math.max(Math.round(remainingMilli), 0)),
        unit: line.unit,
        rate: line.rate,
        taxableValue: line.taxableValue,
        gstRate: line.gstRate,
        cgstAmount: line.cgstAmount,
        sgstAmount: line.sgstAmount,
        igstAmount: line.igstAmount,
        cessAmount: line.cessAmount,
        lineTotal: line.lineTotal,
      }
    }),
  }
}

async function exportAdjustments(
  businessId: string,
  type: AdjustmentType,
  query: ListAdjustmentsQueryInput
): Promise<CsvExportResponse> {
  const rows = await listAdjustments(businessId, type, {
    ...query,
    page: 1,
    limit: 1000,
  })
  const header = [
    "Number",
    "Type",
    "Date",
    "Status",
    "Source",
    "Taxable",
    "CGST",
    "SGST",
    "IGST",
    "Total",
    "Reason",
  ]
  const content = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.adjustmentNumber,
        row.adjustmentType,
        row.adjustmentDate,
        row.status,
        row.sourceDocumentType,
        row.taxableTotal,
        row.cgstTotal,
        row.sgstTotal,
        row.igstTotal,
        row.grandTotal,
        row.reason ?? "",
      ]
        .map(csvCell)
        .join(",")
    ),
  ].join("\n")

  return {
    fileName: `${documentTypeForAdjustment(type)}-${new Date().toISOString().slice(0, 10)}.csv`,
    contentType: "text/csv",
    content,
  }
}

async function getSourceDocument(
  businessId: string,
  sourceDocumentType: SourceDocumentType,
  id: string
): Promise<AdjustmentSource> {
  if (sourceDocumentType === "sales_invoice") {
    const document = await db.query.salesInvoices.findFirst({
      where: and(eq(salesInvoices.businessId, businessId), eq(salesInvoices.id, id)),
    })

    if (!document) {
      throw new HttpError(404, "Sales invoice not found.")
    }

    if (document.status !== "posted" || !document.voucherId) {
      throw new HttpError(409, "Original sales invoice must be posted.")
    }

    const voucher = await requireVoucher(businessId, document.voucherId)
    const lines = await db
      .select()
      .from(salesInvoiceLines)
      .where(eq(salesInvoiceLines.salesInvoiceId, id))
      .orderBy(salesInvoiceLines.sortOrder)

    return { sourceDocumentType, document, lines, voucher }
  }

  const document = await db.query.purchaseBills.findFirst({
    where: and(eq(purchaseBills.businessId, businessId), eq(purchaseBills.id, id)),
  })

  if (!document) {
    throw new HttpError(404, "Purchase bill not found.")
  }

  if (document.status !== "posted" || !document.voucherId) {
    throw new HttpError(409, "Original purchase bill must be posted.")
  }

  const voucher = await requireVoucher(businessId, document.voucherId)
  const lines = await db
    .select()
    .from(purchaseBillLines)
    .where(eq(purchaseBillLines.purchaseBillId, id))
    .orderBy(purchaseBillLines.sortOrder)

  return { sourceDocumentType, document, lines, voucher }
}

async function calculateAdjustment(
  businessId: string,
  type: AdjustmentType,
  source: AdjustmentSource,
  body: CreateAdjustmentInput
): Promise<AdjustmentCalculation> {
  const sourceLinesById = new Map(source.lines.map((line) => [line.id, line]))
  const returnedByLineId =
    type === "SALES_RETURN" || type === "PURCHASE_RETURN" ?
      await getPostedReturnedQuantities(
        businessId,
        source.sourceDocumentType,
        body.lines.map((line) => line.originalLineId).filter((id): id is string => Boolean(id))
      )
      : new Map<string, string>()
  const lines: AdjustmentLineDraft[] = []

  for (const [index, inputLine] of body.lines.entries()) {
    if (!inputLine.originalLineId) {
      throw new HttpError(400, "Source line is required.")
    }

    const sourceLine = sourceLinesById.get(inputLine.originalLineId)

    if (!sourceLine) {
      throw new HttpError(404, "Source line not found for this document.")
    }

    if (type === "SALES_RETURN" || type === "PURCHASE_RETURN") {
      const quantityValidation = assertReturnQuantityWithinLimit({
        requestedQuantity: inputLine.quantity ?? "0",
        originalQuantity: sourceLine.quantity,
        previouslyReturnedQuantity: returnedByLineId.get(sourceLine.id) ?? "0",
      })

      if (!quantityValidation.valid) {
        throw new HttpError(409, "Return quantity exceeds the remaining quantity.")
      }
    }

    lines.push(
      calculateLineDraft(
        type,
        source.sourceDocumentType,
        sourceLine,
        inputLine,
        index,
        getSourceWarehouseId(source)
      )
    )
  }

  return { lines, totals: summarizeLines(lines) }
}

function calculateLineDraft(
  type: AdjustmentType,
  sourceDocumentType: SourceDocumentType,
  sourceLine: SourceLine,
  inputLine: CreateAdjustmentInput["lines"][number],
  index: number,
  fallbackWarehouseId: string | null
): AdjustmentLineDraft {
  const sourceTaxableCents = toCents(sourceLine.taxableValue)
  const sourceQuantity = Number(sourceLine.quantity)
  const inputQuantity = Number(inputLine.quantity ?? "0")
  const explicitTaxable =
    inputLine.taxableValue ? toCents(inputLine.taxableValue) : null
  const ratio =
    explicitTaxable !== null && sourceTaxableCents > 0 ? explicitTaxable / sourceTaxableCents
      : sourceQuantity > 0 ? inputQuantity / sourceQuantity
        : 0
  const taxableCents = explicitTaxable ?? Math.round(sourceTaxableCents * ratio)
  const cgstCents = Math.round(toCents(sourceLine.cgstAmount) * ratio)
  const sgstCents = Math.round(toCents(sourceLine.sgstAmount) * ratio)
  const igstCents = Math.round(toCents(sourceLine.igstAmount) * ratio)
  const cessCents = Math.round(toCents(sourceLine.cessAmount) * ratio)
  const lineTotalCents = taxableCents + cgstCents + sgstCents + igstCents + cessCents
  const defaultInventoryEffect =
    type === "SALES_RETURN" ? "STOCK_IN"
      : type === "PURCHASE_RETURN" ? "STOCK_OUT"
        : "NONE"

  return {
    originalLineId: sourceLine.id,
    originalLineType:
      sourceDocumentType === "sales_invoice" ?
        "sales_invoice_line"
        : "purchase_bill_line",
    itemId: sourceLine.itemId,
    descriptionSnapshot: sourceLine.itemNameSnapshot,
    hsnSacSnapshot: sourceLine.hsnSacCode,
    uqcSnapshot: sourceLine.unit,
    quantity: inputLine.quantity ?? "0",
    unit: sourceLine.unit,
    rate: normalizeMoney(inputLine.rate ?? sourceLine.rate),
    discount: formatCents(Math.round(toCents(sourceLine.discountAmount) * ratio)),
    taxableValue: formatCents(taxableCents),
    gstRateSnapshot: normalizeMoney(sourceLine.gstRate),
    cgstRate: normalizeMoney(sourceLine.cgstRate),
    sgstRate: normalizeMoney(sourceLine.sgstRate),
    igstRate: normalizeMoney(sourceLine.igstRate),
    cgstAmount: formatCents(cgstCents),
    sgstAmount: formatCents(sgstCents),
    igstAmount: formatCents(igstCents),
    cessAmount: formatCents(cessCents),
    lineTotal: formatCents(lineTotalCents),
    inventoryEffect: inputLine.inventoryEffect ?? defaultInventoryEffect,
    inventoryWarehouseId: inputLine.inventoryWarehouseId ?? fallbackWarehouseId,
    reason: inputLine.reason ?? null,
    sortOrder: index,
    taxProfileSnapshot: {
      taxability: sourceLine.taxability,
      classification: sourceLine.classification,
      supplyLocationTreatment: sourceLine.supplyLocationTreatment,
      taxRuleId: sourceLine.taxRuleId,
      taxRuleVersion: sourceLine.taxRuleVersion,
      reverseCharge: sourceLine.reverseCharge,
    },
  }
}

function summarizeLines(lines: AdjustmentLineDraft[]) {
  const totals = lines.reduce(
    (total, line) => ({
      subtotal: total.subtotal + toCents(line.taxableValue) + toCents(line.discount),
      discountTotal: total.discountTotal + toCents(line.discount),
      taxableTotal: total.taxableTotal + toCents(line.taxableValue),
      cgstTotal: total.cgstTotal + toCents(line.cgstAmount),
      sgstTotal: total.sgstTotal + toCents(line.sgstAmount),
      igstTotal: total.igstTotal + toCents(line.igstAmount),
      cessTotal: total.cessTotal + toCents(line.cessAmount),
      roundOff: total.roundOff,
      grandTotal: total.grandTotal + toCents(line.lineTotal),
    }),
    {
      subtotal: 0,
      discountTotal: 0,
      taxableTotal: 0,
      cgstTotal: 0,
      sgstTotal: 0,
      igstTotal: 0,
      cessTotal: 0,
      roundOff: 0,
      grandTotal: 0,
    }
  )

  return {
    subtotal: formatCents(totals.subtotal),
    discountTotal: formatCents(totals.discountTotal),
    taxableTotal: formatCents(totals.taxableTotal),
    cgstTotal: formatCents(totals.cgstTotal),
    sgstTotal: formatCents(totals.sgstTotal),
    igstTotal: formatCents(totals.igstTotal),
    cessTotal: formatCents(totals.cessTotal),
    roundOff: formatCents(totals.roundOff),
    grandTotal: formatCents(totals.grandTotal),
  }
}

async function getPostedReturnedQuantities(
  businessId: string,
  sourceDocumentType: SourceDocumentType,
  lineIds: string[]
) {
  const uniqueLineIds = uniqueStrings(lineIds)

  if (uniqueLineIds.length === 0) {
    return new Map<string, string>()
  }

  const originalLineType =
    sourceDocumentType === "sales_invoice" ?
      "sales_invoice_line"
      : "purchase_bill_line"
  const returnType =
    sourceDocumentType === "sales_invoice" ?
      "SALES_RETURN"
      : "PURCHASE_RETURN"
  const rows = await db
    .select({
      originalLineId: adjustmentDocumentLines.originalLineId,
      returnedQuantity: drizzleSql<string>`coalesce(sum(${adjustmentDocumentLines.quantity}), 0)::text`,
    })
    .from(adjustmentDocumentLines)
    .innerJoin(
      adjustmentDocuments,
      eq(adjustmentDocuments.id, adjustmentDocumentLines.adjustmentDocumentId)
    )
    .where(
      and(
        eq(adjustmentDocumentLines.businessId, businessId),
        eq(adjustmentDocumentLines.originalLineType, originalLineType),
        eq(adjustmentDocuments.adjustmentType, returnType),
        eq(adjustmentDocuments.status, "posted"),
        inArray(adjustmentDocumentLines.originalLineId, uniqueLineIds)
      )
    )
    .groupBy(adjustmentDocumentLines.originalLineId)

  return new Map(
    rows
      .filter((row): row is { originalLineId: string; returnedQuantity: string } =>
        Boolean(row.originalLineId)
      )
      .map((row) => [row.originalLineId, row.returnedQuantity])
  )
}

async function assertAdjustmentStillReturnable(
  businessId: string,
  type: AdjustmentType,
  adjustmentId: string,
  source: AdjustmentSource
) {
  if (type !== "SALES_RETURN" && type !== "PURCHASE_RETURN") {
    return
  }

  const lines = await getAdjustmentLines(businessId, adjustmentId)
  const returnedByLineId = await getPostedReturnedQuantities(
    businessId,
    source.sourceDocumentType,
    lines.map((line) => line.originalLineId).filter((id): id is string => Boolean(id))
  )
  const sourceLinesById = new Map(source.lines.map((line) => [line.id, line]))

  for (const line of lines) {
    if (!line.originalLineId) {
      continue
    }

    const sourceLine = sourceLinesById.get(line.originalLineId)

    if (!sourceLine) {
      throw new HttpError(404, "Source line no longer exists.")
    }

    const validation = assertReturnQuantityWithinLimit({
      requestedQuantity: line.quantity,
      originalQuantity: sourceLine.quantity,
      previouslyReturnedQuantity: returnedByLineId.get(line.originalLineId) ?? "0",
    })

    if (!validation.valid) {
      throw new HttpError(409, "Return quantity exceeds the remaining quantity.")
    }
  }
}

async function assertAdjustmentStillReturnableInTransaction(
  tx: AdjustmentDbTransaction,
  businessId: string,
  type: AdjustmentType,
  adjustmentId: string,
  source: AdjustmentSource
) {
  if (type !== "SALES_RETURN" && type !== "PURCHASE_RETURN") {
    return
  }

  await lockSourceLinesForReturn(tx, businessId, source)

  const lines = await tx
    .select()
    .from(adjustmentDocumentLines)
    .where(
      and(
        eq(adjustmentDocumentLines.businessId, businessId),
        eq(adjustmentDocumentLines.adjustmentDocumentId, adjustmentId)
      )
    )
  const returnedByLineId = await getPostedReturnedQuantitiesInTransaction(
    tx,
    businessId,
    source.sourceDocumentType,
    lines.map((line) => line.originalLineId).filter((id): id is string => Boolean(id))
  )
  const sourceLinesById = new Map(source.lines.map((line) => [line.id, line]))

  for (const line of lines) {
    if (!line.originalLineId) {
      continue
    }

    const sourceLine = sourceLinesById.get(line.originalLineId)

    if (!sourceLine) {
      throw new HttpError(404, "Source line no longer exists.")
    }

    const validation = assertReturnQuantityWithinLimit({
      requestedQuantity: line.quantity,
      originalQuantity: sourceLine.quantity,
      previouslyReturnedQuantity: returnedByLineId.get(line.originalLineId) ?? "0",
    })

    if (!validation.valid) {
      throw new HttpError(409, "Return quantity exceeds the remaining quantity.")
    }
  }
}

async function lockSourceLinesForReturn(
  tx: AdjustmentDbTransaction,
  businessId: string,
  source: AdjustmentSource
) {
  if (source.sourceDocumentType === "sales_invoice") {
    await tx.execute(
      drizzleSql`select id from public.sales_invoice_lines
        where business_id = ${businessId}
          and sales_invoice_id = ${source.document.id}
        for update`
    )
    return
  }

  await tx.execute(
    drizzleSql`select id from public.purchase_bill_lines
      where business_id = ${businessId}
        and purchase_bill_id = ${source.document.id}
      for update`
  )
}

async function getPostedReturnedQuantitiesInTransaction(
  tx: AdjustmentDbTransaction,
  businessId: string,
  sourceDocumentType: SourceDocumentType,
  lineIds: string[]
) {
  const uniqueLineIds = uniqueStrings(lineIds)

  if (uniqueLineIds.length === 0) {
    return new Map<string, string>()
  }

  const originalLineType =
    sourceDocumentType === "sales_invoice" ?
      "sales_invoice_line"
      : "purchase_bill_line"
  const returnType =
    sourceDocumentType === "sales_invoice" ?
      "SALES_RETURN"
      : "PURCHASE_RETURN"
  const rows = await tx
    .select({
      originalLineId: adjustmentDocumentLines.originalLineId,
      returnedQuantity: drizzleSql<string>`coalesce(sum(${adjustmentDocumentLines.quantity}), 0)::text`,
    })
    .from(adjustmentDocumentLines)
    .innerJoin(
      adjustmentDocuments,
      eq(adjustmentDocuments.id, adjustmentDocumentLines.adjustmentDocumentId)
    )
    .where(
      and(
        eq(adjustmentDocumentLines.businessId, businessId),
        eq(adjustmentDocumentLines.originalLineType, originalLineType),
        eq(adjustmentDocuments.adjustmentType, returnType),
        eq(adjustmentDocuments.status, "posted"),
        inArray(adjustmentDocumentLines.originalLineId, uniqueLineIds)
      )
    )
    .groupBy(adjustmentDocumentLines.originalLineId)

  return new Map(
    rows
      .filter((row): row is { originalLineId: string; returnedQuantity: string } =>
        Boolean(row.originalLineId)
      )
      .map((row) => [row.originalLineId, row.returnedQuantity])
  )
}

async function applyAdjustmentSettlementEffects(
  tx: AdjustmentDbTransaction,
  access: BusinessAccess,
  type: AdjustmentType,
  adjustment: AdjustmentDocumentRecord,
  adjustmentVoucherId: string
) {
  const adjustmentCents = toCents(adjustment.grandTotal)

  if (adjustmentCents <= 0 || type === "DEBIT_NOTE") {
    return { appliedAmount: "0.00", excessAmount: "0.00" }
  }

  const direction = resolveAdjustmentFinancialDirection({
    type,
    sourceDocumentType: adjustment.sourceDocumentType as SourceDocumentType,
  })
  const expectedEntryType = direction.arApEntryType

  if (!expectedEntryType || direction.arApEffect !== "decrease") {
    return { appliedAmount: "0.00", excessAmount: "0.00" }
  }

  const effectKind =
    expectedEntryType === "receivable" ? "receivable_reduction" : "payable_reduction"

  await tx.execute(
    drizzleSql`select id from public.receivable_payable_entries
      where business_id = ${access.business.id}
        and voucher_id = ${adjustment.originalVoucherId}
        and entry_type = ${expectedEntryType}
      for update`
  )

  const [targetEntry] = await tx
    .select()
    .from(receivablePayableEntries)
    .where(
      and(
        eq(receivablePayableEntries.businessId, access.business.id),
        eq(receivablePayableEntries.voucherId, adjustment.originalVoucherId),
        eq(receivablePayableEntries.entryType, expectedEntryType)
      )
    )
    .limit(1)

  if (!targetEntry) {
    return { appliedAmount: "0.00", excessAmount: formatCents(adjustmentCents) }
  }

  if (["cancelled", "closed", "written_off"].includes(targetEntry.status)) {
    throw new HttpError(409, "Closed receivable/payable entries cannot be adjusted.")
  }

  const existingEffects = await tx
    .select({
      amount: receivablePayableAdjustmentEffects.amount,
    })
    .from(receivablePayableAdjustmentEffects)
    .where(
      and(
        eq(receivablePayableAdjustmentEffects.businessId, access.business.id),
        eq(
          receivablePayableAdjustmentEffects.receivablePayableEntryId,
          targetEntry.id
        ),
        eq(receivablePayableAdjustmentEffects.status, "active")
      )
    )
  const existingAdjustmentCents = existingEffects.reduce(
    (total, effect) => total + toCents(effect.amount),
    0
  )
  const remainingAdjustableCents = Math.max(
    toCents(targetEntry.originalAmount) - existingAdjustmentCents,
    0
  )
  const appliedCents = Math.min(adjustmentCents, remainingAdjustableCents)
  const excessCents = Math.max(adjustmentCents - appliedCents, 0)

  if (appliedCents > 0) {
    await tx.insert(receivablePayableAdjustmentEffects).values({
      businessId: access.business.id,
      adjustmentDocumentId: adjustment.id,
      adjustmentVoucherId,
      sourceVoucherId: adjustment.originalVoucherId,
      receivablePayableEntryId: targetEntry.id,
      effectKind,
      amount: formatCents(appliedCents),
      status: "active",
      createdBy: access.userId,
    })
    await refreshReceivablePayableSettlementsInTransaction(
      tx,
      access.business.id,
      [targetEntry.id]
    )
  }

  return {
    appliedAmount: formatCents(appliedCents),
    excessAmount: formatCents(excessCents),
  }
}

async function refreshReceivablePayableSettlementsInTransaction(
  tx: AdjustmentDbTransaction,
  businessId: string,
  entryIds: string[]
) {
  const uniqueIds = uniqueStrings(entryIds)

  if (uniqueIds.length === 0) {
    return
  }

  const rows = await tx
    .select({
      id: receivablePayableEntries.id,
      voucherId: receivablePayableEntries.voucherId,
      originalAmount: receivablePayableEntries.originalAmount,
    })
    .from(receivablePayableEntries)
    .where(
      and(
        eq(receivablePayableEntries.businessId, businessId),
        inArray(receivablePayableEntries.id, uniqueIds)
      )
    )
  const allocationRows = await tx
    .select({
      receivablePayableEntryId: paymentAllocations.receivablePayableEntryId,
      allocatedAmount: paymentAllocations.allocatedAmount,
    })
    .from(paymentAllocations)
    .where(
      and(
        eq(paymentAllocations.businessId, businessId),
        eq(paymentAllocations.status, "active"),
        inArray(paymentAllocations.receivablePayableEntryId, uniqueIds)
      )
    )
  const effectRows = await tx
    .select({
      receivablePayableEntryId:
        receivablePayableAdjustmentEffects.receivablePayableEntryId,
      amount: receivablePayableAdjustmentEffects.amount,
    })
    .from(receivablePayableAdjustmentEffects)
    .where(
      and(
        eq(receivablePayableAdjustmentEffects.businessId, businessId),
        eq(receivablePayableAdjustmentEffects.status, "active"),
        inArray(receivablePayableAdjustmentEffects.receivablePayableEntryId, uniqueIds)
      )
    )
  const allocatedByEntryId = new Map<string, number>()
  const adjustedByEntryId = new Map<string, number>()

  for (const row of allocationRows) {
    if (!row.receivablePayableEntryId) {
      continue
    }

    allocatedByEntryId.set(
      row.receivablePayableEntryId,
      (allocatedByEntryId.get(row.receivablePayableEntryId) ?? 0) +
      toCents(row.allocatedAmount)
    )
  }

  for (const row of effectRows) {
    adjustedByEntryId.set(
      row.receivablePayableEntryId,
      (adjustedByEntryId.get(row.receivablePayableEntryId) ?? 0) + toCents(row.amount)
    )
  }

  for (const row of rows) {
    const originalAmount = toCents(row.originalAmount)
    const adjustmentAmount = Math.min(
      adjustedByEntryId.get(row.id) ?? 0,
      originalAmount
    )
    const effectiveAmount = Math.max(originalAmount - adjustmentAmount, 0)
    const settledAmount = Math.min(
      allocatedByEntryId.get(row.id) ?? 0,
      effectiveAmount
    )
    const excessSettledAmount = Math.max(
      (allocatedByEntryId.get(row.id) ?? 0) - effectiveAmount,
      0
    )
    const outstandingAmount = effectiveAmount - settledAmount
    const status =
      effectiveAmount === 0 || outstandingAmount === 0 ? "settled"
        : settledAmount > 0 || adjustmentAmount > 0 ? "partially_settled"
          : "open"

    await tx
      .update(receivablePayableEntries)
      .set({
        adjustmentAmount: formatCents(adjustmentAmount),
        effectiveAmount: formatCents(effectiveAmount),
        settledAmount: formatCents(settledAmount),
        outstandingAmount: formatCents(outstandingAmount),
        excessSettledAmount: formatCents(excessSettledAmount),
        status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(receivablePayableEntries.businessId, businessId),
          eq(receivablePayableEntries.id, row.id)
        )
      )

    await tx
      .update(salesInvoices)
      .set({
        amountDue: formatCents(outstandingAmount),
        amountPaid: drizzleSql`${salesInvoices.totalAmount} - ${formatCents(outstandingAmount)}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(salesInvoices.businessId, businessId),
          eq(salesInvoices.voucherId, row.voucherId)
        )
      )

    await tx
      .update(purchaseBills)
      .set({
        amountDue: formatCents(outstandingAmount),
        amountPaid: drizzleSql`${purchaseBills.totalAmount} - ${formatCents(outstandingAmount)}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(purchaseBills.businessId, businessId),
          eq(purchaseBills.voucherId, row.voucherId)
        )
      )
  }
}

function buildJournalLines(
  type: AdjustmentType,
  adjustment: AdjustmentDocumentRecord,
  accountMap: Map<string, LedgerAccountRecord>,
  context: { branch: { id: string } | null; gstRegistration: { id: string }; warehouseId: string | null }
) {
  const taxableCents = toCents(adjustment.taxableTotal)
  const cgstCents = toCents(adjustment.cgstTotal)
  const sgstCents = toCents(adjustment.sgstTotal)
  const igstCents = toCents(adjustment.igstTotal)
  const cessCents = toCents(adjustment.cessTotal)
  const totalCents = toCents(adjustment.grandTotal)
  const lines = []
  const isSalesSource = adjustment.sourceDocumentType === "sales_invoice"
  const direction = resolveAdjustmentFinancialDirection({
    type,
    sourceDocumentType: adjustment.sourceDocumentType as SourceDocumentType,
  })
  const increasesReceivableOrPayable = direction.arApEffect === "increase"

  if (isSalesSource) {
    if (increasesReceivableOrPayable) {
      lines.push(toJournalLine(getAccount(accountMap, "1130"), totalCents, 0, "Customer debit note", context))
      lines.push(toJournalLine(getAccount(accountMap, "4100"), 0, taxableCents, "Revenue adjustment", context))
      pushTaxJournalLines(lines, accountMap, context, "output", "credit", {
        cgstCents,
        sgstCents,
        igstCents,
        cessCents,
      })
    } else {
      lines.push(toJournalLine(getAccount(accountMap, "4100"), taxableCents, 0, "Revenue reduction", context))
      pushTaxJournalLines(lines, accountMap, context, "output", "debit", {
        cgstCents,
        sgstCents,
        igstCents,
        cessCents,
      })
      lines.push(toJournalLine(getAccount(accountMap, "1130"), 0, totalCents, "Receivable reduction", context))
    }
  } else if (increasesReceivableOrPayable) {
    lines.push(toJournalLine(getAccount(accountMap, "5100"), taxableCents, 0, "Purchase debit note", context))
    pushTaxJournalLines(lines, accountMap, context, "input", "debit", {
      cgstCents,
      sgstCents,
      igstCents,
      cessCents,
    })
    lines.push(toJournalLine(getAccount(accountMap, "2110"), 0, totalCents, "Payable increase", context))
  } else {
    lines.push(toJournalLine(getAccount(accountMap, "2110"), totalCents, 0, "Payable reduction", context))
    lines.push(toJournalLine(getAccount(accountMap, "5100"), 0, taxableCents, "Purchase reduction", context))
    pushTaxJournalLines(lines, accountMap, context, "input", "credit", {
      cgstCents,
      sgstCents,
      igstCents,
      cessCents,
    })
  }

  return lines.filter((line) => toCents(line.debit) > 0 || toCents(line.credit) > 0)
}

function pushTaxJournalLines(
  lines: ReturnType<typeof toJournalLine>[],
  accountMap: Map<string, LedgerAccountRecord>,
  context: { branch: { id: string } | null; gstRegistration: { id: string }; warehouseId: string | null },
  taxKind: "input" | "output",
  side: "debit" | "credit",
  values: {
    cgstCents: number
    sgstCents: number
    igstCents: number
    cessCents: number
  }
) {
  const codes =
    taxKind === "input" ?
      { cgst: "1210", sgst: "1220", igst: "1230", cess: "1240" }
      : { cgst: "2210", sgst: "2220", igst: "2230", cess: "2240" }

  for (const [component, amount] of [
    ["cgst", values.cgstCents],
    ["sgst", values.sgstCents],
    ["igst", values.igstCents],
    ["cess", values.cessCents],
  ] as const) {
    if (amount <= 0) {
      continue
    }

    lines.push(
      toJournalLine(
        getAccount(accountMap, codes[component]),
        side === "debit" ? amount : 0,
        side === "credit" ? amount : 0,
        `${taxKind === "input" ? "Input" : "Output"} ${component.toUpperCase()} adjustment`,
        context
      )
    )
  }
}

function buildInventoryEntries(
  type: AdjustmentType,
  lines: AdjustmentDocumentLineRecord[],
  adjustmentDate: string
) {
  if (type !== "SALES_RETURN" && type !== "PURCHASE_RETURN") {
    return []
  }

  return lines
    .filter((line) => line.itemId && line.inventoryEffect !== "NONE")
    .map((line) => ({
      branchId: null,
      warehouseId: line.inventoryWarehouseId,
      itemId: line.itemId ?? undefined,
      itemNameSnapshot: line.descriptionSnapshot,
      skuSnapshot: line.skuSnapshot ?? undefined,
      unitSnapshot: line.uqcSnapshot ?? line.unit,
      itemSnapshot: {
        hsnSac: line.hsnSacSnapshot,
        taxProfile: line.taxProfileSnapshot,
      },
      movementType: type,
      quantityIn: line.inventoryEffect === "STOCK_IN" ? line.quantity : "0",
      quantityOut: line.inventoryEffect === "STOCK_OUT" ? line.quantity : "0",
      quantity: line.quantity,
      unit: line.unit,
      sourceUnit: line.unit,
      baseQuantity: line.quantity,
      unitCost: line.rate,
      inventoryValue: line.taxableValue,
      totalCost: line.taxableValue,
      transactionDate: adjustmentDate,
      reason: line.reason ?? `${type} posting`,
    }))
}

function buildGstEntries(
  adjustment: AdjustmentDocumentRecord,
  lines: AdjustmentDocumentLineRecord[],
  branchId: string | null
) {
  const entries = []
  const entryType = "adjustment" as const
  const placeOfSupplyStateCode =
    typeof adjustment.taxSnapshot === "object" && adjustment.taxSnapshot ?
      String((adjustment.taxSnapshot as Record<string, unknown>).placeOfSupplyStateCode ?? "")
      : undefined

  for (const line of lines) {
    for (const [component, amount, rate] of [
      ["cgst", line.cgstAmount, line.cgstRate],
      ["sgst", line.sgstAmount, line.sgstRate],
      ["igst", line.igstAmount, line.igstRate],
      ["cess", line.cessAmount, "0"],
    ] as const) {
      if (toCents(amount) <= 0) {
        continue
      }

      entries.push({
        gstRegistrationId: adjustment.gstRegistrationId,
        branchId,
        entryType,
        taxComponent: component,
        taxRate: rate,
        taxableValue: line.taxableValue,
        taxAmount: amount,
        placeOfSupplyStateCode:
          placeOfSupplyStateCode && /^\d{2}$/.test(placeOfSupplyStateCode) ?
            placeOfSupplyStateCode
            : undefined,
      })
    }
  }

  return entries
}

function buildReceivablePayableEntries(
  type: AdjustmentType,
  adjustment: AdjustmentDocumentRecord
) {
  const direction = resolveAdjustmentFinancialDirection({
    type,
    sourceDocumentType: adjustment.sourceDocumentType as SourceDocumentType,
  })

  if (direction.arApEffect !== "increase" || !direction.arApEntryType) {
    return []
  }

  return [
    {
      partyId: adjustment.partyId ?? undefined,
      partyNameSnapshot: getPartyName(adjustment),
      partySnapshot: adjustment.partySnapshot as Record<string, unknown> | undefined,
      entryType: direction.arApEntryType,
      originalAmount: adjustment.grandTotal,
    },
  ]
}

function toJournalLine(
  account: LedgerAccountRecord,
  debitCents: number,
  creditCents: number,
  narration: string,
  context: { branch: { id: string } | null; gstRegistration: { id: string }; warehouseId: string | null }
) {
  return {
    accountId: account.id,
    accountCode: account.accountCode,
    accountName: account.accountName,
    debit: formatCents(debitCents),
    credit: formatCents(creditCents),
    narration,
    branchId: context.branch?.id ?? null,
    gstRegistrationId: context.gstRegistration.id,
    warehouseId: context.warehouseId,
  }
}

function getAccount(accountMap: Map<string, LedgerAccountRecord>, code: string) {
  const account = accountMap.get(code)

  if (!account) {
    throw new HttpError(500, `Ledger account ${code} is not configured.`)
  }

  return account
}

async function createReversalVoucher(
  access: BusinessAccess,
  originalVoucherId: string,
  reason: string
) {
  const originalVoucher = await requireVoucher(access.business.id, originalVoucherId)
  const originalEntries = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.voucherId, originalVoucherId))
  const entryIds = originalEntries.map((entry) => entry.id)
  const originalLines =
    entryIds.length > 0 ?
      await db
        .select()
        .from(journalEntryLines)
        .where(inArray(journalEntryLines.journalEntryId, entryIds))
      : []

  if (originalLines.length === 0) {
    return
  }

  await db.transaction(async (tx) => {
    const [voucher] = await tx
      .insert(vouchers)
      .values({
        businessId: access.business.id,
        gstRegistrationId: originalVoucher.gstRegistrationId,
        branchId: originalVoucher.branchId,
        warehouseId: originalVoucher.warehouseId,
        voucherType: "JOURNAL",
        voucherNumber: `REV-${originalVoucher.voucherNumber}`,
        voucherDate: new Date().toISOString().slice(0, 10),
        financialYearId: originalVoucher.financialYearId,
        status: "posted",
        referenceVoucherId: originalVoucher.id,
        createdBy: access.userId,
        postedBy: access.userId,
        postedAt: new Date(),
        sellerSnapshot: originalVoucher.sellerSnapshot,
        branchSnapshot: originalVoucher.branchSnapshot,
        partySnapshot: originalVoucher.partySnapshot,
        taxSnapshot: originalVoucher.taxSnapshot,
        notes: reason,
      })
      .onConflictDoNothing()
      .returning()

    if (!voucher) {
      return
    }

    const [entry] = await tx
      .insert(journalEntries)
      .values({
        businessId: access.business.id,
        voucherId: voucher.id,
        sourceType: "ADJUSTMENT_REVERSAL",
        sourceId: originalVoucher.id,
        entryDate: voucher.voucherDate,
        description: `Reversal of ${originalVoucher.voucherNumber}`,
        createdBy: access.userId,
        postedAt: new Date(),
      })
      .returning()

    if (!entry) {
      throw new HttpError(500, "Unable to create reversal journal.")
    }

    await tx.insert(journalEntryLines).values(
      originalLines.map((line) => ({
        businessId: access.business.id,
        journalEntryId: entry.id,
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        debit: line.credit,
        credit: line.debit,
        narration: `Reversal: ${line.narration ?? originalVoucher.voucherNumber}`,
        branchId: line.branchId,
        gstRegistrationId: line.gstRegistrationId,
        warehouseId: line.warehouseId,
      }))
    )
  })
}

async function ensureAdjustmentSeries(
  businessId: string,
  financialYearId: string,
  gstRegistrationId: string,
  documentType: string,
  prefix: string
) {
  await db
    .insert(invoiceSeries)
    .values({
      businessId,
      gstRegistrationId,
      financialYearId,
      documentType,
      seriesCode: "DEFAULT",
      prefix,
      nextNumber: 1,
      status: "active",
    })
    .onConflictDoNothing()
}

async function requireAdjustment(
  businessId: string,
  type: AdjustmentType,
  id: string
) {
  const adjustment = await db.query.adjustmentDocuments.findFirst({
    where: and(
      eq(adjustmentDocuments.businessId, businessId),
      eq(adjustmentDocuments.adjustmentType, type),
      eq(adjustmentDocuments.id, id)
    ),
  })

  if (!adjustment) {
    throw new HttpError(404, "Adjustment document not found.")
  }

  return adjustment
}

async function requireVoucher(businessId: string, voucherId: string) {
  const voucher = await db.query.vouchers.findFirst({
    where: and(eq(vouchers.businessId, businessId), eq(vouchers.id, voucherId)),
  })

  if (!voucher) {
    throw new HttpError(404, "Source voucher not found.")
  }

  return voucher
}

async function getAdjustmentLines(businessId: string, adjustmentId: string) {
  return db
    .select()
    .from(adjustmentDocumentLines)
    .where(
      and(
        eq(adjustmentDocumentLines.businessId, businessId),
        eq(adjustmentDocumentLines.adjustmentDocumentId, adjustmentId)
      )
    )
}

async function getExistingDraftInputLines(
  businessId: string,
  adjustmentId: string
): Promise<CreateAdjustmentInput["lines"]> {
  const lines = await getAdjustmentLines(businessId, adjustmentId)

  return lines.map((line) => ({
    originalLineId: line.originalLineId ?? undefined,
    quantity: line.quantity,
    taxableValue: line.taxableValue,
    rate: line.rate,
    reason: line.reason ?? undefined,
    inventoryEffect: line.inventoryEffect as CreateAdjustmentInput["lines"][number]["inventoryEffect"],
    inventoryWarehouseId: line.inventoryWarehouseId,
  }))
}

async function runAdjustmentOperationIdempotency<T>(
  access: BusinessAccess,
  operation: string,
  idempotencyKey: string | null,
  requestPayload: unknown,
  handler: () => Promise<T>
): Promise<T> {
  if (!idempotencyKey) {
    return handler()
  }

  const requestHash = buildAdjustmentOperationRequestHash(requestPayload)
  const [insertedKey] = await db
    .insert(moneyOperationIdempotencyKeys)
    .values({
      businessId: access.business.id,
      operation,
      idempotencyKey,
      requestHash,
      status: "in_progress",
    })
    .onConflictDoNothing()
    .returning()

  if (!insertedKey) {
    const existingKey = await db.query.moneyOperationIdempotencyKeys.findFirst({
      where: and(
        eq(moneyOperationIdempotencyKeys.businessId, access.business.id),
        eq(moneyOperationIdempotencyKeys.operation, operation),
        eq(moneyOperationIdempotencyKeys.idempotencyKey, idempotencyKey)
      ),
    })

    if (!existingKey) {
      throw new HttpError(409, "Adjustment idempotency state could not be resolved.")
    }

    if (existingKey.requestHash !== requestHash) {
      throw new HttpError(
        409,
        "Idempotency key was already used with a different request."
      )
    }

    if (existingKey.status === "completed" && existingKey.responseBody) {
      return existingKey.responseBody as T
    }

    if (existingKey.status === "failed") {
      throw new HttpError(409, "A previous request with this idempotency key failed.")
    }

    throw new HttpError(409, "A request with this idempotency key is still in progress.")
  }

  try {
    const response = await handler()

    await db
      .update(moneyOperationIdempotencyKeys)
      .set({ status: "completed", responseBody: response, updatedAt: new Date() })
      .where(eq(moneyOperationIdempotencyKeys.id, insertedKey.id))

    return response
  } catch (error) {
    await db
      .update(moneyOperationIdempotencyKeys)
      .set({
        status: "failed",
        responseBody: { message: error instanceof Error ? error.message : "Failed" },
        updatedAt: new Date(),
      })
      .where(eq(moneyOperationIdempotencyKeys.id, insertedKey.id))

    throw error
  }
}

async function assertCanUseAdjustment(
  access: BusinessAccess,
  type: AdjustmentType,
  action: AdjustmentAction
) {
  if (access.membership.role === "owner" || access.membership.role === "admin") {
    return
  }

  const module =
    type === "SALES_RETURN" || type === "CREDIT_NOTE" ? "invoices" : "purchases"
  const permissionColumn =
    action === "view" ? businessMemberPermissions.canView
      : action === "create" ? businessMemberPermissions.canCreate
        : action === "edit" ? businessMemberPermissions.canEdit
          : businessMemberPermissions.canDelete
  const permission = await db.query.businessMemberPermissions.findFirst({
    where: and(
      eq(businessMemberPermissions.businessMemberId, access.membership.id),
      eq(businessMemberPermissions.module, module),
      eq(permissionColumn, true)
    ),
  })

  if (!permission) {
    throw new HttpError(403, "You do not have permission to access adjustments.")
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
    entityType: "adjustment_document",
    entityId,
    action,
    userId: access.userId,
    before,
    after,
    reason,
  })
}

function getSourcePartyId(source: AdjustmentSource) {
  return source.sourceDocumentType === "sales_invoice" ?
    source.document.partyId
    : source.document.supplierId
}

function getSourceBranchId(source: AdjustmentSource) {
  return source.document.branchId
}

function getSourceGstRegistrationId(source: AdjustmentSource) {
  return source.document.gstRegistrationId
}

function getSourceWarehouseId(source: AdjustmentSource) {
  return source.document.warehouseId
}

function getSourcePlaceOfSupply(source: AdjustmentSource) {
  return source.document.placeOfSupplyStateCode
}

function getSourcePartySnapshot(source: AdjustmentSource) {
  return source.sourceDocumentType === "sales_invoice" ?
    source.document.partySnapshot
    : source.document.supplierSnapshot
}

function buildSourceSnapshot(source: AdjustmentSource) {
  return source.sourceDocumentType === "sales_invoice" ?
    {
      id: source.document.id,
      voucherId: source.document.voucherId,
      documentNumber: source.document.invoiceNumber,
      documentDate: source.document.invoiceDate,
      partyName: source.document.customerName,
      totalAmount: source.document.totalAmount,
      sourceDocumentType: source.sourceDocumentType,
    }
    : {
      id: source.document.id,
      voucherId: source.document.voucherId,
      documentNumber: source.document.billNumber,
      supplierInvoiceNumber: source.document.supplierInvoiceNumber,
      documentDate: source.document.billDate,
      partyName: source.document.supplierName,
      totalAmount: source.document.totalAmount,
      sourceDocumentType: source.sourceDocumentType,
    }
}

function buildTaxSnapshot(source: AdjustmentSource, calculation: AdjustmentCalculation) {
  return {
    placeOfSupplyStateCode: source.document.placeOfSupplyStateCode,
    taxableValue: calculation.totals.taxableTotal,
    cgstAmount: calculation.totals.cgstTotal,
    sgstAmount: calculation.totals.sgstTotal,
    igstAmount: calculation.totals.igstTotal,
    cessAmount: calculation.totals.cessTotal,
    totalAmount: calculation.totals.grandTotal,
  }
}

function getPartyName(adjustment: AdjustmentDocumentRecord) {
  const snapshot = adjustment.partySnapshot

  if (snapshot && typeof snapshot === "object") {
    const record = snapshot as Record<string, unknown>
    const value = record.displayName ?? record.legalName ?? record.tradeName

    if (typeof value === "string" && value.trim()) {
      return value
    }
  }

  const sourceSnapshot = adjustment.sourceSnapshot

  if (sourceSnapshot && typeof sourceSnapshot === "object") {
    const value = (sourceSnapshot as Record<string, unknown>).partyName

    if (typeof value === "string" && value.trim()) {
      return value
    }
  }

  return "Counterparty"
}

function getPrimaryWarehouseId(lines: AdjustmentDocumentLineRecord[]) {
  return lines.find((line) => line.inventoryWarehouseId)?.inventoryWarehouseId ?? null
}

function csvCell(value: unknown) {
  const text = String(value ?? "")

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function resolveOperationIdempotencyKey(
  headerValue: unknown,
  bodyValue?: string | null
) {
  if (bodyValue?.trim()) {
    return bodyValue.trim()
  }

  if (Array.isArray(headerValue)) {
    return resolveOperationIdempotencyKey(headerValue[0])
  }

  if (typeof headerValue === "string" && headerValue.trim()) {
    return headerValue.trim()
  }

  return null
}
