import assert from "node:assert/strict"
import test from "node:test"

import type { PostVoucherInput } from "../core/core.schemas.js"
import { normalizeInventoryMovementForPosting } from "./inventory.service.js"

type InventoryEntry = PostVoucherInput["inventoryEntries"][number]

const baseEntry: InventoryEntry = {
  branchId: null,
  warehouseId: "2a1d600d-2ff4-49ef-a0b1-3d26e987be35",
  itemId: "item-cycle-tyre",
  itemNameSnapshot: "Cycle tyre",
  movementType: "OPENING_STOCK",
  quantityIn: "0",
  quantityOut: "0",
  unit: "PCS",
}

test("opening stock is normalized as stock-in with inventory value", () => {
  const movement = normalizeInventoryMovementForPosting({
    entry: {
      ...baseEntry,
      movementType: "OPENING_STOCK",
      quantity: "10",
      unitCost: "250.00",
    },
    voucherDate: "2026-08-16",
    defaultBranchId: null,
    defaultWarehouseId: null,
  })

  assert.equal(movement.quantityIn, "10.000")
  assert.equal(movement.quantityOut, "0.000")
  assert.equal(movement.quantity, "10.000")
  assert.equal(movement.inventoryValue, "2500.00")
  assert.equal(movement.quantityDeltaMilli, 10000)
  assert.equal(movement.valueDeltaCents, 250000)
})

test("sale is normalized as stock-out without using sales price as cost", () => {
  const movement = normalizeInventoryMovementForPosting({
    entry: {
      ...baseEntry,
      movementType: "SALE",
      quantity: "2",
      unitCost: "180.00",
      totalCost: "360.00",
    },
    voucherDate: "2026-08-16",
    defaultBranchId: null,
    defaultWarehouseId: null,
  })

  assert.equal(movement.quantityIn, "0.000")
  assert.equal(movement.quantityOut, "2.000")
  assert.equal(movement.quantity, "-2.000")
  assert.equal(movement.inventoryValue, "360.00")
  assert.equal(movement.quantityDeltaMilli, -2000)
  assert.equal(movement.valueDeltaCents, -36000)
})

test("explicit quantity in and out cannot both be posted", () => {
  assert.throws(
    () =>
      normalizeInventoryMovementForPosting({
        entry: {
          ...baseEntry,
          quantityIn: "1",
          quantityOut: "1",
        },
        voucherDate: "2026-08-16",
        defaultBranchId: null,
        defaultWarehouseId: null,
      }),
    /Inventory movement cannot have both quantityIn and quantityOut/
  )
})

test("movement requires a warehouse from either entry or voucher context", () => {
  assert.throws(
    () =>
      normalizeInventoryMovementForPosting({
        entry: {
          ...baseEntry,
          warehouseId: null,
          quantity: "1",
        },
        voucherDate: "2026-08-16",
        defaultBranchId: null,
        defaultWarehouseId: null,
      }),
    /requires a warehouse/
  )
})

test("movement requires an auditable item reference", () => {
  assert.throws(
    () =>
      normalizeInventoryMovementForPosting({
        entry: {
          ...baseEntry,
          itemId: undefined,
          quantity: "1",
        },
        voucherDate: "2026-08-16",
        defaultBranchId: null,
        defaultWarehouseId: null,
      }),
    /requires an item/
  )
})
