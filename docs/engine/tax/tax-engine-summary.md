# Tax Engine Implementation Summary

This document summarizes the implementation completed from:

```text
docs/engine/tax/tax-engine.md
```

## Scope Implemented

The Tax Engine is now the canonical backend service for GST calculation and classification.

Implemented:

- Product-aware tax profile resolution.
- Configurable tax-rule master foundation.
- Configurable cess-rule master foundation.
- Effective-date based product tax profile resolution.
- Taxability categories:
  - `TAXABLE`
  - `EXEMPT`
  - `NIL_RATED`
  - `NON_GST`
  - `ZERO_RATED`
- GST reporting classification framework:
  - `B2B`
  - `B2C`
  - `EXPORT_WITH_PAYMENT`
  - `EXPORT_WITHOUT_PAYMENT`
  - `SEZ_WITH_PAYMENT`
  - `SEZ_WITHOUT_PAYMENT`
  - `DEEMED_EXPORT`
  - `RCM`
  - `EXEMPT`
  - `NIL_RATED`
  - `NON_GST`
  - `ZERO_RATED`
- Separate supply-location treatment:
  - `INTRA_STATE`
  - `INTER_STATE`
- Tax-exclusive and tax-inclusive pricing.
- Structured discount support.
- Structured taxable and non-taxable charges.
- Component/rate-level tax breakup.
- Structured Tax Engine validation errors.
- Read APIs for tax rules, HSN/SAC, and UQC lookup.

## Backend Files Added / Updated

Tax module:

```text
apps/backend/src/modules/tax/tax-engine.service.ts
apps/backend/src/modules/tax/tax-rules.service.ts
apps/backend/src/modules/tax/tax.validation.ts
apps/backend/src/modules/tax/tax.schemas.ts
apps/backend/src/modules/tax/tax.types.ts
apps/backend/src/modules/tax/tax.errors.ts
apps/backend/src/modules/tax/tax.routes.ts
apps/backend/src/modules/tax/tax-engine.service.test.ts
```

Core error support:

```text
apps/backend/src/utils/http-error.ts
apps/backend/src/utils/error-handler.ts
```

Database schema:

```text
apps/backend/src/db/schema/index.ts
```

Migrations:

```text
apps/backend/drizzle/0018_tax_engine_extraction.sql
apps/backend/drizzle/0019_tax_engine_rule_master.sql
```

## Database Changes

Added rule master tables:

- `tax_rules`
- `cess_rules`

`tax_rules` supports:

- Global or business-scoped rules through nullable `business_id`.
- `rule_code`
- `description`
- `transaction_type`
- `taxability`
- `gst_rate`
- Optional `cess_rule_id`
- JSON `conditions`
- `effective_from`
- `effective_to`
- `status`
- `version`
- Audit ownership fields.

`cess_rules` supports:

- Global or business-scoped rules.
- `PERCENTAGE`, `SPECIFIC_AMOUNT`, `COMBINED`, or other configured method names.
- Optional percent and per-unit values.
- JSON `conditions`.
- Effective dates and versions.

Added persisted line snapshots to:

- `sales_invoice_lines`
- `purchase_bill_lines`
- `pos_sale_lines`

Snapshot fields include:

- `classification`
- `supply_location_treatment`
- `gross_value`
- `discount_amount`
- `taxable_charges`
- `non_taxable_charges`
- `taxability`
- `cgst_rate`
- `sgst_rate`
- `igst_rate`
- `cess_rule_id`
- `tax_rule_id`
- `tax_rule_version`
- `reverse_charge`
- `round_off`

## Tax Engine Flow

The backend flow is now:

```text
Sales / Purchase / POS
  -> resolve transaction context
  -> Tax Engine
     -> resolve product tax profile
     -> resolve configured tax rule if present
     -> fallback to deterministic GSTFY_TAX_V1 rule
     -> classify supply
     -> calculate taxable value and tax
  -> Accounting Engine
  -> Core Posting
```

If an `itemId` is present, Tax Engine resolves the active `item_tax_profiles` row for the transaction date and uses that product tax profile over client-provided line defaults.

Manual/quick lines without `itemId` still support explicit `hsnSacCode`, `taxability`, and `gstRate`.

## API Added / Extended

Read APIs:

```text
GET /api/v1/tax/rules
GET /api/v1/tax/hsn/:code
GET /api/v1/tax/uqc/:code
```

Calculation API:

```text
POST /api/v1/tax/calculate
```

The calculate endpoint is authenticated, business-scoped, and uses Tax Engine rule/product resolution. It does not write tax amounts to the database.

## Validation Errors

Tax validation errors now return structured metadata:

```json
{
  "message": "Place of supply is required for GST calculation.",
  "code": "PLACE_OF_SUPPLY_REQUIRED",
  "field": "placeOfSupplyStateCode",
  "severity": "error"
}
```

Implemented error codes include:

- `INVALID_TAX_REGISTRATION`
- `INVALID_HSN_SAC`
- `INVALID_GST_RATE`
- `INVALID_REVERSE_CHARGE_CONTEXT`
- `PLACE_OF_SUPPLY_REQUIRED`
- `PLACE_OF_SUPPLY_INVALID`
- `AMBIGUOUS_TAX_RULE`

## Accounting Boundary

Accounting still owns:

- Ledger account mapping.
- Journal entries.
- GST ledger posting.
- Receivable/payable effects.

Tax Engine owns:

- Taxability.
- GST rate/rule resolution.
- CGST/SGST/IGST/cess amounts.
- Classification.
- Tax snapshots.

Accounting now consumes the Tax Engine result and posts it.

## Tests Added / Updated

Tax Engine tests now cover:

- Intra-state GST.
- Inter-state GST.
- Multiple lines.
- Multiple GST rates.
- Exempt lines.
- Nil-rated lines.
- Tax-inclusive pricing.
- Discounts.
- Taxable and non-taxable charges.

## Verification Performed

Passed:

```text
pnpm --filter @gstfy/backend check-types
pnpm --filter @gstfy/backend test
pnpm --filter @gstfy/backend lint
```

## Known Gaps / Future Work

- There is no UI yet for maintaining `tax_rules` or `cess_rules`.
- Configured rule conditions are stored as JSON but only basic rule matching is active in this pass.
- Cess rule tables exist, but actual cess computation modes are still future work.
- RCM classification exists, but RCM liability/ITC accounting flows are still future work.
- Credit notes, debit notes, and returns are not implemented yet.
- Reporting Engine still needs to map posted Tax Engine classifications into GSTR-ready datasets.
