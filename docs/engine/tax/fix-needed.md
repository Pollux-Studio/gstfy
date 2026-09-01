# FIX-NEEDED-TAX-ENGINE.md — GSTfy Corrections Before Tax Engine

## Purpose

GSTfy now has:

```text
Organization Foundation
Party Master
Core Voucher Engine
Core Hardening
Product Engine
Accounting Engine
Sales v1
Purchase v1
POS v1
```

The current Sales/Purchase/Accounting implementation already calculates GST server-side and posts balanced journals. The remaining architectural issue is that GST calculation still lives inside the Accounting Domain Service.

The goal of this fix is to extract GST determination/calculation into one standalone Tax Engine without breaking current Sales/Purchase/POS behavior.

## 1. Required architecture

Current:

```text
Sales/Purchase
      |
Accounting Domain Service
      |
GST calculation
      |
Journal
```

Required:

```text
Sales/Purchase
      |
Product Resolver
      |
Tax Engine
      |
Accounting Engine
      |
Inventory Engine
      |
Core Posting
```

Accounting must consume a tax result instead of deciding tax rules.

## 2. Extract GST calculation

Move GST decision/calculation from the current accounting domain service into:

```text
modules/tax/
  tax-engine.service.ts
  tax-rules.service.ts
  tax.validation.ts
  tax.schemas.ts
  tax.types.ts
```

Do not duplicate GST logic during migration.

There must be one authoritative implementation.

## 3. Temporary migration

During migration:

```text
Sales -> Tax Engine -> Accounting -> Core Posting
Purchase -> Tax Engine -> Accounting -> Core Posting
POS -> Tax Engine -> Sales/Accounting -> Core Posting
```

Preserve the current external Sales/Purchase/POS API behavior.

## 4. Tax result contract

Tax Engine should return a deterministic result:

```text
taxability
classification
taxableValue
gstRate
cgstRate
cgstAmount
sgstRate
sgstAmount
igstRate
igstAmount
cessRuleId
cessAmount
totalTax
roundOff
totalValue
placeOfSupply
reverseCharge
taxRuleVersion
```

Not every field must apply to every transaction.

## 5. Accounting boundary

Accounting Engine receives:

```text
taxResult
```

and maps:

```text
CGST -> configured CGST account
SGST -> configured SGST account
IGST -> configured IGST account
Cess -> configured Cess account
```

Accounting must not contain logic such as:

```text
if interstate -> IGST
```

## 6. Product boundary

Product Engine provides:

```text
HSN/SAC
taxability default
GST rate/profile
cess rule/profile
UQC
```

Tax Engine decides the applicable tax treatment for the transaction.

## 7. Historical snapshots

Posted transactions must retain:

```text
taxability
gstRate
cgstRate
sgstRate
igstRate
cgstAmount
sgstAmount
igstAmount
cessRuleId
cessAmount
classification
placeOfSupply
reverseCharge
taxRuleVersion
```

Historical transactions must not be recalculated using current tax rules.

## 8. Tax rule versioning

Every calculation should resolve a rule version:

```text
taxRuleId
taxRuleVersion
effectiveFrom
effectiveTo
```

Future changes must create/update effective-dated rules rather than changing historical meaning.

## 9. Cess

Do not model cess permanently as percentage-only.

Support rule-driven modes such as:

```text
PERCENTAGE
SPECIFIC
COMBINED
OTHER_CONFIGURED
```

The exact legal rule/rate must come from maintained tax-rule data, not scattered application constants.

## 10. Place of supply

Tax Engine receives:

```text
seller GST registration
party GST registration where available
place of supply
transaction type
```

Do not rely only on:

```text
sellerState != buyerState
```

Place-of-supply treatment belongs to the Tax Engine.

## 11. RCM

Tax Engine should determine the applicable RCM tax treatment when the transaction context supports it.

It must not automatically claim ITC.

Future flow:

```text
Purchase
  |
Tax Engine
  |
RCM liability
  |
ITC / Reconciliation Engine
```

## 12. POS

POS must call the same Tax Engine as normal Sales.

Do not create a separate POS GST calculator.

## 13. Regression tests

Add:

```text
[ ] Intra-state sale
[ ] Inter-state sale
[ ] Intra-state purchase
[ ] Inter-state purchase
[ ] Multiple lines
[ ] Multiple GST rates
[ ] Discount
[ ] Exempt
[ ] Nil-rated
[ ] Non-GST
[ ] Zero-rated
[ ] Tax-inclusive pricing
[ ] Tax-exclusive pricing
[ ] Historical tax snapshot
[ ] POS uses same Tax Engine
```

## 14. Remove duplicate logic

Once the Tax Engine is working, remove duplicated GST calculation from:

```text
accounting-domain.service.ts
sales
purchases
pos
```

## 15. What not to implement in this fix

Do not add:

```text
GSTR-1
GSTR-3B
ITC reconciliation
E-invoice
E-way bill
Inventory
COGS
Payment/Receipt
Credit/Debit Notes
```

This phase is only the Tax Engine extraction/hardening.

## 16. Definition of Done

```text
[ ] One canonical tax calculation service
[ ] Sales uses Tax Engine
[ ] Purchase uses Tax Engine
[ ] POS uses Tax Engine
[ ] Accounting consumes tax result
[ ] Tax result is snapshot-ready
[ ] Tax rule version is stored
[ ] Duplicate GST logic removed
[ ] Existing transaction behavior preserved
[ ] Tests pass
```

## Final rule

> Tax Engine owns tax decisions and calculations; Product Engine provides defaults, Accounting posts the result, Inventory owns stock, and transaction modules orchestrate the business event.
