# PAYMENT-RECEIPT-ENGINE.md — GSTfy Money Movement & Settlement Engine

## 0. Purpose

The Payment/Receipt Engine manages money received from customers and money paid to suppliers.

It connects:

```text
Sales Invoice → Receivable → Receipt → Allocation
Purchase Bill → Payable → Payment → Allocation
```

It must support:

```text
full settlement
partial settlement
multiple payments
multiple invoices
advances
unallocated money
overpayments
reversals
cash
bank
UPI
card
cheque
```

Core rule:

> A financial document creates a receivable/payable. A receipt/payment settles that balance through explicit allocation.

---

# 1. Architecture

```text
              SALES INVOICE
                    ↓
             AR / RECEIVABLE
                    ↓
                 RECEIPT
                    ↓
               ALLOCATION
                    ↓
             Customer Balance
                    ↓
               Accounting

             PURCHASE BILL
                    ↓
              AP / PAYABLE
                    ↓
                 PAYMENT
                    ↓
               ALLOCATION
                    ↓
             Supplier Balance
                    ↓
               Accounting
```

---

# 2. Money Direction

## Receipt

```text
Customer → Business

Bank/Cash Dr
    Customer Receivable Cr
```

## Payment

```text
Business → Supplier

Supplier Payable Dr
    Bank/Cash Cr
```

---

# 3. Receipt Entity

Conceptual:

```text
receipts
--------
id
business_id
voucher_id
party_id
branch_id nullable
gst_registration_id nullable
receipt_date
payment_method
cash_bank_account_id
amount
unallocated_amount
status
reference
notes
created_by
created_at
```

Receipt status:

```text
DRAFT
POSTED
REVERSED
```

Allocation status should be derived separately.

---

# 4. Payment Entity

```text
payments
--------
id
business_id
voucher_id
party_id
branch_id nullable
gst_registration_id nullable
payment_date
payment_method
cash_bank_account_id
amount
unallocated_amount
status
reference
notes
created_by
created_at
```

Status:

```text
DRAFT
POSTED
REVERSED
```

---

# 5. Allocation Entities

Prefer separate strongly typed tables.

## Receipt allocation

```text
receipt_allocations
-------------------
id
receipt_id
sales_invoice_id
ar_entry_id
allocated_amount
allocated_at
created_by
status
```

## Payment allocation

```text
payment_allocations
-------------------
id
payment_id
purchase_bill_id
ap_entry_id
allocated_amount
allocated_at
created_by
status
```

This is preferable to a loosely typed polymorphic allocation table because database foreign-key constraints remain strong.

---

# 6. Settlement Formula

Customer:

```text
Invoice receivable
- valid receipt allocations
= outstanding
```

Supplier:

```text
Purchase payable
- valid payment allocations
= outstanding
```

Examples:

```text
Invoice 100000
Receipt 40000
Receipt 30000

Outstanding = 30000
```

---

# 7. Full Payment

```text
Invoice = 100000
Receipt = 100000
Allocation = 100000
Outstanding = 0
Status = PAID
```

No further allocation is allowed.

---

# 8. Partial Payment

```text
Invoice = 100000
Receipt = 40000
Allocation = 40000

Outstanding = 60000
Status = PARTIALLY_PAID
```

---

# 9. One Invoice — Multiple Receipts

```text
INV-001 = 100000

R1 = 30000
R2 = 20000
R3 = 50000
```

Total allocated:

```text
100000
```

Invoice becomes:

```text
PAID
```

---

# 10. One Receipt — Multiple Invoices

```text
Receipt = 100000

INV-001 = 60000
INV-002 = 25000
INV-003 = 15000
```

One receipt voucher, three allocations.

Do not create three receipts.

---

# 11. Unallocated Receipt

```text
Receipt = 100000
Allocations = 0
Unallocated = 100000
```

It remains a valid receipt.

The CA/dealer must be able to see it in:

```text
Unallocated Receipts
```

---

# 12. Customer Advance

Customer pays before invoice:

```text
Receipt = 50000
Invoice = none
```

Record as:

```text
Customer Advance
```

Later:

```text
Invoice = 80000
Allocate advance = 50000
Outstanding = 30000
```

Do not create a fake invoice to represent the advance.

---

# 13. Overpayment

Example:

```text
Invoice = 100000
Receipt = 120000
```

Allocate:

```text
100000 → invoice
20000 → customer advance/unallocated
```

Do not silently allocate more than the invoice receivable.

---

# 14. Supplier Advance

Supplier payment before bill:

```text
Payment = 50000
Purchase Bill = none
```

Record as:

```text
Supplier Advance
```

Later:

```text
Bill = 80000
Allocate 50000
Outstanding = 30000
```

---

# 15. Multiple Outstanding Documents

Receipt allocation UI should show:

```text
Customer
   |
Outstanding invoices

INV-001  ₹60,000
INV-004  ₹35,000
INV-008  ₹80,000
```

User enters:

```text
Receipt = ₹70,000
```

and allocates:

```text
INV-001 → ₹60,000
INV-004 → ₹10,000
```

Server validates all allocations.

---

# 16. Allocation Validation

For every allocation:

```text
amount > 0
```

and:

```text
allocation <= current document outstanding
```

unless explicitly handling advance/overpayment.

Validate:

```text
same business
same party
correct AR/AP entry
document is posted
document is not cancelled
payment/receipt is posted
period is open
```

---

# 17. Cross-Party Validation

Reject:

```text
Customer A receipt
    ↓
Customer B invoice
```

and:

```text
Supplier A payment
    ↓
Supplier B bill
```

The party must match.

---

# 18. Cross-Business Validation

All related records must belong to the same business.

Validate server-side:

```text
payment.business_id
document.business_id
party.business_id
AR/AP business_id
```

---

# 19. Cash/Bank Selection

Payment/receipt should select:

```text
Cash Account
Bank Account
```

rather than only:

```text
payment_method
```

Example:

```text
Method: BANK_TRANSFER
Bank: HDFC Current Account
```

Accounting maps the selected ledger account.

---

# 20. Accounting Effect — Receipt

```text
Bank/Cash Dr
    Customer Receivable Cr
```

The AR amount affected by the receipt is determined by valid allocation.

The accounting journal must balance.

---

# 21. Accounting Effect — Payment

```text
Supplier Payable Dr
    Bank/Cash Cr
```

The AP amount affected by payment is determined by valid allocation.

---

# 22. Accounting Boundary

Payment/Receipt Engine must call:

```text
AccountingEngine.postJournal(...)
```

or the project's equivalent internal accounting service.

Do not construct database journal lines directly in HTTP route handlers.

---

# 23. AR/AP Boundary

Payment/Receipt Engine creates allocations.

The AR/AP engine recalculates:

```text
settled
outstanding
status
```

Do not directly mutate these balances from the Payment/Receipt route.

---

# 24. Payment Date

Store:

```text
payment_date
```

independently from:

```text
purchase_bill_date
```

A supplier bill may be from August 1 and paid August 20.

---

# 25. Receipt Date

Store:

```text
receipt_date
```

independently from:

```text
sales_invoice_date
```

---

# 26. Payment Methods

Support configurable:

```text
CASH
BANK_TRANSFER
UPI
CARD
CHEQUE
OTHER
```

Payment method is classification.

The actual cash/bank ledger account is a separate selected value.

---

# 27. Cheques

Optional fields:

```text
cheque_number
cheque_date
bank_name
```

Status:

```text
RECEIVED
DEPOSITED
CLEARED
BOUNCED
CANCELLED
```

If a cheque bounces, the accounting flow must reverse the settlement effect and preserve the audit trail.

---

# 28. UPI / Bank Reference

Optional:

```text
transaction_reference
bank_reference
gateway_reference
```

These are external reconciliation references.

They are not accounting account identities.

---

# 29. Numbering

Use separate server-side series:

```text
REC/2026-27/000001
PAY/2026-27/000001
```

Use the existing invoice/document series mechanism where possible.

Do not let frontend clients generate final numbers.

---

# 30. Lifecycle

Receipt:

```text
DRAFT
  ↓
VALIDATED
  ↓
POSTED
  ↓
UNALLOCATED / PARTIALLY_ALLOCATED / FULLY_ALLOCATED
  ↓
REVERSED
```

Payment uses the same model.

Document lifecycle and allocation state are separate.

---

# 31. Reversal

Never delete a posted receipt/payment.

Use:

```text
receipt/payment
    ↓
reversal
```

and:

```text
allocation reversal
```

Restore the original outstanding amount.

Preserve all historical records.

---

# 32. Idempotency

Posting and allocation APIs must use the Core idempotency mechanism.

Requirements:

```text
same key + same payload
    -> original result

same key + different payload
    -> conflict
```

No duplicate money movement.

---

# 33. Period Validation

Before posting:

```text
financial_year valid
accounting_period open
business active
party valid
cash/bank account active
```

A locked period rejects normal posting.

---

# 34. Branch Context

Store optional:

```text
branch_id
```

for operational/reporting context.

Example:

```text
Madurai Branch
Receipt ₹50,000
```

This enables:

```text
Branch Collections
```

without creating a separate accounting system.

---

# 35. GST Registration Context

Store optional:

```text
gst_registration_id
```

when useful for reporting.

Payment/receipt normally does not recalculate GST.

Do not create Output/Input GST from payment simply because the invoice had GST.

The original supply transaction owns the GST.

---

# 36. Historical Snapshots

For posted money documents retain relevant snapshots:

```text
party_name
party_gstin
party address
branch/display context
cash/bank account display identity
```

Master changes must not rewrite history.

---

# 37. APIs

## Receipts

```text
POST /api/v1/receipts
GET /api/v1/receipts
GET /api/v1/receipts/:id
POST /api/v1/receipts/:id/allocations
POST /api/v1/receipts/:id/reverse
```

## Payments

```text
POST /api/v1/payments
GET /api/v1/payments
GET /api/v1/payments/:id
POST /api/v1/payments/:id/allocations
POST /api/v1/payments/:id/reverse
```

## Reports

```text
GET /api/v1/receivables
GET /api/v1/payables
GET /api/v1/receipts/unallocated
GET /api/v1/payments/unallocated
```

---

# 38. Receipt Create Request

```json
{
  "partyId": "customer_001",
  "receiptDate": "2026-08-16",
  "amount": "100000.00",
  "paymentMethod": "BANK_TRANSFER",
  "cashBankAccountId": "bank_001",
  "reference": "UTR123",
  "allocations": [
    {
      "invoiceId": "inv_001",
      "amount": "60000.00"
    },
    {
      "invoiceId": "inv_002",
      "amount": "40000.00"
    }
  ]
}
```

The backend must recalculate everything.

---

# 39. Payment Create Request

```json
{
  "partyId": "supplier_001",
  "paymentDate": "2026-08-16",
  "amount": "59000.00",
  "paymentMethod": "BANK_TRANSFER",
  "cashBankAccountId": "bank_001",
  "reference": "UTR987",
  "allocations": [
    {
      "purchaseBillId": "pur_001",
      "amount": "59000.00"
    }
  ]
}
```

---

# 40. Reporting

Initial:

```text
Receipt Register
Payment Register
Customer Outstanding
Supplier Outstanding
Unallocated Receipts
Unallocated Payments
Customer Advances
Supplier Advances
```

Later:

```text
Collection Report
Payment Due Report
Cash Book
Bank Book
Branch-wise Collections
Aging Report
```

---

