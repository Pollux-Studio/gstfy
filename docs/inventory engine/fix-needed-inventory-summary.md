# Inventory Guardrail Fix Summary

## Scope

This pass implements the corrections required by `fix-needed-inventory.md` before building the full Inventory Engine. It does not implement full transfers, reservations, FIFO costing, batch workflows, or serial lifecycle handling.

## Backend Changes

### Ledger-first inventory model

- Kept `inventory_transactions` as the stock source of truth.
- Added explicit `quantity_in` and `quantity_out` columns.
- Kept the legacy signed `quantity` column only for backward compatibility.
- Added movement snapshots:
  - `sku_snapshot`
  - `unit_snapshot`
  - `source_unit`
  - `base_quantity`
  - `batch_id`
  - `serial_id`
  - `batch_number_snapshot`
  - `serial_number_snapshot`
  - `transaction_date`
  - `reason`
  - `created_by`

### Stock balance projection

- Added `inventory_balances` as a rebuildable projection.
- Balance is keyed by:
  - `business_id`
  - `item_id`
  - `warehouse_id`
- Stores:
  - `quantity_on_hand`
  - `inventory_value`
  - `updated_at`

### Inventory policy boundary

- Added `business_inventory_settings`.
- Supported settings:
  - `negative_stock_policy`: `ALLOW`, `WARN`, `BLOCK`
  - `valuation_method`: `WEIGHTED_AVERAGE`, `FIFO`
- Existing businesses are initialized with:
  - `negative_stock_policy = WARN`
  - `valuation_method = WEIGHTED_AVERAGE`

### Cost-layer foundation

- Added `inventory_cost_layers` as a future FIFO/layer costing foundation.
- The current MVP does not consume layers yet.

### Core posting guardrails

- Core voucher posting now normalizes inventory movements before insert.
- Every inventory movement must resolve:
  - item id
  - warehouse id
  - movement direction
  - normalized base quantity
  - inventory value
  - transaction date
- Existing callers can still pass legacy `quantity`; it is converted to `quantity_in` or `quantity_out` based on movement type.
- `SALE`, `PURCHASE_RETURN`, `TRANSFER_OUT`, `ADJUSTMENT_OUT`, `DAMAGE`, and `EXPIRY` are stock-out movements.
- `OPENING_STOCK`, `PURCHASE`, `SALES_RETURN`, `TRANSFER_IN`, and `ADJUSTMENT_IN` are stock-in movements.
- When negative stock policy is `BLOCK`, outbound movement updates are guarded against insufficient warehouse stock.
- Balance updates and inventory ledger inserts happen in the same Core transaction.

## New API Surface

All routes are under `/api/v1`.

### Inventory settings

```text
GET /inventory/settings
PATCH /inventory/settings
```

Patch payload:

```json
{
  "negativeStockPolicy": "WARN",
  "valuationMethod": "WEIGHTED_AVERAGE"
}
```

### Item ledger

```text
GET /inventory/items/:id/ledger
```

Supported filters:

```text
from
to
warehouse
branch
transactionType
```

Returns movement rows with running quantity.

### Warehouse stock

```text
GET /inventory/warehouses/:id/stock
```

Returns warehouse-level projected stock by item.

## Tests Added

Added `apps/backend/src/modules/inventory/inventory.service.test.ts`.

Covered:

- Opening stock normalizes to stock-in.
- Sale normalizes to stock-out.
- Inventory value is based on cost, not selling price.
- Quantity-in and quantity-out cannot both be posted.
- Warehouse is mandatory.
- Item reference is mandatory.

## Files Changed

- `apps/backend/drizzle/0020_inventory_guardrails.sql`
- `apps/backend/src/db/schema/index.ts`
- `apps/backend/src/app.ts`
- `apps/backend/src/modules/core/core.schemas.ts`
- `apps/backend/src/modules/core/core.routes.ts`
- `apps/backend/src/modules/inventory/inventory.service.ts`
- `apps/backend/src/modules/inventory/inventory.routes.ts`
- `apps/backend/src/modules/inventory/inventory.schemas.ts`
- `apps/backend/src/modules/inventory/inventory.service.test.ts`

## Remaining For Full Inventory Engine

- Opening stock API/UI.
- Inventory adjustment API/UI.
- Stock transfer lifecycle:
  - draft
  - dispatch
  - in transit
  - receive
  - cancel
- Reservation model.
- Batch table and batch lifecycle.
- Serial number table and serial lifecycle.
- FIFO costing implementation.
- Inventory balance rebuild endpoint/admin command.
- Inventory valuation reconciliation with Accounting.
- Sales/Purchase/POS orchestration through the Inventory Engine.
- Inventory reports:
  - stock summary
  - low stock
  - out of stock
  - movement report
  - valuation report
