import { randomUUID } from "node:crypto"

import { and, desc, eq, ilike, inArray, or, sql as drizzleSql, type SQL } from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { db, sql } from "../../db/client.js"
import {
  auditLogs,
  bankReconciliationMatches,
  bankStatementImports,
  bankStatementLines,
  businessMemberPermissions,
  journalEntries,
  journalEntryLines,
  ledgerAccounts,
  moneyOperationIdempotencyKeys,
  partyCustomerProfiles,
  partySupplierProfiles,
  paymentAllocations,
  payments as paymentDocuments,
  purchaseBills,
  receipts,
  receivablePayableAdjustmentEffects,
  receivablePayableEntries,
  salesInvoices,
  vouchers,
  type LedgerAccountRecord,
  type PaymentRecord,
  type ReceiptRecord,
  type ReceivablePayableEntryRecord,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"
import {
  createDraftDocumentNumber,
  ensureDefaultLedgerAccountMap,
  getPartySnapshot,
  resolveTransactionContext,
} from "../accounting/accounting-domain.service.js"
import { postVoucher } from "../core/core.routes.js"
import { formatCents, normalizeMoney, toCents } from "../core/core.validation.js"
import {
  allocationParamsSchema,
  agingReportQuerySchema,
  bankAutoMatchSchema,
  bankReconciliationQuerySchema,
  bankReconciliationSchema,
  bankStatementImportSchema,
  bankStatementLinesQuerySchema,
  createAllocationSchema,
  createMoneyDocumentSchema,
  idParamsSchema,
  listMoneyDocumentsQuerySchema,
  listReceivablePayableQuerySchema,
  postMoneyDocumentSchema,
  reconciliationParamsSchema,
  reportDateRangeQuerySchema,
  reverseMoneyDocumentSchema,
  updateMoneyDocumentSchema,
  type AgingReportQueryInput,
  type BankAutoMatchInput,
  type BankReconciliationInput,
  type BankReconciliationQueryInput,
  type BankStatementImportInput,
  type BankStatementLinesQueryInput,
  type CreateAllocationInput,
  type CreateMoneyDocumentInput,
  type ListMoneyDocumentsQueryInput,
  type ListReceivablePayableQueryInput,
  type PostMoneyDocumentInput,
  type ReportDateRangeQueryInput,
  type UpdateMoneyDocumentInput,
} from "./payment-receipt.schemas.js"
import { buildMoneyOperationRequestHash } from "./payment-receipt.domain.js"

type BusinessAccess = Awaited<ReturnType<typeof requirePrimaryBusinessAccess>>
type MoneyAction = "view" | "create" | "edit" | "delete"
type MoneyDocumentKind = "receipt" | "payment"
type MoneyDocumentRecord = ReceiptRecord | PaymentRecord
type AllocationTargetType = "receivable" | "payable"
type UnallocatedTreatment = "advance" | "unallocated"
type BankStatementDirection = "credit" | "debit"

type AllocationTarget = {
  entry: ReceivablePayableEntryRecord
  voucherNumber: string
  voucherDate: string
  voucherType: string
}

type ReceivablePayableListRow = {
  id: string
  businessId: string
  voucherId: string
  partyId: string | null
  partyNameSnapshot: string
  partySnapshot: unknown
  entryType: string
  originalAmount: string
  adjustmentAmount: string
  effectiveAmount: string
  settledAmount: string
  outstandingAmount: string
  excessSettledAmount: string
  dueDate: string | null
  status: string
  createdAt: Date
  voucherNumber: string
  voucherDate: string
  voucherType: string
}

type CsvExportResponse = {
  fileName: string
  contentType: "text/csv"
  content: string
}

type BankStatementLineRow = {
  id: string
  importId: string
  fileName: string
  cashBankAccountId: string
  statementDate: string
  description: string
  bankReference: string | null
  direction: BankStatementDirection
  amount: string
  matchStatus: "unmatched" | "matched" | "ignored"
  matchedReceiptId: string | null
  matchedPaymentId: string | null
  matchedAt: Date | null
  matchId: string | null
  matchedDocumentNumber: string | null
  matchedDocumentType: "receipt" | "payment" | null
  createdAt: Date
}

type ParsedBankStatementLine = {
  statementDate: string
  description: string
  bankReference: string | null
  direction: BankStatementDirection
  amount: string
}

type BankDocumentCandidate = {
  documentType: MoneyDocumentKind
  documentId: string
  documentNumber: string
  documentDate: string
  amount: string
  referenceNumber: string | null
}

type AgingGranularity = "day" | "month"

type AgingReportEntryRow = {
  periodDate: string
  outstanding: string
}

type AgingReportPeriod = {
  periodStart: string
  periodEnd: string
  label: string
  count: number
  outstanding: string
}

const customerAdvanceAccount = {
  accountCode: "2120",
  accountName: "Customer Advances",
  accountType: "LIABILITY",
  accountGroup: "CUSTOMER_ADVANCES",
  normalBalance: "CREDIT" as const,
}

const supplierAdvanceAccount = {
  accountCode: "1150",
  accountName: "Supplier Advances",
  accountType: "ASSET",
  accountGroup: "SUPPLIER_ADVANCES",
  normalBalance: "DEBIT" as const,
}

const customerUnappliedAccount = {
  accountCode: "2130",
  accountName: "Unapplied Customer Receipts",
  accountType: "LIABILITY",
  accountGroup: "UNAPPLIED_RECEIPTS",
  normalBalance: "CREDIT" as const,
}

const supplierUnappliedAccount = {
  accountCode: "1160",
  accountName: "Unapplied Supplier Payments",
  accountType: "ASSET",
  accountGroup: "UNAPPLIED_PAYMENTS",
  normalBalance: "DEBIT" as const,
}

export async function registerPaymentReceiptRoutes(app: FastifyInstance) {
  app.get("/receipts", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "view")
    const query = listMoneyDocumentsQuerySchema.parse(request.query)

    return listMoneyDocuments(access.business.id, "receipt", query)
  })

  app.post("/receipts", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "create")
    const body = createMoneyDocumentSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runMoneyOperationIdempotency(
      access,
      "receipt:create",
      idempotencyKey,
      body,
      async () => {
        const receipt = await createMoneyDocument(access, "receipt", body)

        return {
          receipt: await getMoneyDocumentDetail(access.business.id, "receipt", receipt.id),
        }
      }
    )
  })

  app.get("/receipts/export", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "view")
    const query = listMoneyDocumentsQuerySchema.parse(request.query)

    return exportMoneyDocuments(access.business.id, "receipt", query)
  })

  app.get("/receipts/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "view")
    const { id } = idParamsSchema.parse(request.params)

    return { receipt: await getMoneyDocumentDetail(access.business.id, "receipt", id) }
  })

  app.patch("/receipts/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    const body = updateMoneyDocumentSchema.parse(request.body)
    const receipt = await updateMoneyDocument(access, "receipt", id, body)

    return { receipt: await getMoneyDocumentDetail(access.business.id, "receipt", receipt.id) }
  })

  app.delete("/receipts/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "delete")
    const { id } = idParamsSchema.parse(request.params)
    await deleteDraftMoneyDocument(access, "receipt", id)

    return { success: true }
  })

  app.post("/receipts/:id/post", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "create")
    const { id } = idParamsSchema.parse(request.params)
    const body = postMoneyDocumentSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )
    const resolvedPostKey = body.idempotencyKey ?? idempotencyKey ?? undefined
    const postBody = {
      ...body,
      ...(resolvedPostKey ? { idempotencyKey: resolvedPostKey } : {}),
    }

    return runMoneyOperationIdempotency(
      access,
      `receipt:${id}:post`,
      idempotencyKey,
      postBody,
      async () => {
        const receipt = await postMoneyDocument(access, "receipt", id, postBody)

        return {
          receipt: await getMoneyDocumentDetail(access.business.id, "receipt", receipt.id),
        }
      }
    )
  })

  app.post("/receipts/:id/allocations", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    const body = createAllocationSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runMoneyOperationIdempotency(
      access,
      `receipt:${id}:allocation`,
      idempotencyKey,
      body,
      async () => {
        await addAllocation(access, "receipt", id, body)

        return { receipt: await getMoneyDocumentDetail(access.business.id, "receipt", id) }
      }
    )
  })

  app.delete("/receipts/:id/allocations/:allocationId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "edit")
    const { id, allocationId } = allocationParamsSchema.parse(request.params)
    await reverseAllocation(access, "receipt", id, allocationId, "Allocation removed")

    return { receipt: await getMoneyDocumentDetail(access.business.id, "receipt", id) }
  })

  app.post("/receipts/:id/reverse", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "delete")
    const { id } = idParamsSchema.parse(request.params)
    const body = reverseMoneyDocumentSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runMoneyOperationIdempotency(
      access,
      `receipt:${id}:reverse`,
      idempotencyKey,
      body,
      async () => {
        await reverseMoneyDocument(access, "receipt", id, body.reason)

        return { receipt: await getMoneyDocumentDetail(access.business.id, "receipt", id) }
      }
    )
  })

  app.get("/payments", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "view")
    const query = listMoneyDocumentsQuerySchema.parse(request.query)

    return listMoneyDocuments(access.business.id, "payment", query)
  })

  app.post("/payments", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "create")
    const body = createMoneyDocumentSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runMoneyOperationIdempotency(
      access,
      "payment:create",
      idempotencyKey,
      body,
      async () => {
        const payment = await createMoneyDocument(access, "payment", body)

        return {
          payment: await getMoneyDocumentDetail(access.business.id, "payment", payment.id),
        }
      }
    )
  })

  app.get("/payments/export", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "view")
    const query = listMoneyDocumentsQuerySchema.parse(request.query)

    return exportMoneyDocuments(access.business.id, "payment", query)
  })

  app.get("/payments/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "view")
    const { id } = idParamsSchema.parse(request.params)

    return { payment: await getMoneyDocumentDetail(access.business.id, "payment", id) }
  })

  app.patch("/payments/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    const body = updateMoneyDocumentSchema.parse(request.body)
    const payment = await updateMoneyDocument(access, "payment", id, body)

    return { payment: await getMoneyDocumentDetail(access.business.id, "payment", payment.id) }
  })

  app.delete("/payments/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "delete")
    const { id } = idParamsSchema.parse(request.params)
    await deleteDraftMoneyDocument(access, "payment", id)

    return { success: true }
  })

  app.post("/payments/:id/post", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "create")
    const { id } = idParamsSchema.parse(request.params)
    const body = postMoneyDocumentSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )
    const resolvedPostKey = body.idempotencyKey ?? idempotencyKey ?? undefined
    const postBody = {
      ...body,
      ...(resolvedPostKey ? { idempotencyKey: resolvedPostKey } : {}),
    }

    return runMoneyOperationIdempotency(
      access,
      `payment:${id}:post`,
      idempotencyKey,
      postBody,
      async () => {
        const payment = await postMoneyDocument(access, "payment", id, postBody)

        return {
          payment: await getMoneyDocumentDetail(access.business.id, "payment", payment.id),
        }
      }
    )
  })

  app.post("/payments/:id/allocations", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    const body = createAllocationSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runMoneyOperationIdempotency(
      access,
      `payment:${id}:allocation`,
      idempotencyKey,
      body,
      async () => {
        await addAllocation(access, "payment", id, body)

        return { payment: await getMoneyDocumentDetail(access.business.id, "payment", id) }
      }
    )
  })

  app.delete("/payments/:id/allocations/:allocationId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "edit")
    const { id, allocationId } = allocationParamsSchema.parse(request.params)
    await reverseAllocation(access, "payment", id, allocationId, "Allocation removed")

    return { payment: await getMoneyDocumentDetail(access.business.id, "payment", id) }
  })

  app.post("/payments/:id/reverse", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "delete")
    const { id } = idParamsSchema.parse(request.params)
    const body = reverseMoneyDocumentSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runMoneyOperationIdempotency(
      access,
      `payment:${id}:reverse`,
      idempotencyKey,
      body,
      async () => {
        await reverseMoneyDocument(access, "payment", id, body.reason)

        return { payment: await getMoneyDocumentDetail(access.business.id, "payment", id) }
      }
    )
  })

  app.get("/receivables", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "view")
    const query = listReceivablePayableQuerySchema.parse(request.query)

    return listReceivablePayableEntries(access.business.id, "receivable", query)
  })

  app.get("/receivables/export", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "view")
    const query = listReceivablePayableQuerySchema.parse(request.query)

    return exportReceivablePayableEntries(access.business.id, "receivable", query)
  })

  app.get("/payables", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "view")
    const query = listReceivablePayableQuerySchema.parse(request.query)

    return listReceivablePayableEntries(access.business.id, "payable", query)
  })

  app.get("/payables/export", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "view")
    const query = listReceivablePayableQuerySchema.parse(request.query)

    return exportReceivablePayableEntries(access.business.id, "payable", query)
  })

  app.get("/payment-reports/aging", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "view")
    const query = agingReportQuerySchema.parse(request.query)

    return getAgingReport(access.business.id, query)
  })

  app.get("/payment-reports/aging/export", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "view")
    const query = agingReportQuerySchema.parse(request.query)

    return exportAgingReport(access.business.id, query)
  })

  app.get("/payment-reports/cash-flow", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "view")
    const query = reportDateRangeQuerySchema.parse(request.query)

    return getCashFlowReport(access.business.id, query)
  })

  app.get("/payment-reports/cash-flow/export", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "view")
    const query = reportDateRangeQuerySchema.parse(request.query)

    return exportCashFlowReport(access.business.id, query)
  })

  app.get("/bank-reconciliation", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "view")
    const query = bankReconciliationQuerySchema.parse(request.query)

    return listBankReconciliationItems(access.business.id, query)
  })

  app.get("/bank-reconciliation/statement-lines", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "view")
    const query = bankStatementLinesQuerySchema.parse(request.query)

    return listBankStatementLines(access.business.id, query)
  })

  app.post("/bank-reconciliation", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "edit")
    const body = bankReconciliationSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runMoneyOperationIdempotency(
      access,
      `bank-reconciliation:${body.documentType}:${body.documentId}`,
      idempotencyKey,
      body,
      async () => ({ match: await reconcileBankDocument(access, body) })
    )
  })

  app.post("/bank-reconciliation/import", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "edit")
    const body = bankStatementImportSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runMoneyOperationIdempotency(
      access,
      `bank-reconciliation:import:${body.fileName}:${body.cashBankAccountId}`,
      idempotencyKey,
      body,
      async () => importBankStatement(access, body)
    )
  })

  app.post("/bank-reconciliation/auto-match", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "edit")
    const body = bankAutoMatchSchema.parse(request.body)
    const idempotencyKey = resolveOperationIdempotencyKey(
      request.headers["idempotency-key"],
      body.idempotencyKey
    )

    return runMoneyOperationIdempotency(
      access,
      "bank-reconciliation:auto-match",
      idempotencyKey,
      body,
      async () => autoMatchBankStatementLines(access, body)
    )
  })

  app.delete("/bank-reconciliation/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseMoney(access, "edit")
    const { id } = reconciliationParamsSchema.parse(request.params)
    await unreconcileBankDocument(access, id)

    return { success: true }
  })
}

