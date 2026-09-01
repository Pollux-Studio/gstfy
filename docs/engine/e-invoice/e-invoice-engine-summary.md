# E-Invoice Engine Implementation Summary

## Existing System Context

GSTFY already has the source systems required for e-invoice generation:

- Sales invoices are posted as immutable source documents.
- Credit notes and debit notes are represented by the adjustment document engine.
- Party Master provides customer/supplier identity, GSTINs, registered addresses, and snapshots.
- Tax Engine provides CGST/SGST/IGST/cess line totals.
- Accounting, Inventory, Returns, GST Reporting, and GST Filing engines consume posted transaction data without owning e-invoice state.

The e-invoice engine is implemented as a compliance layer around those source documents. It does not create invoices, recalculate tax, mutate accounting, or change inventory.

## Backend Changes

Migration added:

```text
apps/backend/drizzle/0053_e_invoice_engine.sql
```

New database tables:

- `e_invoice_records`
- `e_invoice_payloads`
- `e_invoice_status_events`
- `e_invoice_idempotency_keys`

Main backend module:

```text
apps/backend/src/modules/e-invoice/
```

Implemented backend capabilities:

- E-invoice eligibility checks for posted B2B tax invoices and eligible adjustment documents.
- Canonical payload generation for supplier, recipient, document, item, tax, total, and reference details.
- Payload validation before IRN submission.
- Deterministic payload hashing for historical immutability.
- Idempotency protection for create, validate, generate, retry, poll, and cancel actions.
- Mock provider adapter for IRN generation, processing state, rejection, timeout, and cancellation testing.
- Status event timeline for auditability.
- Cancellation workflow with reason and remarks.
- Response payload capture for canonical, provider response, status poll, and cancellation response records.
- Tenant-safe checks using business-scoped records.

Registered API routes under:

```text
/api/v1/e-invoices
```

Important endpoints:

- `GET /api/v1/e-invoices`
- `GET /api/v1/e-invoices/eligibility`
- `POST /api/v1/e-invoices`
- `GET /api/v1/e-invoices/:id`
- `POST /api/v1/e-invoices/:id/validate`
- `POST /api/v1/e-invoices/:id/generate`
- `POST /api/v1/e-invoices/:id/status`
- `POST /api/v1/e-invoices/:id/retry`
- `POST /api/v1/e-invoices/:id/cancel`
- `GET /api/v1/e-invoices/:id/response`

## Frontend Changes

New route:

```text
apps/web/app/(dashboard)/e-invoices/page.tsx
```

New workspace component:

```text
apps/web/components/e-invoice/e-invoice-page.tsx
```

New API client:

```text
apps/web/lib/e-invoice/api.ts
```

Navigation and permission updates:

- Added E-Invoice under the Compliance sidebar group.
- Mapped `/e-invoices` to the `einvoice` permission module.
- Added source invoice selection from posted sales invoices.
- Added e-invoice table with status, GSTIN, source document, IRN, date, and actions.
- Added validate, generate IRN, poll status, retry, cancel, and view response flows.
- Added detail dialog with summary, validation errors, payload history, and status timeline.

## Workflow

Normal flow:

```text
Posted B2B sales invoice
  ↓
Create e-invoice record
  ↓
Validate canonical payload
  ↓
Generate IRN through provider adapter
  ↓
Store IRN, acknowledgement, signed QR, provider reference
  ↓
Expose status and response history in UI
```

Cancellation flow:

```text
IRN generated
  ↓
User enters cancellation reason and remarks
  ↓
Provider cancellation call
  ↓
Record marked CANCELLED
  ↓
Source invoice remains unchanged
```

## Provider Model

The current implementation uses the IRP5 provider adapter only.

Runtime e-invoice generation, status refresh, and cancellation use:

- IRP5 authentication
- IRP5 encrypted request payloads
- IRP5 decrypted response data
- IRP-returned IRN, acknowledgement number/date, signed invoice, and signed QR code

Mock provider generation is not available in the frontend or backend runtime path.

## Validation Rules Implemented

The engine validates:

- Source document is posted.
- Source document has not already generated an IRN.
- Recipient GSTIN is present for eligible B2B flows.
- Supplier and recipient GSTIN formats are valid.
- HSN/SAC is present on taxable lines.
- Quantity, taxable value, and line total are positive and consistent.
- Document totals match line-level taxable and tax totals.
- Status transitions are controlled.
- Failed technical submissions can be retried, but generated/cancelled records cannot be regenerated.

## Tests

Added e-invoice domain tests covering:

- Eligibility for posted B2B invoices.
- B2C not-required behavior.
- Duplicate IRN prevention.
- Canonical payload validation.
- HSN validation.
- Payload hash stability.
- Idempotency request hash behavior.
- Mock provider IRN generation.
- Processing status recovery.
- Cancellation transition guard.
- Retry eligibility.
- Existing provider reference recovery.

Verification run:

```text
pnpm --filter @gstfy/backend exec tsx --test src/modules/e-invoice/e-invoice.domain.test.ts
pnpm --filter @gstfy/backend test
pnpm --filter @gstfy/backend check-types
pnpm --filter @gstfy/backend lint
pnpm --filter @gstfy/backend build
pnpm --filter web typecheck
pnpm --filter web build
```

Current backend suite result:

```text
83 tests
78 passed
5 skipped real-Postgres concurrency tests from other engines
0 failed
```

## Current Limitations

These are intentional for the current phase:

- NIC/GSTN production credential operation depends on valid IRP5 credentials and `EINVOICE_LIVE_ENABLED=true`.
- E-invoice threshold enforcement is not tied to audited annual turnover yet.
- Frontend source picker currently focuses on posted sales invoices; backend supports credit/debit note source types.
- E-way bill integration remains separate.
- Signed QR rendering on the invoice PDF is not wired into invoice templates yet.
- Direct GST portal filing remains outside current scope.

## Final State

The E-Invoice Engine is structurally ready as an IRP5-backed compliance workflow:

```text
Sales / Adjustment Source Document
  ↓
E-Invoice Eligibility
  ↓
Canonical Payload
  ↓
Provider Adapter
  ↓
IRN / QR / Ack Storage
  ↓
Audit + Status Timeline
```

Before production IRN submission, configure IRP5 credentials, enable live operations, and verify the business GSTIN authentication test.
