# Returns, Credit Note & Debit Note Engine Summary

## Existing System Before This Change

GSTfy already had the foundation for returns, credit notes, and debit notes before this pass.

The existing system already supported:

```text
Sales Return register
Purchase Return register
Credit Note register
Debit Note register
Draft adjustment document creation
Posting adjustment documents through Core Voucher posting
Adjustment numbering
Tax entries through voucher posting
Inventory entries for goods-related returns
Journal entries through the Accounting/Core engine
CSV export
Detail page
Draft deletion
Posted document reversal
Returnable quantity calculation
Basic over-return validation
Idempotency for posting
```

The existing adjustment flow was:

```text
Create draft adjustment
Select posted source invoice/bill
Enter return quantity or adjustment value
Save draft
Post through Core Voucher engine
Generate journal, GST, inventory, and AR/AP entries where configured
Reverse instead of deleting posted documents
```

The frontend already had:

```text
Separate pages for sales returns, purchase returns, credit notes, and debit notes
Adjustment creation dialog
Source document picker
Returnable line grid
List/search/filter/export
Detail page
Post, delete draft, and reverse actions
```

The backend already had:

```text
adjustment_documents
adjustment_document_lines
source document reference
party/source snapshots
line-level tax snapshots
line-level inventory effects
voucher posting integration
audit logs
returnable source APIs
```

## Gaps In The Existing System

The existing system posted adjustment documents, but the AR/AP effect was not strong enough.

Main gaps:

```text
Returns and credit notes did not clearly reduce the original receivable/payable entry.
Receivable/payable outstanding was still mostly based on payment allocations.
There was no dedicated AR/AP adjustment-effect table.
The original AR/AP amount, adjusted amount, effective amount, and excess settled amount were not separated.
If an invoice was already paid and later credited, excess settlement was not clearly represented.
Adjustment reversal did not reverse a separate AR/AP adjustment-effect record.
Return posting needed stronger row locking at the source-line level.
The frontend did not clearly show AR/AP reduction versus excess credit.
```

This meant the engine was functional for posting adjustment documents, but not fully reliable as a settlement layer for Payment/Receipt, receivables, payables, and future reports.

## What Changed In This Pass

This pass strengthened the adjustment engine so sales returns, purchase returns, and credit notes now affect receivables/payables correctly without editing the original posted document.

The core rule implemented is:

```text
Original invoice or bill remains immutable
Adjustment document is posted separately
AR/AP outstanding is reduced through adjustment effects
Actual money movement remains in Payment/Receipt
```

## Before vs After

| Area | Before | After |
|---|---|---|
| Original invoice/bill | Already immutable | Still immutable |
| Adjustment document | Posted separately | Still posted separately |
| AR/AP reduction | Not explicitly modeled as a separate effect | Modeled through `receivable_payable_adjustment_effects` |
| Outstanding formula | Primarily original amount minus payment allocations | Original amount minus adjustment effects minus payment allocations |
| Paid invoice later credited | Excess was not clearly tracked | `excess_settled_amount` and `excess_credit_amount` track it |
| Reversal | Reversed adjustment voucher/status | Also reverses AR/AP adjustment effects and refreshes settlement |
| Concurrency | Basic over-return validation | Source lines are locked and revalidated before posting |
| UI visibility | Total/status focused | Shows AR/AP reduced and excess credit |
| Debit note semantics | Mostly source-type driven | Explicit issuer/direction/source-party-role validation and tests |

## Backend Changes

### New AR/AP Adjustment Effect Layer

Added migration:

```text
apps/backend/drizzle/0045_adjustment_settlement_effects.sql
```

It adds:

```text
receivable_payable_entries.adjustment_amount
receivable_payable_entries.effective_amount
receivable_payable_entries.excess_settled_amount

adjustment_documents.settlement_effect_amount
adjustment_documents.excess_credit_amount

receivable_payable_adjustment_effects
```

The new `receivable_payable_adjustment_effects` table records the relationship between:

```text
Adjustment document
Original source voucher
Target receivable/payable entry
Reduction amount
Effect status
```

This keeps the original AR/AP entry intact while allowing outstanding values to be derived safely.

Added migration:

```text
apps/backend/drizzle/0046_adjustment_issuer_direction_guards.sql
```

It backfills and guards:

```text
issuer_type
document_direction
source_party_role
```

This prevents debit notes from being silently stored with the wrong economic direction.

### Settlement Formula

Receivable/payable settlement now uses:

```text
original_amount
- active adjustment effects
= effective_amount

effective_amount
- active payment/receipt allocations
= outstanding_amount
```

If allocations are already higher than the new effective amount after a credit/return, the system records:

```text
excess_settled_amount
```

This is important when a customer has already paid and a later credit note or return reduces the receivable.

### Posting Flow

`postVoucher` now supports transactional hooks:

```text
beforePost
afterPost
```

The adjustment engine uses them to:

```text
beforePost:
  lock and revalidate source lines before posting

afterPost:
  create AR/AP adjustment effects
  refresh receivable/payable settlement
  mark adjustment as posted
  store settlement/excess amounts
  write audit event
```

This keeps voucher posting atomic and avoids partial adjustment state.

### Return Concurrency Protection

Sales returns and purchase returns now lock the source invoice/bill lines before final validation:

```text
select source lines for update
recalculate previously returned quantity
reject if current return exceeds remaining quantity
```

This prevents two users from posting returns at the same time and over-returning the original line quantity.

