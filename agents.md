# Gstfy — Coding Agent Project Reference

> This document is the single source of truth for any coding agent working on the Gstfy codebase.
> Read this fully before writing any code, creating any file, or making any architectural decision.

---

## 1. What is Gstfy?

Gstfy (`gstfy.in`) is a GST compliance and business operations SaaS built for Indian small and micro businesses — primarily shop owners, traders, freelancers, and small manufacturers who currently pay a Chartered Accountant (CA) ₹300–₹600/month just to file their GST returns.

**The core mission:**
> Replace the CA fee for GST filing by making compliance so simple that any shop owner can do it themselves in under 10 minutes — with an AI review before every submission for confidence.

Gstfy is not a generic accounting tool. It is laser-focused on GST compliance first, with business operations (inventory, POS, purchases) layered on top as modular upgrades.

---

## 2. The Two User Paths

Every product decision must account for these two distinct user journeys:

### Path A — Self-service user
- Signed up directly at gstfy.in without a CA referral
- Wants to file GST themselves, no CA involved
- Gets full access to AI CA Review before every filing
- Pays monthly subscription directly

### Path B — CA-referred user
- Onboarded by their Chartered Accountant who uses Gstfy
- CA manages filing on their behalf through a CA dashboard
- Business owner has view-only or limited access
- CA holds the subscription, bills the client separately

These two paths coexist in the same product. A user can switch between paths (invite their CA later, or go independent). All data stays intact on any path switch.

---

## 3. Target Users

| User type | Description | Primary pain |
|---|---|---|
| Kirana / retail shop owner | Small shop, GST registered, <₹40L turnover | Paying CA ₹500/month to file |
| Freelancer / consultant | Service provider, monthly invoicing | Manual GST calculation errors |
| Small trader / distributor | B2B invoicing, needs e-invoice + e-way bill | Govt portal is too complex |
| Small manufacturer | Inventory + sales, ₹40L–5Cr turnover | Multiple tools, no unified view |
| CA / accountant (partner) | Manages 20–100 small business clients | Too much manual data entry per client |

---

## 4. Business Model

### Subscription tiers

| Tier | Price | Who | Key unlock |
|---|---|---|---|
| Micro | ₹299/month | Freelancers, solo traders | Core invoicing + GSTR summaries + AI review |
| Small Business | ₹699/month | Retailers, growing SMBs | + E-invoice, E-way bill, Inventory, Purchases |
| Business+ | ₹1,499/month | Multi-branch, manufacturers | + POS, Multi-GSTIN, advanced reports |
| CA Partner | ₹2,999/month | CAs managing up to 15 clients | CA dashboard, client management |
| CA Pro | ₹5,999/month | CAs managing up to 50 clients | Bulk filing view, priority support |

### Pricing philosophy
- Every plan must save the user more than it costs (₹299 plan saves ₹500 CA fee = net gain)
- Modules unlock per tier — not per feature toggle — to keep UI clean at each level
- Annual billing offered at 2 months free

---

## 5. Product Modules

All modules are independently toggleable per business tier. The UI hides locked modules entirely — no "upgrade to unlock" clutter on the main navigation.

### Core modules (all tiers)
- **GST Invoicing** — B2B/B2C invoice creation, CGST/SGST/IGST auto-split, PDF, WhatsApp delivery
- **GSTR Summaries** — GSTR-1 and GSTR-3B summaries, JSON export for filing, download-ready reports
- **AI Compliance Review** — Pre-filing error scan, plain-language explanations, safe-to-file confirmation
- **Payments & Receivables** — Payment recording, outstanding tracker, WhatsApp payment reminders
- **Party Management** — Customer and supplier profiles, GSTIN auto-validation via govt API

### Tier-unlocked modules
- **E-invoice (IRN)** — IRN generation via NIC/IRP portal, QR code on invoice, cancel/amend
- **E-way Bill** — Auto-generate from invoice, Part A/B, transporter management, vehicle update
- **Inventory Management** — Stock tracking, HSN mapping, low stock alerts, multi-warehouse
- **Purchase Management** — Supplier invoices, ITC auto-calculation, purchase orders, payment tracking
- **POS (Point of Sale)** — Touch billing screen, barcode scan, UPI/cash/card, offline mode, thermal print
- **Multi-GSTIN** — Multiple GSTINs under one login, per-GSTIN books, quick switcher
- **Business Reports** — P&L, HSN-wise summary, sales analytics, Excel/PDF export
- **Users & Roles** — Owner/staff/accountant roles, per-module access control, audit log
- **CA Dashboard** — Client management, bulk filing view, client onboarding tools