async function runMoneyOperationIdempotency<T>(
  access: BusinessAccess,
  operation: string,
  idempotencyKey: string | null,
  requestPayload: unknown,
  handler: () => Promise<T>
): Promise<T> {
  if (!idempotencyKey) {
    return handler()
  }

  const requestHash = buildMoneyOperationRequestHash(requestPayload)
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
      throw new HttpError(409, "Payment idempotency state could not be resolved.")
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
      .set({
        status: "completed",
        responseBody: response,
        updatedAt: new Date(),
      })
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

async function createMoneyDocument(
  access: BusinessAccess,
  kind: MoneyDocumentKind,
  body: CreateMoneyDocumentInput
) {
  await assertPartyCanUseMoney(access.business.id, body.partyId, kind)
  const partySnapshot = await getPartySnapshot(access.business.id, body.partyId)
  const cashBankAccount = await requireCashBankAccount(
    access.business.id,
    body.cashBankAccountId
  )
  const amount = normalizeMoney(body.amount)
  const numberPrefix = kind === "receipt" ? "RCP" : "PAY"
  const table = kind === "receipt" ? receipts : paymentDocuments
  const [document] = await db
    .insert(table)
    .values({
      businessId: access.business.id,
      partyId: body.partyId,
      branchId: body.branchId ?? null,
      gstRegistrationId: body.gstRegistrationId ?? null,
      cashBankAccountId: body.cashBankAccountId,
      ...(kind === "receipt" ?
        {
          receiptNumber: createDraftDocumentNumber(numberPrefix),
          receiptDate: body.documentDate,
        }
      : {
          paymentNumber: createDraftDocumentNumber(numberPrefix),
          paymentDate: body.documentDate,
        }),
      paymentMethod: body.paymentMethod,
      amount,
      allocatedAmount: "0.00",
      unallocatedAmount: amount,
      unallocatedTreatment: body.unallocatedTreatment,
      referenceNumber: body.referenceNumber ?? null,
      notes: body.notes ?? null,
      status: "draft",
      partyNameSnapshot: partySnapshot?.displayName ?? "Unknown party",
      partySnapshot,
      cashBankAccountSnapshot: cashBankAccountSnapshot(cashBankAccount),
      createdBy: access.userId,
    })
    .returning()

  if (!document) {
    throw new HttpError(500, `Unable to create ${kind}.`)
  }

  await insertAuditLog(access, kind, document.id, "DRAFT_CREATED", null, document)
  return document
}

async function updateMoneyDocument(
  access: BusinessAccess,
  kind: MoneyDocumentKind,
  documentId: string,
  body: UpdateMoneyDocumentInput
) {
  const existing = await requireMoneyDocument(access.business.id, kind, documentId)

  if (existing.status !== "draft") {
    throw new HttpError(409, `Only draft ${kind}s can be edited.`)
  }

  if (body.partyId) {
    await assertPartyCanUseMoney(access.business.id, body.partyId, kind)
  }

  const nextPartyId = body.partyId ?? existing.partyId
  const partySnapshot =
    body.partyId ? await getPartySnapshot(access.business.id, nextPartyId) : null
  const cashBankAccount =
    body.cashBankAccountId ?
      await requireCashBankAccount(access.business.id, body.cashBankAccountId)
    : null
  const amount = body.amount ? normalizeMoney(body.amount) : undefined
  const table = kind === "receipt" ? receipts : paymentDocuments
  const [document] = await db
    .update(table)
    .set({
      ...(body.partyId !== undefined ?
        {
          partyId: body.partyId,
          partyNameSnapshot: partySnapshot?.displayName ?? existing.partyNameSnapshot,
          partySnapshot,
        }
      : {}),
      ...(body.branchId !== undefined ? { branchId: body.branchId ?? null } : {}),
      ...(body.gstRegistrationId !== undefined ?
        { gstRegistrationId: body.gstRegistrationId ?? null }
      : {}),
      ...(body.cashBankAccountId !== undefined ?
        {
          cashBankAccountId: body.cashBankAccountId,
          cashBankAccountSnapshot: cashBankAccount ?
            cashBankAccountSnapshot(cashBankAccount)
          : existing.cashBankAccountSnapshot,
        }
      : {}),
      ...(body.documentDate !== undefined ?
        kind === "receipt" ? { receiptDate: body.documentDate } : { paymentDate: body.documentDate }
      : {}),
      ...(body.paymentMethod !== undefined ? { paymentMethod: body.paymentMethod } : {}),
      ...(amount !== undefined ? { amount, unallocatedAmount: amount } : {}),
      ...(body.unallocatedTreatment !== undefined ?
        { unallocatedTreatment: body.unallocatedTreatment }
      : {}),
      ...(body.referenceNumber !== undefined ?
        { referenceNumber: body.referenceNumber ?? null }
      : {}),
      ...(body.notes !== undefined ? { notes: body.notes ?? null } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(table.businessId, access.business.id), eq(table.id, documentId)))
    .returning()

  if (!document) {
    throw new HttpError(500, `Unable to update ${kind}.`)
  }

  await insertAuditLog(access, kind, document.id, "DRAFT_UPDATED", existing, document)
  return document
}

async function deleteDraftMoneyDocument(
  access: BusinessAccess,
  kind: MoneyDocumentKind,
  documentId: string
) {
  const existing = await requireMoneyDocument(access.business.id, kind, documentId)

  if (existing.status !== "draft") {
    throw new HttpError(409, `Only draft ${kind}s can be deleted.`)
  }

  const table = kind === "receipt" ? receipts : paymentDocuments
  await insertAuditLog(access, kind, documentId, "DRAFT_DELETED", existing, null)
  await db
    .delete(table)
    .where(and(eq(table.businessId, access.business.id), eq(table.id, documentId)))
}

async function postMoneyDocument(
  access: BusinessAccess,
  kind: MoneyDocumentKind,
  documentId: string,
  body: PostMoneyDocumentInput
) {
  const document = await requireMoneyDocument(access.business.id, kind, documentId)

  if (document.status !== "draft") {
    throw new HttpError(409, `Only draft ${kind}s can be posted.`)
  }

  const amountCents = toCents(document.amount)
  if (amountCents <= 0) {
    throw new HttpError(400, `${capitalize(kind)} amount must be greater than zero.`)
  }

  const context = await resolveTransactionContext(access, {
    transactionDate: getDocumentDate(kind, document),
    gstRegistrationId: document.gstRegistrationId,
    branchId: document.branchId,
  })
  const accountMap = await ensureMoneyAccountMap(access.business.id)
  const cashBankAccount = await requireCashBankAccount(
    access.business.id,
    document.cashBankAccountId
  )
  const partySnapshot = await getPartySnapshot(access.business.id, document.partyId)
  const allocations = await validateAllocations(
    access.business.id,
    document.partyId,
    kind === "receipt" ? "receivable" : "payable",
    body.allocations
  )
  const allocatedCents = sumAllocationCents(body.allocations)

  if (allocatedCents > amountCents) {
    throw new HttpError(409, "Allocated amount cannot exceed the document amount.")
  }

  const unallocatedCents = amountCents - allocatedCents
  const result = await postVoucher(access, {
    idempotencyKey: body.idempotencyKey ?? randomUUID(),
    voucherType: kind === "receipt" ? "RECEIPT" : "PAYMENT",
    documentType: kind,
    voucherDate: getDocumentDate(kind, document),
    financialYearId: context.financialYearId,
    gstRegistrationId: context.gstRegistration.id,
    branchId: context.branch?.id ?? null,
    warehouseId: null,
    seriesCode: "DEFAULT",
    notes: document.notes ?? undefined,
    snapshots: {
      seller: {
        businessId: access.business.id,
        legalName: access.business.legalName,
        tradeName: access.business.tradeName,
        gstin: context.gstRegistration.gstin,
      },
      branch: context.branch ?? undefined,
      party: partySnapshot ?? undefined,
      tax: {
        settlementType: kind,
        paymentMethod: document.paymentMethod,
        referenceNumber: document.referenceNumber,
      },
    },
    journal: {
      description: `${capitalize(kind)} - ${document.partyNameSnapshot}`,
      lines: buildMoneyJournalLines({
        kind,
        amountCents,
        allocatedCents,
        unallocatedCents,
        unallocatedTreatment: getDocumentUnallocatedTreatment(document),
        cashBankAccount,
        accountMap,
        branchId: context.branch?.id ?? null,
        gstRegistrationId: context.gstRegistration.id,
      }),
    },
    inventoryEntries: [],
    gstEntries: [],
    receivablePayableEntries: [],
    paymentAllocations: [],
  })

  const table = kind === "receipt" ? receipts : paymentDocuments
  const [postedDocument] = await db
    .update(table)
    .set({
      voucherId: result.voucher.id,
      ...(kind === "receipt" ?
        { receiptNumber: result.voucher.voucherNumber }
      : { paymentNumber: result.voucher.voucherNumber }),
      gstRegistrationId: context.gstRegistration.id,
      branchId: context.branch?.id ?? null,
      allocatedAmount: formatCents(allocatedCents),
      unallocatedAmount: formatCents(unallocatedCents),
      status: "posted",
      partySnapshot: partySnapshot,
      cashBankAccountSnapshot: cashBankAccountSnapshot(cashBankAccount),
      postedBy: access.userId,
      postedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(table.businessId, access.business.id), eq(table.id, documentId)))
    .returning()

  if (!postedDocument) {
    throw new HttpError(500, `Unable to mark ${kind} as posted.`)
  }

  await insertInitialAllocations(access, kind, postedDocument, body.allocations, allocations)
  await refreshTransactionDocumentSettlements(access.business.id, [
    ...allocations.keys(),
  ])
  await insertAuditLog(access, kind, documentId, "POSTED", document, postedDocument)

  return postedDocument
}

async function insertInitialAllocations(
  access: BusinessAccess,
  kind: MoneyDocumentKind,
  document: MoneyDocumentRecord,
  allocationInputs: CreateAllocationInput[],
  targets: Map<string, AllocationTarget>
) {
  if (!document.voucherId || allocationInputs.length === 0) {
    return
  }

  const paymentVoucherId = document.voucherId
  await db.insert(paymentAllocations).values(
    allocationInputs.map((allocation) => {
      const target = targets.get(allocation.receivablePayableEntryId)

      if (!target) {
        throw new HttpError(400, "Allocation target not found.")
      }

      return {
        businessId: access.business.id,
        paymentVoucherId,
        allocationKind: kind,
        receiptId: kind === "receipt" ? document.id : null,
        paymentId: kind === "payment" ? document.id : null,
        documentVoucherId: target.entry.voucherId,
        receivablePayableEntryId: target.entry.id,
        allocatedAmount: normalizeMoney(allocation.allocatedAmount),
        status: "active",
        createdBy: access.userId,
      }
    })
  )
}

async function addAllocation(
  access: BusinessAccess,
  kind: MoneyDocumentKind,
  documentId: string,
  body: CreateAllocationInput
) {
  const document = await requireMoneyDocument(access.business.id, kind, documentId)

  if (document.status !== "posted" || !document.voucherId) {
    throw new HttpError(409, `Only posted ${kind}s can receive allocations.`)
  }

  const amountCents = toCents(document.amount)
  const currentAllocatedCents = await sumActiveAllocationsForVoucher(
    access.business.id,
    document.voucherId
  )
  const requestedCents = toCents(body.allocatedAmount)

  if (currentAllocatedCents + requestedCents > amountCents) {
    throw new HttpError(409, "Allocation exceeds the document unallocated amount.")
  }

  const targets = await validateAllocations(
    access.business.id,
    document.partyId,
    kind === "receipt" ? "receivable" : "payable",
    [body]
  )
  const target = targets.get(body.receivablePayableEntryId)

  if (!target) {
    throw new HttpError(400, "Allocation target not found.")
  }

  const [allocation] = await db
    .insert(paymentAllocations)
    .values({
      businessId: access.business.id,
      paymentVoucherId: document.voucherId,
      allocationKind: kind,
      ...(kind === "receipt" ? { receiptId: document.id } : { paymentId: document.id }),
      documentVoucherId: target.entry.voucherId,
      receivablePayableEntryId: target.entry.id,
      allocatedAmount: normalizeMoney(body.allocatedAmount),
      status: "active",
      createdBy: access.userId,
    })
    .returning()

  if (!allocation) {
    throw new HttpError(500, "Unable to allocate this document.")
  }

  await createAllocationAdjustmentVoucher(access, {
    kind,
    document,
    amountCents: requestedCents,
    mode: "apply",
    reason: "Allocation applied after posting",
  })
  await refreshMoneyDocumentAllocationProjection(access.business.id, kind, documentId)
  await refreshTransactionDocumentSettlements(access.business.id, [target.entry.id])
  await insertAuditLog(access, kind, documentId, "PAYMENT_ALLOCATED", null, allocation)
}

async function reverseAllocation(
  access: BusinessAccess,
  kind: MoneyDocumentKind,
  documentId: string,
  allocationId: string,
  reason: string
) {
  const document = await requireMoneyDocument(access.business.id, kind, documentId)

  if (document.status !== "posted" || !document.voucherId) {
    throw new HttpError(409, `Only posted ${kind}s can have allocations removed.`)
  }

  const [allocation] = await db
    .update(paymentAllocations)
    .set({
      status: "reversed",
      reversedBy: access.userId,
      reversedAt: new Date(),
      reversalReason: reason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentAllocations.businessId, access.business.id),
        eq(paymentAllocations.id, allocationId),
        eq(paymentAllocations.paymentVoucherId, document.voucherId),
        eq(paymentAllocations.status, "active")
      )
    )
    .returning()

  if (!allocation) {
    throw new HttpError(404, "Allocation not found.")
  }

  await createAllocationAdjustmentVoucher(access, {
    kind,
    document,
    amountCents: toCents(allocation.allocatedAmount),
    mode: "remove",
    reason,
  })
  await refreshMoneyDocumentAllocationProjection(access.business.id, kind, documentId)
  await refreshTransactionDocumentSettlements(
    access.business.id,
    allocation.receivablePayableEntryId ? [allocation.receivablePayableEntryId] : []
  )
  await insertAuditLog(access, kind, documentId, "ALLOCATION_REVERSED", allocation, null)
}

async function reverseMoneyDocument(
  access: BusinessAccess,
  kind: MoneyDocumentKind,
  documentId: string,
  reason: string
) {
  const document = await requireMoneyDocument(access.business.id, kind, documentId)

  if (document.status !== "posted" || !document.voucherId) {
    throw new HttpError(409, `Only posted ${kind}s can be reversed.`)
  }

  const entryIds = await reverseActiveAllocationsForVoucher(
    access.business.id,
    document.voucherId,
    access.userId,
    reason
  )
  await reverseRelatedAdjustmentVouchers(access, document.voucherId, reason)
  await createReversalVoucher(access, document.voucherId, reason)

  const table = kind === "receipt" ? receipts : paymentDocuments
  const [reversedDocument] = await db
    .update(table)
    .set({
      status: "reversed",
      reversedBy: access.userId,
      reversedAt: new Date(),
      reversalReason: reason,
      allocatedAmount: "0.00",
      unallocatedAmount: document.amount,
      updatedAt: new Date(),
    })
    .where(and(eq(table.businessId, access.business.id), eq(table.id, documentId)))
    .returning()

  if (!reversedDocument) {
    throw new HttpError(500, `Unable to reverse ${kind}.`)
  }

  await db
    .update(vouchers)
    .set({
      status: "reversed",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(vouchers.businessId, access.business.id), eq(vouchers.id, document.voucherId))
    )

  await refreshTransactionDocumentSettlements(access.business.id, entryIds)
  await insertAuditLog(access, kind, documentId, "REVERSED", document, reversedDocument)
}

async function listMoneyDocuments(
  businessId: string,
  kind: MoneyDocumentKind,
  query: ListMoneyDocumentsQueryInput
) {
  const table = kind === "receipt" ? receipts : paymentDocuments
  const dateColumn = kind === "receipt" ? receipts.receiptDate : paymentDocuments.paymentDate
  const numberColumn =
    kind === "receipt" ? receipts.receiptNumber : paymentDocuments.paymentNumber
  const conditions: SQL[] = [eq(table.businessId, businessId)]

  if (query.status !== "all") {
    conditions.push(eq(table.status, query.status))
  }

  if (query.paymentMethod !== "all") {
    conditions.push(eq(table.paymentMethod, query.paymentMethod))
  }

  if (query.from) {
    conditions.push(drizzleSql`${dateColumn} >= ${query.from}`)
  }

  if (query.to) {
    conditions.push(drizzleSql`${dateColumn} <= ${query.to}`)
  }

  if (query.search) {
    const term = `%${escapeLikeTerm(query.search)}%`
    const search = or(
      ilike(numberColumn, term),
      ilike(table.partyNameSnapshot, term),
      ilike(table.referenceNumber, term)
    )

    if (search) {
      conditions.push(search)
    }
  }

  const [{ count = 0 } = {}] = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(table)
    .where(and(...conditions))
  const offset = (query.page - 1) * query.limit
  const documents = await db
    .select()
    .from(table)
    .where(and(...conditions))
    .orderBy(desc(dateColumn), desc(table.createdAt))
    .limit(query.limit)
    .offset(offset)

  return {
    [kind === "receipt" ? "receipts" : "payments"]: documents,
    pagination: createPaginationMeta(query.page, query.limit, count),
  }
}

async function listReceivablePayableEntries(
  businessId: string,
  entryType: AllocationTargetType,
  query: ListReceivablePayableQueryInput
) {
  const offset = (query.page - 1) * query.limit
  const search = query.search.trim()
  const rows = await sql<ReceivablePayableListRow[]>`
    select
      entry.id,
      entry.business_id as "businessId",
      entry.voucher_id as "voucherId",
      entry.party_id as "partyId",
      entry.party_name_snapshot as "partyNameSnapshot",
      entry.party_snapshot as "partySnapshot",
      entry.entry_type as "entryType",
      entry.original_amount::text as "originalAmount",
      entry.adjustment_amount::text as "adjustmentAmount",
      entry.effective_amount::text as "effectiveAmount",
      entry.settled_amount::text as "settledAmount",
      entry.outstanding_amount::text as "outstandingAmount",
      entry.excess_settled_amount::text as "excessSettledAmount",
      entry.due_date as "dueDate",
      entry.status,
      entry.created_at as "createdAt",
      voucher.voucher_number as "voucherNumber",
      voucher.voucher_date as "voucherDate",
      voucher.voucher_type as "voucherType"
    from public.receivable_payable_entries entry
    inner join public.vouchers voucher
      on voucher.id = entry.voucher_id
    where entry.business_id = ${businessId}
      and entry.entry_type = ${entryType}
      and (${query.status}::text = 'all' or entry.status = ${query.status})
      and (${query.partyId ?? null}::uuid is null or entry.party_id = ${query.partyId ?? null}::text)
      and (${query.from ?? null}::text is null or voucher.voucher_date >= ${query.from ?? null}::text)
      and (${query.to ?? null}::text is null or voucher.voucher_date <= ${query.to ?? null}::text)
      and (
        ${search}::text = ''
        or entry.party_name_snapshot ilike ${`%${escapeLikeTerm(search)}%`}
        or voucher.voucher_number ilike ${`%${escapeLikeTerm(search)}%`}
      )
    order by
      case when entry.status in ('open', 'partially_settled') then 0 else 1 end,
      coalesce(entry.due_date, voucher.voucher_date) asc,
      entry.created_at desc
    limit ${query.limit}
    offset ${offset}
  `
  const [countRow] = await sql<Array<{ count: number }>>`
    select count(*)::int as count
    from public.receivable_payable_entries entry
    inner join public.vouchers voucher
      on voucher.id = entry.voucher_id
    where entry.business_id = ${businessId}
      and entry.entry_type = ${entryType}
      and (${query.status}::text = 'all' or entry.status = ${query.status})
      and (${query.partyId ?? null}::uuid is null or entry.party_id = ${query.partyId ?? null}::text)
      and (${query.from ?? null}::text is null or voucher.voucher_date >= ${query.from ?? null}::text)
      and (${query.to ?? null}::text is null or voucher.voucher_date <= ${query.to ?? null}::text)
      and (
        ${search}::text = ''
        or entry.party_name_snapshot ilike ${`%${escapeLikeTerm(search)}%`}
        or voucher.voucher_number ilike ${`%${escapeLikeTerm(search)}%`}
      )
  `
  const totals = rows.reduce(
    (current, row) => ({
      original: current.original + toCents(row.originalAmount),
      settled: current.settled + toCents(row.settledAmount),
      outstanding: current.outstanding + toCents(row.outstandingAmount),
    }),
    { original: 0, settled: 0, outstanding: 0 }
  )

  return {
    entries: rows,
    totals: {
      original: formatCents(totals.original),
      settled: formatCents(totals.settled),
      outstanding: formatCents(totals.outstanding),
    },
    pagination: createPaginationMeta(query.page, query.limit, countRow?.count ?? 0),
  }
}

async function getAgingReport(businessId: string, query: AgingReportQueryInput) {
  const rows = await sql<AgingReportEntryRow[]>`
    select
      coalesce(entry.due_date, voucher.voucher_date)::date::text as "periodDate",
      entry.outstanding_amount::text as outstanding
    from public.receivable_payable_entries entry
    inner join public.vouchers voucher
      on voucher.id = entry.voucher_id
    where entry.business_id = ${businessId}
      and entry.entry_type = ${query.entryType}
      and entry.status in ('open', 'partially_settled')
      and entry.outstanding_amount > 0
      and (${query.from ?? null}::text is null or coalesce(entry.due_date, voucher.voucher_date)::date >= ${query.from ?? null}::date)
      and (${query.to ?? null}::text is null or coalesce(entry.due_date, voucher.voucher_date)::date <= ${query.to ?? null}::date)
    order by coalesce(entry.due_date, voucher.voucher_date)::date asc
  `
  const range = resolveAgingReportRange(query, rows)
  const granularity = resolveAgingGranularity(range.from, range.to)
  const periods = buildAgingReportPeriods(rows, range, granularity)
  const totalOutstanding = periods.reduce(
    (total, period) => total + toCents(period.outstanding),
    0
  )

  return {
    entryType: query.entryType,
    granularity,
    periods,
    totals: {
      outstanding: formatCents(totalOutstanding),
      count: periods.reduce((total, period) => total + period.count, 0),
    },
  }
}

async function getCashFlowReport(
  businessId: string,
  query: ReportDateRangeQueryInput
) {
  const rows = await sql<
    Array<{
      direction: "receipt" | "payment"
      paymentMethod: string
      count: number
      amount: string
      allocated: string
      unallocated: string
    }>
  >`
    select
      direction,
      payment_method as "paymentMethod",
      count(*)::int as count,
      coalesce(sum(amount), 0)::text as amount,
      coalesce(sum(allocated_amount), 0)::text as allocated,
      coalesce(sum(unallocated_amount), 0)::text as unallocated
    from (
      select
        'receipt'::text as direction,
        receipt.payment_method,
        receipt.amount,
        receipt.allocated_amount,
        receipt.unallocated_amount,
        receipt.receipt_date as document_date
      from public.receipts receipt
      where receipt.business_id = ${businessId}
        and receipt.status = 'posted'
      union all
      select
        'payment'::text as direction,
        payment.payment_method,
        payment.amount,
        payment.allocated_amount,
        payment.unallocated_amount,
        payment.payment_date as document_date
      from public.payments payment
      where payment.business_id = ${businessId}
        and payment.status = 'posted'
    ) movement
    where (${query.from ?? null}::text is null or movement.document_date >= ${query.from ?? null}::date)
      and (${query.to ?? null}::text is null or movement.document_date <= ${query.to ?? null}::date)
    group by direction, payment_method
    order by direction, payment_method
  `
  const receiptTotal = rows
    .filter((row) => row.direction === "receipt")
    .reduce((total, row) => total + toCents(row.amount), 0)
  const paymentTotal = rows
    .filter((row) => row.direction === "payment")
    .reduce((total, row) => total + toCents(row.amount), 0)

  return {
    rows,
    totals: {
      receipts: formatCents(receiptTotal),
      payments: formatCents(paymentTotal),
      net: formatCents(receiptTotal - paymentTotal),
    },
  }
}

function resolveAgingReportRange(
  query: AgingReportQueryInput,
  rows: AgingReportEntryRow[]
) {
  const rowDates = rows
    .map((row) => row.periodDate)
    .filter(Boolean)
    .sort()
  const today = formatDateOnly(new Date())
  const from = query.from ?? rowDates[0] ?? query.to ?? today
  const to = query.to ?? rowDates[rowDates.length - 1] ?? query.from ?? today

  return from <= to ? { from, to } : { from: to, to: from }
}

function resolveAgingGranularity(from: string, to: string): AgingGranularity {
  return differenceInCalendarDays(from, to) <= 31 ? "day" : "month"
}

function buildAgingReportPeriods(
  rows: AgingReportEntryRow[],
  range: { from: string; to: string },
  granularity: AgingGranularity
): AgingReportPeriod[] {
  const aggregateByPeriod = new Map<string, { count: number; outstandingCents: number }>()

  for (const row of rows) {
    const periodKey = getAgingPeriodKey(row.periodDate, granularity)
    const current = aggregateByPeriod.get(periodKey) ?? {
      count: 0,
      outstandingCents: 0,
    }

    current.count += 1
    current.outstandingCents += toCents(row.outstanding)
    aggregateByPeriod.set(periodKey, current)
  }

  return getAgingPeriodKeys(range, granularity).map((periodKey) => {
    const aggregate = aggregateByPeriod.get(periodKey)
    const periodBounds = getAgingPeriodBounds(periodKey, range, granularity)

    return {
      periodStart: periodBounds.start,
      periodEnd: periodBounds.end,
      label: formatAgingPeriodLabel(periodKey, granularity),
      count: aggregate?.count ?? 0,
      outstanding: formatCents(aggregate?.outstandingCents ?? 0),
    }
  })
}

function getAgingPeriodKeys(
  range: { from: string; to: string },
  granularity: AgingGranularity
) {
  const keys: string[] = []
  let cursor =
    granularity === "day" ? parseDateOnly(range.from) : startOfMonth(parseDateOnly(range.from))
  const end = parseDateOnly(range.to)

  while (cursor <= end) {
    keys.push(formatDateOnly(cursor))
    cursor = granularity === "day" ? addDays(cursor, 1) : addMonths(cursor, 1)
  }

  return keys
}

function getAgingPeriodKey(dateValue: string, granularity: AgingGranularity) {
  const date = parseDateOnly(dateValue)
  return formatDateOnly(granularity === "day" ? date : startOfMonth(date))
}

function getAgingPeriodBounds(
  periodKey: string,
  range: { from: string; to: string },
  granularity: AgingGranularity
) {
  if (granularity === "day") {
    return { start: periodKey, end: periodKey }
  }

  const periodStart = parseDateOnly(periodKey)
  const periodEnd = addDays(addMonths(periodStart, 1), -1)
  const rangeStart = parseDateOnly(range.from)
  const rangeEnd = parseDateOnly(range.to)

  return {
    start: formatDateOnly(periodStart < rangeStart ? rangeStart : periodStart),
    end: formatDateOnly(periodEnd > rangeEnd ? rangeEnd : periodEnd),
  }
}

function formatAgingPeriodLabel(periodKey: string, granularity: AgingGranularity) {
  const date = parseDateOnly(periodKey)

  return new Intl.DateTimeFormat("en-IN", {
    day: granularity === "day" ? "2-digit" : undefined,
    month: "short",
    year: granularity === "month" ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(date)
}

function differenceInCalendarDays(from: string, to: string) {
  const fromTime = parseDateOnly(from).getTime()
  const toTime = parseDateOnly(to).getTime()
  const dayMs = 24 * 60 * 60 * 1000

  return Math.abs(Math.round((toTime - fromTime) / dayMs)) + 1
}

function parseDateOnly(value: string) {
  const [year = "0", month = "1", day = "1"] = value.split("-")
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}

function formatDateOnly(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)
  return nextDate
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date)
  nextDate.setUTCMonth(nextDate.getUTCMonth() + months)
  return nextDate
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

async function listBankReconciliationItems(
  businessId: string,
  query: BankReconciliationQueryInput
) {
  const search = query.search.trim()
  const rows = await sql<
    Array<{
      documentType: "receipt" | "payment"
      documentId: string
      documentNumber: string
      documentDate: string
      partyName: string
      paymentMethod: string
      amount: string
      referenceNumber: string | null
      cashBankAccountId: string
      matchId: string | null
      statementDate: string | null
      bankReference: string | null
      notes: string | null
      reconciledAt: Date | null
    }>
  >`
    with bank_documents as (
      select
        'receipt'::text as document_type,
        receipt.id as document_id,
        receipt.receipt_number as document_number,
        receipt.receipt_date as document_date,
        receipt.party_name_snapshot as party_name,
        receipt.payment_method,
        receipt.amount,
        receipt.reference_number,
        receipt.cash_bank_account_id
      from public.receipts receipt
      where receipt.business_id = ${businessId}
        and receipt.status = 'posted'
        and receipt.payment_method <> 'cash'
      union all
      select
        'payment'::text as document_type,
        payment.id as document_id,
        payment.payment_number as document_number,
        payment.payment_date as document_date,
        payment.party_name_snapshot as party_name,
        payment.payment_method,
        payment.amount,
        payment.reference_number,
        payment.cash_bank_account_id
      from public.payments payment
      where payment.business_id = ${businessId}
        and payment.status = 'posted'
        and payment.payment_method <> 'cash'
    )
    select
      document.document_type as "documentType",
      document.document_id as "documentId",
      document.document_number as "documentNumber",
      document.document_date::text as "documentDate",
      document.party_name as "partyName",
      document.payment_method as "paymentMethod",
      document.amount::text as amount,
      document.reference_number as "referenceNumber",
      document.cash_bank_account_id as "cashBankAccountId",
      match.id as "matchId",
      match.statement_date::text as "statementDate",
      match.bank_reference as "bankReference",
      match.notes,
      match.reconciled_at as "reconciledAt"
    from bank_documents document
    left join public.bank_reconciliation_matches match
      on match.business_id = ${businessId}
      and (
        (document.document_type = 'receipt' and match.receipt_id = document.document_id)
        or
        (document.document_type = 'payment' and match.payment_id = document.document_id)
      )
    where (${query.status}::text = 'all'
        or (${query.status}::text = 'reconciled' and match.id is not null)
        or (${query.status}::text = 'unmatched' and match.id is null))
      and (${query.accountId ?? null}::uuid is null or document.cash_bank_account_id = ${query.accountId ?? null})
      and (${query.from ?? null}::text is null or document.document_date >= ${query.from ?? null}::date)
      and (${query.to ?? null}::text is null or document.document_date <= ${query.to ?? null}::date)
      and (
        ${search}::text = ''
        or document.document_number ilike ${`%${escapeLikeTerm(search)}%`}
        or document.party_name ilike ${`%${escapeLikeTerm(search)}%`}
        or document.reference_number ilike ${`%${escapeLikeTerm(search)}%`}
        or match.bank_reference ilike ${`%${escapeLikeTerm(search)}%`}
      )
    order by document.document_date desc, document.document_number desc
  `
  const reconciledAmount = rows
    .filter((row) => row.matchId)
    .reduce((total, row) => total + toCents(row.amount), 0)
  const unmatchedAmount = rows
    .filter((row) => !row.matchId)
    .reduce((total, row) => total + toCents(row.amount), 0)

  return {
    items: rows,
    totals: {
      reconciled: formatCents(reconciledAmount),
      unmatched: formatCents(unmatchedAmount),
      count: rows.length,
    },
  }
}

async function exportMoneyDocuments(
  businessId: string,
  kind: MoneyDocumentKind,
  query: ListMoneyDocumentsQueryInput
): Promise<CsvExportResponse> {
  const response = await listMoneyDocuments(businessId, kind, {
    ...query,
    page: 1,
    limit: 5_000,
  })
  const documents = (
    kind === "receipt" ? response.receipts : response.payments
  ) as MoneyDocumentRecord[]

  return createCsvExport(
    `${kind}s-${new Date().toISOString().slice(0, 10)}.csv`,
    [
      "Number",
      "Party",
      "Date",
      "Method",
      "Amount",
      "Allocated",
      "Unallocated",
      "Treatment",
      "Reference",
      "Status",
    ],
    documents.map((document) => [
      getDocumentNumber(kind, document),
      document.partyNameSnapshot,
      getDocumentDate(kind, document),
      document.paymentMethod,
      document.amount,
      document.allocatedAmount,
      document.unallocatedAmount,
      document.unallocatedTreatment,
      document.referenceNumber ?? "",
      document.status,
    ])
  )
}

async function exportReceivablePayableEntries(
  businessId: string,
  entryType: AllocationTargetType,
  query: ListReceivablePayableQueryInput
): Promise<CsvExportResponse> {
  const response = await listReceivablePayableEntries(businessId, entryType, {
    ...query,
    page: 1,
    limit: 5_000,
  })

  return createCsvExport(
    `${entryType}s-${new Date().toISOString().slice(0, 10)}.csv`,
    [
      "Party",
      "Voucher",
      "Voucher Date",
      "Voucher Type",
      "Original",
      "Settled",
      "Outstanding",
      "Due Date",
      "Status",
    ],
    response.entries.map((entry) => [
      entry.partyNameSnapshot,
      entry.voucherNumber,
      entry.voucherDate,
      entry.voucherType,
      entry.originalAmount,
      entry.settledAmount,
      entry.outstandingAmount,
      entry.dueDate ?? "",
      entry.status,
    ])
  )
}

async function exportAgingReport(
  businessId: string,
  query: AgingReportQueryInput
): Promise<CsvExportResponse> {
  const report = await getAgingReport(businessId, query)

  return createCsvExport(
    `${query.entryType}-aging-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Period", "Period Start", "Period End", "Count", "Outstanding"],
    report.periods.map((period) => [
      period.label,
      period.periodStart,
      period.periodEnd,
      String(period.count),
      period.outstanding,
    ])
  )
}

async function exportCashFlowReport(
  businessId: string,
  query: ReportDateRangeQueryInput
): Promise<CsvExportResponse> {
  const report = await getCashFlowReport(businessId, query)

  return createCsvExport(
    `cash-flow-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Direction", "Method", "Count", "Amount", "Allocated", "Unallocated"],
    report.rows.map((row) => [
      row.direction,
      row.paymentMethod,
      String(row.count),
      row.amount,
      row.allocated,
      row.unallocated,
    ])
  )
}

function createCsvExport(
  fileName: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): CsvExportResponse {
  return {
    fileName,
    contentType: "text/csv",
    content: [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
      .join("\n"),
  }
}

function escapeCsvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value)
  const escaped = text.replaceAll('"', '""')

  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped
}

async function listBankStatementLines(
  businessId: string,
  query: BankStatementLinesQueryInput
) {
  const offset = (query.page - 1) * query.limit
  const search = query.search.trim()
  const rows = await sql<BankStatementLineRow[]>`
    select
      line.id,
      line.import_id as "importId",
      import.file_name as "fileName",
      line.cash_bank_account_id as "cashBankAccountId",
      line.statement_date::text as "statementDate",
      line.description,
      line.bank_reference as "bankReference",
      line.direction,
      line.amount::text as amount,
      line.match_status as "matchStatus",
      line.matched_receipt_id as "matchedReceiptId",
      line.matched_payment_id as "matchedPaymentId",
      line.matched_at as "matchedAt",
      match.id as "matchId",
      coalesce(receipt.receipt_number, payment.payment_number) as "matchedDocumentNumber",
      case
        when line.matched_receipt_id is not null then 'receipt'
        when line.matched_payment_id is not null then 'payment'
        else null
      end as "matchedDocumentType",
      line.created_at as "createdAt"
    from public.bank_statement_lines line
    inner join public.bank_statement_imports import
      on import.id = line.import_id
      and import.business_id = line.business_id
    left join public.bank_reconciliation_matches match
      on match.statement_line_id = line.id
      and match.business_id = line.business_id
    left join public.receipts receipt
      on receipt.id = line.matched_receipt_id
      and receipt.business_id = line.business_id
    left join public.payments payment
      on payment.id = line.matched_payment_id
      and payment.business_id = line.business_id
    where line.business_id = ${businessId}
      and (${query.status}::text = 'all' or line.match_status = ${query.status})
      and (${query.accountId ?? null}::uuid is null or line.cash_bank_account_id = ${query.accountId ?? null})
      and (${query.importId ?? null}::uuid is null or line.import_id = ${query.importId ?? null})
      and (${query.from ?? null}::text is null or line.statement_date >= ${query.from ?? null}::date)
      and (${query.to ?? null}::text is null or line.statement_date <= ${query.to ?? null}::date)
      and (
        ${search}::text = ''
        or line.description ilike ${`%${escapeLikeTerm(search)}%`}
        or line.bank_reference ilike ${`%${escapeLikeTerm(search)}%`}
        or import.file_name ilike ${`%${escapeLikeTerm(search)}%`}
        or receipt.receipt_number ilike ${`%${escapeLikeTerm(search)}%`}
        or payment.payment_number ilike ${`%${escapeLikeTerm(search)}%`}
      )
    order by line.statement_date desc, line.created_at desc
    limit ${query.limit}
    offset ${offset}
  `
  const [countRow] = await sql<Array<{ count: number }>>`
    select count(*)::int as count
    from public.bank_statement_lines line
    inner join public.bank_statement_imports import
      on import.id = line.import_id
      and import.business_id = line.business_id
    left join public.receipts receipt
      on receipt.id = line.matched_receipt_id
      and receipt.business_id = line.business_id
    left join public.payments payment
      on payment.id = line.matched_payment_id
      and payment.business_id = line.business_id
    where line.business_id = ${businessId}
      and (${query.status}::text = 'all' or line.match_status = ${query.status})
      and (${query.accountId ?? null}::uuid is null or line.cash_bank_account_id = ${query.accountId ?? null})
      and (${query.importId ?? null}::uuid is null or line.import_id = ${query.importId ?? null})
      and (${query.from ?? null}::text is null or line.statement_date >= ${query.from ?? null}::date)
      and (${query.to ?? null}::text is null or line.statement_date <= ${query.to ?? null}::date)
      and (
        ${search}::text = ''
        or line.description ilike ${`%${escapeLikeTerm(search)}%`}
        or line.bank_reference ilike ${`%${escapeLikeTerm(search)}%`}
        or import.file_name ilike ${`%${escapeLikeTerm(search)}%`}
        or receipt.receipt_number ilike ${`%${escapeLikeTerm(search)}%`}
        or payment.payment_number ilike ${`%${escapeLikeTerm(search)}%`}
      )
  `
  const totals = rows.reduce(
    (current, row) => ({
      matched: current.matched + (row.matchStatus === "matched" ? toCents(row.amount) : 0),
      unmatched:
        current.unmatched + (row.matchStatus === "unmatched" ? toCents(row.amount) : 0),
    }),
    { matched: 0, unmatched: 0 }
  )

  return {
    lines: rows,
    totals: {
      matched: formatCents(totals.matched),
      unmatched: formatCents(totals.unmatched),
      count: countRow?.count ?? 0,
    },
    pagination: createPaginationMeta(query.page, query.limit, countRow?.count ?? 0),
  }
}

async function importBankStatement(
  access: BusinessAccess,
  body: BankStatementImportInput
) {
  await requireCashBankAccount(access.business.id, body.cashBankAccountId)
  const parsedLines = parseBankStatementCsv(body.csvText)

  if (parsedLines.length === 0) {
    throw new HttpError(400, "No valid bank statement rows were found.")
  }

  const statementDates = parsedLines.map((line) => line.statementDate).sort()

  return db.transaction(async (tx) => {
    const [statementImport] = await tx
      .insert(bankStatementImports)
      .values({
        businessId: access.business.id,
        cashBankAccountId: body.cashBankAccountId,
        fileName: body.fileName,
        statementFrom: statementDates[0] ?? null,
        statementTo: statementDates.at(-1) ?? null,
        importedBy: access.userId,
      })
      .returning()

    if (!statementImport) {
      throw new HttpError(500, "Unable to create bank statement import.")
    }

    const lines = await tx
      .insert(bankStatementLines)
      .values(
        parsedLines.map((line) => ({
          businessId: access.business.id,
          importId: statementImport.id,
          cashBankAccountId: body.cashBankAccountId,
          ...line,
        }))
      )
      .returning()

    await tx.insert(auditLogs).values({
      businessId: access.business.id,
      entityType: "bank_statement_import",
      entityId: statementImport.id,
      action: "IMPORTED",
      userId: access.userId,
      before: null,
      after: { import: statementImport, rowCount: lines.length },
      reason: null,
    })

    return {
      import: statementImport,
      imported: lines.length,
    }
  })
}

async function autoMatchBankStatementLines(
  access: BusinessAccess,
  body: BankAutoMatchInput
) {
  const lines = await sql<
    Array<{
      id: string
      cashBankAccountId: string
      statementDate: string
      bankReference: string | null
      direction: BankStatementDirection
      amount: string
    }>
  >`
    select
      id,
      cash_bank_account_id as "cashBankAccountId",
      statement_date::text as "statementDate",
      bank_reference as "bankReference",
      direction,
      amount::text as amount
    from public.bank_statement_lines
    where business_id = ${access.business.id}
      and match_status = 'unmatched'
      and (${body.importId ?? null}::uuid is null or import_id = ${body.importId ?? null})
      and (${body.cashBankAccountId ?? null}::uuid is null or cash_bank_account_id = ${body.cashBankAccountId ?? null})
    order by statement_date asc, created_at asc
  `
  const matches = []
  let skipped = 0

  for (const line of lines) {
    const candidates = await findBankDocumentCandidates(
      access.business.id,
      line,
      body.dateToleranceDays
    )

    if (candidates.length !== 1) {
      skipped += 1
      continue
    }

    const [candidate] = candidates

    if (!candidate) {
      skipped += 1
      continue
    }

    const match = await reconcileBankDocument(access, {
      documentType: candidate.documentType,
      documentId: candidate.documentId,
      statementLineId: line.id,
      statementDate: line.statementDate,
      bankReference: line.bankReference ?? candidate.referenceNumber ?? null,
      notes: "Auto-matched from imported bank statement.",
    })

    matches.push({
      statementLineId: line.id,
      documentType: candidate.documentType,
      documentId: candidate.documentId,
      documentNumber: candidate.documentNumber,
      matchId: match.id,
    })
  }

  return {
    matched: matches.length,
    skipped,
    matches,
  }
}

async function findBankDocumentCandidates(
  businessId: string,
  line: {
    cashBankAccountId: string
    statementDate: string
    bankReference: string | null
    direction: BankStatementDirection
    amount: string
  },
  dateToleranceDays: number
) {
  const rows = await sql<BankDocumentCandidate[]>`
    with candidates as (
      select
        'receipt'::text as "documentType",
        receipt.id as "documentId",
        receipt.receipt_number as "documentNumber",
        receipt.receipt_date::text as "documentDate",
        receipt.amount::text as amount,
        receipt.reference_number as "referenceNumber"
      from public.receipts receipt
      left join public.bank_reconciliation_matches match
        on match.receipt_id = receipt.id
        and match.business_id = receipt.business_id
      where ${line.direction}::text = 'credit'
        and receipt.business_id = ${businessId}
        and receipt.status = 'posted'
        and receipt.payment_method <> 'cash'
        and receipt.cash_bank_account_id = ${line.cashBankAccountId}
        and receipt.amount = ${line.amount}::numeric
        and abs(receipt.receipt_date - ${line.statementDate}::date) <= ${dateToleranceDays}
        and match.id is null
        and (${line.bankReference ?? null}::text is null or receipt.reference_number = ${line.bankReference ?? null})
      union all
      select
        'payment'::text as "documentType",
        payment.id as "documentId",
        payment.payment_number as "documentNumber",
        payment.payment_date::text as "documentDate",
        payment.amount::text as amount,
        payment.reference_number as "referenceNumber"
      from public.payments payment
      left join public.bank_reconciliation_matches match
        on match.payment_id = payment.id
        and match.business_id = payment.business_id
      where ${line.direction}::text = 'debit'
        and payment.business_id = ${businessId}
        and payment.status = 'posted'
        and payment.payment_method <> 'cash'
        and payment.cash_bank_account_id = ${line.cashBankAccountId}
        and payment.amount = ${line.amount}::numeric
        and abs(payment.payment_date - ${line.statementDate}::date) <= ${dateToleranceDays}
        and match.id is null
        and (${line.bankReference ?? null}::text is null or payment.reference_number = ${line.bankReference ?? null})
    )
    select *
    from candidates
    order by "documentDate" asc, "documentNumber" asc
    limit 2
  `

  return rows
}

function parseBankStatementCsv(csvText: string): ParsedBankStatementLine[] {
  const csvRows = parseCsvRows(csvText)

  if (csvRows.length < 2) {
    throw new HttpError(400, "Bank statement CSV must include a header and at least one row.")
  }

  const headerRow = csvRows[0]

  if (!headerRow) {
    throw new HttpError(400, "Bank statement CSV header is missing.")
  }

  const headers = headerRow.map(normalizeCsvHeader)
  const rows = csvRows.slice(1)
  const parsedRows: ParsedBankStatementLine[] = []

  rows.forEach((row, rowIndex) => {
    if (row.every((cell) => cell.trim() === "")) {
      return
    }

    const get = (...names: string[]) => {
      for (const name of names) {
        const index = headers.indexOf(name)

        if (index >= 0) {
          return row[index]?.trim() ?? ""
        }
      }

      return ""
    }
    const statementDate = parseStatementDate(
      get("date", "statementdate", "transactiondate", "txndate", "valuedate")
    )
    const description =
      get("description", "narration", "particulars", "details", "remarks") || "Bank line"
    const bankReference =
      get("reference", "ref", "utr", "cheque", "chequeno", "transactionid") || null
    const debit = parseStatementAmount(get("debit", "withdrawal", "paidout"))
    const credit = parseStatementAmount(get("credit", "deposit", "paidin"))
    const rawAmount = parseStatementAmount(get("amount"))
    const directionText = normalizeCsvHeader(get("direction", "type", "drcr"))
    const resolved = resolveStatementDirectionAndAmount({
      debit,
      credit,
      rawAmount,
      directionText,
    })

    if (!statementDate || !resolved) {
      throw new HttpError(
        400,
        `Invalid bank statement row ${rowIndex + 2}. Check date, amount, debit/credit, and direction columns.`
      )
    }

    parsedRows.push({
      statementDate,
      description,
      bankReference,
      direction: resolved.direction,
      amount: formatCents(resolved.amountCents),
    })
  })

  return parsedRows
}

function parseCsvRows(csvText: string) {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ""
  let inQuotes = false

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index]
    const nextChar = csvText[index + 1]

    if (char === '"' && inQuotes && nextChar === '"') {
      currentCell += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell)
      currentCell = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1
      }

      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ""
      continue
    }

    currentCell += char
  }

  currentRow.push(currentCell)
  rows.push(currentRow)

  return rows.filter((row) => row.some((cell) => cell.trim() !== ""))
}

function normalizeCsvHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function parseStatementDate(value: string) {
  const trimmed = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  const slashMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed)

  if (!slashMatch) {
    return null
  }

  const [, day, month, year] = slashMatch

  if (!day || !month || !year) {
    return null
  }

  return `${year}-${dayOrMonth(month)}-${dayOrMonth(day)}`
}

function dayOrMonth(value: string) {
  return value.padStart(2, "0")
}

function parseStatementAmount(value: string) {
  const normalized = value.replace(/[₹,\s]/g, "").trim()

  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : null
}

function resolveStatementDirectionAndAmount(input: {
  debit: number | null
  credit: number | null
  rawAmount: number | null
  directionText: string
}) {
  if (input.credit && input.credit > 0) {
    return { direction: "credit" as const, amountCents: toCents(String(input.credit)) }
  }

  if (input.debit && input.debit > 0) {
    return { direction: "debit" as const, amountCents: toCents(String(input.debit)) }
  }

  if (input.rawAmount === null || input.rawAmount === 0) {
    return null
  }

  if (input.rawAmount < 0) {
    return { direction: "debit" as const, amountCents: toCents(String(Math.abs(input.rawAmount))) }
  }

  if (["debit", "dr", "withdrawal", "paidout"].includes(input.directionText)) {
    return { direction: "debit" as const, amountCents: toCents(String(input.rawAmount)) }
  }

  return { direction: "credit" as const, amountCents: toCents(String(input.rawAmount)) }
}

