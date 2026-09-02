# Monitoring Worker

Runs external checks and reports results to the Status API.

## Run

```bash
pnpm --filter @gstfy/status-workers dev:monitoring
pnpm --filter @gstfy/status-workers start:monitoring
```

## Supported Checks

- `http` - GET request with expected status and optional body match.
- `health` - same transport as HTTP, used for health endpoints.
- `tcp` - opens a TCP socket to `host:port`.
- `dns` - resolves the target host.
- `ssl` - validates that a TLS certificate is readable and not expired.

## API Used

```text
GET  /api/v1/monitoring/monitors?q=<region>
POST /api/v1/monitoring/results
POST /api/v1/monitoring/heartbeats
```

The API owns threshold decisions, service status changes, automatic incidents, and recovery. The worker only checks and reports.
