# E-INVOICE-ENGINE.md — GSTfy E-Invoice & IRN Integration

## 0. Purpose

The next engine after GST Filing Integration is the E-Invoice Engine.

It converts eligible posted GSTfy documents into a canonical e-invoice payload, validates them, sends them through a provider adapter, stores the IRN/acknowledgement/response, and exposes the status in GSTfy.

```text
Posted Invoice / Eligible Note
        ↓
E-Invoice Eligibility
        ↓
Canonical Payload
        ↓
Provider Adapter
        ↓
IRN / Acknowledgement
        ↓
Persist Response
        ↓
Invoice / Compliance UI
```

The engine never recalculates GST or changes the original commercial transaction.

---

# 1. Boundary

### Owns

```text
eligibility
payload transformation
validation
IRN submission
status polling
IRN/ack persistence
response metadata
cancellation
retry
provider integration
audit
```

### Does NOT own

```text
invoice creation
GST calculation
Party CRUD
Product CRUD
Inventory
Accounting
AR/AP
Payment/Receipt
ITC
GST return generation
E-Way Bill
```

---

# 2. Source Documents

Primary:

```text
Sales Invoice
```

Potentially eligible adjustment documents:

```text
Credit Note
Debit Note
```

Only documents eligible under the applicable/current statutory rules enter the workflow.

Do not hard-code permanent eligibility thresholds/rules in the UI.

---

# 3. Eligibility Service

```text
checkEInvoiceEligibility(voucher)
```

Return:

```text
ELIGIBLE
NOT_ELIGIBLE
BLOCKED
ALREADY_GENERATED
```

with:

```text
reason_code
reason
```

Consider:

```text
business
GST registration
document type
transaction type
transaction date
party
tax context
```

Keep the actual statutory rule set configurable/versioned.

---

# 4. E-Invoice Record

```text
e_invoice_records
-----------------
id
business_id
gst_registration_id
source_voucher_id
source_document_type
source_document_number
document_date
eligibility_status
submission_status
irn
ack_number
ack_date
provider_name
provider_reference
payload_schema_version
payload_hash
raw_response_reference
cancel_reason
cancelled_at
created_at
updated_at
```

Never modify the source invoice.

---

# 5. Status

Suggested:

```text
NOT_REQUIRED
ELIGIBLE
READY
VALIDATION_FAILED
SUBMITTING
PROCESSING
IRN_GENERATED
FAILED
CANCELLATION_REQUESTED
CANCELLED
```

Keep provider-specific statuses mapped into this internal state machine.

---

# 6. Canonical Payload

Create an internal payload:

```text
schema_version
supplier
recipient
document
items
taxes
totals
references
dispatch_details
shipping_details
```

Then:

```text
Canonical Payload
   ↓
Provider Adapter
   ↓
External E-Invoice Schema
```

Never bind Sales directly to one provider's JSON.

---

# 7. Supplier Snapshot

Resolve from the posted transaction/GST registration and preserve:

```text
GSTIN
legal name
trade name
address
state
state code
pincode
```

Do not replace historical supplier data from current masters.

---

# 8. Recipient Snapshot

Use the posted transaction/party snapshot:

```text
party
GST registration
legal/trade name
address
state
state code
pincode
```

The current Party Master must not rewrite old payload data.

---

# 9. Document Validation

Before generation:

```text
source exists
source is POSTED
source is not cancelled/reversed
document number valid
document date valid
required party/GST data present
```

---

# 10. Line Validation

Each line carries its historical snapshot:

```text
description
HSN/SAC
UQC
quantity
unit price
discount
taxable value
GST rate
CGST
SGST
IGST
cess
```

Tax Engine remains authoritative for tax values.

---

# 11. Totals Validation

Verify with Decimal arithmetic:

```text
sum line taxable = taxable total
sum CGST lines = CGST total
sum SGST lines = SGST total
sum IGST lines = IGST total
sum Cess lines = Cess total
taxable + taxes + charges +/- roundoff = grand total
```

Never recalculate tax rules here.

---

# 12. Provider Adapter

Define:

```text
EInvoiceProviderAdapter
```

Conceptual methods:

```text
validate(payload)
generateIRN(payload)
getStatus(reference)
cancelIRN(reference, reason)
```

Start with:

```text
Mock
Sandbox/Test
```

and add the actual provider later.

---

# 13. Credentials

Keep provider credentials in the secure integration/secrets layer.

Never return credentials/tokens to the frontend.

Do not store raw credentials in normal business tables.

---

# 14. Idempotency

Submission identity should include:

```text
business
GSTIN
source_voucher_id
document_number
document_date
payload_hash
```

Before submitting:

```text
check local e-invoice record
check provider reference/status
```

A network timeout must not create a duplicate external request.

---

# 15. IRN Lifecycle

```text
POSTED
  ↓
ELIGIBILITY
  ↓
VALIDATE
  ↓
READY
  ↓
SUBMITTING
  ↓
PROCESSING
  ↓
IRN_GENERATED
```

Failure:

```text
FAILED
```

---

# 16. IRN/ACK Snapshot

Persist:

```text
IRN
ack_number
ack_date
provider_reference
submission_time
payload_hash
schema_version
```

Never calculate or invent an IRN locally.

---

# 17. QR / Response Metadata

When supported by the provider, persist the provider response/QR-related metadata through the document/storage boundary.

Keep:

```text
raw_response_reference
```

for audit.

---

# 18. Cancellation

Use a controlled state:

```text
IRN_GENERATED
  ↓
CANCELLATION_REQUESTED
  ↓
CANCELLED
```

or:

```text
CANCELLATION_FAILED
```

Store:

```text cancel_reason
cancelled_by
cancelled_at
provider_response
```

Never delete the IRN record.

---

# 19. Invoice Cancellation Boundary

E-Invoice status and accounting invoice status are separate.

When invoice cancellation is requested:

```text
Invoice workflow
  ↓
Check E-Invoice status
  ↓
Cancel E-Invoice where applicable
  ↓
Cancel invoice
```

Avoid circular service dependencies.

---

# 20. Credit/Debit Notes

For eligible notes:

```text
Credit Note
Debit Note
```

reuse:

```text
eligibility
canonical payload
provider adapter
audit
status
idempotency
```

but preserve note-specific semantics.

---

# 21. Frontend Navigation

Recommended:

```text
Compliance
├── GST
├── E-Invoice
└── E-Way Bill
```

Also expose the status on Sales/eligible Note detail pages.

---

# 22. E-Invoice Dashboard

Cards:

```text
Eligible
Ready
IRN Generated
Failed
Cancellation Pending
Cancelled
```

Filters:

```text
period
GSTIN
branch
document type
status
customer
```

---

# 23. Invoice Detail

Show:

```text
E-Invoice Status
IRN
Ack Number
Ack Date
Provider Reference
```

Actions:

```text
Generate IRN
Retry
View Response
Cancel
```

Only show valid actions for the current state.

---

# 24. Generate IRN UX

Before submission:

```text
Document
GSTIN
Customer
Taxable
CGST
SGST
IGST
Cess
Total
Eligibility
Validation result
Payload version
Payload hash
```

Then:

```text
Generate E-Invoice
```

with confirmation.

---

# 25. Failure UX

Show:

```text
Provider Error Code
Message
Attempt
Timestamp
Provider Reference
```

Action:

```text
Retry
```

Retry must remain idempotent.

---

# 26. Cancellation UX

Show:

```text
IRN
Cancellation reason
Current status
```

Require explicit reason and only expose cancellation when allowed by the current state/rules.

---

# 27. History

Columns:

```text
Document
GSTIN
Customer
Date
Status
IRN
Ack
Provider
```

Detail drill-down:

```text
source invoice
canonical payload
adapter payload
status events
acknowledgement
errors
cancellation
```

---

# 28. APIs

```text
GET  /api/v1/e-invoices
GET  /api/v1/e-invoices/:id
GET  /api/v1/e-invoices/eligibility/:voucherId
POST /api/v1/e-invoices/:id/validate
POST /api/v1/e-invoices/:id/generate
POST /api/v1/e-invoices/:id/status
POST /api/v1/e-invoices/:id/retry
POST /api/v1/e-invoices/:id/cancel
GET  /api/v1/e-invoices/:id/response
```

All mutations require permissions and idempotency.

---

# 29. Audit

Events:

```text
EINV_ELIGIBILITY_CHECKED
EINV_PAYLOAD_GENERATED
EINV_VALIDATED
EINV_SUBMITTED
EINV_PROCESSING
EINV_IRN_GENERATED
EINV_FAILED
EINV_CANCEL_REQUESTED
EINV_CANCELLED
EINV_RETRY
```

Record:

```text actor
timestamp
source_voucher_id
previous_status
new_status
provider_reference
reason
```

---

# 30. Permissions

```text
EINVOICE_VIEW
EINVOICE_CREATE
EINVOICE_SUBMIT
EINVOICE_RETRY
EINVOICE_CANCEL
EINVOICE_PROVIDER_ADMIN
```

Provider-admin permission must be restricted.

---

# 31. Tests

Eligibility:

```text
[ ] eligible
[ ] not eligible
[ ] blocked
[ ] invalid GSTIN
[ ] invalid source state
[ ] already generated
```

Payload:

```text
[ ] supplier
[ ] recipient
[ ] document
[ ] items
[ ] HSN/SAC
[ ] UQC
[ ] taxes
[ ] totals
```

Submission:

```text
[ ] IRP5 success
[ ] IRP5 processing/status recovery
[ ] IRP5 provider failure
[ ] timeout/retry
[ ] duplicate prevention
```

Cancellation:

```text
[ ] valid cancel
[ ] invalid cancel
[ ] duplicate cancel
[ ] provider failure
```

Historical integrity:

```text
[ ] Party change does not alter payload
[ ] Product change does not alter payload
[ ] Tax-rule change does not alter posted payload
```

---

# 32. Definition of Done

Backend:

```text
[ ] eligibility
[ ] e-invoice record
[ ] canonical payload
[ ] validation
[ ] IRP5 provider adapter
[ ] IRN generation
[ ] processing/status
[ ] acknowledgement
[ ] response metadata
[ ] cancellation
[ ] retry/idempotency
[ ] note support
[ ] audit
[ ] permissions
[ ] tests
```

Frontend:

```text
[ ] dashboard
[ ] source-document integration
[ ] eligibility display
[ ] payload review
[ ] generate IRN
[ ] processing state
[ ] IRN display
[ ] error/retry
[ ] cancellation
[ ] history
[ ] response/audit detail
[ ] filters
[ ] loading/empty/error states
[ ] permissions
```

# Final Rule

> E-Invoice is an external compliance integration around an already-posted eligible transaction. It transforms the immutable tax/invoice snapshot into a versioned provider payload, obtains and stores the external IRN/acknowledgement, and never becomes the source of truth for invoice, tax, inventory, or accounting data.
