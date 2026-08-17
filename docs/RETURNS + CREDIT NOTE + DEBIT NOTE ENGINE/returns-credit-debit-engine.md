# RETURNS-CREDIT-DEBIT-ENGINE.md — GSTfy Returns, Credit Note & Debit Note Engine

## 0. Purpose

GSTfy now has:

```text
Organization
Party Master
Product Engine
Accounting Engine
Tax Engine
Inventory Engine
Sales
Purchase
POS
Payment / Receipt
Bank Reconciliation v2
```

The next transaction layer is:

```text
Sales Return
Purchase Return
Credit Note
Debit Note
```

This engine orchestrates the completed Tax, Inventory, Accounting, AR/AP, Payment/Receipt, Party, and Product engines.

Core rule:

> An adjustment is a new immutable transaction referencing the original transaction. It never edits the original posted document.

---

# 1. Four Distinct Concepts

Do not treat these as synonyms:

```text
SALES_RETURN
PURCHASE_RETURN
CREDIT_NOTE
DEBIT_NOTE
```

### Sales Return

Customer returns goods/services from an original sale.

Possible effects:

```text
Inventory IN
Revenue adjustment
GST adjustment
Customer receivable reduction
```

### Purchase Return

Business returns goods to supplier.

Possible effects:

```text
Inventory OUT
Purchase/inventory adjustment
GST/ITC adjustment
Supplier payable reduction
```

### Credit Note

Reduces amount/tax/value of an original transaction. It may be:

```text
goods-related
value-only
tax/value adjustment
```

### Debit Note

Increases amount/tax/value of an original transaction.

The actual accounting/tax direction is determined by:

```text
issuer
recipient
original document
transaction context
```

Never infer meaning from the document name alone.

---

# 2. Source Document

Every adjustment should reference an original posted transaction where applicable:

```text
original_voucher_id
original_line_id nullable
```

Example:

```text
INV-001
  ├── SR-001
  └── CN-001
```

Original documents remain immutable.

Never implement a return as only:

```text
negative invoice
```

---

# 3. Adjustment Header

Recommended:

```text
adjustment_documents
--------------------
id
business_id
voucher_id
adjustment_number
adjustment_type
original_voucher_id
party_id
branch_id
gst_registration_id
adjustment_date
reason_code
reason
status
subtotal
discount_total
taxable_total
cgst_total
sgst_total
igst_total
cess_total
round_off
grand_total
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

---

# 4. Adjustment Lines

```text
adjustment_document_lines
-------------------------
id
adjustment_document_id
original_line_id nullable
item_id nullable

description_snapshot
sku_snapshot
hsn_sac_snapshot
uqc_snapshot

quantity
unit
rate
discount
taxable_value

tax_profile_snapshot
gst_rate_snapshot
cgst_rate
sgst_rate
igst_rate
cess_rule_snapshot

cgst_amount
sgst_amount
igst_amount
cess_amount

inventory_effect
inventory_warehouse_id nullable
batch_id nullable
serial_id nullable
```

Posted lines preserve the historical product/tax state used when the document was posted.

---

# 5. Returnable Quantity

For an original invoice line:

```text
returnable =
original_quantity
- sum(valid previous returns)
```

Prevent:

```text
current_return > returnable
```

Lock the source line/state before final validation to prevent concurrent over-returns.

---

# 6. Adjustment Eligibility

Before posting:

```text
original document exists
original is POSTED
original is not CANCELLED
same business
same party
item/context is valid
remaining returnable/adjustable amount exists
period is OPEN
```

Default MVP:

```text
Original document required
```

Anonymous/manual returns can be a later explicitly configured workflow.

---

# 7. Sales Return

Flow:

```text
Sales Invoice
    ↓
Create Return
    ↓
Select lines/quantities
    ↓
Tax Engine
    ↓
Inventory Engine
    ↓
Accounting Engine
    ↓
AR adjustment
    ↓
Core Posting
```

Typical accounting:

```text
Sales Return / Revenue Adjustment   Dr
Output GST Adjustment               Dr
    Customer Receivable                Cr
```

A refund is separate:

```text
Return
  ↓
Receivable/Credit
  ↓
Payment/Refund workflow
```

---

# 8. Sales Return Inventory

Example:

```text
Sale:
10 units → stock -10

Return:
2 units → stock +2
```

Inventory determines returned cost/value.

Never use selling price as inventory cost.

---

# 9. Purchase Return

Flow:

```text
Purchase Bill
    ↓
Create Return
    ↓
Select lines/quantities
    ↓
Tax Engine
    ↓
