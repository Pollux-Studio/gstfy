# Parties Complete Summary

Last updated: 2026-08-17

This document summarizes the Parties Engine completion work. It is a change summary companion to:

```text
docs/engine/parties/parties-complete.md
docs/engine/parties/parties-section-flow.md
```

## 1. Goal

The Parties section was upgraded from a simple customer/supplier list into GSTfy's tenant-scoped external-party master.

The module now supports:

```text
Party identity
Customer role
Supplier role
Multiple GST registrations
GSTIN registered-address mapping
Multiple addresses
Multiple contacts
Multiple bank accounts
Document vault
Audit timeline
Payment terms
Commercial defaults
Accounting references
Outstanding summary
Party ledger
Duplicate warnings
Historical transaction snapshots
Archive safety
Paged list loading
```

The core rule is unchanged:

```text
One external person/business = one Party.
Customer and Supplier are roles on that Party, not separate master records.
```

## 2. Main Files Changed

Backend:

```text
apps/backend/src/modules/parties/parties.routes.ts
apps/backend/src/modules/parties/parties.schemas.ts
apps/backend/src/modules/pos/pos.routes.ts
apps/backend/src/modules/pos/pos.schemas.ts
apps/backend/src/db/schema/index.ts
```

Frontend:

```text
apps/web/app/(dashboard)/parties/[partyId]/ledger/page.tsx
apps/web/components/parties/parties-page.tsx
apps/web/components/parties/party-detail-dialog.tsx
apps/web/components/parties/party-form-dialog.tsx
apps/web/components/parties/party-ledger-page.tsx
apps/web/components/parties/party-types.ts
apps/web/components/parties/party-utils.ts
apps/web/lib/parties/api.ts
```

Migrations:

```text
apps/backend/drizzle/0024_party_profile_image_seed.sql
apps/backend/drizzle/0025_party_master_hardening.sql
apps/backend/drizzle/0026_pos_party_snapshot_payment_terms.sql
apps/backend/drizzle/0027_party_payment_term_fk.sql
apps/backend/drizzle/0028_party_master_integrity_constraints.sql
apps/backend/drizzle/0029_party_delete_restrict.sql
apps/backend/drizzle/0030_party_gst_registered_address.sql
apps/backend/drizzle/0031_party_documents_audit.sql
```

Docs:

```text
docs/engine/parties/parties-section-flow.md
docs/engine/parties/parties-complete.md
docs/engine/parties/parties-complete-summary.md
```

## 3. Party Identity

The Party master now represents the long-lived external-party identity.

Implemented fields include:

```text
display_name
party_type
legal_name
trade_name
short_name
PAN
status
notes
profile_image_seed
```

The frontend supports individual and business-style parties differently:

```text
Individual party:
  legal name/trade name/PAN are optional and simplified.

Business/government/other party:
  legal/trade/PAN fields remain available.
```

The profile image seed allows deterministic Dicebear-style avatars without storing image blobs in the database.

## 4. Customer and Supplier Roles

Customer and Supplier are role profiles on a Party.

Implemented:

```text
party_customer_profiles
party_supplier_profiles
```

Role removal is now safe:

```text
Remove customer role  -> customer profile status = inactive
Remove supplier role  -> supplier profile status = inactive
```

The profile row is not deleted. This preserves historical sales, purchases, AR/AP entries, and reports.

## 5. Multiple GST Registrations

Parties now support multiple GST registrations instead of only one primary GSTIN.

Each GST registration supports:

```text
GSTIN
legal name
trade name
registration type
taxpayer type
state code
state
effective from
effective to
status
primary flag
registered address mapping
```

Supported registration types:

```text
gst
composition
uin
```

Implemented actions:

```text
Add GSTIN
Edit GSTIN
Archive GSTIN
Set primary GSTIN
Clear registered-address mapping
```

Rules enforced:

```text
GSTIN must be unique in the business.
GSTIN first two digits must match state code.
Only one active primary GSTIN is allowed per party.
Archived GSTINs cannot be selected for new normal transactions.
```

## 6. GSTIN Registered Address Mapping

A GSTIN can now point to the exact registered address printed on that GST certificate.

Example:

```text
ABC Traders
  Addresses:
    Chennai Registered Office
    Bangalore Registered Office

  GST registrations:
    TN GSTIN -> Chennai Registered Office
    KA GSTIN -> Bangalore Registered Office
```

The database now stores:

```text
party_gst_registrations.registered_address_id
```

Validation:

```text
registered_address_id must belong to the same party.
registered_address_id must belong to the same business.
address must be active.
address state code must match GSTIN state code when present.
```

This separates GST registered address from:

```text
billing address
shipping address
office address
warehouse address
party primary address
```

## 7. Address Management

Parties now support multiple addresses.

Supported address types:

```text
registered
billing
shipping
office
warehouse
other
```

The Add/Edit Party form collects addresses before GST registrations so the GSTIN selector can map each GSTIN to a valid registered address.

Database hardening ensures:

```text
Only one active primary address per party.
Address references are party/business scoped.
GSTIN registered-address FK is restricted.
```

## 8. Contact Management

Parties now support multiple contacts.

