# GSTFY Product And System Reference

> Single orientation document for product, frontend, backend, and workflow decisions.

## 1. Product Goal

GSTFY is a GST-first business operations SaaS for Indian small and micro businesses. It helps a dealer run daily business operations and prepare GST compliance data without needing to understand accounting software or government return formats.

The core product promise is:

```text
Sell goods -> Record purchases -> Track stock -> Track money -> Review GST -> File with confidence
```

GSTFY is not intended to become a broad enterprise ERP. The product should save the dealer time, reduce GST mistakes, and reduce dependence on a CA for routine data preparation. A CA must still be able to review, correct, approve, and manage filing work where required.

## 2. User Paths

### Self-Service Dealer

The dealer signs up directly, configures the business, performs daily billing and purchase entry, and receives a guided GST review. The dealer should see plain-language tasks rather than accounting or tax-engine terminology.

### CA-Referred Dealer

The CA invites or refers the business. The dealer continues daily operations while the CA can review filing readiness, exceptions, ITC, reports, and filing work from the CA workspace.

### Staff User

The business owner creates staff users with roles and branch/module permissions. A cashier may use POS without seeing GST settings, accounting, or filing controls.

### CA User

The CA has a separate practice workspace with client management, referral codes, client summaries, and filing-readiness visibility.

## 3. Current Repository Architecture

```text 
gstfy/
├── apps/
│   ├── web/                 # Next.js web application
│   ├── backend/             # Fastify + PostgreSQL API
│   └── mobile/              # Started separately; web is the active focus
├── packages/
│   ├── core/                # Shared feature/plan constants
│   ├── ui/                  # Shared UI package
│   ├── eslint-config/
│   └── typescript-config/
└── docs/                    # Product and engine documentation
```

### Actual Technology Stack

| Layer | Current implementation |
|---|---|
| Web framework | Next.js App Router |
| React | React 19 |
| Frontend data | TanStack Query |
| Frontend styling | Tailwind CSS |
| Frontend UI | Local shadcn/Base UI components in `apps/web/components/ui` plus shared packages |
| Backend runtime | Node.js + TypeScript ESM |
| Backend HTTP | Fastify 5 |
| Database | PostgreSQL |
| ORM/queries | Drizzle ORM and `postgres` driver |
| Validation | Zod |
| Authentication | JWT access token, HTTP-only refresh cookie, DB sessions, Firebase phone verification |
| Files | Cloudflare R2 boundary for documents/images |
| Charts | Recharts |
| Localization | English, Hindi, Tamil |
| Package manager | pnpm |

Do not assume that the old planning documents' NestJS/Supabase references describe the running system. The current implementation is the Fastify backend under `apps/backend`.

## 4. Tenant And Security Model

The business is the primary tenant boundary. Business-owned records include users, GST registrations, branches, warehouses, parties, products, invoices, purchases, stock, accounting, payments, GST records, reports, and filing data.

The backend uses authenticated request context and business access checks. Routes should never trust a business ID supplied by the browser without checking the authenticated user's membership and permissions.

Relevant security rules:

- Keep backend secrets out of `NEXT_PUBLIC_*` variables.
- Use access tokens for API requests and HTTP-only refresh cookies for session continuation.
- Use Zod at API boundaries.
- Use idempotency keys for retryable financial mutations.
- Keep posted financial documents and audit events immutable.
- Never store a GST password in the frontend or ask a dealer to send it to GSTFY.
- Use role, module, branch, and action permissions for restricted operations.

## 5. Backend Module Map

All application routes are registered under the `/api/v1` prefix in `apps/backend/src/app.ts`. The active backend modules are:

| Module | Responsibility |
|---|---|
| `auth` | Business/CA registration, login, phone verification, password reset, email verification, sessions, logout |
| `account` | User account and personal settings |
| `businesses` | Business access and tenant context |
| `organization` | GST registrations, locations, branches, warehouses, business structure |
| `users` | Tenant users, roles, permissions, branch access, invitations |
| `ca` | CA practice, clients, referrals, invites, client summaries |
| `parties` | Customer/supplier master, GST registrations, contacts, addresses, ledgers |
| `products` | Goods/services, SKU, HSN/SAC, price, tax, barcode, inventory profile |
| `tax` | Central GST calculation and tax context |
| `sales` | Sales invoices and posting |
| `pos` | Fast counter billing and checkout |
| `purchases` | Purchase bills, posting, supplier bills, purchase-side tax |
| `adjustments` | Sales returns, purchase returns, credit notes, debit notes |
| `accounting` | Ledger accounts, journals, trial balance, P&L, balance sheet, day book |
| `inventory` | Stock, warehouses, opening stock, adjustments, transfers, low stock |
| `payment-receipt` | Receipts, payments, allocations, aging, cash flow, bank reconciliation |
| `payment-terms` | Payment terms and due dates |
| `gst-reconciliation` | Purchase tax records, external GST records, matching, exceptions, ITC actions |
| `gst-reporting` | GST reporting runs, GSTR-1, GSTR-3B, review, exports |
| `gst-filing` | Filing runs, validation, submit/status/retry/cancel/acknowledgement adapter flow |
| `e-invoice` | E-invoice eligibility and IRN workflow boundary |
| `automation` | Background automation and queued work |
| `ops` | Operational logs and monitoring |
| `service-status` | Health status for POS, sales, purchase, inventory, warehouse, branch, and related services |
| `settings` | Business, invoice, GST presets, printer, and user settings |
| `support`/`feedback` | Support and feedback workflows |
| `avatar`/`firebase`/`mail` | Supporting infrastructure |

## 6. Frontend Structure

The web app uses App Router pages and page-specific components under `apps/web/components`. The current UI is dashboard-oriented with a shared shell, sidebar, topbar, command menu, role-aware navigation, tables, dialogs, and empty states.

Important frontend areas:

- `components/dashboard`: dashboard shell, overview, command menu, topbar.
- `components/gst`: GST workspace and its reporting/reconciliation panels.
- `components/sales`, `components/pos`: sales and counter billing.
- `components/purchases`: purchase bills and supplier workflows.
- `components/products`: product master and product detail/upsert dialogs.
- `components/parties`: customer/supplier master and detail views.
- `components/inventory`: stock and warehouse workflows.
- `components/accounting`: ledger and financial reports.
- `components/payment-receipt`: money movement and bank reconciliation.
- `components/settings`: business, invoice, GST, printer, and account settings.
- `components/ca`: CA dashboard and client management.
- `components/ui`: local shadcn/Base UI primitives.

Frontend data fetching should use TanStack Query. Components should not own raw API-fetching logic. API response types belong in the related `apps/web/lib/*` module or a `types` module.

## 7. Daily Dealer Workflow

### Onboarding

1. Dealer registers a business and owner account.
2. GSTIN and business details are captured.
3. Default branch and warehouse are created.
4. The dealer configures invoice, tax, and inventory defaults.
5. Products and parties are added.

### Daily Sales

1. User opens Sales or POS.
2. User searches/selects a customer or enters a walk-in name.
3. User adds products and quantities.
4. The tax engine determines CGST/SGST or IGST from seller and place-of-supply context.
5. User chooses cash, UPI, card, cheque, or another supported payment mode.
6. Sale is posted.

Expected effects:

- Sales invoice is created.
- Tax snapshot is stored.
- Stock decreases for tracked items.
- Accounting entries are posted.
- Receipt/payment is recorded when applicable.
- PDF invoice can be viewed/downloaded.

### Daily Purchase Entry

1. User selects or creates the supplier.
2. User enters supplier invoice number and date.
3. User adds purchased goods/services and GST details.
4. User selects place of supply and warehouse where required.
5. User posts the purchase bill.

Expected effects:

- Purchase bill is posted.
- Stock increases for tracked goods.
- Input GST is captured in purchase tax records.
- Supplier payable is created.
- Accounting entries are posted.
- The purchase becomes available for future GST reconciliation and ITC review.

### Money Movement

The user records customer receipts and supplier payments separately from invoices and bills. The system supports allocation, advances, unapplied amounts, reversal, aging, receivables, payables, and cash-flow reporting. Bank reconciliation can import statements, suggest matches, manually match, and undo matches.

## 8. Tax And Financial Rules

The tax engine is the single place for shared GST calculation. Sales, POS, purchases, returns, credit notes, debit notes, and reports must not reimplement tax logic independently.

Core rules:

- Intra-state supply uses equal CGST and SGST components.
- Inter-state supply uses IGST.
- Place of supply determines the treatment.
- HSN/SAC and configured tax profiles determine rates.
- Tax amounts are stored as snapshots on posted documents.
- Financial values use decimal-safe server-side calculations.
- Posted documents are not deleted; they are corrected through return/credit/debit/reversal workflows.

## 9. GST Workspace: Current Workflow

The detailed current GST page is documented in [Current GST Tab Process](./GST%20Tab/current-gst-tab-process.md). Its current tabs are:

```text
Reconciliation | ITC | Filing Review | GSTR-1 | GSTR-3B | Filing History | Exceptions
```

### Reconciliation