async function reconcileBankDocument(
  access: BusinessAccess,
  body: BankReconciliationInput
) {
  const document = await requireMoneyDocument(
    access.business.id,
    body.documentType,
    body.documentId
  )

  if (document.status !== "posted") {
    throw new HttpError(409, "Only posted money documents can be reconciled.")
  }

  if (document.paymentMethod === "cash") {
    throw new HttpError(400, "Cash documents do not require bank reconciliation.")
  }

  await requireCashBankAccount(access.business.id, document.cashBankAccountId)
  const statementLine =
    body.statementLineId ?
      await requireBankStatementLine(access.business.id, body.statementLineId)
    : null

  if (statementLine) {
    const expectedDirection = body.documentType === "receipt" ? "credit" : "debit"

    if (statementLine.matchStatus === "matched") {
      throw new HttpError(409, "Bank statement line is already matched.")
    }

    if (statementLine.direction !== expectedDirection) {
      throw new HttpError(400, "Bank statement line direction does not match this document.")
    }

    if (statementLine.cashBankAccountId !== document.cashBankAccountId) {
      throw new HttpError(400, "Bank statement line uses a different cash/bank account.")
    }

    if (toCents(statementLine.amount) !== toCents(document.amount)) {
      throw new HttpError(400, "Bank statement line amount does not match this document.")
    }
  }

  return db.transaction(async (tx) => {
    const removedMatches = await tx
      .delete(bankReconciliationMatches)
      .where(
        and(
          eq(bankReconciliationMatches.businessId, access.business.id),
          body.documentType === "receipt" ?
            eq(bankReconciliationMatches.receiptId, body.documentId)
          : eq(bankReconciliationMatches.paymentId, body.documentId)
        )
      )
      .returning()

    const removedStatementLineIds = uniqueStrings(
      removedMatches.map((match) => match.statementLineId)
    )

    if (removedStatementLineIds.length > 0) {
      await tx
        .update(bankStatementLines)
        .set({
          matchStatus: "unmatched",
          matchedReceiptId: null,
          matchedPaymentId: null,
          matchedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bankStatementLines.businessId, access.business.id),
            inArray(bankStatementLines.id, removedStatementLineIds)
          )
        )
    }

    const [match] = await tx
      .insert(bankReconciliationMatches)
      .values({
        businessId: access.business.id,
        receiptId: body.documentType === "receipt" ? body.documentId : null,
        paymentId: body.documentType === "payment" ? body.documentId : null,
        statementLineId: body.statementLineId ?? null,
        cashBankAccountId: document.cashBankAccountId,
        statementDate: body.statementDate,
        bankReference: body.bankReference ?? document.referenceNumber ?? null,
        notes: body.notes ?? null,
        reconciledBy: access.userId,
      })
      .returning()

    if (!match) {
      throw new HttpError(500, "Unable to reconcile bank document.")
    }

    if (body.statementLineId) {
      await tx
        .update(bankStatementLines)
        .set({
          matchStatus: "matched",
          matchedReceiptId: body.documentType === "receipt" ? body.documentId : null,
          matchedPaymentId: body.documentType === "payment" ? body.documentId : null,
          matchedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bankStatementLines.businessId, access.business.id),
            eq(bankStatementLines.id, body.statementLineId)
          )
        )
    }

    await tx.insert(auditLogs).values({
      businessId: access.business.id,
      entityType: "bank_reconciliation",
      entityId: match.id,
      action: "RECONCILED",
      userId: access.userId,
      before: null,
      after: match,
      reason: body.notes ?? null,
    })

    return match
  })
}

