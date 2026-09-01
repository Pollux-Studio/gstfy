# PARTIES-COMPLETE.md — GSTfy Complete Party Module

## Purpose

GSTfy Parties is not only a customer/supplier CRUD master. It is the complete external-party workspace used by Sales, Purchase, POS, Accounting, Tax, Inventory, Payment/Receipt, Reconciliation, and CA workflows.

The target model is:

```text
PARTY
├── Identity
├── Customer Profile
├── Supplier Profile
├── GST Registrations
├── Registered GST Addresses
├── Other Addresses
├── Contacts
├── Bank Accounts
├── Payment Terms
├── Commercial Terms
├── Accounting Mapping
├── Branch Preferences
├── Transactions
├── Ledger
├── Outstanding
├── Aging
├── Documents
└── Audit
```

One party may be:

```text
CUSTOMER
SUPPLIER
CUSTOMER + SUPPLIER
```

Never create separate party identities for the same external person/business.

---

## Current Implementation Status

The Parties engine is implemented as the production-ready master for external
customers and suppliers.

Implemented:

```text
Party identity
Customer/Supplier role profiles
Soft role inactivation
Multiple GST registrations
GSTIN to registered-address mapping
Multiple addresses
Multiple contacts
Multiple bank accounts with masked account data
Payment-term FK foundation
Business-scoped database integrity
Restrictive hard-delete protection
Duplicate suggestion API and UX
Outstanding summary from AR/AP entries
Party ledger route and UI
Document vault metadata UI
Audit timeline UI
Party workspace UI with Overview, GST, Addresses, Contacts, Bank, Commercial, Ledger, Documents, Audit, More
POS party_snapshot foundation
```

Important behavior:

```text
DELETE /api/v1/parties/:id archives the party.
It does not physically delete historical master data.
Ledger/outstanding values are derived from accounting entries.
Party bank accounts are separate from GSTfy business cash/bank ledger accounts.
```

Future-only items that do not block current production usage:

```text
Government GSTN API verification
Transaction drill-down rows after Sales/Purchase/Payment engines post documents
Fuzzy duplicate auto-merge, which should remain manual and user-confirmed
```

---

# 1. Party Identity

Required/optional:

```text
display_name *
party_type *
legal_name
trade_name
short_name
PAN
notes
status
profile_image_seed
```

Party types:

```text
BUSINESS
INDIVIDUAL
GOVERNMENT
OTHER
```

Statuses:

```text
ACTIVE
INACTIVE
BLOCKED
ARCHIVED
```

Archived parties remain available for historical records.

---

# 2. Customer Profile

```text
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
```

Customer code:

```text
UNIQUE(business_id, customer_code)
```

Removing the Customer role:

```text
profile.status = INACTIVE
```

Never delete the historical profile.

---

# 3. Supplier Profile

```text
supplier_code
credit_days
default_payment_term_id
default_purchase_address_id
default_gst_registration_id
preferred_warehouse_id
lead_time_days
status
```

Supplier code:

```text
UNIQUE(business_id, supplier_code)
```

Removing Supplier role:

```text
profile.status = INACTIVE
```

Never delete the historical profile.

---

# 4. GST Registrations

Support multiple GST registrations:

```text
Party
├── Tamil Nadu GSTIN
├── Karnataka GSTIN
└── Kerala GSTIN
```

Fields:

```text
gstin
legal_name
trade_name
registration_type
taxpayer_type
state_code
state
effective_from
effective_to
registered_address_id
status
is_primary
```

Registration types:

```text
GST
COMPOSITION
UIN
```

Statuses:

```text
ACTIVE
INACTIVE
CANCELLED
SUSPENDED
ARCHIVED
```

Rules:

```text
GSTIN unique within business
At most one active primary GSTIN per party
effective dates use DATE
archived GSTIN cannot be selected for normal new transactions
```

---

# 5. GSTIN Validation

Validate:

```text
format
first two digits = state code
business ownership
party ownership
duplicate GSTIN
```

Do not display a “GSTIN Verified” badge unless an actual government/external verification service has confirmed it.

Current format/state-code validation is acceptable as the local validation layer.

---

# 6. GSTIN Registered Address

Each GST registration may optionally reference:

```text
registered_address_id
```

The address must:

```text
belong to same party
belong to same business
be active
have compatible state code
```

This is distinct from:

```text
billing address
shipping address
party primary address
warehouse address
```

Example:

```text
ABC Ltd

GSTIN TN
  -> Chennai Registered Office

GSTIN KA
  -> Bangalore Registered Office
```

---

# 7. Address Management

Support multiple addresses:

```text
REGISTERED
BILLING
SHIPPING
OFFICE
WAREHOUSE
OTHER
```

Fields:

```text
label
address_type
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
```

Rules:

```text
one active primary address per party
```

Historical transactions use address snapshots.

---

# 8. Contact Management

Support multiple contacts.

Fields:

```text
name
designation
email
phone
mobile
contact_role
is_primary
status
```

Roles:

```text
GENERAL
SALES
PURCHASE
BILLING
ACCOUNTS
OWNER
OTHER
```

Rules:

```text
one active primary contact per party
```

---

# 9. Bank Account Management

Support multiple party bank accounts.

Fields:

```text
bank_name
account_name
account_number_hash
account_number_last4
ifsc
branch
account_type
is_primary
status
```

Rules:

```text
raw account number never returned
one primary non-archived account
hard deletion blocked for historical records
```

Important distinction:

```text
Party Bank Account
    !=
GSTfy Business Bank Account
```

Customer bank details belong to Party Master.

Business cash/bank ledger accounts belong to Accounting/Payment Engine.

---

# 10. Payment Terms

Use:

```text
payment_terms
```

with:

```text
id
business_id
code
name
days
due_date_rule
status
is_system
```

Seed:

```text
IMMEDIATE
NET_7
NET_15
NET_30
NET_45
```

Customer/Supplier profiles use:

```text
default_payment_term_id
```

No free-text payment terms.

---

# 11. Commercial Terms

Customer:

```text
credit_limit
credit_days
payment_term
price_group
sales_rep
```

Supplier:

```text
payment_term
lead_time
preferred_warehouse
```

Future:

```text
discount policy
collection priority
supplier category
customer category
territory
```

---

# 12. Credit Control

Customer sales should be able to calculate:

```text
current outstanding + new invoice
```

against:

```text
credit_limit
```

Policy:

```text
ALLOW
WARN
BLOCK
```

Do not hard-code one policy for every business.

---

# 13. Accounting Mapping

Party accounting profile:

```text
receivable_account_id
payable_account_id
advance_receipt_account_id
advance_payment_account_id
```

Every mapping must reference a valid:

```text
ledger_accounts.id
```

belonging to the same business.

Accounting Engine should additionally validate semantic suitability:

```text
receivable -> receivable/control account
payable -> payable/control account
customer advance -> appropriate liability
supplier advance -> appropriate asset/advance account
```

---

# 14. Branch Preferences

Party remains business-wide.

Optional:

```text
party_branch_profiles
```

Use for:

```text
branch-specific payment term
price group
sales representative
default address
```

Do not duplicate the Party for each branch.

---

# 15. Search

Search:

```text
display_name
legal_name
trade_name
customer_code
supplier_code
GSTIN
PAN
phone
email
```

Results should show:

```text
Name
Role
GSTIN/state
Outstanding
Status
```

---

# 16. Duplicate Detection

Hard block:

```text
same GSTIN in same business
same customer code
same supplier code
```

Warn:

```text
same/similar name
same PAN
same email
same mobile
```

Do not auto-merge records.

---

# 17. Party Detail Workspace

The Party detail page should become a complete workspace with:

```text
Overview
GST Registrations
Addresses
Contacts
Bank Accounts
Commercial
Accounting
Transactions
Ledger
Outstanding
Documents
Audit
```

---

# 18. Overview

Show:

```text
Party identity
Role
Status
Primary GSTIN
Primary address
Primary contact
Receivable
Payable
Overdue receivable
Overdue payable
Credit limit
Payment terms
```

Outstanding is derived from accounting/AR/AP, never stored on the Party.

---

# 19. GST Registrations Tab

For each GSTIN show:

```text
GSTIN
State
Registration Type
Taxpayer Type
Status
Effective From
Effective To
Primary
Registered Address
```

Actions:

```text
Add
Edit
Set Primary
Archive
```

---

# 20. Addresses Tab

Show:

```text
Address Type
Label
Full Address
State
Pincode
Primary
GSTIN mappings
```

A user should see:

```text
Chennai Registered Office
  -> TN GSTIN

Bangalore Registered Office
  -> KA GSTIN
```

---

# 21. Contacts Tab

Show:

```text
Name
Contact Role
Phone
Email
Primary
Status
```

Actions:

```text
Add
Edit
Archive
Set Primary
```

---

# 22. Bank Accounts Tab

Show masked data:

```text
Bank
Account Name
XXXX1234
IFSC
Primary
Status
```

Actions:

```text
Add
Edit
Archive
Set Primary
```

---

# 23. Commercial Tab

Customer:

```text
Credit Limit
Credit Days
Payment Terms
Price Group
Sales Rep
```

Supplier:

```text
Payment Terms
Lead Time
Preferred Warehouse
```

---

# 24. Accounting Tab

Show/edit for authorized users:

```text
Receivable Account
Payable Account
Customer Advance Account
Supplier Advance Account
```

Account names should resolve from `ledger_accounts`.

Do not allow free-text account IDs.

---

# 25. Transactions Tab

Once transaction modules are implemented, show:

```text
Sales Invoices
Purchase Bills
Credit Notes
Debit Notes
Sales Returns
Purchase Returns
Receipts
Payments
```

Filters:

```text
date
document type
branch
GST registration
status
```

Every row should drill down to the source document.

---

# 26. Party Ledger Tab

Customer ledger:

```text
Date
Document
Debit
Credit
Balance
```

Supplier ledger:

```text
Date
Document
Debit
Credit
Balance
```

Drill-down:

```text
Ledger
  -> Voucher
     -> Source Document
        -> Receipt/Payment
           -> Allocation
```

Never create a separate editable party balance table.

---

# 27. Outstanding

Show:

```text
Total Receivable
Total Payable
Overdue Receivable
Overdue Payable
Open Invoice Count
Open Bill Count
```

These are derived values.

---

# 28. Aging

Customer aging:

```text
Current
1-30
31-60
61-90
90+
```

Supplier aging uses the same structure.

Derived from:

```text
due_date
outstanding
```

---

# 29. Documents

Implemented document records:

```text
GST Certificate
PAN
Bank Proof
Agreement
Vendor Onboarding
Other
```

Store:

```text
document_type
title
file_reference
file_name
mime_type
file_size_bytes
notes
status
uploaded_by
created_at
updated_at
archived_at
```

Rules:

```text
Documents belong to the same party and business.
Party hard deletion is restricted when documents exist.
DELETE /documents/:documentId archives the document.
Raw file bytes are not stored in Party tables.
file_reference stores the secured object-store key or signed-access reference.
All real file access must be authorized by the storage layer.
```

Frontend:

```text
Party detail -> Documents tab
Add document reference
View active and archived document records
Open HTTP(S) references
Archive document
```

---

# 30. Audit

Implemented audit timeline:

```text
Party Created
Party Updated
Role Changed
GSTIN Added
GSTIN Edited
GSTIN Archived
Address Added/Changed
Contact Added/Changed
Bank Account Added/Changed
Payment Terms Changed
Accounting Mapping Changed
Party Archived
Party Restored
```

Stored audit metadata:

```text
before
after
user
timestamp
reason
```

Frontend:

```text
Party detail -> Audit tab
Paginated latest events
Actor label
Action label
Captured fields summary
```

---

# 31. Sales Integration

Sales uses:

```text
customer_id
customer_gst_registration_id
billing_address_id
shipping_address_id
```

On posting, snapshot:

```text
party identity
GST registration
billing address
shipping address
```

---

# 32. Purchase Integration

Purchase uses:

```text
supplier_id
supplier_gst_registration_id
supplier_address_id
```

On posting, snapshot supplier data.

---

# 33. POS Integration

POS supports:

```text
walk-in customer
named party
```

A named customer uses the existing Party.

Posted POS sale stores:

```text
party_id
party_snapshot
```

---

# 34. Payment/Receipt Integration

Customer:

```text
Party
  -> Receivable
     -> Receipt
        -> Allocation
```

Supplier:

```text
Party
  -> Payable
     -> Payment
        -> Allocation
```

Party Master supplies identity/defaults.

Payment/Receipt Engine owns settlement.

