# GST-REPORTING-FILING-REVIEW-ENGINE.md — GSTfy GST Reporting, Filing Review & Compliance Layer

## 0. Purpose

The ITC/Reconciliation Engine is now complete enough to feed the next compliance layer.

Current system:

```text
Party
Product
Tax
Sales
Purchase
Accounting
Inventory
POS
Payment/Receipt
Bank Reconciliation
Returns
Credit Notes
Debit Notes
ITC
GST Reconciliation
```

Next:

```text
GST Reporting Engine
```

Its purpose is to convert posted transactional GST facts into:

```text
GSTR-1 dataset
GSTR-3B dataset
HSN/SAC summary
Document summary
Filing review
CA review
Compliance exceptions
Export-ready datasets
```

It does NOT recalculate GST or decide ITC eligibility.

---

# 1. Core Boundary

```text
Tax Engine
    -> calculates transaction GST

ITC Engine
    -> determines ITC state/claim history

GST Reporting Engine
    -> transforms those facts into reporting datasets

CA Review
    -> reviews and approves the reporting position
```

Never put GST calculation rules inside the reporting engine.

---

# 2. Architecture

```text
Sales
Purchase
Returns
Credit Notes
Debit Notes
ITC/Reconciliation
      |
      v
GST Reporting Facts
      |
      +-------------------------+
      |                         |
   GSTR-1                  GSTR-3B
      |                         |
   HSN/SAC                  Tax / ITC
      |                         |
      +------------+------------+
                   |
             Filing Review
                   |
             CA Approval
                   |
          Export / Filing Adapter
```

---

# 3. Reporting Scope

Every reporting operation is scoped by:

```text
business_id
gst_registration_id
tax_period
```

Never combine GST registrations accidentally.

Example:

```text
Business
├── TN GSTIN
│   └── August 2026
└── KA GSTIN
    └── August 2026
```

These are separate reporting datasets.

---

# 4. Reporting Run

Create:

```text
gst_reporting_runs
------------------
id
business_id
gst_registration_id
gstin_snapshot
period
period_start
period_end
version
status
generated_at
source_data_hash
source_version
created_by
locked_at
approved_at
approved_by
ready_for_submission_at
submitted_at
filed_at
```

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

A run is a reporting/review artifact. Source transactions remain immutable.
Refreshing is allowed only while the run is still draft/reviewable. Once the report enters approval, submission, or filing states, reopening creates a new version instead of mutating the old one.

---

# 5. Reporting Facts

Normalize posted transaction information into:

```text
gst_reporting_facts
-------------------
id
business_id
gst_registration_id
period
source_voucher_id
source_document_type
source_document_number
source_document_date

party_id
party_gstin
place_of_supply
classification

taxable_value
cgst
sgst
igst
cess

reverse_charge
itc_category
reporting_status
```

Keep source references rather than duplicating complete source documents unnecessarily.

---

# 6. Source Coverage

Reporting facts consume:

```text
Sales
Purchase
Sales Return
Purchase Return
Credit Note
Debit Note
RCM
ITC decisions
```

Only posted/valid source transactions participate in statutory datasets.

---

# 7. Sales Reporting Classification

The reporting layer should classify sales into applicable categories such as:

```text
B2B
B2C
EXPORT
SEZ
DEEMED_EXPORT
NIL_RATED
EXEMPT
NON_GST
CREDIT_NOTE
DEBIT_NOTE
```

The exact statutory mapping must be maintained in reporting rules/configuration.

Sales itself should not contain return-format-specific code.

---

# 8. GSTR-1 Dataset

Build a normalized GSTR-1 representation with sections for applicable transactions:

```text
B2B
B2C
Exports
SEZ
Credit Notes
Debit Notes
Nil/Exempt/Non-GST
HSN/SAC
Document Summary
```

Do not hard-code the final file format into transaction modules.

---

# 9. GSTR-3B Dataset

Build a normalized summary from:

```text
outward taxable supplies
output tax
RCM
eligible ITC
ITC reversals
other reportable adjustments
```

The engine consumes:

```text
Tax Engine output
ITC Engine output
```

It does not decide eligibility itself.

---

# 10. HSN/SAC Summary

Aggregate using transaction snapshots:

```text
HSN/SAC
description
UQC
quantity
taxable value
CGST
SGST
IGST
cess
```

