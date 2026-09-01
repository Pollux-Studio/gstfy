# ACCOUNTING-ENGINE.md — GSTfy Double-Entry Accounting Engine

## 0. Purpose

This document defines the accounting engine that turns GSTfy from a billing application into a real business accounting system.

The Accounting Engine receives business transaction effects from domain services and produces balanced double-entry accounting.

It must support:

```text
Sales
Purchase
Receipts
Payments
Expenses
Credit Notes
Debit Notes
Returns
Stock
GST
Branches
Multiple GST Registrations
Cash
Bank
Accounts Receivable
Accounts Payable
Trial Balance
Profit & Loss
Balance Sheet
CA Review
```

Core rule:

> Every posted accounting transaction must produce balanced journal entries against stable ledger accounts.

---

# 1. Architecture

```text
Business Transaction
        |
Domain Service
        |
Accounting Engine
        |
Journal Entry
        |
Journal Lines
        |
Ledger Accounts
        |
Reports
```

Full system:

```text
Sales / Purchase / Payment / Expense
              |
         Transaction Engine
              |
       +------+------+
       |             |
  Accounting       Other Engines
       |
   Journal
       |
 Ledger Accounts
       |
 +-----+------+------+
 |            |      |
AR/AP       GST    Inventory
 |
Financial Reports
 |
Trial Balance
P&L
Balance Sheet
```

---

# 2. Accounting Principles

The engine must enforce:

```text
Total Debit = Total Credit
```

Every posted journal line references:

```text
account_id
```

Never rely on free-text account names as the accounting identity.

---

# 3. Chart of Accounts

Create:

```text
ledger_accounts
```

Conceptual fields:

```text
id
business_id
parent_id nullable
account_code
account_name
account_type
account_group
nature
is_system
is_active
allow_posting
description
created_at
updated_at
```

---

# 4. Account Identity

Recommended uniqueness:

```text
UNIQUE(business_id, account_code)
```

`account_id` is the stable foreign-key identity.

`account_code` is the human/business identifier.

`account_name` is the display name.

Do not use account name as a foreign key.

---

# 5. Account Types

Initial:

```text
ASSET
LIABILITY
EQUITY
INCOME
EXPENSE
```

These are accounting classifications.

---

# 6. Account Groups

Create configurable groups such as:

```text
CURRENT_ASSETS
FIXED_ASSETS
INVENTORY
RECEIVABLES
CASH
BANK
CURRENT_LIABILITIES
PAYABLES
GST_LIABILITIES
GST_INPUT_CREDIT
EQUITY
DIRECT_INCOME
INDIRECT_INCOME
DIRECT_EXPENSE
INDIRECT_EXPENSE
```

Do not hard-code a single chart structure for every business.

---

# 7. Account Nature

Store account behavior:

```text
DEBIT
CREDIT
```

or derive it from account type/group.

This is used for:

```text
ledger display
balance calculation
financial reporting
```

---

# 8. Parent / Child Accounts

Support hierarchical accounts:

```text
Assets
 |
 +-- Current Assets
 |     |
 |     +-- Cash
 |     +-- Bank
 |     +-- Receivables
 |     +-- Inventory
 |
 +-- Fixed Assets
```

And:

```text
Income
 |
 +-- Sales
 +-- Service Income
```

Expenses:

```text
Expenses
 |
 +-- Rent
 +-- Salary
 +-- Electricity
 +-- Office Expense
```

---

# 9. System vs User Accounts

System accounts:

```text
is_system = true
```

Examples:

```text
Accounts Receivable
Accounts Payable
Output CGST
Output SGST
Output IGST
Input CGST
Input SGST
Input IGST
Inventory
Sales
Purchase
Cash
Bank
```

System accounts should be protected from destructive edits.

Users can create custom accounts:

```text
is_system = false
```

---

# 10. Account Posting Rules

A parent/group account may optionally be:

```text
allow_posting = false
```

Example:

```text
Current Assets
```

is a group.

Actual postings go to:

```text
Cash
Bank
Inventory
Receivable
```

not directly to the group.

This prevents ambiguous ledger balances.

---

# 11. Journal Entry

Create:

```text
journal_entries
--------------
id
business_id
voucher_id
entry_date
description
created_by
posted_at
created_at
```

Every journal entry belongs to one voucher.

---

# 12. Journal Lines

Create/use:

```text
journal_entry_lines
-------------------
id
business_id
journal_entry_id
account_id
debit
credit
narration

branch_id nullable
gst_registration_id nullable
warehouse_id nullable

created_at
```

Optional dimensions should be used where appropriate.

Do not force all dimensions on every line.

---

# 13. Journal Invariants

Every line must have exactly one side:

```text
debit > 0 and credit = 0
```

OR:

```text
credit > 0 and debit = 0
```

Reject:

```text
debit < 0
credit < 0
debit > 0 and credit > 0
debit = 0 and credit = 0
```

Every journal must satisfy:

```text
SUM(debit) = SUM(credit)
```

---

# 14. Accounting Dimensions

GSTfy is branch-aware.

Do not create separate account trees such as:

```text
Sales - Chennai
Sales - Madurai
Sales - Salem
```

Instead use:

```text
account_id = Sales
branch_id = Madurai
```

Optional dimensions:

```text
branch_id
gst_registration_id
warehouse_id
```

This supports branch-wise reporting without duplicating ledgers.

---

# 15. Business Context

Every journal must belong to:

```text
business_id
```

The accounting engine must validate:

```text
account belongs to business
branch belongs to business
GST registration belongs to business
warehouse belongs to business
```

Never allow cross-business account posting.

---

# 16. Sales Accounting

Example:

```text
Customer Receivable       Dr 82,600
    Sales                     Cr 70,000
    Output CGST               Cr  6,300
    Output SGST               Cr  6,300
```

Interstate:

```text
Customer Receivable       Dr 82,600
    Sales                     Cr 70,000
    Output IGST               Cr 12,600
```

The actual tax accounts/rates come from Tax Engine output and accounting mappings.

---

# 17. Purchase Accounting

Example:

```text
Purchase / Inventory      Dr 50,000
Input CGST                Dr  4,500
Input SGST                Dr  4,500
    Supplier Payable          Cr 59,000
```

The exact debit account for inventory/purchases depends on the business's accounting/inventory policy.

The Accounting Engine must not hard-code one universal purchase accounting treatment.

---

# 18. Receipt

Customer payment:

```text
Bank/Cash                 Dr 82,600
    Customer Receivable       Cr 82,600
```

The receipt also produces payment allocation if the payment settles specific invoices.

---

# 19. Payment

Supplier payment:

```text
Supplier Payable          Dr 59,000
    Bank/Cash                Cr 59,000
```

Payment allocation then settles the corresponding payable.

---

# 20. Expense

Example:

```text
Electricity Expense       Dr 12,000
    Bank/Cash                 Cr 12,000
```

If GST applies:

```text
Expense                   Dr
Input GST                 Dr
    Bank/Cash                 Cr
```

The Tax Engine determines GST treatment.

---

# 21. Credit Note

Credit note accounting depends on context.

Sales credit note:

```text
Sales Return / Adjustment  Dr
Output GST                 Dr
    Customer                  Cr
```

Purchase-side supplier credit note may:

```text
Supplier Payable          Dr
    Purchase Adjustment       Cr
    Input GST                 Cr
```

The exact accounts depend on the document direction and Tax Engine result.

Do not hard-code credit note meaning from the word "credit" alone.

---

# 22. Debit Note

Sales debit note:

```text
Customer Receivable       Dr
    Sales Adjustment         Cr
    Output GST               Cr
```

Purchase debit note:

```text
Purchase / Adjustment     Dr
Input GST                 Dr
    Supplier Payable          Cr
```

