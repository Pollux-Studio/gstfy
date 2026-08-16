# FIX-CORE-HARDENING.md — GSTfy Core Corrections

## Purpose
The organization foundation, Party Master and initial Core Voucher Engine are implemented. Before Product, Tax, Inventory, Sales and Purchase, harden these points without redesigning the existing organization/party model.

## 1. Raw effect posting must become internal
The current core posting endpoint accepts journal lines, inventory entries, GST entries, AR/AP entries and allocations. Keep this as a low-level engine/test primitive, but do not let frontend business modules call it directly.

Final boundary:
```text
HTTP Business API
  -> Domain Service
  -> Tax/Inventory/Accounting/AR Engines
  -> Core Posting Service
  -> Database
```

Sales should accept business facts such as customer, items, quantity, rate, branch and warehouse. The backend must derive journal/GST/stock/receivable effects.

## 2. Use stable account identity
Current journal lines use `account_code`/`account_name`. Add a real `ledger_accounts` table and use:
```text
journal_entry_lines.account_id
```
as the authoritative account identity. Account name/code may be snapshots for display, not the accounting key.

## 3. AR/AP settlement must be allocation-derived
`payment_allocations` is the settlement source of truth. Do not independently trust/edit `settled_amount`, `outstanding_amount` or `status`.

```text
Original Amount - SUM(valid allocations) = Outstanding
```

Reject allocations above outstanding unless an explicit advance/overpayment workflow supports them.

## 4. Historical transaction snapshots
Before Sales/Purchase, transaction documents/lines must be able to snapshot:
```text
Party name, legal name, GSTIN, state, address
Product name, description, SKU, HSN/SAC, UQC, taxability, GST rate, cess rule
Seller legal identity/GSTIN/address
Branch/location
Tax amounts/place of supply
```
Old invoices must never change when masters change.

## 5. Formalize lifecycle
Use:
```text
DRAFT -> VALIDATED -> POSTED
POSTED -> CANCELLED (only through valid workflow)
```
Drafts are editable. Posted records are immutable. Corrections use credit/debit notes, returns, cancellation or approved adjustments.

## 6. Keep transactional numbering
Invoice/voucher numbers stay backend allocated from `invoice_series`, inside the same DB transaction as posting. Never trust frontend sequences.

## 7. Keep idempotency
Same idempotency key + same payload returns the original result. Same key + different payload returns conflict. Number allocation and idempotency must remain atomic with posting.

## 8. Keep period locks
`LOCKED` must reject normal posting. Full CA period workflow can come later.

## 9. Keep current security
Do not regress:
- tenant/business isolation
- GST registration ownership
- branch scope
- warehouse ownership
- financial-year ownership
- CA-business access
- audit logs

## 10. Tests before Product Engine
```text
[ ] Unauthorized raw effect posting blocked
[ ] account_id required and valid
[ ] journals balance
[ ] allocation cannot exceed outstanding
[ ] AR/AP recomputes from allocations
[ ] draft editable
[ ] posted immutable
[ ] cancellation protected
[ ] snapshot data survives master changes
[ ] idempotency retry cannot duplicate
[ ] concurrent numbering cannot duplicate
[ ] locked period rejects posting
[ ] cross-business references rejected
```

## Definition of done
```text
[ ] Domain services generate effects
[ ] Ledger accounts have stable IDs
[ ] AR/AP is allocation-derived
[ ] Snapshot strategy is in place
[ ] Draft/post lifecycle is explicit
[ ] Posted data is immutable
[ ] Numbering/idempotency remain transactional
[ ] Period lock remains enforced
[ ] Audit remains intact
```

## Do not change
Do not redesign the completed organization foundation, branch/warehouse model, CA relationship, authentication, tenant routing or Party Master.

## Next
```text
PRODUCT-ENGINE.md
 -> ACCOUNTING-ENGINE.md
 -> TAX-ENGINE.md
 -> INVENTORY-ENGINE.md
 -> SALES / PURCHASE
```
