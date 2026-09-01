# GST Reporting, Filing Review & Compliance Engine - Implementation Summary

## What Was Added

GSTfy now has a dedicated GST Reporting layer that sits after Sales, POS, Returns/Credit/Debit Notes, ITC, and GST Reconciliation.

The engine converts posted source data into controlled reporting runs for:

- GSTR-1
- GSTR-3B
- HSN/SAC summary
- Document summary
- Filing review
- Blocking compliance exceptions
- CSV, JSON, and XLSX exports

The reporting layer does not recalculate transaction GST and does not decide ITC eligibility. It consumes posted tax facts, ITC decisions, and reconciliation state.

## Backend Changes

Added migration:

```text
apps/backend/drizzle/0049_gst_reporting_filing_review_engine.sql
```

New tables:

- `gst_reporting_runs`
- `gst_reporting_facts`
- `gst_reporting_exceptions`
- `gst_reporting_exports`
- `gst_reporting_idempotency_keys`

The schema is scoped by:

```text
business_id
gst_registration_id
period
```

This keeps each GSTIN and tax period isolated.

Hardening migration:

```text
apps/backend/drizzle/0050_gst_reporting_hardening.sql
```

This adds:

- `version`
- `period_start`
- `period_end`
- `gstin_snapshot`
- `source_data_hash`
- CA approval audit fields
- ready-for-submission audit fields
- submitted/filed audit fields
- versioned uniqueness per business + GSTIN + period
- duplicate source-line identity protection

## Reporting Run Flow

A reporting run is the auditable artifact for one GSTIN and one period.

Statuses:

```text
DRAFT
REVIEW
READY_FOR_CA_REVIEW
CA_APPROVED
READY_FOR_SUBMISSION
SUBMITTED
FILED
```

Flow:

```text
Create / Refresh Run
      ↓
Build Reporting Facts
      ↓
Generate Exceptions
      ↓
Review GSTR-1 / GSTR-3B / Filing Review
      ↓
Ready for CA Review
      ↓
CA Approve
      ↓
Ready for Submission
      ↓
Submit / File
      ↓
Export
```

`READY_FOR_CA_REVIEW`, `CA_APPROVED`, and `READY_FOR_SUBMISSION` are separate states. Marking a run ready never means filed.

Locked/submitted/filed runs are immutable. Reopening creates a new run version for the same GSTIN and period.

## Source Data Covered

Reporting facts are generated from:

- Posted sales invoices
- Posted POS sales
- Posted adjustment documents
- ITC/reconciliation exceptions
- Draft documents in the period for filing blockers

Draft documents are never inserted into `gst_reporting_facts`; they only create blocking exceptions.

Adjustments are report-classified as:

- `CREDIT_NOTE`
- `DEBIT_NOTE`
- `PURCHASE_CREDIT_ADJUSTMENT`
- `PURCHASE_DEBIT_ADJUSTMENT`

## API Surface

Added backend module:

```text
apps/backend/src/modules/gst-reporting
```

Registered routes:

```text
POST /api/v1/gst-reporting/runs
GET  /api/v1/gst-reporting/runs
GET  /api/v1/gst-reporting/runs/:id
POST /api/v1/gst-reporting/runs/:id/refresh
POST /api/v1/gst-reporting/runs/:id/mark-ready
POST /api/v1/gst-reporting/runs/:id/approve
POST /api/v1/gst-reporting/runs/:id/lock
POST /api/v1/gst-reporting/runs/:id/submit
POST /api/v1/gst-reporting/runs/:id/mark-filed
POST /api/v1/gst-reporting/runs/:id/reopen

GET /api/v1/gst-reporting/gstr1
GET /api/v1/gst-reporting/gstr1/export
GET /api/v1/gst-reporting/gstr3b
GET /api/v1/gst-reporting/gstr3b/export

GET  /api/v1/gst-reporting/hsn-summary
GET  /api/v1/gst-reporting/document-summary
GET  /api/v1/gst-reporting/review
GET  /api/v1/gst-reporting/exceptions
POST /api/v1/gst-reporting/exceptions/resolve
GET  /api/v1/gst-reporting/drilldown
```

