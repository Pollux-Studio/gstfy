# INVENTORY-ENGINE.md — GSTfy Inventory & Stock Engine

## 0. Purpose

The Inventory Engine is the source of truth for physical stock movement and inventory value.

GSTfy currently has:

```text
Organization ✅
Party Master ✅
Product Engine ✅
Core Voucher ✅
Accounting Engine ✅
Tax Engine ✅
Sales v1 ✅
Purchase v1 ✅
POS v1 ✅
```

Inventory now connects these layers:

```text
Sales / Purchase / POS / Returns / Transfers
                    |
              Inventory Engine
                    |
       +------------+------------+
       |            |            |
   Stock Ledger   Valuation   Warehouses
       |            |            |
       +------------+------------+
                    |
              Accounting Engine
```

Core rule:

> Product Engine defines item configuration; Inventory Engine owns stock quantity and inventory cost/value; Tax Engine owns GST; Accounting Engine records financial effects.

---

# 1. Source of Truth

Do not use:

```text
items.stock_quantity
products.current_stock
```

as the primary source.

Use:

```text
inventory_transactions
```

as the source of truth.

A cached balance may exist:

```text
inventory_balances
```

but it must be rebuildable from the transaction ledger.

---

# 2. Inventory Movement Types

Initial:

```text
OPENING_STOCK
PURCHASE
SALE
SALES_RETURN
PURCHASE_RETURN
TRANSFER_OUT
TRANSFER_IN
ADJUSTMENT_IN
ADJUSTMENT_OUT
DAMAGE
EXPIRY
```

Future:

```text
JOB_WORK_OUT
JOB_WORK_RETURN
REPAIR_OUT
REPAIR_RETURN
CONSIGNMENT_IN
CONSIGNMENT_OUT
```

---

# 3. Inventory Transaction

Conceptual:

```text
inventory_transactions
----------------------
id
business_id
voucher_id
item_id
warehouse_id
branch_id nullable
movement_type
quantity_in
quantity_out
source_unit
base_quantity
unit_cost
inventory_value
batch_id nullable
serial_id nullable
transaction_date
reason nullable
created_by
created_at
```

Every posted movement must have a source voucher/event.

---

# 4. Quantity Convention

Use one clear convention.

Preferred:

```text
quantity_in >= 0
quantity_out >= 0
```

Never store:

```text
quantity_in = -10
```

A movement direction is represented by the movement type and the in/out column.

---

# 5. Product Boundary

Product Engine provides:

```text
item_id
base_unit
UQC
inventory_enabled
batch_tracking
serial_tracking
default_warehouse
reorder_level
```

Inventory Engine owns:

```text
stock quantity
warehouse balance
stock movement
inventory value
stock availability
```

---

# 6. Warehouse Boundary

Inventory operates primarily on:

```text
warehouse_id
```

Do not equate:

```text
branch_id = warehouse_id
```

Support:

```text
5 branches
1 central warehouse
```

Example:

```text
Chennai Central Warehouse
   +-- Chennai
   +-- Madurai
   +-- Salem
   +-- Coimbatore
   +-- Tirunelveli
```

---

# 7. Sales/Dispatch Location

A sale may contain:

```text
sales_branch = Madurai
dispatch_warehouse = Chennai Central
```

The stock reduction occurs against the dispatch warehouse.

Do not automatically reduce stock from the branch merely because the sale originated there.

---

# 8. Stock Availability

Internal service:

```text
getAvailableStock(itemId, warehouseId)
```

Result:

```text
quantityOnHand
inventoryValue
```

Future:

```text
reserved
available
```

Reservation must not reduce physical stock unless the business workflow explicitly posts it.

---

# 9. Negative Stock Policy

Business-level setting:

```text
ALLOW
WARN
BLOCK
```

If:

```text
BLOCK
```

then:

```text
requested quantity > available quantity
```

must prevent posting.

If:

```text
WARN
```

allow with an auditable warning.

Do not hard-code one behavior for all businesses.

---

# 10. Opening Stock

Opening stock must be an inventory transaction:

```text
OPENING_STOCK
```

Example:

```text
Laptop
100 PCS
₹50,000/unit
```

creates a stock movement and appropriate opening accounting treatment.

Do not keep opening stock only in Product Master.

---

# 11. Unit Conversion

Product Engine may define:

```text
base_unit = MTR
purchase_unit = BOX
conversion_factor = 100
```

Purchase:

```text
2 BOX
```

Inventory:

```text
+200 MTR
```

Preserve the source unit and conversion information on the transaction.

---

# 12. Cost vs Selling Price

Inventory cost is not sales price.

Example:

```text
Purchase cost = ₹50,000
Sales price   = ₹60,000
```

Inventory carries:

```text
₹50,000
```

Sales carries:

```text
₹60,000 revenue
```

Do not use invoice selling rate as COGS.

---

# 13. Inventory Valuation

Architecture must support:

```text
FIFO
WEIGHTED_AVERAGE
```

Future:

```text
STANDARD_COST
SPECIFIC_IDENTIFICATION
```

Implement one method initially if needed, but keep the data model extensible.

The business should eventually choose an inventory valuation policy.

---

# 14. Cost Layers

If FIFO is implemented, use a cost-layer structure such as:

```text
inventory_cost_layers
---------------------
id
item_id
warehouse_id
source_transaction_id
quantity_remaining
unit_cost
created_at
```

Do not implement layers unless the selected valuation method requires them.

---

# 15. Inventory Value

A movement should carry or resolve:

```text
unit_cost
inventory_value
```

For an inbound:

```text
quantity × cost
```

For an outbound:

```text
cost determined by valuation policy
```

Do not derive inventory value from sales rate.

---

# 16. COGS

For a sale:

```text
Sale
  |
Inventory OUT
  |
Valuation
  |
COGS
```

Example:

```text
Sales = 60,000
Cost = 50,000
```

Financial effect:

```text
Customer Dr 60,000
    Sales Cr 60,000

COGS Dr 50,000
    Inventory Cr 50,000
```

Inventory Engine determines the cost effect; Accounting Engine posts the journal.

---

# 17. Purchase Flow

```text
Purchase Bill
    |
Tax Engine
    |
Inventory Engine
    |
STOCK IN
    |
inventory value/cost
    |
Accounting Engine
```

The purchase accounting policy may use an inventory asset or purchase account depending on the configured accounting model.

---

# 18. Sales Flow

```text
Sales Invoice
    |
Tax Engine
    |
Inventory Engine
    |
validate stock
    |
STOCK OUT
    |
calculate COGS
    |
Accounting Engine
```

---

# 19. POS Flow

POS must use the same inventory path:

```text
POS
 |
Sales Transaction
 |
Tax Engine
 |
Inventory OUT
 |
Accounting
```

No POS-specific stock logic.

---

# 20. Returns

### Sales Return

```text
Original Sale
    |
Returned item/quantity
    |
Inventory +Qty
    |
valuation/cost recovery
```

### Purchase Return

```text
Original Purchase
    |
Returned item/quantity
    |
Inventory -Qty
```

Tax and AR/AP adjustments belong to Tax/Accounting/Transaction engines.

---

# 21. Stock Transfer

Tables:

```text
stock_transfers
stock_transfer_lines
```

Transfer lifecycle:

```text
DRAFT
DISPATCHED
IN_TRANSIT
RECEIVED
CANCELLED
```

Flow:

```text
Source Warehouse
      |
DISPATCH
      |
IN TRANSIT
      |
RECEIVE
      |
Destination Warehouse
```

Do not increase destination stock before receipt when the configured workflow uses in-transit inventory.

---

# 22. Internal vs Different GST Registration

Inventory Engine only handles physical movement.

