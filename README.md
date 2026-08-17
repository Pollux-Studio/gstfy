# Gstfy

Gstfy is a GST compliance and business operations SaaS for Indian small and micro businesses. The product focus is simple GST billing, filing summaries, business operations, and role-based team access.

This repository is a Turborepo monorepo with the web app and the custom backend service.

## Apps

- `apps/web` - Next.js web app.
- `apps/backend` - Fastify + PostgreSQL backend.

## Packages

- `packages/ui` - shared UI package.
- `packages/core` - shared business constants and feature access helpers.
- `packages/eslint-config` - shared ESLint config.
- `packages/typescript-config` - shared TypeScript config.

## Requirements

- Node.js 20.x through 24.x. Production deploys are currently pinned to Node 20.
- pnpm 9.15.9.
- PostgreSQL running locally or reachable through `DATABASE_URL`.

## Install

```bash
pnpm install
```

## Environment

Backend defaults are defined in `apps/backend/.env.example`.

```bash
cp apps/backend/.env.example apps/backend/.env
```

The default local database URL is:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/gstfy
```

The web app reads the backend URL from:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Phone OTP uses Firebase Authentication. The web app needs the public Firebase web app config:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_DISABLE_APP_VERIFICATION=false
```

The backend verifies Firebase phone sign-in ID tokens with Firebase Admin. Use either service account env values:

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Or set `GOOGLE_APPLICATION_CREDENTIALS` to a local service-account JSON file path. If `FIREBASE_PRIVATE_KEY` is stored in `.env`, keep newlines escaped as `\n`.

## Database

Create the local database once:

```bash
createdb gstfy
```

Migrations run automatically when `apps/backend` starts. Migration files live in `apps/backend/drizzle` and applied migrations are recorded in `public.gstfy_migrations`.

Disable automatic migrations only when an external deployment pipeline manages them:

```env
AUTO_RUN_MIGRATIONS=false
```

## Development

Run all apps:

```bash
pnpm dev
```

Run only the backend:

```bash
pnpm --filter @gstfy/backend dev
```

Run only the web app:

```bash
pnpm --filter web dev
```

## Validation

Run all configured checks:

```bash
pnpm lint
pnpm check-types
pnpm build
```

Run backend checks:

```bash
pnpm --filter @gstfy/backend lint
pnpm --filter @gstfy/backend check-types
pnpm --filter @gstfy/backend build
```

Run web checks:

```bash
pnpm --filter web lint
pnpm --filter web build
```

## Backend Endpoints

- `GET /health`
- `GET /health/db`
- `GET /health/migrations`

All application API endpoints are versioned under `/api/v1`.

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/lookup`
- `POST /api/v1/auth/ca-referral/verify`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/ca/register`
- `POST /api/v1/auth/ca/login`
- `POST /api/v1/auth/phone/verify`
- `GET /api/v1/auth/me`
- `GET /api/v1/auth/session`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/password/forgot`
- `POST /api/v1/auth/password/reset`
- `POST /api/v1/auth/email/verify`
- `GET /api/v1/account`
- `PATCH /api/v1/account`
- `GET /api/v1/account/settings`
- `PATCH /api/v1/account/settings/user`
- `POST /api/v1/account/settings/user/phone/verify`
- `POST /api/v1/account/settings/user/password`
- `POST /api/v1/account/settings/user/avatar`
- `GET /api/v1/settings`
- `PATCH /api/v1/settings/business`
- `POST /api/v1/settings/business/ca-referral`
- `PATCH /api/v1/settings/business/tenant`
- `PATCH /api/v1/settings/user`
- `POST /api/v1/settings/user/phone/verify`
- `POST /api/v1/settings/user/password`
- `POST /api/v1/settings/user/avatar`
- `PATCH /api/v1/settings/invoice`
- `PATCH /api/v1/settings/gst-presets`
- `PATCH /api/v1/settings/printer`
- `GET /api/v1/users`
- `POST /api/v1/users`
- `PATCH /api/v1/users/:memberId`
- `DELETE /api/v1/users/:memberId`
- `GET /api/v1/ca/clients`
- `POST /api/v1/ca/clients`
- `POST /api/v1/ca/invites/accept`
- `GET /api/v1/ca/clients/:businessId/summary`
- `POST /api/v1/ca/clients/:businessId/revoke`
- `GET /api/v1/avatars/profile/:seed.svg`

## Notes

- The frontend uses `NEXT_PUBLIC_API_URL`; keep it pointed to the running `apps/backend` service.
- Backend secrets must stay in backend env files only. Do not expose secrets through `NEXT_PUBLIC_*`.
- Add shadcn components from the shared UI package, not directly inside `apps/web`.
