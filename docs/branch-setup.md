# BRANCH-SETUP.md — GSTfy Branch, Location & Warehouse Setup

## Purpose

This document defines the dealer setup flow for branches, locations, and warehouses.

GSTfy must support the core target case:

```text
Dealer
 |
 +-- 5 Branches
 |
 +-- 1 Central Warehouse
```

as well as more complex businesses.

Never assume:

```text
1 branch = 1 warehouse
1 branch = 1 GSTIN
1 GSTIN = 1 branch
1 warehouse = 1 branch
```

## 1. Definitions

### Company

The GSTfy business workspace/legal business.

### GST Registration

A tax identity belonging to the business.

### Location

A physical place/address.

### Branch

An operational business unit.

### Warehouse

A place where inventory is physically held.

These are different entities.

## 2. Supported configurations

### One GSTIN + five branches + one warehouse

```text
GSTIN
 |
 +-- Chennai
 +-- Madurai
 +-- Coimbatore
 +-- Tirunelveli
 +-- Salem
 |
 +-- Chennai Central Warehouse
```

Valid.

### Multiple warehouses

```text
Branches
   |
Warehouses
   +-- Chennai Central
   +-- Madurai
```

Valid.

### Branch without warehouse

```text
Sales Office -> no stock
```

Valid.

### Warehouse without branch

```text
Central Distribution Warehouse
```

Valid.

### Multiple GST registrations

```text
Business
 |
 +-- TN GSTIN
 |   +-- Chennai
 |   +-- Madurai
 |
 +-- KA GSTIN
     +-- Bangalore
```

Valid.

## 3. Location creation

Fields:

```text
name *
location_code
address_line_1 *
address_line_2
locality
city
district
state *
state_code *
pincode *
country
```

Avoid duplicating addresses in branch/warehouse tables.

## 4. Branch fields

Required:

```text
name *
branch_code *
location *
gst_registration *
status
```

Optional:

```text
phone
email
manager
opening_date
default_warehouse
default_sales_series
default_purchase_series
```

## 5. Branch code

Example:

```text
CHE
MAD
CBE
TNV
SAL
```

Constraint:

```text
UNIQUE(business_id, branch_code)
```

## 6. GST registration

If the business has one GST registration, preselect it.

If it has multiple:

```text
GST Registration *
[ Tamil Nadu ]
[ Karnataka ]
```

The selection is a legal/tax identity choice and must not be inferred only from branch name.

## 7. Branch address

Reference:

```text
location_id
```

Do not copy address fields into every branch row.

## 8. Warehouse fields

Required:

```text
name *
warehouse_code *
location *
status
```

Optional:

```text
warehouse_type
capacity
manager
```

Suggested warehouse types:

```text
CENTRAL
BRANCH
DISTRIBUTION
TRANSIT
RETURNS
DAMAGED
```

Warehouse type is operational metadata; it must not automatically determine GST treatment.

## 9. Branch ↔ Warehouse

Use:

```text
branch_warehouses
-----------------
branch_id
warehouse_id
is_default
```

This allows a central warehouse to serve many branches.

## 10. Branch setup wizard

```text
Step 1
Branch Name
Branch Code

Step 2
Create/select Location

Step 3
Select GST Registration

Step 4
Warehouse
[ ] No dedicated warehouse
[ ] Create new warehouse
[ ] Use existing warehouse

Step 5
Assign Users

Step 6
Review

Step 7
Create Branch
```

Do not automatically create a warehouse when creating a branch.

## 11. Five branches + one warehouse example

Create:

```text
Chennai Branch
Madurai Branch
Coimbatore Branch
Tirunelveli Branch
Salem Branch
```

Then:

```text
Chennai Central Warehouse
```

and link:

```text
Chennai -> Central
Madurai -> Central
Coimbatore -> Central
Tirunelveli -> Central
Salem -> Central
```

This must be the first real-world configuration tested.

## 12. User assignment

Create:

```text
business_member_branches
------------------------
business_member_id
branch_id
is_primary
```

Examples:

```text
Owner -> all
Accountant -> all
Chennai Manager -> Chennai
Madurai Cashier -> Madurai
```

## 13. Branch access

When a user creates a transaction:

```text
user
 |
resolve permitted branches
 |
default branch
 |
transaction
```

A branch-scoped user must not be able to create/edit another branch's transactions unless permission allows it.

## 14. Centralized purchasing

Support:

```text
Central Purchase
      |
Supplier
      |
Central Warehouse
      |
Branch allocation
```

Do not require every purchase to belong to a retail branch.

## 15. Branch sales from central warehouse

Support:

```text
Sales location:
Madurai Branch

Dispatch location:
Chennai Central Warehouse

Ship-to:
Customer address
```

These are separate concepts.

## 16. Stock transfer

### Same business / same GST registration context

Use:

```text
STOCK_TRANSFER
```

Example:

```text
Central Warehouse
   |
   +-- 20 laptops
   v
Madurai stock
```

Effects:

```text
Source -20
Destination +20
```

Do not create customer revenue/receivable for a normal internal stock movement.

### Different GST registrations

Example:

```text
TN GSTIN
   |
   v
KA GSTIN
```

