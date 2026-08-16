# Parties Section Flow

Last updated: 2026-08-17

This document describes the currently implemented Parties section in GSTFY. It is an implementation reference for frontend flow, backend flow, database tables, transaction safety, and remaining gaps.

For the original product/domain spec, see `docs/party-master.md`.

## 1. Purpose

The Parties section is the tenant-scoped master for every external customer and supplier.

GSTFY uses one shared party identity:

```text
Party
  -> Customer profile, optional
  -> Supplier profile, optional
  -> GST registrations, optional and multiple
  -> Addresses, optional and multiple
  -> Contacts, optional and multiple
  -> Bank accounts, optional and multiple
```

A party can be:

```text
customer
supplier
customer + supplier
```

The implementation must not create separate customer and supplier rows for the same external business/person. Role-specific details live in profile tables.

## 2. Main Files

Frontend:

```text
apps/web/app/(dashboard)/parties/page.tsx
apps/web/components/parties/parties-page.tsx
apps/web/lib/parties/api.ts
apps/web/lib/pos/api.ts
```

Backend:

```text
apps/backend/src/modules/parties/parties.routes.ts
apps/backend/src/modules/parties/parties.schemas.ts
apps/backend/src/modules/payment-terms/payment-terms.routes.ts
apps/backend/src/modules/pos/pos.routes.ts
apps/backend/src/modules/accounting/accounting-domain.service.ts
apps/backend/src/db/schema/index.ts
```

Migrations:

```text
apps/backend/drizzle/0012_party_master_foundation.sql
apps/backend/drizzle/0024_party_profile_image_seed.sql
apps/backend/drizzle/0025_party_master_hardening.sql
apps/backend/drizzle/0026_pos_party_snapshot_payment_terms.sql
apps/backend/drizzle/0027_party_payment_term_fk.sql
apps/backend/drizzle/0028_party_master_integrity_constraints.sql
apps/backend/drizzle/0029_party_delete_restrict.sql
```

## 3. Database Tables

### `parties`

Tenant-scoped party identity.

```text
id
business_id
party_type
display_name
legal_name
trade_name
short_name
pan
profile_image_seed
status
notes
created_by
updated_by
created_at
updated_at
```

Supported `party_type`:

```text
business
individual
government
other
```

Supported party `status`:

```text
active
inactive
blocked
archived
```

Important behavior:

- Parties are never hard-deleted by the UI/API.
- Archive means `status = archived`.
- Database foreign keys restrict hard deletion of parties that have child master data.
- Archived parties remain available for historical snapshots and reports.
- Archived parties are blocked for new sales, purchases, and POS checkout.
- `profile_image_seed` renders the party avatar using Dicebear.

### `party_customer_profiles`

Customer role profile.

```text
party_id
business_id
customer_code
credit_limit
credit_days
default_payment_term_id
default_billing_address_id
default_shipping_address_id
default_gst_registration_id
price_group_id
sales_rep_id
status
created_at
updated_at
```

Important behavior:

- One customer profile per `(business_id, party_id)`.
- Removing the customer role does not delete the row.
- Removing the customer role sets `status = inactive`.
- Re-adding the customer role sets `status = active`.
- Historical sales, AR entries, and reports continue to reference the preserved profile/snapshot.

### `party_supplier_profiles`

Supplier role profile.

```text
party_id
business_id
supplier_code
credit_days
default_payment_term_id
default_purchase_address_id
default_gst_registration_id
preferred_warehouse_id
lead_time_days
status
created_at
updated_at
```

Important behavior:

- One supplier profile per `(business_id, party_id)`.
- Removing the supplier role does not delete the row.
- Removing the supplier role sets `status = inactive`.
- Re-adding the supplier role sets `status = active`.
- Historical purchases, AP entries, and reports continue to reference the preserved profile/snapshot.

### `party_gst_registrations`

Party GSTIN collection.

