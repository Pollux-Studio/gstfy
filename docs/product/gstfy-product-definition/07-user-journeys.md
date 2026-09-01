# 07 User Journeys

## Journey A: Self-Service Dealer

### 1. Register

The dealer registers the business with GSTIN, contact details, phone verification, and workspace URL.

Outcome:

- Business tenant created.
- Owner account created.
- Default branch and warehouse available.
- Invoice and GST settings available.

### 2. Configure Basics

The owner sets:

- Invoice prefix.
- Invoice template.
- Watermark.
- GST slabs.
- Cess rules if needed.
- Barcode connector if needed.
- Inventory policy.

Outcome:

- Business is ready for sales, purchases, product setup, and GST reports.

### 3. Add Products

The owner creates products with:

- Name.
- SKU.
- HSN/SAC.
- GST rate.
- Price and margin.
- Unit.
- Barcode.
- Default warehouse.
- Stock tracking options.

Outcome:

- Products are ready for POS, purchase, tax, and inventory flows.

### 4. Add Parties

The owner adds customers and suppliers with:

- GSTIN.
- Registered addresses.
- Contacts.
- Bank accounts.
- Payment terms.

Outcome:

- B2B billing, purchases, ITC, and party ledger are ready.

### 5. Daily Sales

Cashier or owner uses POS:

- Search or add customer name.
- Add products.
- Confirm payment mode.
- Complete bill.

Outcome:

- Sales invoice created.
- Tax calculated.
- Stock reduced.
- Accounting posted.
- Receipt recorded if paid.

### 6. Purchase Entry

Owner enters supplier bills:

- Select supplier.
- Enter supplier invoice number and date.
- Add products.
- Select warehouse.
- Post purchase.

Outcome:

- Purchase bill recorded.
- Stock increased.
- Input GST captured.
- Payable created.

### 7. Payment Tracking

Owner records:

- Customer receipts.
- Supplier payments.
- Allocations.
- Advances or unapplied amounts.

Outcome:

- Receivables and payables stay current.

### 8. GST Review

Before filing, owner opens GST workspace:

- Review GSTR summaries.
- Review ITC reconciliation.
- Resolve exceptions.
- Export filing data.

Outcome:

- Owner knows whether the business is ready to file.

## Journey B: CA-Referred Dealer

### 1. CA Creates Invite

CA creates a referral code and optional invite email.

Outcome:

- Client gets onboarding path.
- Referral code links business to CA.

### 2. Business Registers

Dealer registers with the CA referral code.

Outcome:

- Business is linked to CA dashboard.
- CA can view filing readiness.

### 3. Dealer Runs Daily Operations

Dealer or staff uses sales, purchases, products, parties, inventory, and money flows.

Outcome:

- Data remains structured and reviewable.

### 4. CA Reviews Client

CA dashboard shows:

- Active clients.
- Filing readiness.
- GSTIN status.
- Sales and purchase summary.
- Exceptions.

Outcome:

- CA can file or advise with less manual data collection.

## Journey C: Staff Or Cashier

### 1. Owner Adds User

Owner creates staff user with role and branch access.

Outcome:

- User gets login credentials.
- First login requires password change.

### 2. Staff Works In Assigned Branch

Cashier can access only permitted modules, usually POS or sales.

Outcome:

- Staff can bill without seeing restricted settings or reports.

## Journey D: Multi-Branch Dealer

### 1. Owner Adds Branch

Owner creates branch and links storage model.

Outcome:

- Branch can have independent or main warehouse-managed stock.

### 2. Owner Adds Warehouses

Warehouses are linked to branches.

Outcome:

- Inventory can be tracked by physical location.

### 3. Owner Controls Access

Users are assigned to specific branches.

Outcome:

- Cashiers and managers see only their operating branch context.

