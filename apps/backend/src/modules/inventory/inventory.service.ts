import type {
  InventoryMovementType,
  PostVoucherInput,
} from "../core/core.schemas.js"
import { formatCents, normalizeMoney, toCents } from "../core/core.validation.js"

const inboundMovementTypes = new Set<InventoryMovementType>([
  "OPENING_STOCK",
  "PURCHASE",
  "SALES_RETURN",
  "TRANSFER_IN",
  "ADJUSTMENT_IN",
])

const outboundMovementTypes = new Set<InventoryMovementType>([
  "SALE",
  "PURCHASE_RETURN",
  "TRANSFER_OUT",
  "ADJUSTMENT_OUT",
  "DAMAGE",
  "EXPIRY",
])

type InventoryEntryInput = PostVoucherInput["inventoryEntries"][number]

export type NormalizedInventoryMovement = {
  branchId: string | null
  warehouseId: string
  itemId: string
  itemNameSnapshot: string
  skuSnapshot: string | null
  unitSnapshot: string
  itemSnapshot: Record<string, unknown> | null
  movementType: InventoryMovementType
  quantity: string
  quantityIn: string
  quantityOut: string
  unit: string
  sourceUnit: string
  baseQuantity: string
  unitCost: string | null
  totalCost: string | null
  inventoryValue: string
  batchId: string | null
  serialId: string | null
  batchNumberSnapshot: string | null
  serialNumberSnapshot: string | null
  transactionDate: string
  reason: string | null
  quantityDeltaMilli: number
  valueDeltaCents: number
}

export function normalizeInventoryMovementForPosting(input: {
  entry: InventoryEntryInput
  voucherDate: string
  defaultBranchId: string | null
  defaultWarehouseId: string | null
}): NormalizedInventoryMovement {
  const warehouseId = input.entry.warehouseId ?? input.defaultWarehouseId
  const itemId = input.entry.itemId?.trim()

  if (!warehouseId) {
    throw new Error("Inventory movement requires a warehouse.")
  }

  if (!itemId) {
    throw new Error("Inventory movement requires an item.")
  }

  const derivedQuantities = deriveMovementQuantities(input.entry)
  const baseQuantity =
    input.entry.baseQuantity ?
      formatQuantity(toQuantityMilli(input.entry.baseQuantity))
    : formatQuantity(Math.max(derivedQuantities.quantityInMilli, derivedQuantities.quantityOutMilli))
  const inventoryValue = resolveInventoryValue({
    inventoryValue: input.entry.inventoryValue,
    totalCost: input.entry.totalCost,
    unitCost: input.entry.unitCost,
    baseQuantity,
  })
  const valueDeltaCents =
    derivedQuantities.quantityInMilli > 0 ? toCents(inventoryValue)
    : derivedQuantities.quantityOutMilli > 0 ? -toCents(inventoryValue)
    : 0

  return {
    branchId: input.entry.branchId ?? input.defaultBranchId,
    warehouseId,
    itemId,
    itemNameSnapshot: input.entry.itemNameSnapshot,
    skuSnapshot: input.entry.skuSnapshot ?? null,
    unitSnapshot: input.entry.unitSnapshot ?? input.entry.sourceUnit ?? input.entry.unit,
    itemSnapshot: input.entry.itemSnapshot ?? null,
    movementType: input.entry.movementType,
    quantity: formatQuantity(
      derivedQuantities.quantityInMilli - derivedQuantities.quantityOutMilli
    ),
    quantityIn: formatQuantity(derivedQuantities.quantityInMilli),
    quantityOut: formatQuantity(derivedQuantities.quantityOutMilli),
    unit: input.entry.unit,
    sourceUnit: input.entry.sourceUnit ?? input.entry.unit,
    baseQuantity,
    unitCost: input.entry.unitCost ? normalizeMoney(input.entry.unitCost) : null,
    totalCost: input.entry.totalCost ? normalizeMoney(input.entry.totalCost) : null,
    inventoryValue,
    batchId: input.entry.batchId ?? null,
    serialId: input.entry.serialId ?? null,
    batchNumberSnapshot: input.entry.batchNumberSnapshot ?? null,
    serialNumberSnapshot: input.entry.serialNumberSnapshot ?? null,
    transactionDate: input.entry.transactionDate ?? input.voucherDate,
    reason: input.entry.reason ?? null,
    quantityDeltaMilli:
      derivedQuantities.quantityInMilli - derivedQuantities.quantityOutMilli,
    valueDeltaCents,
  }
}

export function formatQuantity(milliUnits: number) {
  const isNegative = milliUnits < 0
  const absolute = Math.abs(milliUnits)
  const whole = Math.floor(absolute / 1000)
  const fraction = String(absolute % 1000).padStart(3, "0")

  return `${isNegative ? "-" : ""}${whole}.${fraction}`
}

export function toQuantityMilli(value: string) {
  const normalized = value.trim()
  const isNegative = normalized.startsWith("-")
  const unsigned = isNegative ? normalized.slice(1) : normalized
  const [whole = "0", fraction = ""] = unsigned.split(".")
  const milliUnits =
    Number(whole) * 1000 + Number(fraction.padEnd(3, "0").slice(0, 3))

  return isNegative ? -milliUnits : milliUnits
}

function deriveMovementQuantities(entry: InventoryEntryInput) {
  const explicitQuantityIn = toQuantityMilli(entry.quantityIn)
  const explicitQuantityOut = toQuantityMilli(entry.quantityOut)

  if (explicitQuantityIn > 0 && explicitQuantityOut > 0) {
    throw new Error("Inventory movement cannot have both quantityIn and quantityOut.")
  }

  if (explicitQuantityIn > 0 || explicitQuantityOut > 0) {
    return {
      quantityInMilli: explicitQuantityIn,
      quantityOutMilli: explicitQuantityOut,
    }
  }

  if (entry.quantity === undefined) {
    throw new Error("Inventory movement quantity is required.")
  }

  const legacyQuantity = toQuantityMilli(entry.quantity)

  if (legacyQuantity === 0) {
    throw new Error("Inventory movement quantity must be greater than zero.")
  }

  if (legacyQuantity < 0) {
    return {
      quantityInMilli: 0,
      quantityOutMilli: Math.abs(legacyQuantity),
    }
  }

  if (inboundMovementTypes.has(entry.movementType)) {
    return {
      quantityInMilli: legacyQuantity,
      quantityOutMilli: 0,
    }
  }

  if (outboundMovementTypes.has(entry.movementType)) {
    return {
      quantityInMilli: 0,
      quantityOutMilli: legacyQuantity,
    }
  }

  throw new Error(`Unsupported inventory movement type: ${entry.movementType}`)
}

function resolveInventoryValue(input: {
  inventoryValue?: string
  totalCost?: string
  unitCost?: string
  baseQuantity: string
}) {
  if (input.inventoryValue) {
    return normalizeMoney(input.inventoryValue)
  }

  if (input.totalCost) {
    return normalizeMoney(input.totalCost)
  }

  if (!input.unitCost) {
    return "0.00"
  }

  const unitCostCents = toCents(input.unitCost)
  const baseQuantityMilli = toQuantityMilli(input.baseQuantity)
  return formatCents(Math.round((unitCostCents * baseQuantityMilli) / 1000))
}