async function unreconcileBankDocument(access: BusinessAccess, matchId: string) {
  const [match] = await db
    .delete(bankReconciliationMatches)
    .where(
      and(
        eq(bankReconciliationMatches.businessId, access.business.id),
        eq(bankReconciliationMatches.id, matchId)
      )
    )
    .returning()

  if (!match) {
    throw new HttpError(404, "Bank reconciliation match not found.")
  }

  if (match.statementLineId) {
    await db
      .update(bankStatementLines)
      .set({
        matchStatus: "unmatched",
        matchedReceiptId: null,
        matchedPaymentId: null,
        matchedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bankStatementLines.businessId, access.business.id),
          eq(bankStatementLines.id, match.statementLineId)
        )
      )
  }

  await insertAuditLog(access, "payment", matchId, "BANK_UNRECONCILED", match, null)
}

async function requireBankStatementLine(businessId: string, lineId: string) {
  const line = await db.query.bankStatementLines.findFirst({
    where: and(
      eq(bankStatementLines.businessId, businessId),
      eq(bankStatementLines.id, lineId)
    ),
  })

  if (!line) {
    throw new HttpError(404, "Bank statement line not found.")
  }

  return line
}

async function getMoneyDocumentDetail(
  businessId: string,
  kind: MoneyDocumentKind,
  documentId: string
) {
  const document = await requireMoneyDocument(businessId, kind, documentId)
  const allocations =
    document.voucherId ?
      await db
        .select({
          allocation: paymentAllocations,
          entry: receivablePayableEntries,
          voucher: vouchers,
        })
        .from(paymentAllocations)
        .innerJoin(
          receivablePayableEntries,
          eq(receivablePayableEntries.id, paymentAllocations.receivablePayableEntryId)
        )
        .innerJoin(vouchers, eq(vouchers.id, paymentAllocations.documentVoucherId))
        .where(
          and(
            eq(paymentAllocations.businessId, businessId),
            eq(paymentAllocations.paymentVoucherId, document.voucherId)
          )
        )
    : []

  return {
    ...document,
    allocations: allocations.map((row) => ({
      ...row.allocation,
      target: {
        id: row.entry.id,
        entryType: row.entry.entryType,
        originalAmount: row.entry.originalAmount,
        settledAmount: row.entry.settledAmount,
        outstandingAmount: row.entry.outstandingAmount,
        status: row.entry.status,
        voucherId: row.voucher.id,
        voucherNumber: row.voucher.voucherNumber,
        voucherDate: row.voucher.voucherDate,
        voucherType: row.voucher.voucherType,
      },
    })),
  }
}

