# GSTFY Web

Next.js web frontend for GSTFY.

## Local Development

```bash
pnpm --filter web dev
```

For local API/auth subdomain development, create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://api.localhost:4000
NEXT_PUBLIC_APP_BASE_DOMAIN=localhost:3000
NEXT_PUBLIC_APP_PROTOCOL=http
```

Then open:

```text
http://auth.localhost:3000/auth/login
http://ca.localhost:3000/dashboard
http://<tenant>.localhost:3000/dashboard
```

## Production Defaults

If env variables are not provided, the app defaults to:

```text
https://api.gstfy.in
gstfy.in
https
```

This is intentional for the Vercel smoke-test deployment branch.

## Checks

```bash
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web build
```

## Deployment

See:

```text
docs/frontend-vercel-deployment.md
```
