# Fix Summary

Implemented the hardening items from `docs/fix.md` for the core voucher engine.

## Backend Changes

- Added migration `0013_core_engine_hardening.sql`.
- Added `ledger_accounts` as the stable chart-of-accounts table.
- Added `journal_entry_lines.account_id` so journal postings reference a real ledger account instead of relying only on mutable account code/name text.
- Kept `account_code` and `account_name` on journal lines as immutable display snapshots.
- Added posting-time snapshot columns:
  - `vouchers.seller_snapshot`
  - `vouchers.branch_snapshot`
  - `vouchers.party_snapshot`
  - `vouchers.tax_snapshot`
  - `inventory_transactions.item_snapshot`
  - `receivable_payable_entries.party_snapshot`
- Added `CORE_POSTING_INTERNAL_KEY`.
- Protected `POST /core/vouchers/post` with `X-GSTFY-Internal-Posting-Key`.
- Updated voucher posting validation so every journal line must provide `accountId`.
- Changed receivable/payable settlement behavior:
  - `settled_amount`, `outstanding_amount`, and `status` are no longer trusted from the posting payload.
  - new AR/AP rows start as `open`, `settled_amount = 0`, and `outstanding_amount = original_amount`.
  - payment allocations must target a specific receivable/payable entry.
  - over-allocation is rejected.
  - AR/AP settlement status is recomputed from allocation rows after posting.

## Frontend Changes

- Removed the direct web helper for `POST /core/vouchers/post`.
- Frontend modules can still read vouchers through:
  - `getVouchers`
  - `getVoucher`
- Sales, Purchase, Payment, and Stock modules should call future domain-specific backend endpoints instead of posting raw voucher effects.

## Security Result

The raw voucher posting endpoint is no longer a normal business-user API surface. It is now an internal primitive for backend services/tests, which prevents frontend modules from bypassing invoice, GST, stock, numbering, and settlement business rules.

## Remaining Follow-up

- Build domain endpoints such as Sales Invoice, Purchase Invoice, Payment Receipt, and Stock Adjustment on top of the internal core posting primitive.
- Backfill `ledger_accounts` and `journal_entry_lines.account_id` for existing historical voucher data if production data already exists.
- Add integration tests for:
  - missing internal posting key
  - invalid ledger account
  - over-allocation rejection
  - settlement status recomputation