### AI features (built on Claude API)
The AI layer is not a chatbot. It is a structured compliance analysis pipeline:
1. Collects month's invoice data + GSTR-2B data
2. Sends structured payload to Claude API
3. Receives JSON response with findings array
4. Renders as a pre-filing review report — not raw AI output

The user never sees "AI" or "Claude" — they see a **Filing Review** screen with checkmarks, warnings, and a safe-to-file confirmation.

---

## 6. Key GST Domain Rules (must know before building)

Every developer on this project must understand these rules as they directly affect data models and business logic:

- **GSTIN** — 15-character identifier. Format: `[2-digit state code][10-char PAN][1-char entity][1-char Z][1-char checksum]`. Always validate via GSTN API before saving.
- **CGST + SGST** — Applied on intra-state sales. Always equal halves of the GST rate (e.g., 18% GST = 9% CGST + 9% SGST)
- **IGST** — Applied on inter-state sales. Full GST rate as single tax.
- **HSN code** — Mandatory on all B2B invoices. Determines GST rate. 4-digit for turnover <₹5Cr, 6-digit for >₹5Cr.
- **E-invoice (IRN)** — Mandatory for businesses >₹5Cr turnover on all B2B invoices. Generated via NIC IRP portal. Returns IRN + signed QR code.
- **E-way bill** — Required for goods movement >₹50,000 value. Generated via EWB portal. Has validity based on distance.
- **GSTR-1** — Monthly/quarterly return of outward supplies (sales invoices). Due 11th of next month.
- **GSTR-3B** — Monthly summary return with tax payment. Due 20th of next month.
- **GSTR-2B** — Auto-populated statement of inward supplies (purchases). Used for ITC reconciliation.
- **ITC (Input Tax Credit)** — GST paid on purchases can be offset against GST collected on sales. ITC is only claimable if the supplier has filed their GSTR-1 and it appears in buyer's GSTR-2B.
- **Place of supply** — Determines CGST+SGST vs IGST. If buyer and seller are in the same state = intra-state. Different state = inter-state.

---

## 7. Tech Stack

### Current focus: Web app only

We are building the **web app first**. Desktop (Tauri) and mobile (Expo + React Native) come later. Do not add Tauri-specific or React Native-specific code to the web app.

### Monorepo structure

```
gstfy/                          ← Turborepo root
├── apps/
│   └── web/                    ← Next.js 14 web app (CURRENT FOCUS)
└── packages/
    └── ui/                     ← Shared shadcn component library
```

Future apps (`apps/desktop`, `apps/mobile`) and packages (`packages/core`) will be added later. Do not scaffold them now.

### Web app stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js | 14 (App Router) |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS | 3.4+ |
| Components | shadcn/ui | latest |
| Component source | `@gstfy/ui` package | workspace |
| Forms | React Hook Form + Zod | latest |
| Data fetching | TanStack Query | v5 |
| Tables | TanStack Table | v8 |
| Charts | Recharts | latest |
| Package manager | pnpm | latest |
| Build tooling | Turborepo | latest |

### Backend (not yet built — context only)
- NestJS + TypeScript
- PostgreSQL (primary database)
- Redis (cache + job queues via BullMQ)
- Cloudflare R2 (PDF and file storage)
- Claude API (AI compliance review)
- Razorpay (subscription billing)
- Meta WhatsApp Business API (notifications)
- GSP integration for e-invoice and e-way bill (Masters India or Karvy)

---

## 8. The packages/ui Package

This is the **single source of truth** for all UI components.

### Package identity
```
name: @gstfy/ui
location: packages/ui/
```

### Structure
```
packages/ui/
├── src/
│   ├── components/     ← all shadcn components live here
│   ├── lib/
│   │   └── utils.ts    ← cn() helper (clsx + tailwind-merge)
│   ├── hooks/          ← useToast, useMobile etc
│   └── globals.css     ← CSS variables — single design system source
├── tailwind.config.ts
├── components.json     ← shadcn CLI config
└── package.json
```

