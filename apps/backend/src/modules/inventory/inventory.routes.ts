import { randomUUID } from "node:crypto"

import { and, asc, desc, eq, gte, inArray, lte, sql as drizzleSql, type SQL } from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { db } from "../../db/client.js"
import {
  auditLogs,
  businessBranches,
  businessInventorySettings,
  businessMemberPermissions,
  inventoryBalances,
  inventoryBatches,
  inventorySerialNumbers,
  inventoryTransactions,
  itemInventoryProfiles,
  items,
  itemUnits,
  stockTransferLines,
  stockTransfers,
  warehouses,
  type InventoryTransactionRecord,
  type ItemRecord,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"
import { formatCents, normalizeMoney, toCents } from "../core/core.validation.js"
import {
  formatQuantity,
  normalizeInventoryMovementForPosting,
  toQuantityMilli,
  type NormalizedInventoryMovement,
} from "./inventory.service.js"
import {
  createInventoryTransferSchema,
  inventoryAdjustmentSchema,
  inventoryItemLedgerParamsSchema,
  inventoryLedgerQuerySchema,
  inventoryOpeningStockSchema,
  inventorySettingsPayloadSchema,
  inventoryTransferParamsSchema,
  inventoryWarehouseParamsSchema,
  listInventoryTransfersQuerySchema,
  rebuildInventoryBalanceSchema,
} from "./inventory.schemas.js"

type BusinessAccess = Awaited<ReturnType<typeof requirePrimaryBusinessAccess>>
type InventoryAction = "view" | "create" | "edit" | "delete"
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type TrackedProduct = {
  item: ItemRecord
  unit: string
  trackBatch: boolean
  trackSerial: boolean
}

export async function registerInventoryRoutes(app: FastifyInstance) {
  app.get("/inventory/settings", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await requireInventoryPermission(access, "view")

    return {
      settings: await ensureInventorySettings(access.business.id),
    }
  })

  app.patch("/inventory/settings", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await requireInventoryPermission(access, "edit")
    const body = inventorySettingsPayloadSchema.parse(request.body)

    const [settings] = await db
      .insert(businessInventorySettings)
      .values({
        businessId: access.business.id,
        negativeStockPolicy: body.negativeStockPolicy ?? "WARN",
        valuationMethod: body.valuationMethod ?? "WEIGHTED_AVERAGE",
      })
      .onConflictDoUpdate({
        target: businessInventorySettings.businessId,
        set: {
          ...body,
          updatedAt: new Date(),
        },
      })
      .returning()

    return {
      settings,
    }
  })

  app.get("/inventory/summary", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await requireInventoryPermission(access, "view")

    const balances = await db
      .select()
      .from(inventoryBalances)
      .where(eq(inventoryBalances.businessId, access.business.id))

    const totals = balances.reduce(
      (current, balance) => ({
        skuCount: current.skuCount + (toQuantityMilli(balance.quantityOnHand) > 0 ? 1 : 0),
        quantityMilli: current.quantityMilli + toQuantityMilli(balance.quantityOnHand),
        inventoryValueCents: current.inventoryValueCents + toCents(balance.inventoryValue),
      }),
      { skuCount: 0, quantityMilli: 0, inventoryValueCents: 0 }
    )

    return {
      summary: {
        skuCount: totals.skuCount,
        quantityOnHand: formatQuantity(totals.quantityMilli),
        inventoryValue: formatCents(totals.inventoryValueCents),
      },
    }
  })

  app.get("/inventory/low-stock", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await requireInventoryPermission(access, "view")

    const rows = await db
      .select({
        item: items,
        profile: itemInventoryProfiles,
      })
      .from(items)
      .innerJoin(itemInventoryProfiles, eq(itemInventoryProfiles.itemId, items.id))
      .where(
        and(
          eq(items.businessId, access.business.id),
          eq(itemInventoryProfiles.businessId, access.business.id),
          eq(itemInventoryProfiles.trackInventory, true),
          eq(items.status, "ACTIVE")
        )
      )
      .orderBy(asc(items.name))

    const balances = await db
      .select()
      .from(inventoryBalances)
      .where(eq(inventoryBalances.businessId, access.business.id))

    const quantityByItem = new Map<string, number>()
    for (const balance of balances) {
      quantityByItem.set(
        balance.itemId,
        (quantityByItem.get(balance.itemId) ?? 0) + toQuantityMilli(balance.quantityOnHand)
      )
    }

    return {
      items: rows
        .map((row) => {
          const quantityMilli = quantityByItem.get(row.item.id) ?? 0
          const reorderMilli = toQuantityMilli(row.profile.reorderLevel)
          const status =
            quantityMilli <= 0 ? "OUT_OF_STOCK"
            : reorderMilli > 0 && quantityMilli <= reorderMilli ? "LOW_STOCK"
            : "OK"

          return {
            itemId: row.item.id,
            name: row.item.name,
            sku: row.item.sku,
            quantityOnHand: formatQuantity(quantityMilli),
            reorderLevel: row.profile.reorderLevel,
            status,
          }
        })
        .filter((row) => row.status !== "OK"),
    }
  })

  app.get("/inventory/items/:id/ledger", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await requireInventoryPermission(access, "view")
    const { id } = inventoryItemLedgerParamsSchema.parse(request.params)
    const query = inventoryLedgerQuerySchema.parse(request.query)
    const conditions: SQL[] = [
      eq(inventoryTransactions.businessId, access.business.id),
      eq(inventoryTransactions.itemId, id),
    ]

    if (query.from) {
      conditions.push(gte(inventoryTransactions.transactionDate, query.from))
    }

    if (query.to) {
      conditions.push(lte(inventoryTransactions.transactionDate, query.to))
    }

    if (query.warehouse) {
      conditions.push(eq(inventoryTransactions.warehouseId, query.warehouse))
    }

    if (query.branch) {
      conditions.push(eq(inventoryTransactions.branchId, query.branch))
    }

    if (query.transactionType) {
      conditions.push(eq(inventoryTransactions.movementType, query.transactionType))
    }

    const transactions = await db
      .select()
      .from(inventoryTransactions)
      .where(and(...conditions))
      .orderBy(desc(inventoryTransactions.transactionDate), desc(inventoryTransactions.createdAt))

    return {
      transactions,
      balance: calculateLedgerBalance(transactions),
    }
  })

  app.get("/inventory/warehouses/:id/stock", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await requireInventoryPermission(access, "view")
    const { id } = inventoryWarehouseParamsSchema.parse(request.params)
    await requireWarehouse(access.business.id, id)

    const balances = await db
      .select({
        balance: inventoryBalances,
        item: items,
      })
      .from(inventoryBalances)
      .innerJoin(items, eq(items.id, inventoryBalances.itemId))
      .where(
        and(
          eq(inventoryBalances.businessId, access.business.id),
          eq(inventoryBalances.warehouseId, id)
        )
      )
      .orderBy(asc(items.name))

    return {
      stock: balances.map((row) => ({
        ...row.balance,
        itemName: row.item.name,
        sku: row.item.sku,
        averageCost: averageCost(row.balance.quantityOnHand, row.balance.inventoryValue),
      })),
    }
  })

  app.post("/inventory/opening-stock", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await requireInventoryPermission(access, "create")
    const body = inventoryOpeningStockSchema.parse(request.body)
    const sourceId = randomUUID()

    const result = await db.transaction(async (tx) => {
      await requireWarehouse(access.business.id, body.warehouseId)
      await requireBranch(access.business.id, body.branchId)
      const product = await requireTrackedProduct(access.business.id, body.itemId)
      const batch = await createOrUpdateBatch(tx, access.business.id, body.itemId, {
        batchNumber: body.batchNumber,
        manufacturingDate: body.manufacturingDate,
        expiryDate: body.expiryDate,
      })
      const movement = await postStandaloneMovement(tx, access, {
        product,
        warehouseId: body.warehouseId,
        branchId: body.branchId ?? null,
        movementType: "OPENING_STOCK",
        quantityIn: body.baseQuantity ?? body.quantity,
        quantityOut: "0",
        sourceQuantity: body.quantity,
        sourceUnit: body.sourceUnit,
        unitCost: body.unitCost,
        transactionDate: body.transactionDate,
        reason: body.reason ?? "Opening stock",
        sourceType: "OPENING_STOCK",
        sourceId,
        batchId: batch?.id ?? null,
        batchNumberSnapshot: batch?.batchNumber ?? null,
      })

      if (body.serialNumbers.length > 0) {
        await createSerialNumbers(tx, access.business.id, body.itemId, body.warehouseId, movement.transaction.id, body.serialNumbers)
      }

      await writeAuditTx(tx, access, "inventory_transaction", movement.transaction.id, "OPENING_STOCK_POSTED", null, movement.transaction)

      return movement
    })

    return result
  })

  app.post("/inventory/adjustments", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await requireInventoryPermission(access, "edit")
    const body = inventoryAdjustmentSchema.parse(request.body)
    const sourceId = randomUUID()

    const result = await db.transaction(async (tx) => {
      await requireWarehouse(access.business.id, body.warehouseId)
      await requireBranch(access.business.id, body.branchId)
      const product = await requireTrackedProduct(access.business.id, body.itemId)
      const movementType = resolveAdjustmentMovementType(body.direction, body.adjustmentType)
      const resolvedUnitCost =
        body.unitCost ??
        (body.direction === "out" ? await resolveAverageCost(access.business.id, body.itemId, body.warehouseId) : "0.00")
      const movement = await postStandaloneMovement(tx, access, {
        product,
        warehouseId: body.warehouseId,
        branchId: body.branchId ?? null,
        movementType,
        quantityIn: body.direction === "in" ? body.baseQuantity ?? body.quantity : "0",
        quantityOut: body.direction === "out" ? body.baseQuantity ?? body.quantity : "0",
        sourceQuantity: body.quantity,
        sourceUnit: body.sourceUnit,
        unitCost: resolvedUnitCost,
        transactionDate: body.transactionDate,
        reason: body.reason,
        sourceType: "STOCK_ADJUSTMENT",
        sourceId,
        batchId: body.batchId,
        serialId: body.serialId,
      })

      await writeAuditTx(tx, access, "inventory_transaction", movement.transaction.id, "STOCK_ADJUSTED", null, movement.transaction)

      return movement
    })

    return result
  })

  app.get("/inventory/transfers", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await requireInventoryPermission(access, "view")
    const query = listInventoryTransfersQuerySchema.parse(request.query)
    const conditions: SQL[] = [eq(stockTransfers.businessId, access.business.id)]

    if (query.status) {
      conditions.push(eq(stockTransfers.status, query.status))
    }

    const transfers = await db
      .select()
      .from(stockTransfers)
      .where(and(...conditions))
      .orderBy(desc(stockTransfers.createdAt))
      .limit(query.limit)

    return {
      transfers: await attachTransferLines(access.business.id, transfers),
    }
  })

  app.post("/inventory/transfers", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await requireInventoryPermission(access, "create")
    const body = createInventoryTransferSchema.parse(request.body)

    const transfer = await db.transaction(async (tx) => {
      await requireWarehouse(access.business.id, body.sourceWarehouseId)
      await requireWarehouse(access.business.id, body.destinationWarehouseId)
      await requireBranch(access.business.id, body.branchId)

      const trackedProducts = new Map<string, TrackedProduct>()
      for (const line of body.lines) {
        trackedProducts.set(line.itemId, await requireTrackedProduct(access.business.id, line.itemId))
      }

      const [createdTransfer] = await tx
        .insert(stockTransfers)
        .values({
          businessId: access.business.id,
          sourceWarehouseId: body.sourceWarehouseId,
          destinationWarehouseId: body.destinationWarehouseId,
          branchId: body.branchId ?? null,
          status: "DRAFT",
          transferDate: body.transferDate,
          referenceNumber: body.referenceNumber,
          notes: body.notes,
          createdBy: access.userId,
        })
        .returning()

      if (!createdTransfer) {
        throw new HttpError(500, "Unable to create stock transfer.")
      }

      await tx.insert(stockTransferLines).values(
        body.lines.map((line) => {
          const product = trackedProducts.get(line.itemId)

          if (!product) {
            throw new HttpError(400, "Transfer line product is invalid.")
          }

          return {
            businessId: access.business.id,
            transferId: createdTransfer.id,
            itemId: product.item.id,
            itemNameSnapshot: product.item.name,
            skuSnapshot: product.item.sku,
            quantity: line.quantity,
            unit: line.unit,
            unitCost: normalizeMoney(line.unitCost ?? "0.00"),
            batchId: line.batchId,
            serialId: line.serialId,
          }
        })
      )

      await writeAuditTx(tx, access, "stock_transfer", createdTransfer.id, "TRANSFER_CREATED", null, createdTransfer)

      return createdTransfer
    })

    return {
      transfer: (await attachTransferLines(access.business.id, [transfer]))[0],
    }
  })

  app.post("/inventory/transfers/:id/dispatch", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await requireInventoryPermission(access, "edit")
    const { id } = inventoryTransferParamsSchema.parse(request.params)

    const transfer = await db.transaction(async (tx) => {
      const current = await requireTransfer(access.business.id, id)

      if (current.status !== "DRAFT") {
        throw new HttpError(409, "Only draft transfers can be dispatched.")
      }

      const lines = await listTransferLines(access.business.id, id)

      for (const line of lines) {
        const product = await requireTrackedProduct(access.business.id, line.itemId)
        const unitCost = Number(line.unitCost) > 0 ? line.unitCost : await resolveAverageCost(access.business.id, line.itemId, current.sourceWarehouseId)

        if (unitCost !== line.unitCost) {
          await tx
            .update(stockTransferLines)
            .set({ unitCost })
            .where(
              and(
                eq(stockTransferLines.businessId, access.business.id),
                eq(stockTransferLines.id, line.id)
              )
            )
        }

        await postStandaloneMovement(tx, access, {
          product,
          warehouseId: current.sourceWarehouseId,
          branchId: current.branchId,
          movementType: "TRANSFER_OUT",
          quantityIn: "0",
          quantityOut: line.quantity,
          sourceQuantity: line.quantity,
          sourceUnit: line.unit,
          unitCost,
          transactionDate: current.transferDate,
          reason: `Transfer dispatch ${current.referenceNumber ?? current.id}`,
          sourceType: "STOCK_TRANSFER",
          sourceId: current.id,
          batchId: line.batchId,
          serialId: line.serialId,
        })
      }

      const [updated] = await tx
        .update(stockTransfers)
        .set({
          status: "DISPATCHED",
          dispatchedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(stockTransfers.businessId, access.business.id), eq(stockTransfers.id, id)))
        .returning()

      if (!updated) {
        throw new HttpError(500, "Unable to dispatch transfer.")
      }

      await writeAuditTx(tx, access, "stock_transfer", updated.id, "TRANSFER_DISPATCHED", current, updated)

      return updated
    })

    return {
      transfer: (await attachTransferLines(access.business.id, [transfer]))[0],
    }
  })

  app.post("/inventory/transfers/:id/receive", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await requireInventoryPermission(access, "edit")
    const { id } = inventoryTransferParamsSchema.parse(request.params)

    const transfer = await db.transaction(async (tx) => {
      const current = await requireTransfer(access.business.id, id)

      if (current.status !== "DISPATCHED" && current.status !== "IN_TRANSIT") {
        throw new HttpError(409, "Only dispatched transfers can be received.")
      }

      const lines = await listTransferLines(access.business.id, id)

      for (const line of lines) {
        const product = await requireTrackedProduct(access.business.id, line.itemId)

        await postStandaloneMovement(tx, access, {
          product,
          warehouseId: current.destinationWarehouseId,
          branchId: current.branchId,
          movementType: "TRANSFER_IN",
          quantityIn: line.quantity,
          quantityOut: "0",
          sourceQuantity: line.quantity,
          sourceUnit: line.unit,
          unitCost: line.unitCost,
          transactionDate: current.transferDate,
          reason: `Transfer receipt ${current.referenceNumber ?? current.id}`,
          sourceType: "STOCK_TRANSFER",
          sourceId: current.id,
          batchId: line.batchId,
          serialId: line.serialId,
        })
      }

      const [updated] = await tx
        .update(stockTransfers)
        .set({
          status: "RECEIVED",
          receivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(stockTransfers.businessId, access.business.id), eq(stockTransfers.id, id)))
        .returning()

      if (!updated) {
        throw new HttpError(500, "Unable to receive transfer.")
      }

      await writeAuditTx(tx, access, "stock_transfer", updated.id, "TRANSFER_RECEIVED", current, updated)

      return updated
    })

    return {
      transfer: (await attachTransferLines(access.business.id, [transfer]))[0],
    }
  })

  app.post("/inventory/transfers/:id/cancel", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await requireInventoryPermission(access, "edit")
    const { id } = inventoryTransferParamsSchema.parse(request.params)

    const transfer = await db.transaction(async (tx) => {
      const current = await requireTransfer(access.business.id, id)

      if (current.status !== "DRAFT") {
        throw new HttpError(409, "Only draft transfers can be cancelled.")
      }

      const [updated] = await tx
        .update(stockTransfers)
        .set({
          status: "CANCELLED",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(stockTransfers.businessId, access.business.id), eq(stockTransfers.id, id)))
        .returning()

      if (!updated) {
        throw new HttpError(500, "Unable to cancel transfer.")
      }

      await writeAuditTx(tx, access, "stock_transfer", updated.id, "TRANSFER_CANCELLED", current, updated)

      return updated
    })

    return {
      transfer: (await attachTransferLines(access.business.id, [transfer]))[0],
    }
  })

  app.post("/inventory/rebuild-balance", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await requireInventoryPermission(access, "edit")
    const body = rebuildInventoryBalanceSchema.parse(request.body)
    await requireTrackedProduct(access.business.id, body.itemId)
    await requireWarehouse(access.business.id, body.warehouseId)

    const balance = await db.transaction(async (tx) =>
      rebuildBalance(tx, access.business.id, body.itemId, body.warehouseId)
    )

    return {
      balance,
    }
  })
}

