# Purchase Bill Module — Coding Agent Reference

> This document covers everything the coding agent needs to know before writing
> a single line of code for the purchase bill module in Gstfy. Read completely
> before touching any file related to purchases, ITC, or GSTR-3B.

---

## 1. What this module does

The purchase bill module lets a business owner record bills they receive from
their suppliers. It is not a simple data entry form — every field has a
downstream effect on GST filing, ITC claims, and GSTR-2B reconciliation.

A purchase bill in Gstfy serves three purposes simultaneously:

1. **Books of accounts** — records what was bought, from whom, for how much,
   and whether it has been paid
2. **ITC computation** — calculates how much input tax credit is available to
   offset against the GST collected on sales
3. **GSTR-3B preparation** — feeds Table 4 (ITC available) and Table 3.1(d)
   (RCM inward supplies) of the monthly return

Nothing in this module is submitted directly to the GST portal. Gstfy prepares
the data and the user files manually on the GST portal using the summaries
Gstfy generates.

---

## 2. GST domain knowledge — mandatory reading

### 2.1 How purchase tax works in GST

When a GST-registered business buys goods or services from another GST-
registered supplier, the supplier charges GST on the bill. This GST paid by
the buyer is called Input Tax Credit (ITC). The buyer can deduct this ITC from
the GST they collect on their own sales before paying the balance to the
government.

Example:
- Business sells goods and collects ₹18,000 GST from customers
- Business bought raw material and paid ₹12,000 GST to supplier
- Net GST payable to govt = ₹18,000 − ₹12,000 = ₹6,000

This offset is only legal if the supplier has filed their GSTR-1 and the
invoice appears in the buyer's GSTR-2B on the GST portal.

### 2.2 GSTR-2B — the reconciliation backbone

GSTR-2B is a static, auto-generated statement on the GST portal published on
the 14th of every month. It consolidates all purchase invoices that the buyer's
suppliers have filed in their GSTR-1 for that month.

The buyer's purchase register in Gstfy must be reconciled against GSTR-2B
every month before filing GSTR-3B. Three possible outcomes per invoice:

| Outcome | Meaning | Action in Gstfy |
|---|---|---|
| Matched | Invoice in Gstfy matches GSTR-2B exactly | ITC claimable, mark matched |
| Unmatched — in Gstfy, not in GSTR-2B | Supplier has not filed GSTR-1 yet | ITC not claimable yet, follow up with supplier |
| Unmatched — in GSTR-2B, not in Gstfy | Supplier filed but bill not recorded | Add the missing bill |

The three fields that must exactly match for reconciliation to succeed:
- Supplier GSTIN
- Supplier's invoice number (case-sensitive, max 16 characters as per GST rules)
- Invoice date

One character wrong in any of these three fields = reconciliation failure =
ITC blocked permanently if not corrected before the deadline.

**ITC lapse deadline**: Unmatched ITC for a financial year can only be claimed
until the due date of the September return of the following year or the date
of GSTR-9 annual return filing — whichever is earlier. After this, the ITC
lapses and the money is permanently lost.

### 2.3 IMS — Invoice Management System (from October 2025)

As of October 2025, the GST portal introduced IMS (Invoice Management System).
Suppliers' invoices now appear in IMS before GSTR-2B is generated. The buyer
must accept, reject, or mark as pending each invoice in IMS by the 13th of the
month for it to reflect in GSTR-2B.

Implication for Gstfy: the GSTR-2B reconciliation feature must account for
the fact that invoices can be accepted, rejected, or pending — not just
matched or unmatched. Rejected invoices must never be included in ITC claims.

### 2.4 Tax type — CGST+SGST vs IGST

The tax type on a purchase bill is determined by comparing the supplier's state
with the buyer's state, derived from the first two digits of each GSTIN.

- Same state (intra-state): CGST + SGST applied. Each is half the GST rate.
  Example: 18% GST = 9% CGST + 9% SGST
- Different state (inter-state): IGST applied. Full GST rate as one tax.
  Example: 18% GST = 18% IGST

The place of supply determines this, not the delivery address. Auto-detect from
the GSTINs but allow manual override for edge cases.

