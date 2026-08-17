# GSTFY Backend

Custom Fastify backend for GSTFY.

## Local Setup

1. Create a local PostgreSQL database:

```bash
createdb gstfy
```

2. Copy env values if you need to override defaults:

```bash
cp apps/backend/.env.example apps/backend/.env
```

3. Start the backend. Migrations in `apps/backend/drizzle` run automatically on startup and are recorded in `public.gstfy_migrations`.

```bash
pnpm --filter @gstfy/backend dev
```

If you need to run them manually, use your preferred SQL client:

```bash
psql postgres://postgres:postgres@localhost:5432/gstfy -f apps/backend/drizzle/0000_custom_core.sql
psql postgres://postgres:postgres@localhost:5432/gstfy -f apps/backend/drizzle/0001_settings_users.sql
```

Set `AUTO_RUN_MIGRATIONS=false` only if migrations are managed outside the app.

## SMTP Email

Nodemailer sends registration verification, password reset, and CA client invite emails. Configure these values in `apps/backend/.env`:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_AUTH_METHOD=
MAIL_FROM=GSTFY <no-reply@gstfy.in>
```

## Firebase Phone OTP

Phone OTP SMS is sent by the Firebase Web SDK. The backend only verifies the Firebase ID token after the user enters the OTP.

Configure Firebase Admin with either service account env values:

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Or set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON file path. When using `FIREBASE_PRIVATE_KEY` in `.env`, keep newlines escaped as `\n`.

## Current Endpoints

- `GET /health`
- `GET /health/db`
- `GET /health/migrations`

## Deployment

Render deployment instructions:

```text
docs/backend-render-deployment.md
```

Production env template:

```text
apps/backend/.env.production.example
```

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

## Auth Direction

- Email/password is owned by this backend.
- Refresh session is stored in PostgreSQL and sent as an `httpOnly` cookie.
- Access token is short-lived and returned by the API.
- Nodemailer handles email verification and password reset.
- Firebase will be used only for mobile OTP verification later.
