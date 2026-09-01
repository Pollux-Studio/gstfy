# TAX-ENGINE.md — GSTfy GST Tax Calculation & Classification Engine

## 0. Purpose

The Tax Engine is GSTfy's single authoritative service for GST tax determination and calculation.

It is used by:

```text
Sales
Purchase
POS
Credit Note
Debit Note
Sales Return
Purchase Return
Future RCM transactions
Future Export/SEZ transactions
```

It answers:

> Given the business, GST registration, party, product, date, place of supply, and transaction context, what GST treatment and tax amount apply?

## 1. Architecture

```text
                     TRANSACTION
                          |
                 +--------+--------+
                 |                 |
              PARTY            PRODUCT
                 |                 |
                 +--------+--------+
                          |
                     TAX ENGINE
                          |
          +---------------+---------------+
          |               |               |
      Classification   Rule Resolution  Calculation
          |               |               |
          +---------------+---------------+
                          |
                      TAX RESULT
                          |
          +---------------+---------------+
          |               |               |
      Accounting       Invoice        GST Ledger
```

## 2. Single source of tax truth

Only the Tax Engine determines:

```text
taxability
GST rate
taxable value
CGST
SGST/UTGST
IGST
cess
classification
RCM treatment
tax-rule version
```

Product, Sales, Purchase, POS, Accounting and reporting modules must not independently recalculate these values.

## 3. Calculation context

Input should include as applicable:

```text
business_id
transaction_date
seller_gst_registration_id
party_id
party_gst_registration_id
branch_id
warehouse_id
transaction_type
supply_type
place_of_supply_state
place_of_supply_state_code
item_id
quantity
unit
rate
discount
other_charges
tax_profile_id
taxability
gst_rate
cess_rule_id
reverse_charge
```

Validate required fields based on transaction type.

## 4. Tax result

### Line result

```text
itemId
taxability
hsnSac
quantity
unit
rate
discount
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
totalValue
classification
placeOfSupply
reverseCharge
taxRuleVersion
```

### Invoice summary

```text
taxableValue
cgst
sgst
igst
cess
totalTax
roundOff
grandTotal
```

## 5. Main internal service

```text
calculateTax(context)
```

Also expose internal helpers:

```text
resolveTaxRule(context)
validateTaxContext(context)
```

Sales/Purchase/POS should call the service internally.

Do not make frontend clients write tax data directly.

## 6. Calculation pipeline

```text
Resolve seller GST registration
        |
Resolve party GST registration
        |
Resolve effective product tax profile
        |
Validate transaction date
        |
Resolve place of supply
        |
Resolve supply classification
        |
Resolve tax rule
        |
Determine taxability
        |
Calculate taxable value
        |
Calculate GST
        |
Calculate Cess
        |
Round consistently
        |
Return tax result
```

## 7. Taxability

Support configured semantic categories:

```text
TAXABLE
EXEMPT
NIL_RATED
NON_GST
ZERO_RATED
```

Do not reduce all zero-tax cases to:

```text
gstRate = 0
```

## 8. GST rate

Product Engine supplies the effective/default rate profile.

Tax Engine validates the applicable rule for:

```text
item
transaction date
transaction context
```

The posted transaction stores:

```text
gstRateSnapshot
taxRuleVersion
```

## 9. CGST / SGST / IGST

Tax Engine determines the applicable components from the transaction context.

Conceptually:

```text
applicable intrastate supply
    -> CGST + SGST/UTGST
```

or:

```text
applicable inter-state supply
    -> IGST
```

Do not implement a simplistic branch of:

```text
sellerState != buyerState -> IGST
```

as the complete rule.

## 10. Place of supply

Tax Engine receives:

```text
placeOfSupplyState
placeOfSupplyStateCode
```

and applies the appropriate rules for the transaction type.

Do not force every transaction to use customer registered state.

## 11. Classification

Return an internal classification suitable for reporting.

Conceptual values:

```text
B2B
B2C
EXPORT_WITH_PAYMENT
EXPORT_WITHOUT_PAYMENT
SEZ_WITH_PAYMENT
SEZ_WITHOUT_PAYMENT
DEEMED_EXPORT
RCM
EXEMPT
NIL_RATED
NON_GST
```

The Reporting Engine later maps this internal classification to the current GST return schema.

## 12. Registered / unregistered parties

Tax Engine can use the Party Master GST registration state:

```text
registered
unregistered
```

to establish the relevant transaction path.

Do not assume GSTIN presence alone is always enough to decide the final reporting treatment.

## 13. Reverse Charge

Input:

```text
reverseCharge
```

Return applicable tax treatment.

Tax Engine does not claim ITC.

Future:

```text
Tax Engine
    -> RCM liability
    -> ITC/Reconciliation Engine
```

## 14. Cess

Cess must be rule-driven.

Support conceptual methods:

```text
PERCENTAGE
SPECIFIC_AMOUNT
COMBINED
OTHER_CONFIGURED_RULE
```

A cess rule should contain enough information for its calculation, including effective dates and applicable basis.

Do not hard-code permanent cess rates in invoice code.

## 15. Tax-rule master

Recommended:

```text
tax_rules
---------
id
rule_code
description
transaction_type
taxability
gst_rate
cess_rule_id
conditions
effective_from
effective_to
status
version
```

Rules may later be normalized into separate tax/cess/rate tables if needed.

## 16. Rule resolution

```text
resolveTaxRule(context)
```

Must consider:

```text
item
HSN/SAC
transaction date
seller registration
party registration
place of supply
supply type
reverse charge
```

If two active rules are ambiguous:

```text
FAIL
```

Never guess.

## 17. Effective dating

Example:

```text
Product X

Rule A
18%
2026-04-01 -> 2026-09-30

Rule B
12%
2026-10-01 -> present
```

Then:

```text
2026-08-15 -> 18%
2026-10-15 -> 12%
```

Old posted transactions remain unchanged.

## 18. Taxable value

Conceptually:

```text
gross line value
- applicable discount
+ applicable taxable charges
= taxable value
```

Validate server-side.

Do not trust frontend taxable totals.

## 19. Inclusive pricing

When:

```text
taxMode = INCLUSIVE
```

derive taxable value and tax from the tax-inclusive price using the applicable rate/rules.

The UI must not duplicate this formula.

## 20. Exclusive pricing

When:

```text
taxMode = EXCLUSIVE
```

the tax is added to the taxable value.

## 21. Discounts

Tax Engine should receive structured discount information.

Return:

```text
discount amount
taxable value
tax
```

Persist the result in the posted transaction snapshot.

## 22. Other charges

Represent charges explicitly:

```text
chargeType
amount
taxTreatment
```

Possible:

```text
taxable
non_taxable
```

The applicable tax valuation rules determine whether the charge enters the taxable base.

## 23. Multiple line items

Every line gets its own tax result.

Example:

```text
Item A -> 5%
Item B -> 18%
Item C -> Exempt
```

Invoice summary aggregates by tax component and rate.

## 24. Rounding

Use one shared monetary/tax rounding policy.

Possible implementation level:

```text
LINE
TAX_COMPONENT
INVOICE
```

The actual policy must be consistent across API, PDF, accounting and exports.

## 25. Snapshot

Posted transaction stores:

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

## 26. Accounting integration

Tax Engine returns amounts.

Accounting maps them to accounts:

```text
Input CGST
Output CGST

Input SGST
Output SGST

Input IGST
Output IGST

Input Cess
Output Cess
```

Tax Engine must not own ledger account IDs.

## 27. Inventory boundary

Tax Engine may use quantity/value as inputs but does not own:

```text
stock
COGS
inventory valuation
warehouse quantity
transfer
```

Inventory Engine owns these.

## 28. Sales integration

```text
Sales Draft
    |
Resolve Product
    |
Resolve Customer GST registration
    |
Tax Engine
    |
Accounting Engine
    |
Inventory Engine
    |
Core Posting
```

## 29. Purchase integration

```text
Purchase Draft
    |
Resolve Product
    |
Resolve Supplier GST registration
    |
Tax Engine
    |
Accounting Engine
    |
Inventory Engine
    |
ITC candidate
    |
Core Posting
```

Tax Engine does not claim ITC.

## 30. POS integration

```text
POS
 |
Sales Transaction
 |
Tax Engine
 |
Accounting
 |
Inventory
```

There must be no POS-specific GST calculator.

## 31. Credit/Debit Note integration

Use:

```text
original transaction context
adjustment quantity/value
adjustment date
```

to calculate the adjustment.

Do not blindly negate original tax values without validating the note/return rules.

## 32. Return integration

Sales Return:

```text
original sale
    |
returned amount/quantity
    |
Tax Engine
```

Purchase Return:

```text
original purchase
    |
returned amount/quantity
    |
Tax Engine
```

## 33. Validation errors

Use structured errors such as:

```text
TAX_REGISTRATION_NOT_FOUND
INVALID_TAX_REGISTRATION
PARTY_GST_REGISTRATION_NOT_FOUND
INVALID_HSN_SAC
INVALID_TAXABILITY
TAX_RULE_NOT_FOUND
AMBIGUOUS_TAX_RULE
TAX_RULE_EXPIRED
PLACE_OF_SUPPLY_REQUIRED
PLACE_OF_SUPPLY_INVALID
INVALID_GST_RATE
INVALID_CESS_RULE
INVALID_REVERSE_CHARGE_CONTEXT
TAXABLE_VALUE_MISMATCH
TAX_CALCULATION_MISMATCH
```

Each should include:

```text
code
field
message
severity
```

## 34. API

Primary interface:

```text
calculateTax()
resolveTaxRule()
validateTaxContext()
```

Optional read APIs:

```text
GET /api/v1/tax/rules
GET /api/v1/tax/hsn/:code
GET /api/v1/tax/uqc/:code
```

Do not create a public write endpoint for arbitrary tax amounts.

## 35. Configuration/source

Tax rules must be:

```text
configurable
versioned
effective-dated
auditable
```

The maintained rule dataset should be based on the current official GST/CBIC/GSTN requirements at implementation/deployment time.

## 36. Audit

Audit:

```text
TAX_RULE_CREATED
TAX_RULE_UPDATED
TAX_RULE_ACTIVATED
TAX_RULE_DEACTIVATED
CESS_RULE_UPDATED
```

Posted transactions record the rule version used.

## 37. Tests

### Taxability
```text
[ ] taxable
[ ] exempt
[ ] nil-rated
[ ] non-GST
[ ] zero-rated
```

### Location/context
```text
[ ] intrastate
[ ] interstate
[ ] place-of-supply cases
```

### Rates/rules
```text
[ ] one GST rate
[ ] multiple rates
[ ] effective-date change
[ ] overlapping rule rejection
```

### Calculation
```text
[ ] inclusive price
[ ] exclusive price
[ ] discount
[ ] multiple items
[ ] taxable charges
[ ] non-taxable charges
[ ] rounding
```

### Cess
```text
[ ] percentage rule
[ ] specific rule
[ ] combined rule
[ ] effective date
```

### RCM
```text
[ ] normal
[ ] RCM
[ ] invalid RCM
```

### Integration
```text
[ ] Sales uses Tax Engine
[ ] Purchase uses Tax Engine
[ ] POS uses Tax Engine
[ ] Credit Note uses Tax Engine
[ ] Debit Note uses Tax Engine
[ ] Returns use Tax Engine
```

### Historical
```text
[ ] tax rule changes after posting
[ ] old transaction remains unchanged
[ ] rule version retained
```

## 38. Definition of done

```text
[ ] Canonical tax service
[ ] Canonical rule resolution
[ ] Taxability
[ ] GST rate
[ ] CGST/SGST/IGST
[ ] Place of supply
[ ] Cess
[ ] RCM
[ ] Classification framework
[ ] Effective dates
[ ] Rule versions
[ ] Tax snapshots
[ ] Server validation
[ ] Sales integration
[ ] Purchase integration
[ ] POS integration
[ ] Tests
[ ] Duplicate tax logic removed from Accounting
```

## 39. What Tax Engine must not own

```text
Product CRUD
Party CRUD
Journal posting
Ledger accounts
Live inventory
COGS
Invoice PDF
Payment allocation
GST return generation
E-invoice
E-way bill
CA review
```

## Final architecture

```text
Transaction
   |
Party + Product + Organization Context
   |
Tax Engine
   |
+----------------+----------------+
|                |                |
Rule           Calculation    Classification
Resolution
|                |                |
+----------------+----------------+
                 |
             Tax Result
                 |
       +---------+---------+
       |                   |
   Accounting          Snapshot/GST
       |
     Journal
```

## Final rule

> Tax Engine is the single authority for GST determination and calculation. Product provides defaults, transaction services provide business facts, Accounting posts the tax result, Inventory owns stock/value effects, and Reporting later converts posted tax data into return-ready datasets.
