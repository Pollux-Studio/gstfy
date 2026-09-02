# GSTfy Status API

Independent Fastify backend for `status.gstfy.in`.

This API is intentionally separate from the main GSTfy tenant backend. It uses its own database URL, migrations, admin authentication, monitoring tokens, workers, and notification queue.

## Commands

Run from the monorepo root.

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

## Environment

Copy `.env.example` into the deployment environment.

For local development, `apps/status/api/.env` is loaded automatically. Real shell or hosting-provider environment variables take precedence over the file.

```env
STATUS_DATABASE_URL=postgresql://...
STATUS_PORT=4100
STATUS_HOST=0.0.0.0
STATUS_PUBLIC_BASE_URL=https://status.gstfy.in
STATUS_CORS_ORIGINS=https://status.gstfy.in
STATUS_ADMIN_TOKEN=change-this-static-admin-token
STATUS_MONITORING_TOKEN=change-this-monitoring-worker-token
STATUS_ENCRYPTION_KEY=change-this-32-char-min-secret
STATUS_BOOTSTRAP_ADMIN_EMAIL=admin@gstfy.in
STATUS_BOOTSTRAP_ADMIN_PASSWORD=change-this-password
STATUS_AUTO_RUN_MIGRATIONS=true
STATUS_CREATE_DATABASE_IF_MISSING=true
```

Production requires changing `STATUS_ADMIN_TOKEN`, `STATUS_MONITORING_TOKEN`, and `STATUS_ENCRYPTION_KEY`.

## Migrations

Migrations live in `apps/status/api/drizzle`.

The API runs pending SQL migrations at startup when:

```env
STATUS_AUTO_RUN_MIGRATIONS=true
```

The migration ledger is `public.gstfy_status_migrations`. Existing migration files must not be edited after they are applied because checksums are enforced.

For local development, `STATUS_CREATE_DATABASE_IF_MISSING=true` creates the target database when `STATUS_DATABASE_URL` points to `localhost`, `127.0.0.1`, or `::1`. It intentionally does not create databases on remote hosts.

## Authentication

Admin endpoints accept any of these:

```text
Authorization: Bearer <admin-session-token>
Authorization: Bearer <status-api-key>
Authorization: Bearer <STATUS_ADMIN_TOKEN>
X-Status-Admin-Token: <STATUS_ADMIN_TOKEN>
```

Worker endpoints accept:

```text
Authorization: Bearer <STATUS_MONITORING_TOKEN>
X-Status-Monitoring-Token: <STATUS_MONITORING_TOKEN>
```

Bootstrap admin creation runs after migrations if `STATUS_BOOTSTRAP_ADMIN_EMAIL` and `STATUS_BOOTSTRAP_ADMIN_PASSWORD` are configured.

## Public API

```text
GET  /health
GET  /health/ready
GET  /api/v1/status
GET  /api/v1/services
GET  /api/v1/services/:slug
GET  /api/v1/incidents
GET  /api/v1/incidents/:slug
GET  /api/v1/maintenance
GET  /api/v1/maintenance/:slug
GET  /api/v1/badge
GET  /rss.xml
GET  /atom.xml
GET  /widget.js
POST /api/v1/subscriptions
POST /api/v1/subscriptions/verify
```

## Admin API

```text
POST   /api/v1/admin/auth/login
GET    /api/v1/admin/auth/session
POST   /api/v1/admin/auth/logout
GET    /api/v1/admin/overview
GET    /api/v1/admin/users
POST   /api/v1/admin/users
GET    /api/v1/admin/api-keys
POST   /api/v1/admin/api-keys
DELETE /api/v1/admin/api-keys/:id
GET    /api/v1/admin/service-groups
POST   /api/v1/admin/service-groups
PATCH  /api/v1/admin/service-groups/:id
GET    /api/v1/admin/services
POST   /api/v1/admin/services
PATCH  /api/v1/admin/services/:id
GET    /api/v1/admin/monitors
POST   /api/v1/admin/monitors
PATCH  /api/v1/admin/monitors/:id
GET    /api/v1/admin/incidents
POST   /api/v1/admin/incidents
GET    /api/v1/admin/incidents/:slug
PATCH  /api/v1/admin/incidents/:id
POST   /api/v1/admin/incidents/:id/updates
GET    /api/v1/admin/maintenance
POST   /api/v1/admin/maintenance
GET    /api/v1/admin/maintenance/:slug
PATCH  /api/v1/admin/maintenance/:id
GET    /api/v1/admin/subscriptions
GET    /api/v1/admin/workers
GET    /api/v1/admin/notifications
GET    /api/v1/admin/audit-logs
GET    /api/v1/admin/metrics/sla
PUT    /api/v1/admin/metrics/sla/:serviceId
GET    /api/v1/admin/postmortems
POST   /api/v1/admin/postmortems
GET    /api/v1/admin/postmortems/:id
PATCH  /api/v1/admin/postmortems/:id
POST   /api/v1/admin/jobs/aggregate-monitor-results
POST   /api/v1/admin/jobs/cleanup-monitor-results
```

## Worker API

Monitoring workers:

```text
GET  /api/v1/monitoring/monitors?q=<region>
POST /api/v1/monitoring/results
POST /api/v1/monitoring/heartbeats
```

Notification workers:

```text
GET  /api/v1/worker/notifications/pending
POST /api/v1/worker/notifications/:id/delivered
POST /api/v1/worker/notifications/:id/failed
```

Pending notification claims use `FOR UPDATE SKIP LOCKED` so multiple workers can run without sending the same delivery twice.

## Backend Capabilities

The Status API supports:

- Public status overview, service pages, incidents, maintenance, badges, RSS, Atom, and embed widget.
- Admin user bootstrap, login sessions, logout, and API keys.
- Service groups, services, dependencies, monitor definitions, incidents, incident updates, and maintenance windows.
- Monitor result ingestion with failure/recovery thresholds, automatic incidents, and automatic recovery.
- Email, webhook, Slack, and Teams subscriptions.
- Queued notification deliveries with retry tracking and encrypted generic webhook signing secrets.
- Worker heartbeats for monitoring and notification workers.
- SLA targets and 30-day SLA reporting.
- Incident postmortems with private/public publish state.
- Monitor result aggregation and old-result cleanup jobs.
- In-memory per-IP rate limiting for public, admin, auth, subscription, and worker routes.

## Notification Secrets

Generic webhook subscriptions receive a signing secret once during creation:

```json
{
  "webhookSigningSecret": "whsec_..."
}
```

The secret is stored encrypted with `STATUS_ENCRYPTION_KEY`. Webhook deliveries include:

```text
X-GSTfy-Delivery-ID
X-GSTfy-Event
X-GSTfy-Timestamp
X-GSTfy-Signature
```

The signature is HMAC-SHA256 over:

```text
<timestamp>.<json_payload>
```
