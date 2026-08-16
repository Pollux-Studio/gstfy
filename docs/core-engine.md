# CORE-ENGINE.md — GSTfy Business Transaction Core

## Purpose
Define the shared transaction architecture after the completed organization foundation. GSTfy must record each business event once and derive accounting, inventory, GST, receivable/payable, audit and reporting effects from the posted transaction.

Current foundation:
```text
Business -> GST Registrations -> Locations -> Branches -> Warehouses
         -> Branch/Warehouse links -> Branch Users -> Financial Years -> Invoice Series
```

## 1. Product architecture

```text
Organization
    ↓
Party Master
    ↓
Product Master
    ↓
Accounting Engine
    ↓
Inventory Engine
    ↓
Tax Engine
    ↓
Transaction/Voucher Engine
    ↓
Sales / Purchase / Payments / Returns / Notes
    ↓
GST + Accounting + Inventory Reports
    ↓
CA Review / Reconciliation / Export
```

Do not implement separate accounting, inventory or GST logic inside each document module.

## 2. Source of truth

The posted transaction ledger is the source of truth.

Never make these the primary source:
- PDF invoices
- GSTR Excel/JSON
- dashboard totals
- manually maintained balances
- current product master for historical documents
- current party master for historical documents

## 3. Core entities

```text
vouchers
journal_entries
journal_entry_lines
inventory_transactions
gst_entries
receivable_payable_entries
audit_logs
```

Specialized documents sit above the voucher:

```text
sales_invoices
purchase_invoices
credit_notes
debit_notes
returns
payments
receipts
```

## 4. Voucher types

Initial:
```text
SALES
PURCHASE
RECEIPT
PAYMENT
CREDIT_NOTE
DEBIT_NOTE
SALES_RETURN
PURCHASE_RETURN
EXPENSE
JOURNAL
STOCK_TRANSFER
STOCK_ADJUSTMENT
```

Future:
```text
SALES_ORDER
PURCHASE_ORDER
DELIVERY_CHALLAN
RECEIPT_NOTE
JOB_WORK_OUT
JOB_WORK_RETURN
```

## 5. Voucher model

```text
vouchers
--------
id
business_id
gst_registration_id nullable
branch_id nullable
warehouse_id nullable
voucher_type
voucher_number
voucher_date
financial_year_id
status
reference_voucher_id nullable
created_by
posted_by
created_at
posted_at
cancelled_at
notes
```

Do not force every voucher to have a GST registration or warehouse.

## 6. Lifecycle

```text
DRAFT
  ↓
VALIDATE
  ↓
POST
  ↓
POSTED
```

Optional:
```text
POSTED → CANCELLED
```

Corrections use:
```text
Credit Note
Debit Note
Return
Journal Adjustment
Other applicable workflow
```

Do not delete posted financial transactions.

## 7. Posting pipeline

```text
postTransaction(command)
    ↓
authorize user
    ↓
resolve business/GST/branch/warehouse/financial year
    ↓
validate party
    ↓
validate products
    ↓
calculate tax
    ↓
begin database transaction
    ↓
allocate document number if required
    ↓
create voucher/document
    ↓
create journal entries
    ↓
create inventory entries
    ↓
create GST entries
    ↓
create AR/AP entries
    ↓
create audit record
    ↓
commit
```

If any required step fails, rollback all posting effects.

## 8. Organization context

A transaction may need:

```text
business_id
gst_registration_id
branch_id
location_id
warehouse_id
financial_year_id
user_id
```

Rules:
- `business_id` is the tenant/business.
- `gst_registration_id` is the legal tax identity.
- `branch_id` is the operational unit.
- `warehouse_id` is the physical stock location.
- Never infer GST identity solely from branch.

## 9. Accounting contract

Every accounting-impacting transaction creates balanced journals.

Sales example:
```text
Customer          Dr 82,600
    Sales             Cr 70,000
    Output CGST       Cr  6,300
    Output SGST       Cr  6,300
```

Purchase example:
```text
Purchase          Dr 50,000
Input CGST         Dr  4,500
Input SGST         Dr  4,500
    Supplier          Cr 59,000
```

Invariant:
```text
SUM(debit) = SUM(credit)
```

Do not store customer/supplier balances as the financial source of truth.

## 10. Inventory contract

Inventory changes are event-based:

```text
PURCHASE          +Qty
SALE              -Qty
SALES_RETURN      +Qty
PURCHASE_RETURN   -Qty
TRANSFER_OUT      -Qty
TRANSFER_IN       +Qty
ADJUSTMENT        +/-Qty
DAMAGE            -Qty
EXPIRY            -Qty
```

