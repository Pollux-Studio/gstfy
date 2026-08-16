# FIX-NEEDED-INVENTORY.md — GSTfy Corrections Before Inventory Engine

## Purpose

GSTfy currently has these foundations implemented:

```text
Organization Foundation
Party Master
Core Voucher Engine
Core Hardening
Product Engine
Accounting Engine
Sales v1
Purchase v1
POS v1
Tax Engine
```

The Tax Engine is now the canonical GST calculation and classification service. Sales, Purchase, and POS use it, and Accounting consumes its results.

The next major engine is Inventory.

Before implementing Inventory, make the following small corrections/guardrails. Do not redesign the completed organization, party, product, accounting, or tax foundations.

---

# 1. Fix Priority

```text
1. Define inventory as an event/ledger source of truth
2. Ensure Sales/Purchase posting cannot fake stock effects
3. Separate physical stock from accounting value
4. Define warehouse/branch ownership boundaries
5. Add transaction snapshot requirements
6. Define negative-stock policy
7. Define inventory valuation policy boundary
8. Add regression tests
9. Then implement Inventory Engine
```

---

# 2. Inventory Must Not Be a Product Field

Do not use:

```text
items.stock_quantity
products.current_stock
```

as the accounting/source-of-truth value.

Correct:

```text
inventory_transactions
       |
stock projection
       |
current stock
```

A cached stock balance may exist for performance, but it must be rebuildable from inventory transactions.

---

# 3. Inventory Movement Must Reference a Source Event

Every posted stock movement must reference:

```text
voucher_id
```

or an appropriate source transaction.

Examples:

```text
PURCHASE
SALE
SALES_RETURN
PURCHASE_RETURN
STOCK_TRANSFER
STOCK_ADJUSTMENT
OPENING_STOCK
DAMAGE
EXPIRY
```

Do not allow arbitrary stock edits without an auditable source event.

---

# 4. Sales/Purchase Must Not Directly Manipulate Stock

Current Sales/Purchase are accounting-focused and Inventory/COGS is intentionally separate.

Keep that boundary.

Final architecture:

```text
Sales
   |
Tax Engine
   |
Inventory Engine
   |
Accounting Engine
   |
Core Posting
```

Not:

```text
Sales route
   |
direct stock update
```

Sales/Purchase modules should send business facts to Inventory Engine.

---

# 5. Separate Quantity from Financial Value

Inventory has two different dimensions:

```text
Quantity
Value
```

A stock movement can have:

```text
quantity
unit_cost
inventory_value
```

Do not treat:

```text
selling price
```

as:

```text
inventory cost
```

Sales price and inventory cost are separate concepts.

---

# 6. Separate Physical Location from Stock Ownership

At MVP:

```text
business
   |
warehouse
   |
item
   |
quantity
```

Later the model can support:

```text
stock_owner
gst_registration
consignment_owner
```

Do not make the physical warehouse itself the legal owner of stock.

---

# 7. Branch vs Warehouse

Keep the completed organizational distinction:

```text
Branch != Warehouse
```

Inventory source-of-truth should primarily use:

```text
warehouse_id
```

A branch can:

```text
use one warehouse
use multiple warehouses
use a central warehouse
have no dedicated warehouse
```

Example:

```text
5 branches
1 central warehouse
```

is valid.

---

# 8. Sales Location vs Dispatch Warehouse

Do not assume:

```text
branch_id = warehouse_id
```

A sales transaction can be:

```text
sales_branch = Madurai
dispatch_warehouse = Chennai Central
```

Inventory must know the physical warehouse from which stock is reduced.

---

# 9. Negative Stock Policy

The business must have a configurable policy:

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
available stock < requested quantity
```

must prevent posting.

Do not hard-code one universal negative-stock behavior.

---

# 10. Inventory Reservation Boundary

Do not implement reservations in the first MVP unless required.

If later supported:

```text
ON_HAND
RESERVED
AVAILABLE
```

where:

```text
available = on_hand - reserved
```

must be derived consistently.

Do not reduce actual stock merely because a quotation/order exists.

---

# 11. Opening Stock

Opening stock must be a real inventory transaction:

```text
OPENING_STOCK
```

It must not be permanently stored only in the Product Master.

Example:

```text
Opening:
Laptop
100 PCS
₹50,000/unit
```

creates:

```text
inventory_transaction
type = OPENING_STOCK
quantity_in = 100
```

and the corresponding accounting opening treatment is handled by Accounting.

---

# 12. Inventory Transaction Snapshot

Every posted stock movement should retain enough source information to explain the movement later:

```text
item_id
item_name_snapshot
sku_snapshot
unit_snapshot
warehouse_id
quantity
unit_cost
inventory_value
voucher_id
transaction_type
transaction_date
batch/serial where applicable
```

Historical inventory reports must not depend on today's Product Master.

---

# 13. Unit Conversion

Product Engine may define:

```text
base_unit
source_unit
conversion_factor
```

Inventory must store the normalized quantity in the base unit.

Example:

```text
Purchase:
2 BOX