The transaction/tax layer decides the legal GST treatment.

Same operational context:

```text
Warehouse A -> Warehouse B
```

may be a stock transfer.

Different GST registrations:

```text
TN GSTIN -> KA GSTIN
```

must be passed through the GST transaction/compliance rules.

Inventory must not make tax decisions.

---

# 23. Inventory Adjustments

Adjustment command:

```text
item
warehouse
quantity
direction
reason
user
date
```

Types:

```text
ADJUSTMENT_IN
ADJUSTMENT_OUT
DAMAGE
EXPIRY
```

Every adjustment creates a ledger event and audit record.

---

# 24. Batch Tracking

When Product Engine says:

```text
batch_tracking = true
```

support:

```text
batch_number
manufacturing_date
expiry_date
quantity
unit_cost
```

Do not require batch for products without batch tracking.

---

# 25. Serial Tracking

When:

```text
serial_tracking = true
```

support:

```text
serial_number
item_id
warehouse_id
source_transaction_id
status
```

Statuses can include:

```text
IN_STOCK
SOLD
RETURNED
DAMAGED
TRANSFERRED
```

Do not enable serial requirements for every item.

---

# 26. Inventory Balance Projection

Optional performance table:

```text
inventory_balances
------------------
business_id
item_id
warehouse_id
quantity_on_hand
inventory_value
updated_at
```

This is a projection.

Source:

```text
inventory_transactions
```

must remain authoritative.

---

# 27. Inventory Rebuild

Internal/admin capability:

```text
rebuildInventoryBalance(itemId, warehouseId)
```

It reconstructs:

```text
quantity
inventory value
```

from the ledger.

This helps recover/reconcile projections.

---

# 28. Warehouse Stock API

```text
GET /api/v1/inventory/warehouses/:id/stock
```

Returns:

```text
item
SKU
unit
quantity_on_hand
inventory_value
```

---

# 29. Item Inventory Ledger API

```text
GET /api/v1/inventory/items/:id/ledger
```

Filters:

```text
from
to
warehouse
branch
movement_type
```

Result:

```text
date
voucher
movement_type
quantity_in
quantity_out
running_quantity
unit_cost
inventory_value
```

---

# 30. Transfer API

```text
POST /api/v1/inventory/transfers
POST /api/v1/inventory/transfers/:id/dispatch
POST /api/v1/inventory/transfers/:id/receive
POST /api/v1/inventory/transfers/:id/cancel
```

Do not allow arbitrary edits after dispatch.

---

# 31. Inventory Posting Service

Internal:

```text
postInventoryMovement(command)
```

Input:

```text
voucherId
itemId
warehouseId
movementType
quantity
sourceUnit
baseQuantity
unitCost
batchId
serialId
```

Output:

```text
inventoryTransactionId
newQuantity
inventoryValue
costEffect
```

Frontend must never submit a final stock balance.

---

# 32. Atomic Transaction

A stock-affecting sale/purchase should post atomically:

```text
BEGIN
  |
Voucher
  |
Tax
  |
Stock validation
  |
Inventory movement
  |
COGS/value effect
  |
Accounting journal
  |
GST entries
  |
COMMIT
```

On failure:

```text
ROLLBACK
```

Inventory must never succeed while the corresponding financial transaction fails.

---

# 33. Idempotency

Inventory posting must follow the core idempotency contract.

Retrying the same command must not create duplicate stock movements.

---

# 34. Concurrency

For:

```text
stock = 10

Request A = sell 8
Request B = sell 7
```

with policy:

```text
BLOCK
```

only one request may consume stock successfully.

Use transactional row locking/atomic checks as appropriate.

---

# 35. Branch Reporting

Branch stock should be derived from the configured branch-to-warehouse relationships.

Do not duplicate physical stock merely because a warehouse serves multiple branches.

---

# 36. Low Stock

Use Product Engine configuration:

```text
reorder_level
minimum_stock
maximum_stock
```

Inventory compares current quantity and reports:

```text
LOW_STOCK
OUT_OF_STOCK
```

Do not modify Product Master based on stock quantity.

---

# 37. Inventory Permissions

Recommended:

```text
INVENTORY_VIEW
INVENTORY_CREATE
INVENTORY_ADJUST
INVENTORY_TRANSFER
INVENTORY_RECEIVE
INVENTORY_VALUATION
```

Product permissions remain separate.

---

# 38. Audit

Audit:

```text
STOCK_OPENING
STOCK_IN
STOCK_OUT
STOCK_ADJUSTED
TRANSFER_CREATED
TRANSFER_DISPATCHED
TRANSFER_RECEIVED
BATCH_CREATED
SERIAL_ASSIGNED
```

Store:

```text
user
timestamp
source voucher
warehouse
item
quantity
reason
```

---

# 39. Validation Errors

Use:

```text
ITEM_NOT_FOUND
WAREHOUSE_NOT_FOUND
WAREHOUSE_NOT_ALLOWED
INSUFFICIENT_STOCK
NEGATIVE_STOCK_NOT_ALLOWED
INVALID_UNIT
INVALID_CONVERSION
BATCH_REQUIRED
BATCH_NOT_FOUND
SERIAL_REQUIRED
SERIAL_NOT_AVAILABLE
SERIAL_ALREADY_SOLD
INVALID_TRANSFER
TRANSFER_ALREADY_RECEIVED
TRANSFER_NOT_DISPATCHED
INVALID_QUANTITY
INVENTORY_PERIOD_LOCKED
```

---

# 40. Tests

### Movement

```text
[ ] Opening stock
[ ] Purchase
[ ] Sale
[ ] Sales return
[ ] Purchase return
[ ] Adjustment in/out
[ ] Damage
[ ] Expiry
```

### Warehouse

```text
[ ] One branch / one warehouse
[ ] Five branches / one central warehouse
[ ] One branch / multiple warehouses
[ ] One warehouse / multiple branches
```

### Transfer

```text
[ ] Draft
[ ] Dispatch
[ ] In transit
[ ] Receive
[ ] Cancel
[ ] Duplicate receive rejected
```

### Stock policy

```text
[ ] Enough stock
[ ] Block insufficient stock
[ ] Warn insufficient stock
[ ] Allow negative stock
```

### Concurrency

```text
[ ] Concurrent sales against same stock
[ ] No oversell under BLOCK
```

### Integration

```text
[ ] Purchase creates stock-in
[ ] Sales creates stock-out
[ ] POS creates stock-out
[ ] Returns reverse movement
[ ] Accounting receives inventory/COGS effect
```

---

# 41. Definition of Done

```text
[ ] Inventory transaction ledger
[ ] Stock balance projection
[ ] Warehouse stock
[ ] Opening stock
[ ] Purchase stock-in
[ ] Sales stock-out
[ ] Returns
[ ] Adjustments
[ ] Transfers
[ ] Negative-stock policy
[ ] Valuation boundary
[ ] COGS boundary
[ ] Branch/warehouse support
[ ] Batch foundation
[ ] Serial foundation
[ ] Audit
[ ] Permissions
[ ] APIs
[ ] Tests
[ ] Accounting integration
[ ] Sales integration
[ ] Purchase integration
[ ] POS integration
```

# 42. What Inventory Engine Must NOT Own

```text
GST calculation
CGST/SGST/IGST
Cess
RCM
Party Master
Product CRUD
Customer balance
Supplier balance
Invoice rendering
GST returns
E-Invoice
E-Way Bill
CA workflow
```

# 43. Final rule

> Inventory Engine is the source of truth for physical stock movement and inventory cost/value. Product Engine supplies item configuration, Tax Engine supplies GST treatment, Accounting Engine records financial effects, and transaction modules orchestrate the business event.
