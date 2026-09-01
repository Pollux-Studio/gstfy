# 08 Product Principles

These principles should guide every GSTFY feature decision.

## 1. GST First

GSTFY is not a generic accounting system first. GST compliance is the main reason the product exists.

Every core workflow should answer:

- Does this help create valid GST data?
- Does this reduce filing effort?
- Does this prevent mistakes before filing?

## 2. Dealer Language Over Accountant Language

Use terms the business owner understands:

- Sales instead of sales ledger.
- Money In instead of receipts module when possible.
- Money Out instead of payment voucher.
- Stock instead of inventory valuation unless needed.
- GST Review instead of compliance exception engine.

Accounting can exist under the hood.

## 3. Automate The Backend Effects

When the user posts a business document, GSTFY should create the related effects automatically:

```text
Sales bill
-> Tax entry
-> Accounting voucher
-> Receivable or receipt
-> Inventory movement
-> GST report row
```

The user should not manually repeat the same business fact in multiple places.

## 4. Hide What The User Cannot Use

If a module is not available by plan or permission, hide it from navigation. Do not clutter the UI with locked modules.

This applies to:

- Sidebar.
- Command palette.
- Module actions.
- Settings.

## 5. Preserve History

Posted documents must remain historically accurate even if master data changes later.

Use snapshots for:

- Party details.
- Product details.
- GST registration.
- Tax profile.
- Branch and warehouse context.
- Invoice settings where needed.

## 6. Soft Archive, Do Not Break Records

Business masters should not be physically deleted when they can affect history.

Archive instead of hard-delete:

- Parties.
- Products.
- Users.
- GST registrations.
- Addresses and child records where applicable.

## 7. Progressive Disclosure

Small users should see only the fields needed for the current task. Advanced data should appear only when needed.

Examples:

- Basic product first, then tax/pricing/inventory tabs.
- Party identity first, then addresses, GSTINs, contacts, bank accounts.
- Money overview first, then receipts, payments, receivables, payables, reconciliation.

## 8. Compliance Warnings Must Be Clear

Do not show raw technical or accounting errors to users.

Use clear messages:

- "This GSTIN state does not match the selected address."
- "Tracked goods require a warehouse."
- "This purchase is not matched in GSTR-2B yet."
- "This return cannot exceed the original quantity."

## 9. CA And Self-Service Must Coexist

The same business data should support:

- Owner filing independently.
- CA reviewing and filing for the client.
- Switching from CA-managed to self-service or self-service to CA-managed.

Do not create separate data models for CA clients and self-service users.

## 10. Simple First, Powerful Later

GSTFY can have powerful engines, but the user experience must remain simple.

The product should feel small and focused even when the backend is strong.