Inventory Engine
    ↓
Accounting Engine
    ↓
AP adjustment
    ↓
Core Posting
```

Typical:

```text
Supplier Payable              Dr
    Purchase/Inventory Adjustment Cr
    Input GST Adjustment          Cr
```

The exact purchase/inventory account is configured by Accounting/Inventory policy.

---

# 10. Purchase Return Inventory

Example:

```text
Purchase:
10 units → stock +10

Return:
2 units → stock -2
```

Inventory valuation determines the cost/value reduction.

---

# 11. Credit Note

A Credit Note must explicitly contain:

```text
credit_note_context
original_transaction_type
issuer
recipient
```

Possible contexts:

```text
SALES_RELATED
PURCHASE_RELATED
VALUE_ONLY
TAX_ADJUSTMENT
GOODS_RELATED
```

A Sales Credit Note can reduce receivable without moving inventory:

```text
price adjustment
commercial discount
service correction
```

Therefore:

```text
Credit Note != Sales Return
```

---

# 12. Debit Note

Debit Note also preserves:

```text
issuer
recipient
original_voucher_id
context
```

The system determines:

```text
AR/AP direction
GST direction
inventory effect
```

from the transaction context.

Do not hard-code debit/credit behavior by document name.

---

# 13. Supplier-Issued Notes

The system must distinguish:

```text
GSTfy-issued adjustment
```

from:

```text
supplier/customer-issued adjustment recorded by GSTfy
```

A supplier's credit note should not be incorrectly treated as though GSTfy issued it.

Use explicit fields such as:

```text
issuer_type
document_direction
source_party_role
```

where required.

---

# 14. Partial Returns

Example:

```text
Original:
10 units @ ₹1,000

Previous returned:
2

Current return:
3

Remaining:
5
```

UI must show:

```text
Original
Previously Returned
Remaining
Return Now
```

Backend is authoritative.

---

# 15. Multiple Returns

Support:

```text
INV-001
  ├── SR-001 = 2
  ├── SR-002 = 3
  └── SR-003 = 1
```

Remaining:

```text
10 - 6 = 4
```

---

# 16. Full Return

When all eligible quantity is returned:

```text
returnable quantity = 0
```

Show:

```text
FULLY_RETURNED
```

The original invoice remains intact.

---

# 17. Value Adjustment Limits

For Credit/Debit Notes that adjust value rather than quantity:

```text
previous adjustments
+
current adjustment
<= permitted source value
```

The backend calculates remaining adjustable value.

Never trust frontend totals.

---

# 18. Tax Integration

Every posted return/note calls:

```text
TaxEngine.calculateTax()
```

with:

```text
original transaction context
adjustment type
adjustment date
party
party GST registration
place of supply
item/quantity/value
```

Tax Engine returns:

```text
taxability
classification
taxable value
CGST
SGST
IGST
cess
tax rule version
```

Do not duplicate GST calculations in this engine.

---

# 19. Inventory Integration

Call:

```text
InventoryEngine.postMovement()
```

Sales Return:

```text
STOCK IN
```

Purchase Return:

```text
STOCK OUT
```

Value-only Credit/Debit Note:

```text
NO INVENTORY MOVEMENT
```

For batch/serial items, Inventory validates the returned stock identity.

---

# 20. Accounting Integration

The Adjustment Engine sends an accounting command:

```text
AccountingEngine.postJournal()
```

It must not insert journal lines directly.

Accounting maps:

```text
revenue adjustments
purchase/inventory adjustments
input/output GST
AR/AP
```

to configured ledger accounts.

---

# 21. AR/AP Integration

Sales Return / Sales Credit Note commonly:

```text
reduce customer receivable
```

Purchase Return / supplier adjustment commonly:

```text
reduce supplier payable
```

The actual direction comes from the Accounting/Tax context.

Never mutate:

```text
party.outstanding
```

directly.

---

# 22. Payment/Receipt Integration

An adjustment does not automatically move money.

Example:

```text
Sales Return
    ↓
Customer credit / reduced receivable
    ↓
Customer requests refund
    ↓
Payment/Refund workflow
```

Likewise:

```text
Purchase Return
    ↓
Supplier credit/reduced payable
    ↓
Supplier refund
    ↓
Receipt/Payment workflow
```

Keep adjustment and money movement separate.

---

# 23. Lifecycle

```text
DRAFT
  ↓
VALIDATED
  ↓
POSTED
```

Reversal:

```text
POSTED
  ↓
