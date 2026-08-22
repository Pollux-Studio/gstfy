# GST-FILING-INTEGRATION-ENGINE.md

## Purpose

The next module is the statutory filing boundary between GSTfy's approved Reporting Run and external GST/GSTN systems.

```text
Transactions
    ↓
Tax / ITC
    ↓
GST Reporting
    ↓
CA Review
    ↓
CA Approval
    ↓
Filing Integration
    ↓
External GST System
    ↓
Acknowledgement / Status
```

The Filing Engine must not recalculate GST, decide ITC, or edit source transactions.

## 1. Filing State Machine

```text
DRAFT
CA_REVIEW
CA_APPROVED
READY_FOR_SUBMISSION
SUBMITTING
SUBMITTED
PROCESSING
ACCEPTED
FILED
REJECTED
FAILED
CANCELLED
```

Do not equate `READY` or `SUBMITTED` with `FILED`.

## 2. Filing Run

```text
gst_filing_runs
---------------
id
business_id
gst_registration_id
reporting_run_id
return_type
period
status
attempt_number
submitted_at
accepted_at
acknowledgement_number
external_reference
error_code
error_message
created_by
approved_by
submitted_by
created_at
updated_at
```

Initial return types:

```text
GSTR1
GSTR3B
```

## 3. Reporting Run Dependency

A filing run must reference an approved/locked:

```text
reporting_run_id
```

Never submit directly from live transactional tables.

## 4. CA Approval

Before submission:

```text
Reporting Run
 -> CA Review
 -> CA Approved
 -> Ready For Submission
```

Record:

```text
approved_by
approved_at
approval_comment
```

Unauthorized users cannot approve.

## 5. Canonical Filing Payload

Generate an internal payload first:

```text
return_type
GSTIN
period
sections
totals
source_reporting_run
schema_version
generated_at
content_hash
```

Then adapt it:

```text
Canonical Payload
    ↓
GSTR-1 adapter / GSTR-3B adapter
    ↓
External schema
```

This keeps the reporting domain independent of portal formats.

## 6. Schema Versioning

Every external payload is versioned:

```text
gstr1:v1
gstr3b:v1
```

Portal/schema changes create a new adapter/version, not a rewrite of historical reports.

## 7. Pre-Submission Validation

Validate:

```text
GSTIN
period
reporting run locked
CA approval
required sections
tax totals
ITC totals
RCM totals
HSN/SAC where applicable
classifications
no blocking exceptions
```

Return structured validation results.

## 8. Adapter Interface

Create:

```text
GstFilingAdapter
```

with:

```text
validate(payload)
submit(payload)
getStatus(reference)
getAcknowledgement(reference)
```

Adapters:

```text
Mock/Sandbox
Official GSTN
```

Build against Mock/Sandbox first.

## 9. Credential Boundary

Portal credentials belong to the secure filing integration layer.

Never expose:

```text
GSTN credentials
API tokens
client secrets
```

to the frontend or store them in ordinary business tables.

## 10. Idempotent Submission

Prevent duplicate filing when network requests retry.

Use a stable submission identity based on:

```text
business
GSTIN
return_type
period
reporting_run_id
submission_key
```

If an external submission already exists, recover its status instead of blindly submitting again.

## 11. External Processing

Support:

```text
SUBMITTED
  ↓
PROCESSING
  ↓
ACCEPTED / REJECTED / FAILED
```

Persist:

```text external_reference
status_code
status_message
last_polled_at
```

Never show final success while the external system says PROCESSING.

## 12. Acknowledgement

Persist:

```text
acknowledgement_number
acknowledgement_date
external_reference
filing_status
```

Store the acknowledgement artifact in the document/storage system when available.

## 13. Rejection

Persist:

```text external_error_code
external_error_message
rejected_at
raw_external_response
```

Map external errors to:

```text
VALIDATION_ERROR
SCHEMA_ERROR
AUTH_ERROR
BUSINESS_RULE_ERROR
DUPLICATE_SUBMISSION
PERIOD_ERROR
SERVER_ERROR
```

## 14. Correction Workflow

A rejection must create a correction path:

```text
Rejected
  ↓
Review error
  ↓
Correct source/reporting data
  ↓
New reporting version
  ↓
CA Review
  ↓
CA Approval
  ↓
New submission attempt
```

Never mutate the previously submitted payload.

## 15. Filing History

Show:

```text
Return
GSTIN
Period
Reporting Run
Submitted At
Status
Acknowledgement
Attempts
Errors
Approved By
Submitted By
```

## 16. Backend APIs

```text
POST /api/v1/gst-filings/runs
GET  /api/v1/gst-filings/runs
GET  /api/v1/gst-filings/runs/:id
POST /api/v1/gst-filings/runs/:id/validate
POST /api/v1/gst-filings/runs/:id/submit
POST /api/v1/gst-filings/runs/:id/status
POST /api/v1/gst-filings/runs/:id/retry
POST /api/v1/gst-filings/runs/:id/cancel
GET  /api/v1/gst-filings/runs/:id/acknowledgement
```