async function postStandaloneMovement(
  tx: DbTransaction,
  access: BusinessAccess,
  input: {
    product: TrackedProduct
    warehouseId: string
    branchId: string | null
    movementType: NormalizedInventoryMovement["movementType"]
    quantityIn: string
    quantityOut: string
    sourceQuantity: string
    sourceUnit: string
    unitCost: string
    transactionDate: string
    reason: string | null
    sourceType: string
    sourceId: string
    batchId?: string | null
    serialId?: string | null
    batchNumberSnapshot?: string | null
    serialNumberSnapshot?: string | null
  }
) {
  const normalized = normalizeInventoryMovementForPosting({
    voucherDate: input.transactionDate,
    defaultBranchId: input.branchId,
    defaultWarehouseId: input.warehouseId,
    entry: {
      branchId: input.branchId,
      warehouseId: input.warehouseId,
      itemId: input.product.item.id,
      itemNameSnapshot: input.product.item.name,
      skuSnapshot: input.product.item.sku,
      unitSnapshot: input.product.unit,
      itemSnapshot: {
        itemType: input.product.item.itemType,
        sku: input.product.item.sku,
      },
      movementType: input.movementType,
      quantityIn: input.quantityIn,
      quantityOut: input.quantityOut,
      quantity: input.sourceQuantity,
      unit: input.product.unit,
      sourceUnit: input.sourceUnit,
      baseQuantity: input.quantityIn !== "0" ? input.quantityIn : input.quantityOut,
      unitCost: input.unitCost,
      batchId: input.batchId ?? undefined,
      serialId: input.serialId ?? undefined,
      batchNumberSnapshot: input.batchNumberSnapshot ?? undefined,
      serialNumberSnapshot: input.serialNumberSnapshot ?? undefined,
      transactionDate: input.transactionDate,
      reason: input.reason ?? undefined,
    },
  })

  const balance = await applyInventoryBalanceProjection(tx, access.business.id, normalized)
  const [transaction] = await tx
    .insert(inventoryTransactions)
    .values({
      businessId: access.business.id,
      voucherId: null,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      branchId: normalized.branchId,
      warehouseId: normalized.warehouseId,
      itemId: normalized.itemId,
      itemNameSnapshot: normalized.itemNameSnapshot,
      skuSnapshot: normalized.skuSnapshot,
      unitSnapshot: normalized.unitSnapshot,
      itemSnapshot: normalized.itemSnapshot,
      movementType: normalized.movementType,
      quantity: normalized.quantity,
      quantityIn: normalized.quantityIn,
      quantityOut: normalized.quantityOut,
      unit: normalized.unit,
      sourceUnit: normalized.sourceUnit,
      baseQuantity: normalized.baseQuantity,
      unitCost: normalized.unitCost,
      totalCost: normalized.totalCost,
      inventoryValue: normalized.inventoryValue,
      batchId: normalized.batchId,
      serialId: normalized.serialId,
      batchNumberSnapshot: normalized.batchNumberSnapshot,
      serialNumberSnapshot: normalized.serialNumberSnapshot,
      transactionDate: normalized.transactionDate,
      reason: normalized.reason,
      createdBy: access.userId,
    })
    .returning()

  if (!transaction) {
    throw new HttpError(500, "Unable to post inventory transaction.")
  }

  return {
    transaction,
    balance,
  }
}

