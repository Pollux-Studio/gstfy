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
- `app/layout.tsx` defines the root layout and app metadata.
- `app/page.tsx` is still the default starter landing page and should not be treated as finalized product UI.
- `app/globals.css` defines theme tokens and shared Tailwind-driven styling.
- `components/ui/` is the real UI layer for the web app today.
- `packages/ui` exists in the monorepo, but it is still a Turbo starter package and is not yet the source of the UI used here.

## Working Rules
- Read the existing route, component, and style structure before editing.
- Prefer existing components in `components/ui` over creating one-off UI patterns.
- Keep App Router conventions intact.
- Use `@/*` imports for local modules when appropriate.
- Keep documentation honest about current implementation status. Do not describe unbuilt product areas as if they already exist.
- Treat `packages/ui` as separate from the live app UI unless the repo is explicitly refactored to unify them.

## Known Constraints
- Lint is not clean right now:
  - `pnpm --filter web lint` fails on `hooks/use-mobile.ts` because of a `react-hooks/set-state-in-effect` error.
- Build is environment-sensitive right now:
  - `pnpm --filter web build` can fail in restricted or offline environments because `app/layout.tsx` loads Geist fonts through `next/font/google`.

If you touch either area, verify whether the constraint still exists and update docs accordingly.

## Useful Commands
- `pnpm --filter web dev`
- `pnpm --filter web lint`
- `pnpm --filter web build`
- `rg -n "<pattern>" apps/web`

Run targeted checks after changes instead of assuming the app is healthy.

## Documentation Expectations
- Distinguish between current app behavior and planned GSTFY capabilities.
- If you add or remove a meaningful app convention, update this file.
- If web-app reality changes enough that the repo overview becomes inaccurate, update `../../overview.md` as part of the same work.