ITC credit type carries through to GSTR-3B:
- IGST paid on purchases can offset IGST, CGST, or SGST liability (in that order)
- CGST can offset CGST and IGST
- SGST can offset SGST and IGST
- CGST cannot offset SGST and vice versa

### 2.5 HSN and SAC codes

- HSN (Harmonised System of Nomenclature) — for goods
- SAC (Services Accounting Code) — for services

Both are mandatory on purchase bills from GST-registered suppliers. The HSN/SAC
code determines the applicable GST rate. Gstfy must maintain a reference table
of common HSN/SAC codes with their GST rates so users can search and select
rather than type from memory.

Mandatory digit length based on buyer's annual turnover:
- Up to ₹5 crore: 4-digit HSN
- Above ₹5 crore: 6-digit HSN

### 2.6 Reverse Charge Mechanism (RCM)

RCM is a special provision where the buyer — not the supplier — is responsible
for paying the GST to the government. RCM purchases are completely separate
from regular B2B purchases in GST filing.

Purchases that attract RCM:
- Goods Transport Agency (GTA) services — road freight
- Legal services from an individual advocate
- Services from a director to their own company
- Import of services from outside India
- Purchases from unregistered dealers above ₹5,000 per day aggregate

How RCM differs from regular purchases:
- RCM invoices do NOT appear in GSTR-2B — the supplier does not file them
- The buyer self-declares RCM liability in GSTR-3B Table 3.1(d)
- The buyer pays the RCM tax directly to the government, not to the supplier
- ITC on RCM purchases can be claimed only after the tax has been paid in cash
- RCM ITC appears in GSTR-3B Table 4(A)(3) separately from regular ITC

In the UI: when RCM toggle is on, the GSTR-2B match status must be hidden
(it will never match), the tax amount field must note that this tax is
self-payable, and the ITC section must note the self-payment requirement.

### 2.7 Blocked ITC — Section 17(5)

The following purchases are permanently ineligible for ITC regardless of
whether the supplier has filed GSTR-1:

| Category | Examples | Exception |
|---|---|---|
| Motor vehicles | Cars, bikes, buses | Allowed if used for further supply, transport of passengers as business, or driver training |
| Food and beverages | Canteen, restaurant bills | Allowed if the business is itself in food supply |
| Club membership | Gym, club fees | No exception |
| Health services | Medical insurance for employees | Allowed if mandatory under any law |
| Works contract | Construction of immovable property | Allowed if it is an input service for another works contract |
| Rent-a-cab | Cab hire for employees | Allowed if mandatory under any law |
| Personal consumption | Any purchase for personal use | No exception |

When a bill is marked blocked: still record the full bill in purchases (it
affects P&L) but exclude the GST entirely from ITC calculations. The blocked
GST amount feeds GSTR-3B Table 4(D)(2).

---

## 3. User flow — end to end

### 3.1 Entry point

User navigates to Purchases → Add purchase bill. The form opens in a two-column
layout: main form on the left, summary panel on the right. A bill number is
pre-assigned in the format `PUR-YYYY-XXXX` as Gstfy's internal reference only.
This is never the supplier's invoice number.

### 3.2 Supplier selection — search-first experience

This is not a plain GSTIN input. It is a contact-search experience identical
to how the referenced app (ultimatefosters POS) works — the user types the
supplier name and selects from saved contacts.

**Step 1 — Search saved parties**

A search input queries the local parties table by name or GSTIN as the user
types. Dropdown shows matching saved suppliers with GSTIN and state. On click:

Auto-fills from saved party record (all locked, non-editable):
- Supplier GSTIN
- Legal name
- State and place of supply (overrideable)

The selected supplier renders as a confirmed card showing:
- Initials avatar
- Legal name (bold)
- GSTIN in monospace
- State · Registered supplier
- "GSTIN verified" green badge
- "Change" link to switch supplier

**Step 2 — New supplier not in saved list**

Dropdown shows "Add [name] as new supplier" at the bottom. Clicking opens an
inline mini-form asking only for GSTIN. On entry: call GSTN verification API,
save to parties table, auto-fill bill form. Never allow saving a bill for an
unverified GSTIN.

