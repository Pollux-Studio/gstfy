# GSTFY Automation and API Resilience

This document records the automation/resilience pass added after the dashboard, payment, inventory, and e-invoice engines were in place.

## Problem Being Solved

GSTFY should reduce manual dealer work. The dealer should not need to understand every downstream ledger effect after posting a sale, purchase, POS bill, opening stock, or bank statement import.

The product behavior should be:

- Post the source document once.
- Let GSTFY update accounting, inventory, tax, and reconciliation records.
- Queue slow or retryable provider work safely.
- Show automation status only when the owner needs to review a failure.

## Frontend API Resilience

The shared web API client now handles:

- Request timeouts.
- Safe retry for idempotent requests.
- In-flight GET de-duplication.
- Automatic `Idempotency-Key` header forwarding when a payload contains `idempotencyKey`.
- Human-readable timeout/network errors.
- Auth refresh timeout protection for `/auth/session`.

Current defaults:

| Request type | Timeout |
|---|---:|
| GET / HEAD | 12 seconds |
| Mutations | 25 seconds |
| File uploads | 60 seconds |
| Auth refresh | 10 seconds |

TanStack Query remains conservative:

- `staleTime`: 1 minute
- `gcTime`: 10 minutes
- no window-focus refetch
- no mutation retry by default

This prevents the workspace from repeatedly hitting APIs when switching tabs, focusing the browser, or rendering multiple components that ask for the same GET payload.

## Backend Automation Foundation

Added migration:

```text
0054_automation_resilience_engine.sql
```

New tables:

```text
business_automation_settings
automation_jobs
automation_job_events
```

### Business Automation Settings

Each business can control:

| Setting | Default | Purpose |
|---|---:|---|
| `auto_stock_accounting_enabled` | true | Verify stock/accounting sync after posting |
| `auto_e_invoice_enabled` | true | Queue eligible e-invoice generation |
| `bank_auto_match_high_confidence_enabled` | true | Auto-match confident bank entries |
| `notify_automation_failures` | true | Surface failures for owner review |

Settings are lazily created for existing businesses.

## Automation Queue

Added queue support using:

```text
bullmq
ioredis
```

Environment variables:

```env
REDIS_URL=
QUEUE_WORKER_ENABLED=false
QUEUE_CONCURRENCY=3
QUEUE_JOB_TIMEOUT_MS=30000
QUEUE_MAX_ATTEMPTS=3
QUEUE_BACKOFF_BASE_MS=2000
```

If Redis is not configured, the backend still persists automation jobs and logs that the job was not pushed to Redis. This keeps local development working without Redis.

If `QUEUE_WORKER_ENABLED=true`, Redis is required.

## Job Types

Supported job types:

```text
stock.posted-document.sync
stock.opening-stock.sync
einvoice.generate
bank-reconciliation.auto-match
gst-report.refresh
filing-review.prepare
```

Only the first four have processors now. GST report refresh and filing review are reserved for later automation.

## Stock Automation

Stock posting itself already happens synchronously through the accounting domain voucher pipeline.

Current behavior:

```text
Purchase post
  -> accounting voucher
  -> inventory transaction PURCHASE
  -> warehouse balance update
  -> automation job verifies stock transaction exists

Sales/POS post
  -> accounting voucher
  -> inventory transaction SALE
  -> warehouse balance update
  -> automation job verifies stock transaction exists

Opening stock
  -> inventory transaction OPENING_STOCK
  -> warehouse balance update
  -> automation job verifies stock transaction exists
```

This is intentional. Inventory movement is financial data, so it should happen in the posting transaction, not later in a best-effort background worker.

## E-Invoice Automation

When a posted sales invoice is eligible for e-invoice, GSTFY can queue:

```text
einvoice.generate
```

The processor:

- checks e-invoice permissions
- re-checks source eligibility
- reuses existing records if present
- validates payload before generation
- retries only technical/provider failures
- skips business-ineligible documents

B2C and non-eligible documents are skipped, not failed.

## Bank Reconciliation Automation

Auto-match is queued after:

- bank statement import
- posted receipt with bank-like method
- posted payment with bank-like method

Bank-like methods:

```text
bank
upi
card
cheque
```

Cash is intentionally excluded from bank reconciliation automation.

## Settings UI

Business Settings now has an `Automation` tab.

It exposes:

- Stock posting automation
- E-invoice automation
- Bank auto-match automation
- Failure notifications
- Recent automation job status

The UI is intentionally compact. Automation should not become another daily management screen for a dealer.

## Failure Behavior

Automation jobs are durable:

- `queued`
- `running`
- `completed`
- `failed`
- `retry_scheduled`
- `skipped`

Failed jobs store:

- attempt count
- last error code
- last error message
- next retry time
- event history

Finished jobs are not re-enqueued for the same source document.

## Important Product Rule

Automation should simplify work, not hide financial consequences.

Therefore:

- Source document posting remains authoritative.
- Inventory/accounting/tax writes that affect books happen synchronously.
- Provider calls and matching work happen asynchronously with retries.
- Failures are visible and recoverable.

