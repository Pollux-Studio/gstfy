# FIX-NEEDED-ITC.md — Final Hardening Before GST Reporting

## Current ITC State

The ITC/Reconciliation Engine now provides:

```text
Purchase Tax Records
External GSTR-2B/2A/Manual Import
Auto/Manual Matching
Mismatch Classification
Exceptions
ITC Eligibility
Partial ITC
Deferred ITC
Claims
Claim Reversal
Idempotency
Frontend GST Workspace
CSV Export
```

The core architecture is complete. The remaining work is production hardening and compliance-depth work.

---

# 1. Real PostgreSQL Concurrency Test

The current implementation lists real PostgreSQL concurrency/load testing as future work.

Test simultaneous decisions against the same ITC record.

Example:

```text
Available eligible ITC = ₹10,000

User A -> eligible ₹7,000
User B -> eligible ₹6,000
```

Expected:

```text
final eligible amount <= ₹10,000
```

Also test concurrent:

```text
claim
defer
reject
reverse
```

on the same record.

Use database locking/transactional validation.

---

# 2. ITC State Machine

Enforce allowed transitions.

Example:

```text
NOT_REVIEWED
    ├──> ELIGIBLE
    ├──> PARTIALLY_ELIGIBLE
    ├──> DEFERRED
    └──> INELIGIBLE

DEFERRED
    └──> ELIGIBLE

ELIGIBLE
    └──> CLAIMED

PARTIALLY_ELIGIBLE
    └──> CLAIMED

CLAIMED
    └──> REVERSED
```

Reject invalid transitions such as:

```text
REVERSED -> CLAIMED
CLAIMED -> ELIGIBLE
REJECTED -> CLAIMED
```

unless a controlled reopening process exists.

---

# 3. Claim Amount Protection

Never allow:

```text
claimed_tax > remaining_claimable_tax
```

Validate independently:

```text
CGST
SGST
IGST
CESS
```

Example:

```text
Eligible IGST = ₹10,000
Already Claimed = ₹7,000
New Claim <= ₹3,000
```

---

# 4. Claim Reversal Protection

For a claimed amount:

```text
active_claimed
- previously_reversed
= reversible_amount
```

Never reverse more than the active claimed amount.

Every reversal must preserve:

```text
claim
reversal
reason
actor
timestamp
```

---

# 5. External Import Idempotency

Repeated import of the same logical dataset must not create duplicate GST records.

Protect using an appropriate combination of:

```text
business
GST registration
period
source
file/import identity
document identity
```

Re-import should be:

```text
same import -> idempotent
new source revision -> explicit new/superseding import
```

Never silently duplicate external records.

---

# 6. External Duplicate Handling

If the same supplier invoice appears multiple times:

```text
DUPLICATE
```

must be explicit.

Do not double-count tax because of:

```text
same file imported twice
same invoice in overlapping files
source revision
normalization differences
```

Preserve source history.

---

# 7. Matching Tolerances

Make reconciliation tolerance explicit and configurable:

```text
taxable_value_tolerance
cgst_tolerance
sgst_tolerance
igst_tolerance
cess_tolerance
```

Use Decimal arithmetic.

Never compare GST values using floating point.

---

# 8. Manual Match Validation

A manual match must validate:

```text
same business
compatible GST registration
compatible supplier GSTIN
compatible document/date context
record not already irreversibly matched
```

Record:

```text
manual_override = true
matched_by
matched_at
reason
```

Never overwrite source data.

---

# 9. Unmatch Protection

If ITC has already been:

```text
CLAIMED
```

do not allow a normal unmatch that silently changes its history.

Require a controlled workflow:

```text
claim reversal
reconciliation correction
audit
```

---

# 10. ITC Eligibility Audit

Every ITC state change must record:

```text
previous_status
new_status
previous amounts
new amounts
reason
actor
timestamp
```

This is required for CA review.

---

# 11. Period Lock

When the accounting/GST period is locked, block normal:

```text
import mutation where applicable
match
unmatch
resolve
eligibility change
claim
reverse
```

unless an explicit controlled reopen/revision workflow exists.

Use the existing period/CA authority.

---

# 12. GST Registration Isolation

Every record must remain tied to:

```text
business_id
gst_registration_id
tax_period
```

Do not reconcile:

```text
GSTIN A books
```

against:

```text
GSTIN B external data
```

---

# 13. Normalization Safety

Maintain:

```text
original_document_number
normalized_document_number
```

where needed.

Safe normalization can handle:

```text
leading/trailing whitespace
case
known formatting differences
```

Do not aggressively remove characters if that can turn two different invoice numbers into the same normalized key.

---

# 14. Purchase Adjustment Coverage

Verify ITC reflects posted:

```text
Purchase Returns
Supplier Credit Notes
Supplier Debit Notes
```

The ITC engine must consume their posted tax effects.

It must not recalculate their GST.

---

# 15. RCM Separation

RCM must have a separate lifecycle:

```text
RCM Tax Liability
      ↓
Tax Engine
      ↓
ITC Eligibility
```

Do not treat RCM as ordinary supplier-reported purchase reconciliation.

---

# 16. Frontend Decision Safety

Before an ITC action, show:

```text
Book Tax
External Tax
Difference
Current ITC Status
Eligible Amount
Already Claimed
Remaining Claimable
```

Then allow:

```text
Mark Eligible
Defer
Reject
Claim
Reverse
```

Only permitted actions should be available for the current state.

---

# 17. Browser E2E

Add browser tests for:

```text
GST workspace
CSV/JSON import
reconciliation list
manual match
exception resolution
mark eligible
claim ITC
reverse claim
```

Use controlled fixtures.

---

# 18. Production Definition of Done

```text
[ ] real PostgreSQL concurrency tests pass
[ ] ITC state-transition guard
[ ] claim amount guard
[ ] reversal amount guard
[ ] import idempotency
[ ] duplicate external handling
[ ] explicit matching tolerances
[ ] manual-match validation
[ ] unmatch protection
[ ] eligibility audit
[ ] period lock
[ ] GST registration isolation
[ ] normalization safety
[ ] adjustment coverage
[ ] RCM separation
[ ] frontend decision safety
[ ] browser E2E
```

After these checks, freeze the ITC/Reconciliation engine.

---

# Final Rule

> Reconciliation status, ITC eligibility, and ITC claim history are separate but connected states. Source GST records are never silently overwritten, and every manual decision is traceable.
