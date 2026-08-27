# 10 Roadmap And Open Gaps

This document separates current capability from future product work.

## Current Strong Foundation

GSTFY already has the major internal engines needed for a GST-first business platform:

- Business and tenant foundation.
- CA and business auth paths.
- Party Master.
- Product Master.
- Tax Engine.
- Sales and POS.
- Purchase Management.
- Accounting Engine.
- Payment and Receipt Engine.
- Inventory Engine.
- Returns, Credit Notes, and Debit Notes.
- ITC and GST reconciliation.
- GST reporting and filing integration foundation.
- E-invoice foundation.

## Gaps Before Public Production

### GSTN And Provider Integrations

Needed:

- Real GSTIN verification provider.
- Real GST filing provider or GSP integration.
- Real e-invoice IRP integration.
- Real e-way bill integration.

Current state:

- Adapter boundaries and mock/integration-ready flows exist.
- Production credentials and provider-specific behavior are still needed.

### AI Filing Review

Needed:

- Structured pre-filing review pipeline.
- Claude API integration.
- Findings schema.
- Safe-to-file report UI.
- Prompt and response validation.

Current state:

- Product concept is defined.
- Engine-level GST reporting and exception data can feed the future AI review.

### E-Way Bill

Needed:

- E-way bill generation from eligible goods invoices.
- Transporter details.
- Vehicle number.
- Distance and validity logic.
- Part A and Part B handling.

Current state:

- Not a complete module yet.

### WhatsApp And Notifications

Needed:

- WhatsApp invoice delivery.
- Payment reminders.
- Filing reminders.
- CA/client reminders.

Current state:

- Product need is clear.
- Integration is future work.

### Subscription And Billing

Needed:

- Razorpay subscription integration.
- Plans and limits.
- Trial and renewal logic.
- CA partner pricing.

Current state:

- Pricing model exists in product assumptions.
- Billing engine is future work.

### Mobile And Offline POS

Needed:

- Mobile login.
- Mobile POS.
- Offline billing queue.
- Sync conflict handling.
- Thermal print support.

Current state:

- Mobile app was started separately, but web remains the main product focus.

### Advanced Bank Reconciliation

Needed:

- Better statement parsing across bank formats.
- Match suggestions with confidence.
- Reconciliation difference handling.
- Statement import history.

Current state:

- Statement import and auto-match foundation exists.

### Advanced Party Features

Future:

- GSTN API verification.
- Fuzzy duplicate merge suggestions.
- More complete party ledger drill-down.
- Bank document verification.

Current state:

- Party Master is structurally strong.

### Advanced Inventory

Future:

- Batch identity UI.
- Serial identity UI.
- Manufacturing and assembly flows.
- Stock audit reports.

Current state:

- Warehouse stock, ledger, adjustment, transfer, and policy foundation exists.

## Strategic Roadmap

### Phase 1: Dealer MVP

Goal:

Make a small business able to create bills, purchases, products, parties, payments, and GST summaries.

Key modules:

- Business registration.
- Sales/POS.
- Purchases.
- Products.
- Parties.
- Payments.
- GST report preview.
- Invoice PDFs.

### Phase 2: GST Confidence

Goal:

Make the owner confident enough to file or share final-ready data with a CA.

Key modules:

- ITC reconciliation.
- GST reporting.
- Filing readiness.
- AI filing review.
- Exception resolution.
- Export-ready reports.

### Phase 3: CA Partner Network

Goal:

Allow CAs to onboard and manage many small clients.

Key modules:

- CA dashboard.
- Referral codes.
- Client filing readiness.
- Bulk review.
- Client exports.

### Phase 4: Growth Modules

Goal:

Support growing businesses with advanced compliance and operations.

Key modules:

- E-invoice.
- E-way bill.
- Multi-GSTIN workflows.
- Advanced inventory.
- Bank reconciliation v2.
- Subscription billing.

## Product Risk To Avoid

GSTFY should not become another complex accounting suite.

Every roadmap feature should pass this test:

```text
Does this reduce dealer work or GST filing anxiety?
```

If the answer is no, it should not be visible in the main dealer workflow.

