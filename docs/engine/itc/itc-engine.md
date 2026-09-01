# ITC-AND-GST-RECONCILIATION-ENGINE.md

## Purpose

Build GSTfy's Input Tax Credit and purchase GST reconciliation layer on top of the completed:

```text
Party
Product
Tax
Purchase
Accounting
Inventory
Payment / Receipt
Returns / Credit Notes / Debit Notes
Bank Reconciliation
```

The engine must separate:

```text
Input GST in Books
Reconciliation Status
ITC Eligibility
ITC Claim Status
GST Return Data
```

---

# 1. Core Flow

```text
Posted Purchase / Adjustments
        |
     Tax Engine
        |
 Input GST in Books
        |
 External GST Dataset
        |
    Normalize
        |
 Reconciliation
        |
+-------+--------+---------+
|       |        |         |
Match Mismatch Missing Duplicate
|
ITC Eligibility
|
+------+---------+---------+
|      |         |
Eligible Deferred Ineligible
|
Claimed
|
CA Review
|
GST Reporting
```

---

# 2. Book-Side Tax Record

Create/derive:

```text
purchase_tax_records
--------------------
id
business_id
purchase_bill_id
supplier_id
supplier_gstin
invoice_number
invoice_date
taxable_value
cgst
sgst
igst
cess
total_tax
tax_period
reconciliation_status
itc_status
source_snapshot
created_at
updated_at
```

Feed this from:

```text
Purchase Bills
Purchase Returns
Supplier Credit Notes
Supplier Debit Notes
RCM transactions
```

Use posted transactions only.

---

# 3. External GST Records

Normalize external data:

```text
external_gst_records
---------------------
id
business_id
supplier_gstin
document_number
document_date
taxable_value
cgst
sgst
igst
cess
total_tax
period
source
source_file_id
status
raw_reference
created_at
```

Keep external-format parsing inside an ingestion adapter, not Purchase/Accounting.

---

# 4. Reconciliation Status

Support:

```text
NOT_MATCHED
MATCHED
PARTIAL_MATCH
VALUE_MISMATCH
TAX_MISMATCH
DATE_MISMATCH
DUPLICATE
BOOKS_ONLY
EXTERNAL_ONLY
MANUAL_REVIEW
```

Match primarily by:

```text
business
supplier GSTIN
document number
document date
```

Supplier name is supplementary only.

---

# 5. Difference Tracking

Store:

```text
taxable_difference
cgst_difference
sgst_difference
igst_difference
cess_difference
```

Never overwrite book values with external values.

---

# 6. Match Table

```text
gst_reconciliation_matches
---------------------------
id
business_id
purchase_tax_record_id
external_gst_record_id
match_status
match_confidence
taxable_difference
cgst_difference
sgst_difference
igst_difference
cess_difference
matched_by
matched_at
manual_override
reason
```

Confidence:

```text
EXACT
STRONG
PARTIAL
WEAK
NO_MATCH
```

---

# 7. Exception Queue

```text
gst_reconciliation_exceptions
------------------------------
id
business_id
match_id
exception_type
severity
status
assigned_to
reason
resolution
resolved_by
resolved_at
```

Statuses:

```text
OPEN
IN_REVIEW
RESOLVED
IGNORED
```

Exceptions include:

```text
missing invoice
GSTIN mismatch
invoice mismatch
value mismatch
tax mismatch
duplicate
books only
external only
```

---

# 8. ITC Status

Keep separate from reconciliation:

```text
NOT_REVIEWED
ELIGIBLE
PARTIALLY_ELIGIBLE
DEFERRED
INELIGIBLE
CLAIMED
REVERSED
REJECTED
```

A `MATCHED` invoice is not automatically `ELIGIBLE`.

Eligibility must be determined from the applicable business/tax rules.

---

# 9. ITC Amounts

Track separately:

```text
eligible_cgst
eligible_sgst
eligible_igst
eligible_cess

ineligible_cgst
ineligible_sgst
ineligible_igst
ineligible_cess

deferred_cgst
deferred_sgst
deferred_igst
deferred_cess
```

Do not store only one total.

---

# 10. ITC Lifecycle

```text
NOT_REVIEWED
    |
ELIGIBLE
    |
CLAIMED
    |
REVERSED
```

Alternate:

```text
NOT_REVIEWED
    |
DEFERRED
    |
ELIGIBLE
```

Every transition is audited.

---

# 11. Claim Snapshot

When ITC becomes `CLAIMED`, store:

```text
claim_period
claimed_cgst
claimed_sgst
claimed_igst
claimed_cess
source_tax_record
```

Claim history is immutable.

---

# 12. Adjustment Integration

Purchase Return / Supplier Credit Note can reduce input tax.

Example:

```text
Purchase Input GST = 18,000
Supplier adjustment = 3,600

Net input tax = 14,400
```

The ITC engine consumes the posted adjustment effect. It does not recalculate adjustment tax.

---

# 13. RCM

RCM is a separate lifecycle:

```text
RCM liability
    |
Tax Engine
    |
ITC eligibility
```

Do not treat RCM as ordinary supplier-invoice reconciliation.

---

# 14. Manual Matching

Authorized users can match a Book record to an external record.

Record:

```text
matched_by
matched_at
manual_override
match_reason
```

Never overwrite either source.

---

# 15. Manual ITC Decision

Authorized user may set:

```text
ELIGIBLE
DEFERRED
INELIGIBLE
```

only with:

```text reason
actor
timestamp
```

---

# 16. Period Lock

When the accounting/GST period is locked:

```text
normal reconciliation mutation -> blocked
ITC state mutation -> blocked
```

Controlled reopening belongs to the existing CA/period engine.

---

# 17. APIs

## Import

```text
POST /api/v1/gst-reconciliation/import
GET  /api/v1/gst-reconciliation/imports
GET  /api/v1/gst-reconciliation/imports/:id
```

## Reconciliation

```text
GET  /api/v1/gst-reconciliation
GET  /api/v1/gst-reconciliation/:id
POST /api/v1/gst-reconciliation/:id/match
POST /api/v1/gst-reconciliation/:id/unmatch
POST /api/v1/gst-reconciliation/:id/resolve
```

## ITC

```text
GET  /api/v1/itc
GET  /api/v1/itc/:id
POST /api/v1/itc/:id/mark-eligible
POST /api/v1/itc/:id/defer
POST /api/v1/itc/:id/reject
POST /api/v1/itc/:id/reverse
POST /api/v1/itc/:id/claim
```

All mutation APIs require authorization and idempotency.

---

# 18. Backend Services

```text
gst-reconciliation/
├── import.service
├── normalize.service
├── matching.service
├── exception.service
├── itc.service
├── claim.service
├── reversal.service
├── validation.service
├── schemas
├── routes
└── tests
```

Responsibilities:

```text
Import -> ingest external records
Normalize -> common GST structure
Matching -> compare books/external
Exception -> manage reconciliation issues
ITC -> eligibility/status
Claim -> immutable claim records
Reversal -> claim reversal
```

---

# 19. Frontend Navigation

```text
GST
├── Overview
├── Purchase Reconciliation
├── ITC
├── Exceptions
└── Period Review
```

Statutory returns remain separate:

```text
GST Returns
├── GSTR-1
├── GSTR-3B
└── Other applicable returns
```

---

# 20. Reconciliation Dashboard

Cards:

```text
Books ITC
External ITC
Matched
Mismatch
Books Only
External Only
Duplicate
Manual Review
Eligible
Deferred
Claimed
```

---

# 21. Reconciliation List

Columns:

```text
Supplier GSTIN
Supplier
Invoice Number
Invoice Date
Book Tax
External Tax
Difference
Match Status
ITC Status
```

Filters:

```text
period
supplier
match status
ITC status
exception severity
branch
GST registration
```

---

# 22. Reconciliation Detail

Side-by-side:

```text
BOOKS
Supplier
Invoice
Date
Taxable
CGST
SGST
IGST
Cess

EXTERNAL
Supplier GSTIN
Invoice
Date
Taxable
CGST
SGST
IGST
Cess
```

Show:

```text
differences
match status
ITC status
reason
```

Actions:

```text
Confirm Match
Manual Match
Unmatch
Mark Exception
Mark Eligible
Defer
Reject
```

---

# 23. ITC Workspace

Cards:

```text
Eligible
Deferred
Ineligible
Claimed
Reversed
```

Rows:

```text
Supplier
Invoice
Taxable
CGST
SGST
IGST
Cess
Eligible ITC
ITC Status
Reconciliation Status
```

---

# 24. Exception Queue

Groups:

```text
Missing Invoice
Tax Mismatch
Value Mismatch
Duplicate
GSTIN Mismatch
Date Mismatch
Books Only
External Only
Manual Review
```

Severity:

```text
HIGH
MEDIUM
LOW
```

---

# 25. CA Review

