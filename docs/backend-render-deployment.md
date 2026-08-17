# GSTFY Backend Deployment Runbook

This document covers deploying the GSTFY backend API to Render for the first dealer smoke test.

Scope:

- Backend service: `apps/backend`
- Deployment branch: `develop`
- Public API domain: `https://api.gstfy.in`
- Database provider: Neon PostgreSQL
- Frontend allowed domain: `https://gstfy.in` and all `*.gstfy.in` subdomains

## 1. Branch Strategy

Use the same smoke-test branch as the Vercel frontend:

```bash
git checkout develop
git push -u origin develop
```

Render should deploy from:

```text
Branch: develop
```

## 2. Render Service Type

Create a Render Web Service.

Recommended settings:

| Setting | Value |
|---|---|
| Runtime | Node |
| Root directory | repository root |
| Branch | `develop` |
| Build command | `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @gstfy/backend build` |
| Start command | `pnpm --filter @gstfy/backend start` |
| Health check path | `/health/db` |
| Auto deploy | Enabled for `develop` |

Do not set Root Directory to `apps/backend`.

Reason: the backend depends on workspace packages such as `packages/typescript-config`, and Render excludes files outside the configured root directory from the build context.

## 3. Blueprint Deployment

The repository includes:

```text
render.yaml
```

You can create the service from the blueprint or manually enter the same settings in the Render dashboard.

The blueprint intentionally keeps secrets as `sync: false`, so they must be filled in the Render dashboard.

## 4. Required Environment Variables

Set these in Render -> Service -> Environment.

### Core runtime

```env
NODE_ENV=production
LOG_LEVEL=info
HOST=0.0.0.0
AUTO_RUN_MIGRATIONS=true
```

Do not hardcode `PORT`; Render provides it automatically.

### Public web/domain configuration

```env
WEB_ORIGIN=https://gstfy.in
APP_BASE_DOMAIN=gstfy.in
COOKIE_DOMAIN=.gstfy.in
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```

These values allow:

```text
https://gstfy.in
https://auth.gstfy.in
https://ca.gstfy.in
https://<tenant>.gstfy.in
```

### Database

Use the Neon direct connection URL for the first smoke test:

```env
DATABASE_URL=postgresql://neondb_owner:<NEON_PASSWORD>@ep-jolly-union-azfxejzd.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

Given Neon host details:

```text
Host: ep-jolly-union-azfxejzd.c-3.ap-southeast-1.aws.neon.tech
Database: neondb
Role: neondb_owner
Pooler host: ep-jolly-union-azfxejzd-pooler.c-3.ap-southeast-1.aws.neon.tech
```

For this backend, use the direct host initially because `AUTO_RUN_MIGRATIONS=true` runs DDL migrations at startup. The pooler can be evaluated later after migration and prepared-statement behavior is tested.

Security note: do not commit the actual Neon password or full connection URL to git. Store it only in Render.

### Required secrets

Generate long random values and set:

```env
JWT_ACCESS_SECRET=<minimum 32 chars, random>
CORE_POSTING_INTERNAL_KEY=<minimum 16 chars, random>
```

Example generation:

```bash
openssl rand -base64 48
```

### Email

Use your current SMTP provider values:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_AUTH_METHOD=
MAIL_FROM=GSTFY <no-reply@gstfy.in>
```

If using Mailtrap port `2525` or `587`, keep `SMTP_SECURE=false`.

If using SMTP port `465`, set:

```env
SMTP_SECURE=true
```

### Firebase phone OTP

Only required if phone OTP verification is enabled in the smoke test:

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
GOOGLE_APPLICATION_CREDENTIALS=
```

Prefer `GOOGLE_APPLICATION_CREDENTIALS` only when the service account JSON file exists in the deployment environment. For Render, plain env values are usually simpler.

## 5. DNS

Map:

```text
api.gstfy.in
```

to the Render Web Service custom domain.

Do not point `api.gstfy.in` to Vercel.

Expected final public health endpoints:

```text
https://api.gstfy.in/health
https://api.gstfy.in/health/db
https://api.gstfy.in/health/migrations
```

## 6. First Deploy Checklist

1. Create Render Web Service from `Pollux-Studio/gstfy`.
2. Select branch `develop`.
3. Use the root repository directory.
4. Add all required env variables.
5. Deploy.
6. Confirm Render logs show:

```text
backend startup configuration loaded
migration run completed
Server listening
```

7. Open:

```text
https://<render-service>.onrender.com/health/db
```

8. Add and verify custom domain:

```text
api.gstfy.in
```

9. Open:

```text
https://api.gstfy.in/health/db
```

## 7. Frontend Coupling

The Vercel frontend must use:

```env
NEXT_PUBLIC_API_URL=https://api.gstfy.in
NEXT_PUBLIC_APP_BASE_DOMAIN=gstfy.in
NEXT_PUBLIC_APP_PROTOCOL=https
```

If API calls fail in the browser, check:

- Render service is healthy.
- `api.gstfy.in` points to Render.
- Backend `APP_BASE_DOMAIN=gstfy.in`.
- Backend `WEB_ORIGIN=https://gstfy.in`.
- Backend `COOKIE_DOMAIN=.gstfy.in`.
- Browser requests include `credentials: include`.

## 8. Smoke-Test API Checklist

Run these after deployment:

```text
GET https://api.gstfy.in/health
GET https://api.gstfy.in/health/db
GET https://api.gstfy.in/health/migrations
```

Then verify through the frontend:

- Business register.
- Business login.
- Tenant redirect to `<tenant>.gstfy.in`.
- CA login and dashboard.
- Settings load.
- Party create/edit/view.
- Product create/edit.
- Sales invoice draft/post.
- Purchase bill draft/post.
- Receipt/payment draft/post/allocation.
- Sales return, purchase return, credit note, debit note pages.

## 9. Rollback

If a deploy fails:

1. Use Render rollback to the previous successful deploy.
2. Do not reset Neon.
3. Inspect `/health/migrations` for pending or checksum mismatch.
4. Fix on `develop`.
5. Push and redeploy.

If a migration partially applied but did not enter `gstfy_migrations`, do not edit the SQL file after it has been successfully recorded. Add a new forward migration instead.

## 10. References

- Render Web Services: https://render.com/docs/web-services
- Render Monorepo Support: https://render.com/docs/monorepo-support
- Render Health Checks: https://render.com/docs/health-checks
- Render Blueprint YAML: https://render.com/docs/blueprint-spec
- Neon connection strings: https://neon.tech/docs/connect/connect-from-any-app
