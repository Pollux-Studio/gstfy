# Core Engine Implementation Summary

Date: 2026-08-16

This document records what was implemented from `docs/core-engine.md`.

The purpose of this work was to add the backend foundation for GSTfy's shared transaction engine, where one posted voucher becomes the source for accounting, inventory, GST, receivable/payable, payment allocation, audit, and reporting effects.

## Executive Summary

Implemented the first backend core engine layer:

```text
Voucher
  -> Journal Entry
  -> Journal Lines
  -> Inventory Entries
  -> GST Entries
  -> Receivable / Payable Entries
  -> Payment Allocations
  -> Audit Logs
```

The system now has:

- Core ledger tables.
- A transactional voucher posting endpoint.
- Idempotency key support.
- Balanced journal validation.
- Transactional voucher number allocation from `invoice_series`.
- Business, GST registration, branch, warehouse, and financial-year ownership checks.
- Branch scope enforcement for non-owner/non-admin users.
- Period-lock rejection.
- Audit logging for posted vouchers.

This is a foundation layer only. Sales, purchase, inventory valuation, GST return generation, party/product masters, and reports are still future work.

## Files Added Or Changed

### Backend

| File | Purpose |
|---|---|
| `apps/backend/drizzle/0011_core_engine_foundation.sql` | Adds voucher, posting idempotency, journal, inventory, GST, AR/AP, payment allocation, audit, and accounting period tables. |
| `apps/backend/src/db/schema/index.ts` | Adds Drizzle schema and exported types for all core engine tables. |
| `apps/backend/src/modules/core/core.schemas.ts` | Adds Zod schemas for voucher posting and voucher list/detail route inputs. |
| `apps/backend/src/modules/core/core.routes.ts` | Adds `/api/v1/core` routes, posting pipeline, validation, idempotency, numbering, and audit. |
| `apps/backend/src/app.ts` | Registers the core routes under `/api/v1`. |

### Frontend

| File | Purpose |
|---|---|
| `apps/web/lib/core/api.ts` | Adds typed frontend API helpers for listing, reading, and posting vouchers. |

## Database Tables Added

### `vouchers`

Common posted transaction header.

Fields:

```text
id
business_id
gst_registration_id nullable
branch_id nullable
warehouse_id nullable
voucher_type
voucher_number
voucher_date
financial_year_id
status
reference_voucher_id nullable
created_by
posted_by
posted_at
cancelled_at
notes
created_at
updated_at
```

Important constraints/indexes:

```text
UNIQUE(business_id, financial_year_id, voucher_type, voucher_number)
INDEX(business_id)
INDEX(branch_id)
INDEX(warehouse_id)
INDEX(gst_registration_id)
INDEX(reference_voucher_id)
```

### `posting_idempotency_keys`

Prevents duplicate postings from retrying the same request.

Fields:

```text
id
business_id
idempotency_key
request_hash
status
voucher_id
response_body
created_at
updated_at
```

Constraint:

```text
UNIQUE(business_id, idempotency_key)
```

Behavior:

- Same key + same request returns the original completed response.
- Same key + different request returns `409`.
- Same key while original is still in progress returns `409`.

### `journal_entries`

Accounting entry header for a voucher.

Fields:

```text
id
business_id
voucher_id
entry_date
description
created_by
posted_at
created_at
updated_at
```

### `journal_entry_lines`

Balanced debit/credit lines for accounting.

Fields:

```text
id
business_id
journal_entry_id
account_code
account_name
debit numeric(14,2)
credit numeric(14,2)
narration
created_at
```

Invariant enforced by posting route:

```text
SUM(debit) = SUM(credit)
```

Each line must have exactly one side populated:

```text
debit > 0 and credit = 0
or
credit > 0 and debit = 0
```

### `inventory_transactions`

Event-based stock movements derived from a voucher.

Fields:

```text
id
business_id
voucher_id
branch_id
warehouse_id
item_id
item_name_snapshot
movement_type
quantity numeric(14,3)
unit
unit_cost numeric(14,2)
total_cost numeric(14,2)
created_at
```

Supported movement types:

```text
PURCHASE
SALE
SALES_RETURN
PURCHASE_RETURN
TRANSFER_OUT
TRANSFER_IN
ADJUSTMENT
DAMAGE
EXPIRY
```

### `gst_entries`

GST ledger effects linked to source voucher.

Fields:

```text
id
business_id
voucher_id
gst_registration_id
branch_id
entry_type
tax_component
tax_rate numeric(5,2)
taxable_value numeric(14,2)
tax_amount numeric(14,2)
place_of_supply_state_code
itc_eligibility
created_at
```

