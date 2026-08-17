# GSTFY Frontend Deployment Runbook

This document covers the first public smoke-test deployment of the GSTFY web app on Vercel using `gstfy.in`.

Scope:

- Frontend only: `apps/web`
- Domain: `gstfy.in`
- Smoke-test users: 2 dealers for roughly 1 month
- Deployment branch: `develop`
- Backend API expected at: `https://api.gstfy.in`

## 1. Branch Strategy

Use a separate deployment branch for the smoke test:

```bash
git checkout develop
git push -u origin develop
```

For the smoke-test month, configure Vercel's Production Branch as:

```text
develop
```

This allows `main` to continue as the stable development baseline while `gstfy.in` serves the dealer test build.

After the smoke test, either:

- Merge `develop` into `main` and switch Vercel production back to `main`.
- Keep `develop` as the deploy branch if that becomes the release workflow.

## 2. Required Public Domains

GSTFY uses subdomains for auth, CA, API, and tenant workspaces.

| Domain | Purpose | Target |
|---|---|---|
| `gstfy.in` | Main web surface | Vercel frontend project |
| `www.gstfy.in` | Optional redirect to apex | Vercel frontend project |
| `auth.gstfy.in` | Common business and CA auth | Vercel frontend project |
| `ca.gstfy.in` | CA dashboard | Vercel frontend project |
| `*.gstfy.in` | Dealer workspaces such as `abcstores.gstfy.in` | Vercel frontend project |
| `api.gstfy.in` | Backend API | Backend server, not Vercel frontend |

Important:

- `*.gstfy.in` is required for tenant workspaces.
- Vercel wildcard domains require the nameserver method.
- `api.gstfy.in` should not point to the frontend project. It must point to the backend host or reverse proxy.

## 3. Vercel Project Setup

Create one Vercel project for the frontend.

Recommended settings:

| Setting | Value |
|---|---|
| Git branch for production | `develop` |
| Framework preset | Next.js |
| Root directory | `apps/web` |
| Install command | Vercel default for pnpm, or `pnpm install --frozen-lockfile` |
| Build command | `pnpm build` |
| Output directory | Vercel default for Next.js |

If Vercel cannot resolve workspace packages from the monorepo, switch to a root-level project setup:

| Setting | Value |
|---|---|
| Root directory | repository root |
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm --filter web build` |

Use the first setup unless the build fails due workspace package resolution.

## 4. Vercel Environment Variables

Set these in Vercel Project Settings -> Environment Variables.

Production:

```env
NEXT_PUBLIC_API_URL=https://api.gstfy.in
NEXT_PUBLIC_APP_BASE_DOMAIN=gstfy.in
NEXT_PUBLIC_APP_PROTOCOL=https
```

If phone OTP is enabled in the smoke test, also configure the Firebase public client keys:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_DISABLE_APP_VERIFICATION=false
```

Do not put backend secrets in Vercel frontend env variables.

## 5. Backend Production Settings Required

The frontend deployment depends on the backend accepting `gstfy.in` origins and setting cross-subdomain cookies correctly.

Backend env for smoke testing:

```env
NODE_ENV=production
WEB_ORIGIN=https://gstfy.in
APP_BASE_DOMAIN=gstfy.in
COOKIE_DOMAIN=.gstfy.in
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```

The backend CORS code already allows:

```text
https://gstfy.in
https://auth.gstfy.in
https://ca.gstfy.in
https://<tenant>.gstfy.in
```

when `APP_BASE_DOMAIN=gstfy.in`.

## 6. DNS Checklist

In Vercel Domains:

```text
gstfy.in
www.gstfy.in
auth.gstfy.in
ca.gstfy.in
*.gstfy.in
```

At the DNS provider:

- Configure the apex domain using Vercel's required A record or nameserver method.
- Configure named subdomains using Vercel's CNAME target.
- Configure wildcard domain through Vercel nameservers if wildcard SSL is needed.
- Configure `api.gstfy.in` separately to the backend host.

Do not map `api.gstfy.in` to the Vercel frontend project.

## 7. Smoke-Test Flow

Run these checks before giving access to dealers.

### Public routing

```text
https://gstfy.in
https://auth.gstfy.in/auth/login
https://auth.gstfy.in/auth/register
https://auth.gstfy.in/auth/ca/login
https://ca.gstfy.in/dashboard
https://<tenant>.gstfy.in/dashboard
```

Expected:

- Main domain loads.
- Auth domain shows auth pages.
- CA domain opens the CA dashboard only for CA sessions.
- Tenant domain opens the dealer workspace only for that tenant session.

### Backend connectivity

From browser DevTools, verify API calls go to:

```text
https://api.gstfy.in/api/v1/...
```

No request should go to:

```text
api.localhost
localhost:4000
```

### Auth and session

Test:

- Business registration.
- Business login from `auth.gstfy.in`.
- Redirect to `<tenant>.gstfy.in/dashboard`.
- Session refresh after access-token expiry.
- Logout redirects back to `auth.gstfy.in`.
- CA login redirects to `ca.gstfy.in/dashboard`.

### Core dealer smoke areas

For each dealer test account:

- Dashboard loads.
- Settings business data loads.
- Party create/edit/view/archive works.
- Product create/edit works.
- Sales invoice draft/post works.
- Purchase bill draft/post works.
- Receipt/payment draft/post/allocation works.
- Sales return, purchase return, credit note, and debit note pages load.

## 8. Rollback Plan

If production smoke build fails:

1. Revert Vercel production branch to the last known stable branch, or redeploy the previous successful deployment from Vercel.
2. Keep backend running; do not reset production database.
3. Disable dealer access temporarily by changing tenant status in the backend if needed.
4. Fix in `develop`, push again, and let Vercel redeploy.

## 9. Code-Level Deployment Defaults

The frontend now defaults to production domains:

```text
NEXT_PUBLIC_API_URL       -> https://api.gstfy.in
NEXT_PUBLIC_APP_BASE_DOMAIN -> gstfy.in
NEXT_PUBLIC_APP_PROTOCOL  -> https
```

Local development must override these in `apps/web/.env.local` if needed:

```env
NEXT_PUBLIC_API_URL=http://api.localhost:4000
NEXT_PUBLIC_APP_BASE_DOMAIN=localhost:3000
NEXT_PUBLIC_APP_PROTOCOL=http
```

This keeps the Vercel branch safe for `gstfy.in` while still allowing local development when explicitly configured.

## 10. References

- Vercel environment variables: https://vercel.com/docs/environment-variables
- Vercel deployment environments: https://vercel.com/docs/deployments/environments
- Vercel custom domains and wildcard domains: https://vercel.com/docs/domains/working-with-domains/add-a-domain
- Vercel build configuration: https://vercel.com/docs/builds/configure-a-build
- Vercel monorepos: https://vercel.com/docs/monorepos
