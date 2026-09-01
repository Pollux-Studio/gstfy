# FIX-NEEDED-RETURNS.md

## Final Hardening Before ITC / GST Reconciliation

The Returns, Credit Note and Debit Note engine now has AR/AP adjustment effects, effective outstanding, source-line locking, Tax/Inventory/Accounting integration, Payment/Receipt integration, reversal, and audit.

## Resolution Status After Hardening Pass

Completed in this pass:

```text
[x] optional real PostgreSQL concurrent return test added
[x] optional real PostgreSQL concurrent credit-note adjustment test added
[x] AR/AP adjustment effect posting now locks the target receivable/payable entry
[x] debit-note financial direction helper added
[x] debit-note direction tests added for customer and supplier cases
[x] wrong debit-note issuer/direction is rejected by domain validation
[x] issuer_type / document_direction / source_party_role context is normalized on create/update
[x] database guard migration added for issuer/direction/source-party-role values
[x] adjustment creation UI now sends explicit issuer context
[x] settlement detail UI now shows Original, Adjustment, AR/AP Reduced, Previously Settled, Excess Credit, Effective Balance, and Refund/Settlement status
```

Verification run locally:

```text
pnpm --filter @gstfy/backend check-types
pnpm --filter @gstfy/backend test
pnpm --filter web typecheck
```

Local backend tests:

```text
39 tests
36 passed
3 skipped
0 failed
```

Skipped tests are real PostgreSQL concurrency tests and require:

```bash
RUN_POSTGRES_CONCURRENCY_TEST=true
DATABASE_URL=postgresql://...
pnpm --filter @gstfy/backend test
```

Remaining items that still need future implementation:

```text
[ ] deep batch/serial identity UX for tracked return lines
[ ] source-document quick actions from invoice/bill pages
[ ] extended adjustment exports beyond current CSV
[ ] browser E2E for create/post/reverse flows
```

Complete these before freezing the engine:

### 1. Real PostgreSQL concurrency
Run the skipped real-Postgres tests.

```text
Original Qty = 10
User A returns 7
User B returns 5
```

Final returned quantity must never exceed 10.

Also test concurrent value adjustments against the remaining adjustable amount.

### 2. Debit Note semantics
Explicitly test both directions:

```text
GSTfy -> Customer
Supplier -> GSTfy
```

Validate AR/AP, Tax, and Accounting direction from issuer/recipient/source context. Never infer direction from `DEBIT_NOTE` alone.

### 3. External issuer identity
Persist enough context to distinguish:

```text
GSTFY_ISSUED
CUSTOMER_ISSUED
SUPPLIER_ISSUED
```

### 4. Batch / serial returns
Batch-tracked and serial-tracked products must return against the actual batch/serial identity. A serialized item cannot be returned twice.

### 5. Settlement UI
Adjustment detail must show:

```text
Original Amount
Adjustment Amount
AR/AP Reduced
Previously Settled
Excess Credit
Effective Balance
```

### 6. Reversal
Verify reversal restores:

```text
Tax
Inventory
Accounting
AR/AP
```

without duplicate effects.

### 7. Idempotency
Verify for create/post/reverse:

```text
same key + same payload -> original result
same key + changed payload -> 409
```

### 8. Historical snapshots
Verify posted adjustments preserve Party, GST registration, Product, HSN/SAC, UQC, tax profile/rule version, warehouse, batch and serial snapshots.

### 9. Source immutability
Posted Sales/Purchase documents remain immutable. Corrections use new adjustments or reversals.

### 10. Effective settlement
Use:

```text
Sales:
original_amount
- active sales adjustment effects
- active receipt allocations
= outstanding

Purchase:
original_amount
- active purchase adjustment effects
- active payment allocations
= outstanding
```

Payment/Receipt allocation must validate against the effective amount, not only the original amount.

### 11. Accounting / Tax / Inventory
Verify:

```text
Sales Return -> Inventory IN
Purchase Return -> Inventory OUT
Value-only note -> no inventory movement
```

All tax calculation remains in Tax Engine; all journal creation remains in Accounting Engine.

## Definition of Done

```text
[ ] real Postgres concurrency tests pass
[ ] debit-note direction tests pass
[ ] issuer/direction model verified
[ ] batch/serial guard verified
[ ] settlement UI verified
[ ] reversal verified
[ ] idempotency verified
[ ] snapshots verified
[ ] source immutability verified
[ ] effective AR/AP formula verified
[ ] payment allocation uses effective amount
[ ] journals balance
```