Use the historical HSN/SAC/UQC from posted lines.

Do not recalculate from today's Product Master.

---

# 11. Document Summary

Track reporting-period document information:

```text
document type
series/range
issued count
cancelled count
adjustment count where applicable
```

This is a CA completeness check.

---

# 12. Credit/Debit Note Reporting

Include applicable:

```text
Credit Notes
Debit Notes
Sales Returns
Purchase Returns
```

using their posted reporting effects.

Do not double-count when one adjustment document represents the economic event.

---

# 13. Place of Supply

Every applicable reporting fact should preserve:

```text
place_of_supply_state
place_of_supply_state_code
```

Never infer reporting state solely from branch.

---

# 14. Reverse Charge

Represent RCM separately.

Inputs:

```text
Tax Engine RCM result
Purchase/adjustment tax records
```

Outputs:

```text
RCM liability
RCM-related reporting values
```

Exact statutory section mapping stays in reporting rules.

---

# 15. ITC Reporting

Use ITC Engine results:

```text
eligible
partially eligible
deferred
ineligible
claimed
reversed
```

Do not recompute ITC eligibility here.

---

# 16. Exception Gate

A reporting run cannot become:

```text
READY_FOR_CA_REVIEW
CA_APPROVED
READY_FOR_SUBMISSION
```

while blocking exceptions remain.

Possible blockers:

```text
high-severity reconciliation exception
missing required GSTIN
invalid reporting classification
invalid place of supply
unresolved tax mismatch
duplicate reporting fact
unposted transaction affecting period
incomplete ITC decision where required
```

The exact blocking rules should be configurable.

---

# 17. Filing Review

Create:

```text
GST Filing Review
```

Sections:

```text
Summary
Sales
Purchases / ITC
Returns & Notes
RCM
HSN/SAC
Documents
Exceptions
```

Every summary must drill to source transactions.

---

# 18. CA Review Dashboard

Show:

```text
Output GST
Input GST
Eligible ITC
Deferred ITC
Reversed ITC
RCM
Net GST
Unresolved Exceptions
```

Each metric opens the contributing records.

---

# 19. Difference View

Example:

```text
Books Output GST:  ₹12,40,000
Report GST:        ₹12,20,000
Difference:           ₹20,000
```

Clicking difference should reveal the affected documents.

Never silently modify books to make totals match.

---

# 20. Source Drill-Down

Every reporting number should support:

```text
Report Summary
   ↓
Reporting Section
   ↓
Source Document
   ↓
Voucher
   ↓
Journal
```

ITC:

```text
ITC Total
   ↓
Supplier
   ↓
Purchase Bill
   ↓
Reconciliation
```

---

