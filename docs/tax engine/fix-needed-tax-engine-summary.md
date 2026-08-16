# Tax Engine Fix Summary

This document summarizes the fixes completed from:

```text
docs/tax engine/fix-needed-tax-engine.md
```

## Scope Implemented

The GST calculation logic was extracted from Accounting into a standalone Tax Engine module.

Implemented:

- One canonical tax calculation service.
- Shared Tax Engine usage for Sales, Purchases, and POS.
- Intra-state CGST/SGST split inside Tax Engine.
- Inter-state IGST calculation inside Tax Engine.
- Tax-exclusive pricing support.
- Tax-inclusive pricing support.
- Discount-aware line calculation support.
- Exempt, nil-rated, non-GST, and zero-rated taxability support.
- Component/rate-level tax breakup output.
- Tax rule version metadata on every calculated line.
- Historical tax snapshot fields on Sales, Purchase, and POS lines.
- GST entries now preserve actual component tax rates instead of storing `0.00`.

Out of scope for this fix:

- GSTR-1 / GSTR-3B generation.
- ITC reconciliation.
- E-invoice.
- E-way bill.
- Inventory / COGS.
- Credit notes and debit notes.
- External GSTN or GSP integration.

## Backend Files Added

Tax module:

```text
apps/backend/src/modules/tax/tax-engine.service.ts
apps/backend/src/modules/tax/tax-rules.service.ts
apps/backend/src/modules/tax/tax.validation.ts
apps/backend/src/modules/tax/tax.schemas.ts
apps/backend/src/modules/tax/tax.types.ts
apps/backend/src/modules/tax/tax.routes.ts
apps/backend/src/modules/tax/tax-engine.service.test.ts
```

Database migration:

```text
apps/backend/drizzle/0018_tax_engine_extraction.sql
```

## Tax Engine Contract

The Tax Engine now returns line-level and transaction-level results with:

- `taxability`
- `classification`
- `taxableValue`
- `gstRate`
- `cgstRate`
- `cgstAmount`
- `sgstRate`
- `sgstAmount`
- `igstRate`
- `igstAmount`
- `cessRuleId`
- `cessAmount`
- `totalTax`
- `roundOff`
- `totalValue`
- `placeOfSupply`
- `reverseCharge`
- `taxRuleId`
- `taxRuleVersion`
- `effectiveFrom`
- `effectiveTo`

It also returns `taxBreakup`, grouped by:

- Tax component
- Component rate
- ITC eligibility
- Tax rule id
- Tax rule version

This is required because a single invoice can contain multiple GST rates.

## Accounting Boundary Change

Updated:

```text
apps/backend/src/modules/accounting/accounting-domain.service.ts
```

Accounting no longer calculates GST from quantity/rate/place of supply.

Accounting now:

- Receives `CalculatedTransaction` from Tax Engine.
- Builds journal lines from Tax Engine totals.
- Maps CGST/SGST/IGST/Cess totals to configured ledger accounts.
- Builds GST entries from Tax Engine `taxBreakup`.
- Stores tax snapshots in voucher snapshots.

The old accounting-owned GST logic was removed.

## Sales / Purchase / POS Changes

Updated:

```text
apps/backend/src/modules/sales/sales.routes.ts
apps/backend/src/modules/sales/sales.schemas.ts
apps/backend/src/modules/purchases/purchases.routes.ts
apps/backend/src/modules/purchases/purchases.schemas.ts
apps/backend/src/modules/pos/pos.routes.ts
apps/backend/src/modules/pos/pos.schemas.ts
```

Behavior preserved:

- Current Sales API behavior remains unchanged for existing callers.
- Current Purchase API behavior remains unchanged for existing callers.
- Current POS API behavior remains unchanged for existing callers.
- Existing lines still default to taxable, tax-exclusive pricing.

New optional line inputs:

- `taxability`
- `cessRuleId`
- `pricingMode`
- `discountAmount`

Purchase calculation passes `transactionType: "purchase"` into Tax Engine.

POS calculation passes `transactionType: "pos"` into Tax Engine.

## Database Changes

Added snapshot columns to:

- `sales_invoice_lines`
- `purchase_bill_lines`
- `pos_sale_lines`

Columns added:

- `taxability`
- `classification`
- `cgst_rate`
- `sgst_rate`
- `igst_rate`
- `cess_rule_id`
- `tax_rule_id`
- `tax_rule_version`
- `reverse_charge`
- `round_off`

Existing rows are backfilled with:

- `taxability = TAXABLE`
- `tax_rule_version = GSTFY_TAX_V1`
- `classification` inferred from existing IGST amount
- Component rates inferred from existing component tax amount and taxable value

## API Added

Added:

```text
POST /api/v1/tax/calculate
```

Purpose:

- Allows future UI/server workflows to preview Tax Engine output directly.
- Uses the authenticated business context.
- Resolves the seller GST registration when `sellerStateCode` is not explicitly sent.

## Regression Tests Added

Added:

```text
apps/backend/src/modules/tax/tax-engine.service.test.ts
```

Covered:

- Intra-state sale.
- Inter-state sale.
- Multiple lines.
- Multiple GST rates.
- Exempt line.
- Nil-rated line.
- Tax-inclusive pricing.
- POS uses the same Tax Engine path.

## Verification Performed

Passed:

```text
pnpm --filter @gstfy/backend check-types
pnpm --filter @gstfy/backend test
```

## Known Gaps

- Tax rules are versioned in code as `GSTFY_TAX_V1`; a maintained tax-rule table can be added when GST rate management becomes editable/admin-driven.
- Cess is snapshot-ready and rule-id aware, but actual cess computation modes are still future work.
- RCM is snapshot-ready through the contract, but purchase RCM liability posting is future work.
- Product Engine provides tax defaults, but Sales/Purchase/POS still accept explicit line tax inputs in this phase.