```text
id
business_id
party_id
gstin
legal_name
trade_name
registration_type
taxpayer_type
state_code
state
effective_from
effective_to
status
is_primary
created_at
updated_at
```

Supported `registration_type`:

```text
gst
composition
uin
```

Supported GST registration `status`:

```text
active
inactive
cancelled
suspended
archived
```

Important behavior:

- A party can have multiple GST registrations.
- `effective_from` and `effective_to` are stored as database `date` values.
- GSTIN is optional for unregistered parties.
- GSTIN format is validated before save.
- GSTIN first two digits must match `state_code`.
- GSTIN is unique per business.
- Only one non-archived primary GST registration is allowed per party.
- Create-party UI can create the first primary GSTIN.
- Party detail UI manages the GSTIN collection: add, edit, archive, and set primary.
- Edit-party UI no longer exposes a destructive global GST toggle for existing GSTINs.

### `party_addresses`

Party address collection.

```text
id
business_id
party_id
address_type
label
address_line_1
address_line_2
locality
city
district
state
state_code
pincode
country
is_primary
is_active
created_at
updated_at
```

Current UI behavior:

- Add/edit party form manages one primary billing address.
- Backend supports multiple addresses.
- Clearing address fields during edit archives the existing primary address by setting `is_active = false` and `is_primary = false`.
- Database hardening allows only one active primary address per party.

### `party_contacts`

Party contact collection.

```text
id
business_id
party_id
name
designation
email
phone
mobile
contact_role
is_primary
status
created_at
updated_at
```

Current UI behavior:

- Add/edit party form manages one primary contact.
- Backend supports multiple contacts.
- Mobile input uses the GSTFY Indian phone input pattern.
- Clearing contact fields during edit archives the existing primary contact by setting `status = inactive` and `is_primary = false`.
- Database hardening allows only one active primary contact per party.

### `party_bank_accounts`

Party bank account collection.

```text
id
business_id
party_id
bank_name
account_name
account_number_hash
account_number_last4
ifsc
branch
account_type
is_primary
status
created_at
updated_at
```

Current behavior:

- Backend supports party bank accounts.
- UI does not yet expose full bank account management.
- Account numbers are not returned raw; masked/last4 values are exposed.
- Database hardening allows only one non-archived primary bank account per party.

### `receivable_payable_entries`

Accounting AR/AP source used to derive party outstanding.

```text
id
business_id
voucher_id
party_id
party_name_snapshot
party_snapshot
entry_type
original_amount
settled_amount
outstanding_amount
due_date
status
created_at
updated_at
```

Current party detail API derives:

```text
receivable
payable
overdue_receivable
overdue_payable
open_receivable_count
open_payable_count
```

Important rule:

- Outstanding is not stored on `parties`.
- Outstanding is derived from open accounting entries.

### `pos_sales`

POS sale header.

Current party-related columns:

```text
party_id
party_snapshot
customer_name
```

Important behavior:

- POS checkout resolves the party through `getPartySnapshot()`.
- `pos_sales.party_snapshot` stores the historical party copy on the POS sale itself.
- The accounting voucher also stores its own party snapshot.
- Posted POS receipts remain stable if the party is later renamed, edited, or archived.

### `payment_terms`

Payment terms master foundation.

```text
id
business_id
code
name
days
due_date_rule
status
is_system
created_at
updated_at
```

Default seeded terms:

```text
immediate -> Due on receipt
7_days   -> Net 7
15_days  -> Net 15
30_days  -> Net 30
45_days  -> Net 45
```

Current behavior:

- API exists at `/api/v1/payment-terms`.
- Terms are tenant-scoped.
- Party customer/supplier profiles reference terms through `default_payment_term_id`.
- Legacy `default_payment_term` term codes are backfilled to IDs by `0027_party_payment_term_fk.sql`.
- Branch party profiles use `payment_term_id`; legacy branch term codes are backfilled by `0028_party_master_integrity_constraints.sql`.