Compares posted purchase tax records against external GST records. The row can show book values, external values, match status, differences, confidence, ITC status, and exceptions.

Supported match outcomes include matched, partial match, value mismatch, tax mismatch, date mismatch, duplicate, books only, external only, manual review, and not matched.

The current detailed actions are:

- Unmatch an existing match with an audit reason.
- Resolve an attached exception with a resolution reason.
- Filter by supplier/invoice search, match status, ITC status, GST registration, and period.
- Export CSV.

### ITC

Shows purchase records and their ITC workflow status. The current row actions are behind a three-dot menu:

- Mark eligible.
- Defer ITC.
- Reject ITC.
- Claim ITC.
- Reverse claim.

The shared action dialog shows book tax, external tax, difference, current status, eligible amount, already claimed amount, and remaining claimable amount. It requires an audit reason; claim also asks for a claim period.

The current ITC states are `NOT_REVIEWED`, `ELIGIBLE`, `PARTIALLY_ELIGIBLE`, `DEFERRED`, `INELIGIBLE`, `CLAIMED`, `REVERSED`, and `REJECTED`.

These are internal workflow states, not a substitute for complete GST legal validation. The backend must protect transitions and amounts before production use.

### Filing Review

Works on a GST reporting run for the selected GSTIN and period:

```text
Generate -> Review -> Mark ready -> Approve -> Lock
```

The reporting run is a Gstfy snapshot used to prepare the return. It is not automatically a successful government filing.

### GSTR-1 And GSTR-3B

These panels display generated reporting datasets and offer supported exports. GSTR-1 represents outward supplies. GSTR-3B provides consolidated return values including liability and ITC-related values.

### Filing History

Filing History creates and tracks a filing run for GSTR-1 or GSTR-3B. It supports validation, submit, status polling, retry, cancellation, details, and acknowledgement checks. Mock filing modes exist for development and must not be represented as live GSTN filing.

### Exceptions

Lists reconciliation exceptions for the selected period. Typical exceptions include missing invoice, GSTIN mismatch, invoice mismatch, value mismatch, tax mismatch, duplicate, books only, and external only.

### Current GSTR-2B Limitation

The GST page no longer exposes manual `Import GSTR-2B` controls to the dealer. The backend still has external GST import endpoints from the earlier foundation, but the final design should use an authorized GST/GSP connector and automatic synchronization.

## 10. GST Data Flow

The intended data flow is:

```text
Posted purchase bill
        |
        v
Purchase tax record
        |
        +------------------+
        |                  |
        v                  v
GST/GSP GSTR-2B       Matching engine
source snapshot ------------+
                             |
              +--------------+--------------+
              |                             |
              v                             v
       Reconciliation result          ITC recommendation
              |                             |
              +--------------+--------------+
                             v
                  GST reporting run
                             |
                    +--------+--------+
                    v                 v
                 GSTR-1            GSTR-3B
                             |
                             v
                    Filing review/run
```

GSTR-2B is government-generated from supplier-filed data. GSTFY retrieves it; GSTFY does not create the government statement. The live connector is not implemented yet.

## 11. GST/GSP Integration Requirement

The dealer should not upload GSTR-2B manually in the normal workflow. GSTFY needs an approved GST API/GSP/ASP integration.

Expected connection flow:

1. Dealer enters and verifies GSTIN.
2. GSTFY explains the data access and asks for authorization.
3. Dealer enables GST portal API access when required.
4. Dealer authorizes GSTFY or its GSP provider.
5. Dealer verifies OTP when required.
6. Backend stores encrypted connection metadata and expiry, never the GST password.
7. Backend fetches GSTR-2B for the GSTIN and period.
8. Backend validates, normalizes, snapshots, and reconciles the data.

The sync system must handle:

- Session/token expiry.
- Reconnection and OTP requirements.
- Monthly availability and QRMP period rules.
- Provider failures and retry backoff.
- Manual `Sync now` for permitted users.
- Idempotency and duplicate prevention.
- Source revisions or regenerated statements.
- Audit events for authorization and sync operations.

Manual JSON import can remain a CA-only fallback while the connector is unavailable. It should not be the dealer's primary experience.

## 12. Proposed Dealer-First Workflow

The full proposal is documented in [Proposed Dealer-First GST Workflow](./GST%20Tab/proposed-dealer-first-gst-workflow.md).

The main product change is role-sensitive complexity:

### Dealer Surface

- GST connection status.
- Monthly completion progress.
- Purchase confirmations.
- Simple missing/mismatch tasks.
- Plain-language ITC warnings.
- CA handoff/review status.
- Approve monthly summary.

### CA/Accountant Surface

