# GSTFY Overview

## What GSTFY Is
GSTFY is intended to be a GST compliance and business operations product for Indian SMBs. The business goal is to reduce reliance on manual CA-driven filing workflows by making invoicing, reporting, and filing understandable enough for owners to handle themselves, with software assistance and eventually AI-assisted review.

The product vision currently includes two acquisition and usage paths:
- Self-service business owners who sign up and manage GST work directly.
- CA partners who onboard and manage multiple client businesses from a shared workflow.

## Current Repo State
This repository does not yet contain the full target platform described in the original vision notes. The checked-in code is currently an early-stage monorepo with one active app and a few shared packages.

### Monorepo structure
- `apps/web`: the only application currently present in the repo. It is a Next.js 16 App Router app.
- `packages/ui`: a shared UI package from the Turborepo starter, but it is not yet the primary UI source used by `apps/web`.
- `packages/eslint-config`: shared ESLint presets.
- `packages/typescript-config`: shared TypeScript presets.

### Current implementation reality
- Package manager: `pnpm`
- Build orchestration: Turborepo
- Frontend stack in `apps/web`: Next.js 16, React 19, Tailwind CSS 4, local shadcn-style components
- The web app is still scaffold-heavy and uses starter content in `app/page.tsx`.
- `apps/web/components/ui` contains the active UI component set used by the app today.
- `packages/ui` still contains starter example components and is not yet the single source of truth for shared UI.

### Current gaps versus vision
The following items are mentioned in product direction but are not present in this repo today:
- Desktop app
- Mobile app
- Backend service
- Shared business-logic package such as `packages/core`
- Database, Redis, object storage, or AI integration code
- Production GST workflows such as invoicing, filing, inventory, POS, or CA dashboards

## Web App Snapshot
The current `apps/web` app is the practical starting point for all near-term work in this repository.

### What exists
- App Router structure under `apps/web/app`
- Global styling in `apps/web/app/globals.css`
- A local UI layer under `apps/web/components/ui`
- Helper utilities under `apps/web/lib`
- One responsive helper hook under `apps/web/hooks`

### Known development issues
- `pnpm --filter web lint` currently fails due to a React hooks lint error in `apps/web/hooks/use-mobile.ts`.
- `pnpm --filter web build` currently fails in restricted/offline environments because `apps/web/app/layout.tsx` uses `next/font/google` for Geist fonts.

These are repo truths and should be treated as current constraints until fixed.

## Product Vision
The intended long-term product is broader than the codebase currently reflects.

### Planned platform direction
- Web app for owner and CA workflows
- Desktop app, likely for offline-capable operational workflows
- Mobile app for field and lightweight business usage
- Shared UI and shared business logic across surfaces where practical

### Planned functional areas
- GST invoice generation
- E-invoice support
- GSTR summaries and reports
- WhatsApp notifications
- AI-assisted compliance review
- Inventory and expense tracking
- E-way bill workflows
- POS and multi-GSTIN support for larger customers

### Planned architecture direction
- A reusable shared business-logic layer for GST calculations, types, and API access
- Backend services and persistence for business and compliance data
- Platform-specific shells only where required, with as much shared product logic as possible

## Working Principle For Contributors
When documenting or building GSTFY, prefer current repo truth over aspirational architecture. If a capability is planned but not implemented, label it clearly as planned instead of implying it already exists.
