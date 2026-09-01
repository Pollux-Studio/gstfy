# FIX-NEEDED-ACCOUNTING.md — Core Cleanup Before Accounting Engine

## Purpose

GSTfy has now completed:

```text
Organization Foundation
Party Master
Core Voucher Engine
Core Hardening
Product Engine
```

Before implementing the Accounting Engine, complete the remaining foundation/data-integrity fixes.

This document is intentionally small. Do not redesign the already completed organization, party, product, or core architecture.

---

# 1. Fix Priority

```text
1. Verify / backfill ledger account IDs
2. Add core integration tests
3. Confirm raw posting endpoint remains internal-only
4. Confirm AR/AP allocation invariants
5. Confirm transaction snapshots
6. Confirm draft/posted immutability boundaries
7. Then implement Accounting Engine
```

---

# 2. Ledger Account Backfill

The Core hardening added:

```text
ledger_accounts
journal_entry_lines.account_id
```

while retaining:

```text
account_code
account_name
```

as display snapshots.

## Required

If the database already contains historical journal lines:

```text
old account_code/account_name
        |
resolve matching ledger account
        |
populate account_id
```

Do not proceed with production data while historical journal lines have null/invalid `account_id`.

## If no production data exists

For development-only data, reset/reseed the affected database or create a clean migration path.

Do not invent mappings for real accounting history.

---

# 3. Stable Ledger Account Identity

After migration:

```text
journal_entry_lines.account_id
```

must be authoritative.

`account_code_snapshot` and `account_name_snapshot` are display/history values only.

Do not allow future code to identify an account solely by mutable text.

---

# 4. Core Integration Tests

Add tests before Accounting Engine implementation.

## Posting Security

```text
[ ] Missing internal posting key rejected
[ ] Invalid internal posting key rejected
[ ] Normal frontend user cannot call raw core posting endpoint
```

## Accounting

```text
[ ] Invalid account_id rejected
[ ] Account from another business rejected
[ ] Journal must balance
[ ] Debit-only line valid
[ ] Credit-only line valid
[ ] Line with both debit and credit rejected
[ ] Negative monetary values rejected
```

## AR/AP

```text
[ ] New AR/AP entry starts open
[ ] Settled amount starts at zero
[ ] Outstanding starts at original amount
[ ] Allocation requires correct AR/AP entry
[ ] Allocation cannot exceed outstanding
[ ] Cross-business allocation rejected
[ ] Settlement status recomputed
[ ] Full settlement => settled
[ ] Partial settlement => partially_settled
```

## Idempotency

```text
[ ] Same key + same request returns original result
[ ] Same key + different request returns 409
[ ] Retry after successful commit does not duplicate voucher
[ ] In-progress duplicate request is rejected
```

## Numbering

```text
[ ] Concurrent posting cannot duplicate voucher numbers
[ ] Correct invoice series selected
[ ] Branch-specific series overrides global series where configured
[ ] Financial-year separation works
```

## Period

```text
[ ] Locked period rejects posting
[ ] Open period accepts posting
```

## Snapshot

```text
[ ] Party snapshot is persisted
[ ] Product/item snapshot is persisted
[ ] Seller snapshot is persisted
[ ] Tax snapshot is persisted
[ ] Historical snapshots don't depend on current masters
```

---

# 5. Raw Core Posting Boundary

The current raw endpoint:

```text
POST /api/v1/core/vouchers/post
```

must remain an internal primitive.

Future frontend modules must NOT call it directly.

Future pattern:

```text
POST /sales
     |
SalesService
     |
Accounting/Tax/Inventory
     |
CorePostingService
```

The internal posting key is only a temporary/protective boundary.

Long-term, prefer service-to-service invocation inside the backend without exposing the primitive to external clients.

---

# 6. AR/AP Settlement Rule

The source of settlement truth is:

```text
payment_allocations
```

Not:

```text
settled_amount
outstanding_amount
status
```

Those may be materialized values but must be recomputed.

Example:

```text
Invoice = 100,000

Allocation 1 = 40,000
Allocation 2 = 30,000

Settled = 70,000
Outstanding = 30,000
Status = partially_settled
```

---

# 7. Transaction Snapshot Rule

Any posted business document must preserve the values used at posting time.

Future transaction records must support snapshots for:

```text
Seller
Customer/Supplier
Party GST registration
Party address
Product
HSN/SAC
UQC
Taxability
GST rate
Cess rule
Price
Tax values
Branch
Warehouse where applicable
```

Changing a master later must not change historical accounting.

---

# 8. Posted Immutability

The Accounting Engine must treat:

```text
POSTED
```

as immutable.

Allowed correction mechanisms:

```text
Credit Note
Debit Note
Return
Journal Adjustment
Cancellation where permitted
```

Do not implement:

```text
PATCH posted journal line
PATCH posted invoice amount
DELETE posted voucher
```

as generic CRUD.

---

# 9. Draft Lifecycle Foundation

Before domain documents are implemented, keep this conceptual boundary:

```text
DRAFT
  ↓
VALIDATED
  ↓
POSTED
```

Draft:

```text
editable
not part of official books
```

Posted:

```text
official accounting fact
immutable
```

The exact specialized document implementation may be completed with Accounting/Sales.

---

# 10. Existing Core Behaviors That Must Not Regress

Keep:

```text
tenant safety
business ownership checks
GST registration ownership
branch scope
warehouse ownership
financial year ownership
idempotency
transactional numbering
period locking
audit logging
product/party snapshots
```

---

# 11. Product Engine Boundary

Do not add accounting logic into Product Engine.

Product Engine continues to provide:

```text
product
tax profile
UQC/unit
price
inventory defaults
supplier mappings
accounting defaults
```

It must not calculate:

```text
journal
AR/AP
live stock
CGST/SGST/IGST split
GST return
```

---

# 12. Definition of Done

This cleanup is complete when:

```text
[ ] All historical journal lines have valid account_id
[ ] Invalid account references are rejected
[ ] Core integration tests pass
[ ] Raw core posting is internal-only
[ ] AR/AP allocation invariant is enforced
[ ] Snapshot fields work
[ ] Posted records are protected from direct mutation
[ ] Idempotency tests pass
[ ] Numbering concurrency tests pass
[ ] Period locking tests pass
```

Then:

```text
ACCOUNTING-ENGINE.md
```

becomes the next implementation target.
