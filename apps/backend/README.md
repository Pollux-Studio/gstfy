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
- `POST /auth/business/register`
- `POST /auth/business/login`
- `POST /auth/ca/register`
- `POST /auth/ca/login`
- `GET /auth/session`
- `POST /auth/logout`
- `POST /auth/password/forgot`
- `POST /auth/password/reset`
- `POST /auth/email/verify`
- `GET /account`
- `PATCH /account`
- `GET /settings`
- `PATCH /settings/business`
- `PATCH /settings/invoice`
- `PATCH /settings/gst-rates`
- `PATCH /settings/printer`
- `GET /users`
- `POST /users`
- `PATCH /users/:memberId`
- `DELETE /users/:memberId`

## Auth Direction

- Email/password is owned by this backend.
- Refresh session is stored in PostgreSQL and sent as an `httpOnly` cookie.
- Access token is short-lived and returned by the API.
- Nodemailer handles email verification and password reset.
- Firebase will be used only for mobile OTP verification later.