1 BOX = 100 MTR

Inventory:
+200 MTR
```

Preserve the original transaction unit as a snapshot.

---

# 14. Tax Engine Boundary

Inventory Engine must not calculate:

```text
CGST
SGST
IGST
Cess
RCM
GST classification
```

Tax Engine owns those.

Inventory may receive the taxable transaction as context but must only determine stock movement/value.

---

# 15. Accounting Boundary

Inventory Engine calculates/maintains:

```text
quantity movement
inventory cost
inventory value
COGS basis
```

Accounting Engine posts the financial effect.

Do not directly write ledger entries from Inventory route handlers.

---

# 16. COGS Boundary

For a sale:

```text
Stock OUT
      |
Inventory valuation
      |
COGS value
      |
Accounting Engine
```

Example:

```text
Sales price = ₹60,000
Cost = ₹50,000
```

Accounting:

```text
Customer Dr 60,000
   Sales Cr 60,000

COGS Dr 50,000
   Inventory Cr 50,000
```

The Inventory Engine determines the cost under the configured valuation method.

---

# 17. Inventory Valuation Policy

The schema must not assume only one valuation method.

Architect for:

```text
FIFO
WEIGHTED_AVERAGE
```

A later policy can add:

```text
STANDARD_COST
SPECIFIC_IDENTIFICATION
```

Do not implement all methods immediately.

The first supported method can be selected at business level, but the data model should preserve the possibility of multiple methods.

---

# 18. Cost Layer Preservation

If FIFO or another layer-based method is introduced, purchase/receipt movements may create cost layers.

Conceptual:

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

Do not implement cost layers if the first MVP uses weighted average, but do not design the core transaction model so that adding layers later becomes impossible.

---

# 19. Stock Movement Types

Initial supported types:

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

# 20. Stock Transfer Lifecycle

A transfer should eventually support:

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
DISPATCHED
      |
IN_TRANSIT
      |
RECEIVED
      |
Destination Warehouse
```

Do not add stock to the destination before the receive event if the business workflow uses in-transit inventory.

---

# 21. Same Registration vs Different GST Registration

Inventory movement alone should not decide GST treatment.

Example:

```text
Warehouse A -> Warehouse B
```

If both are under the same business/GST context, it may be a normal internal stock transfer.

If movement is between separate GST registrations:

```text
TN GSTIN -> KA GSTIN
```

the transaction must be handled by the transaction/tax/compliance layer according to the applicable rules.

Inventory Engine only represents the physical stock movement.

---

# 22. Returns

Sales Return:

```text
stock + quantity
```

Purchase Return:

```text
stock - quantity
```

The Inventory Engine should not independently decide the tax/credit/debit-note treatment.

It receives the validated return command from the transaction layer.

---

# 23. Damage and Expiry

Support inventory adjustment types:

```text
DAMAGE
EXPIRY
ADJUSTMENT_OUT
```

These require:

```text
reason
user
timestamp
warehouse
quantity
```

Financial/tax consequences are handled by Accounting/Tax layers.

---

# 24. Batch Tracking

If Product configuration:

```text
batch_tracking = true
```

stock movement must support:

```text
batch_number
manufacturing_date
expiry_date
quantity
unit_cost
```

Do not require batch data for products without batch tracking.

---

# 25. Serial Tracking

If:

```text
serial_tracking = true
```

each unit may need:

```text
serial_number
item_id
warehouse_id
source_transaction_id
status
```

Sales should consume specific serials when policy requires it.

Do not implement serial tracking for every product by default.

---

# 26. Stock Availability

Provide a service:

```text
getAvailableStock(itemId, warehouseId)
```

and later:

```text
getAvailableStockAcrossBranches(itemId)
```

Do not calculate stock by querying only the Product Master.

---

# 27. Stock Ledger