Exact posting depends on issuer, recipient, original document, and domain transaction.

---

# 23. Sales Return

Sales return may create:

```text
Sales Return / Revenue Adjustment   Dr
Output GST                           Dr
    Customer                             Cr
```

and separately the Inventory Engine:

```text
Stock +Qty
```

Accounting for inventory cost/COGS must follow the configured inventory valuation method.

---

# 24. Purchase Return

Purchase return may create:

```text
Supplier Payable           Dr
    Purchase Adjustment       Cr
    Input GST                  Cr
```

and Inventory:

```text
Stock -Qty
```

Do not allow Purchase module to directly edit account balances.

---

# 25. Inventory Accounting

The Accounting Engine must support the Inventory Engine's accounting events.

Possible flow:

```text
Purchase
   |
Inventory Increase
   |
Accounting entry
```

Sales:

```text
Sale
   |
Inventory Decrease
   |
COGS / inventory adjustment
```

The exact journal for inventory movement depends on the chosen inventory/accounting valuation policy.

Therefore:

```text
Inventory Engine calculates stock/cost effect
Accounting Engine posts financial effect
```

---

# 26. Cash Accounts

Create a proper account hierarchy:

```text
Cash
 |
 +-- Cash Counter - Chennai
 +-- Cash Counter - Madurai
 +-- Petty Cash
```

Branches can have separate cash accounts when business requires.

Do not store:

```text
branch.cash_balance
```

as the accounting source of truth.

---

# 27. Bank Accounts

Create:

```text
Bank Accounts
 |
 +-- HDFC Current
 +-- SBI Current
 +-- ICICI
```

Each bank can map to a ledger account.

Optional future bank master:

```text
bank_accounts
-------------
id
business_id
ledger_account_id
bank_name
account_number_masked
ifsc
branch
status
```

The actual accounting balance comes from the ledger.

---

# 28. Accounts Receivable

Customer-specific receivable is a subledger concept.

Recommended:

```text
Accounts Receivable (control account)
        |
        +-- Customer A
        +-- Customer B
        +-- Customer C
```

Whether each customer receives its own ledger account or the system uses a control account plus party subledger should be a deliberate implementation choice.

Recommended for GSTfy:

```text
control account
+
party subledger
```

to avoid creating unnecessary chart-account explosion.

---

# 29. Accounts Payable

Similarly:

```text
Accounts Payable
       |
       +-- Supplier A
       +-- Supplier B
```

Use the Party/AR/AP engine for party-level balances.

Accounting Control Account:

```text
Accounts Payable
```

Party subledger:

```text
Supplier A
```

---

# 30. GST Accounts

The chart should support accounts such as:

```text
Input CGST
Input SGST
Input IGST
Input Cess

Output CGST
Output SGST
Output IGST
Output Cess

RCM GST Liability
GST Payable
```

Exact account hierarchy should be configurable.

Do not hard-code tax account IDs into Sales/Purchase code.

---

# 31. Account Mapping

Tax/Product/Transaction engines should ask the Accounting Engine for mappings:

```text
getSalesAccount(item)
getPurchaseAccount(item)
getInventoryAccount(item)
getInputTaxAccount(taxComponent)
getOutputTaxAccount(taxComponent)
getReceivableControlAccount()
getPayableControlAccount()
```

Mappings can be configured per business.

---

# 32. Default Chart of Accounts

When a new business is created, GSTfy may seed a default chart.

Example:

```text
1000 Assets
1100 Current Assets
1110 Cash
1120 Bank
1130 Accounts Receivable
1140 Inventory

2000 Liabilities
2110 Accounts Payable
2120 GST Payable

3000 Equity
3100 Capital

4000 Income
4100 Sales
4200 Service Income

5000 Cost / Expenses
5100 Purchases
5200 COGS
5300 Rent
5400 Electricity
```

The actual numbering is configurable.

---

# 33. GST-specific Seed Accounts

