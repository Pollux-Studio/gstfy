# Product Engine Implementation Summary

Implemented the backend and frontend foundation from `docs/engine/product/product-engine.md`.

## Backend

- Added migration `0014_product_engine_foundation.sql`.
- Added configurable master tables:
  - `hsn_sac_codes`
  - `uqc_codes`
- Added Product Engine tables:
  - `items`
  - `item_tax_profiles`
  - `item_units`
  - `item_prices`
  - `item_suppliers`
  - `item_barcodes`
  - `item_inventory_profiles`
  - `item_accounting_profiles`
- Added Drizzle schema mappings and exported record types.
- Added `/api/v1/products` routes:
  - `GET /products`
  - `POST /products`
  - `GET /products/:id`
  - `PATCH /products/:id`
  - `DELETE /products/:id`
  - `GET /products/masters`
  - `GET /products/:id/resolve`
  - child routes for tax profiles, prices, suppliers, barcodes, units, inventory profile, and accounting profile.
- Enforced tenant-scoped access through `requirePrimaryBusinessAccess`.
- Reused the existing `inventory` permission module for product access.
- Added validation for:
  - SKU uniqueness per business.
  - HSN/SAC from configurable master.
  - HSN for goods and SAC for services.
  - UQC from configurable master.
  - tax profile effective date overlap.
  - price profile effective date overlap.
  - supplier party ownership and supplier role.
  - warehouse ownership for inventory defaults.
  - ledger account ownership for accounting defaults.
  - barcode uniqueness per business.
- Product delete archives the item instead of hard-deleting it.
- Product resolver returns snapshot-ready defaults without calculating GST components, live stock, invoice totals, or journal entries.
- Product changes write audit events.

## Frontend

- Added `apps/web/lib/products/api.ts`.
- Added `apps/web/components/products/products-page.tsx`.
- Added route `apps/web/app/(dashboard)/products/page.tsx`.
- Updated the sidebar Inventory module to open `Products`.
- Product UI supports:
  - search by product-related fields.
  - filter by item type and status.
  - create product with tax, unit, price, inventory, and barcode defaults.
  - edit core product fields.
  - archive product.
  - view resolved defaults.
  - fill dummy product data for development.

## Scope Preserved

Product Engine does not own:

- live stock calculation
- CGST/SGST/IGST split
- invoice totals
- journal posting
- customer/supplier balances
- GST return generation

Those remain responsibilities of Inventory, Tax, Sales/Purchase, Accounting, and GST engines.

## Verification

- `pnpm --filter @gstfy/backend check-types`
- `pnpm --filter web typecheck`
- Scoped backend ESLint on Product Engine files
- Scoped web ESLint on Product Engine files
