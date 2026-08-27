# Redis and BullMQ Setup

GSTfy uses BullMQ for background automation jobs. BullMQ is not a separate server; it is a Node.js library running inside `apps/backend`. Redis is the queue broker.

## Start Redis Locally

From the monorepo root:

```bash
docker compose -f docker-compose.queue.yml up -d --build
```

Check status:

```bash
docker compose -f docker-compose.queue.yml ps
docker compose -f docker-compose.queue.yml logs -f redis
```

Stop Redis:

```bash
docker compose -f docker-compose.queue.yml down
```

Remove persisted queue data if needed:

```bash
docker compose -f docker-compose.queue.yml down -v
```

## Backend Environment

Set these in `apps/backend/.env`:

```env
REDIS_URL=redis://localhost:6379
QUEUE_WORKER_ENABLED=true
QUEUE_CONCURRENCY=3
QUEUE_JOB_TIMEOUT_MS=30000
QUEUE_MAX_ATTEMPTS=3
QUEUE_BACKOFF_BASE_MS=2000
```

Then start the backend:

```bash
pnpm --filter @gstfy/backend dev
```

If `REDIS_URL` is empty, GSTfy still persists automation jobs in PostgreSQL, but jobs are not pushed to BullMQ.

## What Redis Stores

Redis stores BullMQ queue state for:

- Waiting jobs
- Active jobs
- Retry/backoff metadata
- Completed and failed job history retained by BullMQ

The durable business record remains in PostgreSQL automation tables. Redis is the execution queue, not the source of truth.

## Current Queue

```text
gstfy-automation
```

BullMQ v6 rejects `:` in queue names because it uses colon-separated Redis keys internally.

Current job types:

- `stock.posted-document.sync`
- `stock.opening-stock.sync`
- `einvoice.generate`
- `bank-reconciliation.auto-match`
- `gst-report.refresh`
- `filing-review.prepare`

## Docker Configuration

Files:

```text
docker-compose.queue.yml
docker/redis/Dockerfile
docker/redis/redis.conf
```

Redis policy:

- AOF enabled for local durability.
- Snapshot enabled every 60 seconds after 1000 writes.
- `maxmemory-policy noeviction` so BullMQ jobs are not silently evicted.
- Data persisted in Docker volume `gstfy-redis-data`.

## Monitoring

Use the internal ops page:

```text
/ops
```

The page is guarded by `OPS_ADMIN_EMAILS` and can show queue state, recent backend logs, automation jobs, and manual trigger controls.