Credit-note and return AR/AP settlement now also locks the target receivable/payable entry before calculating remaining adjustable amount:

```text
select receivable/payable entry for update
sum active adjustment effects
apply only remaining adjustable amount
track excess separately
```

This prevents two concurrent credit notes from reducing more than the original receivable/payable amount.

### Adjustment Type Behavior

Current AR/AP handling:

```text
SALES_RETURN     -> reduces source receivable
PURCHASE_RETURN  -> reduces source payable
CREDIT_NOTE      -> reduces source receivable/payable based on source document
DEBIT_NOTE       -> creates its own AR/AP entry through voucher posting
```

If a return or credit note has no matching original AR/AP entry, the unapplied amount is tracked as:

```text
excess_credit_amount
```

Debit note direction is now resolved explicitly:

```text
GSTfy -> Customer debit note
  source: sales invoice
  issuer: GSTFY_BUSINESS
  direction: outgoing
  AR/AP: receivable increase
  tax: output tax credit side

Supplier -> GSTfy debit note
  source: purchase bill
  issuer: SUPPLIER
  direction: incoming
  AR/AP: payable increase
  tax: input tax debit side
```

The current UI creates purchase-source debit notes as supplier-issued incoming documents.

### Reversal Flow

Posted adjustment reversal now:

```text
creates the existing reversal voucher
marks active AR/AP adjustment effects as reversed
refreshes affected receivable/payable entries
marks the adjustment document as reversed
marks the original adjustment voucher as reversed
writes audit event
```

Posted adjustments remain immutable. Reversal is the only allowed correction path.

## Schema Updates

Updated Drizzle schema for:

```text
receivablePayableEntries
adjustmentDocuments
receivablePayableAdjustmentEffects
```

New type export:

```text
ReceivablePayableAdjustmentEffectRecord
```

## Payment/Receipt Integration

Payment and receipt settlement refresh now includes active adjustment effects.

This means receivables/payables shown in Payment/Receipt screens reflect:

```text
payments/receipts
returns
credit notes
reversals
```

The payment allocation database guard was also updated to validate against `effective_amount`, not only the original document amount.

## Frontend Changes

### Adjustment Register

The sales return, purchase return, credit note, and debit note register now shows:

```text
Total adjusted
AR/AP reduced
Excess credit
Draft count
```

The table includes a `Settlement` column showing:

```text
settlement effect amount
excess credit amount when present
```

### Adjustment Detail Page

The detail page was reworked into tabs:

```text
Lines
Settlement
Accounting
Audit
```

The detail sidebar now shows:

```text
settlement reduced amount
excess credit amount
source document
status
posting/reversal metadata
```

This makes it clear whether an adjustment reduced AR/AP or became an excess credit.

The Settlement tab now shows a business-readable snapshot:

```text
Original document
Adjustment
AR/AP reduced
Previously settled
Excess credit
Effective balance
Refund / settlement
```

Refund/payment is intentionally shown as separate from the adjustment document.

### API Types

Updated frontend adjustment API types to include:

```text
settlementEffectAmount
excessCreditAmount
settlementEffects
```

## Tests Added

Added payment/receipt domain tests for adjusted settlement:

```text
adjusted settlement reduces effective receivable before outstanding
adjusted settlement exposes excess paid amount after credit note
```

Added adjustment domain tests for debit-note semantics:

```text
customer debit note increases receivable and output tax
supplier debit note increases payable and input tax
wrong issuer/direction is rejected
```

Added optional real PostgreSQL concurrency tests:

```text
source-line lock prevents concurrent sales over-return
AR/AP entry lock caps concurrent credit-note adjustment effects
```

These run only when:

```bash
RUN_POSTGRES_CONCURRENCY_TEST=true
DATABASE_URL=postgresql://...
```

Existing tests also continue to cover:

```text
returnable quantity calculation
over-return validation
idempotency hash behavior
payment allocation limits
tax engine calculations
inventory normalization
posting guard validation
```

## Verification Completed

Commands run successfully:

```bash
pnpm --filter @gstfy/backend check-types
pnpm --filter @gstfy/backend test
pnpm --filter web typecheck
git diff --check
```

Result:

```text
Backend typecheck passed
Backend tests passed
Web typecheck passed
Diff whitespace check passed
```

Backend test result:

```text
39 tests
36 passed
3 skipped real Postgres concurrency tests
0 failed
```

## Current Status

```text
Adjustment document posting        Done
Return quantity revalidation       Done
Source-line row locking            Done
AR/AP entry row locking            Done
AR/AP adjustment effects           Done
Effective outstanding calculation  Done
Excess credit tracking             Done
Debit-note direction validation    Done
Issuer/direction DB guards         Done
Adjustment reversal effects        Done
Payment/Receipt integration        Done
Adjustment register UI             Done
Adjustment detail UI               Done
Typechecks/tests                   Passed
```

## Remaining Future Hardening

These are not blockers for the current implementation, but should be addressed before production freeze:

```text
Run real Postgres concurrent return posting test in CI/staging
Run real Postgres concurrent credit-note adjustment test in CI/staging
Browser E2E for create/post/reverse adjustment flows
Deeper batch/serial return identity UI
Source-document page quick actions
Adjustment report exports beyond CSV
```

## Final Implementation Rule

The engine now follows the intended architecture:

```text
Original transaction
    -> immutable

Return / Credit / Debit document
    -> independent posted voucher
    -> tax/inventory/accounting effects
    -> AR/AP adjustment effect where applicable

Payment / Receipt
    -> only for actual money movement
```