**Step 3 — Unregistered supplier**

A toggle on the supplier section switches to unregistered mode:
- No GSTIN field — only name and optional phone number
- ITC automatically set to ineligible
- RCM section becomes mandatory if total > ₹5,000

### 3.3 Bill details fields

| Field | Required | GST-critical | Notes |
|---|---|---|---|
| Supplier invoice number | Yes | Yes | Exactly as on physical bill. Max 16 chars. Never auto-generate. |
| Invoice date | Yes | Yes | Cannot be future. Warn if > 180 days old. |
| Bill entry date | Yes | No | Defaults to today. Gstfy's internal booking date. |
| Place of supply | Yes | Yes | Auto-detected from GSTINs. Manual override allowed with warning. |
| Purchase type | Yes | No | Goods (HSN) / Services (SAC) / Both |
| Your PO reference | No | No | Internal only, never sent to GST portal |

If the user edits supplier invoice number or invoice date after a bill is saved,
show a confirmation modal: "Editing this field may break GSTR-2B reconciliation.
Are you sure?" Reset gstr2bStatus to 'pending' on save.

### 3.4 Line items table columns

Item description · HSN/SAC code · Quantity · Unit · Rate per unit ·
Taxable amount (calculated) · GST % · Tax amount (calculated) · ITC flag

Auto-computation:
- Taxable amount = Quantity × Rate (compute on blur)
- Tax amount = Taxable × GST rate / 100
- Round all to 2 decimal places
- Grand total = taxable + CGST + SGST + IGST (never all three non-zero)

ITC flag per line (informational, not definitive):
- "Yes" — default for standard goods and services
- "Check" (amber) — auto-flagged for HSN codes known to be conditional:
  8703xx (passenger vehicles), 996511 (freight), food-related HSNs
- "Blocked" — user manually marks

Minimum one line item required to save.

### 3.5 Totals block

```
Taxable value         ₹62,400.00
CGST (2.5%)            ₹1,560.00
SGST (2.5%)            ₹1,560.00
IGST                          —
──────────────────────────────────
Bill total            ₹65,520.00
```

Cross-check: if user enters total from physical bill and it does not match
computed total, show inline warning. Allow ₹1 tolerance for rounding.

### 3.6 RCM toggle

Default off. When turned on:
- Show: "RCM tax (₹[amount]) must be self-paid to the government."
- Hide GSTR-2B match status — RCM bills never appear in GSTR-2B
- Payment section adds: "RCM tax paid to govt" date field
- GSTR-3B mapping changes from Table 4(A)(5) to Table 4(A)(3) for ITC
  and Table 3.1(d) for liability

Auto-suggest RCM when:
- HSN/SAC starts with 9965 (GTA / freight services)
- Supplier is unregistered and total exceeds ₹5,000

### 3.7 ITC eligibility options

**Fully eligible** (default) — all GST claimable as ITC
**Partially eligible** — opens per-line split view for eligible/ineligible amounts
**Blocked (Section 17(5))** — no ITC, GST is a business cost

Show helper text listing blocked categories. Do not gate or hide options —
let the user choose and trust them to know their purchase type.

### 3.8 Payment fields

Payment status (Paid / Partially paid / Unpaid) · Amount paid · Payment date
(optional) · Payment mode (Cash / UPI / Bank transfer / Cheque)

Important: payment status has zero effect on ITC eligibility or GST filing.
Never imply or link payment to ITC availability in the UI.

### 3.9 Attachment and notes

Attachment: PDF/JPG/PNG up to 5MB. Stored in Cloudflare R2 at:
`/purchases/{businessId}/{financialYear}/{billId}/bill.{ext}`

Notes: free-text internal note. Never sent to GST portal. Never shown to
supplier.

---

## 4. Data model

### PurchaseBill