Provide:

```text
GET /api/v1/inventory/items/:id/ledger
```

Filters:

```text
from
to
warehouse
branch
transaction_type
```

Return:

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

# 28. Warehouse Stock

Provide:

```text
GET /api/v1/inventory/warehouses/:id/stock
```

Return:

```text
item
SKU
unit
quantity_on_hand
inventory_value
```

Later:

```text
reserved
available
```

---

# 29. Branch Stock

Branch stock is a reporting/view concept derived from warehouse relationships.

Do not duplicate stock rows unnecessarily for every branch.

If:

```text
Madurai -> Central Warehouse
```

then branch stock should be derived according to the configured ownership/allocation model.

---

# 30. Inventory Adjustments

Adjustment requires:

```text
item
warehouse
quantity
direction
reason
reference/notes
user
```

Examples:

```text
Found stock
Damaged stock
Expired stock
Counting difference
```

Every adjustment must create a ledger event.

---

# 31. Inventory Posting API

Internal service:

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
batch/serial
```

Output:

```text
inventoryTransactionId
newStockBalance
inventoryValue
costEffect
```

Do not allow frontend clients to arbitrarily submit final stock balances.

---

# 32. Sales Integration

Sale:

```text
Sales Invoice
      |
Tax Engine
      |
Inventory Engine
      |
      +-- STOCK OUT
      +-- calculate COGS
      |
Accounting Engine
      |
Core Posting
```

Inventory should validate stock before final posting if negative stock is blocked.

---

# 33. Purchase Integration

Purchase:

```text
Purchase Bill
      |
Tax Engine
      |
Inventory Engine
      |
      +-- STOCK IN
      +-- determine inventory cost
      |
Accounting Engine
      |
Core Posting
```

---

# 34. POS Integration

POS uses the same Sales/Inventory path:

```text
POS
 |
Sales Transaction
 |
Tax
 |
Inventory OUT
 |
Accounting
```

There must be no separate POS stock engine.

---

# 35. Atomic Posting

For a normal sale:

```text
BEGIN DB TRANSACTION
   |
create voucher
   |
calculate tax
   |
validate stock
   |
create inventory movement
   |
create accounting journal
   |
create GST entries
   |
commit
```

If stock validation or accounting fails:

```text
ROLLBACK
```

Do not let stock and accounting diverge.

---

# 36. Idempotency

Inventory posting must respect the Core idempotency model.

Retrying:

```text
same transaction
same idempotency key
```

must not create duplicate stock movements.

---

# 37. Concurrency

Protect stock from concurrent overselling.

Example:

```text
Available = 10
User A requests 8
User B requests 7
```

If negative stock is blocked, both cannot successfully consume the same 10.

Use database locking/atomic stock checks where necessary.

---

# 38. Inventory Cache

A cached balance table may exist:

```text
inventory_balances
------------------
item_id
warehouse_id
quantity_on_hand
inventory_value
updated_at
```

But it is a projection.

Source of truth:

```text
inventory_transactions
```

There must be a rebuild/reconciliation mechanism later.

---

# 39. Inventory Rebuild

Provide an internal/admin capability:

```text
rebuildInventoryBalance(item, warehouse)
```

It should calculate from transaction history.

This is valuable for detecting corruption or fixing a projection.

---

# 40. Inventory Valuation Reconciliation

Later provide:

```text
inventory ledger quantity
vs
inventory balance projection
vs
accounting inventory asset value
```

Differences should be visible to the CA/accountant.

---

# 41. Accounting Integration

Inventory Engine sends accounting effects such as:

```text
inventory value increase
inventory value decrease
COGS
```

Accounting Engine creates journals.

Do not let Inventory route handlers insert journal lines directly.

---

# 42. Tax Integration

Tax Engine owns:

```text
GST
Cess
RCM
```

Inventory Engine owns:

```text
quantity
cost
stock value
```

A sale therefore has independent effects:

```text
Revenue/GST
Inventory/COGS
```

---

# 43. Database Tables

Recommended core:

```text
inventory_transactions
inventory_balances
inventory_cost_layers
stock_transfers
stock_transfer_lines
batches
serial_numbers
```

Not every table needs to be implemented in the first release.

---

# 44. `inventory_transactions`

```text
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

Do not store both positive quantity and signed quantity inconsistently.

Use one clear convention.

---

# 45. Stock Transfer Tables