Default system accounts may include:

```text
Input CGST
Input SGST
Input IGST
Output CGST
Output SGST
Output IGST
Input Cess
Output Cess
```

The GST Engine should map tax components to these accounts.

---

# 34. Account Creation

API:

```text
POST /api/v1/accounting/accounts
```

Fields:

```text
parentId
accountCode
accountName
accountType
accountGroup
allowPosting
description
```

Validation:

```text
account code unique per business
parent belongs to business
parent is valid
account type valid
```

---

# 35. Account Update

Allowed:

```text
name
description
parent where safe
reporting metadata
```

Restricted after posting:

```text
account identity
account type
historical semantics
```

Do not change an account's meaning after significant historical use without a controlled migration.

---

# 36. Account Deactivation

Used account:

```text
ACTIVE -> INACTIVE
```

not delete.

Cannot post to inactive account.

Historical journal lines remain valid.

---

# 37. Journal Posting API

The public application should not manually send journal lines for Sales/Purchase.

Accounting Engine should expose an internal service:

```text
postJournal(command)
```

Input:

```text
voucherId
description
lines[]
dimensions
```

Each line:

```text
accountId
debit
credit
narration
branchId
gstRegistrationId
warehouseId
```

The Accounting Engine validates and persists the journal.

---

# 38. Accounting Events

Domain services should emit accounting commands/events.

Examples:

```text
SALES_POSTED
PURCHASE_POSTED
RECEIPT_POSTED
PAYMENT_POSTED
EXPENSE_POSTED
CREDIT_NOTE_POSTED
DEBIT_NOTE_POSTED
SALES_RETURN_POSTED
PURCHASE_RETURN_POSTED
INVENTORY_VALUATION_POSTED
```

The Accounting Engine turns them into journal entries.

---

# 39. Separation of Calculation and Posting

Do not mix:

```text
calculate accounting effect
```

with:

```text
save journal
```

Preferred:

```text
Accounting Calculator
       |
Journal Command
       |
Accounting Posting Service
       |
Database
```

This makes testing easier.

---

# 40. Branch Reporting

A journal line can carry:

```text
branch_id
```

Then:

```text
Company P&L
```

can aggregate:

```text
Chennai
Madurai
Salem
```

without separate account trees.

---

# 41. GST Registration Reporting

Journal lines may carry:

```text
gst_registration_id
```

This enables:

```text
Tamil Nadu books
Karnataka books
```

within one business.

Do not create a separate database/company for each GST registration.

---

# 42. Warehouse Dimension

Use `warehouse_id` where a financial effect genuinely relates to a warehouse.

Do not add warehouse to every accounting line automatically.

Example:

```text
Inventory asset -> warehouse dimension
Rent expense -> branch dimension
Bank -> branch/business dimension where appropriate
```

Keep dimensions meaningful.

---

# 43. Ledger Query

Provide:

```text
GET /api/v1/accounting/accounts/:id/ledger
```

Filters:

```text
from
to
branch
GST registration
warehouse
```

Return:

```text
date
voucher
narration
debit
credit
running_balance
```

---

# 44. Trial Balance

Provide:

```text
GET /api/v1/accounting/reports/trial-balance
```

Formula:

```text
Opening
+
Debits
-
Credits
=
Closing
```

Every account must reconcile to the journal.

Trial balance must satisfy:

```text
Total Debit Balance = Total Credit Balance
```

where the report uses the chosen debit/credit presentation.

---

# 45. Profit & Loss

The P&L should derive from:

```text
Income accounts
+
Expense accounts
```

Support filters:

```text
date range
branch
GST registration
```

Do not create a manually editable P&L total.

---

# 46. Balance Sheet

Balance sheet derives from:

```text
Assets
Liabilities
Equity
```

It must satisfy:

```text
Assets = Liabilities + Equity
```

The report engine should derive the statement from posted ledger data.

---

# 47. Day Book

Create:

```text
GET /api/v1/accounting/reports/day-book
```

Display:

```text
Date
Voucher Number
Voucher Type
Party
Debit
Credit
Branch
```

This is useful for dealer and CA.

---

# 48. General Ledger

The ledger should be drillable:

```text
P&L
  |
Sales
  |
INV-001
  |
Customer
  |
Payment
```

Every report should eventually allow:

```text
Report
   ↓
Account
   ↓
Journal
   ↓
Voucher
   ↓
Source document
```

This is critical for CA auditability.

---

# 49. Accounting Period

Accounting Engine must refuse posting when:

```text
period.status = locked
```

Future:

```text
under_review
ready
exported
filed
```

must not automatically mean "editable".

Only `OPEN` should normally allow posting.

---

# 50. Period Closing Checks

Before locking a period, future CA workflow should check:

```text
unposted drafts
unbalanced entries
unallocated receipts
unallocated payments
negative stock
GST validation errors
unreconciled critical items
```

Do not implement all checks in the Accounting Engine itself. It should expose data required by the Period/CA engine.

---

# 51. Accounting Audit

Audit:

```text
ACCOUNT_CREATED
ACCOUNT_UPDATED
ACCOUNT_DEACTIVATED

JOURNAL_POSTED
JOURNAL_CANCELLED
PERIOD_LOCKED
PERIOD_UNLOCKED
ACCOUNT_MAPPING_CHANGED
```

Never overwrite journal history.

---

# 52. Journal Cancellation

Do not delete a journal.

If cancellation is legally/accountingly allowed:

```text
Original Journal
      |
Reversal Journal
```

or use the relevant document correction workflow.

A posted journal remains traceable.

---

# 53. Reversal Entry

Example:

Original:

```text
Expense          Dr 10,000
    Bank             Cr 10,000
```

Reversal:

```text
Bank              Dr 10,000
    Expense           Cr 10,000
```

Store:

```text
reversal_of_journal_entry_id
```

where applicable.

---

# 54. Accounting Import / Opening Balances

Support opening balances through a controlled accounting command.

Do not directly insert balances into reports.

Example:

```text
Opening Balance
   |
Journal Entry
   |
Ledger
```

---

# 55. Accounting Engine API Surface

External read APIs:

```text
GET /api/v1/accounting/accounts
GET /api/v1/accounting/accounts/:id
GET /api/v1/accounting/accounts/:id/ledger
GET /api/v1/accounting/reports/trial-balance
GET /api/v1/accounting/reports/profit-loss
GET /api/v1/accounting/reports/balance-sheet
GET /api/v1/accounting/reports/day-book
```

Internal commands:

```text
createAccount()
updateAccount()
postJournal()
reverseJournal()
recalculateControlBalance()
```

Sales/Purchase should use internal accounting services, not raw HTTP calls to accounting endpoints.

---

# 56. Product Integration

Product Engine provides default mappings:

```text
sales_account_id
purchase_account_id
inventory_account_id
```

Accounting Engine validates them.

Product Engine does not create journals.

---

# 57. Party Integration

Party Accounting Profile provides:

```text
receivable_account_id
payable_account_id
advance_receipt_account_id
advance_payment_account_id
```

Accounting Engine validates these mappings.

Party balance is still derived from journal + AR/AP allocations.

---

# 58. Inventory Integration

Inventory Engine reports:

```text
quantity
unit_cost
inventory_value
```

Accounting Engine records appropriate financial value movement.

The exact COGS/valuation treatment is configurable and belongs to the Inventory + Accounting boundary.

---

# 59. GST Integration

Tax Engine returns:

```text
tax_component
tax_amount
taxable_value
```

Accounting Engine maps:

```text
CGST -> Input/Output CGST account
SGST -> Input/Output SGST account
IGST -> Input/Output IGST account
Cess -> Input/Output Cess account
```

Do not hard-code account IDs.

---

# 60. Example Full Sales Posting

