# PARTY-MASTER.md — GSTfy Customer, Supplier & Party Master

## 0. Purpose

The Party Master represents an external person/business that participates in GSTfy transactions.

A party can be:
```text
CUSTOMER
SUPPLIER
BOTH
```

Party identity, GST registrations, addresses, contacts, commercial terms and accounting relationships are separate concerns.

## 1. Core model

```text
PARTY
 |
 +-- Customer Profile
 +-- Supplier Profile
 +-- GST Registrations
 +-- Addresses
 +-- Contacts
 +-- Bank Accounts
 +-- Commercial Terms
 +-- Accounting Profile
 +-- Branch Preferences
```

Do not maintain unrelated customer and supplier master systems.

## 2. `parties`

```text
id
business_id
party_type
display_name
legal_name
trade_name
short_name
pan
status
notes
created_at
updated_at
created_by
updated_by
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

Used parties must not be hard-deleted.

## 3. Customer/Supplier roles

Use:
```text
party_customer_profiles
party_supplier_profiles
```

A party may have both.

Example:
```text
ABC Ltd
   ├── Customer
   └── Supplier
```

Do not create two party identities.

## 4. GST registrations

Never store only `party.gstin`.

Create:

```text
party_gst_registrations
-----------------------
id
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
```

Constraint:
```text
UNIQUE(party_id, gstin)
```

Supports:
```text
Party
 ├── TN GSTIN
 ├── KA GSTIN
 └── KL GSTIN
```

## 5. Registered/unregistered parties

Registered:
```text
GSTIN present
```

Unregistered:
```text
GSTIN null
registration status UNREGISTERED
```

Do not require GSTIN for every party. Transaction-level GST rules determine when it is mandatory.

## 6. Tax identifiers

If special tax identifiers are required, use:

```text
party_tax_identifiers
---------------------
party_id
identifier_type
identifier_value
status
```

Possible:
```text
GSTIN
UIN
PAN
OTHER
```

Do not overload the GSTIN field for unrelated identifiers.

## 7. PAN

Store:
```text
pan
```

PAN does not replace GSTIN and should not be used as the party primary key.

## 8. Addresses

Create:

```text
party_addresses
---------------
id
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
```

Address types:
```text
REGISTERED
BILLING
SHIPPING
OFFICE
WAREHOUSE
OTHER
```

A party may have many addresses.

## 9. Address snapshots

Posted invoices/purchases must snapshot the actual address used.

Correct:
```text
Party master → current address
Transaction → historical address snapshot
```

Changing a customer's address must not change old invoices.

## 10. Contacts

Create:

```text
party_contacts
--------------
id
party_id
name
designation
email
phone
mobile
is_primary
status
```

Optional roles:
```text
BILLING_CONTACT
SALES_CONTACT
PURCHASE_CONTACT
```

## 11. Customer profile

Recommended:

```text
party_customer_profiles
-----------------------
party_id
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
CUS-000001
```

Constraint:
```text
UNIQUE(business_id, customer_code)
```

## 12. Supplier profile

Recommended:

```text
party_supplier_profiles
-----------------------
party_id
supplier_code
credit_days
default_payment_term_id
default_purchase_address_id
default_gst_registration_id
preferred_warehouse_id
status
```

Supplier code:
```text
SUP-000001
```

## 13. Commercial terms

Customer:
```text
credit limit
credit days
payment terms
price group
discount group
sales representative
```

Supplier:
```text
payment terms
lead time
supplier price group
preferred warehouse
```

These are defaults, not immutable transaction facts.

## 14. Payment terms

Examples:
```text
IMMEDIATE
7_DAYS
15_DAYS
30_DAYS
45_DAYS
CUSTOM
```

Due date is calculated by the transaction layer from invoice date + applicable terms.

## 15. Bank accounts

Create:

```text
party_bank_accounts
-------------------
id
party_id
bank_name
account_name
account_number
ifsc
branch
account_type
is_primary
status
```

Protect sensitive values and do not display full account numbers unnecessarily.

## 16. Accounting profile

Create:

```text
party_accounting_profiles
-------------------------
party_id
receivable_account_id
payable_account_id
advance_receipt_account_id
advance_payment_account_id
```

A party with both roles can have receivable and payable accounts.

## 17. Opening balance

Never implement:
```text
customer.balance = 100000
```

Instead create an opening-balance accounting entry.

Balances must be derived from accounting activity.

## 18. Outstanding logic

Customer:
```text
Invoices
+ debit adjustments
- credit adjustments
- receipts allocated
= outstanding
```

Supplier:
```text
Purchases
+ debit adjustments
- credit adjustments
- payments allocated
= outstanding
```

Do not maintain the balance as the primary source of truth.

## 19. Payment allocation

Create:

```text
payment_allocations
-------------------
payment_id
document_id
allocated_amount
```

Support:
```text
full payment
partial payment
multiple payments
advance
unallocated payment
```

## 20. Customer/Supplier branch preference

Parties are business-wide.

Optional:
```text
party_branch_profiles
---------------------
party_id
branch_id
sales_rep_id
price_group_id
payment_term_id
default_address_id
```

Do not duplicate party records per branch.

Example:
```text
XYZ Ltd
  ├── Chennai branch preference
  └── Madurai branch preference
```

## 21. Multiple GSTIN selection

The transaction must select the correct party GST registration.

Example:
```text
Party: XYZ Ltd
  TN GSTIN
  KA GSTIN
