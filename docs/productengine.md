# PRODUCT-ENGINE.md — GSTfy Product Engine

## Purpose
The Product Engine resolves the correct product configuration for future transactions. It is the bridge between Product Master and Sales, Purchase, Inventory, Tax and Accounting.

Core rule:
> Product Master supplies defaults. Product Engine resolves effective configuration. Posted transactions snapshot the resolved state. Product Engine never owns live stock, GST posting or financial balances.

## 1. Architecture
```text
Product Master
   -> Product Engine
      -> Tax profile
      -> Unit/UQC
      -> Price
      -> Inventory profile
      -> Supplier mapping
      -> Accounting mapping
   -> Sales / Purchase / Inventory / Tax
```

## 2. Core tables
```text
items
item_tax_profiles
item_units
item_prices
item_suppliers
item_barcodes
item_inventory_profiles
item_accounting_profiles
```

## 3. Items
```text
id
business_id
name
item_type
sku
description
category_id
brand_id
manufacturer
model_number
status
created_at
updated_at
created_by
updated_by
```

Item types:
```text
GOODS
SERVICE
```
Constraint:
```text
UNIQUE(business_id, sku)
```
Statuses:
```text
ACTIVE
INACTIVE
ARCHIVED
```
Used items must not be hard-deleted.

## 4. Tax profiles
```text
item_tax_profiles
-----------------
id
item_id
taxability
hsn_sac
gst_rate
cess_rule_id nullable
effective_from
effective_to
status
created_at
updated_at
```
Taxability:
```text
TAXABLE
EXEMPT
NIL_RATED
NON_GST
ZERO_RATED
```

Do not store CGST/SGST/IGST rates as product master authority. Store the applicable GST rate; Tax Engine determines components from transaction context.

## 5. Tax effective dating
Example:
```text
2026-04-01 -> GST 18%
2026-10-01 -> GST 12%
```
Resolve the profile using transaction date. Reject overlapping active profiles for the same item unless an explicit priority/version system exists.

## 6. HSN/SAC
Goods use HSN; services use SAC. Maintain a versioned/configurable `hsn_sac_codes` master rather than a permanently hard-coded list.

## 7. Cess
Do not model cess only as a percentage. Keep a `cess_rule_id`/rule relationship so the Tax Engine can support percentage, specific-unit and other rule-driven formulas.

Product Engine identifies the applicable rule; Tax Engine calculates the actual cess amount.

## 8. Units/UQC
```text
item_units
----------
id
item_id
base_unit
secondary_unit
conversion_factor
gst_uqc
```
Keep the internal inventory unit distinct from GST UQC.

Maintain a versioned `uqc_codes` master.

## 9. Unit conversion
Example:
```text
Base unit = MTR
Purchase unit = BOX
1 BOX = 100 MTR
```
Transaction should preserve source quantity/unit and the normalized inventory quantity.

## 10. Pricing
```text
item_prices
-----------
id
item_id
price_type
price
tax_mode
currency
minimum_quantity
customer_group_id
effective_from
effective_to
status
```
Price types can include:
```text
RETAIL
WHOLESALE
DEALER
ONLINE
SPECIAL
PURCHASE
```

Tax mode:
```text
EXCLUSIVE
INCLUSIVE
```
Tax calculation remains the Tax Engine responsibility.

## 11. Supplier mapping
```text
item_suppliers
--------------
id
item_id
supplier_id
supplier_item_code
purchase_price
minimum_order_quantity
lead_time_days
is_preferred
effective_from
effective_to
status
```
A product may have multiple suppliers.

## 12. Inventory profile
```text
item_inventory_profiles
-----------------------
id
item_id
track_inventory
default_warehouse_id
reorder_level
minimum_stock
maximum_stock
batch_tracking
serial_tracking
```
Services normally have inventory tracking off. Product Engine does not calculate live stock.

## 13. Opening stock
Opening stock must become an Inventory transaction. Do not make an opening quantity in `items` the source of truth.

## 14. Accounting profile
```text
item_accounting_profiles
------------------------
id
item_id
sales_account_id
purchase_account_id
inventory_account_id
sales_return_account_id
purchase_return_account_id
```
These are defaults. Accounting Engine owns final posting.

## 15. Product resolution
Expose a domain operation such as:
```text
resolveItem(itemId, transactionContext)
```
Context should include:
```text
business_id
transaction_date
branch_id
warehouse_id
customer_id/supplier_id
transaction_type
```
Return:
```text
item
active tax profile
active unit profile
active price
inventory configuration
accounting mapping
```

## 16. Transaction snapshot
At posting, snapshot at least:
```text
item_id
description_snapshot
sku_snapshot
hsn_sac_snapshot
uqc_snapshot
taxability_snapshot
gst_rate_snapshot
cess_rule_snapshot
quantity
source_unit
conversion_factor
rate
rate_tax_mode
```
This is mandatory for historical integrity.

