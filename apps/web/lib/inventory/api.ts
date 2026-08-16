import { apiRequest } from "@/lib/api/client"

export type InventoryMovementType =
  | "OPENING_STOCK"
  | "PURCHASE"
  | "SALE"
  | "SALES_RETURN"
  | "PURCHASE_RETURN"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "DAMAGE"
  | "EXPIRY"

export type InventorySettings = {
  businessId: string
  negativeStockPolicy: "ALLOW" | "WARN" | "BLOCK"
  valuationMethod: "WEIGHTED_AVERAGE" | "FIFO"
}

export type InventorySummary = {
  skuCount: number
  quantityOnHand: string
  inventoryValue: string
}

export type LowStockItem = {
  itemId: string
  name: string
  sku: string
  quantityOnHand: string
  reorderLevel: string
  status: "OUT_OF_STOCK" | "LOW_STOCK" | "OK"
}

export type WarehouseStockRow = {
  id: string
  businessId: string
  itemId: string
  warehouseId: string
  quantityOnHand: string
  inventoryValue: string
  updatedAt: string
  itemName: string
  sku: string
  averageCost: string
}

export type InventoryTransaction = {
  id: string
  businessId: string
  voucherId: string | null
  sourceType: string
  sourceId: string | null
  branchId: string | null
  warehouseId: string | null
  itemId: string | null
  itemNameSnapshot: string
  skuSnapshot: string | null
  movementType: InventoryMovementType
  quantity: string
  quantityIn: string
  quantityOut: string
  unit: string
  sourceUnit: string | null
  baseQuantity: string
  unitCost: string | null
  inventoryValue: string
  transactionDate: string
  reason: string | null
  createdAt: string
}

export type InventoryTransferStatus =
  | "DRAFT"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "CANCELLED"

export type InventoryTransferLine = {
  id: string
  businessId: string
  transferId: string
  itemId: string
  itemNameSnapshot: string
  skuSnapshot: string | null
  quantity: string
  unit: string
  unitCost: string
  batchId: string | null
  serialId: string | null
  createdAt: string
}

export type InventoryTransfer = {
  id: string
  businessId: string
  sourceWarehouseId: string
  destinationWarehouseId: string
  branchId: string | null
  status: InventoryTransferStatus
  transferDate: string
  referenceNumber: string | null
  notes: string | null
  dispatchedAt: string | null
  receivedAt: string | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
  lines: InventoryTransferLine[]
}

export type OpeningStockPayload = {
  itemId: string
  warehouseId: string
  branchId?: string | null
  quantity: string
  sourceUnit?: string
  baseQuantity?: string
  unitCost: string
  transactionDate: string
  batchNumber?: string | null
  manufacturingDate?: string | null
  expiryDate?: string | null
  serialNumbers?: string[]
  reason?: string | null
}

export type InventoryAdjustmentPayload = {
  itemId: string
  warehouseId: string
  branchId?: string | null
  quantity: string
  direction: "in" | "out"
  adjustmentType: "ADJUSTMENT" | "DAMAGE" | "EXPIRY"
  sourceUnit?: string
  baseQuantity?: string
  unitCost?: string
  transactionDate: string
  batchId?: string | null
  serialId?: string | null
  reason: string
}

export type CreateInventoryTransferPayload = {
  sourceWarehouseId: string
  destinationWarehouseId: string
  branchId?: string | null
  transferDate: string
  referenceNumber?: string | null
  notes?: string | null
  lines: Array<{
    itemId: string
    quantity: string
    unit?: string
    unitCost?: string
    batchId?: string | null
    serialId?: string | null
  }>
}

export function getInventorySettings(accessToken: string) {
  return apiRequest<{ settings: InventorySettings }>("/inventory/settings", {
    method: "GET",
    accessToken,
  })
}

export function updateInventorySettings(
  payload: Partial<Pick<InventorySettings, "negativeStockPolicy" | "valuationMethod">>,
  accessToken: string
) {
  return apiRequest<{ settings: InventorySettings }>("/inventory/settings", {
    method: "PATCH",
    body: payload,
    accessToken,
  })
}

export function getInventorySummary(accessToken: string) {
  return apiRequest<{ summary: InventorySummary }>("/inventory/summary", {
    method: "GET",
    accessToken,
  })
}

export function getLowStock(accessToken: string) {
  return apiRequest<{ items: LowStockItem[] }>("/inventory/low-stock", {
    method: "GET",
    accessToken,
  })
}

export function getWarehouseStock(warehouseId: string, accessToken: string) {
  return apiRequest<{ stock: WarehouseStockRow[] }>(
    `/inventory/warehouses/${warehouseId}/stock`,
    {
      method: "GET",
      accessToken,
    }
  )
}

export function getItemLedger(
  itemId: string,
  accessToken: string,
  filters: { warehouse?: string } = {}
) {
  const params = new URLSearchParams()
  if (filters.warehouse) {
    params.set("warehouse", filters.warehouse)
  }
  const query = params.size > 0 ? `?${params.toString()}` : ""

  return apiRequest<{
    transactions: InventoryTransaction[]
    balance: { quantityOnHand: string; inventoryValue: string }
  }>(`/inventory/items/${itemId}/ledger${query}`, {
    method: "GET",
    accessToken,
  })
}

export function postOpeningStock(payload: OpeningStockPayload, accessToken: string) {
  return apiRequest<unknown>("/inventory/opening-stock", {
    method: "POST",
    body: payload,
    accessToken,
  })
}

export function postInventoryAdjustment(
  payload: InventoryAdjustmentPayload,
  accessToken: string
) {
  return apiRequest<unknown>("/inventory/adjustments", {
    method: "POST",
    body: payload,
    accessToken,
  })
}

export function listInventoryTransfers(accessToken: string) {
  return apiRequest<{ transfers: InventoryTransfer[] }>("/inventory/transfers", {
    method: "GET",
    accessToken,
  })
}

export function createInventoryTransfer(
  payload: CreateInventoryTransferPayload,
  accessToken: string
) {
  return apiRequest<{ transfer: InventoryTransfer }>("/inventory/transfers", {
    method: "POST",
    body: payload,
    accessToken,
  })
}

export function dispatchInventoryTransfer(transferId: string, accessToken: string) {
  return apiRequest<{ transfer: InventoryTransfer }>(
    `/inventory/transfers/${transferId}/dispatch`,
    {
      method: "POST",
      accessToken,
    }
  )
}

export function receiveInventoryTransfer(transferId: string, accessToken: string) {
  return apiRequest<{ transfer: InventoryTransfer }>(
    `/inventory/transfers/${transferId}/receive`,
    {
      method: "POST",
      accessToken,
    }
  )
}

export function cancelInventoryTransfer(transferId: string, accessToken: string) {
  return apiRequest<{ transfer: InventoryTransfer }>(
    `/inventory/transfers/${transferId}/cancel`,
    {
      method: "POST",
      accessToken,
    }
  )
}
