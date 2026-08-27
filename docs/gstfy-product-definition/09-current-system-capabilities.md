# 09 Current System Capabilities

This document summarizes the current GSTFY system shape based on the modules already designed and implemented in the codebase.

## System Architecture

GSTFY is built around engine separation:

```text
Organization
-> Party Master
-> Product Master
-> Tax Engine
-> Sales / POS / Purchases
-> Accounting Engine
-> Inventory Engine
-> Payment / Receipt Engine
-> Returns / Credit / Debit Notes
-> ITC and GST Reconciliation
-> GST Reporting
-> GST Filing Integration
-> E-Invoice
```

Each engine owns one concern and avoids duplicate business logic.

## Business And Tenant Foundation

Current capability:

- Business tenant model.
- Workspace URL/subdomain concept.
- Business registration and login.
- CA registration and login.
- CA referral link between practice and business.
- Business settings and account settings.
- Default branch and warehouse foundation.

Why it matters:

The business tenant is the boundary for every record. Users, parties, products, invoices, purchases, stock, accounting, GST, and filing data belong to a business.

## Organization Foundation

Current capability:

- GST registrations.
- Locations.
- Branches.
- Warehouses.
- Branch users.
- Warehouse ownership and storage model.

Why it matters:

GSTFY can support both one-shop businesses and multi-branch businesses without changing the core data model.

## Party Master

Current capability:

- Party identity.
- Customer and supplier profiles.
- Multi-GSTIN support.
- GSTIN registered-address mapping.
- Addresses, contacts, bank accounts, documents, and audit timeline.
- Party ledger and outstanding projection.
- Duplicate protection for GSTIN.
- Soft archive.

Why it matters:

Party data feeds sales, purchases, ITC, GST reports, payments, and CA review.

## Product Master

Current capability:

- Products and services.
- SKU generation.
- HSN/SAC search.
- GST rate and cess rule selection.
- Pricing, margin, tax mode, and final price preview.
- Product images through Cloudflare R2.
- Category and brand creation.
- Barcode support.
- Inventory defaults.

Why it matters:

Products are the bridge between billing, tax, purchase, and stock.

## Tax Engine

Current capability:

- Centralized GST calculation.
- CGST/SGST for intra-state.
- IGST for inter-state.
- Tax snapshots.
- Product and party tax context.
- Cess foundation.

Why it matters:

Tax logic must not be duplicated in sales, purchases, POS, or returns.

## Sales And POS

Current capability:

- Sales workspace.
- POS billing page.
- Product search and bill lines.
- Customer selection or typed customer name.
- Payment mode capture.
- Sales invoices.
- Sales returns and credit notes.
- Sales invoice PDF rendering.

Why it matters:

Small dealers need fast billing first. GSTFY converts that billing into compliant tax and accounting output.

## Purchases

Current capability:

- Purchase bills.
- Supplier selection.
- Product and GST entry.
- Warehouse requirement for tracked goods.
- Purchase returns.
- Debit notes.
- Purchase invoice PDF rendering.

Why it matters:

Purchases create stock, payables, and ITC records.

## Accounting Engine

Current capability:

- Ledger accounts.
- Default account seeding.
- Journal entries.
- Trial balance.
- Profit and loss.
- Balance sheet.
- Day book.
- Accounting dimensions.

Why it matters:

The dealer does not need to manually manage accounting, but GSTFY still keeps proper financial records.

## Payment And Receipt Engine

Current capability:

- Receipts.
- Payments.
- Receivables.
- Payables.
- Allocation.
- Advance and unapplied handling.
- Reversal.
- Aging.
- Cash-flow.
- Bank reconciliation with statement import and auto-match.

Why it matters:

GSTFY tracks actual money movement separately from invoices and bills.

## Inventory Engine

Current capability:

- Warehouse stock.
- Item ledger.
- Opening stock.
- Adjustments.
- Transfers.
- Negative stock policy.
- Valuation method.
- Low-stock tracking.

Why it matters:

Inventory should update from business events and allow corrections where needed.

## Returns, Credit Notes, And Debit Notes

Current capability:

- Sales returns.
- Purchase returns.
- Credit notes.
- Debit notes.
- Tax, inventory, accounting, and AR/AP effects.
- Source document protection.
- Reversal and audit.

Why it matters:

Returns and notes are not just document edits. They are compliance-sensitive adjustment transactions.

## ITC And GST Reconciliation

Current capability:

- ITC tracking.
- GSTR-2B reconciliation foundation.
- Exceptions and review flow.

Why it matters:

ITC is one of the biggest GST risk areas for small businesses.

## GST Reporting And Filing

Current capability:

- GST report generation.
- GSTR-1 and GSTR-3B reporting foundation.
- Filing readiness.
- Filing payloads.
- Mock filing integration and adapter boundary.

Why it matters:

GSTFY prepares the user or CA for filing and later can connect to real provider APIs.

## E-Invoice

Current capability:

- E-invoice records.
- Eligibility checks.
- Validate, generate, status, retry, and cancel workflow.
- Provider adapter boundary.

Why it matters:

As businesses grow, e-invoice becomes mandatory for B2B invoices above the threshold.

## Frontend Experience

Current capability:

- Business dashboard.
- CA dashboard.
- Permission-aware sidebar.
- Command palette.
- Account settings.
- Settings tabs.
- Data tables with filtering, sorting, pagination, and empty states.
- Dialog-based creation and editing.
- PDF invoice viewer.

Why it matters:

The UI direction is moving toward compact, guided workflows with fewer visible decisions.