```typescript
interface PurchaseBill {
  id: string
  businessId: string
  billNumber: string                // PUR-YYYY-XXXX, Gstfy-generated

  // Supplier
  supplierId: string
  supplierGstin: string
  supplierName: string
  supplierTradeName: string

  // GST-critical fields
  supplierInvoiceNumber: string     // exactly as on physical bill
  invoiceDate: Date
  billEntryDate: Date

  // Tax classification
  placeOfSupply: string             // state code e.g. "33"
  supplyType: 'intra' | 'inter'
  purchaseType: 'goods' | 'services' | 'both'
  isRcm: boolean

  // ITC
  itcEligibility: 'full' | 'partial' | 'blocked'
  itcEligibleAmount: number
  itcBlockedAmount: number

  // Totals
  taxableValue: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalAmount: number

  // Payment
  paymentStatus: 'paid' | 'partial' | 'unpaid'
  amountPaid: number
  paymentDate: Date | null
  paymentMode: 'cash' | 'upi' | 'bank' | 'cheque' | null

  // GSTR-2B reconciliation
  gstr2bStatus: 'pending' | 'matched' | 'unmatched' | 'rejected' | 'not_applicable'

  // Meta
  purchaseOrderRef: string | null
  notes: string | null
  attachmentUrl: string | null
  financialYear: string             // e.g. "2025-26"
  taxPeriod: string                 // e.g. "2026-05"
  status: 'draft' | 'saved' | 'reconciled'
  createdAt: Date
  updatedAt: Date
  createdBy: string
}
```

### PurchaseBillLineItem

```typescript
interface PurchaseBillLineItem {
  id: string
  purchaseBillId: string
  itemDescription: string
  hsnSacCode: string
  quantity: number
  unit: string
  ratePerUnit: number
  taxableAmount: number
  gstRate: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalAmount: number
  itcFlag: 'eligible' | 'check' | 'blocked'
  sortOrder: number
}
```

---

## 5. API endpoints

All under `/api/purchases`. All require JWT authentication.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/purchases` | Create new bill |
| PUT | `/api/purchases/:id` | Update bill (resets gstr2bStatus if GST fields change) |
| GET | `/api/purchases` | List bills with filters |
| GET | `/api/purchases/:id` | Bill detail with line items |
| DELETE | `/api/purchases/:id` | Only for draft status |
| POST | `/api/purchases/gstr2b-reconcile` | Match bills against uploaded GSTR-2B JSON |

Backend validations on POST/PUT:
- Supplier GSTIN must be verified in parties table
- Supplier invoice number must be unique per supplier per business
- Invoice date cannot be future
- At least one line item
- Tax amounts must be mathematically consistent (±₹1 tolerance)
- Financial year and tax period auto-derived server-side, never trusted from client

---

## 6. GSTR-3B filing mapping

| Purchase type | Condition | GSTR-3B table |
|---|---|---|
| Regular B2B, ITC eligible | CGST+SGST | Table 4(A)(5) — ITC from others |
| Regular B2B, ITC eligible | IGST | Table 4(A)(5) — ITC from others |
| RCM, ITC eligible | After RCM tax paid | Table 4(A)(3) — ITC on RCM supplies |
| Import of services | ITC eligible | Table 4(A)(2) — Import of services |
| Any purchase | Blocked Sec 17(5) | Table 4(D)(2) — Ineligible ITC |
| RCM purchase | Tax liability | Table 3.1(d) — Inward supplies under RCM |

Gstfy generates a pre-filled summary of these values. The user copies into
the GST portal manually. Gstfy does not file on behalf of the user.

---

## 7. Financial year and tax period utilities

```typescript
function getFinancialYear(date: Date): string {
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  if (month >= 4) {
    return `${year}-${(year + 1).toString().slice(-2)}`
  }
  return `${year - 1}-${year.toString().slice(-2)}`
}
// April 2026 → "2026-27"
// January 2026 → "2025-26"

function getTaxPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
// May 2026 → "2026-05"
```

---

## 8. Validation rules

### Client-side

```typescript
// Supplier invoice number format
/^[a-zA-Z0-9\-_./]{1,16}$/

// Invoice date not in future
invoiceDate <= today

// ITC lapse warning (non-blocking)
invoiceDate < today - 180 days → amber warning with deadline date