### Rules
1. **Never run `shadcn add` inside `apps/web`**. Always run from `packages/ui`.
2. **Never create a `components/ui/` folder inside `apps/web`**. All components import from `@gstfy/ui/components/*`.
3. **`globals.css` lives only in `packages/ui`**. `apps/web/layout.tsx` imports it as `@gstfy/ui/globals.css`.
4. The `tailwind.config.ts` in `apps/web` **must** include `../../packages/ui/src/**/*.{ts,tsx}` in its `content` array — otherwise Tailwind purges shared component styles.
5. Adding a new component: `cd packages/ui && npx shadcn@latest add [name]` — it becomes immediately available in the web app.

### Import pattern in apps/web
```tsx
import { Button } from "@gstfy/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@gstfy/ui/components/card"
import { Badge } from "@gstfy/ui/components/badge"
import { cn } from "@gstfy/ui/lib/utils"
```

---

## 9. Next.js App Structure (apps/web)

### App Router conventions
- All routes use the App Router (`src/app/`)
- Server components by default — add `"use client"` only when needed (interactivity, hooks, browser APIs)
- No `pages/` directory — App Router only
- No Next.js API routes — all backend calls go to the external NestJS API

### Planned route structure
```
src/app/
├── (auth)/
│   ├── login/
│   └── register/
├── (dashboard)/
│   ├── layout.tsx          ← sidebar + topbar shell
│   ├── page.tsx            ← dashboard home
│   ├── invoices/
│   │   ├── page.tsx        ← invoice list
│   │   ├── new/page.tsx    ← create invoice
│   │   └── [id]/page.tsx   ← invoice detail
│   ├── gstr/
│   │   ├── page.tsx        ← GSTR overview
│   │   ├── gstr-1/
│   │   ├── gstr-3b/
│   │   └── gstr-2b/
│   ├── einvoice/
│   ├── ewaybill/
│   ├── inventory/
│   ├── purchases/
│   ├── pos/
│   ├── parties/
│   ├── reports/
│   └── settings/
│       ├── business/       ← GSTIN, business details
│       ├── billing/        ← subscription management
│       └── users/          ← team roles
└── layout.tsx              ← root layout, imports @gstfy/ui/globals.css
```

### Layout system
- **Root layout** (`app/layout.tsx`) — imports globals.css, sets html/body
- **Dashboard layout** (`app/(dashboard)/layout.tsx`) — renders the sidebar + topbar shell using shadcn Sidebar component
- **Auth layout** (`app/(auth)/layout.tsx`) — centered card layout, no sidebar

---

## 10. Design System

### Approach
Clean, minimal, trustworthy — this is a financial product. No heavy gradients, no decorative elements. Every screen must feel safe and clear to a non-technical shop owner.

### Color philosophy
- Base: `zinc` neutral (shadcn default)
- Primary action: dark (`--primary: 240 5.9% 10%`)
- Success / GST verified: teal (`#1D9E75` family)
- Warning / deadlines: amber
- Error / mismatch: destructive red
- The CSS variables in `packages/ui/src/globals.css` are the only place colors are defined

### Typography
- Use default Tailwind `font-sans` (system font stack)
- Body text: `text-sm text-foreground`
- Secondary/labels: `text-xs text-muted-foreground`
- Headings: `font-semibold` — never bold headers on data screens

### Component conventions
- All financial amounts: right-aligned, monospace (`font-mono`)
- Status badges use shadcn `Badge` with variants: `default` (paid), `secondary` (draft), `destructive` (overdue), `outline` (pending)
- Loading states always use shadcn `Skeleton` — never spinners on full pages
- Empty states must include an illustration description + a CTA button
- Never show raw error objects — always show a human-readable message

### GST-specific UI rules
- GSTIN always displayed in monospace, uppercase, with character spacing
- Tax amounts always show CGST + SGST or IGST separately — never just "GST"
- Invoice numbers formatted as `INV-YYYY-XXXX`
- Amounts always formatted as Indian number system (₹1,23,456.00) — use `Intl.NumberFormat('en-IN')`
- Dates always in `DD MMM YYYY` format (e.g., `06 May 2026`) — never MM/DD/YYYY

---

## 11. Key Screens (build order)

Build screens in this exact order. Do not skip ahead.

1. **Auth screens** — Login, Register, Forgot password
2. **Onboarding** — Business setup wizard (GSTIN, business name, address, tier selection)
3. **Dashboard home** — Summary cards (tax owed, sales this month, overdue invoices, filing due date)
4. **Invoice list** — TanStack Table, filter by date/status, search by party
5. **Create invoice** — The most complex screen. Party picker, line items, tax auto-calculation, WhatsApp send
6. **GSTR-1 summary** — Table view of B2B/B2CS/HSN breakdown, JSON download
7. **AI Filing Review** — Pre-filing checklist screen, error list, safe-to-file confirmation
8. **Party management** — Customer and supplier list, add/edit with GSTIN validation
9. **Settings — Business** — GSTIN details, logo upload, invoice template selector