Contact fields:

```text
name
designation
email
phone
mobile
contact role
primary flag
status
```

Implemented UI behavior:

```text
Add multiple contacts.
Edit existing contacts.
Archive inactive contacts.
Use GSTfy Indian phone input style for mobile fields.
Maintain one active primary contact.
```

## 9. Bank Account Management

Parties now support multiple bank accounts.

Implemented:

```text
bank name
account name
account number hash
account number last4
IFSC
branch
account type
primary flag
status
```

Security rule:

```text
Raw account number is never returned to the frontend.
Only masked/last4 account information is displayed.
```

Important boundary:

```text
Party bank accounts are not business ledger bank accounts.
Business cash/bank accounts belong to Accounting and Payment/Receipt engines.
```

## 10. Payment Terms

Payment terms were moved to a real tenant-scoped master.

Implemented:

```text
payment_terms
default_payment_term_id on customer profile
default_payment_term_id on supplier profile
```

Seeded terms:

```text
Immediate
Net 7
Net 15
Net 30
Net 45
```

The previous free-text/default term code path was backfilled to FK IDs.

## 11. Commercial Terms

The Party UI and backend now preserve commercial defaults for both roles.

Customer profile:

```text
customer code
credit limit
credit days
default payment term
default billing address
default shipping address
default GST registration
```

Supplier profile:

```text
supplier code
credit days
default payment term
default purchase address
default GST registration
preferred warehouse
lead time days
```

## 12. Accounting References

Party accounting profile references now point to ledger accounts using UUID FKs instead of text IDs.

Supported references:

```text
receivable_account_id
payable_account_id
advance_receipt_account_id
advance_payment_account_id
```

Database guarantees:

```text
The referenced ledger account belongs to the same business.
```

Accounting Engine remains responsible for semantic validation, such as ensuring a receivable account is actually a receivable/control account.

## 13. Duplicate Detection

Implemented duplicate suggestion support.

Hard blocks:

```text
same GSTIN in same business
same customer code in same business
same supplier code in same business
```

Warning suggestions:

```text
same/similar display name
same PAN
same email
same mobile
```

The UI shows duplicate warnings but does not auto-merge parties.

Backend endpoint:

```text
GET /api/v1/parties/duplicates
```

## 14. Party Detail Workspace

The party detail dialog now behaves like a compact workspace.

Implemented sections:

```text
Overview
GST
Addresses
Contacts
Bank
Commercial
Ledger
More
```

The GST manager is inline inside the detail dialog and supports:

```text
add
edit
archive
set primary
registered-address selection
effective date fields
```

The Addresses tab shows GSTIN mappings so users can see which address belongs to which GST registration.

## 15. Party Ledger Page

Implemented route:

```text
/parties/[partyId]/ledger
```

Backend endpoint:

```text
GET /api/v1/parties/:id/ledger
```

The ledger is derived from:

```text
receivable_payable_entries
```

It shows:

```text
voucher reference
entry type
original amount
settled amount
outstanding amount
due date
status
receivable total
payable total
net outstanding
```

Important rule:

```text
Party balances are not stored on the Party row.
Balances are derived from accounting AR/AP entries.
```

## 16. Outstanding and Aging

Party detail now exposes derived outstanding values:

```text
receivable
payable
overdue receivable
overdue payable
open receivable count
open payable count
```

Aging buckets are shown in the workspace from derived AR/AP data.

The Party module does not own settlement. Payment/Receipt Engine will own allocations.

## 17. POS Snapshot Safety

POS now stores a party snapshot directly on the sale.

Implemented:

```text
pos_sales.party_id
pos_sales.party_snapshot
```

Why this matters:

```text
If the party is renamed, edited, or archived later,
old POS receipts still retain the original party identity snapshot.
```

The accounting voucher also keeps its own `party_snapshot`.

## 18. Archive and Delete Safety

Application delete is soft archive only:

```text
DELETE /api/v1/parties/:id
  -> parties.status = archived
```

Database hard-delete protection was added:

```text
party child foreign keys use restrictive deletion behavior.
hard deleting a party with dependent data is blocked.
```

Archived parties:

```text
remain visible in historical records
cannot be selected for new normal sales/purchases/POS
```

## 19. Database Integrity Hardening

Implemented database-level safety:

```text
UNIQUE parties(id, business_id)
UNIQUE party role profile per business/party
UNIQUE GSTIN per business
UNIQUE active primary GSTIN per party
UNIQUE active primary address per party
UNIQUE active primary contact per party
UNIQUE non-archived primary bank account per party
Composite FK child rows -> parties(id, business_id)
Composite FK GST registered address -> party_addresses(id, party_id, business_id)
Composite FK default GST/address/payment term references
Composite FK branch and warehouse references
Composite FK ledger account references
```

GST effective dates were converted to proper database dates.

## 20. Parties List Pagination

The Parties list now uses paginated loading.

Backend:

```text
GET /api/v1/parties
```

Default:

```text
page = 1
limit = 15
```

Response includes:

```text
parties[]
pagination.page
pagination.limit
pagination.total
pagination.hasMore
```

Frontend behavior:

```text
Initial render loads 15 parties.
When the table scroll reaches the bottom, the next page is requested.
Loaded rows are appended.
The table remains scroll-contained.
```

This prevents loading the full party master upfront for large tenants.

## 21. API Summary

Implemented/updated APIs:

```text
GET    /api/v1/parties
POST   /api/v1/parties
GET    /api/v1/parties/duplicates
GET    /api/v1/parties/:id
PATCH  /api/v1/parties/:id
DELETE /api/v1/parties/:id
GET    /api/v1/parties/:id/ledger
GET    /api/v1/parties/:id/audit

GET    /api/v1/parties/:id/gst-registrations
POST   /api/v1/parties/:id/gst-registrations
PATCH  /api/v1/parties/:id/gst-registrations/:registrationId
DELETE /api/v1/parties/:id/gst-registrations/:registrationId

GET    /api/v1/parties/:id/addresses
POST   /api/v1/parties/:id/addresses
PATCH  /api/v1/parties/:id/addresses/:addressId
DELETE /api/v1/parties/:id/addresses/:addressId

GET    /api/v1/parties/:id/contacts
POST   /api/v1/parties/:id/contacts
PATCH  /api/v1/parties/:id/contacts/:contactId
DELETE /api/v1/parties/:id/contacts/:contactId

GET    /api/v1/parties/:id/bank-accounts
POST   /api/v1/parties/:id/bank-accounts
PATCH  /api/v1/parties/:id/bank-accounts/:bankAccountId
DELETE /api/v1/parties/:id/bank-accounts/:bankAccountId

GET    /api/v1/parties/:id/documents
POST   /api/v1/parties/:id/documents
PATCH  /api/v1/parties/:id/documents/:documentId
DELETE /api/v1/parties/:id/documents/:documentId

POST   /api/v1/parties/:id/customer
PATCH  /api/v1/parties/:id/customer
POST   /api/v1/parties/:id/supplier
PATCH  /api/v1/parties/:id/supplier

GET    /api/v1/payment-terms
POST   /api/v1/payment-terms
```

## 22. Frontend UX Summary

Implemented:

```text
Compact Parties page
Search
Role filter
Status filter
Sortable table headers
Bulk select
Bulk activate/inactivate
Bulk archive
Scroll-contained table
Infinite pagination
Add Party dialog
Edit Party dialog
View Party detail workspace
Inline GST manager
Inline address/contact/bank collections
Document vault tab
Audit timeline tab
Duplicate warning panel
Party ledger page
Archive confirmation
Masked bank account display
Indian phone input for contacts
```

## 23. Transaction Integration Safety

Sales:

```text
sales_invoices.party_id
sales_invoices.party_snapshot
vouchers.party_snapshot
receivable_payable_entries.party_snapshot
```

Purchases:

```text
purchase_bills.party_id
purchase_bills.supplier_snapshot
vouchers.party_snapshot
receivable_payable_entries.party_snapshot
```

POS:

```text
pos_sales.party_id
pos_sales.party_snapshot
vouchers.party_snapshot
receivable_payable_entries.party_snapshot
```

This makes historical documents stable even if party master data changes later.

## 24. Known Intentional Limitations

These are not blockers for current use:

```text
No government GSTN API verification yet.
No transaction drill-down rows until transaction engines are fully connected.
No automatic duplicate merge.
No Payment/Receipt allocation UI yet.
```

The UI must not label GSTINs as government verified until real GSTN API verification exists.

Document support is complete at the Party module level as document metadata plus a secured file reference. Raw file bytes are not stored in the Party tables. A future storage adapter can generate the `file_reference` using R2/S3 or another secured object store.

## 25. Verification

Validation performed for the implementation pass:

```bash
pnpm --filter @gstfy/backend check-types
pnpm --filter @gstfy/backend lint
pnpm --filter web typecheck
pnpm --filter web exec eslint components/parties/parties-page.tsx components/parties/party-detail-dialog.tsx components/parties/party-form-dialog.tsx components/parties/party-ledger-page.tsx components/parties/party-types.ts components/parties/party-utils.ts lib/parties/api.ts
git diff --check
```

For the latest pagination pass, the broader touched-file validation also passed:

```bash
pnpm --filter @gstfy/backend check-types
pnpm --filter @gstfy/backend lint
pnpm --filter web typecheck
git diff --check
```

## 26. Final Status

Current status:

```text
Party identity                  complete
Customer/Supplier profiles      complete
Role soft-inactivation          complete
Multi-GSTIN                     complete
GSTIN registered address        complete
Multiple addresses              complete
Multiple contacts               complete
Multiple bank accounts          complete
Document vault                  complete
Audit timeline                  complete
Payment-term FK                 complete
Duplicate suggestion UX         complete
Party ledger                    complete
Outstanding summary             complete
POS party snapshot              complete
Tenant database integrity       complete
Hard-delete protection          complete
Parties list pagination         complete
```

The Parties Engine is ready to be used as the master dependency for:

```text
Sales
Purchases
POS
Payment/Receipt
GST reconciliation
CA review
GST reports
```

The next logical engine after Parties is still:

```text
Payment / Receipt Engine
```
