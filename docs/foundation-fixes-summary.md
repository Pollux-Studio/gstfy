# Foundation Fixes Implementation Summary

Date: 2026-08-16

This document records what was implemented for:

- `docs/fix-needed.md`
- `docs/branch-setup.md`

The goal of these changes was to make GSTfy model the core organization domain correctly before building real sales, purchase, inventory, accounting, and GST filing engines.

## Executive Summary

The backend now has first-class organization entities for GST registrations, locations, branches, warehouses, branch-warehouse links, branch-user links, financial years, and invoice series.

The Add Branch flow now uses the real backend and follows the documented setup model:

```text
Branch identity
  -> Location create/select
  -> GST registration selection
  -> Warehouse option
  -> Assign users
  -> Review
  -> Create branch
```

The important correction is this:

```text
Company != GST Registration
GST Registration != Branch
Branch != Warehouse
Warehouse != Branch
Location != GST Registration
```

The implementation no longer assumes that creating a branch automatically creates a warehouse.

## Files Added Or Changed

### Backend

| File | Purpose |
|---|---|
| `apps/backend/drizzle/0008_organization_foundation.sql` | Adds organization foundation tables and migrates existing business data into principal location, GST registration, main branch, financial year, invoice series, and branch scope rows. |
| `apps/backend/drizzle/0009_gst_registration_state_code_backfill.sql` | Backfills missing state codes from GSTIN prefix where possible. |
| `apps/backend/drizzle/0010_branch_setup_metadata.sql` | Adds optional branch and warehouse metadata fields needed by the branch setup flow. |
| `apps/backend/src/db/schema/index.ts` | Adds Drizzle schema for organization tables and new metadata columns. |
| `apps/backend/src/modules/organization/organization.schemas.ts` | Adds Zod request validation for GST registrations, locations, branches, warehouses, branch-warehouse links, and branch-user links. |
| `apps/backend/src/modules/organization/organization.routes.ts` | Adds tenant-scoped organization APIs. |
| `apps/backend/src/app.ts` | Registers organization routes under `/api/v1`. |
| `apps/backend/src/modules/users/users.routes.ts` | Existing users API now works with branch scope through `business_member_branches`. |

### Frontend

| File | Purpose |
|---|---|
| `apps/web/lib/organization/api.ts` | Adds frontend API helpers for organization entities and relationship endpoints. |
| `apps/web/components/branches/add-branch-page.tsx` | Reworks Add Branch page into a backend-connected setup wizard. |
| `apps/web/app/branches/new/page.tsx` | Loads the Add Branch page. |
| `apps/web/components/team-switcher.tsx` | Existing entry point routes to `/branches/new`. |

## Database Model Implemented

### `businesses`

Existing business identity remains the workspace/company record.

Important fields:

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

No GSTIN is treated as the primary business identity.

### `business_profiles`

Kept as business-level contact/profile data.

Used for compatibility and initial migration source.

Important fields still used:

```text
business_email
business_mobile
primary_contact_name
primary_contact_email
primary_contact_mobile
gstin
taxpayer_type
registration_date
address fields
state_code
```

Long-term GST identity data now belongs in `gst_registrations`.

### `business_locations`

Implemented as the physical address/location table.

Fields:

```text
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
is_principal_place
is_additional_place
is_sales_location
is_purchase_location
is_dispatch_location
is_warehouse_location
is_office
created_at
updated_at
```

Constraints/indexes:

```text
UNIQUE(business_id, location_code)
INDEX(business_id)
```

### `gst_registrations`

Implemented as the first-class GST identity table.

Fields:

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

Supported statuses:

```text
active
inactive
cancelled
suspended
archived
```

Constraints/indexes:

```text
UNIQUE(business_id, gstin)
INDEX(business_id)
INDEX(gstin)
```

### `business_branches`

Implemented as the operational branch table.

Fields:

```text
id
business_id
location_id
gst_registration_id
branch_code
name
branch_type
manager_name
phone
email
opening_date
status
created_at
updated_at
```

Supported statuses:

```text
active
closing
inactive
archived
```

Current delete behavior:

```text
DELETE /branches/:id -> sets status = inactive
```

Constraints/indexes:

```text
UNIQUE(business_id, branch_code)
INDEX(business_id)
INDEX(location_id)
```

### `warehouses`

Implemented as the stock location table.

Fields:

```text
id
business_id
location_id
warehouse_code
name
warehouse_type
capacity
manager_name
status
created_at
updated_at
```

Supported warehouse types:

```text
central
branch
distribution
transit
returns
damaged
```

Current delete behavior:

```text
DELETE /warehouses/:id -> sets status = inactive
```

Constraints/indexes:

```text
UNIQUE(business_id, warehouse_code)
INDEX(business_id)
INDEX(location_id)
```

### `branch_warehouses`

Implemented as the many-to-many relationship between branches and warehouses.

Fields:

```text
branch_id
warehouse_id
is_default
created_at
```

Constraint:

```text
UNIQUE(branch_id, warehouse_id)
```

This supports:

```text
one branch -> many warehouses
one warehouse -> many branches
branch -> no warehouse
warehouse -> no branch
```

### `business_member_branches`

Implemented as the branch scope table for users.

Fields:

```text
business_member_id
branch_id
is_primary
created_at
```

Constraint:

```text
UNIQUE(business_member_id, branch_id)
```

This supports:

```text
Owner -> all branches by role
Staff -> selected branches
Cashier -> selected branch
Manager -> selected branch
Accountant -> optional branch scope
```

### `financial_years`

Implemented as the fiscal year table.

Fields:

```text
id
business_id
name
start_date
end_date
status
is_current
created_at
updated_at
```

Constraint:

```text
UNIQUE(business_id, name)
```

### `invoice_series`

Implemented as the future invoice numbering source.

Fields:

```text
id
business_id
gst_registration_id
branch_id
financial_year_id
document_type
series_code
prefix
suffix
next_number
status
created_at
updated_at
```

Constraint:

```text
UNIQUE(business_id, series_code, financial_year_id, document_type)
```

Note: Allocation logic is not implemented yet. The table foundation is ready for the sales/invoice engine.

## Migration Behavior

### Migration `0008_organization_foundation.sql`

For existing businesses, it creates:

1. A principal location from `business_profiles` address data.
2. A GST registration from `business_profiles.gstin`.
3. A default `MAIN` branch linked to the principal location and GST registration.
4. A current financial year.
5. A default invoice series using existing `business_preferences.invoice_prefix` and `invoice_next_number`.
6. A branch scope row for existing non-owner business members to the `MAIN` branch.

This preserves existing auth, tenant, CA, settings, and user flows while adding the new organization foundation.

### Migration `0009_gst_registration_state_code_backfill.sql`

Backfills missing `state_code` values from the first two characters of GSTIN.

Applies to:

```text
gst_registrations
business_locations linked as principal locations
```

### Migration `0010_branch_setup_metadata.sql`

Adds optional UI/backend metadata:

```text
business_branches.manager_name
business_branches.phone
business_branches.email
business_branches.opening_date

warehouses.warehouse_type
warehouses.capacity
warehouses.manager_name
```

## Backend APIs Implemented

All routes are registered under:

```text
/api/v1
```

### GST Registration APIs

```text
GET    /api/v1/gst-registrations
POST   /api/v1/gst-registrations
PATCH  /api/v1/gst-registrations/:id
DELETE /api/v1/gst-registrations/:id
```

Behavior:

- All reads and writes are scoped to the authenticated user's primary business.
- Create/update validates principal location ownership.
- Delete archives the GST registration.

### Location APIs

```text
GET    /api/v1/locations
POST   /api/v1/locations
PATCH  /api/v1/locations/:id
DELETE /api/v1/locations/:id
```

Behavior:

- All records are scoped by business.
- Create/update uses Zod validation.
- Delete archives the location.

### Branch APIs

```text
GET    /api/v1/branches
POST   /api/v1/branches
GET    /api/v1/branches/:id
PATCH  /api/v1/branches/:id
DELETE /api/v1/branches/:id
```

Behavior:

- List/detail includes location name, state code, GSTIN, and linked warehouses.
- Create requires `locationId` and `gstRegistrationId`.
- Create validates that location and GST registration belong to the current business.
- Delete sets branch status to `inactive`.

### Warehouse APIs

```text
GET    /api/v1/warehouses
POST   /api/v1/warehouses
GET    /api/v1/warehouses/:id
PATCH  /api/v1/warehouses/:id
DELETE /api/v1/warehouses/:id
```

Behavior:

- All records are scoped by business.
- Create/update validates location ownership.
- Delete sets warehouse status to `inactive`.

### Branch-Warehouse Relationship APIs

```text
POST   /api/v1/branches/:branchId/warehouses
DELETE /api/v1/branches/:branchId/warehouses/:warehouseId
PUT    /api/v1/branches/:branchId/warehouses
```

Behavior:

- `POST` links one warehouse to one branch.
- `DELETE` removes one link.
- `PUT` replaces all warehouse links for a branch.
- If `isDefault` is true, other default warehouse links for the branch are cleared first.
- Both branch and warehouse ownership are verified.

### Branch-User Relationship APIs

```text
POST   /api/v1/branches/:branchId/users
DELETE /api/v1/branches/:branchId/users/:memberId
```

Behavior:

- Adds/removes branch scope for a business member.
- Both branch and member ownership are verified.
- If `isPrimary` is true, other primary branch flags for the same member are cleared first.

## Security Corrections

Implemented tenant-safe checks through:

```text
requirePrimaryBusinessAccess(request)
assertCanManageBusiness(access.membership)
requireLocation(businessId, locationId)
requireGstRegistration(businessId, registrationId)
requireBranch(businessId, branchId)
requireWarehouse(businessId, warehouseId)
requireBusinessMember(businessId, memberId)
```

Important rules now enforced:

- Client does not send trusted `businessId` for organization writes.
- Branch creation validates location ownership.
- Branch creation validates GST registration ownership.
- Warehouse creation validates location ownership.
- Branch-warehouse linking validates both entities belong to the same business.
- Branch-user linking validates both entities belong to the same business.

## Frontend Implementation

### Organization API Client

Implemented in:

```text
apps/web/lib/organization/api.ts
```

Helpers added:

```text
getGstRegistrations()
getLocations()
getBranches()
getWarehouses()
createLocation()
createBranch()
createWarehouse()
updateBranchWarehouses()
linkBranchWarehouse()
assignBranchUser()
```

Types added or expanded:

```text
GstRegistrationRecord
BusinessLocationRecord
BusinessBranchRecord
WarehouseRecord
CreateLocationPayload
CreateBranchPayload
CreateWarehousePayload
```

### Add Branch Wizard

Implemented in:

```text
apps/web/components/branches/add-branch-page.tsx
```

Current wizard steps:

```text
1. Branch
2. Location
3. GST
4. Warehouse
5. Users
6. Review
```

The final create action happens from the Review step.

### Step 1: Branch

Fields:

```text
branchName
branchCode
branchType
managerName
openingDate
managerPhone
managerEmail
```

Validation:

- Branch name is required.
- Branch code is required, uppercase, and limited to letters/numbers/hyphen.
- Manager phone is optional, but if entered must be a 10-digit Indian mobile number.
- Manager email is optional, but if entered must be a valid email.
- Opening date is optional, but if entered must be `YYYY-MM-DD`.

### Step 2: Location

Modes:

```text
Create new location
Use existing location
```

Create mode fields:

```text
addressLine1
addressLine2
locality
city
district
pincode
stateCode
```

Existing mode:

```text
existingLocationId
```

Behavior:

- Existing location mode does not require address fields.
- Create mode creates a `business_locations` row before branch creation.
- Branch stores only `locationId`; address fields are not copied into the branch table.

### Step 3: GST Registration

Behavior:

- Fetches real GST registrations from backend.
- If there is exactly one GST registration, it is preselected.
- The user must choose a GST registration before continuing.
- Branch stores `gstRegistrationId`.

### Step 4: Warehouse

Modes:

```text
No dedicated warehouse
Create new warehouse
Use existing warehouse
```

Behavior:

- `No dedicated warehouse` creates only the branch.
- `Create new warehouse` creates a warehouse at the selected/new location and links it to the branch.
- `Use existing warehouse` links the branch to the selected warehouse.
- No warehouse is created automatically.

Warehouse create fields:

```text
warehouseName
warehouseCode
warehouseType
warehouseCapacity
```

### Step 5: Users

Behavior:

- Fetches real business users from the Users API.
- Excludes system-managed owner users from manual assignment cards.
- Allows selecting staff users to assign to the branch.
- Selected users are linked through `/api/v1/branches/:branchId/users`.
- First selected user is marked as primary for that branch assignment.

### Step 6: Review

Shows:

```text
Branch
Location
GST registration
Warehouse
Users
```

Then the user creates the branch.

### Dev Testing Helper

Added:

```text
Fill dummy data
```

Behavior:

- Fills branch identity.
- Fills Tamil Nadu / Chennai location data.
- Uses the first GST registration if available.
- If an existing warehouse exists, it selects existing warehouse mode.
- If no warehouse exists, it prepares a new central warehouse.
- Shows a success toast after filling.

This is for fast local testing of the branch flow.

## Mapping To `docs/fix-needed.md`

| Requirement | Status | Implementation |
|---|---:|---|
| GST registration must be first-class | Done | Added `gst_registrations` table, schema, migration, APIs, and frontend fetch/select usage. |
| Existing data migration | Done | Migration creates principal location, GST registration, main branch, current financial year, default invoice series, and member branch scopes. |
| Organization model separation | Done | Added separate `business_locations`, `gst_registrations`, `business_branches`, `warehouses`, relationship tables. |
| Business locations | Done | Added table, schema, APIs, frontend create/select support. |
| Branch model | Done | Added table, schema, APIs, frontend create flow. |
| Warehouse model | Done | Added table, schema, APIs, explicit create/link behavior. |
| Branch-warehouse relationship | Done | Added `branch_warehouses`, relationship APIs, frontend link flow. |
| Multiple GSTIN support | Done at model/API level | Database and APIs allow multiple GST registrations per business. Plan limits are not implemented here. |
| Users and branch scope | Done | Added `business_member_branches`, Users API branch scope, branch-user link APIs, frontend assignment step. |
| CA access preserved | Done | Existing CA tables and flows remain business-level. No branch-scoped CA changes were introduced. |
| Financial year | Done at foundation level | Added `financial_years` table and migration seed. No UI yet. |
| Invoice series | Done at foundation level | Added `invoice_series` table and migration seed. Allocation engine not implemented yet. |
| Organization APIs | Done | Added GST registration, location, branch, warehouse, branch-warehouse, and branch-user APIs. |
| Registration flow | Partial | Existing registration now has organization foundation migration support. Optional initial branch/warehouse is handled after registration through Add Branch. |
| Settings invoice prefix migration | Partial | `invoice_series` exists and is seeded from preferences. Old compatibility fields remain. |
| Security | Done for organization APIs | All organization APIs derive business from auth session and validate ownership. |
| Deletion | Done for branches/warehouses | Branch and warehouse delete set `inactive`. Location/GST deletion still archive. |
| Tests | Partial | Type checks and targeted lint passed. Automated edge-case tests are not added yet. |
| Do not implement transaction engines | Followed | No sales, purchase, GST return, e-invoice, e-way bill, accounting, or inventory engines were built in this fix. |

## Mapping To `docs/branch-setup.md`