Do not use the same simple internal-transfer path. The transaction must enter the GST transaction/compliance engine because separate GST registrations can have distinct tax consequences.

## 17. Warehouse-to-warehouse transfer

Support:

```text
DRAFT
IN_TRANSIT
RECEIVED
CANCELLED
```

Flow:

```text
Source
  |
Dispatch
  |
In Transit
  |
Receive
  |
Destination
```

Inventory must not appear simultaneously in both locations.

## 18. Inventory dimensions

Inventory should eventually support:

```text
business
gst_registration
warehouse
branch
item
batch
serial
```

At MVP, keep business + warehouse + item as the core source of truth and add advanced dimensions only when required.

## 19. Branch accounting dimension

Branches should be usable as a reporting dimension in accounting.

Example:

```text
Electricity Expense
    |
    +-- branch_id = Madurai
```

Do not create a completely separate chart of accounts for every branch.

## 20. Branch reporting

Reports should eventually filter by:

```text
All branches
Single branch
Selected branches
```

Examples:

```text
Sales
Purchase
Expenses
Profitability
Receivables
Payables
Inventory
GST
```

## 21. Warehouse reporting

Inventory reports should filter by:

```text
All warehouses
Single warehouse
Branch-linked warehouse
```

Example:

```text
Laptop
Chennai WH: 120
Madurai WH: 20
Total: 140
```

## 22. Multi-GSTIN reporting

GST reports must separately support:

```text
All GST registrations
Tamil Nadu GSTIN
Karnataka GSTIN
```

A report can later use:

```text
GST Registration = TN
Branch = Madurai
Warehouse = Chennai Central
```

These are separate filters.

## 23. Branch closure

Do not delete.

Use:

```text
ACTIVE
CLOSING
INACTIVE
```

Before closure verify:

```text
open transactions
pending payments
pending purchases
pending stock transfers
remaining stock
cash balance
```

## 24. Warehouse closure

Before deactivation:

```text
stock = 0
```

or transfer all stock elsewhere.

Never delete historical inventory references.

## 25. Branch rename

Allow future-facing rename, but preserve historical transaction snapshots where needed.

Never rewrite old invoice display data simply because the branch name changed.

## 26. Security

Every branch/warehouse query must be scoped to the current business.

Rules:

```text
user -> business membership
user -> branch assignment
CA -> ca_business_link
```

Never trust a raw `businessId` or `branchId` from the client without authorization.

## 27. APIs

Recommended:

```text
GET    /api/v1/branches
POST   /api/v1/branches
GET    /api/v1/branches/:id
PATCH  /api/v1/branches/:id
DELETE /api/v1/branches/:id

GET    /api/v1/warehouses
POST   /api/v1/warehouses
GET    /api/v1/warehouses/:id
PATCH  /api/v1/warehouses/:id
DELETE /api/v1/warehouses/:id
```

Relationships:

```text
POST   /api/v1/branches/:id/warehouses
DELETE /api/v1/branches/:id/warehouses/:warehouseId

POST   /api/v1/branches/:id/users
DELETE /api/v1/branches/:id/users/:memberId
```

## 28. Branch list UI

```text
Branches

+ Add Branch

Branch        GSTIN       Warehouse          Status
----------------------------------------------------
Chennai       TN...       Central Warehouse   Active
Madurai       TN...       Central Warehouse   Active
Coimbatore    TN...       Central Warehouse   Active
Tirunelveli   TN...       Central Warehouse   Active
Salem         TN...       Central Warehouse   Active
```

## 29. Branch details UI

```text
Madurai Branch

GST Registration
Tamil Nadu

Location
Madurai, Tamil Nadu

Warehouses
Chennai Central Warehouse

Users
Madurai Manager
Madurai Cashier

Summary
Sales
Purchases
Stock
Receivables
Payables
```

## 30. Edge cases to test

```text
[ ] Five branches + one warehouse
[ ] Five branches + multiple warehouses
[ ] Branch without warehouse
[ ] Warehouse without branch
[ ] One branch + multiple warehouses
[ ] One warehouse + multiple branches
[ ] Multiple GST registrations
[ ] Branch reassigned to another GST registration where legally/configurationally allowed
[ ] Branch user restriction
[ ] Global user
[ ] Central purchasing
[ ] Central dispatch
[ ] Inter-branch stock movement
[ ] Warehouse-to-warehouse transfer
[ ] In-transit stock
[ ] Branch closure
[ ] Warehouse closure
[ ] Historical references survive rename/deactivation
[ ] Cross-business access blocked
```

## 31. Definition of Done

```text
[ ] Location backend exists
[ ] Branch backend exists
[ ] Warehouse backend exists
[ ] GST registration relationship exists
[ ] Branch UI uses real backend
[ ] Existing branch wizard is wired to backend
[ ] Five-branch/one-warehouse scenario works
[ ] Existing warehouse can serve multiple branches
[ ] Users can be assigned to branches
[ ] Branch permissions are enforced
[ ] Multi-GSTIN structure works
[ ] Historical branches/warehouses are preserved
[ ] APIs are tenant-safe
[ ] Tests cover edge cases
```

## Final principle

> A branch is an operational unit, a location is a physical place, a warehouse is a stock location, and a GST registration is a legal tax identity. GSTfy must model all four independently and connect them explicitly.