```text
Exception
  ↓
Review
  ↓
Open Purchase
  ↓
Open Supplier
  ↓
View External Record
  ↓
Resolve
  ↓
Add Reason
  ↓
Audit
```

Every manual decision must be traceable.

---

# 26. Reports

Initial:

```text
ITC Summary
ITC Eligible Register
ITC Ineligible Register
ITC Deferred Register
ITC Claimed Register
GST Reconciliation Summary
Reconciliation Exceptions
Supplier-wise Reconciliation
```

Exports:

```text
ITC Register XLSX/CSV
Reconciliation XLSX/CSV
Exception Register XLSX/CSV
Supplier Reconciliation XLSX/CSV
```

Do not generate final statutory return files in this engine.

---

# 27. Security

Validate:

```text
business membership
GST registration ownership
source purchase ownership
supplier ownership
period ownership
CA authorization
```

No external GST record may be linked across businesses.

---

# 28. Audit

Events:

```text
GST_IMPORT_CREATED
GST_MATCH_CREATED
GST_MATCH_OVERRIDDEN
GST_MATCH_REVERSED
ITC_MARKED_ELIGIBLE
ITC_DEFERRED
ITC_REJECTED
ITC_CLAIMED
ITC_REVERSED
EXCEPTION_CREATED
EXCEPTION_RESOLVED
```

Capture:

```text actor
timestamp
before
after
reason
```

---

# 29. Idempotency

Use idempotency for:

```text import
match
unmatch
ITC status transition
claim
claim reversal
```

Rules:

```text
same key + same payload -> original result
same key + changed payload -> 409
```

---

# 30. Testing

Reconciliation:

```text
[ ] exact match
[ ] partial match
[ ] value mismatch
[ ] tax mismatch
[ ] date mismatch
[ ] duplicate
[ ] books only
[ ] external only
[ ] manual match
[ ] unmatch
```

ITC:

```text
[ ] eligible
[ ] ineligible
[ ] partially eligible
[ ] deferred
[ ] claimed
[ ] reversed
```

Adjustments:

```text
[ ] purchase return
[ ] supplier credit note
[ ] supplier debit note
[ ] input-tax adjustment
```

RCM:

```text
[ ] normal purchase
[ ] RCM purchase
[ ] RCM ITC lifecycle
```

Security:

```text
[ ] cross-business rejection
[ ] wrong GST registration rejection
[ ] locked-period rejection
[ ] unauthorized CA action rejection
```

Idempotency:

```text
[ ] duplicate import
[ ] duplicate match
[ ] duplicate claim
```

---

# 31. Definition of Done

## Backend

```text
[ ] purchase tax records
[ ] external GST ingestion
[ ] normalization
[ ] matching engine
[ ] mismatch calculation
[ ] exception queue
[ ] ITC eligibility
[ ] partial eligibility
[ ] deferred ITC
[ ] claim history
[ ] reversal history
[ ] adjustment integration
[ ] RCM boundary
[ ] period locking
[ ] audit
[ ] permissions
[ ] idempotency
[ ] reports
[ ] exports
[ ] tests
```

## Frontend

```text
[ ] GST overview
[ ] reconciliation dashboard
[ ] reconciliation list
[ ] reconciliation detail
[ ] ITC workspace
[ ] exception queue
[ ] side-by-side comparison
[ ] manual matching
[ ] ITC actions
[ ] CA review
[ ] filters
[ ] pagination
[ ] exports
[ ] loading/empty/error states
[ ] permission handling
```

---

# 32. What This Engine Must NOT Own

```text
Party CRUD
Product CRUD
Purchase creation
Sales creation
Inventory
Payment/Receipt
Bank reconciliation
GSTR-1 generation
GSTR-3B generation
E-Invoice
E-Way Bill
CA period master
```

---

# 33. Final Architecture

```text
Purchase / Adjustments
        |
    Tax Engine
        |
 Input GST in Books
        |
+-------+---------+
|                 |
Purchase Data   External GST Data
|                 |
+-------+---------+
        |
 Reconciliation
        |
+-------+-------+-------+
|       |       |       |
Match Mismatch Missing Duplicate
|
ITC Eligibility
|
+-------+--------+------+
|       |        |
Eligible Deferred Ineligible
|
Claimed
|
CA Review
|
GST Reporting
```

## Final Rule

> The ITC and GST Reconciliation Engine reconciles GST input-tax records created by posted purchases and adjustments against normalized external GST records. It keeps reconciliation status, ITC eligibility, and claim status separate, preserves every decision and override, and produces controlled data for CA review and the future GST Reporting Engine.