// Tax consistency
Math.abs(computedTotal - enteredTotal) <= 1

// Minimum line items
lineItems.length >= 1

// RCM auto-suggest
hsnSac.startsWith('9965') → suggest RCM toggle
supplier.isUnregistered && lineTotal > 5000 → suggest RCM toggle
```

### Server-side (enforced, 400 on failure)

```typescript
// Duplicate invoice detection
SELECT COUNT(*) FROM purchase_bills
WHERE business_id = :businessId
  AND supplier_gstin = :supplierGstin
  AND supplier_invoice_number = :invoiceNumber
  AND id != :currentId

// Tax consistency check (same ±₹1 tolerance)
// Supplier GSTIN must exist as verified in parties table
// Invoice date not in future
// financialYear and taxPeriod derived server-side only
```

---

## 9. UI states

| State | What to show |
|---|---|
| No supplier selected | Search input prominent, form below greyed out |
| Searching supplier | Dropdown with matches + "Add new" at bottom |
| GSTIN API call in flight | Skeleton loader over supplier card |
| GSTIN invalid or cancelled | Inline error — ITC cannot be claimed |
| Supplier confirmed | Filled card with verified badge, full form enabled |
| RCM on | Hide GSTR-2B status, show self-payment note |
| ITC blocked | Dim tax column, show "GST is a cost" note |
| Duplicate invoice | Inline error below invoice number with link to existing bill |
| Invoice > 180 days old | Amber warning with ITC lapse deadline |
| Saved successfully | Toast with bill number and ITC amount added |
| GSTR-2B matched | Green badge on bill row in list view |
| GSTR-2B unmatched | Amber badge with supplier follow-up prompt |

---

## 10. Exact UI copy strings

```
Supplier invoice number label:
"Supplier invoice number"

Supplier invoice number helper:
"Enter exactly as printed on the supplier's bill"

Invoice number warning tooltip:
"Must match your supplier's GSTR-1 filing exactly for ITC to be claimable"

ITC lapse warning:
"This bill is older than 6 months. Claim ITC before [date] to avoid permanent lapse."

Duplicate invoice error:
"A bill from this supplier with invoice number [X] already exists. View existing bill →"

RCM self-payment note:
"Reverse charge applies. You must pay ₹[amount] GST directly to the government.
ITC is available only after payment."

ITC blocked note:
"GST on this purchase cannot be claimed as credit. The tax amount is a business expense."

Unregistered supplier ITC note:
"Purchases from unregistered dealers are not eligible for ITC."

GSTR-2B matched badge text:
"Matched in GSTR-2B"

GSTR-2B unmatched badge text:
"Not in GSTR-2B — follow up with supplier to file their GSTR-1"

GSTR-2B not applicable badge text (RCM):
"RCM — does not appear in GSTR-2B"

Save success toast (ITC eligible):
"Bill [number] saved. ITC of ₹[amount] added to [Month Year]."

Save success toast (ITC blocked):
"Bill [number] saved. GST of ₹[amount] is blocked — not added to ITC."
```

---

## 11. Scope — what to build now vs later

### Build in this release (v1)

- Full purchase bill entry form
- Supplier search from saved parties with auto-fill
- New supplier creation inline via GSTIN API
- Unregistered supplier flow with RCM auto-suggest
- Line items with auto-calculated tax
- ITC eligibility — full, partial, blocked
- RCM toggle with all downstream UI and data changes
- Payment tracking fields
- Bill attachment upload to R2
- GSTR-2B reconciliation status badge (manual update)
- Duplicate invoice detection
- Purchase bill list view with filters

### Do not build in this release

- Automated GSTR-2B JSON import and matching (Phase 2)
- Debit note / purchase return (separate module)
- Import of goods from outside India
- Input Service Distributor (ISD) entries
- Direct GSTR-3B portal submission
- Bulk CSV import of purchase bills (Phase 2)

---

*Module: Purchase bills*
*Downstream effects: GSTR-3B Table 3.1(d) · Table 4(A) · Table 4(D) · GSTR-2B reconciliation · ITC ledger · P&L report · Payables report*
*Last updated: May 2026*
