# 03 Affinity Map

Affinity mapping groups user problems into patterns. These groups should guide product decisions.

## Cluster 1: GST Filing Fear

Observed issues:

- User does not understand GSTR-1, GSTR-3B, or GSTR-2B.
- User fears penalties and notices.
- User does not know if ITC is claimable.
- User cannot easily verify whether invoices are filing-ready.

Product response:

- GST workspace.
- GSTR summaries.
- ITC reconciliation.
- Filing readiness checks.
- AI compliance review in future.
- Plain-language warnings instead of accounting language.

## Cluster 2: Complex Accounting Language

Observed issues:

- Terms like ledger, voucher, debit, credit, payable, receivable, and journal confuse small dealers.
- Owners want business actions, not accounting setup.
- Software designed for accountants slows down the dealer.

Product response:

- Use dealer-facing labels like Money In, Money Out, Sales, Purchases, Stock.
- Hide raw accounting unless needed.
- Automatically create vouchers, journal entries, tax entries, inventory movements, and AR/AP entries.
- Keep accounting as a backend engine with simplified UI.

## Cluster 3: Daily Billing Speed

Observed issues:

- Counter billing must be fast.
- Cashier may not know GST details.
- Product search, quantity, rate, and payment mode must be easy.
- B2C sales should not require heavy party setup.

Product response:

- POS page.
- Searchable products.
- Optional customer selection.
- Auto tax split.
- Direct invoice generation.
- Cash, UPI, card, and cheque payment modes.

## Cluster 4: Product And HSN Confusion

Observed issues:

- User may not know HSN/SAC code.
- GST slab differs by product.
- Margin, inclusive/exclusive pricing, and stock tracking are unclear.
- Barcode and warehouse defaults are operational concerns.

Product response:

- Product master.
- HSN search.
- GST slab settings.
- Cess presets.
- Pricing preview.
- Barcode and SKU generation.
- Default warehouse selection.
- Product image upload through R2.

## Cluster 5: Purchase And ITC Mismatch

Observed issues:

- Supplier invoices are entered late or manually.
- ITC depends on supplier GST filing.
- Purchase returns and debit notes affect ITC.
- User does not understand GSTR-2B matching.

Product response:

- Purchase bills.
- Supplier selection.
- ITC capture.
- Purchase returns.
- Debit notes.
- ITC reconciliation engine.
- GST report integration.

## Cluster 6: Stock Visibility

Observed issues:

- Dealer knows stock only after shortage.
- Multiple branches or warehouses increase confusion.
- Opening stock, adjustment, and transfer must be controlled.
- Serial/batch tracking requires future detail.

Product response:

- Inventory engine.
- Warehouse stock table.
- Item ledger.
- Opening stock.
- Stock adjustment.
- Transfers.
- Low stock and negative stock indicators.

## Cluster 7: Payment Follow-up

Observed issues:

- Customers delay payments.
- Supplier dues are not tracked cleanly.
- Dealer may receive money before deciding invoice allocation.
- Bank statement matching is manual.

Product response:

- Receipts.
- Payments.
- Receivables.
- Payables.
- Unallocated vs advance treatment.
- Aging reports.
- Bank reconciliation with statement import and auto-match.

## Cluster 8: CA Dependency

Observed issues:

- CA must collect data from every client.
- Client does not know what is missing.
- CA wants readiness view, not raw transactions only.

Product response:

- CA login/register.
- CA dashboard.
- Client management.
- Referral codes.
- Client invite mail.
- Client summary.
- Filing readiness by client.

## Cluster 9: Trust And Audit

Observed issues:

- Users worry that edited master data may change old bills.
- Staff needs restricted access.
- Deleted parties/products should not break history.

Product response:

- Historical snapshots.
- Soft archive.
- Tenant isolation.
- Users and roles.
- Branch-level access.
- Audit logs.
- Immutable posted documents.

