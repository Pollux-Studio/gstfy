# Notification Worker

Delivers queued status notifications.

## Run

```bash
pnpm --filter @gstfy/status-workers dev:notifications
pnpm --filter @gstfy/status-workers start:notifications
```

## Supported Channels

- Email through SMTP.
- Generic signed webhooks.
- Slack incoming webhooks.
- Microsoft Teams incoming webhooks.

## API Used

```text
GET  /api/v1/worker/notifications/pending
POST /api/v1/worker/notifications/:id/delivered
POST /api/v1/worker/notifications/:id/failed
POST /api/v1/monitoring/heartbeats
```

The API claims pending rows with row locking before returning them to the worker, so multiple notification workers can run safely.
