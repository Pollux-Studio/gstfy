# Gstfy Documentation

## Product

| Document | Description |
|---|---|
| [overview](product/overview.md) | High-level product and repo overview |
| [product-reference](product/product-reference.md) | Single source of truth for product, frontend, backend, and workflow decisions |
| [branch-setup](product/branch-setup.md) | Branch, location, and warehouse setup flow |
| [auth-flow](product/auth-flow.md) | Registration and login flow |

### Product Definition

The [gstfy-product-definition](product/gstfy-product-definition/) folder contains the structured product research and planning documents — problem statement, user empathy maps, SWOT analysis, feature inventory, solution map, user journeys, product principles, current capabilities, and roadmap.

---

## Infrastructure

| Document | Description |
|---|---|
| [automation-and-resilience](infrastructure/automation-and-resilience.md) | Background automation jobs and API resilience patterns |
| [redis-bullmq-setup](infrastructure/redis-bullmq-setup.md) | Redis and BullMQ queue setup for background jobs |
| [r2-storage-optimization](infrastructure/r2-storage-optimization.md) | Cloudflare R2 storage rules and optimization |

---

## Engine Specifications

Each engine folder contains the domain spec, implementation summary, and fix notes (where applicable).

### Core & Foundation

| Document | Description |
|---|---|
| [core-engine](engine/core/) | Core voucher and transaction posting engine |
| [foundation-fixes](engine/foundation/) | Organization foundation fixes (GST registrations, branches, financial years) |

### Domain Engines

| Folder | Description |
|---|---|
| [product](engine/product/) | Product engine — HSN, UQC, pricing, tax profiles, inventory profiles |
| [parties](engine/parties/) | Party master — customers, suppliers, GST registrations, addresses |
| [accounting](engine/accounting/) | Double-entry accounting engine — journal entries, ledger accounts |
| [tax](engine/tax/) | GST tax calculation and classification engine |
| [inventory](engine/inventory/) | Inventory and stock movement engine |
| [payments](engine/payments/) | Payment and receipt engine — AR/AP settlement, allocation |
| [returns](engine/returns/) | Returns, credit notes, and debit notes engine |
| [itc](engine/itc/) | Input tax credit and GST reconciliation engine |

### GST Compliance

| Folder | Description |
|---|---|
| [gst-reporting](engine/gst-reporting/) | GST reporting, filing review, and compliance layer |
| [gst-filing](engine/gst-filing/) | GST filing integration — statutory submission boundary |
| [e-invoice](engine/e-invoice/) | E-invoice and IRN integration (IRP5) |