## 4. Database Hardening

Implemented hardening from `0025_party_master_hardening.sql`:

```text
UNIQUE party_customer_profiles(business_id, party_id)
UNIQUE party_supplier_profiles(business_id, party_id)
UNIQUE active primary party_gst_registrations per party
UNIQUE active primary party_addresses per party
UNIQUE active primary party_contacts per party
UNIQUE non-archived primary party_bank_accounts per party
```

Implemented hardening from `0028_party_master_integrity_constraints.sql`:

```text
UNIQUE parties(id, business_id)
UNIQUE business_branches(id, business_id)
UNIQUE warehouses(id, business_id)
UNIQUE ledger_accounts(id, business_id)
UNIQUE payment_terms(id, business_id)
UNIQUE party_gst_registrations(id, business_id)
UNIQUE party_gst_registrations(id, party_id, business_id)
UNIQUE party_addresses(id, business_id)
UNIQUE party_addresses(id, party_id, business_id)
FK child party rows -> parties(id, business_id)
FK default GST/address/payment-term references -> same party/business context
FK preferred warehouse -> warehouses(id, business_id)
FK accounting profile ledger accounts -> ledger_accounts(id, business_id)
FK branch profile branch/address/payment-term -> same business/party context
party_gst_registrations.effective_from/effective_to converted to DATE
party_accounting_profiles account references converted from text to UUID
```

Implemented hardening from `0029_party_delete_restrict.sql`:

```text
Party child FKs to parties use ON DELETE RESTRICT.
Hard deleting a party with GST/address/contact/bank/profile/branch child records is blocked.
Soft archive remains the only supported application delete path.
```

Implemented hardening in backend code:

- GSTIN duplicate is blocked per business.
- GSTIN state code must match GSTIN first two digits.
- Customer/supplier default GST/address/warehouse references must belong to the same business and party context.
- Archived parties are blocked for new transaction posting.
- Role profile removal is soft-inactivation, not deletion.

## 5. Backend API

All endpoints below are under:

```text
/api/v1
```

### Parties

```text
GET    /parties
POST   /parties
GET    /parties/:id
PATCH  /parties/:id
DELETE /parties/:id
```

`DELETE /parties/:id` is a soft archive:

```text
status = archived
```

### Customer profile

```text
POST  /parties/:id/customer
PATCH /parties/:id/customer
```

### Supplier profile

```text
POST  /parties/:id/supplier
PATCH /parties/:id/supplier
```

### GST registrations

```text
GET    /parties/:id/gst-registrations
POST   /parties/:id/gst-registrations
PATCH  /parties/:id/gst-registrations/:registrationId
DELETE /parties/:id/gst-registrations/:registrationId
```

Behavior:

- `POST` creates a GST registration.
- If it is the first GST registration, it becomes primary.
- If `isPrimary = true`, all sibling GST registrations are demoted.
- `DELETE` archives the GST registration and clears `isPrimary`.

### Addresses

```text
GET    /parties/:id/addresses
POST   /parties/:id/addresses
PATCH  /parties/:id/addresses/:addressId
DELETE /parties/:id/addresses/:addressId
```

### Contacts

```text
GET    /parties/:id/contacts
POST   /parties/:id/contacts
PATCH  /parties/:id/contacts/:contactId
DELETE /parties/:id/contacts/:contactId
```

### Bank accounts

```text
GET    /parties/:id/bank-accounts
POST   /parties/:id/bank-accounts
PATCH  /parties/:id/bank-accounts/:bankAccountId
DELETE /parties/:id/bank-accounts/:bankAccountId
```

### Payment terms

```text
GET  /payment-terms
POST /payment-terms
```

`GET /payment-terms` ensures default system terms exist for the business before returning active terms.

## 6. Frontend UI Flow

### Parties page

File:

```text
apps/web/components/parties/parties-page.tsx
```

Implemented UI:

- Compact top summary section.
- Party table.
- Search.
- Role filter.
- Status filter.
- Sortable table headers.
- Bulk selection.
- Bulk mark active/inactive.
- Bulk archive.
- Scroll-contained table area after the configured record height.
- Add party dialog.
- Edit party dialog.
- View party details dialog.
- Archive confirmation dialog.

### Add party dialog

Creates:

```text
party identity
customer profile, optional
supplier profile, optional
first primary GST registration, optional
primary address, optional
primary contact, optional
```

For `individual` party type:

- Business identity fields are hidden/cleared.
- Legal name, trade name, short name, and PAN are not required.

For business/government/other:

- Business identity fields are available.
- PAN is optional but validated when present.

### Edit party dialog

Updates:

```text
party identity
roles
status
notes
primary address
primary contact
customer terms
supplier terms
```

Important behavior:

- Removing customer role marks customer profile inactive.
- Removing supplier role marks supplier profile inactive.
- Existing GSTINs are not edited from this form.
- Existing GSTINs are managed from the party details dialog.

### View party details dialog

Shows:

```text
party identity
role profiles
GST registrations
addresses
contacts
receivable/payable outstanding summary
```

GST registration actions:

```text
Add GSTIN
Edit GSTIN
Archive GSTIN
Set primary
```

The GSTIN manager is inline inside the detail dialog. It does not use nested dialogs.

### Duplicate warning UX

The add/edit form warns when it detects:

```text
same display name
same PAN
same primary GSTIN
same primary contact email
same primary contact mobile
```

Important behavior:

- Duplicate warnings are non-blocking.
- Backend hard-blocks same GSTIN per business.
- Fuzzy duplicate matching is not implemented yet.

## 7. Backend Create Flow

Create request:

```text
POST /api/v1/parties
```

High-level flow:

```text
validate payload
check customer/supplier code availability
check GSTIN availability if GST registration exists
insert party
insert PAN tax identifier if PAN exists
insert primary GST registration if provided
insert primary address if provided
insert primary contact if provided
insert bank account if provided
insert customer profile if customer role selected
insert supplier profile if supplier role selected
write audit log
return getPartyDetail()
```

## 8. Backend Update Flow

Update request:

```text
PATCH /api/v1/parties/:id
```

High-level flow:

```text
validate payload
load existing party
update party identity fields
if roles changed:
  reconcilePartyRoles()
write audit log
return getPartyDetail()
```

Role reconciliation:

```text
wants customer and no profile
  -> create active customer profile

wants customer and inactive profile exists
  -> set customer profile active

does not want customer and profile exists
  -> set customer profile inactive

wants supplier and no profile
  -> create active supplier profile

wants supplier and inactive profile exists
  -> set supplier profile active

does not want supplier and profile exists
  -> set supplier profile inactive
```

No role profile is deleted during role removal.

## 9. Party Detail Response Shape

`GET /api/v1/parties/:id` returns:

```text
party identity fields
roles
customerCode
supplierCode
primaryGstRegistration
primaryContact
customerProfile
supplierProfile
gstRegistrations[]
addresses[]
contacts[]
bankAccounts[]
outstandingSummary
```

`outstandingSummary`:

```text
receivable
payable
overdueReceivable
overduePayable
openReceivableCount
openPayableCount
```

Outstanding is computed from `receivable_payable_entries`, excluding closed/settled/cancelled entries and zero-balance rows.

## 10. Transaction Snapshot Safety

### Sales

Sales posting resolves the party through:

```text
getPartySnapshot()
```

Sales stores:

```text
sales_invoices.party_id
sales_invoices.party_snapshot
vouchers.party_snapshot
receivable_payable_entries.party_snapshot
```

### Purchases

Purchase posting resolves the supplier through:

```text
getPartySnapshot()
```

Purchases store:

```text
purchase_bills.party_id
purchase_bills.supplier_snapshot
vouchers.party_snapshot
receivable_payable_entries.party_snapshot
```

### POS