REVERSED
```

Posted adjustments are immutable.

---

# 24. Reversal

Reversal must:

```text
reverse tax effect
reverse inventory effect
reverse accounting
reverse AR/AP adjustment
preserve source reference
create audit record
```

Never delete a posted adjustment.

---

# 25. Numbering

Use server-side transactional series:

```text
SR/2026-27/000001
PR/2026-27/000001
CN/2026-27/000001
DN/2026-27/000001
```

Use existing numbering/financial-year/branch rules.

---

# 26. Concurrency

Example:

```text
Invoice quantity = 10

User A returns 7
User B returns 5
```

Only a valid cumulative quantity can post.

Lock the relevant:

```text
original voucher/line
return state
```

before final validation.

Value adjustments need the same protection against exceeding the remaining allowable amount.

---

# 27. Idempotency

Use Core operation idempotency for:

```text
create
post
reverse
```

for:

```text
Sales Return
Purchase Return
Credit Note
Debit Note
```

Rules:

```text
same key + same payload -> original result
same key + changed payload -> 409
```

No duplicate:

```text
adjustment
journal
inventory movement
GST entry
AR/AP adjustment
```

---

# 28. Historical Snapshots

Posted adjustment lines preserve:

```text
party snapshot
GST registration snapshot
address snapshot where relevant
product snapshot
HSN/SAC
UQC
tax profile
tax rule version
rate
quantity
warehouse
batch
serial
```

Changing Product/Party later must not alter historical documents.

---

# 29. Backend APIs

## Sales Returns

```text
GET   /api/v1/sales-returns
POST  /api/v1/sales-returns
GET   /api/v1/sales-returns/:id
PATCH /api/v1/sales-returns/:id
POST  /api/v1/sales-returns/:id/post
POST  /api/v1/sales-returns/:id/reverse
GET   /api/v1/sales-invoices/:id/returnable
```

## Purchase Returns

```text
GET   /api/v1/purchase-returns
POST  /api/v1/purchase-returns
GET   /api/v1/purchase-returns/:id
PATCH /api/v1/purchase-returns/:id
POST  /api/v1/purchase-returns/:id/post
POST  /api/v1/purchase-returns/:id/reverse
GET   /api/v1/purchase-bills/:id/returnable
```

## Credit Notes

```text
GET   /api/v1/credit-notes
POST  /api/v1/credit-notes
GET   /api/v1/credit-notes/:id
PATCH /api/v1/credit-notes/:id
POST  /api/v1/credit-notes/:id/post
POST  /api/v1/credit-notes/:id/reverse
```

## Debit Notes

```text
GET   /api/v1/debit-notes
POST  /api/v1/debit-notes
GET   /api/v1/debit-notes/:id
PATCH /api/v1/debit-notes/:id
POST  /api/v1/debit-notes/:id/post
POST  /api/v1/debit-notes/:id/reverse
```

---

# 30. Backend Services

Recommended:

```text
adjustments/
├── returns.service
├── credit-notes.service
├── debit-notes.service
├── eligibility.service
├── calculation.service
├── posting.service
├── reversal.service
├── validation.service
├── schemas
├── routes
└── tests
```

Responsibilities:

```text
Eligibility
  returnable quantity / adjustable value

Tax
  Tax Engine integration

Inventory
  Inventory Engine integration

Accounting
  Accounting Engine integration

AR/AP
  adjustment settlement

Core
  voucher/posting boundary
```

---

# 31. Frontend Navigation

Recommended:

```text
Transactions
├── Sales
├── Purchases
├── Returns & Notes
│   ├── Sales Returns
│   ├── Purchase Returns
│   ├── Credit Notes
│   └── Debit Notes
└── Payments
```

Alternatively expose Returns/Notes under the Sales/Purchase sections if that matches the existing information architecture.

---

# 32. Sales Return UX

Preferred entry:

```text
Sales Invoice
  ↓
Create Return
```

Show:

```text
Invoice Number
Customer
Invoice Date

Item
Original Qty
Previously Returned
Remaining
Return Now
Rate
Tax
Warehouse
Reason
```

Summary:

```text
Taxable
CGST
SGST/IGST
Cess
Total
```

Actions:

```text
Save Draft
Post Return
```

---

# 33. Purchase Return UX

Start from:

```text
Purchase Bill
  ↓
