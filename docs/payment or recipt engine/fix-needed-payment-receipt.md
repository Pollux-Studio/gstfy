# FIX-NEEDED-PAYMENT-RECEIPT.md — GSTfy Corrections Before Payment & Receipt Engine

## Purpose

GSTfy currently has:

```text
Organization        ✅
Party Master        ✅
Product Engine      ✅
Core Voucher        ✅
Accounting Engine   ✅
Tax Engine          ✅
Inventory Engine    ✅
Sales v1            ✅
Purchase v1         ✅
POS v1              ✅
```

Before implementing Payment/Receipt, make the settlement architecture explicit.

## 1. Separate invoice from settlement

Required:

```text
Invoice
  ↓
AR/AP
  ↓
Receipt / Payment
  ↓
Allocation
  ↓
Outstanding
```

`paid_amount` must not be the source of truth.

## 2. Separate status types

Document:

```text
DRAFT
POSTED
CANCELLED
```

Payment status:

```text
UNPAID
PARTIALLY_PAID
PAID
OVERDUE
```

Allocation status may be:

```text
UNALLOCATED
PARTIALLY_ALLOCATED
FULLY_ALLOCATED
REVERSED
```

## 3. Settlement source of truth

Use allocations:

```text
payment_allocations
```

Example:

```text
Invoice = 100000
Receipt A = 40000
Receipt B = 30000

Settled = 70000
Outstanding = 30000
```

Do not independently accept client values for:

```text
settled_amount
outstanding_amount
payment_status
```

## 4. Receipt vs Payment

Receipt:

```text
Customer → Business
Bank/Cash Dr
    Customer Receivable Cr
```

Payment:

```text
Business → Supplier
Supplier Payable Dr
    Bank/Cash Cr
```

Keep the directions explicit.

## 5. Standalone money vouchers

A receipt/payment may exist without an invoice/bill.

Support:

```text
CUSTOMER_ADVANCE
SUPPLIER_ADVANCE
UNALLOCATED_RECEIPT
UNALLOCATED_PAYMENT
```

## 6. Allocation validation

Validate:

```text
same business
same party
valid AR/AP entry
allocation > 0
allocation <= current outstanding
```

unless an explicit advance/overpayment path is used.

## 7. Cross-party protection

Reject:

```text
Customer A receipt → Customer B invoice
Supplier A payment → Supplier B bill
```

## 8. Cross-business protection

All related records must belong to the same business.

Never trust client-supplied IDs without authorization.

## 9. Branch and GST registration

Money documents may carry:

```text
branch_id
gst_registration_id
```

for operational/reporting context.

Do not create separate accounting systems per branch.

## 10. Cash/Bank mapping

Payment methods:

```text
CASH
BANK_TRANSFER
UPI
CARD
CHEQUE
OTHER
```

Map to actual ledger accounts/configuration.

Do not hard-code one account for each method.

## 11. Existing paid-at-invoice flow

If Sales/Purchase currently accepts `paidAmount`, preserve it temporarily but implement internally as:

```text
Post Invoice
   ↓
Create Receipt/Payment
   ↓
Allocate to invoice/bill
```

Do not directly inject cash/bank settlement into the invoice journal forever.

## 12. Date and period

Store payment/receipt date separately from invoice/bill date.

Locked periods must reject new posting.

## 13. Idempotency

Reuse Core idempotency.

Same key + same payload:

```text
return original transaction
```

Same key + different payload:

```text
409 conflict
```

Do not create duplicate receipts/payments/allocations.

## 14. Accounting boundary

Payment/Receipt Engine creates business commands.

Accounting Engine posts:

```text
Receipt:
Cash/Bank Dr
    Customer Receivable Cr

Payment:
Supplier Payable Dr
    Cash/Bank Cr
```

Do not insert raw journal lines from route handlers.

## 15. AR/AP boundary

Settlement is updated through allocation services, not direct balance mutation.

## 16. Cheques

Support optional:

```text
cheque_number
cheque_date
bank_name
```

and statuses such as:

```text
RECEIVED
DEPOSITED
CLEARED
BOUNCED
CANCELLED
```

Do not mark a cheque cleared before the business workflow says it is cleared.

## 17. Reversal

Posted receipts/payments must not be deleted.

Use reversal:

```text
POSTED → REVERSED
```

with allocation reversal and audit history.

## 18. Numbering

Use server-side transactional series:

```text
REC/2026-27/000001
PAY/2026-27/000001
```

## 19. Tests

```text
[ ] full receipt
[ ] partial receipt
[ ] multiple receipts to one invoice
[ ] one receipt to multiple invoices
[ ] unallocated receipt
[ ] customer advance
[ ] overpayment
[ ] full payment
[ ] partial payment
[ ] multiple payments to one bill
[ ] one payment to multiple bills
[ ] supplier advance
[ ] allocation over outstanding rejected
[ ] cross-party allocation rejected
[ ] cross-business allocation rejected
[ ] reversal restores outstanding
[ ] duplicate allocation rejected
[ ] journal balances
[ ] locked period rejected
[ ] idempotent retry
[ ] concurrent allocations cannot over-settle
```

## 20. Definition of done

```text
[ ] Settlement no longer depends on invoice paid_amount
[ ] Receipt voucher
[ ] Payment voucher
[ ] Allocation service
[ ] AR/AP settlement integration
[ ] Advances
[ ] Overpayment
[ ] Reversal
[ ] Cash/bank mapping
[ ] Branch context
[ ] Period validation
[ ] Idempotency
[ ] Audit
[ ] Tests
```

## Final rule

> Invoices and bills create receivables/payables; receipts and payments move money; allocations settle receivables/payables; accounting records the cash/bank and AR/AP effects; payment events do not independently change GST.