async function applyInventoryBalanceProjection(
  tx: DbTransaction,
  businessId: string,
  normalized: NormalizedInventoryMovement
) {
  const settings = await ensureInventorySettings(businessId)
  const valueDelta = formatCents(normalized.valueDeltaCents)

  if (
    settings.negativeStockPolicy === "BLOCK" &&
    normalized.quantityDeltaMilli < 0
  ) {
    const [updated] = await tx
      .update(inventoryBalances)
      .set({
        quantityOnHand: drizzleSql`${inventoryBalances.quantityOnHand} + ${normalized.quantity}`,
        inventoryValue: drizzleSql`${inventoryBalances.inventoryValue} + ${valueDelta}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inventoryBalances.businessId, businessId),
          eq(inventoryBalances.itemId, normalized.itemId),
          eq(inventoryBalances.warehouseId, normalized.warehouseId),
          gte(inventoryBalances.quantityOnHand, formatQuantity(Math.abs(normalized.quantityDeltaMilli)))
        )
      )
      .returning()

    if (!updated) {
      throw new HttpError(409, "Insufficient stock for this inventory movement.")
    }

    return updated
  }

  const [balance] = await tx
    .insert(inventoryBalances)
    .values({
      businessId,
      itemId: normalized.itemId,
      warehouseId: normalized.warehouseId,
      quantityOnHand: normalized.quantity,
      inventoryValue: valueDelta,
    })
    .onConflictDoUpdate({
      target: [
        inventoryBalances.businessId,
        inventoryBalances.itemId,
        inventoryBalances.warehouseId,
      ],
      set: {
        quantityOnHand: drizzleSql`${inventoryBalances.quantityOnHand} + ${normalized.quantity}`,
        inventoryValue: drizzleSql`${inventoryBalances.inventoryValue} + ${valueDelta}`,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!balance) {
    throw new HttpError(500, "Unable to update inventory balance.")
  }

  return balance
}

async function rebuildBalance(
  tx: DbTransaction,
  businessId: string,
  itemId: string,
  warehouseId: string
) {
  const transactions = await tx
    .select()
    .from(inventoryTransactions)
    .where(
      and(
        eq(inventoryTransactions.businessId, businessId),
        eq(inventoryTransactions.itemId, itemId),
        eq(inventoryTransactions.warehouseId, warehouseId)
      )
    )

  const totals = transactions.reduce(
    (current, transaction) => ({
      quantityMilli:
        current.quantityMilli +
        toQuantityMilli(transaction.quantityIn) -
        toQuantityMilli(transaction.quantityOut),
      valueCents:
        current.valueCents +
        toCents(
          toQuantityMilli(transaction.quantityIn) > 0 ?
            transaction.inventoryValue
          : "0.00"
        ) -
        toCents(
          toQuantityMilli(transaction.quantityOut) > 0 ?
            transaction.inventoryValue
          : "0.00"
        ),
    }),
    { quantityMilli: 0, valueCents: 0 }
  )

  const [balance] = await tx
    .insert(inventoryBalances)
    .values({
      businessId,
      itemId,
      warehouseId,
      quantityOnHand: formatQuantity(totals.quantityMilli),
      inventoryValue: formatCents(totals.valueCents),
    })
    .onConflictDoUpdate({
      target: [
        inventoryBalances.businessId,
        inventoryBalances.itemId,
        inventoryBalances.warehouseId,
      ],
      set: {
        quantityOnHand: formatQuantity(totals.quantityMilli),
        inventoryValue: formatCents(totals.valueCents),
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!balance) {
    throw new HttpError(500, "Unable to rebuild inventory balance.")
  }

  return balance
}

async function createOrUpdateBatch(
  tx: DbTransaction,
  businessId: string,
  itemId: string,
  input: {
    batchNumber?: string | null
    manufacturingDate?: string | null
    expiryDate?: string | null
  }
) {
  if (!input.batchNumber) {
    return null
  }

  const [batch] = await tx
    .insert(inventoryBatches)
    .values({
      businessId,
      itemId,
      batchNumber: input.batchNumber,
      manufacturingDate: input.manufacturingDate ?? null,
      expiryDate: input.expiryDate ?? null,
      status: "ACTIVE",
    })
    .onConflictDoUpdate({
      target: [
        inventoryBatches.businessId,
        inventoryBatches.itemId,
        inventoryBatches.batchNumber,
      ],
      set: {
        manufacturingDate: input.manufacturingDate ?? null,
        expiryDate: input.expiryDate ?? null,
        updatedAt: new Date(),
      },
    })
    .returning()

  return batch ?? null
}

async function createSerialNumbers(
  tx: DbTransaction,
  businessId: string,
  itemId: string,
  warehouseId: string,
  transactionId: string,
  serialNumbers: string[]
) {
  const uniqueSerials = Array.from(new Set(serialNumbers))

  if (uniqueSerials.length !== serialNumbers.length) {
    throw new HttpError(400, "Serial numbers must be unique within the movement.")
  }

  const inserted = await tx
    .insert(inventorySerialNumbers)
    .values(
      uniqueSerials.map((serialNumber) => ({
        businessId,
        itemId,
        serialNumber,
        warehouseId,
        sourceTransactionId: transactionId,
        status: "IN_STOCK",
      }))
    )
    .onConflictDoNothing()
    .returning()

  if (inserted.length !== uniqueSerials.length) {
    throw new HttpError(409, "One or more serial numbers already exist.")
  }
}

async function requireTrackedProduct(
  businessId: string,
  itemId: string
): Promise<TrackedProduct> {
  const item = await db.query.items.findFirst({
    where: and(eq(items.businessId, businessId), eq(items.id, itemId)),
  })

  if (!item) {
    throw new HttpError(404, "Inventory item not found.")
  }

  if (item.itemType !== "GOODS") {
    throw new HttpError(400, "Only goods items can be inventory tracked.")
  }

  const [profile, unit] = await Promise.all([
    db.query.itemInventoryProfiles.findFirst({
      where: and(
        eq(itemInventoryProfiles.businessId, businessId),
        eq(itemInventoryProfiles.itemId, itemId)
      ),
    }),
    db.query.itemUnits.findFirst({
      where: and(eq(itemUnits.businessId, businessId), eq(itemUnits.itemId, itemId)),
      orderBy: [desc(itemUnits.createdAt)],
    }),
  ])

  if (profile?.trackInventory === false) {
    throw new HttpError(400, "Inventory tracking is disabled for this item.")
  }

  return {
    item,
    unit: unit?.baseUnit ?? "PCS",
    trackBatch: profile?.batchTracking ?? false,
    trackSerial: profile?.serialTracking ?? false,
  }
}

async function requireWarehouse(businessId: string, warehouseId: string) {
  const warehouse = await db.query.warehouses.findFirst({
    where: and(eq(warehouses.businessId, businessId), eq(warehouses.id, warehouseId)),
  })

  if (!warehouse) {
    throw new HttpError(400, "Warehouse does not belong to this business.")
  }

  return warehouse
}

async function requireBranch(businessId: string, branchId: string | null | undefined) {
  if (!branchId) {
    return null
  }

  const branch = await db.query.businessBranches.findFirst({
    where: and(eq(businessBranches.businessId, businessId), eq(businessBranches.id, branchId)),
  })

  if (!branch) {
    throw new HttpError(400, "Branch does not belong to this business.")
  }

  return branch
}

async function requireTransfer(businessId: string, transferId: string) {
  const transfer = await db.query.stockTransfers.findFirst({
    where: and(eq(stockTransfers.businessId, businessId), eq(stockTransfers.id, transferId)),
  })

  if (!transfer) {
    throw new HttpError(404, "Stock transfer not found.")
  }

  return transfer
}

async function listTransferLines(businessId: string, transferId: string) {
  return db
    .select()
    .from(stockTransferLines)
    .where(
      and(
        eq(stockTransferLines.businessId, businessId),
        eq(stockTransferLines.transferId, transferId)
      )
    )
    .orderBy(asc(stockTransferLines.createdAt))
}

async function attachTransferLines(
  businessId: string,
  transfers: Array<typeof stockTransfers.$inferSelect>
) {
  if (transfers.length === 0) {
    return []
  }

  const transferIds = transfers.map((transfer) => transfer.id)
  const lines = await db
    .select()
    .from(stockTransferLines)
    .where(
      and(
        eq(stockTransferLines.businessId, businessId),
        inArray(stockTransferLines.transferId, transferIds)
      )
    )
    .orderBy(asc(stockTransferLines.createdAt))
  const linesByTransfer = new Map<string, typeof lines>()

  for (const line of lines) {
    linesByTransfer.set(line.transferId, [
      ...(linesByTransfer.get(line.transferId) ?? []),
      line,
    ])
  }

  return transfers.map((transfer) => ({
    ...transfer,
    lines: linesByTransfer.get(transfer.id) ?? [],
  }))
}

async function resolveAverageCost(
  businessId: string,
  itemId: string,
  warehouseId: string
) {
  const balance = await db.query.inventoryBalances.findFirst({
    where: and(
      eq(inventoryBalances.businessId, businessId),
      eq(inventoryBalances.itemId, itemId),
      eq(inventoryBalances.warehouseId, warehouseId)
    ),
  })

  if (!balance) {
    return "0.00"
  }

  return averageCost(balance.quantityOnHand, balance.inventoryValue)
}

async function ensureInventorySettings(businessId: string) {
  const existing = await db.query.businessInventorySettings.findFirst({
    where: eq(businessInventorySettings.businessId, businessId),
  })

  if (existing) {
    return existing
  }

  const [settings] = await db
    .insert(businessInventorySettings)
    .values({
      businessId,
      negativeStockPolicy: "WARN",
      valuationMethod: "WEIGHTED_AVERAGE",
    })
    .returning()

  if (!settings) {
    throw new HttpError(500, "Unable to initialize inventory settings.")
  }

  return settings
}

async function requireInventoryPermission(
  access: BusinessAccess,
  action: InventoryAction
) {
  if (access.membership.role === "owner" || access.membership.role === "admin") {
    return
  }

  const permission = await db.query.businessMemberPermissions.findFirst({
    where: and(
      eq(businessMemberPermissions.businessMemberId, access.membership.id),
      eq(businessMemberPermissions.module, "inventory")
    ),
  })

  const allowed =
    action === "view" ? permission?.canView
    : action === "create" ? permission?.canCreate
    : action === "edit" ? permission?.canEdit
    : permission?.canDelete

  if (!allowed) {
    throw new HttpError(403, "You do not have permission to manage inventory.")
  }
}

async function writeAuditTx(
  tx: DbTransaction,
  access: BusinessAccess,
  entityType: string,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown
) {
  await tx.insert(auditLogs).values({
    businessId: access.business.id,
    entityType,
    entityId,
    action,
    userId: access.userId,
    before,
    after,
  })
}

function calculateLedgerBalance(transactions: InventoryTransactionRecord[]) {
  const totals = transactions.reduce(
    (current, transaction) => ({
      quantityMilli:
        current.quantityMilli +
        toQuantityMilli(transaction.quantityIn) -
        toQuantityMilli(transaction.quantityOut),
      valueCents:
        current.valueCents +
        toCents(
          toQuantityMilli(transaction.quantityIn) > 0 ?
            transaction.inventoryValue
          : "0.00"
        ) -
        toCents(
          toQuantityMilli(transaction.quantityOut) > 0 ?
            transaction.inventoryValue
          : "0.00"
        ),
    }),
    { quantityMilli: 0, valueCents: 0 }
  )

  return {
    quantityOnHand: formatQuantity(totals.quantityMilli),
    inventoryValue: formatCents(totals.valueCents),
  }
}

function averageCost(quantity: string, inventoryValue: string) {
  const quantityMilli = toQuantityMilli(quantity)

  if (quantityMilli <= 0) {
    return "0.00"
  }

  return formatCents(Math.round((toCents(inventoryValue) * 1000) / quantityMilli))
}

function resolveAdjustmentMovementType(
  direction: "in" | "out",
  adjustmentType: "ADJUSTMENT" | "DAMAGE" | "EXPIRY"
) {
  if (adjustmentType === "DAMAGE") {
    return "DAMAGE" as const
  }

  if (adjustmentType === "EXPIRY") {
    return "EXPIRY" as const
  }

  return direction === "in" ? "ADJUSTMENT_IN" as const : "ADJUSTMENT_OUT" as const
}
