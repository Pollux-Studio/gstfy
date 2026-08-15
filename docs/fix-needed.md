# FIX-NEEDED.md — GSTfy Foundation Corrections

## Purpose

GSTfy already has the application shell: Fastify + PostgreSQL + Drizzle backend, Next.js web app, tenant-aware workspaces, CA practice/client links, authentication, users/permissions, settings, branch UI, and purchase UI. The current implementation status also identifies the major gaps: no backend branch model/API, purchases still use mock data, dashboard data is mock, invoice persistence/generation is not implemented, and GST filing is not implemented.

This document defines the foundation fixes to complete **before** building real Sales, Purchase, Accounting, Inventory, and GST engines.

## 1. Required order

```text
1. Fix Company / GST Registration model
2. Add Locations / Branches / Warehouses
3. Align Users API with branch scope
4. Add Financial Year
5. Add Invoice Series
6. Preserve existing tenant + CA architecture
7. Then build transaction engines
```

## 2. GST registration must be a first-class entity

Current architecture has one GSTIN inside `business_profiles`. This is too restrictive.

Replace the long-term model with:

```text
businesses
    |
    +-- gst_registrations
    +-- business_locations
    +-- branches
    +-- warehouses
```

### `businesses`

Business identity:

```text
id
tenant_slug
legal_name
trade_name
pan
constitution
status
created_by
created_at
updated_at
```

Do not make GSTIN the business primary identity.

### `business_profiles`

Keep business-level contact/profile data:

```text
business_id
business_email
business_mobile
primary_contact_name
primary_contact_email
primary_contact_mobile
```

GST registration data should move to `gst_registrations`.

### `gst_registrations`

```text
id
business_id
gstin
legal_name
trade_name
taxpayer_type
registration_type
state_code
state
registration_date
effective_from
effective_to
status
principal_location_id
created_at
updated_at
```

Recommended statuses:

```text
ACTIVE
INACTIVE
CANCELLED
SUSPENDED
```

Constraint:

```text
UNIQUE(business_id, gstin)
```

## 3. Existing data migration

For every existing business:

```text
business_profiles
      |
read GST data
      |
create gst_registrations row
      |
create/link principal location
      |
mark registration ACTIVE
```

Initially preserve old columns for compatibility. The long-term source of truth must be `gst_registrations`.

## 4. Organization model

The following concepts must remain separate:

```text
Company != GST Registration
GST Registration != Branch
Branch != Warehouse
Warehouse != Branch
Location != GST Registration
```

Target:

```text
Business
 |
 +-- GST Registrations
 |
 +-- Locations
 |
 +-- Branches
 |
 +-- Warehouses
 |
 +-- Users
```

## 5. Business Locations

Create:

```text
business_locations
------------------
id
business_id
name
location_code
address_line_1
address_line_2
locality
district
city
pincode
state_code
state
country
status
created_at
updated_at
```

Prefer explicit relationships/capabilities over one mutually-exclusive location type:

```text
is_principal_place
is_additional_place
is_sales_location
is_purchase_location
is_dispatch_location
is_warehouse_location
is_office
```

## 6. Branch model

Create:

```text
business_branches
-----------------
id
business_id
location_id
gst_registration_id
branch_code
name
status
created_at
updated_at
```

A branch represents an operational/business unit.

It is not automatically a warehouse.

Constraint:

```text
UNIQUE(business_id, branch_code)
```

## 7. Warehouse model

Create:

```text
warehouses
----------
id
business_id
location_id
warehouse_code
name
status
created_at
updated_at
```

Warehouse = stock location.

Do not require every warehouse to belong to exactly one branch.

## 8. Branch ↔ Warehouse

Create:

```text
branch_warehouses
-----------------
branch_id
warehouse_id
is_default
created_at
```

This must support:

```text
one branch -> many warehouses
one warehouse -> many branches
branch -> no warehouse
warehouse -> no branch
```

Example:

```text
Chennai Central Warehouse
   |
   +-- Chennai
   +-- Madurai
   +-- Salem
   +-- Coimbatore
   +-- Tirunelveli
```

## 9. Multiple GSTINs

The database must support:

```text
ABC Traders
 |
 +-- Tamil Nadu GSTIN
 +-- Karnataka GSTIN
 +-- Kerala GSTIN
```

Even if a commercial plan only allows one GSTIN, the domain model must support many.

Plan limits belong in subscription/feature logic:

```text
plan.max_gst_registrations
```

not in the database shape.

## 10. Users and branch scope

Current frontend expects branch metadata while backend does not yet provide it.

Create:

```text
business_member_branches
------------------------
business_member_id
branch_id
is_primary
created_at
```

Support:

```text
GLOBAL
BRANCH_SCOPED
```

Examples:

```text
Owner -> all
Accountant -> all
Chennai Manager -> Chennai
Madurai Cashier -> Madurai
```

Do not put `branch_id` directly on `users`.

## 11. CA access

Keep the current CA architecture:

```text
ca_practices
ca_practice_members
ca_client_invites
ca_business_links
```

A CA link should point to the business, not a single branch.

Future optional scopes:

```text
BUSINESS
GST_REGISTRATION
BRANCH
```

but initial CA access should remain business-level.

## 12. Financial Year

Create:

```text
financial_years
---------------
id
business_id
name
start_date
end_date
status
is_current
```

Example:

```text
2026-27
2027-28
```

## 13. Invoice Series

Replace the current simple global `invoice_prefix + invoice_next_number` model with:

```text
invoice_series
--------------
id
business_id
gst_registration_id
branch_id nullable
document_type
series_code
financial_year_id
prefix
suffix
next_number
status
```

Invoice number allocation must be server-side and transactional.

Example:

```text
INV/2026-27/000001
MAD/INV/2026-27/000001
```

## 14. Organization APIs

Add:

```text
GET/POST/PATCH /api/v1/gst-registrations
GET/POST/PATCH/DELETE /api/v1/locations
GET/POST/PATCH/DELETE /api/v1/branches
GET/POST/PATCH/DELETE /api/v1/warehouses
```

Add appropriate subroutes for branch-user and branch-warehouse relationships.

## 15. Registration flow

Long-term business registration:

```text
User
 |
Business
 |
Business Profile
 |
GST Registration
 |
Principal Location
 |
Optional Initial Branch
 |
Optional Initial Warehouse
```

Do not break the existing CA referral/tenant/authentication flow.

## 16. Settings changes

Current `business_preferences` contains:

```text
invoice_prefix
invoice_next_number
```

Migrate these into `invoice_series`.

Keep compatibility temporarily, then retire the old fields.

## 17. Security

Every organization query must be tenant/business scoped.

Never trust a client-provided `businessId`.

CA access must verify membership through `ca_business_links`.

A user must never access another business's:

```text
GST registrations
locations
branches
warehouses
users
```

## 18. Deletion

Used branches and warehouses must never be hard-deleted.

Use:

```text
ACTIVE
INACTIVE
ARCHIVED
```

Historical references must remain valid.

## 19. Tests

Before moving forward:

```text
[ ] Existing businesses migrate correctly
[ ] Existing login/tenant flows work
[ ] Existing CA links/invites work
[ ] One business supports multiple GST registrations
[ ] Five branches + one warehouse works
[ ] One warehouse can serve multiple branches
[ ] Branch can exist without warehouse
[ ] Warehouse can exist without branch
[ ] Users can be branch-scoped
[ ] Global users work
[ ] Invoice series cannot duplicate numbers
[ ] Cross-business access is blocked
[ ] Used branches/warehouses cannot be deleted
```

## 20. Do not implement yet

Do not build these in this fix:

```text
Sales
Purchases
GST returns
E-invoice
E-way bill
ITC reconciliation
Accounting ledger
Inventory valuation
```

This phase is only the organizational foundation.

## 21. Done state

GSTfy is ready for transaction-engine work when:

```text
Business
  -> GST Registration
  -> Location
  -> Branch
  -> Warehouse
  -> User Scope
  -> Financial Year
  -> Invoice Series
```

are all real backend entities with tenant-safe APIs and migrations.

## Final rule

> GSTfy must treat company, GST registration, physical location, branch, and warehouse as separate domain concepts and connect them explicitly.
