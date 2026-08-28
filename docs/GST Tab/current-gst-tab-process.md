# Current GST Tab Process

## Purpose

The GST page is currently an operations workspace for GST reconciliation, input tax credit (ITC) review, GST reporting, and filing-run tracking. It is closer to an accountant or CA console than a simplified dealer workflow.

The page is implemented in:

```text
apps/web/components/gst/gst-workspace-page.tsx
```

The client calls the external backend API through the modules under:

```text
apps/web/lib/gst-reconciliation/api.ts
apps/web/lib/gst-reporting/api.ts
apps/web/lib/gst-filing/api.ts
```

## Initial Page Load

1. The page reads the stored authenticated session and access token.
2. It loads the GST registrations available to the business.
3. The first GST registration is selected automatically unless the user previously selected another registration in the current page session.
4. The period defaults to the current year and month.
5. Reconciliation and ITC data are requested with the selected GSTIN, period, search text, status filters, page number, and page size.
6. Open GST exceptions are loaded for the selected period.
7. The latest GST reporting run is loaded for the selected GSTIN and period.
8. Filing runs are loaded for the selected GSTIN and period.
9. Filing review, GSTR-1, GSTR-3B, and filing-detail data are loaded only when their corresponding run or detail is available.

The page uses TanStack Query. Mutations invalidate the related GST query groups after a successful change so the tables and summaries refresh.

## Header And Filters

The header contains:

- GST registration selector for businesses with one or more GST registrations.
- Month selector.
- `Generate` and `Refresh` buttons on the Filing Review, GSTR-1, and GSTR-3B tabs.

The page no longer displays a manual `Import GSTR-2B` button, Imports tab, or import dialog. The underlying reconciliation API still contains the earlier external-record import endpoints for backend compatibility and future integration work.

## Summary Metrics

The summary strip displays values returned by the reconciliation or ITC endpoint:

- **Books ITC:** GST calculated from posted purchase-side records in Gstfy.
- **External ITC:** GST present in the external GST dataset used for matching.
- **Matched:** Records successfully matched between books and the external dataset.
- **Mismatch:** Records with a mismatch requiring review.
- **Claimed:** Records currently marked as claimed.

These values are summary signals. They are not themselves a filing approval or a final government calculation.

## Reconciliation Tab

### What It Does

The Reconciliation tab compares purchase tax records in Gstfy against external GST records, historically represented by imported GSTR-2B data. A row can contain:

- The book-side purchase tax record.
- The external GST record, if one was found.
- Match details and confidence.
- Taxable-value and tax differences.
- An exception, if one was created.

Matching is based primarily on the business, supplier GSTIN, document number, and document date. Supplier name is supplementary information and should not be the sole matching key.

### Available Filters

- Search supplier, GSTIN, or invoice number.
- Match status.
- ITC status.
- GST registration and month from the page header.

### Reconciliation Statuses

The backend supports these statuses:

```text
NOT_MATCHED
MATCHED
PARTIAL_MATCH
VALUE_MISMATCH
TAX_MISMATCH
DATE_MISMATCH
DUPLICATE
BOOKS_ONLY
EXTERNAL_ONLY
MANUAL_REVIEW
```

Their operational meaning is:

- **Matched:** Book and external records agree sufficiently.
- **Partial match:** A likely match exists, but one or more details differ.
- **Value mismatch:** Taxable value differs.
- **Tax mismatch:** CGST, SGST, IGST, or cess differs.
- **Date mismatch:** Document dates differ.
- **Books only:** The purchase is in Gstfy but not in the external dataset.
- **External only:** The external dataset contains a record not found in Gstfy books.
- **Duplicate:** More than one external or logical record may represent the same invoice.
- **Manual review:** Automated matching could not safely decide.
- **Not matched:** No successful match has been established.

### Row Actions

For reconciliation rows:

- **Unmatch:** Releases an existing match for review. A reason is required.
- **Resolve:** Resolves an attached exception. A resolution reason is required.

Both actions open the shared audit dialog and invalidate GST queries after success.

### Empty State

When no rows match the current filters, the page shows that posted purchase bills and generated GST data will appear for matching.