# 21. Reporting Run APIs

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
```

Reopen must require appropriate CA/admin permission and audit.

---

# 22. GSTR-1 APIs

```text
GET /api/v1/gst-reporting/gstr1
GET /api/v1/gst-reporting/gstr1/export
```

Return normalized sections, not raw database tables.

---

# 23. GSTR-3B APIs

```text
GET /api/v1/gst-reporting/gstr3b
GET /api/v1/gst-reporting/gstr3b/export
```

Return:

```text
outward supplies
tax liability
RCM
ITC
ITC reversals
net ITC
```

---

# 24. Frontend Navigation

Recommended:

```text
GST
├── Overview
├── Reconciliation
├── ITC
├── Filing Review
├── GSTR-1
└── GSTR-3B
```

Future integrations:

```text
GST
├── E-Invoice
└── E-Way Bill
```

Keep them separate modules.

---

# 25. GST Filing Review UI

Header:

```text
GSTIN
Period
Status
```

Summary:

```text
Output GST
Input GST
Net GST
RCM
Eligible ITC
Unresolved Exceptions
```

Tabs:

```text
Sales
Purchases/ITC
Returns & Notes
HSN
Documents
Exceptions
```

Actions:

```text
Refresh
Review
Ready for CA Review
CA Approve
Ready for Submission
Submit
Mark Filed
Export
```

---

# 26. GSTR-1 UI

Sections:

```text
B2B
B2C
Exports
SEZ
Credit/Debit Notes
HSN
Documents
```

Each section shows:

```text
record count
taxable value
tax total
exception count
```

---

# 27. GSTR-3B UI

Show:

```text
Outward taxable supplies
Tax liability
RCM
Eligible ITC
ITC reversals
Net ITC
```

Provide source drill-down.

---

# 28. Period Controls

Before `READY_FOR_CA_REVIEW`, `CA_APPROVED`, or `READY_FOR_SUBMISSION`:

```text
period open/reviewable
GST registration valid
source transactions posted
blocking exceptions resolved
ITC decisions sufficiently finalized
source data hash generated
no duplicate reporting facts
```

After `READY_FOR_CA_REVIEW`:

```text
normal report mutations blocked
```

Controlled reopening must be audited.

---

# 29. Reports

Initial:

```text
GSTR-1 Summary
GSTR-3B Summary
HSN/SAC Summary
Document Summary
GST Filing Review
Reporting Exceptions
```

---

# 30. Export

Support initially:

```text
CSV
XLSX
JSON
```

Later add current official statutory/portal formats through adapters.

Keep the reporting model independent of file format.

---

# 31. Audit

Events:

```text
GST_REPORT_RUN_CREATED
GST_REPORT_RUN_REFRESHED
GST_REPORT_EXCEPTION_CREATED
GST_REPORT_READY_FOR_CA_REVIEW
GST_REPORT_CA_APPROVED
GST_REPORT_READY_FOR_SUBMISSION
GST_REPORT_SUBMITTED
GST_REPORT_FILED
GST_REPORT_REOPENED
GST_REPORT_EXPORTED
```

Record:

```text actor
timestamp
GSTIN
period
before
after
reason
```

---

# 32. Security

Validate:

```text business membership
GST registration ownership
period ownership
CA authorization
report permissions
```

Never expose one GST registration's report to another registration/user without authorization.

---

# 33. Idempotency

Use idempotency for:

```text
create run
refresh
mark ready
approve
lock
submit
mark filed
reopen
```

Exports only need idempotency where an export artifact is persisted.

---

# 34. Testing

Sales:

```text
[ ] B2B
[ ] B2C
[ ] Export
[ ] SEZ
[ ] Exempt/Nil/Non-GST
[ ] Credit Note
[ ] Debit Note
[ ] Multiple GST rates
```

GSTR-3B:

```text
[ ] output tax
[ ] ITC
[ ] RCM
[ ] ITC reversal
[ ] net ITC
```

HSN:

```text
[ ] quantity
[ ] UQC
[ ] taxable value
[ ] tax aggregation
```

Controls:

```text
[ ] blocking exception prevents ready for CA review
[ ] approved/submitted/filed period blocks mutation
[ ] GSTIN isolation
[ ] idempotent run creation
[ ] versioned reopen
[ ] source drill-down
[x] browser E2E workflow
```

---

# 35. Definition of Done

## Backend

```text
[x] reporting facts
[x] reporting periods
[x] reporting runs
[x] GSTR-1 dataset
[x] GSTR-3B dataset
[x] HSN/SAC summary
[x] document summary
[x] exception gate
[x] source drill-down
[x] exports
[x] audit
[x] permissions
[x] idempotency
[x] tests
```

## Frontend

```text
[x] GST filing review
[x] GSTR-1 workspace
[x] GSTR-3B workspace
[x] summary cards
[x] section tables
[x] difference view
[x] source drill-down
[x] exception review
[x] exports
[x] loading/empty/error states
[x] permissions
```

---

# 36. What This Engine Must NOT Own

```text
Party CRUD
Product CRUD
Sales/Purchase creation
Tax calculation
Inventory
Payment/Receipt
ITC eligibility decisions
Bank reconciliation
E-Invoice
E-Way Bill
CA client master
```

---

# 37. Final Architecture

```text
Sales / Purchase / Returns / Notes
              |
          Tax Engine
              |
      +-------+--------+
      |                |
   GST Facts        ITC Engine
      |                |
      +-------+--------+
              |
      GST Reporting Engine
              |
       +------+------+------+
       |      |      |      |
     GSTR-1 GSTR-3B HSN  Review
       |      |      |      |
       +------+------+------+
              |
          CA Review
              |
       Export / Filing Adapter
```

## Final Rule

> GST Reporting transforms posted GST and ITC facts into controlled, auditable and reviewable reporting datasets. It never recalculates transaction tax or changes ITC decisions. It identifies differences, blocks unsafe filing states, provides source-level CA drill-down, and prepares the data for the statutory filing/integration layer.
