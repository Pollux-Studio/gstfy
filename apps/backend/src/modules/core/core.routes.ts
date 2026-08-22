import { createHash } from "node:crypto"

import { and, desc, eq, gte, inArray, isNull, lte, sql as drizzleSql } from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { getEnv } from "../../config/env.js"
import { db } from "../../db/client.js"
import {
  accountingPeriods,
  auditLogs,
  branchWarehouses,
  businessInventorySettings,
  businessBranches,
  businessMemberBranches,
  businessMemberPermissions,
  financialYears,
  gstEntries,
  gstRegistrations,
  inventoryBalances,
  inventoryTransactions,
  invoiceSeries,
  journalEntries,
  journalEntryLines,
  ledgerAccounts,
  paymentAllocations,
  postingIdempotencyKeys,
  receivablePayableAdjustmentEffects,
  receivablePayableEntries,
  vouchers,
  warehouses,
  type VoucherRecord,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"
import {
  formatQuantity,
  normalizeInventoryMovementForPosting,
  type NormalizedInventoryMovement,
} from "../inventory/inventory.service.js"
import {
  idParamsSchema,
  listVouchersQuerySchema,
  postVoucherSchema,
  type PostVoucherInput,
  type VoucherType,
} from "./core.schemas.js"
import {
  assertInternalPostingKey,
  formatCents,
  normalizeMoney,
  toCents,
  validateBalancedJournal,
} from "./core.validation.js"

type BusinessAccess = Awaited<ReturnType<typeof requirePrimaryBusinessAccess>>
type CoreDbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

type PostVoucherResult = {
  voucher: {
    id: string
    voucherNumber: string
    voucherType: VoucherType
    voucherDate: string
    status: string
  }
  effects: {
    journalLines: number
    inventoryEntries: number
    gstEntries: number
    receivablePayableEntries: number
    paymentAllocations: number
  }
}

type PostVoucherOptions = {
  beforePost?: (tx: CoreDbTransaction) => Promise<void>
  afterPost?: (context: {
    tx: CoreDbTransaction
    voucher: VoucherRecord
    result: PostVoucherResult
    postedAt: Date
  }) => Promise<void>
}

export async function registerCoreRoutes(app: FastifyInstance) {
  app.get("/core/vouchers", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const query = listVouchersQuerySchema.parse(request.query)
    const [{ count = 0 } = {}] = await db
      .select({ count: drizzleSql<number>`count(*)::int` })
      .from(vouchers)
      .where(eq(vouchers.businessId, access.business.id))
    const offset = (query.page - 1) * query.limit
    const rows = await db
      .select({
        id: vouchers.id,
        voucherType: vouchers.voucherType,
        voucherNumber: vouchers.voucherNumber,
        voucherDate: vouchers.voucherDate,
        status: vouchers.status,
        gstRegistrationId: vouchers.gstRegistrationId,
        branchId: vouchers.branchId,
        warehouseId: vouchers.warehouseId,
        financialYearId: vouchers.financialYearId,
        postedAt: vouchers.postedAt,
        createdAt: vouchers.createdAt,
      })
      .from(vouchers)
      .where(eq(vouchers.businessId, access.business.id))
      .orderBy(desc(vouchers.createdAt))
      .limit(query.limit)
      .offset(offset)

    return {
      vouchers: rows,
      pagination: createPaginationMeta(query.page, query.limit, count),
    }
  })

  app.get("/core/vouchers/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const { id } = idParamsSchema.parse(request.params)

    return getVoucherDetail(access.business.id, id)
  })

  app.post("/core/vouchers/post", async (request) => {
    assertInternalPostingKey(
      resolveIdempotencyKey(request.headers["x-gstfy-internal-posting-key"]),
      getEnv().CORE_POSTING_INTERNAL_KEY
    )

    const access = await requirePrimaryBusinessAccess(request)
    const idempotencyKey = resolveIdempotencyKey(request.headers["idempotency-key"])
    const body = postVoucherSchema.parse({
      ...toRecord(request.body),
      idempotencyKey: toRecord(request.body).idempotencyKey ?? idempotencyKey,
    })

    return postVoucher(access, body)
  })
}

function createPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    hasMore: page * limit < total,
  }
}

