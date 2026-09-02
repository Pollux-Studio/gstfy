# GSTfy Status App

Independent status platform for `status.gstfy.in`.

This app must not depend on the main GSTfy web app, backend, tenant database, or tenant auth flow. It owns separate deployable pieces:

- `api/` - Fastify public/admin/monitoring API
- `web/` - public status page and admin dashboard UI
- `workers/` - monitoring, incident, and notification workers

The backend implementation now includes the API, database migrations, admin auth, monitoring worker, and notification worker.

## Commands

Run from the monorepo root.

### Backend API

```bash
pnpm --filter @gstfy/status-api dev
pnpm --filter @gstfy/status-api build
pnpm --filter @gstfy/status-api start
pnpm --filter @gstfy/status-api test
pnpm --filter @gstfy/status-api check-types
```

Root aliases:

```bash
pnpm dev:status-api
pnpm build:status-api
pnpm test:status-api
```

### Backend Workers

```bash
pnpm --filter @gstfy/status-workers dev
pnpm --filter @gstfy/status-workers dev:monitoring
pnpm --filter @gstfy/status-workers dev:notifications
pnpm --filter @gstfy/status-workers build
pnpm --filter @gstfy/status-workers start:monitoring
pnpm --filter @gstfy/status-workers start:notifications
pnpm --filter @gstfy/status-workers check-types
```

Root aliases:

```bash
pnpm dev:status-workers
pnpm build:status-workers
```

### Frontend Web

The frontend package is the next step. Once `apps/status/web/package.json` is added, use:

```bash
pnpm --filter @gstfy/status-web dev
pnpm --filter @gstfy/status-web build
pnpm --filter @gstfy/status-web start
pnpm --filter @gstfy/status-web check-types
```