async function requireMoneyDocument(
  businessId: string,
  kind: MoneyDocumentKind,
  documentId: string
) {
  const table = kind === "receipt" ? receipts : paymentDocuments
  const [document] = await db
    .select()
    .from(table)
    .where(and(eq(table.businessId, businessId), eq(table.id, documentId)))
    .limit(1)

  if (!document) {
    throw new HttpError(404, `${capitalize(kind)} not found.`)
  }

  return document as MoneyDocumentRecord
}

async function assertPartyCanUseMoney(
  businessId: string,
  partyId: string,
  kind: MoneyDocumentKind
) {
  const profile =
    kind === "receipt" ?
      await db.query.partyCustomerProfiles.findFirst({
        where: and(
          eq(partyCustomerProfiles.businessId, businessId),
          eq(partyCustomerProfiles.partyId, partyId)
        ),
      })
    : await db.query.partySupplierProfiles.findFirst({
        where: and(
          eq(partySupplierProfiles.businessId, businessId),
          eq(partySupplierProfiles.partyId, partyId)
        ),
      })

  if (!profile || profile.status !== "active") {
    throw new HttpError(
      409,
      kind === "receipt" ?
        "Receipts can only be recorded for active customer parties."
      : "Payments can only be recorded for active supplier parties."
    )
  }
}

