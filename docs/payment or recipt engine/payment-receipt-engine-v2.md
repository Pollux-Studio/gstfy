# PAYMENT-RECEIPT-ENGINE.md — GSTfy Payment & Receipt Engine

## Purpose

Define the complete Payment/Receipt module after the completed Parties Engine.

```text
Sales Invoice -> Accounts Receivable -> Receipt -> Allocation
Purchase Bill -> Accounts Payable   -> Payment -> Allocation
```

The module covers backend, frontend, database, accounting integration, AR/AP settlement, advances, overpayments, reversals, reports, permissions, audit, and tests.

It owns money movement and settlement. It does not own GST calculation, inventory, Party Master, invoice creation, GST returns, or bank reconciliation.

---

## 1. Core Rules

One Party identity comes from Party Master.

```text
Receipt -> CUSTOMER role
Payment -> SUPPLIER role
```

A party may have both roles.

Settlement source of truth:

```text
receipt_allocations
payment_allocations
```

Do not use `party.outstanding`, `invoice.paid_amount`, or `balance_due` as the financial source of truth.

Posted records are immutable. Corrections use reversal/new transactions.

---

## 2. Database

### `receipts`

```text
id
business_id
voucher_id
party_id
branch_id nullable
gst_registration_id nullable
receipt_number
receipt_date
payment_method
cash_bank_account_id
amount
unallocated_amount
reference
notes
status
created_by
posted_by
created_at
posted_at
reversed_at
```

Statuses:

```text
DRAFT
POSTED
REVERSED
```

### `payments`

Same structure using:

```text
payment_number
payment_date
```

### `receipt_allocations`

```text
id
business_id
receipt_id
sales_invoice_id
ar_entry_id
allocated_amount
status
created_by
created_at
reversed_at nullable
```

### `payment_allocations`

```text
id
business_id
payment_id
purchase_bill_id
ap_entry_id
allocated_amount
status
created_by
created_at
reversed_at nullable
```

Prefer strongly typed foreign keys instead of generic polymorphic document IDs.

---

## 3. Settlement

Sales:

```text
outstanding =
original receivable
- SUM(active receipt allocations)
```

Purchase:

```text
outstanding =
original payable
- SUM(active payment allocations)
```

Statuses:

```text
UNPAID
PARTIALLY_PAID
PAID
OVERDUE
OVERPAID
```

`OVERDUE` is date/reporting state.

---

## 4. Receipt Scenarios

Support:

```text
Full receipt
Partial receipt
Multiple receipts -> one invoice
One receipt -> multiple invoices
Unallocated receipt
Customer advance
Overpayment
Reversal
```

Example:

```text
Invoice = 100000

R1 = 30000
R2 = 20000
R3 = 50000

Outstanding = 0
```

One receipt may allocate to multiple invoices:

```text
Receipt 100000
INV-001 60000
INV-002 25000
INV-003 15000
```

---

## 5. Payment Scenarios

Mirror receipts:

```text
Full payment
Partial payment
Multiple payments -> one bill
One payment -> multiple bills
Unallocated payment
Supplier advance
Overpayment
Reversal
```

---

## 6. Advances

Customer advance:

```text
Cash/Bank Dr
    Customer Advance Cr
```

Supplier advance:

```text
Supplier Advance Dr
    Cash/Bank Cr
```

Do not create fake invoices/bills for advances.

Later allocations move the advance into the relevant receivable/payable settlement.

---

## 7. Overpayments

Example:

```text
Invoice = 100000
Receipt = 120000
```

Allocate:

```text
100000 -> invoice
20000 -> customer advance/unallocated
```

Never silently over-allocate.

---

## 8. Validation

Every allocation validates:

```text
amount > 0
payment/receipt is POSTED
target invoice/bill is POSTED
target not cancelled
same business
same party
valid AR/AP entry
allocation <= current outstanding
```

Business/party ownership is checked server-side.

Cross-party and cross-business allocations are rejected.

---

## 9. Payment Methods

Initial:

```text
CASH
BANK_TRANSFER
UPI
CARD
CHEQUE
OTHER
```

Payment method is metadata.

The actual financial account is:

```text
cash_bank_account_id
```

Party bank accounts and GSTfy business bank accounts are different domains.

---

## 10. Cheques

Optional:

```text
cheque_number
cheque_date
bank_name
```

Statuses:

```text
RECEIVED
DEPOSITED
CLEARED
BOUNCED
CANCELLED
```

Cheque bounce uses a controlled reversal workflow.

---

## 11. Numbering

Use server-side series:

```text
REC/2026-27/000001
PAY/2026-27/000001
```

Allocation must be transactional and concurrency-safe.

---

## 12. Lifecycle

Receipt:

```text
DRAFT
  ↓
VALIDATE
  ↓
POSTED
  ↓
UNALLOCATED / PARTIALLY_ALLOCATED / FULLY_ALLOCATED
  ↓
REVERSED
```

Payment uses the same pattern.

Drafts affect no official accounting/AR/AP.

Posted records are immutable.

---

## 13. Posting — Receipt

```text
POST RECEIPT
  ↓
Authorize user
  ↓
Validate party
  ↓
Validate payment method/account
  ↓
Validate financial year/period
  ↓
Allocate receipt number
  ↓
Create voucher
  ↓
Create receipt
  ↓
Create Accounting journal
  ↓
Create allocations
  ↓
Audit
  ↓
COMMIT
```

Failure rolls back the complete operation.

---

## 14. Posting — Payment

Same flow:

```text
POST PAYMENT
  ↓
Validate supplier
  ↓
Validate account/method
  ↓
Validate period
  ↓
Allocate payment number
  ↓
Create voucher/payment
  ↓
Accounting journal
  ↓
Allocations
  ↓
Audit
  ↓
COMMIT
```

---

## 15. Existing Invoice Paid-at-Creation

If Sales/Purchase currently accepts:

```text
paidAmount
paymentMode
```

keep as a convenience input.

Internally:

```text
Post Invoice/Bill
  ↓
Create Receipt/Payment
  ↓
Allocate
```

Do not permanently embed settlement inside invoice posting.

---

## 16. Accounting

Receipt:

```text
Cash/Bank Dr
    Customer Receivable Cr
```

Payment:

```text
Supplier Payable Dr
    Cash/Bank Cr
```

Allocation creates the settlement relationship only. It must not duplicate the original cash/bank journal.

---

## 17. Reversal

Never hard-delete posted receipt/payment.

Reversal must:

```text
reverse accounting
reverse active allocations
restore outstanding
preserve original document
create audit record
```

Allocation rows should use:

```text
status = REVERSED
reversed_at
reversed_by
reversal_reason
```

---

## 18. Period and Idempotency

Posting requires:

```text
business active
financial year valid
accounting period OPEN
party eligible
cash/bank account ACTIVE
```

Reuse Core idempotency:

```text
same key + same payload -> original result
same key + changed payload -> 409
```

No duplicate receipt/payment/journal/allocation.

---

## 19. Concurrency

Protect against over-allocation.

Example:

```text
Outstanding = 50000

User A -> allocate 40000
User B -> allocate 30000
```

The database transaction must prevent final allocations from exceeding the actual outstanding balance.

---

## 20. Historical Snapshots

Posted money documents should retain relevant snapshots:

```text
party_name_snapshot
party_gstin_snapshot
branch_snapshot
cash_bank_account_snapshot
```

Changing Party Master later must not rewrite historical receipts/payments.

---

## 21. Branch/GST Context

Store:

```text
branch_id nullable
gst_registration_id nullable
```

for operational/reporting context.

Payment/Receipt does not calculate GST.

GST belongs to:

```text
Sales Invoice
Purchase Bill
Credit/Debit Note
Return
```

---

# BACKEND

## 22. APIs — Receipts

```text
GET    /api/v1/receipts
POST   /api/v1/receipts
GET    /api/v1/receipts/:id
PATCH  /api/v1/receipts/:id
POST   /api/v1/receipts/:id/post
POST   /api/v1/receipts/:id/allocations
DELETE /api/v1/receipts/:id/allocations/:allocationId
POST   /api/v1/receipts/:id/reverse
```

Posted financial fields must not be patchable.

## 23. APIs — Payments

```text
GET    /api/v1/payments
POST   /api/v1/payments
GET    /api/v1/payments/:id
PATCH  /api/v1/payments/:id
POST   /api/v1/payments/:id/post
POST   /api/v1/payments/:id/allocations
DELETE /api/v1/payments/:id/allocations/:allocationId
POST   /api/v1/payments/:id/reverse
```

## 24. Outstanding APIs

```text
GET /api/v1/receivables
GET /api/v1/payables
GET /api/v1/receivables/:partyId
GET /api/v1/payables/:partyId
```

Filters:

```text
party
date
due date
branch
GST registration
status
```

## 25. Services

Recommended:

```text
payment-receipt/
├── receipts.service
├── payments.service
├── allocation.service
├── settlement.service
├── validation.service
├── routes
├── schemas
└── tests
```

Responsibilities:

```text
ReceiptService
  create / update draft / post / reverse

PaymentService
  create / update draft / post / reverse

AllocationService
  allocate / reverse allocation

SettlementService
  derive settled / outstanding / status

Accounting integration
  post journals through Accounting Engine

Audit
  record money-document changes
```

## 26. Database Constraints

Enforce:

```text
amount > 0
allocated_amount > 0
same business
same party
valid AR/AP reference
valid cash/bank account
```

Number uniqueness:

```text
UNIQUE(business_id, receipt_number)
UNIQUE(business_id, payment_number)
```

Use equivalent series-scoped uniqueness where the document-series design requires it.

## 27. Permissions

```text
RECEIPT_VIEW
RECEIPT_CREATE
RECEIPT_EDIT
RECEIPT_POST
RECEIPT_ALLOCATE
RECEIPT_REVERSE

PAYMENT_VIEW
PAYMENT_CREATE
PAYMENT_EDIT
PAYMENT_POST
PAYMENT_ALLOCATE
PAYMENT_REVERSE

RECEIVABLE_VIEW
PAYABLE_VIEW
```

Enforce existing branch scope on the backend.

---

# FRONTEND

## 28. Navigation

Create:

```text
Money
├── Receipts
├── Payments
├── Receivables
└── Payables
```

Party detail links to these workflows.

---

## 29. Receipts List

Columns:

```text
Receipt No
Date
Customer
Amount
Allocated
Unallocated
Payment Method
Branch
Status
```

Filters:

```text
Search
Date
Customer
Payment Method
Branch
Status
Allocated/Unallocated
```

Actions:

```text
View
Edit Draft
Post
Allocate
Reverse
```

Posted records must not expose normal Edit.

---

## 30. Payments List

Columns:

```text
Payment No
Date
Supplier
Amount
Allocated
Unallocated
Payment Method
Branch
Status
```

Same filter/action behavior as Receipts.

---

## 31. Receivables Page

Columns:

```text
Customer
Invoice
Invoice Date
Due Date
Invoice Amount
Settled
Outstanding
Status
```

Actions:

```text
Receive Payment
View Invoice
View Party
View Ledger
```

---

## 32. Payables Page

Columns:

```text
Supplier
Purchase Bill
Bill Date
Due Date
Bill Amount
Paid
Outstanding
Status
```

Actions:

```text
Make Payment
View Bill
View Party
View Ledger
```

---

## 33. Add Receipt UX

### Step 1 — Customer

```text
Customer *
Search Party
```

Show:

```text
Name
GSTIN
Current Receivable
```

### Step 2 — Money

```text
Receipt Date *
Amount *
Payment Method *
Cash/Bank Account *
Reference
Notes
```

### Step 3 — Allocation

Show open invoices:

```text
Invoice
Due Date
Outstanding
Allocate
```

Summary:

```text
Receipt Amount
Allocated
Unallocated
```

### Step 4 — Review

```text
Customer
Date
Amount
Method
Account
Allocations
Unallocated
```

Actions:

```text
Save Draft
Post Receipt
```

---

## 34. Add Payment UX

Same pattern:

```text
Supplier
Payment Date
Amount
Payment Method
Cash/Bank Account
Reference
Outstanding Bills
Allocation
Review
```

Actions:

```text
Save Draft
Post Payment
```

---

## 35. Allocation Drawer

Example:

```text
Receipt REC-001
Amount: ₹100,000

Outstanding invoices

INV-001   ₹60,000   [Allocate]
INV-002   ₹35,000   [Allocate]
INV-003   ₹80,000   [Allocate]
```

Footer:

```text
Total Receipt: ₹100,000
Allocated:      ₹80,000
Remaining:      ₹20,000
```

The backend is authoritative; frontend calculations are only UX feedback.

---

## 36. Unallocated / Advance UX

If money remains:

```text
₹20,000 remains unallocated.
```

Options:

```text
Keep Unallocated
Record as Advance
Edit Allocation
```

Never silently discard money.

---

## 37. Overpayment UX

Example:

```text
Invoice = ₹100,000
Receipt = ₹120,000
```

Show:

```text
₹100,000 -> Invoice
₹20,000 -> Customer Advance / Unallocated
```

Require explicit confirmation.

---

## 38. Receipt Detail

Show:

```text
Receipt Number
Status
Customer
Date
Amount
Payment Method
Cash/Bank Account
Reference
```

Allocation section:

```text
Invoice
Allocated Amount
Date
Status
```

Summary:

```text
Allocated
Unallocated
```

Audit:

```text
Created By
Posted By
Posted At
Reversed By
Reversal Reason
```

---

## 39. Payment Detail

Same structure for Supplier Payment.

---

## 40. Party Integration

Customer Party:

```text
Receivable
  ↓
Receive Payment
  ↓
Receivables
  ↓
Ledger
```

Supplier Party:

```text
Payable
  ↓
Make Payment
  ↓
Payables
  ↓
Ledger
```

Party UI must not duplicate settlement logic.

---

## 41. Party Ledger

Once this engine is integrated, Party Ledger should show:

```text
Sales Invoice
Receipt
Receipt Allocation
Purchase Bill
Payment
Payment Allocation
Credit Note
Debit Note
```

Each entry drills into the source transaction.