export async function postVoucher(
  access: BusinessAccess,
  input: PostVoucherInput,
  options: PostVoucherOptions = {}
) {
  const idempotencyKey = input.idempotencyKey

  if (!idempotencyKey) {
    throw new HttpError(400, "Idempotency key is required for posting.")
  }

  validateBalancedJournal(input)
  const normalizedInventoryEntries = normalizeInventoryEntriesForPosting(input)
  const requestHash = createHash("sha256")
    .update(stableStringify({ ...input, idempotencyKey: undefined }))
    .digest("hex")

  await assertCanCreateVoucher(access, input.voucherType)
  await assertBranchScope(access, input.branchId ?? null)

  return db.transaction(async (tx) => {
    const [insertedKey] = await tx
      .insert(postingIdempotencyKeys)
      .values({
        businessId: access.business.id,
        idempotencyKey,
        requestHash,
        status: "in_progress",
      })
      .onConflictDoNothing()
      .returning()

    if (!insertedKey) {
      const existingKey = await tx.query.postingIdempotencyKeys.findFirst({
        where: and(
          eq(postingIdempotencyKeys.businessId, access.business.id),
          eq(postingIdempotencyKeys.idempotencyKey, idempotencyKey)
        ),
      })

      if (!existingKey) {
        throw new HttpError(409, "Posting idempotency state could not be resolved.")
      }

      if (existingKey.requestHash !== requestHash) {
        throw new HttpError(409, "Idempotency key was already used with a different request.")
      }

      if (existingKey.status !== "completed" || !existingKey.responseBody) {
        throw new HttpError(409, "A posting with this idempotency key is still in progress.")
      }

      return existingKey.responseBody as PostVoucherResult
    }

    await assertContextBelongsToBusiness(access.business.id, input)
    await assertAccountingPeriodIsOpen(access.business.id, input)
    await assertEffectReferencesBelongToBusiness(access.business.id, input)
    await options.beforePost?.(tx)

    const voucherNumber = await allocateVoucherNumber(access.business.id, input)
    const postedAt = new Date()
    const [voucher] = await tx
      .insert(vouchers)
      .values({
        businessId: access.business.id,
        gstRegistrationId: input.gstRegistrationId ?? null,
        branchId: input.branchId ?? null,
        warehouseId: input.warehouseId ?? null,
        voucherType: input.voucherType,
        voucherNumber,
        voucherDate: input.voucherDate,
        financialYearId: input.financialYearId,
        status: "posted",
        referenceVoucherId: input.referenceVoucherId ?? null,
        createdBy: access.userId,
        postedBy: access.userId,
        postedAt,
        sellerSnapshot: input.snapshots.seller ?? null,
        branchSnapshot: input.snapshots.branch ?? null,
        partySnapshot: input.snapshots.party ?? null,
        taxSnapshot: input.snapshots.tax ?? null,
        notes: input.notes ?? null,
      })
      .returning()

    if (!voucher) {
      throw new HttpError(500, "Unable to create voucher.")
    }

    const [journalEntry] = await tx
      .insert(journalEntries)
      .values({
        businessId: access.business.id,
        voucherId: voucher.id,
        sourceType: "VOUCHER",
        sourceId: voucher.id,
        entryDate: input.voucherDate,
        description: input.journal.description ?? `${input.voucherType} ${voucherNumber}`,
        createdBy: access.userId,
        postedAt,
      })
      .returning()

    if (!journalEntry) {
      throw new HttpError(500, "Unable to create journal entry.")
    }

    await tx.insert(journalEntryLines).values(
      input.journal.lines.map((line) => ({
        businessId: access.business.id,
        journalEntryId: journalEntry.id,
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        debit: normalizeMoney(line.debit),
        credit: normalizeMoney(line.credit),
        narration: line.narration ?? null,
        branchId: line.branchId ?? input.branchId ?? null,
        gstRegistrationId: line.gstRegistrationId ?? input.gstRegistrationId ?? null,
        warehouseId: line.warehouseId ?? input.warehouseId ?? null,
      }))
    )

    if (normalizedInventoryEntries.length > 0) {
      await applyInventoryBalanceProjection(
        access.business.id,
        normalizedInventoryEntries
      )

      await tx.insert(inventoryTransactions).values(
        normalizedInventoryEntries.map((entry) => ({
          businessId: access.business.id,
          voucherId: voucher.id,
          sourceType: "VOUCHER",
          sourceId: voucher.id,
          branchId: entry.branchId,
          warehouseId: entry.warehouseId,
          itemId: entry.itemId,
          itemNameSnapshot: entry.itemNameSnapshot,
          skuSnapshot: entry.skuSnapshot,
          unitSnapshot: entry.unitSnapshot,
          itemSnapshot: entry.itemSnapshot,
          movementType: entry.movementType,
          quantity: entry.quantity,
          quantityIn: entry.quantityIn,
          quantityOut: entry.quantityOut,
          unit: entry.unit,
          sourceUnit: entry.sourceUnit,
          baseQuantity: entry.baseQuantity,
          unitCost: entry.unitCost,
          totalCost: entry.totalCost,
          inventoryValue: entry.inventoryValue,
          batchId: entry.batchId,
          serialId: entry.serialId,
          batchNumberSnapshot: entry.batchNumberSnapshot,
          serialNumberSnapshot: entry.serialNumberSnapshot,
          transactionDate: entry.transactionDate,
          reason: entry.reason,
          createdBy: access.userId,
        }))
      )
    }

    if (input.gstEntries.length > 0) {
      await tx.insert(gstEntries).values(
        input.gstEntries.map((entry) => ({
          businessId: access.business.id,
          voucherId: voucher.id,
          gstRegistrationId: entry.gstRegistrationId ?? input.gstRegistrationId ?? null,
          branchId: entry.branchId ?? input.branchId ?? null,
          entryType: entry.entryType,
          taxComponent: entry.taxComponent,
          taxRate: normalizeMoney(entry.taxRate),
          taxableValue: normalizeMoney(entry.taxableValue),
          taxAmount: normalizeMoney(entry.taxAmount),
          placeOfSupplyStateCode: entry.placeOfSupplyStateCode ?? null,
          itcEligibility: entry.itcEligibility ?? null,
        }))
      )
    }

    if (input.receivablePayableEntries.length > 0) {
      await tx.insert(receivablePayableEntries).values(
        input.receivablePayableEntries.map((entry) => {
          const originalAmount = normalizeMoney(entry.originalAmount)

          return {
            businessId: access.business.id,
            voucherId: voucher.id,
            partyId: entry.partyId ?? null,
            partyNameSnapshot: entry.partyNameSnapshot,
            partySnapshot: entry.partySnapshot ?? null,
            entryType: entry.entryType,
            originalAmount,
            adjustmentAmount: "0.00",
            effectiveAmount: originalAmount,
            settledAmount: "0.00",
            outstandingAmount: originalAmount,
            excessSettledAmount: "0.00",
            dueDate: entry.dueDate ?? null,
            status: "open",
          }
        })
      )
    }

    if (input.paymentAllocations.length > 0) {
      await validatePaymentAllocations(access.business.id, input.paymentAllocations)

      await tx.insert(paymentAllocations).values(
        input.paymentAllocations.map((allocation) => ({
          businessId: access.business.id,
          paymentVoucherId: voucher.id,
          allocationKind:
            allocation.allocationKind ??
            (input.voucherType === "RECEIPT" ? "receipt" : "payment"),
          receiptId: allocation.receiptId ?? null,
          paymentId: allocation.paymentId ?? null,
          documentVoucherId: allocation.documentVoucherId,
          receivablePayableEntryId: allocation.receivablePayableEntryId,
          allocatedAmount: normalizeMoney(allocation.allocatedAmount),
          status: "active",
          createdBy: access.userId,
        }))
      )

      await refreshReceivablePayableSettlements(
        access.business.id,
        uniqueStrings(
          input.paymentAllocations.map((allocation) => allocation.receivablePayableEntryId)
        )
      )
    }

    const result: PostVoucherResult = {
      voucher: {
        id: voucher.id,
        voucherNumber,
        voucherType: input.voucherType,
        voucherDate: input.voucherDate,
        status: voucher.status,
      },
      effects: {
        journalLines: input.journal.lines.length,
        inventoryEntries: input.inventoryEntries.length,
        gstEntries: input.gstEntries.length,
        receivablePayableEntries: input.receivablePayableEntries.length,
        paymentAllocations: input.paymentAllocations.length,
      },
    }

    await options.afterPost?.({ tx, voucher, result, postedAt })

    await tx.insert(auditLogs).values({
      businessId: access.business.id,
      entityType: "voucher",
      entityId: voucher.id,
      action: "POSTED",
      userId: access.userId,
      before: null,
      after: result,
      reason: input.notes ?? null,
    })

    await tx
      .update(postingIdempotencyKeys)
      .set({
        status: "completed",
        voucherId: voucher.id,
        responseBody: result,
        updatedAt: new Date(),
      })
      .where(eq(postingIdempotencyKeys.id, insertedKey.id))

    return result

    async function validatePaymentAllocations(
      businessId: string,
      allocations: PostVoucherInput["paymentAllocations"]
    ) {
      const entryIds = uniqueStrings(
        allocations.map((allocation) => allocation.receivablePayableEntryId)
      )

      const rows = await tx
        .select({
          id: receivablePayableEntries.id,
          voucherId: receivablePayableEntries.voucherId,
          originalAmount: receivablePayableEntries.originalAmount,
          status: receivablePayableEntries.status,
        })
        .from(receivablePayableEntries)
        .where(
          and(
            eq(receivablePayableEntries.businessId, businessId),
            inArray(receivablePayableEntries.id, entryIds)
          )
        )

      if (rows.length !== entryIds.length) {
        throw new HttpError(400, "One or more receivable/payable entries are invalid.")
      }

      const rowsById = new Map(rows.map((row) => [row.id, row]))
      const requestedByEntryId = new Map<string, number>()

      for (const allocation of allocations) {
        const amount = toCents(allocation.allocatedAmount)

        if (amount <= 0) {
          throw new HttpError(400, "Payment allocation amount must be greater than zero.")
        }

        const targetEntry = rowsById.get(allocation.receivablePayableEntryId)

        if (!targetEntry || targetEntry.voucherId !== allocation.documentVoucherId) {
          throw new HttpError(
            400,
            "Payment allocation must reference the receivable/payable entry for the document voucher."
          )
        }

        if (targetEntry.status === "written_off") {
          throw new HttpError(409, "Written off receivable/payable entries cannot be settled.")
        }

        requestedByEntryId.set(
          allocation.receivablePayableEntryId,
          (requestedByEntryId.get(allocation.receivablePayableEntryId) ?? 0) + amount
        )
      }

      const existingAllocationRows = await tx
        .select({
          receivablePayableEntryId: paymentAllocations.receivablePayableEntryId,
          allocatedAmount: paymentAllocations.allocatedAmount,
        })
        .from(paymentAllocations)
        .where(
          and(
            eq(paymentAllocations.businessId, businessId),
            eq(paymentAllocations.status, "active"),
            inArray(paymentAllocations.receivablePayableEntryId, entryIds)
          )
        )

      const existingByEntryId = new Map<string, number>()

      for (const row of existingAllocationRows) {
        if (!row.receivablePayableEntryId) {
          continue
        }

        existingByEntryId.set(
          row.receivablePayableEntryId,
          (existingByEntryId.get(row.receivablePayableEntryId) ?? 0) +
            toCents(row.allocatedAmount)
        )
      }

      for (const [entryId, requestedAmount] of requestedByEntryId) {
        const targetEntry = rowsById.get(entryId)

        if (!targetEntry) {
          throw new HttpError(400, "Receivable/payable entry not found.")
        }

        const originalAmount = toCents(targetEntry.originalAmount)
        const alreadyAllocated = existingByEntryId.get(entryId) ?? 0
        const availableAmount = originalAmount - alreadyAllocated

        if (requestedAmount > availableAmount) {
          throw new HttpError(409, "Payment allocation exceeds outstanding amount.")
        }
      }
    }

    async function refreshReceivablePayableSettlements(
      businessId: string,
      entryIds: string[]
    ) {
      if (entryIds.length === 0) {
        return
      }

      const rows = await tx
        .select({
          id: receivablePayableEntries.id,
          originalAmount: receivablePayableEntries.originalAmount,
          voucherId: receivablePayableEntries.voucherId,
        })
        .from(receivablePayableEntries)
        .where(
          and(
            eq(receivablePayableEntries.businessId, businessId),
            inArray(receivablePayableEntries.id, entryIds)
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
            inArray(paymentAllocations.receivablePayableEntryId, entryIds)
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

      const adjustmentRows = await tx
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
            inArray(receivablePayableAdjustmentEffects.receivablePayableEntryId, entryIds)
          )
        )

      const adjustedByEntryId = new Map<string, number>()

      for (const row of adjustmentRows) {
        adjustedByEntryId.set(
          row.receivablePayableEntryId,
          (adjustedByEntryId.get(row.receivablePayableEntryId) ?? 0) +
            toCents(row.amount)
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
      }
    }

    async function applyInventoryBalanceProjection(
      businessId: string,
      entries: NormalizedInventoryMovement[]
    ) {
      const [insertedSettings] = await tx
        .insert(businessInventorySettings)
        .values({ businessId })
        .onConflictDoNothing()
        .returning()
      const inventorySettings =
        insertedSettings ??
        (await tx.query.businessInventorySettings.findFirst({
          where: eq(businessInventorySettings.businessId, businessId),
        }))
      const negativeStockPolicy =
        inventorySettings?.negativeStockPolicy ?? "WARN"

      for (const entry of entries) {
        if (entry.quantityDeltaMilli === 0 && entry.valueDeltaCents === 0) {
          continue
        }

        const quantityDelta = formatQuantity(entry.quantityDeltaMilli)
        const valueDelta = formatCents(entry.valueDeltaCents)

        if (negativeStockPolicy === "BLOCK" && entry.quantityDeltaMilli < 0) {
          const [updatedBalance] = await tx
            .update(inventoryBalances)
            .set({
              quantityOnHand: drizzleSql`${inventoryBalances.quantityOnHand} + ${quantityDelta}`,
              inventoryValue: drizzleSql`${inventoryBalances.inventoryValue} + ${valueDelta}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(inventoryBalances.businessId, businessId),
                eq(inventoryBalances.itemId, entry.itemId),
                eq(inventoryBalances.warehouseId, entry.warehouseId),
                gte(inventoryBalances.quantityOnHand, entry.quantityOut)
              )
            )
            .returning({ id: inventoryBalances.id })

          if (!updatedBalance) {
            throw new HttpError(
              409,
              "Insufficient stock for this warehouse. Negative stock is blocked."
            )
          }

          continue
        }

        await tx
          .insert(inventoryBalances)
          .values({
            businessId,
            itemId: entry.itemId,
            warehouseId: entry.warehouseId,
            quantityOnHand: quantityDelta,
            inventoryValue: valueDelta,
          })
          .onConflictDoUpdate({
            target: [
              inventoryBalances.businessId,
              inventoryBalances.itemId,
              inventoryBalances.warehouseId,
            ],
            set: {
              quantityOnHand: drizzleSql`${inventoryBalances.quantityOnHand} + ${quantityDelta}`,
              inventoryValue: drizzleSql`${inventoryBalances.inventoryValue} + ${valueDelta}`,
              updatedAt: new Date(),
            },
          })
      }
    }

    async function allocateVoucherNumber(businessId: string, values: PostVoucherInput) {
      const documentType = values.documentType ?? documentTypeFromVoucherType(values.voucherType)
      const seriesId = await findInvoiceSeriesId(
        businessId,
        values.financialYearId,
        values.seriesCode,
        documentType,
        values.gstRegistrationId ?? null,
        values.branchId ?? null
      )

      const [series] = await tx
        .update(invoiceSeries)
        .set({
          nextNumber: drizzleSql`${invoiceSeries.nextNumber} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(invoiceSeries.id, seriesId))
        .returning({
          prefix: invoiceSeries.prefix,
          suffix: invoiceSeries.suffix,
          allocatedNumber: drizzleSql<number>`${invoiceSeries.nextNumber} - 1`,
        })

      if (!series) {
        throw new HttpError(409, "Voucher number could not be allocated.")
      }

      return formatVoucherNumber(series.prefix, series.allocatedNumber, series.suffix)
    }

    async function findInvoiceSeriesId(
      businessId: string,
      financialYearId: string,
      seriesCode: string,
      documentType: string,
      gstRegistrationId: string | null,
      branchId: string | null
    ) {
      const baseConditions = [
        eq(invoiceSeries.businessId, businessId),
        eq(invoiceSeries.financialYearId, financialYearId),
        eq(invoiceSeries.seriesCode, seriesCode),
        eq(invoiceSeries.documentType, documentType),
        eq(invoiceSeries.status, "active"),
      ]

      const branchSpecific =
        branchId ?
          await tx
            .select({ id: invoiceSeries.id })
            .from(invoiceSeries)
            .where(
              and(
                ...baseConditions,
                eq(invoiceSeries.branchId, branchId),
                ...(gstRegistrationId ?
                  [eq(invoiceSeries.gstRegistrationId, gstRegistrationId)]
                : [])
              )
            )
            .limit(1)
        : []

      if (branchSpecific[0]) {
        return branchSpecific[0].id
      }

      const [fallbackSeries] = await tx
        .select({ id: invoiceSeries.id })
        .from(invoiceSeries)
        .where(
          and(
            ...baseConditions,
            isNull(invoiceSeries.branchId),
            ...(gstRegistrationId ?
              [eq(invoiceSeries.gstRegistrationId, gstRegistrationId)]
            : [])
          )
        )
        .limit(1)

      if (!fallbackSeries) {
        throw new HttpError(
          400,
          `No active ${documentType} series is configured for this financial year.`
        )
      }

      return fallbackSeries.id
    }

    async function assertContextBelongsToBusiness(
      businessId: string,
      values: PostVoucherInput
    ) {
      await requireFinancialYear(businessId, values.financialYearId)

      if (values.gstRegistrationId) {
        await requireGstRegistration(businessId, values.gstRegistrationId)
      }

      if (values.branchId) {
        await requireBranch(businessId, values.branchId)
      }

      if (values.warehouseId) {
        await requireWarehouse(businessId, values.warehouseId)
      }

      if (values.branchId && values.warehouseId) {
        await requireBranchWarehouseLink(values.branchId, values.warehouseId)
      }

      if (values.referenceVoucherId) {
        await requireVoucher(businessId, values.referenceVoucherId)
      }
    }

    async function assertAccountingPeriodIsOpen(
      businessId: string,
      values: PostVoucherInput
    ) {
      const [lockedPeriod] = await tx
        .select({ id: accountingPeriods.id })
        .from(accountingPeriods)
        .where(
          and(
            eq(accountingPeriods.businessId, businessId),
            eq(accountingPeriods.financialYearId, values.financialYearId),
            lte(accountingPeriods.periodStart, values.voucherDate),
            gte(accountingPeriods.periodEnd, values.voucherDate),
            eq(accountingPeriods.status, "locked")
          )
        )
        .limit(1)

      if (lockedPeriod) {
        throw new HttpError(409, "This accounting period is locked.")
      }
    }

    async function assertEffectReferencesBelongToBusiness(
      businessId: string,
      values: PostVoucherInput
    ) {
      const ledgerAccountIds = uniqueStrings(
        values.journal.lines.map((line) => line.accountId)
      )
      const branchIds = uniqueStrings([
        ...values.journal.lines.map((line) => line.branchId ?? null),
        ...values.inventoryEntries.map((entry) => entry.branchId ?? null),
        ...values.gstEntries.map((entry) => entry.branchId ?? null),
      ])
      const warehouseIds = uniqueStrings([
        ...values.journal.lines.map((line) => line.warehouseId ?? null),
        ...values.inventoryEntries.map((entry) => entry.warehouseId ?? null),
      ])
      const gstRegistrationIds = uniqueStrings([
        ...values.journal.lines.map((line) => line.gstRegistrationId ?? null),
        ...values.gstEntries.map((entry) => entry.gstRegistrationId ?? null),
      ])
      const documentVoucherIds = uniqueStrings(
        values.paymentAllocations.map((allocation) => allocation.documentVoucherId)
      )
      const receivablePayableEntryIds = uniqueStrings(
        values.paymentAllocations.map((allocation) => allocation.receivablePayableEntryId)
      )

      await assertOwnedCount(
        "ledger account",
        ledgerAccountIds,
        tx
          .select({ id: ledgerAccounts.id })
          .from(ledgerAccounts)
          .where(
            and(
              eq(ledgerAccounts.businessId, businessId),
              ledgerAccountIds.length > 0 ?
                inArray(ledgerAccounts.id, ledgerAccountIds)
              : eq(ledgerAccounts.id, "00000000-0000-0000-0000-000000000000")
            )
          )
      )
      await assertOwnedCount(
        "branch",
        branchIds,
        tx
          .select({ id: businessBranches.id })
          .from(businessBranches)
          .where(
            and(
              eq(businessBranches.businessId, businessId),
              branchIds.length > 0 ?
                inArray(businessBranches.id, branchIds)
              : eq(businessBranches.id, "00000000-0000-0000-0000-000000000000")
            )
          )
      )
      await assertOwnedCount(
        "warehouse",
        warehouseIds,
        tx
          .select({ id: warehouses.id })
          .from(warehouses)
          .where(
            and(
              eq(warehouses.businessId, businessId),
              warehouseIds.length > 0 ?
                inArray(warehouses.id, warehouseIds)
              : eq(warehouses.id, "00000000-0000-0000-0000-000000000000")
            )
          )
      )
      await assertOwnedCount(
        "GST registration",
        gstRegistrationIds,
        tx
          .select({ id: gstRegistrations.id })
          .from(gstRegistrations)
          .where(
            and(
              eq(gstRegistrations.businessId, businessId),
              gstRegistrationIds.length > 0 ?
                inArray(gstRegistrations.id, gstRegistrationIds)
              : eq(gstRegistrations.id, "00000000-0000-0000-0000-000000000000")
            )
          )
      )
      await assertOwnedCount(
        "voucher",
        documentVoucherIds,
        tx
          .select({ id: vouchers.id })
          .from(vouchers)
          .where(
            and(
              eq(vouchers.businessId, businessId),
              documentVoucherIds.length > 0 ?
                inArray(vouchers.id, documentVoucherIds)
              : eq(vouchers.id, "00000000-0000-0000-0000-000000000000")
            )
          )
      )
      await assertOwnedCount(
        "receivable/payable entry",
        receivablePayableEntryIds,
        tx
          .select({ id: receivablePayableEntries.id })
          .from(receivablePayableEntries)
          .where(
            and(
              eq(receivablePayableEntries.businessId, businessId),
              receivablePayableEntryIds.length > 0 ?
                inArray(receivablePayableEntries.id, receivablePayableEntryIds)
              : eq(
                  receivablePayableEntries.id,
                  "00000000-0000-0000-0000-000000000000"
                )
            )
          )
      )
    }

    async function requireFinancialYear(businessId: string, financialYearId: string) {
      const year = await tx.query.financialYears.findFirst({
        where: and(
          eq(financialYears.id, financialYearId),
          eq(financialYears.businessId, businessId)
        ),
      })

      if (!year) {
        throw new HttpError(404, "Financial year not found.")
      }
    }

    async function requireGstRegistration(
      businessId: string,
      gstRegistrationId: string
    ) {
      const registration = await tx.query.gstRegistrations.findFirst({
        where: and(
          eq(gstRegistrations.id, gstRegistrationId),
          eq(gstRegistrations.businessId, businessId)
        ),
      })

      if (!registration) {
        throw new HttpError(404, "GST registration not found.")
      }
    }

    async function requireBranch(businessId: string, branchId: string) {
      const branch = await tx.query.businessBranches.findFirst({
        where: and(
          eq(businessBranches.id, branchId),
          eq(businessBranches.businessId, businessId)
        ),
      })

      if (!branch) {
        throw new HttpError(404, "Branch not found.")
      }
    }

    async function requireWarehouse(businessId: string, warehouseId: string) {
      const warehouse = await tx.query.warehouses.findFirst({
        where: and(eq(warehouses.id, warehouseId), eq(warehouses.businessId, businessId)),
      })

      if (!warehouse) {
        throw new HttpError(404, "Warehouse not found.")
      }
    }

    async function requireBranchWarehouseLink(branchId: string, warehouseId: string) {
      const link = await tx.query.branchWarehouses.findFirst({
        where: and(
          eq(branchWarehouses.branchId, branchId),
          eq(branchWarehouses.warehouseId, warehouseId)
        ),
      })

      if (!link) {
        throw new HttpError(400, "Warehouse is not linked to this branch.")
      }
    }

    async function requireVoucher(businessId: string, voucherId: string) {
      const voucher = await tx.query.vouchers.findFirst({
        where: and(eq(vouchers.id, voucherId), eq(vouchers.businessId, businessId)),
      })

      if (!voucher) {
        throw new HttpError(404, "Referenced voucher not found.")
      }
    }
  })
}

function normalizeInventoryEntriesForPosting(input: PostVoucherInput) {
  return input.inventoryEntries.map((entry) => {
    try {
      return normalizeInventoryMovementForPosting({
        entry,
        voucherDate: input.voucherDate,
        defaultBranchId: input.branchId ?? null,
        defaultWarehouseId: input.warehouseId ?? null,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Inventory movement is invalid."
      throw new HttpError(400, message)
    }
  })
}

async function getVoucherDetail(businessId: string, voucherId: string) {
  const voucher = await db.query.vouchers.findFirst({
    where: and(eq(vouchers.id, voucherId), eq(vouchers.businessId, businessId)),
  })

  if (!voucher) {
    throw new HttpError(404, "Voucher not found.")
  }

  const journalRows = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.voucherId, voucherId))
  const journalEntryIds = journalRows.map((entry) => entry.id)
  const journalLines =
    journalEntryIds.length > 0 ?
      await db
        .select()
        .from(journalEntryLines)
        .where(inArray(journalEntryLines.journalEntryId, journalEntryIds))
    : []

  return {
    voucher,
    journalEntries: journalRows.map((entry) => ({
      ...entry,
      lines: journalLines.filter((line) => line.journalEntryId === entry.id),
    })),
    inventoryEntries: await db
      .select()
      .from(inventoryTransactions)
      .where(eq(inventoryTransactions.voucherId, voucherId)),
    gstEntries: await db
      .select()
      .from(gstEntries)
      .where(eq(gstEntries.voucherId, voucherId)),
    receivablePayableEntries: await db
      .select()
      .from(receivablePayableEntries)
      .where(eq(receivablePayableEntries.voucherId, voucherId)),
    paymentAllocations: await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentVoucherId, voucherId)),
  }
}

async function assertCanCreateVoucher(access: BusinessAccess, voucherType: VoucherType) {
  if (access.membership.role === "owner" || access.membership.role === "admin") {
    return
  }

  const module = permissionModuleFromVoucherType(voucherType)
  const permission = await db.query.businessMemberPermissions.findFirst({
    where: and(
      eq(businessMemberPermissions.businessMemberId, access.membership.id),
      eq(businessMemberPermissions.module, module),
      eq(businessMemberPermissions.canCreate, true)
    ),
  })

  if (!permission) {
    throw new HttpError(403, "You do not have permission to create this transaction.")
  }
}

async function assertBranchScope(access: BusinessAccess, branchId: string | null) {
  if (access.membership.role === "owner" || access.membership.role === "admin") {
    return
  }

  const branchScopes = await db
    .select({ branchId: businessMemberBranches.branchId })
    .from(businessMemberBranches)
    .where(eq(businessMemberBranches.businessMemberId, access.membership.id))

  if (branchScopes.length === 0) {
    return
  }

  if (!branchId) {
    throw new HttpError(403, "Choose a permitted branch for this transaction.")
  }

  if (!branchScopes.some((scope) => scope.branchId === branchId)) {
    throw new HttpError(403, "You cannot create transactions for this branch.")
  }
}

async function assertOwnedCount<T extends { id: string }>(
  label: string,
  expectedIds: string[],
  rowsPromise: Promise<T[]>
) {
  if (expectedIds.length === 0) {
    return
  }

  const rows = await rowsPromise

  if (rows.length !== expectedIds.length) {
    throw new HttpError(400, `One or more ${label} references are invalid.`)
  }
}

function resolveIdempotencyKey(headerValue: string | string[] | undefined) {
  if (Array.isArray(headerValue)) {
    return headerValue[0]
  }

  return headerValue
}

function toRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function documentTypeFromVoucherType(voucherType: VoucherType) {
  const documentTypes: Record<VoucherType, string> = {
    SALES: "invoice",
    PURCHASE: "purchase",
    RECEIPT: "receipt",
    PAYMENT: "payment",
    CREDIT_NOTE: "credit_note",
    DEBIT_NOTE: "debit_note",
    SALES_RETURN: "sales_return",
    PURCHASE_RETURN: "purchase_return",
    EXPENSE: "expense",
    JOURNAL: "journal",
    STOCK_TRANSFER: "stock_transfer",
    STOCK_ADJUSTMENT: "stock_adjustment",
  }

  return documentTypes[voucherType]
}

function permissionModuleFromVoucherType(voucherType: VoucherType) {
  const moduleMap: Record<VoucherType, string> = {
    SALES: "invoices",
    PURCHASE: "purchases",
    RECEIPT: "invoices",
    PAYMENT: "purchases",
    CREDIT_NOTE: "invoices",
    DEBIT_NOTE: "purchases",
    SALES_RETURN: "invoices",
    PURCHASE_RETURN: "purchases",
    EXPENSE: "expenses",
    JOURNAL: "reports",
    STOCK_TRANSFER: "inventory",
    STOCK_ADJUSTMENT: "inventory",
  }

  return moduleMap[voucherType]
}

function formatVoucherNumber(prefix: string, number: number, suffix: string | null) {
  const formattedNumber = String(number).padStart(6, "0")
  return [prefix, formattedNumber, suffix].filter(Boolean).join("-")
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}
