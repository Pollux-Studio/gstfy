# Party Master Implementation Summary

## Source

Implemented from `docs/engine/product/party-master.md`.

## Backend

Added the Party Master foundation under `/api/v1/parties`.

### Database

Added migration:

```text
apps/backend/drizzle/0012_party_master_foundation.sql
```

Added Drizzle schema models:

```text
parties
party_customer_profiles
party_supplier_profiles
party_gst_registrations
party_tax_identifiers
party_addresses
party_contacts
party_bank_accounts
party_accounting_profiles
party_branch_profiles
```

Important constraints:

```text
party_gst_registrations: unique party + GSTIN
party_gst_registrations: unique business + GSTIN
party_customer_profiles: unique business + customer code
party_supplier_profiles: unique business + supplier code
party_branch_profiles: unique party + branch
```

Bank account numbers are not stored directly. The backend stores:

```text
account_number_hash
account_number_last4
```

API responses return only masked account numbers.

### API

Registered `registerPartiesRoutes` in the backend app under `/api/v1`.

Implemented:

```text
GET    /api/v1/parties
POST   /api/v1/parties
GET    /api/v1/parties/:id
PATCH  /api/v1/parties/:id
DELETE /api/v1/parties/:id

POST   /api/v1/parties/:id/customer
PATCH  /api/v1/parties/:id/customer
POST   /api/v1/parties/:id/supplier
PATCH  /api/v1/parties/:id/supplier

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
```

### Validation

Implemented Zod validation for:

```text
party type and status
customer/supplier roles
PAN format
GSTIN format
GSTIN state-code consistency
address pincode/state code
IFSC format
customer/supplier commercial terms
```

GSTIN is optional at party level and stored as one or more GST registration records.

### Security

All party APIs are business-scoped through the existing tenant-aware business access guard.

Write operations require:

```text
owner/admin role
or parties module permission for create/edit/delete
```

Read operations require active business membership.

### Audit

Party operations write audit events to `audit_logs`, including:

```text
PARTY_CREATED
PARTY_UPDATED
PARTY_DEACTIVATED
GSTIN_ADDED
GSTIN_UPDATED
ADDRESS_ADDED
ADDRESS_UPDATED
CUSTOMER_PROFILE_UPDATED
SUPPLIER_PROFILE_UPDATED
BANK_ACCOUNT_ADDED
```

## Frontend

Added typed web API helpers:

```text
apps/web/lib/parties/api.ts
```

The helper covers party list/detail/create/update/archive and nested GST registration, address, contact, bank-account, customer-profile and supplier-profile operations.

## Verification

Executed:

```text
pnpm --filter @gstfy/backend check-types
pnpm --filter web typecheck
pnpm --filter @gstfy/backend exec eslint src/modules/parties/parties.routes.ts src/modules/parties/parties.schemas.ts src/db/schema/index.ts
pnpm --filter web exec eslint lib/parties/api.ts
```

All checks passed after fixes.

## Notes

This implementation creates the Party Master foundation. Transaction posting already has a `partyId` snapshot hook from the core engine, but invoice/purchase UI and transaction-level party GST/address snapshot selection still need to be built on top of this model.