## Export Support

Supported export formats:

- CSV
- JSON
- XLSX

XLSX export is generated without adding a new dependency. The backend creates a valid zipped XLSX payload directly.

Export records are persisted with:

- format
- report type
- GSTIN snapshot
- file name
- content type
- SHA-256 content hash
- run version
- source data hash
- exported timestamp
- exported user

## Filing Review

The filing review shows:

- Output GST
- Input GST
- Net GST payable
- RCM
- Eligible ITC
- Deferred ITC
- Reversed ITC
- Unresolved exception count
- Section summaries

Sections covered:

- Sales
- Returns and notes
- HSN/SAC
- Documents
- Exceptions

## Exception Gate

Generated exceptions include:

- Missing HSN/SAC
- Missing GSTIN on registered supply
- Invalid CGST/SGST split
- Open GST reconciliation exceptions
- Incomplete ITC decisions
- Draft sales, purchases, POS, or adjustment documents in the period
- Source completeness mismatch
- Duplicate reporting fact
- Source tax total mismatch

High and blocker exceptions prevent the run from moving forward.

In the hardened workflow, they prevent:

- ready for CA review
- CA approval
- ready for submission

## Frontend Changes

Added frontend API client:

```text
apps/web/lib/gst-reporting/api.ts
```

Updated GST workspace:

```text
apps/web/components/gst/gst-workspace-page.tsx
```

New GST tabs:

- Filing Review
- GSTR-1
- GSTR-3B

The workspace now supports:

- GSTIN selector
- Period selector
- Generate reporting run
- Refresh reporting run
- Mark ready for CA review
- CA approve
- Ready for submission
- GSTR-1 summaries
- GSTR-3B summaries
- HSN summary
- Document summary
- CSV/JSON/XLSX exports
- Empty states
- Loading states
- Run status badge

## Security And Integrity

The backend validates:

- Authenticated business access
- GST registration ownership
- Business-scoped report access
- Permission checks for GST report create/edit/delete actions
- Idempotency for run mutations
- GST registration effective-period validation
- Source hash storage before approval
- Versioned immutable reopening
- Duplicate reporting fact checks
- Source completeness checks
- GSTR-1/GSTR-3B source tax cross-check exceptions

The database stores reporting data by business, GSTIN, and period so reports cannot accidentally combine multiple GST registrations.

## Tests And Verification

Added domain tests:

```text
apps/backend/src/modules/gst-reporting/gst-reporting.domain.test.ts
```

Added browser workflow coverage:

```text
apps/web/e2e/gst-reporting.spec.mjs
```

Covered:

- Outward supply classification
- Adjustment reporting classification
- GST period range conversion
- XLSX payload generation
- Inclusive and exclusive period boundaries

Verified:

```text
pnpm --filter @gstfy/backend check-types
pnpm --filter @gstfy/backend lint
pnpm --filter @gstfy/backend test
pnpm --filter @gstfy/backend build
pnpm --filter web typecheck
pnpm --filter web exec eslint components/gst/gst-workspace-page.tsx lib/gst-reporting/api.ts e2e/gst-reporting.spec.mjs
pnpm --filter web build
```

Current note:

```text
pnpm --filter web lint
```

still fails on existing unrelated React Compiler lint issues in older files. The new GST reporting frontend files pass targeted lint.

## Current Limitations

These are intentionally left for later statutory integration:

- Official GST portal JSON schema adapter
- Direct GST filing API integration
- GSTN credential-backed submission
- Dedicated CA approval dashboard UI
- Deep source document drill-down pages from every report number

The current implementation is a controlled internal reporting and review layer, ready to feed the future statutory filing adapter.