Every inventory transaction references its source voucher and item.

## 11. Tax contract

Use one canonical tax engine:

```text
calculateTax(context)
```

Input:
```text
seller GST registration
party GST registration
place of supply
transaction date
item tax profile
taxable value
supply type
reverse charge
```

Output:
```text
taxability
classification
taxable_value
cgst
sgst
igst
cess
```

Do not calculate CGST/SGST/IGST separately in Sales and Purchase modules.

## 12. GST ledger

Every relevant tax result creates a GST entry linked to its source voucher.

Examples:
```text
Sale:
Output CGST
Output SGST

Purchase:
Input CGST
Input SGST

RCM:
RCM liability / applicable ITC
```

Input tax recorded in books is not automatically claimable ITC.

## 13. Receivable/payable

Sales creates customer receivable.
Purchase creates supplier payable.
Receipt reduces customer receivable.
Payment reduces supplier payable.

Use allocations:

```text
payment_allocations
-------------------
payment_id
document_id
allocated_amount
```

Support:
```text
full payment
partial payment
multiple payments
advance
unallocated payment
```

## 14. References

Every adjustment retains an original-document reference.

```text
INV-001
  ├── CN-001
  ├── REC-001
  └── EINV-001

PUR-001
  ├── PAY-001
  └── DN-001
```

Never model returns merely as negative invoices.

## 15. Central warehouse scenario

Support:
```text
5 branches
1 central warehouse
```

Example:
```text
Chennai Central Warehouse
   ├── Chennai Branch
   ├── Madurai Branch
   ├── Salem Branch
   ├── Coimbatore Branch
   └── Tirunelveli Branch
```

A sale can have:
```text
sales_branch = Madurai
dispatch_warehouse = Chennai Central
```

Branch and dispatch location are separate.

## 16. Stock transfers

Same-registration/internal movement may use:
```text
STOCK_TRANSFER
```

But if movement is between separate GST registrations, do not assume it is an ordinary internal transfer. It must enter the GST transaction/compliance rules for distinct registrations.

## 17. Number allocation

Use the existing `invoice_series` foundation.

Allocation input:
```text
business
gst_registration
branch
financial_year
document_type
series
```

Allocation must be server-side, transactional and concurrency-safe.

Never trust frontend sequence numbers.

## 18. Idempotency

Posting endpoints must support an idempotency key.

```text
same request + same key
        ↓
return original result
```

This prevents duplicate invoices/payments after network retries.

## 19. Money

Use PostgreSQL `NUMERIC` and a consistent decimal strategy.

Do not persist financial amounts as binary floating-point numbers.

Centralize:
```text
precision
rounding
tax calculation
```

## 20. Permissions

```text
authenticated user
    ↓
business membership
    ↓
role
    ↓
module permission
    ↓
branch scope
```

Backend must enforce permissions even if frontend hides controls.

## 21. Audit

Audit:
```text
DRAFT_CREATED
DRAFT_UPDATED
POSTED
CANCELLED
CREDIT_NOTE_CREATED
DEBIT_NOTE_CREATED
PAYMENT_ALLOCATED
STOCK_TRANSFERRED
GST_ADJUSTED
```

Store:
```text
entity_type
entity_id
action
user_id
timestamp
before
after
reason
```

## 22. Periods

Support:
```text
OPEN
UNDER_REVIEW
READY
EXPORTED
FILED
LOCKED
```

Locked periods reject normal edits. Corrections happen through new adjustment transactions.

## 23. Reporting

All reports derive from posted data:

```text
Sales Register
Purchase Register
Ledger
Stock Register
GST Ledger
Receivables
Payables
Branch reports
Warehouse reports
GST reports
```

Every report figure must be traceable back to source vouchers.

## 24. External compliance

E-invoice/e-way bill API calls should not hold the main DB transaction open.

Preferred:
```text
Post invoice
    ↓
Commit
    ↓
Compliance outbox/job
    ↓
External API
```

Store external statuses separately.

## 25. Definition of done

```text
[ ] Common voucher model
[ ] Posting service
[ ] Atomic DB posting
[ ] Accounting contract
[ ] Inventory contract
[ ] Tax contract
[ ] AR/AP contract
[ ] Branch scope enforcement
[ ] Transaction-safe document numbering
[ ] Idempotency
[ ] Audit
[ ] Posted-document immutability
[ ] Adjustment relationships
[ ] Report traceability
```

## Final rule

> GSTfy records a business event once through a common posting engine; accounting, inventory, GST, receivables/payables, audit and reporting are derived effects of that posted event.