## 17. Example resolution
Input:
```text
item = Laptop
date = 2026-08-15
branch = Madurai
warehouse = Chennai Central
```
Product Engine returns defaults such as:
```text
SKU
HSN/SAC
UQC
Taxability
GST rate
Price
Inventory tracking
Accounting mappings
```
Tax Engine then determines CGST/SGST/IGST and actual cess based on the transaction.

## 18. Status and deletion
`ACTIVE` = selectable for new transactions.
`INACTIVE` = not selectable for new normal transactions.
`ARCHIVED` = hidden from normal search.
Used products remain for history.

## 19. APIs
Core:
```text
GET    /api/v1/products
POST   /api/v1/products
GET    /api/v1/products/:id
PATCH  /api/v1/products/:id
DELETE /api/v1/products/:id
```
Tax profiles:
```text
GET    /api/v1/products/:id/tax-profiles
POST   /api/v1/products/:id/tax-profiles
PATCH  /api/v1/products/:id/tax-profiles/:profileId
```
Prices:
```text
GET    /api/v1/products/:id/prices
POST   /api/v1/products/:id/prices
PATCH  /api/v1/products/:id/prices/:priceId
```
Suppliers:
```text
GET    /api/v1/products/:id/suppliers
POST   /api/v1/products/:id/suppliers
PATCH  /api/v1/products/:id/suppliers/:supplierId
DELETE /api/v1/products/:id/suppliers/:supplierId
```
Barcodes:
```text
GET    /api/v1/products/:id/barcodes
POST   /api/v1/products/:id/barcodes
DELETE /api/v1/products/:id/barcodes/:barcodeId
```

## 20. Validation
```text
[ ] Name required
[ ] SKU required and unique per business
[ ] Goods/service valid
[ ] HSN/SAC valid where required
[ ] Taxability valid
[ ] GST rate valid
[ ] No overlapping effective tax profiles
[ ] Base unit valid
[ ] UQC valid where required
[ ] Conversion factor > 0
[ ] Prices >= 0
[ ] No ambiguous overlapping prices
```

## 21. Search
Search by:
```text
name
SKU
barcode
HSN/SAC
brand
model
supplier code
```
Invoice picker can show:
```text
Name
SKU
Stock availability (from Inventory Engine)
Unit
GST rate
Price
```

## 22. Product + Tax Engine
Product Engine provides:
```text
taxability
HSN/SAC
GST rate
cess rule
```
Tax Engine decides:
```text
taxable value
CGST
SGST
IGST
cess amount
classification
```

## 23. Product + Inventory
Product Engine provides:
```text
item
base unit
inventory tracking
batch/serial flags
default warehouse
```
Inventory Engine decides:
```text
stock available
quantity movement
valuation
transfer
return
adjustment
```

## 24. Product + Accounting
Product Engine provides default account mappings. Accounting Engine decides the final journal entries.

## 25. Permissions
Recommended:
```text
PRODUCT_VIEW
PRODUCT_CREATE
PRODUCT_EDIT
PRODUCT_DEACTIVATE
PRODUCT_DELETE
PRODUCT_TAX_EDIT
PRODUCT_PRICE_EDIT
PRODUCT_IMPORT
PRODUCT_EXPORT
```
Tax edits should require stronger permissions than description edits.

## 26. Audit
Audit:
```text
PRODUCT_CREATED
PRODUCT_UPDATED
PRODUCT_DEACTIVATED
TAX_PROFILE_CREATED
TAX_PROFILE_UPDATED
PRICE_CREATED
PRICE_UPDATED
SUPPLIER_LINKED
SUPPLIER_UNLINKED
BARCODE_ADDED
ACCOUNTING_MAPPING_UPDATED
```
Tax changes must preserve before/after and effective date.

## 27. Do not implement here
Do not put these inside Product Engine:
```text
Live stock calculation
CGST/SGST/IGST calculation
Invoice totals
Journal posting
Customer balance
Supplier balance
GST return generation
```

## 28. Tests
```text
[ ] Goods create
[ ] Service create
[ ] Duplicate SKU rejection
[ ] HSN/SAC validation
[ ] Taxability cases
[ ] Effective tax dates
[ ] Tax profile overlap rejection
[ ] UQC validation
[ ] Unit conversion
[ ] Price profiles
[ ] Supplier mapping
[ ] Multiple barcodes
[ ] Deactivation
[ ] Used product cannot be deleted
[ ] Historical snapshot survives master changes
[ ] Cross-business access blocked
```

## 29. Definition of done
```text
[ ] Product CRUD
[ ] Tax profiles
[ ] HSN/SAC
[ ] UQC/unit profile
[ ] Pricing
[ ] Supplier mapping
[ ] Inventory profile
[ ] Accounting mapping
[ ] Barcode mapping
[ ] Effective dating
[ ] Snapshot support
[ ] Validation
[ ] Audit
[ ] Tenant security
[ ] Search
[ ] Tests
```

## Final rule
> Product Engine resolves effective product configuration for a transaction. It provides defaults and historical snapshots but never owns live stock, GST posting, accounting balances, or financial reporting.