| Requirement | Status | Implementation |
|---|---:|---|
| Company, GST registration, location, branch, warehouse are separate | Done | Implemented separate tables and explicit references. |
| One GSTIN + five branches + one warehouse supported | Done at model/flow level | One warehouse can be linked to multiple branches through `branch_warehouses`. |
| Branch without warehouse | Done | Wizard supports `No dedicated warehouse`. |
| Warehouse without branch | Done at backend level | Warehouses can be created independently through API. A dedicated UI page is not built yet. |
| Multiple warehouses | Done | Backend supports multiple warehouses and branch links. |
| Multiple GST registrations | Done at backend/UI selection level | Branch wizard selects a GST registration. |
| Location creation | Done | Add Branch supports creating a location. |
| Location selection | Done | Add Branch supports selecting an existing location. |
| Branch fields | Done | Required branch fields and optional phone/email/manager/opening date are supported. |
| Branch code uniqueness | Done | Unique index on `(business_id, branch_code)`. |
| GST registration selection | Done | Required in create branch schema and UI. |
| Branch address references location | Done | Branch stores `location_id`; no address duplication in branch table. |
| Warehouse fields | Done | Required warehouse fields and optional type/capacity/manager are supported. |
| Branch-warehouse links | Done | `branch_warehouses` table and APIs implemented. |
| Branch setup wizard | Mostly done | Wizard has Branch, Location, GST, Warehouse, Users, Review, and Create action. |
| No automatic warehouse creation | Done | Warehouse is only created when user chooses create new warehouse. |
| User assignment | Done | Add Branch has optional user assignment step and backend relationship API. |
| Branch access resolution | Partial | Branch scopes exist. Enforcement in future transaction engines is still pending. |
| Central purchasing | Not implemented yet | Foundation supports warehouses/branches, but purchase engine is not in scope. |
| Branch sales from central warehouse | Not implemented yet | Foundation supports branch/warehouse separation, but sales engine is not in scope. |
| Stock transfer | Not implemented yet | Inventory/stock transfer engine is not in scope. |
| Warehouse-to-warehouse transfer | Not implemented yet | Inventory transfer workflow is not in scope. |
| Inventory dimensions | Partial foundation | Warehouse/branch/GST registration dimensions exist. Item/batch/serial inventory tables are not built. |
| Branch accounting dimension | Partial foundation | Branch entity exists for future accounting references. Accounting engine is not built. |
| Branch reporting | Not implemented yet | Reporting filters are future work. |
| Warehouse reporting | Not implemented yet | Inventory reports are future work. |
| Multi-GSTIN reporting | Not implemented yet | Data model supports it; reporting engine is future work. |
| Branch closure | Partial | Delete sets `inactive`. Pre-closure checks for open transactions/stock are future work. |
| Warehouse closure | Partial | Delete sets `inactive`. Stock-zero validation is future work. |
| Branch rename historical safety | Partial foundation | Branch rows are preserved. Transaction snapshots are future work. |
| Security | Done for organization APIs | All relationship operations verify business ownership. |
| Recommended APIs | Done | Branch and warehouse CRUD plus relationship APIs are implemented. |
| Branch list UI | Not implemented yet | Add Branch exists. Dedicated branch list page is pending. |
| Branch details UI | Not implemented yet | Dedicated branch details page is pending. |
| Edge cases | Partial | Data model supports core edge cases. Automated tests are pending. |

## Current Supported Real-World Flow

### Five branches and one central warehouse

The intended test path is:

1. Create first branch.
2. In warehouse step, choose `Create new warehouse`.
3. Create central warehouse.
4. Create additional branches.
5. In warehouse step for each additional branch, choose `Use existing warehouse`.
6. Select the same central warehouse.

Result:

```text
Chennai Central Warehouse
  -> Chennai Branch
  -> Madurai Branch
  -> Coimbatore Branch
  -> Tirunelveli Branch
  -> Salem Branch
```

This works because `branch_warehouses` is many-to-many.

### Branch without warehouse

The intended test path is:

1. Create branch.
2. Choose `No dedicated warehouse`.
3. Create branch.

Result:

```text
business_branches row exists
no branch_warehouses row is created
```

### Existing location reuse

The intended test path is:

1. Create one location.
2. Create a new branch.
3. In location step, choose `Use existing location`.
4. Select the location.
5. Continue setup.

Result:

```text
business_branches.location_id references existing business_locations.id
```

## Validation Completed

Commands run successfully:

```bash
pnpm --filter @gstfy/backend check-types
pnpm --filter web typecheck
pnpm --filter web exec eslint components/branches/add-branch-page.tsx
```

Known validation limitation:

```text
pnpm --filter web lint
```

still fails because of existing unrelated React Compiler lint issues in CA/login/settings/signup components. The touched branch page passes targeted lint.

## What Is Still Pending

These were intentionally not completed in this foundation fix:

1. Dedicated Branch List UI.
2. Dedicated Branch Details UI.
3. Dedicated Warehouse List/Create UI outside the branch wizard.
4. Financial Year settings UI.
5. Invoice Series management UI.
6. Transaction-safe invoice number allocation.
7. Sales engine.
8. Purchase engine.
9. Inventory stock ledger.
10. Stock transfers.
11. Warehouse-to-warehouse transfers.
12. GST return engine.
13. Branch-level enforcement inside transactions.
14. Branch closure checks against stock, open invoices, payments, purchases, and transfers.
15. Automated integration tests for all edge cases.

## Final State

The organization foundation is now ready for transaction-engine work.

The system can model:

```text
Business
  -> GST Registrations
  -> Locations
  -> Branches
  -> Warehouses
  -> Branch-Warehouse links
  -> Branch-User scopes
  -> Financial Years
  -> Invoice Series
```

The main architectural correction is complete: GSTfy now connects organization entities explicitly instead of treating GSTIN, branch, address, and warehouse as one combined concept.
