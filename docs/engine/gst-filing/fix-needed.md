# FIX-NEEDED-GST-FILING.md

## Final hardening before E-Invoice

The Filing Integration Engine is structurally complete for mock filing:

```text
Approved Reporting Run
  -> Canonical Payload
  -> Versioned Adapter
  -> Mock Submission
  -> Processing / Accepted / Rejected / Failed
  -> Acknowledgement / Filing History
```

The remaining implementation notes identify real GSTN/GSP integration, correction workflow, acknowledgement artifact storage, and broader validation fixtures as future work. fileciteturn23file0L116-L125

### 1. Keep ACCEPTED and FILED separate

Never infer:

```text
API success == FILED
```

Keep:

```text
SUBMITTED
PROCESSING
ACCEPTED
FILED
```

and let the external adapter explicitly determine the final state.

**Implemented:** `ACCEPTED` remains separate from `FILED`. The mock adapter returns
`ACCEPTED` on successful submit and only moves to `FILED` through explicit status
polling.

### 2. Separate technical retry from business correction

Technical failure:

```text
FAILED / TIMEOUT
  -> retry same reporting snapshot
```

Business rejection:

```text
REJECTED
  -> fix source/reporting data
  -> new reporting version
  -> CA review
  -> new filing run
```

Never mutate a submitted payload.

**Implemented:** `FAILED` is the only technical retry state. `REJECTED` now requires
source/reporting correction and blocks retry or another attempt on the same reporting
run.

### 3. Immutable payloads

Persist and freeze:

```text
reporting_run_id
filing_run_id
payload hash
schema version
canonical payload
provider payload
```

after submission.

**Implemented:** filing payloads are persisted once per filing run and payload type.
Submitted/external attempts recover existing status/reference instead of regenerating
or resubmitting.

### 4. External response retention

Preserve:

```text
external reference
acknowledgement number/date
status
error code
error message
raw response reference
received_at
```

**Implemented:** `external_response_received_at`, correction metadata, raw response,
external reference, acknowledgement number/date, and status-event raw responses are
persisted. `acknowledgement_artifact_id` is reserved for secured document storage.

### 5. Submission idempotency

Test:

```text
submit
network timeout
retry
```

Expected:

```text
no duplicate external filing
```

Always check existing external references/status before resubmission.

**Implemented:** submit checks protected external states and existing external
references before adapter submission. It returns the existing filing status instead of
creating another provider call.

### 6. Processing-state protection

If status is:

```text
PROCESSING
```

do not create another filing attempt until the provider confirms failure/expiry.

**Implemented:** non-terminal filing attempts, including `PROCESSING`, are returned as
the active attempt. No new attempt is created until a terminal technical state exists.

### 7. Acknowledgement artifact

When the real provider is integrated, store acknowledgement artifacts through the secured document/storage layer, not as large blobs in filing tables.

**Prepared:** `acknowledgement_artifact_id` is available for future document/storage
linking. The mock adapter does not generate binary acknowledgement artifacts.

### 8. Provider adapter boundary

Keep all provider-specific:

```text
authentication
payload schema
submit endpoint
status polling
acknowledgement parsing
```

inside provider adapters.

**Implemented:** mock submit/status behavior now lives behind the
`GstFilingAdapter` boundary in `gst-filing.adapters.ts`.

### 9. Validation fixtures

Add fixtures for:

```text
valid GSTR-1
valid GSTR-3B
tax mismatch
ITC mismatch
invalid HSN/SAC
missing GSTIN
blocking exception
schema error
provider reject
provider processing
timeout
duplicate submission
```

**Implemented:** domain fixtures now cover valid GSTR-1, valid GSTR-3B, tax mismatch,
ITC mismatch, invalid HSN/SAC, missing/invalid GSTIN, blocking exception, schema error,
provider reject, provider processing, timeout, retry semantics, and duplicate-submission
recovery rules.

### Definition of Done

```text
[x] ACCEPTED vs FILED semantics
[x] technical retry vs business correction
[x] immutable payloads
[x] response retention
[x] idempotent submission
[x] processing protection
[x] acknowledgement storage metadata
[x] adapter boundary
[x] full fixture coverage
```
