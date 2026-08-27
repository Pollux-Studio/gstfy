# 06 Solution Map

This document maps the user problems to GSTFY product solutions.

## Problem To Solution Matrix

| User problem | GSTFY solution |
|---|---|
| Dealer does not understand GST filing | GST reports, filing readiness, ITC reconciliation, plain-language review |
| Dealer does not understand accounting | Business-first labels and automatic accounting engine |
| Billing must be fast | POS and sales workspace |
| Product GST setup is confusing | Product master with HSN, GST slab, cess, pricing, and warehouse defaults |
| Purchases are not organized | Purchase bills, purchase returns, debit notes, ITC capture |
| CA asks for data every month | Structured sales, purchases, payments, GST reports, CA dashboard |
| Customer payments are tracked manually | Receipts, receivables, allocations, aging |
| Supplier dues are missed | Payments, payables, supplier allocation |
| Stock is unknown | Inventory stock ledger, opening stock, adjustments, transfers |
| Staff should not access everything | Users, roles, branch access, module permissions |
| Old invoices must not change | Historical snapshots and immutable posted documents |
| Multiple branches create confusion | Branch, warehouse, tenant, and user access model |

## GSTFY Core Flow

GSTFY turns daily business operations into GST-ready output:

```text
Party setup
Product setup
Sales / POS / Purchases
Payments / Receipts
Returns / Credit / Debit notes
Inventory and Accounting effects
ITC and GST reconciliation
GST reporting and filing review
```

The user performs business actions. GSTFY handles the compliance and accounting effects.

## How GSTFY Reduces Work

### Instead of asking the dealer to manage accounting

GSTFY asks:

- Who is the customer?
- What product was sold?
- What is the quantity?
- How was payment received?

The system creates:

- Sales invoice.
- Tax entries.
- Accounting journal.
- Receivable or receipt.
- Inventory movement.
- GST report data.

### Instead of asking the dealer to understand ITC

GSTFY asks:

- Which supplier bill was received?
- What GST was charged?
- Does the supplier GSTIN match?
- Is it eligible or blocked?

The system creates:

- Purchase bill.
- Input GST entry.
- Payable.
- ITC reconciliation record.
- GST reporting impact.

### Instead of asking the dealer to call the CA

GSTFY shows:

- Sales this period.
- Purchase this period.
- GST payable.
- ITC mismatches.
- Filing readiness.
- Blocking issues.

## Product Difference

Large accounting tools often start with:

```text
Company setup
Chart of accounts
Ledgers
Voucher types
Tax ledgers
Inventory groups
Reports
```

GSTFY should start with:

```text
Your GSTIN
Your products
Your customers and suppliers
Your bills
Your GST review
```

The accounting still exists, but it should be generated behind the workflow.