```text
stock_transfers
---------------
id
business_id
source_warehouse_id
destination_warehouse_id
status
transfer_date
dispatched_at
received_at
created_by
```

Lines:

```text
stock_transfer_lines
--------------------
id
transfer_id
item_id
quantity
unit
batch/serial where applicable
```

---

# 46. Batch Table

```text
batches
-------
id
business_id
item_id
batch_number
manufacturing_date
expiry_date
status
```

Stock movement contains quantity/cost for the batch.

---

# 47. Serial Table

```text
serial_numbers
--------------
id
business_id
item_id
serial_number
warehouse_id
status
source_transaction_id
```

Status may include:

```text
IN_STOCK
SOLD
RETURNED
DAMAGED
TRANSFERRED
```

Keep the state machine consistent.

---

# 48. Inventory Permissions

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

# 49. Inventory Audit

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

Record:

```text
user
timestamp
source document
warehouse
item
quantity
reason
```

---

# 50. Inventory Reports

Initial:

```text
Stock Summary
Stock Ledger
Warehouse Stock
Low Stock
Out of Stock
Stock Movement
```

Later:

```text
Inventory Valuation
COGS
Branch Stock
Batch Expiry
Serial Register
Dead Stock
Fast/Slow Moving
```

---

# 51. Low Stock

Use Product configuration:

```text
reorder_level
minimum_stock
maximum_stock
```

Inventory Engine compares:

```text
quantity_on_hand
```

against:

```text
reorder_level
```

and reports:

```text
LOW_STOCK
OUT_OF_STOCK
```

Do not mutate product master based on current stock.

---

# 52. Inventory Search

Support:

```text
SKU
item name
barcode
warehouse
batch
serial
```

Do not implement a separate product search engine.

Use Product Engine for item identity and Inventory for stock data.

---

# 53. Validation Errors

Suggested:

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

# 54. Testing

## Stock movement

```text
[ ] Opening stock
[ ] Purchase stock-in
[ ] Sales stock-out
[ ] Sales return
[ ] Purchase return
[ ] Adjustment in
[ ] Adjustment out
[ ] Damage
[ ] Expiry
```

## Warehouses

```text
[ ] One branch/one warehouse
[ ] Five branches/one central warehouse
[ ] One branch/multiple warehouses
[ ] Multiple warehouses/multiple branches
```

## Transfers

```text
[ ] Create transfer
[ ] Dispatch
[ ] In transit
[ ] Receive
[ ] Cancel
[ ] Duplicate receive rejected
```

## Stock validation

```text
[ ] Enough stock
[ ] Insufficient stock blocked
[ ] Warning policy
[ ] Negative allowed policy
```

## Concurrency

```text
[ ] Concurrent sale of same stock
[ ] No oversell when blocked
```

## Historical integrity

```text
[ ] Product name changes
[ ] Product UQC changes
[ ] Product warehouse default changes
[ ] Old inventory transactions remain unchanged
```

## Integration

```text
[ ] Purchase creates stock-in
[ ] Sales creates stock-out
[ ] POS creates stock-out
[ ] Return creates reverse movement
[ ] Accounting receives inventory/COGS effect
```

---

# 55. Definition of Done

```text
[ ] Inventory transaction ledger
[ ] Stock balance projection
[ ] Warehouse stock
[ ] Opening stock
[ ] Purchase stock-in
[ ] Sales stock-out
[ ] Returns
[ ] Adjustments
[ ] Stock transfer
[ ] Negative-stock policy
[ ] Inventory valuation boundary
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

---

# 56. What Inventory Engine Must NOT Own

Do not implement here:

```text
GST calculation
CGST/SGST/IGST
Cess calculation
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

Those remain in their respective engines.

---

# 57. Final Architecture

```text
                 BUSINESS TRANSACTION
                         |
              +----------+----------+
              |                     |
           TAX ENGINE          PRODUCT ENGINE
              |                     |
              +----------+----------+
                         |
                  INVENTORY ENGINE
                         |
          +--------------+--------------+
          |              |              |
       Quantity        Cost        Warehouse
          |              |              |
          +--------------+--------------+
                         |
                  Accounting Engine
                         |
                     Core Posting
```

## Final rule

> Inventory Engine is the source of truth for physical stock movement and inventory cost/value. Product Engine supplies item configuration, Tax Engine supplies GST treatment, Accounting Engine records the resulting financial value/COGS effects, and transaction modules orchestrate the business event.