---

## 42. Dashboard

Future dashboard metrics:

```text
Today's Receipts
Today's Payments
Receivables
Payables
Overdue Receivables
Overdue Payables
Unallocated Receipts
Unallocated Payments
```

All derive from posted data.

---

## 43. Reports

Initial:

```text
Receipt Register
Payment Register
Receivable Outstanding
Payable Outstanding
Customer Aging
Supplier Aging
Unallocated Receipts
Unallocated Payments
Customer Advances
Supplier Advances
```

Future:

```text
Collection Report
Payment Due Report
Cash Book
Bank Book
Branch Collections
Customer Collection Trend
Supplier Payment Trend
```

---

## 44. Exports

Support:

```text
Receipt Register XLSX/CSV
Payment Register XLSX/CSV
Receivable Register XLSX/CSV
Payable Register XLSX/CSV
Aging XLSX/CSV
```

Posted data is the default export source.

---

## 45. Frontend UX States

Every page/form supports:

```text
loading
empty
error
permission denied
validation error
success
```

Allocation UI always shows:

```text
available
allocated
remaining
```

---

# TESTING

## 46. Backend Tests

Receipt:

```text
[ ] draft
[ ] edit draft
[ ] post
[ ] full allocation
[ ] partial allocation
[ ] multiple invoices
[ ] unallocated
[ ] advance
[ ] overpayment
[ ] reversal
```

Payment:

```text
[ ] draft
[ ] edit draft
[ ] post
[ ] full allocation
[ ] partial allocation
[ ] multiple bills
[ ] unallocated
[ ] advance
[ ] overpayment
[ ] reversal
```

Security:

```text
[ ] cross-business rejected
[ ] cross-party allocation rejected
[ ] unauthorized branch rejected
[ ] inactive party rejected
[ ] inactive cash/bank account rejected
[ ] locked period rejected
```

Accounting:

```text
[ ] receipt journal balances
[ ] payment journal balances
[ ] allocation produces no duplicate cash journal
[ ] reversal journal balances
```

Concurrency:

```text
[ ] concurrent allocation
[ ] no over-allocation
[ ] duplicate idempotency
[ ] concurrent numbering
```

## 47. Frontend Tests

```text
[ ] party search
[ ] invoice/bill loading
[ ] receipt creation
[ ] payment creation
[ ] allocation
[ ] unallocated warning
[ ] overpayment confirmation
[ ] draft save
[ ] post confirmation
[ ] detail page
[ ] reverse flow
[ ] filters
[ ] pagination
[ ] loading
[ ] empty
[ ] error
[ ] permission state
```

---

# 48. Definition of Done

### Backend

```text
[ ] receipts
[ ] payments
[ ] allocation tables
[ ] voucher integration
[ ] numbering
[ ] accounting posting
[ ] AR/AP settlement
[ ] advances
[ ] overpayments
[ ] reversals
[ ] idempotency
[ ] concurrency protection
[ ] branch/GST context
[ ] audit
[ ] permissions
[ ] reports
[ ] exports
[ ] tests
```

### Frontend

```text
[ ] Receipts page
[ ] Payments page
[ ] Receivables page
[ ] Payables page
[ ] Add Receipt
[ ] Add Payment
[ ] Allocation UI
[ ] Advance/unallocated UX
[ ] Overpayment UX
[ ] Detail pages
[ ] Reverse flow
[ ] Party integration
[ ] Search/filter/pagination
[ ] Loading/empty/error states
[ ] Permission handling
```

---

# 49. Must Not Own

Do not implement here:

```text
GST calculation
CGST/SGST/IGST
Cess
ITC
Product CRUD
Party CRUD
Inventory quantity
Inventory valuation
Invoice creation
Purchase bill creation
GST returns
Bank reconciliation
E-Invoice
E-Way Bill
CA filing workflow
```

---

# 50. Final Architecture

```text
                    SALES
                      |
                RECEIVABLE
                      |
                   RECEIPT
                      |
                 ALLOCATION
                      |
                 ACCOUNTING
                      |
                   CASH/BANK


                  PURCHASE
                      |
                   PAYABLE
                      |
                  PAYMENT
                      |
                 ALLOCATION
                      |
                 ACCOUNTING
                      |
                   CASH/BANK
```

Party Master provides:

```text
identity
roles
GST registrations
addresses
payment terms
accounting mappings
bank information
```

Payment/Receipt owns:

```text
receipt
payment
allocation
advance
overpayment
settlement
reversal
```

Accounting owns:

```text
journal
ledger
cash/bank
AR/AP financial effects
```

## Final rule

> Sales and Purchase create financial obligations; Payment/Receipt creates money movement; allocations connect money to those obligations; Accounting records the financial effect; Party Master supplies identity; Tax and Inventory remain separate authorities.