async function validateAllocations(
  businessId: string,
  partyId: string,
  expectedType: AllocationTargetType,
  allocations: CreateAllocationInput[]
) {
  const ids = uniqueStrings(allocations.map((allocation) => allocation.receivablePayableEntryId))
  const requestedByEntryId = new Map<string, number>()

  for (const allocation of allocations) {
    const cents = toCents(normalizeMoney(allocation.allocatedAmount))

    if (cents <= 0) {
      throw new HttpError(400, "Allocation amount must be greater than zero.")
    }

    requestedByEntryId.set(
      allocation.receivablePayableEntryId,
      (requestedByEntryId.get(allocation.receivablePayableEntryId) ?? 0) + cents
    )
  }

  if (ids.length === 0) {
    return new Map<string, AllocationTarget>()
  }

  const rows = await db
    .select({
      entry: receivablePayableEntries,
      voucherNumber: vouchers.voucherNumber,
      voucherDate: vouchers.voucherDate,
      voucherType: vouchers.voucherType,
    })
    .from(receivablePayableEntries)
    .innerJoin(vouchers, eq(vouchers.id, receivablePayableEntries.voucherId))
    .where(
      and(
        eq(receivablePayableEntries.businessId, businessId),
        inArray(receivablePayableEntries.id, ids)
      )
    )

  if (rows.length !== ids.length) {
    throw new HttpError(400, "One or more allocation targets are invalid.")
  }

  const targets = new Map<string, AllocationTarget>()

  for (const row of rows) {
    if (row.entry.entryType !== expectedType) {
      throw new HttpError(
        400,
        expectedType === "receivable" ?
          "Receipt allocations can only target receivables."
        : "Payment allocations can only target payables."
      )
    }

    if (row.entry.partyId !== partyId) {
      throw new HttpError(400, "Allocation target belongs to a different party.")
    }

    if (["cancelled", "closed", "written_off"].includes(row.entry.status)) {
      throw new HttpError(409, "Closed receivable/payable entries cannot be allocated.")
    }

    const requested = requestedByEntryId.get(row.entry.id) ?? 0
    const outstanding = toCents(row.entry.outstandingAmount)

    if (requested > outstanding) {
      throw new HttpError(409, "Allocation exceeds target outstanding amount.")
    }

    targets.set(row.entry.id, row)
  }

  return targets
}

async function requireCashBankAccount(businessId: string, accountId: string) {
  const account = await db.query.ledgerAccounts.findFirst({
    where: and(eq(ledgerAccounts.businessId, businessId), eq(ledgerAccounts.id, accountId)),
  })

  if (!account) {
    throw new HttpError(404, "Cash or bank ledger account not found.")
  }

  if (
    account.status !== "active" ||
    !account.allowPosting ||
    account.accountType !== "ASSET" ||
    !["CASH", "BANK"].includes(account.accountGroup)
  ) {
    throw new HttpError(400, "Choose an active cash or bank posting account.")
  }

  return account
}

async function ensureMoneyAccountMap(businessId: string) {
  await ensureDefaultLedgerAccountMap(businessId)
  await db
    .insert(ledgerAccounts)
    .values([
      {
        businessId,
        ...customerAdvanceAccount,
        allowPosting: true,
        isSystem: true,
        status: "active",
      },
      {
        businessId,
        ...supplierAdvanceAccount,
        allowPosting: true,
        isSystem: true,
        status: "active",
      },
      {
        businessId,
        ...customerUnappliedAccount,
        allowPosting: true,
        isSystem: true,
        status: "active",
      },
      {
        businessId,
        ...supplierUnappliedAccount,
        allowPosting: true,
        isSystem: true,
        status: "active",
      },
    ])
    .onConflictDoNothing()

  const accounts = await db
    .select()
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.businessId, businessId))

  return new Map(accounts.map((account) => [account.accountCode, account]))
}

function buildMoneyJournalLines(input: {
  kind: MoneyDocumentKind
  amountCents: number
  allocatedCents: number
  unallocatedCents: number
  unallocatedTreatment: UnallocatedTreatment
  cashBankAccount: LedgerAccountRecord
  accountMap: Map<string, LedgerAccountRecord>
  branchId: string | null
  gstRegistrationId: string | null
}) {
  const lines = []
  const arAccount = getAccount(input.accountMap, "1130")
  const apAccount = getAccount(input.accountMap, "2110")
  const customerHolding = getReceiptHoldingAccount(
    input.accountMap,
    input.unallocatedTreatment
  )
  const supplierHolding = getPaymentHoldingAccount(
    input.accountMap,
    input.unallocatedTreatment
  )

  if (input.kind === "receipt") {
    lines.push(
      toJournalLine(input.cashBankAccount, input.amountCents, 0, "Money received", input)
    )

    if (input.allocatedCents > 0) {
      lines.push(
        toJournalLine(arAccount, 0, input.allocatedCents, "Receivable settled", input)
      )
    }

    if (input.unallocatedCents > 0) {
      lines.push(
        toJournalLine(
          customerHolding,
          0,
          input.unallocatedCents,
          input.unallocatedTreatment === "advance" ?
            "Customer advance received"
          : "Unapplied customer receipt",
          input
        )
      )
    }
  } else {
    if (input.allocatedCents > 0) {
      lines.push(toJournalLine(apAccount, input.allocatedCents, 0, "Payable settled", input))
    }

    if (input.unallocatedCents > 0) {
      lines.push(
        toJournalLine(
          supplierHolding,
          input.unallocatedCents,
          0,
          input.unallocatedTreatment === "advance" ?
            "Supplier advance paid"
          : "Unapplied supplier payment",
          input
        )
      )
    }

    lines.push(
      toJournalLine(input.cashBankAccount, 0, input.amountCents, "Money paid", input)
    )
  }

  return lines
}

function toJournalLine(
  account: LedgerAccountRecord,
  debitCents: number,
  creditCents: number,
  narration: string,
  context: { branchId: string | null; gstRegistrationId: string | null }
) {
  return {
    accountId: account.id,
    accountCode: account.accountCode,
    accountName: account.accountName,
    debit: formatCents(debitCents),
    credit: formatCents(creditCents),
    narration,
    branchId: context.branchId,
    gstRegistrationId: context.gstRegistrationId,
    warehouseId: null,
  }
}