# 41. Customer Ledger

Example:

```text
15 Aug  INV-001  Dr 100,000
20 Aug  REC-001  Cr  40,000
25 Aug  REC-002  Cr  30,000

Balance = 30,000
```

Drill-down:

```text
Invoice
  ↓
Receipt
  ↓
Allocation
```

---

# 42. Supplier Ledger

Example:

```text
15 Aug  PUR-001  Cr 100,000
20 Aug  PAY-001  Dr  40,000
25 Aug  PAY-002  Dr  30,000

Balance = 30,000
```

---

# 43. Audit

Record:

```text
RECEIPT_CREATED
RECEIPT_POSTED
RECEIPT_ALLOCATED
RECEIPT_REVERSED

PAYMENT_CREATED
PAYMENT_POSTED
PAYMENT_ALLOCATED
PAYMENT_REVERSED

ALLOCATION_CREATED
ALLOCATION_REVERSED
```

Every event records:

```text
user
timestamp
before
after
reason
```

---

# 44. Validation Errors

```text
PARTY_NOT_FOUND
PARTY_ROLE_INVALID
AMOUNT_INVALID
ACCOUNT_NOT_FOUND
ACCOUNT_NOT_ACTIVE
INVOICE_NOT_FOUND
PURCHASE_BILL_NOT_FOUND
PARTY_MISMATCH
BUSINESS_MISMATCH
AR_AP_ENTRY_NOT_FOUND
ALLOCATION_EXCEEDS_OUTSTANDING
INVALID_PAYMENT_METHOD
PERIOD_LOCKED
ALREADY_REVERSED
ALLOCATION_ALREADY_REVERSED
```

---

# 45. Tests

## Receipt

```text
[ ] Full receipt
[ ] Partial receipt
[ ] One receipt → multiple invoices
[ ] Multiple receipts → one invoice
[ ] Unallocated receipt
[ ] Customer advance
[ ] Overpayment
[ ] Reversal
```

## Payment

```text
[ ] Full payment
[ ] Partial payment
[ ] One payment → multiple bills
[ ] Multiple payments → one bill
[ ] Unallocated payment
[ ] Supplier advance
[ ] Overpayment
[ ] Reversal
```

## Allocation

```text
[ ] Valid allocation
[ ] Over-allocation rejected
[ ] Cross-party allocation rejected
[ ] Cross-business allocation rejected
[ ] Duplicate allocation rejected
[ ] Reversal restores outstanding
[ ] Concurrent allocation cannot over-settle
```

## Accounting

```text
[ ] Receipt: Bank/Cash Dr, AR Cr
[ ] Payment: AP Dr, Bank/Cash Cr
[ ] Journal balances
[ ] Allocation does not duplicate cash movement
```

## Period/security

```text
[ ] Locked period rejected
[ ] Unauthorized branch rejected
[ ] Cross-business records rejected
[ ] Idempotency retry does not duplicate
```

---

# 46. Definition of Done

```text
[ ] Receipt entity
[ ] Payment entity
[ ] Standalone money vouchers
[ ] Separate allocation tables
[ ] Full/partial/unallocated settlement
[ ] Advances
[ ] Overpayment handling
[ ] Reversal
[ ] Cash/bank account mapping
[ ] Branch context
[ ] Period validation
[ ] Idempotency
[ ] AR/AP settlement integration
[ ] Audit
[ ] APIs
[ ] Reports
[ ] Tests
[ ] Sales integration
[ ] Purchase integration
```

---

# 47. What the Payment/Receipt Engine must NOT own

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
GST returns
Bank reconciliation
E-Invoice
E-Way Bill
CA filing workflow
```

# Final Rule

> The Payment/Receipt Engine owns money movement and settlement. Sales/Purchase create receivables/payables; Receipts/Payments move cash or bank funds; allocations settle those balances; Accounting records the resulting financial effects; GST remains owned by the original supply transaction.
