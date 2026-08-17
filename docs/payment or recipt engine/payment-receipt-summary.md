# Payment & Receipt Engine Summary

## Scope Completed

The Payment & Receipt Engine now owns GSTfy money movement and settlement workflows:

```text
Sales Invoice -> Receivable -> Receipt -> Allocation
Purchase Bill -> Payable    -> Payment -> Allocation
```

It does not calculate GST, manage products, own Party Master data, or mutate invoice/purchase source documents directly except for derived settlement projections.

## Backend Implementation

### Database

Added migrations:

```text
apps/backend/drizzle/0032_payment_receipt_engine.sql
apps/backend/drizzle/0033_journal_entry_source_columns.sql
apps/backend/drizzle/0034_payment_receipt_hardening.sql
apps/backend/drizzle/0035_payment_receipt_production_guards.sql
apps/backend/drizzle/0036_bank_reconciliation_v2.sql
```

Created:

```text
receipts
payments
```

Enhanced:

```text
payment_allocations
```

with:

```text
allocation_kind
receipt_id
payment_id
status
created_by
reversed_by
reversed_at
reversal_reason
updated_at
```

`payment_allocations` is now an explicit typed settlement table:

```text
allocation_kind = receipt
  receipt_id -> receipts.id
  target     -> receivable_payable_entries where entry_type = receivable

allocation_kind = payment
  payment_id -> payments.id
  target     -> receivable_payable_entries where entry_type = payable
```

Migration `0033` fixes the local DB/schema mismatch by adding:

```text
journal_entries.source_type
journal_entries.source_id
```

and backfills existing journal rows using the voucher id.

Migration `0034` hardens the engine with:

```text
receipt_date/payment_date as DATE
receipt/payment unallocated_treatment
business-scoped composite FKs
amount split CHECK constraints
typed allocation CHECK constraints
receipt/payment allocation direction trigger
```

Migration `0035` adds production guards:

```text
money_operation_idempotency_keys
bank_reconciliation_matches
row-locking allocation trigger
target outstanding over-allocation guard
receipt/payment source amount over-allocation guard
```

Migration `0036` adds Bank Reconciliation v2:

```text
bank_statement_imports
bank_statement_lines
bank_reconciliation_matches.statement_line_id
business-scoped statement import/account constraints
statement-line match status
receipt/payment statement-line uniqueness
```

### Routes

Registered the payment/receipt module under:

```text
/api/v1
```

Implemented:

```text
GET    /receipts
POST   /receipts
GET    /receipts/export
GET    /receipts/:id
PATCH  /receipts/:id
DELETE /receipts/:id
POST   /receipts/:id/post
POST   /receipts/:id/allocations
DELETE /receipts/:id/allocations/:allocationId
POST   /receipts/:id/reverse

GET    /payments
POST   /payments
GET    /payments/export
GET    /payments/:id
PATCH  /payments/:id
DELETE /payments/:id
POST   /payments/:id/post
POST   /payments/:id/allocations
DELETE /payments/:id/allocations/:allocationId
POST   /payments/:id/reverse

GET    /receivables
GET    /receivables/export
GET    /payables
GET    /payables/export

GET    /payment-reports/aging
GET    /payment-reports/aging/export
GET    /payment-reports/cash-flow
GET    /payment-reports/cash-flow/export

GET    /bank-reconciliation
POST   /bank-reconciliation
GET    /bank-reconciliation/statement-lines
POST   /bank-reconciliation/import
POST   /bank-reconciliation/auto-match
DELETE /bank-reconciliation/:id
```

### Business Rules

Receipts are allowed only for active customer parties.

Payments are allowed only for active supplier parties.

Draft receipts/payments:

```text
can be edited
can be deleted
do not affect accounting
do not affect AR/AP
```

Posted receipts/payments:

```text
cannot be edited as normal records
can receive additional allocations
can have allocations reversed
can be fully reversed
```

### Accounting Behavior

Receipt posting:

```text
Cash/Bank Dr
    Receivable Cr
    Customer Advance Cr / Unapplied Customer Receipts Cr
```

Payment posting:

```text
Payable Dr
Supplier Advance Dr / Unapplied Supplier Payments Dr
    Cash/Bank Cr
```