Supported entry types:

```text
output
input
rcm_liability
rcm_itc
adjustment
```

Supported tax components:

```text
cgst
sgst
igst
cess
```

### `receivable_payable_entries`

Open AR/AP entries created by sales, purchases, expenses, receipts, and payments.

Fields:

```text
id
business_id
voucher_id
party_id
party_name_snapshot
entry_type
original_amount numeric(14,2)
settled_amount numeric(14,2)
outstanding_amount numeric(14,2)
due_date
status
created_at
updated_at
```

Supported entry types:

```text
receivable
payable
```

Supported statuses:

```text
open
partially_settled
settled
written_off
```

### `payment_allocations`

Links payments/receipts to source documents.

Fields:

```text
id
business_id
payment_voucher_id
document_voucher_id
receivable_payable_entry_id
allocated_amount numeric(14,2)
allocated_at
```

This supports:

```text
full payment
partial payment
multiple payments
advance/unallocated payment foundation
```

### `audit_logs`

Immutable activity records for core events.

Fields:

```text
id
business_id
entity_type
entity_id
action
user_id
before jsonb
after jsonb
reason
created_at
```

Initial action written by the posting engine:

```text
POSTED
```

### `accounting_periods`

Period status foundation for locking/review workflows.

Fields:

```text
id
business_id
gst_registration_id nullable
financial_year_id
period_type
period_start
period_end
status
created_at
updated_at
```

Supported statuses by design:

```text
open
under_review
ready
exported
filed
locked
```

Current enforcement:

```text
status = locked rejects normal posting
```

## Backend APIs Added

All APIs are under:

```text
/api/v1/core
```

### List Vouchers

```text
GET /api/v1/core/vouchers?limit=50
```

Returns recent vouchers scoped to the authenticated business.

### Voucher Detail

```text
GET /api/v1/core/vouchers/:id
```

Returns:

```text
voucher
journalEntries + lines
inventoryEntries
gstEntries
receivablePayableEntries
paymentAllocations
```

### Post Voucher

```text
POST /api/v1/core/vouchers/post
Header: Idempotency-Key: <unique-key>
```

Body shape:

```text
voucherType
voucherDate
financialYearId
gstRegistrationId optional
branchId optional
warehouseId optional
referenceVoucherId optional
documentType optional
seriesCode default DEFAULT
notes optional
journal.lines
inventoryEntries optional
gstEntries optional
receivablePayableEntries optional
paymentAllocations optional
```

Returns:

```text
voucher.id
voucher.voucherNumber
voucher.voucherType
voucher.voucherDate
voucher.status
effects counts
```

## Posting Pipeline Implemented

Current posting flow:

```text
parse request
  -> require idempotency key
  -> validate balanced journal
  -> verify module permission
  -> verify branch scope
  -> begin DB transaction
  -> reserve idempotency key
  -> verify financial year/GST/branch/warehouse/reference ownership
  -> reject locked accounting period
  -> verify effect references
  -> allocate voucher number from invoice_series
  -> create voucher
  -> create journal entry + lines
  -> create inventory entries
  -> create GST entries
  -> create receivable/payable entries
  -> create payment allocations
  -> create audit log
  -> store idempotency response
  -> commit
```

If any step fails, the transaction rolls back.

## Voucher Types Supported

```text
SALES
PURCHASE
RECEIPT
PAYMENT
CREDIT_NOTE
DEBIT_NOTE
SALES_RETURN
PURCHASE_RETURN
EXPENSE
JOURNAL
STOCK_TRANSFER
STOCK_ADJUSTMENT
```

## Number Allocation

Voucher numbers are allocated server-side from `invoice_series`.

Allocation input:

```text
business_id
financial_year_id
series_code
document_type
gst_registration_id optional
branch_id optional
```

Behavior:

- Branch-specific series is preferred when `branch_id` is present.
- Otherwise, a business/GST/financial-year series with `branch_id IS NULL` is used.
- `next_number` is incremented inside the database transaction.
- Returned number uses:

```text
prefix-000001-suffix
```

if suffix exists, otherwise:

```text
prefix-000001
```

## Permission Enforcement

Owner/admin:

```text
allowed
```

Staff:

```text
business membership
  -> module permission canCreate
  -> branch scope if scoped
```

Voucher type to module mapping:

| Voucher Type | Permission Module |
|---|---|
| `SALES` | `invoices` |
| `RECEIPT` | `invoices` |
| `CREDIT_NOTE` | `invoices` |
| `SALES_RETURN` | `invoices` |
| `PURCHASE` | `purchases` |
| `PAYMENT` | `purchases` |
| `DEBIT_NOTE` | `purchases` |
| `PURCHASE_RETURN` | `purchases` |
| `EXPENSE` | `expenses` |
| `JOURNAL` | `reports` |
| `STOCK_TRANSFER` | `inventory` |
| `STOCK_ADJUSTMENT` | `inventory` |

Branch scoped staff must post against an assigned branch.

## Tenant Safety

The core engine never trusts client-provided `businessId`.

Business is resolved from:

```text
access token
tenant header / workspace context
business membership
```

Verified references:

```text
financial_year_id
gst_registration_id
branch_id
warehouse_id
reference_voucher_id
payment document voucher ids
receivable/payable entry ids
```

Branch + warehouse pair must be linked through:

```text
branch_warehouses
```

## Mapping To `docs/core-engine.md`

| Requirement | Status | Implementation |
|---|---:|---|
| Common voucher model | Done | Added `vouchers` table and `/core/vouchers` APIs. |
| Posted transaction ledger as source of truth | Done at foundation level | Voucher and effect tables are now the persisted source for future reporting. |
| Core entities | Done | Added vouchers, journals, inventory, GST, AR/AP, payment allocation, audit tables. |
| Voucher types | Done | Initial voucher type enum implemented in schema. |
| Voucher lifecycle | Partial | Posting creates `posted`. Draft/update/cancel workflows are not built yet. |
| Posting pipeline | Partial/Done foundation | Transactional posting route creates all supplied effects atomically. Product/party/tax engines are still future work. |
| Organization context | Done | Supports business, GST registration, branch, warehouse, financial year, user. |
| Accounting contract | Done | Balanced journal invariant is enforced. |
| Inventory contract | Done at ledger level | Inventory entries can be posted with source voucher. Stock valuation and availability checks are pending. |
| Tax contract | Partial | GST entries exist, but canonical `calculateTax()` is not implemented yet. |
| GST ledger | Done at ledger level | GST entries are persisted against vouchers. |
| Receivable/payable | Done at ledger level | AR/AP entries and allocations are persisted. |
| References | Done at foundation level | `reference_voucher_id` exists on vouchers. |
| Central warehouse scenario | Done at validation level | Branch + warehouse context is supported and link-validated. |
| Stock transfers | Partial | Voucher type and inventory movements exist. Transfer workflow/status is pending. |
| Number allocation | Done | Uses transactional `invoice_series.next_number` update. |
| Idempotency | Done | `posting_idempotency_keys` implemented. |
| Money | Done | Uses PostgreSQL `NUMERIC`; frontend/backend payloads normalize decimals as strings. |
| Permissions | Done for posting | Module create permission and branch scope are enforced. |
| Audit | Done | Posting writes `POSTED` audit logs. |
| Periods | Partial | `accounting_periods` exists and `locked` blocks posting. Full period workflow pending. |
| Reporting | Pending | Report queries are not implemented yet. |
| External compliance outbox | Pending | E-invoice/e-way bill outbox is not implemented yet. |

## Frontend API Helper

Added:

```text
apps/web/lib/core/api.ts
```

Exports:

```text
getVouchers()
getVoucher()
postVoucher()
```

This is intentionally only an API helper. No UI screens were added for the core engine in this step.

## Validation Completed

Commands passed:

```bash
pnpm --filter @gstfy/backend check-types
pnpm --filter web typecheck
pnpm --filter @gstfy/backend exec eslint src/modules/core/core.routes.ts src/modules/core/core.schemas.ts src/db/schema/index.ts
pnpm --filter web exec eslint lib/core/api.ts
```

## Still Pending

The following are intentionally not implemented yet:

1. Party master.
2. Product master.
3. Canonical tax calculator.
4. Sales invoice document table/UI.
5. Purchase invoice document table/UI.
6. Draft voucher lifecycle.
7. Voucher cancellation workflow.
8. Credit note/debit note document-specific flows.
9. Inventory stock availability checks.
10. Inventory valuation.
11. Stock transfer workflow with in-transit status.
12. AR/AP settlement updates after allocations.
13. Accounting period workflow beyond `locked` rejection.
14. Report queries.
15. GST return summaries from posted data.
16. External compliance outbox for e-invoice/e-way bill.
17. Automated integration tests for posting edge cases.

## Final State

GSTfy now has the core ledger foundation needed before building Sales, Purchases, Inventory, GST Returns, and CA Review.

The key architectural rule is now represented in code:

```text
Record the business event once as a voucher.
Derive accounting, inventory, GST, AR/AP, payment, audit and reporting effects from that voucher.
```