- Full reconciliation table.
- Match confidence and differences.
- ITC eligibility and claim decisions.
- Defer/reject/reverse actions.
- Exception queue.
- Filing review and filing history.
- Detailed exports and audit history.

Technical labels such as `BOOKS_ONLY`, `EXTERNAL_ONLY`, `DEFERRED`, and `PARTIALLY_ELIGIBLE` belong in the CA surface or an explanation drawer, not as the dealer's primary language.

## 13. Backend-to-Frontend Contract Pattern

For each module:

```text
Frontend component
    -> frontend API client in apps/web/lib
    -> /api/v1 backend route
    -> authenticated business access
    -> Zod input validation
    -> domain/service layer
    -> PostgreSQL/Drizzle transaction
    -> typed response
    -> TanStack Query cache update/invalidation
```

Financial mutations should generally:

1. Validate the request.
2. Resolve tenant and permissions.
3. Load the source record and current state.
4. Enforce legal/application state transitions.
5. Perform related accounting, tax, inventory, or payment changes in a transaction.
6. Write audit/idempotency information.
7. Return a typed result.
8. Invalidate or update the relevant frontend query cache.

## 14. Current UI And Navigation Notes

- The dashboard has a permission-aware sidebar and command menu.
- The service-status header control is currently commented out temporarily; its backend/API implementation remains available for later use.
- The visible GST page is still the detailed operator workspace, not yet the dealer-first flow.
- Empty states use the shared empty-state components and Iconiq icon-stack where already implemented.
- Financial values should be right-aligned and use Indian currency formatting.
- GSTINs should be uppercase, monospace, and visually distinct.
- Dates should use Indian `DD MMM YYYY` formatting in user-facing views.
- Actions that affect financial/compliance records should use confirmation dialogs and audit reasons.

## 15. Current Gaps And Risks

### Compliance Integration

- GSTIN verification provider is not production-connected.
- Live GST/GSP integration for GSTR-2B is not implemented.
- E-invoice and e-way bill provider integrations need production credentials and provider-specific adapters.
- Actual direct government filing must not be assumed from mock filing flows.

### ITC Hardening

- Enforce the ITC state machine in the backend.
- Prevent claiming more than the remaining eligible component amounts.
- Protect concurrent claim/defer/reject/reverse operations.
- Preserve immutable claim and reversal history.
- Use decimal arithmetic and explicit tolerance rules.

### Product Experience

- The GST workspace is currently too dense for low-literacy dealers.
- CA actions and dealer actions need role-aware separation.
- Technical statuses need plain-language explanations.
- The dealer should not be asked to upload GSTR-2B when automatic synchronization is available.

### Infrastructure

- Add production-grade queue scheduling for periodic connector sync.
- Add connector health, authorization expiry, retry, and audit visibility.
- Add observability around slow or failed GST provider calls.

## 16. Development Rules For Future Agents

1. Read this file and the relevant engine document before changing a module.
2. Read the existing implementation before inventing a new service or abstraction.
3. Treat `apps/backend` and `apps/web` as the current source of truth.
4. Keep business logic in backend/domain or shared utilities, not only in React components.
5. Do not use raw `any`; define and narrow types.
6. Do not duplicate GST tax calculations across modules.
7. Do not overwrite book values with external GST values.
8. Do not silently convert mismatches into rejected ITC.
9. Do not expose CA-level controls in the dealer workflow without a clear permission/product reason.
10. Do not add manual GSTR-2B upload as the primary dealer flow.
11. Use existing UI primitives and local patterns.
12. Run focused typecheck/lint/tests for touched modules.
13. Preserve unrelated user worktree changes.

## 17. Related Documents

- [Current GST Tab Process](./GST%20Tab/current-gst-tab-process.md)
- [Proposed Dealer-First GST Workflow](./GST%20Tab/proposed-dealer-first-gst-workflow.md)
- [Current System Capabilities](./gstfy-product-definition/09-current-system-capabilities.md)
- [Roadmap And Open Gaps](./gstfy-product-definition/10-roadmap-and-open-gaps.md)
- [ITC And GST Reconciliation Engine](./ITC%20and%20GST/itc-and-gst-reconciliation-engine.md)
- [ITC Hardening Checklist](./ITC%20and%20GST/fix-needed-ITC.md)
- [GST Reporting Engine](./Gst%20Reports/GST-REPORTING-FILING-REVIEW-ENGINE.md)
- [GST Filing Integration](./GST%20Filing/gst-filing-integration-engine.md)
- [Purchase Workflow](./purchase.md)
- [Implementation Status](./implementation-status.md)

