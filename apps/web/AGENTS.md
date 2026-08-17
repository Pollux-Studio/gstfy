<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may differ from older Next.js assumptions. Read the relevant guide in `node_modules/next/dist/docs/` before making framework-level changes and pay attention to deprecations.
<!-- END:nextjs-agent-rules -->

# Web App Agent Guide

## Purpose
This file is the operating guide for agents working inside `apps/web`.

Use it to stay aligned with the current codebase rather than the broader GSTFY product vision. The repo-level `overview.md` describes both the product direction and the current implementation state. When they differ, follow the code.

## What This App Is Today
- Framework: Next.js 16 App Router
- Language: TypeScript
- UI runtime: React 19
- Styling: Tailwind CSS 4
- UI components: local shadcn-style components in `components/ui`
- Import alias: `@/*`
- React Compiler: enabled in `next.config.ts`

This app is still early-stage. The current homepage is starter content and much of the eventual GST product surface does not exist yet.

## Important Paths
- `app/`: routes, layout, metadata, and global styles
- `components/ui/`: active reusable UI components used by this app
- `hooks/`: app-level hooks
- `lib/`: utilities
- `public/`: static assets

## Current Architecture Notes
- `app/layout.tsx` defines the root layout, app metadata, theme provider, and tooltip provider.
- `app/page.tsx` redirects to the auth entry route.
- `app/globals.css` defines theme tokens and shared Tailwind-driven styling.
- App-wide fonts are loaded via `next/font/google`: Geist for UI text and Geist Mono for numeric/mono usage.
- Auth routes currently live at `app/login`, `app/register`, and `app/forgot-password`.
- `app/ui` is the internal design-system route, built from the official shadcn dashboard block shell, and should stay non-production.
- `components/ui/` is the real UI layer for the web app today.
- `components/login-form.tsx`, `components/register-form.tsx`, and `components/forgot-password-form.tsx` drive the current auth UI.
- `components/app-sidebar.tsx`, `components/site-header.tsx`, and `components/ui-review.tsx` drive the internal block-based `/ui` review route.
- `packages/ui` exists in the monorepo, but it is still a Turbo starter package and is not yet the source of the UI used here.

## Working Rules
- Read the existing route, component, and style structure before editing.
- Prefer existing components in `components/ui` over creating one-off UI patterns.
- Keep App Router conventions intact.
- Use `@/*` imports for local modules when appropriate.
- Keep documentation honest about current implementation status. Do not describe unbuilt product areas as if they already exist.
- Treat `packages/ui` as separate from the live app UI unless the repo is explicitly refactored to unify them.
- Review token or typography changes on `/ui` before applying them broadly to product screens.
- When the user asks for shadcn fidelity, prefer official shadcn blocks as the structural baseline instead of custom marketing layouts.
- Preserve the current auth UX split:
  - login and forgot-password stay centered
  - register uses a split layout with the visual panel on the left and the form on the right

## Known Constraints
- `pnpm --filter web lint` currently passes.
- `pnpm --filter web build` currently passes.
- Auth flows are UI-only for now. They use local validation and mocked success states until backend integration is added.
- `/ui` is for internal design review and should resolve to not-found in production.

If you touch either area, verify whether the constraint still exists and update docs accordingly.

## Useful Commands
- `pnpm --filter web dev`
- `pnpm --filter web lint`
- `pnpm --filter web build`
- `pnpm --filter web add <package>`
- `rg -n "<pattern>" apps/web`

Run targeted checks after changes instead of assuming the app is healthy.

## Documentation Expectations
- Distinguish between current app behavior and planned GSTFY capabilities.
- If you add or remove a meaningful app convention, update this file.
- If web-app reality changes enough that the repo overview becomes inaccurate, update `../../overview.md` as part of the same work.