Mutation endpoints require authorization and idempotency.

## 17. Frontend

GST navigation:

```text
GST
├── Overview
├── Reconciliation
├── ITC
├── Filing Review
├── GSTR-1
├── GSTR-3B
└── Filing History
```

Filing Review should show:

```text
GSTIN
Period
Return Type
Output GST
ITC
RCM
Net Tax
Blocking Exceptions
```

CA actions:

```text
Approve
Return for Correction
```

Submission screen shows:

```text
payload version
content hash
validation result
GSTIN
period
return type
```

Then:

```text
Submit
```

## 18. Submission UX

Show:

```text
Validating...
Submitting...
Processing...
Accepted
```

or:

```text
Rejected
```

Never display a successful filing while status is still PROCESSING.

## 19. Rejection UX

Show:

```text
External Error Code
Message
Affected Section
Source/Reporting Reference
```

Actions:

```text
View Filing Data
View Source
Create Correction Run
```

Do not edit submitted data in place.

## 20. Mock Adapter

Development must support:

```text
MOCK_ACCEPT
MOCK_REJECT
MOCK_PROCESSING
MOCK_TIMEOUT
```

Validation is handled by `/validate`; mock modes control the submission adapter response. This allows full lifecycle testing without real GST credentials.

## 21. Audit

Events:

```text
FILING_RUN_CREATED
FILING_VALIDATED
FILING_CA_APPROVED
FILING_SUBMITTED
FILING_STATUS_UPDATED
FILING_ACCEPTED
FILING_REJECTED
FILING_RETRY
FILING_CANCELLED
```

Record:

```text actor
timestamp
GSTIN
period
return type
previous status
new status
reason
external reference
```

## 22. Security

Validate:

```text business access
GSTIN ownership
period ownership
CA approval permission
submission permission
```

No portal credentials may be returned to frontend clients.

## 23. Tests

Pre-submission:

```text
[x] invalid GSTIN / missing GSTIN snapshot
[x] missing section
[x] missing source hash
[x] missing CA approval
[x] missing ready-for-submission state
[x] full tax mismatch fixture
[x] full ITC mismatch fixture
[x] invalid HSN/SAC fixture
```

CA:

```text
[x] approve through reporting run approval flow
[x] return-for-correction backend guard
[x] unauthorized approval blocked by module permissions
```

Submission:

```text
[x] mock accept
[x] mock reject
[x] mock processing
[x] timeout/retry
[x] duplicate submission prevention
```

History:

```text
[x] acknowledgement persisted
[x] external error persisted
[x] submitted payload immutable
```

## Definition of Done

### Backend

```text
[x] filing run
[x] CA approval dependency through reporting run
[x] canonical payload
[x] schema version
[x] validation
[x] GSTR-1 adapter
[x] GSTR-3B adapter
[x] mock adapter
[x] submission state machine
[x] status polling
[x] acknowledgement
[x] rejection handling
[x] retry/idempotency
[x] audit
[x] permissions
[x] filing history
[x] tests
```

### Frontend

```text
[x] filing review
[x] CA approval
[x] pre-submit validation
[x] submission action
[x] processing state
[x] acknowledgement
[x] rejection workflow
[x] filing history
[x] payload/status detail drill-down
[x] permissions via backend enforcement
[x] loading/empty/error states
```

## Implementation Status

The implemented engine is a mock-adapter filing boundary. It creates filing attempts from approved reporting runs, generates immutable canonical and external payloads, validates the payload, submits through the mock adapter, polls status, persists acknowledgements or rejection errors, supports technical retry/cancel flows, and exposes filing history in the GST workspace.

Rejected filings are treated as business rejections, not retryable network failures. They require source/reporting correction and a new reporting run before another filing run can be created.

External responses now retain received-at metadata and reserve `acknowledgement_artifact_id` for future secured document storage.

The real GSTN/GSP adapter is intentionally not implemented until production credentials, provider contract details, and sandbox certification flow are available.

## What This Engine Must NOT Own

```text
Tax calculation
ITC eligibility
Party CRUD
Product CRUD
Sales/Purchase creation
Inventory
Payment/Receipt
Bank reconciliation
GST reporting facts
CA client master
```

## Final Architecture

```text
GST Sources
   ↓
Tax / ITC / Reporting
   ↓
Locked Reporting Run
   ↓
CA Review
   ↓
CA Approval
   ↓
Canonical Filing Payload
   ↓
Schema Adapter
   ↓
External GST System
   ↓
Submission Status
   ↓
Acknowledgement
   ↓
Filing History
```

## Final Rule

> The Filing Integration Engine is the controlled boundary between GSTfy's approved reporting snapshot and external statutory systems. It versions and validates payloads, enforces CA approval, prevents duplicate submissions, persists external status and acknowledgements, and never modifies the approved source data.