function getAccount(accountMap: Map<string, LedgerAccountRecord>, accountCode: string) {
  const account = accountMap.get(accountCode)

  if (!account) {
    throw new HttpError(500, `Ledger account ${accountCode} is not configured.`)
  }

  return account
}

function getReceiptHoldingAccount(
  accountMap: Map<string, LedgerAccountRecord>,
  treatment: UnallocatedTreatment
) {
  return getAccount(
    accountMap,
    treatment === "advance" ?
      customerAdvanceAccount.accountCode
    : customerUnappliedAccount.accountCode
  )
}

function getPaymentHoldingAccount(
  accountMap: Map<string, LedgerAccountRecord>,
  treatment: UnallocatedTreatment
) {
  return getAccount(
    accountMap,
    treatment === "advance" ?
      supplierAdvanceAccount.accountCode
    : supplierUnappliedAccount.accountCode
  )
}

async function sumActiveAllocationsForVoucher(businessId: string, voucherId: string) {
  const [row] = await db
    .select({
      total: drizzleSql<string>`coalesce(sum(${paymentAllocations.allocatedAmount}), 0)::text`,
    })
    .from(paymentAllocations)
    .where(
      and(
        eq(paymentAllocations.businessId, businessId),
        eq(paymentAllocations.paymentVoucherId, voucherId),
        eq(paymentAllocations.status, "active")
      )
    )

  return toCents(row?.total ?? "0.00")
}

async function refreshMoneyDocumentAllocationProjection(
  businessId: string,
  kind: MoneyDocumentKind,
  documentId: string
) {
  const document = await requireMoneyDocument(businessId, kind, documentId)

  if (!document.voucherId) {
    return
  }

  const allocatedCents = await sumActiveAllocationsForVoucher(businessId, document.voucherId)
  const amountCents = toCents(document.amount)
  const table = kind === "receipt" ? receipts : paymentDocuments

  await db
    .update(table)
    .set({
      allocatedAmount: formatCents(allocatedCents),
      unallocatedAmount: formatCents(Math.max(amountCents - allocatedCents, 0)),
      updatedAt: new Date(),
    })
    .where(and(eq(table.businessId, businessId), eq(table.id, documentId)))
}

async function refreshTransactionDocumentSettlements(
  businessId: string,
  entryIds: string[]
) {
  const uniqueIds = uniqueStrings(entryIds)

  if (uniqueIds.length === 0) {
    return
  }

  const rows = await db
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

  const allocationRows = await db
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

  const allocatedByEntryId = new Map<string, number>()

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

  const adjustmentRows = await db
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

  const adjustedByEntryId = new Map<string, number>()

  for (const row of adjustmentRows) {
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

    await db
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

    await db
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

    await db
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

async function reverseActiveAllocationsForVoucher(
  businessId: string,
  voucherId: string,
  userId: string,
  reason: string
) {
  const reversed = await db
    .update(paymentAllocations)
    .set({
      status: "reversed",
      reversedBy: userId,
      reversedAt: new Date(),
      reversalReason: reason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentAllocations.businessId, businessId),
        eq(paymentAllocations.paymentVoucherId, voucherId),
        eq(paymentAllocations.status, "active")
      )
    )
    .returning({ entryId: paymentAllocations.receivablePayableEntryId })

  return uniqueStrings(reversed.map((row) => row.entryId))
}

async function createAllocationAdjustmentVoucher(
  access: BusinessAccess,
  input: {
    kind: MoneyDocumentKind
    document: MoneyDocumentRecord
    amountCents: number
    mode: "apply" | "remove"
    reason: string
  }
) {
  if (!input.document.voucherId || input.amountCents <= 0) {
    return
  }

  const originalVoucher = await db.query.vouchers.findFirst({
    where: and(
      eq(vouchers.businessId, access.business.id),
      eq(vouchers.id, input.document.voucherId)
    ),
  })

  if (!originalVoucher) {
    throw new HttpError(404, "Original voucher not found.")
  }

  const accountMap = await ensureMoneyAccountMap(access.business.id)
  const lines = buildAllocationAdjustmentLines({
    kind: input.kind,
    mode: input.mode,
    amountCents: input.amountCents,
    unallocatedTreatment: getDocumentUnallocatedTreatment(input.document),
    accountMap,
    branchId: originalVoucher.branchId,
    gstRegistrationId: originalVoucher.gstRegistrationId,
  })
  const voucherNumber = `ADJ-${originalVoucher.voucherNumber}-${randomUUID().slice(0, 6).toUpperCase()}`

  await db.transaction(async (tx) => {
    const [voucher] = await tx
      .insert(vouchers)
      .values({
        businessId: access.business.id,
        gstRegistrationId: originalVoucher.gstRegistrationId,
        branchId: originalVoucher.branchId,
        warehouseId: originalVoucher.warehouseId,
        voucherType: "JOURNAL",
        voucherNumber,
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
        notes: input.reason,
      })
      .returning()

    if (!voucher) {
      throw new HttpError(500, "Unable to create allocation adjustment voucher.")
    }

    const [entry] = await tx
      .insert(journalEntries)
      .values({
        businessId: access.business.id,
        voucherId: voucher.id,
        sourceType:
          input.mode === "apply" ? "ALLOCATION_APPLIED" : "ALLOCATION_REMOVED",
        sourceId: input.document.id,
        entryDate: voucher.voucherDate,
        description:
          input.mode === "apply" ?
            "Allocation applied from advance"
          : "Allocation moved back to advance",
        createdBy: access.userId,
        postedAt: new Date(),
      })
      .returning()

    if (!entry) {
      throw new HttpError(500, "Unable to create allocation adjustment journal.")
    }

    await tx.insert(journalEntryLines).values(
      lines.map((line) => ({
        businessId: access.business.id,
        journalEntryId: entry.id,
        ...line,
      }))
    )
  })
}

function buildAllocationAdjustmentLines(input: {
  kind: MoneyDocumentKind
  mode: "apply" | "remove"
  amountCents: number
  unallocatedTreatment: UnallocatedTreatment
  accountMap: Map<string, LedgerAccountRecord>
  branchId: string | null
  gstRegistrationId: string | null
}) {
  const arAccount = getAccount(input.accountMap, "1130")
  const apAccount = getAccount(input.accountMap, "2110")
  const customerHolding = getReceiptHoldingAccount(
    input.accountMap,
    input.unallocatedTreatment
  )
  const supplierHolding = getPaymentHoldingAccount(
    input.accountMap,
    input.unallocatedTreatment
  )

  if (input.kind === "receipt") {
    return input.mode === "apply" ?
        [
          toJournalLine(
            customerHolding,
            input.amountCents,
            0,
            input.unallocatedTreatment === "advance" ?
              "Customer advance applied"
            : "Unapplied receipt allocated",
            input
          ),
          toJournalLine(arAccount, 0, input.amountCents, "Receivable settled", input),
        ]
      : [
          toJournalLine(arAccount, input.amountCents, 0, "Receivable reopened", input),
          toJournalLine(
            customerHolding,
            0,
            input.amountCents,
            input.unallocatedTreatment === "advance" ?
              "Moved back to customer advance"
            : "Moved back to unapplied receipt",
            input
          ),
        ]
  }

  return input.mode === "apply" ?
      [
        toJournalLine(apAccount, input.amountCents, 0, "Payable settled", input),
        toJournalLine(
          supplierHolding,
          0,
          input.amountCents,
          input.unallocatedTreatment === "advance" ?
            "Supplier advance applied"
          : "Unapplied supplier payment allocated",
          input
        ),
      ]
    : [
        toJournalLine(
          supplierHolding,
          input.amountCents,
          0,
          input.unallocatedTreatment === "advance" ?
            "Moved back to supplier advance"
          : "Moved back to unapplied supplier payment",
          input
        ),
        toJournalLine(apAccount, 0, input.amountCents, "Payable reopened", input),
      ]
}

async function reverseRelatedAdjustmentVouchers(
  access: BusinessAccess,
  originalVoucherId: string,
  reason: string
) {
  const adjustments = await db
    .select({ id: vouchers.id })
    .from(vouchers)
    .where(
      and(
        eq(vouchers.businessId, access.business.id),
        eq(vouchers.referenceVoucherId, originalVoucherId),
        eq(vouchers.voucherType, "JOURNAL"),
        eq(vouchers.status, "posted"),
        ilike(vouchers.voucherNumber, "ADJ-%")
      )
    )

  for (const adjustment of adjustments) {
    await createReversalVoucher(access, adjustment.id, reason)
    await db
      .update(vouchers)
      .set({
        status: "reversed",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(vouchers.businessId, access.business.id), eq(vouchers.id, adjustment.id))
      )
  }
}

async function createReversalVoucher(
  access: BusinessAccess,
  originalVoucherId: string,
  reason: string
) {
  const originalVoucher = await db.query.vouchers.findFirst({
    where: and(
      eq(vouchers.businessId, access.business.id),
      eq(vouchers.id, originalVoucherId)
    ),
  })

  if (!originalVoucher) {
    throw new HttpError(404, "Original voucher not found.")
  }

  const originalEntries = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.voucherId, originalVoucherId))
  const originalEntryIds = originalEntries.map((entry) => entry.id)
  const originalLines =
    originalEntryIds.length > 0 ?
      await db
        .select()
        .from(journalEntryLines)
        .where(inArray(journalEntryLines.journalEntryId, originalEntryIds))
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
        sourceType: "REVERSAL",
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

async function assertCanUseMoney(access: BusinessAccess, action: MoneyAction) {
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
      eq(businessMemberPermissions.module, "accounting"),
      eq(permissionColumn, true)
    ),
  })

  if (!permission) {
    throw new HttpError(403, "You do not have permission to access payments.")
  }
}

async function insertAuditLog(
  access: BusinessAccess,
  kind: MoneyDocumentKind,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown
) {
  await db.insert(auditLogs).values({
    businessId: access.business.id,
    entityType: kind,
    entityId,
    action,
    userId: access.userId,
    before,
    after,
    reason: null,
  })
}

function getDocumentDate(kind: MoneyDocumentKind, document: MoneyDocumentRecord) {
  return kind === "receipt" ?
      (document as ReceiptRecord).receiptDate
    : (document as PaymentRecord).paymentDate
}

function getDocumentNumber(kind: MoneyDocumentKind, document: MoneyDocumentRecord) {
  return kind === "receipt" ?
      (document as ReceiptRecord).receiptNumber
    : (document as PaymentRecord).paymentNumber
}

function getDocumentUnallocatedTreatment(
  document: MoneyDocumentRecord
): UnallocatedTreatment {
  return document.unallocatedTreatment === "unallocated" ? "unallocated" : "advance"
}

function cashBankAccountSnapshot(account: LedgerAccountRecord) {
  return {
    id: account.id,
    accountCode: account.accountCode,
    accountName: account.accountName,
    accountGroup: account.accountGroup,
  }
}

function sumAllocationCents(allocations: CreateAllocationInput[]) {
  return allocations.reduce(
    (total, allocation) => total + toCents(normalizeMoney(allocation.allocatedAmount)),
    0
  )
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function createPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    hasMore: page * limit < total,
  }
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

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`
}