## ITC Tab

### What It Does

The ITC tab displays the same reconciliation row model, focused on whether purchase-side GST can be considered for an input tax credit claim. It shows book tax, external tax, match status, ITC status, and a compact three-dot action menu.

### ITC Statuses

```text
NOT_REVIEWED
ELIGIBLE
PARTIALLY_ELIGIBLE
DEFERRED
INELIGIBLE
CLAIMED
REVERSED
REJECTED
```

These are application workflow states. They should not be interpreted as an automatic legal conclusion without the applicable GST checks and professional review.

### Three-Dot Actions

The row action menu currently exposes actions according to the current ITC state:

| Current status | Available action | Effect |
|---|---|---|
| `NOT_REVIEWED` or `DEFERRED` | Mark eligible | Moves the record into the eligible review state after a reason is supplied. |
| `NOT_REVIEWED` or `DEFERRED` | Defer ITC | Keeps the record out of the current claim decision and records a reason. |
| `NOT_REVIEWED` or `DEFERRED` | Reject ITC | Marks the record as not claimable in the application workflow and records a reason. |
| `ELIGIBLE` or `PARTIALLY_ELIGIBLE` | Claim ITC | Creates a claim for the selected claim month after confirmation. |
| `CLAIMED` | Reverse claim | Reverses the active claim while preserving the audit reason. |
| Other states | Locked | No action is currently offered from the row. |

Every action opens a confirmation dialog. The dialog displays book tax, external tax, difference, current ITC status, eligible amount, already claimed amount, and remaining claimable amount. A reason is required for audited changes; claiming also asks for a claim period.

The UI action is not the same as filing the return. It changes the internal ITC record, which is later used by GST reporting.

## Filing Review Tab

The Filing Review tab works with the latest GST reporting run for the selected GST registration and period.

The current run can move through reporting review actions:

1. Generate a GST reporting run.
2. Review the generated liability, ITC, RCM, and net GST information.
3. Mark the run ready for review.
4. Approve the run.
5. Lock the run.

The page displays loading and empty states when no run exists. The run is a Gstfy reporting snapshot; it is not direct filing to the GST portal.

## GSTR-1 Tab

GSTR-1 data is requested for the current reporting run. The panel displays outward-supply reporting data and provides export options supported by the reporting API.

The `Generate` action creates the reporting run when one does not exist. `Refresh` regenerates or refreshes the current reporting run according to backend rules.

## GSTR-3B Tab

GSTR-3B data is requested for the current reporting run. The panel displays the consolidated return values, including outward supplies, inward supplies, ITC, liability, and related summaries. Export options are provided by the reporting API.

The page prepares reporting data but does not replace the government filing process. Filing integration is tracked separately through filing runs.

## Filing History Tab

Filing History tracks a filing workflow created from an approved reporting run. It supports:

- Creating a GSTR-1 or GSTR-3B filing run.
- Validating the filing payload.
- Submitting it through the configured filing integration or mock mode.
- Polling processing status.
- Retrying failed runs.
- Cancelling eligible runs.
- Viewing filing details.
- Checking the acknowledgement.

The current UI includes a mock filing mode for development and testing. It must not be treated as production GSTN filing behavior.

## Exceptions Tab

The Exceptions tab lists open reconciliation exceptions for the selected period. Exceptions can represent missing invoices, GSTIN mismatches, invoice mismatches, value or tax mismatches, duplicates, books-only records, or external-only records.

The current page lists exceptions and their severity/status. Resolution is initiated from reconciliation rows through the shared action dialog.

## Current Limitations

- The page is dense and uses accounting terminology that is difficult for a low-literacy dealer.
- Reconciliation and ITC decisions are exposed directly instead of being guided by a simple task flow.
- The current frontend does not fetch GSTR-2B from the GST portal through a live GSTN/GSP integration.
- The earlier manual import API remains in the backend, but the dealer-facing import controls have been removed.
- ITC decisions need stronger backend state-transition, amount, concurrency, and audit protections before production use.
- Generated GST reports and filing runs are separate from actual government filing authorization.

