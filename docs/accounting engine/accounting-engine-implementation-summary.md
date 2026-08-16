# Accounting Engine Implementation Summary

This document summarizes the Accounting Engine v1 implementation completed for Sales, Purchases, and POS.

## Scope Implemented

The implementation converts domain transactions into persisted business documents and balanced accounting postings.

Implemented domains:

- Sales invoices
- Purchase bills
- POS checkout receipts

Implemented accounting behavior:

- Server-side GST calculation from line quantity, rate, GST rate, and place of supply.
- CGST + SGST split for intra-state transactions.
- IGST calculation for inter-state transactions.
- Balanced double-entry journal generation through the existing Core Voucher Engine.
- Ledger account fallback mapping through default chart accounts.
- Optional product accounting mapping support for sales and purchase accounts.
- Branch, GST registration, and warehouse dimensions on journal lines.
- Receivable/payable entries only for unpaid balances.
- Paid portions posted directly to Cash or Bank control accounts.

Out of scope for this pass:

- Stock movement.
- COGS / inventory valuation postings.
- Separate receipt/payment voucher allocation flow.
- E-invoice, e-way bill, GST return filing, or external GSTN posting.
- Advanced invoice template/PDF generation.

## Database Changes

Added migration:

```text
apps/backend/drizzle/0017_sales_purchase_pos_accounting.sql
```

### Journal Line Dimensions

Added optional dimensions to `journal_entry_lines`:

- `branch_id`
- `gst_registration_id`
- `warehouse_id`

These enable branch-wise, GSTIN-wise, and warehouse-aware accounting reports without duplicating ledger accounts.

### Default Voucher Series Backfill

Backfilled default `invoice_series` rows for existing businesses:

- `purchase` with `PUR`
- `payment` with `PAY`
- `receipt` with `RCP`
- `pos` with `POS`

This avoids posting failures for non-invoice voucher types where only the invoice series existed.

### New Domain Tables

Sales:

- `sales_invoices`
- `sales_invoice_lines`
- `sales_invoice_payments`

Purchases:

- `purchase_bills`
- `purchase_bill_lines`
- `purchase_bill_payments`

POS:

- `pos_sales`
- `pos_sale_lines`
- `pos_sale_payments`

Schema definitions were added in:

```text
apps/backend/src/db/schema/index.ts
```

## Backend Implementation

### Core Voucher Engine Integration

Updated:

```text
apps/backend/src/modules/core/core.routes.ts
apps/backend/src/modules/core/core.schemas.ts
```

Changes:

- Exported `postVoucher` as an internal service function.
- Added journal-line dimensions to the core posting schema.
- Persisted line-level branch, GST registration, and warehouse dimensions.
- Added ownership validation for line-level dimensions.

### Accounting Domain Service

Added:

```text
apps/backend/src/modules/accounting/accounting-domain.service.ts
```

Responsibilities:

- Resolve current financial year.
- Resolve GST registration and branch context.
- Calculate transaction line totals server-side.
- Determine CGST/SGST vs IGST.
- Seed default ledger accounts if missing.
- Resolve product-level accounting account mappings if present.
- Fall back to default accounts if mappings are missing.
- Build balanced journal command payloads for Sales and Purchases/POS.

Default fallback accounts used:

- `1110` Cash
- `1120` Bank
- `1130` Accounts Receivable
- `2110` Accounts Payable
- `4100` Sales
- `5100` Purchases
- `1210` Input CGST
- `1220` Input SGST
- `1230` Input IGST
- `1240` Input Cess
- `2210` Output CGST
- `2220` Output SGST
- `2230` Output IGST
- `2240` Output Cess

### Sales APIs

Added:

```text
apps/backend/src/modules/sales/sales.routes.ts
apps/backend/src/modules/sales/sales.schemas.ts
```

Endpoints:

```text
GET  /api/v1/sales/invoices
GET  /api/v1/sales/invoices/:id
POST /api/v1/sales/invoices
POST /api/v1/sales/invoices/:id/post
```

Behavior:

- Draft invoices save document data without journal posting.
- Posted invoices create a voucher and balanced journal.
- Draft invoices can be posted later.
- Paid amount posts to Cash/Bank.
- Unpaid balance posts to Accounts Receivable.

### Purchase APIs

Added:

```text
apps/backend/src/modules/purchases/purchases.routes.ts
apps/backend/src/modules/purchases/purchases.schemas.ts
```

Endpoints:

```text
GET  /api/v1/purchase-bills
GET  /api/v1/purchase-bills/:id
POST /api/v1/purchase-bills
POST /api/v1/purchase-bills/:id/post
```

Behavior:

- Draft purchase bills save document data without journal posting.
- Posted purchase bills create a voucher and balanced journal.
- Paid amount credits Cash/Bank.
- Unpaid balance credits Accounts Payable.
- Input GST entries are created for purchase GST.
- ITC eligible amount is calculated from eligible line taxes.

### POS APIs

Added:

```text
apps/backend/src/modules/pos/pos.routes.ts
apps/backend/src/modules/pos/pos.schemas.ts
```

Endpoints:

```text
GET  /api/v1/pos/sales
GET  /api/v1/pos/sales/:id
POST /api/v1/pos/checkout
```

Behavior:

- POS checkout posts immediately.
- POS payment must exactly match receipt total.
- Product lines and quick item lines are supported.
- POS receipts post using the Sales accounting path.
- Receipt details and payments are persisted.

### Route Registration

Updated:

```text
apps/backend/src/app.ts
```

Registered:

- `registerSalesRoutes`
- `registerPurchasesRoutes`
- `registerPosRoutes`

## Frontend Implementation

### API Clients

Added:

```text
apps/web/lib/sales/api.ts
apps/web/lib/purchases/api.ts
apps/web/lib/pos/api.ts
```

These clients call the new `/api/v1` backend endpoints through the existing authenticated API client.

### Sales UI

Added routes:

```text
apps/web/app/(dashboard)/invoices/page.tsx
apps/web/app/(dashboard)/invoices/new/page.tsx
apps/web/app/(dashboard)/invoices/[id]/page.tsx
```

Added components:

```text
apps/web/components/sales/sales-invoices-page.tsx
apps/web/components/sales/sales-invoice-form-page.tsx
apps/web/components/sales/sales-invoice-detail-page.tsx
```

Implemented:

- Invoice list.
- Search by invoice/customer.
- Draft/posted status display.
- Create invoice form.
- Save draft.
- Post invoice.
- Invoice detail view.
- Tax and payment summary.

### Purchase UI

Updated route:

```text
apps/web/app/(dashboard)/purchases/page.tsx
```

Added:

```text
apps/web/components/purchases/purchase-bills-api-page.tsx
```

Implemented:

- Backend-backed purchase bills list.
- Quick purchase bill capture.
- Save draft.
- Post bill.
- Purchase status and total display.

The older mock purchase add/edit/detail routes are still present and were not removed in this pass.

### POS UI

Added route:

```text
apps/web/app/(dashboard)/pos/page.tsx
```

Added component:

```text
apps/web/components/pos/pos-page.tsx
```

Implemented:

- Product search.
- Quick item entry.
- Cart table.
- Payment mode selection.
- Checkout posting.
- Recent receipts list.

### Sidebar Wiring

Updated:

```text
apps/web/lib/dashboard/modules.ts
```

Changed:

- Invoices now links to `/invoices`.
- POS now links to `/pos`.

## Accounting Posting Examples

### Sales Invoice

For an intra-state invoice:

```text
Cash / Bank / Accounts Receivable     Dr
    Sales                                  Cr
    Output CGST                            Cr
    Output SGST                            Cr
```

For an inter-state invoice:

```text
Cash / Bank / Accounts Receivable     Dr
    Sales                                  Cr
    Output IGST                            Cr
```

### Purchase Bill

For an intra-state purchase:

```text
Purchases                              Dr
Input CGST                             Dr
Input SGST                             Dr
    Cash / Bank / Accounts Payable         Cr
```

For an inter-state purchase:

```text
Purchases                              Dr
Input IGST                             Dr
    Cash / Bank / Accounts Payable         Cr
```

### POS Checkout

POS uses the Sales posting model and must be fully paid:

```text
Cash / Bank                         Dr
    Sales                               Cr
    Output GST                          Cr
```

## Verification Performed

Passed:

```text
pnpm --filter @gstfy/backend check-types
pnpm --filter @gstfy/backend test
pnpm --filter web typecheck
```

Scoped ESLint passed for the new/changed files:

```text
apps/backend/src/modules/accounting/accounting-domain.service.ts
apps/backend/src/modules/sales
apps/backend/src/modules/purchases
apps/backend/src/modules/pos
apps/backend/src/modules/core/core.routes.ts
apps/backend/src/modules/core/core.schemas.ts
apps/backend/src/app.ts
apps/backend/src/db/schema/index.ts
apps/web/components/sales
apps/web/components/pos
apps/web/components/purchases/purchase-bills-api-page.tsx
apps/web/lib/sales
apps/web/lib/pos
apps/web/lib/purchases/api.ts
apps/web/app/(dashboard)/invoices
apps/web/app/(dashboard)/pos
apps/web/app/(dashboard)/purchases/page.tsx
```

Full repo lint still has unrelated existing blockers in auth/CA/settings and one organization warning.

## Known Gaps / Next Steps

- Add dedicated Sales invoice edit/cancel/credit-note workflow.
- Replace older mock purchase add/edit/detail pages with backend-backed detail and edit flows.
- Add receipt/payment voucher modules and formal payment allocation.
- Add stock movement and COGS through Inventory Engine.
- Add PDF/print/WhatsApp delivery for invoices and POS receipts.
- Add accounting report drill-down from journal line to source document.
- Add domain tests for Sales, Purchase, and POS posting scenarios.