---

## 12. Critical Business Logic Rules

These rules must be enforced at the component and form validation level:

- **GSTIN validation** — Always validate format with regex first, then hit the GSTN API to verify existence. Never save an invoice with an unverified GSTIN.
- **Tax calculation** — Tax must be calculated server-side or in a shared utility. Never trust client-calculated tax totals for storage.
- **Place of supply auto-detection** — Compare seller's state (from their GSTIN characters 1-2) with buyer's state. Auto-select IGST or CGST+SGST accordingly.
- **Invoice numbering** — Sequential, per-GSTIN, never reusable. Once an invoice number is assigned it cannot be deleted — only cancelled with a credit note.
- **E-invoice threshold** — Only show e-invoice generation for B2B invoices. Never for B2C. Alert if business turnover exceeds ₹5Cr (mandatory e-invoicing threshold).
- **E-way bill threshold** — Only trigger for invoices with goods value >₹50,000. Services invoices never need e-way bill.
- **ITC eligibility** — Only purchases with a valid supplier GSTIN and a GST invoice are ITC-eligible. Flag ineligible purchases clearly.

---

## 13. What NOT to build (scope boundaries)

Do not build any of the following in the current phase. Redirect any request for these to a future milestone:

- Payroll, PF, ESI, TDS management
- Full accounting ledger / chart of accounts
- GST appeal or notice management
- Direct GST return filing (integration with GST portal for actual filing — we generate the report, user files manually or via their CA)
- Inventory purchase forecasting or demand planning
- Multi-currency support
- Export / import documentation
- Mobile app (Expo/React Native) — web first
- Desktop app (Tauri) — web first
- Any feature requiring the GSTN sandbox/production API credentials (mock it until credentials are obtained)

---

## 14. Code Conventions

### TypeScript
- Strict mode always on
- No `any` — use `unknown` and narrow properly
- All API response shapes defined as TypeScript interfaces in a `types/` directory
- Zod schemas for all form validation and API response parsing

### React / Next.js
- Server components by default
- `"use client"` directive only when using hooks, event handlers, or browser APIs
- No prop drilling beyond 2 levels — use Context or TanStack Query cache
- All data fetching via TanStack Query (`useQuery`, `useMutation`) — no raw `fetch` in components

### File naming
- Components: `PascalCase.tsx` (e.g., `InvoiceForm.tsx`)
- Pages: `page.tsx` (Next.js App Router convention)
- Utilities: `camelCase.ts` (e.g., `formatCurrency.ts`)
- Types: `types.ts` or `[domain].types.ts`
- Hooks: `use[Name].ts` (e.g., `useGstin.ts`)

### Folder conventions inside apps/web/src
```
src/
├── app/            ← Next.js routes only
├── components/     ← page-specific components (not in @gstfy/ui)
│   ├── invoices/
│   ├── gstr/
│   └── dashboard/
├── hooks/          ← custom React hooks
├── lib/            ← utilities, formatters, constants
├── types/          ← TypeScript interfaces
└── providers/      ← React context providers, TanStack Query provider
```

### Styling
- Tailwind utility classes only — no custom CSS files except `globals.css` in `packages/ui`
- Use `cn()` from `@gstfy/ui/lib/utils` for conditional class merging
- No inline `style={{}}` props except for truly dynamic values (e.g., calculated widths)
- Responsive classes always mobile-first (`sm:`, `md:`, `lg:`)

---

## 15. Environment Variables (apps/web)

```env
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000   # NestJS backend
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_RAZORPAY_KEY_ID=               # Razorpay public key
```

Never put secret keys in `NEXT_PUBLIC_` variables. Backend secrets live in the NestJS service only.

---

## 16. Running the Project

```bash
# From monorepo root
pnpm install

# Run web app only
pnpm --filter @gstfy/web dev

# Run all apps (when desktop/mobile are added later)
pnpm dev

# Type check
pnpm --filter @gstfy/web typecheck

# Lint
pnpm --filter @gstfy/web lint

# Add a new shadcn component (always from packages/ui)
cd packages/ui && npx shadcn@latest add [component-name]
```

---

*Last updated: May 2026 — Web app phase (Next.js + shadcn). Desktop and mobile phases documented separately when initiated.*