---

# 35. GST Reconciliation

Supplier matching should primarily use:

```text
supplier GSTIN
invoice number
invoice date
```

Party name is supplementary, not the primary matching key.

---

# 36. CA Workflow

CA should be able to review:

```text
Party
GST registrations
Sales
Purchases
AR/AP
Receipts
Payments
Outstanding
Reconciliation
Audit
```

CA changes to master data must obey permissions and audit rules.

---

# 37. Import

Complete Party Import:

```text
CSV/XLSX
  ↓
Column Mapping
  ↓
Validation
  ↓
Duplicate Detection
  ↓
Preview
  ↓
Confirm
  ↓
Create/Update
```

Validate:

```text
party identity
role
GSTIN
PAN
codes
addresses
payment terms
GST registered address mappings
```

Never silently create duplicate parties.

---

# 38. Export

Support:

```text
Party Master
Customer Register
Supplier Register
GSTIN Register
Address Register
Contact Register
Bank Register
Outstanding Register
```

Export must obey permissions.

---

# 39. Archive/Restore

Archive:

```text
PARTY.status = ARCHIVED
```

Archived party:

```text
cannot be selected for new normal transactions
```

Historical transactions remain available.

Restore should explicitly reactivate the Party and any required role/child records.

Do not silently restore every archived GSTIN/address.

---

# 40. Security

Every request:

```text
Authenticated User
  ↓
Business Membership
  ↓
Party Ownership
  ↓
Module Permission
  ↓
Branch restriction where applicable
```

CA access:

```text
CA Membership
  ↓
CA-Business relationship
  ↓
Client Business
```

Never trust client-provided business IDs.

---

# 41. Database Integrity

Require:

```text
UNIQUE(business_id, customer_code)
UNIQUE(business_id, supplier_code)
UNIQUE(business_id, GSTIN)
UNIQUE(business_id, party_id) for role profiles
```

Primary constraints:

```text
one active primary GSTIN
one active primary address
one active primary contact
one non-archived primary bank account
```

Composite business-scoped foreign keys must protect:

```text
party
GST registration
address
branch
warehouse
payment term
ledger account
```

Historical parties must not be hard-deleted.

---

# 42. API Completeness

Required current APIs:

```text
GET/POST/PATCH/DELETE /parties
GET/POST/PATCH/DELETE /parties/:id/gst-registrations
GET/POST/PATCH/DELETE /parties/:id/addresses
GET/POST/PATCH/DELETE /parties/:id/contacts
GET/POST/PATCH/DELETE /parties/:id/bank-accounts
POST/PATCH /parties/:id/customer
POST/PATCH /parties/:id/supplier
GET/POST /payment-terms
```

Target operational APIs:

```text
GET /parties/:id/transactions
GET /parties/:id/ledger
GET /parties/:id/outstanding
GET /parties/:id/aging
GET /parties/:id/reconciliation
GET /parties/:id/audit
GET/POST /parties/import
GET /parties/export
```

---

# 43. UX Completion Gate

The Party module is complete only when:

```text
[ ] Identity
[ ] Customer
[ ] Supplier
[ ] Multi-GSTIN
[ ] GSTIN -> Registered Address
[ ] Multiple Addresses
[ ] Multiple Contacts
[ ] Multiple Bank Accounts
[ ] Commercial Terms
[ ] Accounting Mapping
[ ] Branch Preferences
[ ] Transactions
[ ] Ledger
[ ] Outstanding
[ ] Aging
[x] Documents
[x] Audit
[ ] Import
[ ] Export
[ ] Archive/Restore
[ ] Security
```

---

# 44. Important Boundary

Party Master does NOT own:

```text
GST calculation
Journal posting
Live stock
Inventory valuation
Payment allocation
AR/AP settlement logic
GST returns
E-Invoice
E-Way Bill
```

It owns:

```text
external-party identity
party roles
party tax identities
party addresses
contacts
bank information
commercial defaults
accounting mappings
party relationships
```

---

# 45. Final Rule

> A complete GSTfy Party is a long-lived external-party identity with all legal, GST, contact, address, banking, commercial, accounting, branch, historical, reporting, and audit relationships required by the rest of the business system. Transactions consume this master, but the Party Master never becomes the source of truth for balances, tax calculations, stock, or journals.