Unallocated money is explicit at entry time:

```text
Record as advance -> known customer/supplier advance
Keep unapplied    -> unidentified or not-yet-confirmed remittance
```

The backend records this as:

```text
receipts.unallocated_treatment
payments.unallocated_treatment
```

Later allocation changes create adjustment journals so the ledger stays aligned with AR/AP settlement.

Receipt allocation after posting:

```text
Customer Advance / Unapplied Customer Receipts Dr
    Receivable Cr
```

Receipt allocation removal:

```text
Receivable Dr
    Customer Advance / Unapplied Customer Receipts Cr
```

Payment allocation after posting:

```text
Payable Dr
    Supplier Advance / Unapplied Supplier Payments Cr
```

Payment allocation removal:

```text
Supplier Advance / Unapplied Supplier Payments Dr
    Payable Cr
```

Full reversal:

```text
reverses active allocations
reverses related allocation adjustment journals
creates reversing journal for the original receipt/payment voucher
marks the receipt/payment reversed
restores AR/AP outstanding
```

### Settlement Source of Truth

Settlement is derived from active allocation rows:

```text
Sales receivable:
original_amount
- SUM(active receipt allocations)
= outstanding

Purchase payable:
original_amount
- SUM(active payment allocations)
= outstanding
```

The backend refreshes:

```text
receivable_payable_entries.settled_amount
receivable_payable_entries.outstanding_amount
receivable_payable_entries.status
```

and updates sales/purchase document paid/due projections from that settlement state.

### Validation

The backend rejects:

```text
cross-business allocations
cross-business receipt/payment references at DB level
cross-party allocations
inactive customer/supplier role usage
inactive or non-posting cash/bank ledger accounts
allocations above receipt/payment amount
allocations above target outstanding amount
allocations against closed/cancelled targets
receipt allocations against payable entries
payment allocations against receivable entries
deleting posted documents
reversing draft documents
```

The database also enforces:

```text
amount > 0
allocated_amount >= 0
unallocated_amount >= 0
allocated_amount + unallocated_amount = amount
allocation_kind in receipt/payment
receipt allocations must have receipt_id only
payment allocations must have payment_id only
```

The production allocation trigger locks both:

```text
target receivable/payable entry
source receipt/payment document
```

before checking allocation totals. This prevents two concurrent requests from
allocating more than the outstanding entry amount or more than the receipt/payment
source amount.

### Idempotency

Receipt/payment mutations now support operation-level idempotency through:

```text
Idempotency-Key header
body.idempotencyKey
```

Covered operations:

```text
create receipt/payment
post receipt/payment
add receipt/payment allocation
reverse receipt/payment
mark bank reconciliation
bank statement import
bank statement auto-match
```

Rules:

```text
same key + same payload -> stored completed response
same key + changed payload -> 409 conflict
same key while running -> 409 in progress
failed operation key -> 409 failed state
```

### Error Handling

Unexpected backend failures now return:

```text
Something went wrong. Please try again.
```

Raw SQL and DB params are logged server-side only and are no longer leaked into frontend toast messages.

Sales and purchase schemas were also hardened to accept `null` for optional text/date fields where the frontend naturally sends null.

## Frontend Implementation

Added API client:

```text
apps/web/lib/payment-receipt/api.ts
```

Added shared UI:

```text
apps/web/components/payment-receipt/money-page.tsx
```

Added dashboard pages:

```text
apps/web/app/(dashboard)/receipts/page.tsx
apps/web/app/(dashboard)/receipts/[receiptId]/page.tsx
apps/web/app/(dashboard)/payments/page.tsx
apps/web/app/(dashboard)/payments/[paymentId]/page.tsx
apps/web/app/(dashboard)/receivables/page.tsx
apps/web/app/(dashboard)/payables/page.tsx
apps/web/app/(dashboard)/payment-reports/page.tsx
apps/web/app/(dashboard)/bank-reconciliation/page.tsx
```

Added sidebar section:

```text
Money
├── Receipts
├── Payments
├── Receivables
├── Payables
├── Payment Reports
└── Bank Reconciliation
```

### Receipts / Payments UI

Implemented:

```text
summary metric cards
search
status filter
payment method filter
paginated infinite-scroll table
CSV export
detail page
allocation history table
document audit timestamps
create and post dialog
allocation input
advance vs unapplied selector
draft delete dialog
posted reverse dialog
loading skeleton
empty state
toast feedback
```

The list action is state-aware:

```text
Draft  -> Delete
Posted -> Reverse
Reversed -> Closed
```

### Receivables / Payables UI

Implemented:

```text
outstanding summary cards
search
status filter
paginated infinite-scroll table
receive/pay action
prefilled receipt/payment dialog from selected AR/AP row
```

### Reports UI

Implemented:

```text
receivable aging
payable aging
cash-flow by payment method
date range filters
receipt/payment/net movement metrics
CSV export for aging reports
CSV export for cash-flow report
```

### Bank Reconciliation UI

Implemented:

```text
posted non-cash receipt/payment register
unmatched/reconciled filter
search by number, party, or reference
statement date and bank reference capture
mark reconciled
undo reconciliation
reconciled/unmatched totals
CSV statement import
imported statement-line register
automatic matching against posted bank receipts/payments
statement-line status refresh after match/undo
```

### Browser E2E

Added a Playwright browser smoke spec:

```text
apps/web/e2e/payment-receipt.spec.mjs
```

It verifies the core payment/receipt navigation surfaces:

```text
Receipts
Payments
Payment Reports
Bank Reconciliation
Bank statement import dialog
```

Run it from the web app after installing Playwright and preparing an authenticated storage state:

```bash
pnpm --filter web e2e:payments
```

## Permissions

The new pages are wired to the existing accounting permission module:

```text
/receipts
/payments
/receivables
/payables
```

Owners/admins can access directly. Other users need accounting module permissions.

## Validation Run

Passed:

```text
pnpm --filter @gstfy/backend lint
pnpm --filter @gstfy/backend check-types
pnpm --filter @gstfy/backend test
pnpm --filter web typecheck
git diff --check
```

New backend tests cover:

```text
settlement outstanding formula
target over-allocation rejection
source document over-allocation rejection
exact allocation acceptance
idempotency hash stability
idempotency changed-payload detection
row-locking migration guard presence
```

New opt-in real Postgres load test:

```text
apps/backend/src/modules/payment-receipt/payment-receipt.concurrent-postgres.test.ts
```

It creates a temporary business, receipt, and receivable, then fires 20 concurrent allocation inserts against a ₹500 target. The expected outcome is exactly five successful ₹100 allocations and no over-allocation.

It is skipped during normal tests. Enable it explicitly:

```bash
RUN_POSTGRES_CONCURRENCY_TEST=true pnpm --filter @gstfy/backend test
```

Known unrelated issue:

```text
pnpm --filter web lint
```

still reports existing React Compiler `set-state-in-effect` errors in older CA/auth/settings components. The payment/receipt implementation itself is type-safe.

## Current Limitations

The current implementation is structurally complete for normal receipt/payment workflows. Remaining enhancements are product-depth items:

```text
cheque lifecycle
allocation drawer from document detail page
bank statement imported-line manual pairing UI
bank statement file format presets per bank
browser E2E coverage for complete create/post/reverse flows
full bank statement import reconciliation differences report
```

## Operational Notes

After pulling these changes, restart the backend so auto-migrations apply:

```text
0032_payment_receipt_engine.sql
0033_journal_entry_source_columns.sql
0034_payment_receipt_hardening.sql
0035_payment_receipt_production_guards.sql
0036_bank_reconciliation_v2.sql
```

If the backend is already running, stop and start it again before testing receipt/payment posting.

## Final Flow

```text
1. Sales/Purchase posts a voucher.
2. Core creates receivable/payable entries.
3. Receivables/Payables page lists open entries.
4. User records receipt/payment.
5. Backend posts money voucher and allocations.
6. Active allocations update AR/AP settlement.
7. Unallocated amounts go to the selected advance or unapplied holding account.
8. Reconciliation can be manual or auto-matched from imported statement lines.
9. Reversal restores outstanding and reverses accounting.
```

The engine now separates obligation creation from money movement, and it has a database-backed reconciliation path for imported bank statements.
