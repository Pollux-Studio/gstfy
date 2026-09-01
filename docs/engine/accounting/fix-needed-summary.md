# Accounting Engine Fix-Need Summary

## Scope

Implemented the cleanup items from `docs/engine/accounting/fix-needed.md` and added the first usable Accounting Engine surface.

The work intentionally did not redesign Organization, Party Master, Product Engine, or Core Voucher Engine.

---

## Backend Changes

### Ledger account identity hardening

Added migration:

```text
apps/backend/drizzle/0015_accounting_engine_foundation.sql
```

It now:

- Adds chart-of-account metadata to `ledger_accounts`:
  - `account_group`
  - `is_system`
  - `allow_posting`
  - `description`
- Normalizes existing `account_type`, `normal_balance`, and `account_group` values to uppercase.
- Backfills `journal_entry_lines.account_id` from exact same-business `ledger_accounts.account_code` matches.
- Fails the migration if any historical journal line still has no valid `account_id`.
- Makes `journal_entry_lines.account_id` `NOT NULL`.
- Adds constraints for:
  - valid account types
  - valid normal balance values
  - valid ledger account status
  - single-sided non-negative journal lines

This makes `account_id` the authoritative ledger identity. `account_code` and `account_name` remain historical display snapshots.

### Posted immutability guards

The same migration adds database triggers to protect posted accounting facts:

- `journal_entries` cannot be updated or deleted.
- `journal_entry_lines` cannot be updated or deleted.
- Posted vouchers cannot be deleted.
- Posted voucher accounting identity and snapshots cannot be changed directly.

Allowed future correction paths remain:

- cancellation where legally permitted
- credit note
- debit note
- return
- journal adjustment

### Core validation extraction

Added:

```text
apps/backend/src/modules/core/core.validation.ts
apps/backend/src/modules/core/core.validation.test.ts
```

Core posting validation is now testable outside the Fastify route:

- internal posting key check
- balanced debit/credit validation
- single-sided journal line validation
- negative amount rejection
- money normalization helpers

`core.routes.ts` now imports those helpers instead of keeping them as private route-only functions.

### Accounting Engine API

Added:

```text
apps/backend/src/modules/accounting/accounting.schemas.ts
apps/backend/src/modules/accounting/accounting.routes.ts
```

Registered under:

```text
/api/v1/accounting
```

New endpoints:

```text
GET    /accounting/accounts
POST   /accounting/accounts/seed
POST   /accounting/accounts
GET    /accounting/accounts/:id
PATCH  /accounting/accounts/:id
DELETE /accounting/accounts/:id
GET    /accounting/accounts/:id/ledger

GET    /accounting/reports/trial-balance
GET    /accounting/reports/profit-loss
GET    /accounting/reports/balance-sheet
GET    /accounting/reports/day-book
```

### Chart of accounts behavior

The API supports:

- default account seeding
- account creation
- safe account metadata update
- account deactivation instead of hard delete
- parent hierarchy cycle prevention
- system account protection
- unique account code per business

Account identity fields such as account code/type are not exposed for generic mutation after creation.

### Report behavior

Reports derive only from posted journal data:

- trial balance
- account ledger with running balance
- profit and loss
- balance sheet
- day book

No report total is manually editable.

### Permissions

Added a dedicated feature flag:

```text
accounting
```

Accounting access is permission-scoped through business member permissions using the `accounting` module.

Owners/admins bypass permission checks as before.

---

## Frontend Changes

### API client

Added:

```text
apps/web/lib/accounting/api.ts
```

It wraps the new accounting endpoints and keeps response/payload types local to the accounting module.

### Accounting page

Added:

```text
apps/web/app/(dashboard)/accounting/page.tsx
apps/web/components/accounting/accounting-page.tsx
```

The page includes:

- chart of accounts table
- default chart seeding
- add ledger account sheet
- account deactivation action
- account ledger drill-down
- trial balance tab
- profit and loss tab
- balance sheet tab
- day book tab

The UI is read-focused for posted accounting facts. Users can manage ledger metadata, but cannot edit posted journal lines or voucher snapshots.

### Sidebar

Updated:

```text
apps/web/lib/dashboard/modules.ts
apps/web/components/app-sidebar.tsx
packages/core/src/lib/featureFlags.ts
```

Accounting now appears under the Business section as a real module, not as a duplicate Reports item.

---

## Core Fix-Need Checklist

| Requirement | Status |
|---|---|
| Backfill ledger account IDs | Done via migration with exact account-code matching |
| Make `account_id` authoritative | Done with `NOT NULL`, FK, API behavior, and report queries |
| Reject invalid account references | Already enforced in core posting; reinforced by DB FK |
| Raw posting internal-only | Preserved and covered by tests |
| AR/AP allocation invariant | Existing allocation-derived settlement retained |
| Transaction snapshots | Existing seller/branch/party/tax/product snapshots retained |
| Posted immutability | Added DB-level triggers |
| Draft/posted boundary | Preserved; no generic posted edit/delete APIs added |
| Product Engine boundary | Preserved; no accounting logic added to Product Engine |
| Accounting Engine first surface | Added chart, ledger, trial balance, P&L, balance sheet, day book |

---

## Verification

Passed:

```text
pnpm --filter @gstfy/backend check-types
pnpm --filter @gstfy/backend test
pnpm --filter web typecheck
pnpm --filter @gstfy/backend exec eslint src/modules/accounting/accounting.routes.ts src/modules/accounting/accounting.schemas.ts src/modules/core/core.validation.ts src/modules/core/core.validation.test.ts src/modules/core/core.routes.ts src/app.ts --max-warnings 0
pnpm --filter web exec eslint components/accounting/accounting-page.tsx app/'(dashboard)'/accounting/page.tsx lib/accounting/api.ts components/app-sidebar.tsx lib/dashboard/modules.ts --max-warnings 0
```

Full backend lint is still blocked by an existing unrelated warning:

```text
apps/backend/src/modules/organization/organization.routes.ts
```

Full web lint is still blocked by existing unrelated React Compiler issues in auth, CA, and settings components.

---

## Production Notes

Before applying this migration to real production data:

1. Confirm every historical `journal_entry_lines.account_code` has a matching `ledger_accounts.account_code` within the same business.
2. Do not invent account mappings for historical lines.
3. If the database only contains development data, reset or reseed before migration if the backfill fails.
4. After migration, future posting must always provide valid `account_id`.
