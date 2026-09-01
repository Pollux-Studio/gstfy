# Parties User Tutorial

This guide explains how to use the GSTFY Parties section.

The Parties section stores every customer and supplier used by sales, purchases, POS, accounting, payment, GST reporting, and CA review workflows.

## 1. What Is A Party?

A Party is an external person or business.

A Party can be:

```text
Customer
Supplier
Customer + Supplier
```

Do not create the same business twice as one customer and one supplier. Create one Party and assign both roles.

## 2. Open Parties

Go to:

```text
Dashboard -> Parties
```

The Parties page includes:

```text
Search
Role filter
Status filter
Sortable table
Bulk actions
Add Party button
```

The list loads 15 parties first. More rows load automatically when the table is scrolled to the bottom.

## 3. Add A Party

Click:

```text
Add Party
```

Fill the basic details:

```text
Party type
Roles
Display name
Legal name
Trade name
PAN
Status
Notes
```

Required:

```text
Display name
At least one role
```

For a normal walk-in customer, add:

```text
Display name
Customer role
Mobile number
```

For a GST registered business, add:

```text
Legal name
Trade name
PAN
Registered address
GSTIN
Primary contact
Commercial terms
```

## 4. Add Addresses

Add addresses before GST registrations.

Supported address types:

```text
Registered
Billing
Shipping
Office
Warehouse
Other
```

Why this matters:

```text
Each GSTIN can be linked to the exact registered address printed on its GST certificate.
```

Example:

```text
ABC Traders
  Addresses:
    Chennai Registered Office
    Bangalore Registered Office

  GST Registrations:
    TN GSTIN -> Chennai Registered Office
    KA GSTIN -> Bangalore Registered Office
```

## 5. Add GST Registrations

For GST registered parties, add one or more GST registrations.

Fields:

```text
GSTIN
State code
Registration type
Taxpayer type
Effective from
Effective to
Registered address for this GSTIN
Primary GSTIN
```

Registration types:

```text
GST
Composition
UIN
```

Rules:

```text
GSTIN must match valid GSTIN format.
GSTIN first two digits must match the state code.
Same GSTIN cannot be used by another party in the same business.
Only one GSTIN can be primary.
Archived GSTINs are not used for new transactions.
```

Important:

```text
GSTFY currently validates GSTIN format and state code.
It does not yet verify GSTIN through the government GSTN API.
Do not treat "format valid" as "government verified".
```

## 6. Add Contacts

Contacts are used for billing, sales, and purchase communication.

Fields:

```text
Name
Mobile
Email
Designation
Contact role
Primary contact
```

Use the primary contact for default communication.

## 7. Add Bank Accounts

Party bank accounts store customer or supplier bank details.

Fields:

```text
Bank name
Account name
Account number
IFSC
Branch
Account type
Primary
```

GSTFY masks account numbers after saving.

Important:

```text
Party bank accounts are not your business cash/bank ledger accounts.
They are external party bank details only.
```

## 8. Customer Terms

If the Party has the Customer role, configure:

```text
Customer code
Credit limit
Credit days
Default payment term
Default billing address
Default shipping address
Default GSTIN
```

Use this for sales defaults, receivable tracking, and payment due dates.

## 9. Supplier Terms

If the Party has the Supplier role, configure:

```text
Supplier code
Credit days
Lead time days
Default payment term
Default purchase address
Default GSTIN
Preferred warehouse
```

Use this for purchase defaults, payable tracking, inward supply planning, and inventory receiving.

## 10. Duplicate Warnings

GSTFY warns when it finds similar or matching parties.

Warning checks:

```text
Similar name
Same PAN
Same GSTIN
Same email
Same mobile
```

Some duplicate checks are warnings only.

Hard block:

```text
Same GSTIN in the same business is not allowed.
```

## 11. View Party Details

From the table action menu, click:

```text
View details
```

The detail workspace has these tabs:

```text
Overview
GST
Addresses
Contacts
Bank
Commercial
Ledger
Documents
Audit
More
```

## 12. Overview Tab

The Overview tab shows:

```text
PAN
Primary GSTIN
Receivable
Payable
Open sales count
Open purchase count
Primary address
Primary contact
Primary bank account
Recent ledger status
```

## 13. GST Tab

Use the GST tab to manage all GST registrations.

Actions:

```text
Add GSTIN
Edit GSTIN
Archive GSTIN
Set primary GSTIN
Map GSTIN to registered address
```

## 14. Addresses Tab

The Addresses tab shows all saved addresses and the GSTINs mapped to them.

Use it to verify:

```text
Registered address mapping
Billing address
Shipping address
Office or warehouse address
Primary address
Active or inactive status
```

## 15. Contacts Tab

The Contacts tab shows all contact persons.

Use it to verify:

```text
Primary contact
Billing contact
Sales contact
Purchase contact
Email/mobile details
Active or inactive status
```

## 16. Bank Tab

The Bank tab shows masked external-party bank details.

Use it to verify:

```text
Bank name
IFSC
Account type
Masked account number
Primary bank account
```

## 17. Commercial Tab

The Commercial tab shows role-specific defaults.

Customer side:

```text
Customer code
Credit limit
Credit days
Payment term
Default billing/shipping/GST references
```

Supplier side:

```text
Supplier code
Credit days
Lead time days
Payment term
Default purchase/GST/warehouse references
```

## 18. Ledger Tab

The Ledger tab shows AR/AP movement for the Party.

It includes:

```text
Receivable outstanding
Payable outstanding
Net outstanding
Aging buckets
Recent ledger entries
```

Ledger values are derived from accounting entries.

Important:

```text
Outstanding is not stored directly on the Party.
It is calculated from receivable/payable entries.
```

There is also a full ledger page:

```text
Parties -> View Details -> Ledger -> Open Ledger
```

## 19. Documents Tab

Use the Documents tab to store secured document references.

Examples:

```text
GST certificate
PAN
Bank proof
Agreement
Vendor onboarding document
Other supporting file
```

GSTFY stores:

```text
Document type
Title
File reference
File name
MIME type
File size
Notes
Status
```

Important:

```text
Raw file bytes are not stored in the Party table.
The file reference should point to secured storage.
```

## 20. Audit Tab

The Audit tab shows Party history.

Events include:

```text
Party created
Party updated
Customer/supplier role changed
GSTIN added
GSTIN updated
GSTIN archived
Address added or changed
Contact added or changed
Bank account added or changed
Document added or archived
Party archived
```

Each audit entry shows:

```text
Action
Actor
Timestamp
Captured payload summary
```

## 21. Edit A Party

From the table action menu, click:

```text
Edit
```

You can update:

```text
Basic identity
Roles
Addresses
GST registrations
Contacts
Bank accounts
Commercial defaults
```

If a role is removed:

```text
Customer role removed -> customer profile becomes inactive
Supplier role removed -> supplier profile becomes inactive
```

The profile row is not deleted. Historical transactions remain safe.

## 22. Archive A Party

From the table action menu, click:

```text
Archive
```

Archiving means:

```text
Party is removed from active usage.
Party cannot be selected for new transactions.
Old invoices, POS bills, purchases, and ledger snapshots remain safe.
Party data is not physically deleted.
```

Use archive when a customer or supplier should no longer be used.

## 23. Bulk Actions

Select multiple parties from the table.

Available bulk actions:

```text
Mark active
Mark inactive
Archive selected
```

Bulk archive also preserves historical snapshots.

## 24. Recommended Usage

Regular B2C customer:

```text
Display name
Customer role
Mobile number
```

GST customer:

```text
Display name
Customer role
Legal/trade name
PAN
Registered address
GSTIN mapped to address
Billing contact
Credit terms
```

Supplier:

```text
Display name
Supplier role
GSTIN
Purchase contact
Bank account
Credit days
Lead time
Preferred warehouse
```

Same business as both customer and supplier:

```text
Create one Party
Select Customer and Supplier roles
Fill both profiles
```

## 25. Safety Rules

GSTFY protects historical data by design:

```text
Archive instead of hard delete.
Role removal means soft inactivation.
Transaction snapshots preserve old party details.
Ledger and outstanding are derived from accounting entries.
Party bank accounts are separate from business ledger bank accounts.
```

## 26. Quick Checklist

Before using a Party in transactions, verify:

```text
Correct role is selected.
Display name is clear.
GSTIN is added when required.
GSTIN is mapped to the correct registered address.
Primary contact is available.
Credit terms are correct.
Bank details are saved if needed.
Duplicate warnings are reviewed.
```
