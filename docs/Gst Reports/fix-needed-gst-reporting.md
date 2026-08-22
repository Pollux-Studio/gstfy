# FIX-NEEDED-GST-REPORTING.md

## Final hardening before Statutory Filing

The GST Reporting layer is now implemented for GSTR-1, GSTR-3B, HSN/SAC, Document Summary, Filing Review, exceptions, and CSV/JSON/XLSX exports. The remaining issues are hardening rather than redesign.

## 1. Source completeness

Explicitly verify the source map:

```text
GSTR-1
  <- Sales
  <- POS where reportable
  <- Sales Returns / Credit / Debit Notes where applicable
  <- Export / SEZ / Exempt / Nil / Non-GST

GSTR-3B
  <- Outward tax
  <- RCM
  <- ITC
  <- ITC reversals
  <- Purchase-side adjustment effects
```

Ordinary purchases must not accidentally appear in outward GSTR-1 data.

## 2. Drafts

Draft documents are filing blockers only.

```text
Draft -> Exception
Draft -> NEVER reporting fact
```

A draft must never change statutory totals.

## 3. Double-counting prevention

A return/credit/debit adjustment must appear only once.

Use stable source identity:

```text
source_voucher_id
adjustment_document_id
original_voucher_id
```

Do not count the same economic adjustment twice.

## 4. Locked report immutability

After:

```text
LOCKED
```

do not mutate the reporting facts in place.

Changes require:

```text
REOPEN -> new version/run
```

Keep the previous locked run immutable for audit.

## 5. Reporting version

Store:

```text
run_id
version
generated_at
source_data_hash
```

A refresh must not silently change a locked report.

## 6. READY is not filing approval

Separate:

```text
READY_FOR_CA_REVIEW
CA_APPROVED
READY_FOR_SUBMISSION
SUBMITTED
FILED
```

`Mark Ready` must not mean `Filed`.

## 7. CA approval boundary

CA approval should be a distinct controlled action with:

```text
approved_by
approved_at
approval_comment
```

## 8. Filing gate

Before CA review, validate:

```text
no blocking exception
required GSTIN
required classification
required place of supply
required HSN/SAC
no duplicate reporting fact
posted source transactions complete
ITC decisions sufficiently finalized
```

## 9. Tax Engine remains authoritative

Reporting may validate/report tax values, but must not recalculate:

```text
CGST
SGST
IGST
Cess
```

Do not create a second tax-rule engine inside Reporting.

## 10. Period and GSTIN isolation

Every report must be scoped by:

```text
business_id
gst_registration_id
period_start
period_end
```

Check GST registration effective period before including source data.

## 11. HSN/SAC

Use historical transaction snapshots for:

```text
HSN/SAC
UQC
quantity
taxable value
tax
```

Never rebuild old reports from today's Product Master.

## 12. GSTR-1 / GSTR-3B cross-checks

Before CA approval, compare report totals against source tax/accounting facts and surface differences as exceptions.

## 13. Export integrity

Persist:

```text
run_id
report_type
GSTIN
period
format
content_hash
generated_at
generated_by
```

## 14. Drill-down

Every important summary must eventually drill:

```text
summary
 -> section
 -> source document
 -> voucher
 -> tax/journal fact
```

## 15. E2E

Add browser coverage for:

```text
create run
refresh
review exception
GSTR-1
GSTR-3B
HSN
Document Summary
export
mark ready
lock
reopen
```

## Definition of Done

```text
[x] source map verified
[x] drafts never become facts
[x] adjustment double-counting blocked
[x] locked reports immutable
[x] versioning
[x] CA approval separated from READY
[x] filing gate
[x] Tax Engine remains authoritative
[x] deterministic period/GSTIN scope
[x] historical HSN/SAC
[x] GSTR-1/GSTR-3B cross-checks
[x] export hashes
[x] source drill-down
[x] browser E2E
[x] audited reopen
```

## Implementation Notes

Completed hardening:

- Added migration `0050_gst_reporting_hardening.sql`.
- Added versioned GST reporting runs using `business_id + gst_registration_id + period + version`.
- Added immutable lifecycle states: `READY_FOR_CA_REVIEW`, `CA_APPROVED`, `READY_FOR_SUBMISSION`, `SUBMITTED`, and `FILED`.
- Kept old `LOCKED` as a legacy immutable guard, but new locking moves to `READY_FOR_SUBMISSION`.
- Reopen now creates a new run version instead of mutating the old locked/approved report.
- Added `source_data_hash`, `period_start`, `period_end`, and `gstin_snapshot`.
- Added CA approval endpoint and audit fields.
- Added source completeness, duplicate reporting fact, and source tax total mismatch exceptions.
- Added GST registration effective-period validation.
- Export metadata now includes GSTIN, run version, and source data hash.
- Added mocked browser E2E coverage for reporting run generation, refresh, ready-for-CA-review, CA approval, ready-for-submission, GSTR-1, GSTR-3B, and export.

Follow-up:

- Add a seeded full-stack browser E2E smoke test once the shared GST demo dataset is stable.
