# GSTfy Status Workers

Deployable background workers for the independent GSTfy Status App.

The workers do not connect to the database directly. They talk to the Status API using `STATUS_MONITORING_TOKEN`.

## Commands

Run from the monorepo root.

```bash
pnpm --filter @gstfy/status-workers dev
pnpm --filter @gstfy/status-workers dev:monitoring
pnpm --filter @gstfy/status-workers dev:notifications
pnpm --filter @gstfy/status-workers build
pnpm --filter @gstfy/status-workers start
pnpm --filter @gstfy/status-workers start:monitoring
pnpm --filter @gstfy/status-workers start:notifications
pnpm --filter @gstfy/status-workers check-types
```

Root aliases:

```bash
pnpm dev:status-workers
pnpm build:status-workers
```

## Environment

For local development, `apps/status/workers/.env` is loaded automatically. Real shell or hosting-provider environment variables take precedence over the file.

```env
STATUS_API_BASE_URL=https://status-api.gstfy.in
STATUS_MONITORING_TOKEN=change-this-monitoring-worker-token
STATUS_WORKER_KIND=monitoring
STATUS_WORKER_ID=status-worker-mumbai-1
STATUS_WORKER_REGION=india
STATUS_WORKER_VERSION=2026.09.02
STATUS_WORKER_POLL_SECONDS=30
STATUS_NOTIFICATION_POLL_SECONDS=15
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=GSTfy Status <status@gstfy.in>
```

Use one process for monitoring and one process for notifications in production.

## Monitoring Worker

Run:

```bash
pnpm --filter @gstfy/status-workers start:monitoring
```

The monitoring worker:

- Sends worker heartbeats.
- Fetches enabled monitors for its region.
- Runs HTTP, health, TCP, DNS, and SSL checks.
- Records each result through the Status API.
- Lets the API own threshold logic, service status changes, automatic incidents, and automatic recovery.

Monitor intervals are respected per monitor. The worker loop can run more frequently than an individual monitor interval.

## Notification Worker

Run:

```bash
pnpm --filter @gstfy/status-workers start:notifications
```

The notification worker:

- Sends worker heartbeats.
- Claims pending deliveries through the Status API.
- Sends email, webhook, Slack, or Teams notifications.
- Marks deliveries as delivered or failed.
- Relies on the API retry schedule when delivery fails.

Email requires SMTP configuration. Webhooks require a reachable URL. Generic webhooks include signed headers.

## Deployment Shape

Recommended production processes:

```text
status-api
status-monitoring-worker-india
status-notification-worker
```

The API owns database state. Workers are stateless and can be restarted safely.