Create Return
```

Show:

```text
Supplier
Bill
Item
Purchased Qty
Previously Returned
Remaining
Return Now
Warehouse
Batch/Serial
Reason
```

---

# 34. Credit Note UX

Start:

```text
Create Credit Note
```

Select:

```text
Party
Original Document
Reason
Adjustment Context
```

Then:

```text
Goods-related
Value-only
Tax/value adjustment
```

Explicitly show:

```text
Inventory Effect: YES / NO
```

if relevant.

---

# 35. Debit Note UX

Show:

```text
Party
Issuer
Recipient
Original Document
Reason
Adjustment Context
Amount
Tax
```

Do not make users infer the accounting direction from the label.

---

# 36. Return Selection Grid

Example:

```text
INV-001

Item        Original  Returned  Remaining  Return
Laptop      10        2         8          [  ]
Mouse       20        5         15         [  ]
Keyboard    10        0         10         [  ]
```

Prevent over-return in frontend and backend.

---

# 37. Batch/Serial UX

For tracked products:

```text
Item
Warehouse
Batch
Serial
Quantity
```

Only valid stock identities from Inventory Engine are selectable.

A returned serial cannot already be:

```text
RETURNED
DAMAGED
UNAVAILABLE
```

---

# 38. Adjustment Detail Page

Show:

```text
Document Number
Type
Status
Original Document
Party
Date
Reason
```

Lines:

```text
Item
Quantity
Rate
Tax
Inventory effect
Warehouse
Batch/Serial
```

Tabs/sections:

```text
Accounting
Tax
AR/AP
Audit
```

---

# 39. Source Document Integration

Sales Invoice page:

```text
Create Sales Return
Create Credit Note
```

Purchase Bill page:

```text
Create Purchase Return
Record Supplier Credit Note
Create Debit Note
```

Actions appear only when allowed by:

```text
document status
remaining returnable quantity
remaining adjustable value
party/transaction context
```

---

# 40. Party Integration

Party detail should eventually display:

```text
Sales Returns
Purchase Returns
Credit Notes
Debit Notes
```

Ledger drill-down should show the resulting AR/AP effect.

Do not implement a second adjustment history inside Party Master.

---

# 41. Payment/Receipt Integration

From a posted customer credit:

```text
Customer credit
    ↓
Refund action
    ↓
Payment/Refund Engine
```

From supplier credit:

```text
Supplier credit
    ↓
Refund/settlement
    ↓
Receipt/Payment Engine
```

Keep money movement separate from the adjustment document.

---

# 42. Reports

Initial:

```text
Sales Return Register
Purchase Return Register
Credit Note Register
Debit Note Register
Return Summary
Adjustment Summary
```

Filters:

```text
date
party
branch
GST registration
reason
item
document type
```

---

# 43. Export

Support:

```text
Sales Returns CSV/XLSX
Purchase Returns CSV/XLSX
Credit Notes CSV/XLSX
Debit Notes CSV/XLSX
```

Posted records are the default export source.

---

# 44. Audit

Events:

```text
SALES_RETURN_CREATED
SALES_RETURN_POSTED
SALES_RETURN_REVERSED

PURCHASE_RETURN_CREATED
PURCHASE_RETURN_POSTED
PURCHASE_RETURN_REVERSED

CREDIT_NOTE_CREATED
CREDIT_NOTE_POSTED
CREDIT_NOTE_REVERSED

DEBIT_NOTE_CREATED
DEBIT_NOTE_POSTED
DEBIT_NOTE_REVERSED
```

Record:

```text
actor
timestamp
source document
before
after
reason
```

---

# 45. Permissions

```text
SALES_RETURN_VIEW
SALES_RETURN_CREATE
SALES_RETURN_POST
SALES_RETURN_REVERSE

PURCHASE_RETURN_VIEW
PURCHASE_RETURN_CREATE
PURCHASE_RETURN_POST
PURCHASE_RETURN_REVERSE

CREDIT_NOTE_VIEW
CREDIT_NOTE_CREATE
CREDIT_NOTE_POST
CREDIT_NOTE_REVERSE

DEBIT_NOTE_VIEW
DEBIT_NOTE_CREATE
DEBIT_NOTE_POST
DEBIT_NOTE_REVERSE
```

Enforce existing branch scope server-side.

---

# 46. Error Codes

```text
ORIGINAL_DOCUMENT_NOT_FOUND
ORIGINAL_DOCUMENT_NOT_POSTED
ORIGINAL_DOCUMENT_CANCELLED
PARTY_MISMATCH
BUSINESS_MISMATCH
ITEM_NOT_RETURNABLE
RETURN_QUANTITY_EXCEEDED
ADJUSTMENT_AMOUNT_EXCEEDED
INVALID_ADJUSTMENT_TYPE
INVALID_TAX_CONTEXT
INVALID_INVENTORY_CONTEXT
BATCH_REQUIRED
SERIAL_REQUIRED
SERIAL_NOT_RETURNABLE
WAREHOUSE_REQUIRED
DOCUMENT_ALREADY_REVERSED
PERIOD_LOCKED
DUPLICATE_IDEMPOTENCY_KEY
```

---

# 47. Atomic Posting

```text
BEGIN
  validate source
  lock source line/adjustable state
  resolve Tax
  calculate adjustment
  create adjustment voucher
  create Inventory movement if required
  create Accounting journal
  create GST entry
  create AR/AP adjustment
  audit