Input from Sales:

```text
Customer = ABC
Taxable = 70,000
CGST = 6,300
SGST = 6,300
Invoice total = 82,600
```

Accounting Engine receives:

```text
Customer receivable
Sales income
Output CGST
Output SGST
```

Creates:

```text
Customer              Dr 82,600
    Sales                  Cr 70,000
    Output CGST            Cr  6,300
    Output SGST            Cr  6,300
```

Then Inventory Engine separately produces stock/COGS effects if applicable.

---

# 61. Example Full Purchase Posting

Input:

```text
Supplier
Taxable = 50,000
CGST = 4,500
SGST = 4,500
Total = 59,000
```

Accounting:

```text
Inventory/Purchase      Dr 50,000
Input CGST              Dr  4,500
Input SGST              Dr  4,500
    Supplier                 Cr 59,000
```

The exact inventory/purchase account depends on business configuration.

---

# 62. Accounting Invariants

The engine must guarantee:

```text
1. Every posted journal balances.
2. Every account belongs to the business.
3. Every posting account is active and postable.
4. Parent/group accounts cannot receive postings when allow_posting=false.
5. Every journal belongs to a voucher.
6. Posted journals are immutable.
7. Reversals reference original journals.
8. Financial period must be open for new posting.
9. Every dimension belongs to the same business.
10. Report totals derive from journal lines.
```

---

# 63. Testing

## Chart

```text
[ ] Create account
[ ] Duplicate code rejected
[ ] Parent validation
[ ] Parent non-postable
[ ] Deactivate account
[ ] Used account cannot be deleted
```

## Journal

```text
[ ] Balanced journal accepted
[ ] Unbalanced rejected
[ ] Both debit/credit rejected
[ ] Zero line rejected
[ ] Invalid account rejected
[ ] Cross-business account rejected
[ ] Locked period rejected
```

## Dimensions

```text
[ ] Valid branch
[ ] Invalid branch
[ ] Cross-business branch
[ ] Valid GST registration
[ ] Valid warehouse
```

## Reports

```text
[ ] Trial balance balances
[ ] P&L derives from journals
[ ] Balance sheet balances
[ ] Branch filtering works
[ ] GST registration filtering works
[ ] Drill-down reaches voucher
```

---

# 64. Definition of Done

```text
[ ] Ledger accounts table
[ ] Account hierarchy
[ ] System/default accounts
[ ] User account creation
[ ] Account permissions
[ ] Journal posting service
[ ] Balanced journal validation
[ ] Branch dimensions
[ ] GST registration dimensions
[ ] AR/AP control mappings
[ ] Product accounting mappings
[ ] GST account mappings
[ ] Cash/bank accounts
[ ] Trial balance
[ ] P&L
[ ] Balance Sheet
[ ] General Ledger
[ ] Day Book
[ ] Audit
[ ] Period-lock integration
[ ] Tests
```

---

# 65. What Accounting Engine Must NOT Own

Do not implement here:

```text
GST rate calculation
CGST/SGST/IGST determination
Live inventory quantity
Product master
Customer master
Supplier master
Invoice UI
GST return generation
E-Invoice
E-Way Bill
```

Those belong to their respective domain engines.

---

# 66. Final Architecture

```text
                    BUSINESS EVENT
                          |
                   Domain Transaction
                          |
             +------------+------------+
             |            |            |
         Accounting     Tax        Inventory
             |            |            |
             ▼            ▼            ▼
          JOURNAL      GST ENTRY    STOCK ENTRY
             |
       LEDGER ACCOUNTS
             |
      +------+-------+------+
      |              |      |
     AR/AP         P&L    Balance Sheet
      |
     CA Review / Reports
```

## Final rule

> Accounting Engine owns the double-entry financial truth of GSTfy. It converts validated business effects into balanced journal entries against stable ledger accounts, while remaining independent from Product, Tax, Inventory, Sales, and Purchase business logic.
