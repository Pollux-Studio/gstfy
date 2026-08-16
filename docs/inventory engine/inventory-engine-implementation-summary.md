# Inventory Engine Implementation Summary

## Backend Scope

Implemented the inventory engine as a transaction-ledger system with balance projections.

### Schema and Migration

- Added `apps/backend/drizzle/0021_inventory_engine.sql`.
- Allowed `inventory_transactions.voucher_id` to be nullable so standalone stock events can exist without accounting vouchers.
- Added `source_type` and `source_id` to inventory transactions for auditability across vouchers, opening stock, adjustments, and transfers.
- Added stock transfer foundation:
  - `stock_transfers`
  - `stock_transfer_lines`
- Added batch and serial foundation:
  - `inventory_batches`
  - `inventory_serial_numbers`
- Updated Drizzle schema exports for all new inventory tables and transaction source fields.

### Inventory APIs

Implemented in `apps/backend/src/modules/inventory/inventory.routes.ts`.

- `GET /api/v1/inventory/settings`
- `PATCH /api/v1/inventory/settings`
- `GET /api/v1/inventory/summary`
- `GET /api/v1/inventory/low-stock`
- `GET /api/v1/inventory/warehouses/:id/stock`
- `GET /api/v1/inventory/items/:id/ledger`
- `POST /api/v1/inventory/opening-stock`
- `POST /api/v1/inventory/adjustments`
- `GET /api/v1/inventory/transfers`
- `POST /api/v1/inventory/transfers`
- `POST /api/v1/inventory/transfers/:id/dispatch`
- `POST /api/v1/inventory/transfers/:id/receive`
- `POST /api/v1/inventory/transfers/:id/cancel`
- `POST /api/v1/inventory/rebuild-balance`

### Engine Rules Implemented

- Inventory transactions are the source of truth.
- `inventory_balances` is a projection table.
- Warehouse is the stock boundary.
- Goods-only inventory tracking is enforced.
- Product `item_inventory_profiles.track_inventory = false` prevents stock posting.
- Opening stock posts `OPENING_STOCK`.
- Adjustments post `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `DAMAGE`, or `EXPIRY`.
- Transfers follow lifecycle:
  - `DRAFT`
  - `DISPATCHED`
  - `RECEIVED`
  - `CANCELLED`
- Dispatch posts `TRANSFER_OUT` from source warehouse.
- Receive posts `TRANSFER_IN` into destination warehouse.
- Negative stock policy is enforced:
  - `BLOCK` rejects insufficient outbound stock.
  - `WARN` and `ALLOW` permit projection updates.
- Rebuild endpoint recomputes balance from transactions.
- Batch number is captured on opening stock.
- Serial numbers can be registered on opening stock with uniqueness protection.

### Voucher Integration

Updated `apps/backend/src/modules/accounting/accounting-domain.service.ts`.

- Posted sales, purchase bills, and POS flows now generate inventory entries automatically for tracked goods.
- Services and non-tracked goods are ignored by inventory.
- Tracked goods require a warehouse before posting.
- Purchases of tracked goods debit Inventory instead of generic Purchases.
- Sales of tracked goods post stock-out and add COGS journal lines using weighted average cost.
- Inventory movement value uses cost, not selling price.

## Frontend Scope

Added a dedicated Inventory workspace.

### New Files

- `apps/web/lib/inventory/api.ts`
- `apps/web/components/inventory/inventory-page.tsx`
- `apps/web/app/(dashboard)/inventory/page.tsx`

### UI Coverage

- Inventory summary cards:
  - Tracked SKUs
  - Quantity on hand
  - Stock value
  - Negative stock policy
- Warehouse stock table with ledger action.
- Low-stock watch list.
- Opening stock form.
- Stock adjustment form.
- Item ledger panel.
- Transfer creation form.
- Transfer list with dispatch, receive, and cancel actions.
- Inventory settings tab for negative stock policy and valuation method.

### Navigation

- Inventory category now contains:
  - `Inventory` at `/inventory`
  - `Products` at `/products`
- Sidebar icons differentiate stock operations from product master data.

## Validation

Commands run:

```bash
pnpm --filter @gstfy/backend check-types
pnpm --filter @gstfy/backend test
pnpm --filter @gstfy/backend lint
pnpm --filter web typecheck
pnpm --filter web exec eslint "components/inventory/inventory-page.tsx" "lib/inventory/api.ts" "app/(dashboard)/inventory/page.tsx"
```

Notes:

- Backend typecheck, tests, and lint passed.
- Web typecheck passed.
- New inventory frontend files lint passed.
- Full web lint still has pre-existing React Compiler lint errors in CA/auth/settings files outside this inventory implementation.
