# ITC and GST Reconciliation Engine Summary

## Existing foundation reused

GSTfy already had the transaction foundation required for reconciliation:

- Posted purchase bills create purchase-side GST and accounting data.
- Posted purchase-source adjustments from returns/credit/debit note flows can emit GST impact.
- Core voucher posting already stores GST entries with tax split, source document, party, branch, period, and ITC eligibility context.
- Party, purchase, accounting, tax, payment/receipt, inventory, and adjustment engines already enforce tenant-aware access and immutable posted transaction behavior.

This implementation does not replace those engines. It adds a reconciliation layer on top of posted purchase-side tax records and imported external GST records.

## Database changes

Migration `0047_itc_gst_reconciliation_engine.sql` adds the production tables for ITC and GST reconciliation:

- `purchase_tax_records`: normalized purchase-side GST records derived from posted purchase bills and purchase adjustments.
- `external_gst_imports`: import batches for normalized GSTR-2B/GSTR-2A/manual records.
- `external_gst_records`: supplier-filed GST rows imported from external statements.
- `gst_reconciliation_matches`: book-to-external matching records with confidence, mismatch amounts, and manual override support.
- `gst_reconciliation_exceptions`: mismatch, duplicate, books-only, external-only, and review exceptions.
- `itc_claims`: immutable ITC claim/reversal snapshots by claim period.
- `itc_status_events`: audit trail for ITC status changes.
- `gst_reconciliation_idempotency_keys`: mutation idempotency protection for imports, matches, decisions, claims, and reversals.

The schema also adds a business-scoped unique constraint for purchase bills so reconciliation records can safely reference source bills within the same tenant.

## Backend API

New backend routes are registered under `/api/v1`:

- `GET /gst-reconciliation`: list book-side purchase GST records with match, external record, exception, summary, filters, sorting, and pagination.
- `GET /gst-reconciliation/export`: CSV export for reconciliation review.
- `POST /gst-reconciliation/import`: import normalized GSTR-2B/GSTR-2A/manual records and run auto-match.
- `GET /gst-reconciliation/imports`: list import batches.
- `GET /gst-reconciliation/imports/:id`: inspect one import batch and its records.
- `GET /gst-reconciliation/exceptions`: list reconciliation exceptions.
- `GET /gst-reconciliation/:id`: detail view for one book-side purchase GST record.
- `POST /gst-reconciliation/:id/match`: manually match a book record to an external record.
- `POST /gst-reconciliation/:id/unmatch`: undo an active match and restore review status.
- `POST /gst-reconciliation/:id/resolve`: resolve, ignore, or move an exception into review.
- `GET /itc`: list ITC records with claimability status.
- `GET /itc/export`: CSV export for ITC review.
- `GET /itc/:id`: detail view with ITC events and claims.
- `POST /itc/:id/mark-eligible`: mark full or partial ITC eligible.
- `POST /itc/:id/defer`: defer ITC to a later period.
- `POST /itc/:id/reject`: reject ITC as not claimable.
- `POST /itc/:id/claim`: create immutable claim snapshot.
- `POST /itc/:id/reverse`: reverse a claimed ITC snapshot.

## Matching behavior

The auto-match flow uses:

- Supplier GSTIN.
- Normalized invoice/document number.
- Invoice/document date.
- Taxable value and tax split tolerance.

The engine classifies rows as:

- `MATCHED`
- `DATE_MISMATCH`
- `VALUE_MISMATCH`
- `TAX_MISMATCH`
- `BOOKS_ONLY`
- `EXTERNAL_ONLY`
- `DUPLICATE`
- `MANUAL_REVIEW`

External-only rows are kept as separate imported GST records so the business can identify supplier-filed documents missing from books.

## ITC workflow

ITC is controlled separately from reconciliation:

- `NOT_REVIEWED`: default state after sync/import.
- `ELIGIBLE`: full eligible tax can be claimed.
- `PARTIALLY_ELIGIBLE`: only a reviewed portion is claimable.
- `DEFERRED`: claim later, usually due to timing or pending supplier filing.
- `INELIGIBLE`: blocked under business/GST rules.
- `CLAIMED`: immutable claim snapshot exists.
- `REVERSED`: previous claim was reversed.
- `REJECTED`: explicitly rejected from claim workflow.

