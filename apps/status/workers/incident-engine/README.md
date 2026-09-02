# Incident Engine

The first production pass keeps incident automation inside the Status API transaction that records monitor results.

## Current Behavior

- Consecutive failures are tracked per monitor.
- Failure thresholds move services into degraded or outage states.
- Recovery thresholds move services back to operational.
- Automatic incidents are created when monitors cross failure thresholds.
- Automatic incidents are resolved when the service recovers.

## Future Worker Split

If incident correlation becomes more complex, this can move into a dedicated worker. For now, keeping it in the API avoids queue lag and keeps monitor-result ingestion atomic.
