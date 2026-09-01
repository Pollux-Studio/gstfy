# GST Filing Integration Engine Summary

## Existing Foundation

Before this implementation, GSTfy already had the upstream filing prerequisites:

- GST Reporting generated period snapshots from posted GST facts.
- Filing Review handled blocking exceptions, CA approval, and ready-for-submission state.
- GSTR-1 and GSTR-3B report datasets were available for preview/export.
- ITC reconciliation and reporting data stayed separate from source sales/purchase records.

The missing layer was the controlled statutory submission boundary: immutable filing attempts, payload versioning, external adapter status, acknowledgement persistence, retry history, and submission idempotency.

## Backend Added

Migration `0051_gst_filing_integration_engine.sql` adds:

- `gst_filing_runs` for filing attempts per business, GSTIN, period, return type, reporting run, and attempt number.
- `gst_filing_payloads` for immutable canonical and external payload snapshots.
- `gst_filing_status_events` for status/event audit trail.
- `gst_filing_idempotency_keys` for retry-safe mutation handling.

Hardening migration `0052_gst_filing_hardening.sql` adds:

- `external_response_received_at` for provider response receipt audit.
- `acknowledgement_artifact_id` as a future secured document reference.
- `correction_required_at` and `correction_reason` for rejected business filings.
- A database check that raw external responses must have a received timestamp.

Backend module `gst-filing` adds:

- Filing run creation from approved `READY_FOR_SUBMISSION` reporting runs only.
- Canonical payload generation for `GSTR1` and `GSTR3B`.
- External adapter payload generation with schema versions `gstr1:v1` and `gstr3b:v1`.
- Pre-submission validation for GSTIN snapshot, source hash, approval, ready state, and required payload sections.
- Mock adapter submission modes: accept, reject, processing, timeout.
- Provider-specific mock behavior behind the `GstFilingAdapter` boundary.
- Status polling and final `FILED` transition.
- Acknowledgement and external rejection/error persistence.
- Retry creation for technical failures only.
- Rejected business filings require source/reporting correction and a new reporting run.
- Duplicate submission recovery for runs already in external-submission states or with an external reference.
- Cancellation for pre-submit or failed attempts.
- Audit log and status events for every lifecycle mutation.
- Module-permission checks through the existing GST permission model.

Implemented APIs:

```text
GET  /api/v1/gst-filings/runs
POST /api/v1/gst-filings/runs
GET  /api/v1/gst-filings/runs/:id
POST /api/v1/gst-filings/runs/:id/validate
POST /api/v1/gst-filings/runs/:id/submit
POST /api/v1/gst-filings/runs/:id/status
POST /api/v1/gst-filings/runs/:id/retry
POST /api/v1/gst-filings/runs/:id/cancel
GET  /api/v1/gst-filings/runs/:id/acknowledgement
```

## Frontend Added

The GST workspace now includes a dedicated `Filing History` tab.

It supports:

- Creating `GSTR-1` and `GSTR-3B` filing runs from the selected ready reporting run.
- Selecting a mock adapter outcome for development testing.
- Validating filing payloads before submission.
- Submitting ready filing attempts.
- Polling processing/accepted attempts.
- Retrying rejected, failed, or cancelled attempts.
- Cancelling draft/validated/ready/failed attempts.
- Viewing acknowledgement numbers.
- Viewing detail drill-down with metrics, validation issues, generated payload hashes, and status trail.
- Empty, loading, status, rejection, and acknowledgement UI states.

## State Flow

```text
Reporting Run READY_FOR_SUBMISSION
      ↓
Filing Run DRAFT
      ↓
VALIDATED / READY_FOR_SUBMISSION
      ↓
SUBMITTING
      ↓
PROCESSING / ACCEPTED / REJECTED / FAILED
      ↓
FILED
```

Rejected, failed, or cancelled runs are not mutated into a fresh attempt. The retry action creates a new attempt number.

Business rejection is stricter:

```text
REJECTED
  ↓
Correct source/reporting data
  ↓
New reporting run approval
  ↓
New filing run
```

Technical timeout/failure is retryable:

```text
FAILED
  ↓
Retry same approved reporting snapshot
```

## Source Data Rule

The Filing Engine never recalculates tax and never reads mutable source transactions directly for submission.

It depends on:

```text
Approved GST Reporting Run
      ↓
Canonical Filing Payload
      ↓
Adapter Payload
      ↓
External Status / Acknowledgement
```

## Verification

Completed checks:

```text
pnpm --filter @gstfy/backend check-types
pnpm --filter @gstfy/backend lint
pnpm --filter @gstfy/backend test
pnpm --filter web typecheck
pnpm --filter web exec eslint components\gst\gst-workspace-page.tsx lib\gst-filing\api.ts
```

Backend tests include filing operation hashing, canonical payload hashing, validation blockers, validation success, status transition guards, mock adapter outcomes, and schema-version stability.

The hardening pass expanded the backend suite to include valid GSTR-1 and GSTR-3B
fixtures, invalid GSTIN, schema mismatch, GSTR-1 tax mismatch, GSTR-3B ITC mismatch,
invalid HSN/SAC, blocking exception, timeout, rejected-provider response, technical
retry rules, and duplicate-submission recovery protection.

## Remaining Work

This engine is structurally complete for mock filing.

Remaining real-world work:

- Real GSTN/GSP adapter once credentials and provider contract details are available.
- Provider-specific acknowledgement artifact download/storage implementation.
- Full return-for-correction UI that creates a new reporting version from a rejected filing.