Claim and reversal actions are audit-backed and idempotent. The engine does not auto-claim ITC just because a GSTR-2B row matches; the user still performs the review action.

## Frontend changes

A new GST workspace is available at:

```text
/gst
```

The sidebar Compliance section now opens this workspace.

The page includes:

- Compact GST reconciliation header.
- Month selector.
- Summary metrics for books ITC, external ITC, matched rows, mismatches, and claimed rows.
- Reconciliation table with search, match status, ITC status, export, sticky header, and compact rows.
- ITC table using the same operational layout.
- Exceptions tab for open mismatch/review issues.
- Imports tab for GSTR-2B/GSTR-2A/manual import batches.
- Import dialog for normalized CSV or JSON rows.
- Action dialog for ITC decisions, claims, reversals, unmatch, and exception resolution.

## Import format

The first implementation supports normalized CSV/JSON import instead of a raw government portal parser.

Required normalized fields:

```text
supplierGstin
documentNumber
documentDate
taxableValue
cgst
sgst
igst
cess
```

Optional fields:

```text
supplierName
```

Raw GST portal Excel/JSON parsing can be added later without changing the reconciliation model.

## Tests added

Domain tests cover:

- GSTIN/document normalization.
- Exact match detection.
- Value mismatch detection.
- Tax mismatch detection.
- No-match behavior.
- Partial ITC amount clamping.
- Idempotency request hashing.
- Component-specific matching tolerances.
- ITC state-machine transition guards.

Optional real PostgreSQL tests were added behind:

```text
RUN_POSTGRES_CONCURRENCY_TEST=true
```

They cover:

- Concurrent ITC eligibility decisions against one purchase tax record.
- Concurrent ITC claim/defer decisions against one purchase tax record.

Browser E2E coverage was added for:

- GST workspace load.
- Reconciliation/ITC/Exceptions/Imports tab navigation.
- Normalized GSTR-2B import dialog.

Run it with:

```bash
pnpm --filter web e2e:gst
```

## Hardening update

The `fix-needed-ITC.md` review items were addressed with a focused hardening pass:

- Added migration `0048_itc_reconciliation_hardening.sql`.
- Added normalized document keys while preserving original invoice/document numbers.
- Added GST registration linkage to external imports and external GST records.
- Auto-import now resolves an active business GST registration when the UI does not pass one.
- Matching now includes GST registration isolation.
- RCM records are excluded from supplier GSTR-2B reconciliation and blocked from the normal ITC decision flow.
- Matching tolerances are explicit per component: taxable value, CGST, SGST, IGST, CESS, and date tolerance.
- Manual match now validates same business, same GST registration, available external record, supplier GSTIN, and compatible document number.
- Unmatch is blocked after ITC is claimed; claim reversal must happen first.
- ITC state transitions are enforced through a state machine.
- ITC status updates use conditional persistence so concurrent stale decisions fail instead of silently overwriting.
- ITC claim creation validates remaining component-level claimable tax before claiming.
- ITC claim/reversal records preserve actor, reason, timestamps, and source snapshots.
- ITC status events now store previous amounts and new amounts for CA/audit review.
- Period-lock checks now include both business-level locks and GST-registration-specific locks.
- External duplicate records are preserved, marked ignored for totals, and surfaced as duplicate exceptions.
- Frontend ITC actions are shown only when permitted by the current state.
- Frontend confirmation dialog now shows book tax, external tax, difference, current ITC status, eligible amount, already claimed amount, and remaining claimable amount.

## Current limitations

These are intentionally left out of this pass:

- Raw GST portal file parser for official GSTR-2B Excel/JSON formats.
- Direct GSTN API integration.
- Government-verified GSTIN status inside this engine.
- GSTR-1/GSTR-3B statutory return generation.
- Running real PostgreSQL concurrency/load tests in CI requires a disposable `DATABASE_URL`.

## Final state

The engine now provides the core workflow required before filing review:

```text
Posted purchases
    ↓
Purchase tax records
    ↓
GSTR-2B / external import
    ↓
Auto/manual reconciliation
    ↓
Exception review
    ↓
ITC eligible/deferred/rejected decision
    ↓
Claim / reverse claim snapshot
```

This makes GSTfy ready to build the next GST compliance layer on top: GSTR summaries, filing review, and AI compliance checks.