POS checkout resolves the party through:

```text
getPartySnapshot()
```

POS stores:

```text
pos_sales.party_id
pos_sales.party_snapshot
pos_sales.customer_name
vouchers.party_snapshot
receivable_payable_entries.party_snapshot
```

This means posted customer-facing transactions own historical party snapshots.

## 11. Archived Party Behavior

Archive request:

```text
DELETE /api/v1/parties/:id
```

Actual behavior:

```text
parties.status = archived
```

New transactions:

```text
sales    -> archived party rejected
purchases -> archived party rejected
POS      -> archived party rejected
```

Historical records:

```text
sales invoices keep party_snapshot
purchase bills keep supplier_snapshot
POS sales keep party_snapshot
vouchers keep party_snapshot
AR/AP entries keep party_snapshot
```

## 12. Permissions

Every Parties API route is tenant scoped:

```text
request
  -> requirePrimaryBusinessAccess()
  -> resolve active business membership
  -> enforce business_id in query/mutation
  -> assert parties module permission
```

Permission mapping:

```text
view   -> list/detail/read child records
create -> create party
edit   -> update party and child records
delete -> archive party
```

Owner permissions are resolved through the business membership flow.

## 13. Validation Rules

Frontend validates:

```text
displayName required
at least one role required
PAN format when provided
GSTIN format when GSTIN is provided
GSTIN state code match
pincode format when provided
mobile format when provided
email format when provided
credit limit numeric format
credit/lead days integer format
```

Backend validates:

```text
tenant access
schema shape
GSTIN format
GSTIN state code match
GSTIN uniqueness per business
customer/supplier code uniqueness
same-party default references
status enums
```

No real GSTN government API verification is implemented yet.

## 14. Current Limitations

Known limitations:

```text
1. No real GSTN API verification yet; only format/state-code validation exists.
2. Multiple addresses, contacts, and bank accounts are supported by backend, but current UI focuses on one primary record for those child collections.
3. Duplicate UX is warning-only for exact/simple matches. Fuzzy duplicate matching is not implemented yet.
4. Party outstanding is shown in detail view, but there is no full party ledger page yet.
5. Computed sort fields role/GSTIN/contact are sorted client-side after fetching the current list.
6. No external GSTIN verified badge should be shown until GSTN API verification exists.
```

## 15. Smoke Test Checklist

Manual test cases:

```text
[ ] Create individual customer with display name and mobile only.
[ ] Create business supplier with GSTIN, address, and contact.
[ ] Create party with both customer and supplier roles.
[ ] Edit party and remove customer role; verify customer profile becomes inactive, not deleted.
[ ] Re-add customer role; verify existing customer profile becomes active.
[ ] Add second GSTIN from party detail dialog.
[ ] Set second GSTIN as primary; verify old primary is demoted.
[ ] Archive a GSTIN; verify it disappears from active detail list and cannot be primary.
[ ] Try duplicate GSTIN in same business; verify backend rejects it.
[ ] Create party with same name/PAN/contact as another party; verify warning appears.
[ ] Archive party; verify it cannot be used for new sales/purchases/POS.
[ ] Confirm historical sales/purchase/POS records still show their party snapshots.
[ ] Create unpaid sales/purchase entries; verify party detail outstanding summary updates.
[ ] GET /api/v1/payment-terms; verify default terms are seeded and returned.
```

## 16. Verification Commands

Commands used for the current implementation pass:

```bash
pnpm --filter @gstfy/backend check-types
pnpm --filter @gstfy/backend lint
pnpm --filter @gstfy/backend test
pnpm --filter web typecheck
pnpm --filter web exec eslint components/parties/parties-page.tsx lib/parties/api.ts lib/pos/api.ts
git diff --check
```

Known repo-level note:

```bash
pnpm --filter web lint
```

may still fail because of unrelated existing React Compiler lint errors in CA/settings/signup files. The touched Parties files pass direct lint.