COMMIT
```

Failure:

```text
ROLLBACK
```

No partial adjustment is allowed.

---

# 48. Tests — Backend

### Sales Return

```text
[ ] full return
[ ] partial return
[ ] multiple returns
[ ] return exceeds original
[ ] return exceeds remaining
[ ] inventory stock-in
[ ] GST adjustment
[ ] AR adjustment
[ ] reversal
```

### Purchase Return

```text
[ ] full return
[ ] partial return
[ ] multiple returns
[ ] inventory stock-out
[ ] GST adjustment
[ ] AP adjustment
[ ] reversal
```

### Credit Note

```text
[ ] value-only
[ ] goods-related
[ ] tax adjustment
[ ] original reference
[ ] no inventory for value-only
[ ] AR/AP adjustment
[ ] reversal
```

### Debit Note

```text
[ ] issuer/recipient validation
[ ] original reference
[ ] tax adjustment
[ ] AR/AP adjustment
[ ] reversal
```

### Security

```text
[ ] cross-business rejected
[ ] party mismatch rejected
[ ] locked period rejected
[ ] invalid warehouse rejected
```

### Concurrency

```text
[ ] concurrent return
[ ] no over-return
[ ] concurrent adjustment amount
```

### Idempotency

```text
[ ] retry returns original
[ ] changed retry returns 409
```

---

# 49. Tests — Frontend

```text
[ ] Create Return from Sales Invoice
[ ] Create Return from Purchase Bill
[ ] Credit Note form
[ ] Debit Note form
[ ] Remaining quantity calculation
[ ] Over-return blocked
[ ] Batch/serial selection
[ ] Warehouse selection
[ ] Reason selection
[ ] Tax summary
[ ] Save Draft
[ ] Post
[ ] Reverse
[ ] Detail page
[ ] Filters
[ ] Pagination
[ ] Export
[ ] Loading
[ ] Empty
[ ] Error
[ ] Permission states
```

---

# 50. Definition of Done

## Backend

```text
[ ] adjustment document model
[ ] sales return
[ ] purchase return
[ ] credit note
[ ] debit note
[ ] original-document reference
[ ] returnable quantity
[ ] adjustable value
[ ] Tax integration
[ ] Inventory integration
[ ] Accounting integration
[ ] AR/AP adjustment
[ ] Payment/Receipt boundary
[ ] numbering
[ ] reversal
[ ] idempotency
[ ] concurrency protection
[ ] audit
[ ] permissions
[ ] reports
[ ] exports
[ ] tests
```

## Frontend

```text
[ ] Sales Returns
[ ] Purchase Returns
[ ] Credit Notes
[ ] Debit Notes
[ ] Source-document creation
[ ] Return selection grid
[ ] Batch/serial support
[ ] Tax summary
[ ] Inventory-effect visibility
[ ] Detail pages
[ ] Reverse flow
[ ] Party integration
[ ] Sales/Purchase integration
[ ] Search/filter/pagination
[ ] Export
[ ] Loading/empty/error states
[ ] Permission handling
```

---

# 51. What This Engine Must NOT Own

```text
GST calculation
Product CRUD
Party CRUD
Live payment settlement
Bank reconciliation
GSTR-1
GSTR-3B
ITC reconciliation
E-Invoice
E-Way Bill
CA filing workflow
```

---

# 52. Final Architecture

```text
                 ORIGINAL TRANSACTION
                         |
              RETURN / CREDIT / DEBIT
                         |
       +-----------------+----------------+
       |                 |                |
   Tax Engine       Inventory Engine   Accounting
       |                 |                |
       +-----------------+----------------+
                         |
                      AR / AP
                         |
                 Payment/Receipt
                         |
                      Cash/Bank
```

## Final rule

> Returns and Credit/Debit Notes are immutable adjustment transactions. They reference the original document, use Tax Engine for tax determination, Inventory Engine for stock effects where applicable, Accounting Engine for financial posting, AR/AP for obligation adjustment, and Payment/Receipt only when actual money movement occurs.
