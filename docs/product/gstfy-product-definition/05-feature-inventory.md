# 05 Feature Inventory

This document lists the GSTFY feature surface as currently built or planned.

## Authentication And Tenant Access

- Business login.
- Business registration.
- CA login.
- CA registration.
- Forgot password and reset password flow.
- Refresh token based session continuation.
- Access-token expiry redirect.
- Tenant-aware business login.
- Business subdomain/workspace URL.
- CA common dashboard domain concept.
- Account avatar seed generation.
- Account settings.
- Password change.
- Login history display.

## Business Setup

- GSTIN-based onboarding.
- Business profile.
- Principal address.
- Registration date handling.
- Nature of possession.
- Business contact details.
- CA referral code verification.
- Workspace URL generation and locking.
- Default branch.
- Default warehouse.
- Invoice prefix and next number settings.
- Invoice template settings.
- Invoice watermark settings.

## CA Workspace

- CA practice registration.
- CA login.
- CA dashboard.
- Client list.
- Referral code generation.
- Invite email through SMTP.
- Client summary.
- Client filing readiness.
- CA account settings.

## Users And Roles

- User creation inside a tenant.
- Owner, admin, cashier, manager, accountant, operations, and custom roles.
- Branch access.
- Module permissions.
- View, create, edit, delete action permissions.
- Owner self-permission protection.
- First-login password reset for staff.
- Disabled or archived user behavior.
- Table search, filters, sorting, and bulk actions.

## Branches, Locations, And Warehouses

- Add branch flow.
- Branch type.
- Branch GST registration relationship.
- Storage model selection.
- Warehouse creation.
- Default warehouse.
- Branch-level access logic.
- Inventory warehouse selection.

## Party Management

- Customers and suppliers in one Party Master.
- Individual and business party types.
- Multi-role parties: customer, supplier, or both.
- Multiple GST registrations per party.
- GSTIN to registered address mapping.
- Multiple addresses.
- Multiple contacts.
- Multiple bank accounts.
- Customer profile.
- Supplier profile.
- Payment terms.
- Duplicate detection and hard GSTIN duplicate blocking.
- Archive instead of hard delete.
- Party ledger and AR/AP summary.
- Party documents.
- Party audit timeline.
- Pagination and table filters.

## Product Management

- Product master.
- Goods and service item types.
- Auto-generated SKU.
- Barcode generation and manual barcode entry.
- Product image upload to Cloudflare R2.
- Category and brand creation.
- Manufacturer and model fields.
- HSN/SAC search.
- GST tax profile.
- GST slab selection from settings.
- Cess rules from settings.
- Tax inclusive and exclusive pricing.
- Margin calculation.
- Final price preview.
- Unit profile.
- Inventory profile.
- Default warehouse selection.
- Reorder level, minimum stock, maximum stock.
- Batch and serial tracking flags.
- Product detail tabs.
- Product table search, filters, sorting, column controls, bulk archive, and export.

## Sales And POS

- Sales workspace.
- POS full-page counter billing.
- Customer search or typed customer name.
- Product search and selection.
- Quantity and rate entry.
- GST calculation.
- Cash, UPI, card, and cheque payment modes.
- Amount received defaulting from calculated total.
- Sales invoice creation.
- Sales returns.
- Credit notes.
- Sales invoice PDF viewer.
- Dedicated sales invoice PDF template.
- Invoice download.

## Purchase Management

- Purchase workspace.
- Purchase bill creation.
- Supplier search.
- Supplier invoice number and date.
- Product selection.
- Place of supply.
- GST slab selection.
- CGST/SGST/IGST calculation.
- Warehouse requirement for tracked goods.
- Purchase returns.
- Debit notes.
- Purchase invoice PDF viewer and download.
- Purchase invoice template.

## Tax Engine

- Central GST calculation.
- CGST and SGST split for intra-state.
- IGST for inter-state.
- GST rate validation.
- Taxability handling.
- Place of supply handling.
- Product and party tax context.
- Tax snapshots on documents.
- Cess foundation.

## Accounting Engine

- Chart of accounts.
- System default account seeding.
- Ledger accounts.
- Journal entries.
- Trial balance.
- Profit and loss.
- Balance sheet.
- Day book.
- Accounting dimensions: branch, GST registration, warehouse, party.
- Posted voucher immutability.
- Accounting reports with filters.
- Excel and PDF export areas.

## Payment And Receipt Engine

- Receipts.
- Payments.
- Receivables.
- Payables.
- Allocation against open AR/AP entries.
- Advance vs unapplied handling.
- Reversal workflow.
- Aging report.
- Cash-flow report.
- Bank reconciliation.
- Bank statement import.
- Auto-match.
- Manual match and undo reconciliation.
- Detail pages for receipts and payments.
- Export support.
- Idempotency and concurrency protection.

## Inventory Engine

- Warehouse-level stock.
- Item ledger.
- Opening stock.
- Stock adjustment.
- Stock transfers.
- Dispatch and receive transfer flow.
- Negative stock policy.
- Valuation method.
- Low-stock tracking.
- Stock value summary.
- Sortable inventory tables.

## Returns, Credit Note, And Debit Note Engine

- Sales return.
- Purchase return.
- Credit note.
- Debit note.
- Source document linkage.
- Inventory effect.
- Tax adjustment.
- Accounting adjustment.
- AR/AP adjustment.
- Reversal.
- Settlement visibility.
- Detail pages.
- Concurrency protection.

## ITC And GST Reconciliation

- ITC register.
- GSTR-2B import/reconciliation foundation.
- Supplier GST and purchase matching.
- Eligible, ineligible, blocked, and mismatch handling.
- GST reconciliation exceptions.
- Review workflow.

## GST Reporting And Filing

- GSTR-1 reporting.
- GSTR-3B reporting.
- GST reporting exceptions.
- Filing readiness.
- Filing payload generation.
- Mock filing integration.
- Filing attempts and status.
- JSON/export foundation.
- CA review connection.

## E-Invoice

- E-invoice engine foundation.
- Eligibility checks.
- IRN request model.
- Validation workflow.
- Generate, status, retry, and cancel flows.
- Adapter boundary for real GSP/IRP integration.

## Dashboard And Navigation

- Business overview dashboard.
- CA dashboard.
- Revenue statistic chart.
- Report mix chart.
- Low-stock tables.
- Recent activity tables.
- Command palette.
- Permission-aware sidebar.
- Account and notification header controls.

## Exports And Documents

- Invoice PDFs.
- Purchase invoice PDFs.
- Sales invoice PDFs.
- Report export areas.
- Product image storage through R2.
- Party documents.
- Bank statement import.