```

Invoice:
```text
party_gst_registration_id = TN
```

Another transaction:
```text
party_gst_registration_id = KA
```

Do not duplicate XYZ Ltd as two parties.

## 22. GSTIN validation

At minimum:
```text
format validation
state-code consistency check
```

Later:
```text
external GST verification
```

Do not claim a GSTIN is government-verified unless an actual verification service confirms it.

## 23. GST registration history

Use:
```text
effective_from
effective_to
```

Historical transactions reference/snapshot the registration actually used.

## 24. Search

Search by:
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

## 25. Duplicate detection

Hard block:
```text
duplicate GSTIN within same business/party context
duplicate customer code
duplicate supplier code
```

Warn for:
```text
similar name
same phone
same email
same PAN
```

Do not auto-merge parties.

## 26. Party status

`INACTIVE`:
```text
not selectable for new normal transactions
historical transactions remain visible
```

`BLOCKED`:
may block selected transaction roles according to business policy.

## 27. Party API

Core:
```text
GET    /api/v1/parties
POST   /api/v1/parties
GET    /api/v1/parties/:id
PATCH  /api/v1/parties/:id
DELETE /api/v1/parties/:id
```

Roles:
```text
POST  /api/v1/parties/:id/customer
POST  /api/v1/parties/:id/supplier
PATCH /api/v1/parties/:id/customer
PATCH /api/v1/parties/:id/supplier
```

GST:
```text
GET    /api/v1/parties/:id/gst-registrations
POST   /api/v1/parties/:id/gst-registrations
PATCH  /api/v1/parties/:id/gst-registrations/:registrationId
DELETE /api/v1/parties/:id/gst-registrations/:registrationId
```

Addresses:
```text
GET    /api/v1/parties/:id/addresses
POST   /api/v1/parties/:id/addresses
PATCH  /api/v1/parties/:id/addresses/:addressId
DELETE /api/v1/parties/:id/addresses/:addressId
```

## 28. Create Party UI

Sections:

### Basic
```text
Name *
Party Type
Roles: Customer / Supplier / Both
PAN
```

### GST
```text
Registered / Unregistered
GSTIN
State
Taxpayer type
```

### Address
```text
Registered/Billing address
Shipping address
```

### Contacts
```text
Contact person
Phone
Email
```

### Commercial
Customer:
```text
Credit limit
Payment terms
Price group
```

Supplier:
```text
Payment terms
Lead time
```

### Bank
```text
Bank
Account
IFSC
```

Advanced:
```text
Branch defaults
Accounting mapping
Notes
```

## 29. Minimum fields

Customer:
```text
display_name
role = CUSTOMER
```

Supplier:
```text
display_name
role = SUPPLIER
```

GSTIN/address fields are conditional based on party registration and transaction requirements.

## 30. Party + Transaction

Sales:
```text
customer_id
party_gst_registration_id
billing_address_snapshot
shipping_address_snapshot
```

Purchase:
```text
supplier_id
party_gst_registration_id
supplier_invoice_number
supplier_invoice_date
supplier_address_snapshot
```

## 31. Party + GST reconciliation

Purchase transactions must retain:
```text
supplier GSTIN
supplier invoice number
supplier invoice date
supplier legal name
taxable value
tax values
```

Reconciliation should match using combinations such as:
```text
supplier GSTIN
document number
document date
taxable value
tax amounts
```

Do not rely only on party name.

## 32. Party audit events

Audit:
```text
PARTY_CREATED
PARTY_UPDATED
GSTIN_ADDED
GSTIN_UPDATED
ADDRESS_ADDED
ADDRESS_UPDATED
CUSTOMER_PROFILE_UPDATED
SUPPLIER_PROFILE_UPDATED
BANK_ACCOUNT_ADDED
PARTY_BLOCKED
PARTY_DEACTIVATED
```

GST identity changes should capture before/after state.

## 33. Security

All party APIs must be business scoped.

```text
authenticated user
   ↓
business membership
   ↓
party ownership
```

CA access must be validated through the existing CA-business relationship.

## 34. Tests

```text
[ ] Customer create
[ ] Supplier create
[ ] Both-role party
[ ] Registered party
[ ] Unregistered party
[ ] Multiple GSTINs
[ ] Multiple addresses
[ ] Multiple contacts
[ ] Customer code uniqueness
[ ] Supplier code uniqueness
[ ] GSTIN duplicate handling
[ ] Party deactivation
[ ] Historical transaction visibility
[ ] GSTIN state validation
[ ] Address snapshot
[ ] Customer credit limit
[ ] Supplier terms
[ ] Opening balance through accounting entry
[ ] Payment allocation
[ ] Cross-business access blocked
[ ] CA linked-business access works
```

## 35. Definition of done

```text
[ ] One common party model
[ ] Customer profile
[ ] Supplier profile
[ ] Both roles
[ ] Multiple GST registrations
[ ] Registered/unregistered parties
[ ] Multiple addresses
[ ] Multiple contacts
[ ] Commercial terms
[ ] Accounting profile
[ ] Opening balances
[ ] Party codes
[ ] Search
[ ] Duplicate detection
[ ] Historical snapshots
[ ] Audit
[ ] Tenant-safe APIs
[ ] Tests
```

## Final rule

> GSTfy should maintain one external Party identity and attach customer/supplier roles, GST registrations, addresses, contacts, commercial terms and accounting relationships to it. A transaction chooses the applicable party GST registration and snapshots the identity used at posting time.
