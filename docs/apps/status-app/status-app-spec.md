# GSTfy Status App — Production Specification

## 1. Purpose

The GSTfy Status App is a publicly accessible, independently deployable status and incident-management platform for GSTfy.

Production URL:

```text
https://status.gstfy.in
```

The system must communicate the real-time health of GSTfy services, third-party dependencies, scheduled maintenance, outages, degraded performance, and historical incidents.

The status application must remain available even when the main GSTfy application, API, or primary database is unavailable.

---

# 2. Core Requirements

The Status App must support:

- Public status dashboard
- Service/component status
- Overall system status
- Automated uptime monitoring
- HTTP/TCP/DNS checks
- Multi-region monitoring
- Latency monitoring
- Error-rate monitoring
- Health-check monitoring
- Automatic degradation detection
- Automatic incident creation
- Manual incident creation
- Incident lifecycle management
- Incident timeline
- Incident updates
- Scheduled maintenance
- Maintenance notifications
- Incident history
- Availability percentages
- Response-time statistics
- Historical uptime charts
- Status subscriptions
- Email notifications
- Webhook notifications
- Slack/Teams integrations
- RSS/Atom feed
- Public API
- Monitoring API
- Admin dashboard
- Role-based access control
- Audit logs
- Service dependency mapping
- Component groups
- Third-party dependency tracking
- Regional outage visibility
- Rate limiting
- Authentication and authorization
- Security logging
- Data retention
- Automated notifications
- Status-page customization
- Custom branding
- SEO metadata
- Accessibility support
- Dark/light theme
- Mobile responsive UI

---

# 3. High-Level Architecture

```text
                           Internet
                               │
                               ▼
                     status.gstfy.in
                               │
                      CDN / WAF / DNS
                               │
                               ▼
                    ┌────────────────────┐
                    │ Status Web App     │
                    │ Next.js            │
                    └─────────┬──────────┘
                              │
                    ┌─────────┴──────────┐
                    │                    │
                    ▼                    ▼
              Public Status API      Admin API
                    │                    │
                    └─────────┬──────────┘
                              │
                              ▼
                     Status Database
                         PostgreSQL
                              │
              ┌───────────────┼────────────────┐
              │               │                │
              ▼               ▼                ▼
          Monitoring       Incident        Notification
           Workers          Engine           Service
              │               │                │
       ┌──────┼───────┐       │        ┌───────┼────────┐
       ▼      ▼       ▼       ▼        ▼       ▼        ▼
    Region A Region B Region C       Email   Webhook   Slack
       │      │       │
       └──────┴───────┘
              │
              ▼
      GSTfy Services / External APIs
```

---

# 4. Independence Requirement

The Status App must be operationally independent from GSTfy's main application.

Do NOT build:

```text
status.gstfy.in
        ↓
gstfy backend
        ↓
gstfy database
```

because a GSTfy outage could then also make the status page unavailable.

Instead:

```text
status.gstfy.in
        ↓
independent status infrastructure
        ↓
status database
        ↓
monitoring GSTfy
```

The Status App may monitor GSTfy but must not depend on the availability of GSTfy for its own availability.

---

# 5. Service Model

Each monitored system is represented as a service.

Example:

```text
Web Application
API
Authentication
Invoice Engine
Database
File Storage
Payment Service
GST Integration
Email Service
Notification Service
```

Each service contains:

```text
id
name
slug
description
group_id
status
display_order
is_public
monitoring_enabled
created_at
updated_at
```

---

# 6. Service Groups

Services can be organized into logical groups.

Example:

```text
GSTfy Platform
├── Web Application
├── API
├── Authentication
├── Invoice Engine
└── Customer Portal

Infrastructure
├── Database
├── Redis
├── File Storage
└── Queue

External Services
├── Payment Provider
├── GST Integration
├── Email Provider
└── SMS Provider
```

The public status page can display groups independently.

---

# 7. Service Status

Supported statuses:

```text
operational
degraded_performance
partial_outage
major_outage
maintenance
unknown
```

Definitions:

### Operational

Service is functioning normally.

### Degraded Performance

Service is available but operating slower or with elevated errors.

### Partial Outage

Only a portion of the service is unavailable.

### Major Outage

The majority or entirety of the service is unavailable.

### Maintenance

Service is intentionally affected by scheduled maintenance.

### Unknown

Monitoring information is unavailable.

---

# 8. Overall System Status

The platform calculates an overall status from public services.

Example:

```text
All Systems Operational
```

Possible states:

```text
operational
degraded
partial_outage
major_outage
maintenance
unknown
```

Suggested precedence:

```text
major_outage
    ↓
partial_outage
    ↓
degraded
    ↓
maintenance
    ↓
operational
```

The calculation must be configurable.

---

# 9. Public Status Page

URL:

```text
https://status.gstfy.in
```

Page structure:

```text
GSTfy System Status

● All Systems Operational

Last updated 2 minutes ago

GSTfy Platform
────────────────────────

Web Application          Operational
API                      Operational
Authentication           Operational
Invoice Engine           Operational

Infrastructure
────────────────────────

Database                 Operational
File Storage             Operational

External Services
────────────────────────

Payments                 Operational
GST Integration          Degraded Performance

────────────────────────

Recent Incidents

API latency
Resolved Sep 1, 2026

Scheduled maintenance
Completed Aug 28, 2026
```

---

# 10. Public Service Details

Every publicly exposed service can have a detail page.

Example:

```text
https://status.gstfy.in/services/api
```

Show:

- Current status
- Description
- Current incidents
- Historical uptime
- Response-time chart
- Regional status
- Recent incidents
- Maintenance
- Availability percentage

Example:

```text
GSTfy API

● Operational

Uptime

30 days      99.98%
90 days      99.95%
12 months    99.91%

Response Time

P50   110ms
P95   340ms
P99   790ms
```

---

# 11. Uptime Monitoring

The monitoring system must support:

### HTTP/HTTPS

```text
GET https://gstfy.in
GET https://api.gstfy.in/health
```

Verify:

- HTTP status
- Response time
- Redirect behavior
- SSL validity
- Response body
- Response headers

### TCP

Example:

```text
api.gstfy.in:443
database.internal:5432
```

### DNS

Monitor DNS resolution.

### SSL Certificate

Monitor:

- Certificate expiry
- Certificate validity
- Hostname mismatch
- TLS negotiation

---

# 12. Custom Health Checks

Services may expose dedicated health endpoints.

Example:

```text
GET /health/live
GET /health/ready
GET /health/public
```

Public health response:

```json
{
  "status": "ok"
}
```

Internal health response:

```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "storage": "ok"
}
```

Detailed internal diagnostic information must never be exposed publicly.

---

# 13. Monitoring Check Configuration

Each monitor should support:

```text
name
service_id
check_type
target
interval
timeout
expected_status
expected_body
expected_headers
regions
retry_count
enabled
```

Example:

```json
{
  "name": "GSTfy API Health",
  "service": "api",
  "type": "http",
  "target": "https://api.gstfy.in/health",
  "interval": 60,
  "timeout": 10,
  "expectedStatus": 200,
  "regions": [
    "india",
    "singapore",
    "europe"
  ]
}
```

---

# 14. Monitoring Frequencies

Supported intervals:

```text
1 minute
5 minutes
10 minutes
15 minutes
30 minutes
1 hour
```

One-minute monitoring should be reserved for important services to control infrastructure cost.

---

# 15. Multi-Region Monitoring

Checks should run from multiple geographic locations.

Example:

```text
India
Singapore
Europe
United States
```

Architecture:

```text
                Monitoring Controller
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       India        Singapore     Europe
       Worker         Worker       Worker
          │            │            │
          └────────────┼────────────┘
                       ▼
                 Monitoring DB
```

This allows differentiation between:

```text
GSTfy globally unavailable
```

and:

```text
GSTfy unavailable from India only
```

---

# 16. Monitoring Result

Each check creates a monitoring result:

```text
id
monitor_id
region
status
http_status
response_time
error
checked_at
```

Example:

```json
{
  "status": "failed",
  "httpStatus": 503,
  "responseTime": 4210,
  "error": "Service unavailable"
}
```

Monitoring results must be aggregated instead of keeping unlimited raw data.

---

# 17. Data Retention

Suggested policy:

```text
Raw checks:
7–30 days

5-minute aggregates:
90 days

Hourly aggregates:
1 year

Daily aggregates:
Unlimited / configurable
```

This prevents the monitoring database from growing indefinitely.

---

# 18. Failure Detection

A single failed check should NOT automatically create a public incident.

Use consecutive failure thresholds.

Example:

```text
Failure #1
   ↓
Retry

Failure #2
   ↓
Retry

Failure #3
   ↓
Service marked degraded/outage
```

Example policy:

```text
3 consecutive failures = degraded
5 consecutive failures = outage
3 consecutive successful checks = recovery
```

These values must be configurable per monitor.

---

# 19. Automatic Incident Creation

The system may automatically create an incident when monitoring determines that a service is unavailable.

Example:

```text
API
   ↓
5 failed checks
   ↓
Incident created
   ↓
API status = Major Outage
   ↓
Public page updated
   ↓
Subscribers notified
```

Auto-created incidents must clearly indicate:

```text
Detection Source: Automated Monitoring
```

---

# 20. Incident Model

Incident fields:

```text
id
title
slug
status
severity
impact
created_by
detected_automatically
started_at
resolved_at
scheduled
public
created_at
updated_at
```

Incident statuses:

```text
investigating
identified
monitoring
resolved
```

Incident severity:

```text
minor
major
critical
```

Impact:

```text
none
degraded
partial
major
```

---

# 21. Incident Timeline

Each incident must contain an immutable timeline.

Example:

```text
11:42 IST
Investigating

We are investigating elevated API error rates.

11:51 IST
Identified

We identified an issue affecting invoice API requests.

12:10 IST
Monitoring

A fix has been deployed and recovery is being monitored.

12:24 IST
Resolved

The issue has been resolved.
```

Table:

```text
incident_updates
----------------
id
incident_id
status
message
author_id
created_at
```

---

# 22. Incident Components

One incident may affect multiple services.

Example:

```text
Incident:
Payment processing disruption

Affected Services:
Payment Service
Invoice Engine
API
```

The system must automatically propagate incident status to affected services.

---

# 23. Incident Templates

Provide predefined templates.

Example:

```text
Investigating API Outage

We are investigating reports of elevated API errors.

Identified Payment Issue

We identified an issue affecting payment processing.

Monitoring Recovery

A fix has been deployed and we are monitoring recovery.

Resolved

The issue has been resolved and services are operating normally.
```

---

# 24. Maintenance

Support scheduled maintenance.

Maintenance fields:

```text
id
title
description
start_at
end_at
timezone
status
affected_services
created_by
```

Statuses:

```text
scheduled
in_progress
completed
cancelled
```

Example:

```text
Scheduled Maintenance

GSTfy API Infrastructure Maintenance

September 5, 2026
01:00–02:00 IST

Expected impact:
Invoice creation may be temporarily unavailable.
```

---

# 25. Maintenance Lifecycle

```text
Scheduled
   ↓
Starting Soon
   ↓
In Progress
   ↓
Completed
```

If maintenance exceeds its expected end time:

```text
Maintenance
      ↓
overdue
      ↓
Administrator alert
```

---

# 26. Incident Notifications

Subscribers must be notified when:

- Incident created
- Incident severity changes
- Incident status changes
- Incident resolved
- Maintenance scheduled
- Maintenance updated
- Maintenance starts
- Maintenance completed

---

# 27. Subscription System

Public users can subscribe without creating a GSTfy account.

Supported methods:

```text
Email
Webhook
Slack
Microsoft Teams
RSS
Atom
```

Subscription fields:

```text
id
email
type
verification_token
verified
active
services
created_at
updated_at
```

Users can subscribe to:

```text
All services
Specific services
Incident updates
Maintenance
```

---

# 28. Email Verification

Email subscriptions must use double opt-in.

Flow:

```text
User enters email
      ↓
Verification email
      ↓
Click confirmation
      ↓
Subscription activated
```

Do not send incident notifications to unverified addresses.

---

# 29. Webhook Subscriptions

Webhook users receive:

```json
{
  "event": "incident.updated",
  "incident": {
    "id": "inc_123",
    "status": "monitoring"
  },
  "timestamp": "2026-09-02T10:30:00Z"
}
```

Supported events:

```text
incident.created
incident.updated
incident.resolved
maintenance.created
maintenance.updated
maintenance.started
maintenance.completed
service.status_changed
```

---

# 30. Webhook Security

Each webhook must have a signing secret.

Header:

```text
X-GSTfy-Signature
```

Signature:

```text
HMAC-SHA256
```

Clients verify the payload using the shared secret.

Webhook requests must also include:

```text
X-GSTfy-Event
X-GSTfy-Delivery-ID
X-GSTfy-Timestamp
```

---

# 31. Webhook Retry

Failed webhook delivery must be retried.

Suggested retry schedule:

```text
30 seconds
2 minutes
5 minutes
15 minutes
30 minutes
1 hour
```

After repeated failure:

```text
Webhook disabled
```

or:

```text
Webhook marked unhealthy
```

The admin must be alerted.

---

# 32. Slack Integration

Support Slack notifications through incoming webhook or Slack OAuth integration.

Example:

```text
GSTfy Status Alert

🔴 API Major Outage

Started:
11:42 IST

Affected:
GSTfy API

View incident:
status.gstfy.in/incidents/api-outage
```

---

# 33. Microsoft Teams Integration

Support Microsoft Teams webhook notifications.

Same notification events as Slack.

---

# 34. RSS / Atom

Public feeds:

```text
https://status.gstfy.in/rss.xml
https://status.gstfy.in/atom.xml
```

Feed entries should include:

- Incident title
- Current status
- Description
- Updated timestamp
- Incident URL

---

# 35. Public API

Provide a read-only API.

Example:

```text
GET /api/v1/status
GET /api/v1/services
GET /api/v1/services/:slug
GET /api/v1/incidents
GET /api/v1/incidents/:id
GET /api/v1/maintenance
```

Example response:

```json
{
  "status": "operational",
  "updatedAt": "2026-09-02T06:30:00Z",
  "services": [
    {
      "name": "API",
      "slug": "api",
      "status": "operational"
    }
  ]
}
```

---

# 36. Embeddable Status Badge

Provide an embeddable status badge.

Example:

```html
<img
  src="https://status.gstfy.in/api/v1/badge"
  alt="GSTfy Status"
/>
```

Badge states:

```text
Operational
Degraded
Outage
Maintenance
```

---

# 37. Public Status Widget

Provide an embeddable JavaScript widget.

Example:

```html
<script
  src="https://status.gstfy.in/widget.js"
  data-service="api">
</script>
```

The widget shows:

```text
● GSTfy API Operational
```

---

# 38. Availability Metrics

Calculate:

```text
uptime
downtime
availability percentage
incident count
incident duration
```

Example:

```text
API Availability

24 hours       99.92%
7 days         99.97%
30 days        99.98%
90 days        99.95%
12 months      99.91%
```

Formula:

```text
Availability =
(total time - downtime)
----------------------- × 100
total time
```

Scheduled maintenance may be excluded based on configuration.

---

# 39. Response Time Metrics

Track:

```text
P50
P75
P90
P95
P99
```

Example:

```text
API Response Time

P50    110ms
P75    180ms
P90    260ms
P95    340ms
P99    790ms
```

Display historical charts.

---

# 40. Regional Status

Service page example:

```text
API

India             Operational
Singapore         Operational
Europe            Operational
United States     Degraded
```

This allows users to understand geographic impact.

---

# 41. Dependency Mapping

Services can have dependencies.

Example:

```text
Invoice Engine
    │
    ├── API
    ├── Database
    ├── File Storage
    └── GST Integration
```

If a dependency fails, the system can identify potentially affected services.

Example:

```text
GST Integration
      ↓
Invoice Engine affected
      ↓
Customer invoice creation degraded
```

Dependency status should be visible to administrators.

---

# 42. External Dependency Monitoring

Monitor external services such as:

```text
Payment Provider
GST APIs
Email provider
SMS provider
Cloud storage
Authentication provider
```

External dependencies should be represented separately from GSTfy-owned infrastructure.

---

# 43. Dependency Incident Correlation

Example:

```text
Payment Provider
        ↓
External service outage
        ↓
Payment Service degraded
        ↓
Invoice payment affected
```

The system should avoid creating five duplicate incidents for the same underlying problem.

Implement incident correlation.

---

# 44. Alert Deduplication

Example:

```text
API monitor failed
API health check failed
API synthetic request failed
```

These should potentially map to one incident instead of three incidents.

Use:

```text
service_id
failure_signature
time_window
```

for deduplication.

---

# 45. Alert Escalation

Internal alerts should support:

```text
Info
Warning
Critical
```

Example:

```text
3 failed checks
    ↓
Warning

5 failed checks
    ↓
Critical

15 minutes unresolved
    ↓
Escalate to administrator
```

---

# 46. Internal Alerts

The status system itself must monitor:

```text
Monitoring worker health
Database health
Notification queue
Webhook queue
Email queue
Monitoring lag
Scheduler health
```

This creates the meta-monitoring requirement:

```text
Monitor the monitoring system.
```

---

# 47. Monitoring Worker Heartbeats

Every worker periodically sends:

```text
worker_id
region
last_seen
version
status
```

If a worker disappears:

```text
Worker heartbeat missing
```

the administrator is alerted.

---

# 48. Queue Monitoring

Notifications and monitoring jobs should use queues.

Example:

```text
Monitor
   ↓
Queue
   ↓
Worker
```

Queues:

```text
monitoring
incidents
email
webhooks
slack
maintenance
```

Monitor:

```text
queue size
processing time
failed jobs
retry count
```

---

# 49. Admin Dashboard

Admin URL:

```text
https://status.gstfy.in/admin
```

Admin dashboard sections:

```text
Overview
Services
Monitors
Incidents
Maintenance
Subscribers
Notifications
Workers
Dependencies
Metrics
Audit Logs
Settings
```

---

# 50. Admin Overview

Display:

```text
Overall Status
Active Incidents
Scheduled Maintenance
Services Down
Services Degraded
Monitoring Failures
Notification Failures
Worker Health
```

Example:

```text
System Status      Operational
Active Incidents   1
Degraded Services  2
Major Outages      0
Failed Monitors    3
Notification Queue 12
```

---

# 51. Service Management

Admins can:

- Create service
- Edit service
- Delete/deactivate service
- Change display order
- Assign service group
- Configure public visibility
- Configure dependencies
- Configure monitoring
- Configure alert thresholds

---

# 52. Monitor Management

Admins can:

- Create monitor
- Edit monitor
- Disable monitor
- Delete monitor
- Change interval
- Add regions
- Configure timeout
- Configure retry policy
- Configure expected response
- Configure failure thresholds

---

# 53. Incident Management

Admins can:

- Create incident
- Edit incident
- Assign services
- Change severity
- Update status
- Add incident updates
- Resolve incident
- Reopen incident
- Schedule notifications
- Send manual notification

---

# 54. Incident Reopening

Resolved incidents may be reopened if the problem returns.

Flow:

```text
Resolved
   ↓
New failure detected
   ↓
Reopened
```

The system can either:

1. Reopen the existing incident
2. Create a new related incident

This must be configurable.

---

# 55. Maintenance Management

Admins can:

- Schedule maintenance
- Edit maintenance
- Cancel maintenance
- Start maintenance
- Complete maintenance
- Extend maintenance
- Change affected services
- Preview notifications

---

# 56. Notification Preview

Before sending a message, administrators can preview:

```text
Email
Slack
Webhook
Teams
```

Example:

```text
Incident Notification

Subject:
GSTfy API experiencing an outage

Body:
We are investigating...
```

---

# 57. Role-Based Access Control

Roles:

```text
Owner
Administrator
Incident Manager
Operator
Viewer
```

Permissions:

```text
services.read
services.write
monitors.read
monitors.write
incidents.read
incidents.write
maintenance.read
maintenance.write
subscribers.read
notifications.send
settings.write
audit.read
```

---

# 58. Authentication

Admin authentication must support:

```text
Email/password
MFA
Passkeys/WebAuthn
Session management
```

For production, MFA should be mandatory for administrators.

---

# 59. Audit Logging

Every administrative action should create an audit record.

Example:

```text
admin_user
action
resource_type
resource_id
old_value
new_value
ip_address
user_agent
created_at
```

Example:

```text
Admin: john
Action: INCIDENT_UPDATED
Incident: inc_123
From: investigating
To: identified
Timestamp: ...
```

Audit logs should be append-only.

---

# 60. Security

Security requirements:

- HTTPS only
- HSTS
- Secure cookies
- CSRF protection
- Rate limiting
- Input validation
- Output encoding
- SQL injection protection
- XSS protection
- SSRF protection
- Webhook signature validation
- Authorization checks
- MFA for admin
- Secret encryption
- API key rotation
- Audit logging

---

# 61. SSRF Protection

Because monitoring accepts URLs, SSRF protection is mandatory.

Never allow arbitrary monitoring requests to:

```text
localhost
127.0.0.1
0.0.0.0
169.254.169.254
private IP ranges
internal DNS
```

unless explicitly approved.

Only approved monitoring targets should be accessible.

---

# 62. Rate Limiting

Protect:

```text
Public API
Admin API
Subscription endpoints
Webhook endpoints
Incident creation
Login
Password reset
```

Example:

```text
Public API:
100 requests/minute/IP

Admin login:
10 attempts/minute/IP
```

Values should be configurable.

---

# 63. Admin Secrets

Secrets must never be stored in source control.

Use:

```text
Environment variables
Secret Manager
Vault
Cloud provider Secret Manager
```

Secrets include:

```text
Database password
SMTP password
Webhook secrets
Slack tokens
Encryption keys
JWT secrets
```

---

# 64. Database

Recommended database:

```text
PostgreSQL
```

Core tables:

```text
users
roles
permissions
services
service_groups
service_dependencies
monitors
monitor_regions
monitor_results
incidents
incident_services
incident_updates
maintenance
maintenance_services
subscribers
subscriptions
webhooks
webhook_deliveries
notifications
notification_deliveries
workers
worker_heartbeats
audit_logs
settings
```

---

# 65. Example Database Relationships

```text
service_groups
      │
      └──── services
                │
                ├──── monitors
                │       └──── monitor_results
                │
                ├──── incidents
                │       └──── incident_updates
                │
                └──── dependencies

subscribers
      │
      └──── subscriptions
              │
              └──── services
```

---

# 66. Database Indexes

Important indexes:

```text
services.slug
services.status
monitors.service_id
monitor_results.monitor_id
monitor_results.checked_at
incidents.status
incidents.started_at
incident_updates.incident_id
maintenance.start_at
subscriptions.service_id
webhook_deliveries.status
audit_logs.created_at
```

Use composite indexes where needed.

---

# 67. Time Handling

All database timestamps should be stored in UTC.

Example:

```text
2026-09-02T06:30:00Z
```

Display timestamps according to user/browser timezone.

Maintenance must store an explicit timezone.

---

# 68. Caching

Public status endpoints can use short caching.

Example:

```text
Cache-Control:
public, max-age=30
```

Do not cache administrator endpoints.

Status pages can be aggressively CDN cached as long as the cache TTL is short enough for the desired freshness.

---

# 69. Real-Time Updates

Use:

```text
Server-Sent Events
```

or:

```text
WebSocket
```

for live incident updates when appropriate.

Example:

```text
API status
    ↓
event emitted
    ↓
status page receives event
    ↓
UI updates automatically
```

Polling every few seconds is acceptable as a simpler fallback.

---

# 70. Event-Driven Architecture

Use events internally.

Examples:

```text
service.status.changed
monitor.failed
monitor.recovered
incident.created
incident.updated
incident.resolved
maintenance.created
maintenance.started
maintenance.completed
notification.created
notification.failed
```

This allows monitoring, incidents, notifications, and analytics to remain decoupled.

---

# 71. Event Example

```json
{
  "event": "monitor.failed",
  "timestamp": "2026-09-02T06:42:00Z",
  "monitorId": "mon_123",
  "serviceId": "svc_api",
  "region": "india",
  "status": "failed",
  "responseTime": 4120,
  "httpStatus": 503
}
```

---

# 72. Incident Engine

The Incident Engine consumes monitoring events.

Flow:

```text
Monitor Failure
      ↓
Failure Aggregation
      ↓
Threshold Evaluation
      ↓
Incident Correlation
      ↓
Incident Creation
      ↓
Service Status Update
      ↓
Notification
      ↓
Public Status Page
```

---

# 73. Recovery Engine

Recovery:

```text
Successful health checks
          ↓
Recovery threshold
          ↓
Incident monitoring
          ↓
Service operational
          ↓
Incident resolved
          ↓
Subscribers notified
```

Do not immediately resolve after one successful request.

---

# 74. Notification Engine

The Notification Engine should be asynchronous.

```text
Incident
   ↓
Notification Job
   ↓
Queue
   ↓
Worker
   ├── Email
   ├── Slack
   ├── Teams
   └── Webhook
```

This prevents notification providers from blocking the incident API.

---

# 75. Notification Templates

Templates should support:

```text
Incident Created
Incident Updated
Incident Resolved
Maintenance Scheduled
Maintenance Started
Maintenance Completed
```

Templates should support variables:

```text
{{incident.title}}
{{incident.status}}
{{service.name}}
{{incident.startedAt}}
{{incident.url}}
```

---

# 76. Status Page Customization

Admin can configure:

```text
Company name
Logo
Favicon
Brand colors
Footer text
Support URL
Privacy URL
Terms URL
Incident notification text
```

Never allow arbitrary unsafe HTML.

---

# 77. Branding

Default branding:

```text
GSTfy
GSTfy System Status
```

Example:

```text
GSTfy System Status

Powered by GSTfy
```

---

# 78. Accessibility

The public page must support:

- Keyboard navigation
- Semantic HTML
- Screen readers
- Focus indicators
- Accessible colors
- ARIA status announcements
- Reduced motion

Status must never be communicated through color alone.

For example:

```text
● Operational
● Degraded Performance
● Major Outage
```

and not only:

```text
green
yellow
red
```

---

# 79. Dark Mode

Support:

```text
System
Light
Dark
```

Ensure charts and status indicators remain readable in both themes.

---

# 80. Responsive Design

The public site must work on:

```text
Mobile
Tablet
Desktop
Large screens
```

Primary public page should remain simple and readable.

---

# 81. SEO

Public pages should include:

```text
title
description
OpenGraph
Twitter metadata
canonical URL
structured metadata
```

Example:

```text
GSTfy Status — System Status and Incidents
```

The status page should be indexable.

Admin pages must not be indexed.

---

# 82. Health Endpoint for Status App

The Status App itself must expose:

```text
GET /health
```

and:

```text
GET /health/ready
```

Example:

```json
{
  "status": "ok"
}
```

The status service should have separate infrastructure monitoring itself.

---

# 83. Backup Strategy

Back up:

```text
Status database
Configuration
Incident history
Audit logs
Subscription information
```

Recommended:

```text
Daily full backup
Continuous WAL / point-in-time recovery
```

Test restoration periodically.

---

# 84. Disaster Recovery

Target:

```text
RPO ≤ 15 minutes
RTO ≤ 1 hour
```

The exact targets can be changed based on business requirements.

Maintain documented restoration procedures.

---

# 85. Deployment

Recommended:

```text
Cloudflare
     ↓
status.gstfy.in
     ↓
CDN / WAF
     ↓
Status Web
```

Backend:

```text
Status API
Status Workers
Monitoring Workers
Notification Workers
```

These components can be deployed independently.

---

# 86. Repository Structure

The Status App lives inside the Gstfy monorepo as an independent application under `apps/status/`.

```text
gstfy/
├── apps/
│   ├── web/                    ← Main Gstfy web app (Next.js)
│   ├── backend/                ← Main Gstfy API (Fastify)
│   └── status/                 ← Status App (independent)
│       ├── web/                ← Status public + admin UI (Next.js)
│       │   ├── app/
│       │   │   ├── page.tsx                ← Public status dashboard
│       │   │   ├── incidents/
│       │   │   │   └── [slug]/page.tsx     ← Incident detail
│       │   │   ├── services/
│       │   │   │   └── [slug]/page.tsx     ← Service detail
│       │   │   ├── maintenance/
│       │   │   │   └── [slug]/page.tsx     ← Maintenance detail
│       │   │   ├── subscribe/page.tsx      ← Subscription management
│       │   │   ├── api/
│       │   │   │   └── v1/
│       │   │   │       ├── status/route.ts
│       │   │   │       ├── services/route.ts
│       │   │   │       ├── incidents/route.ts
│       │   │   │       ├── maintenance/route.ts
│       │   │   │       └── badge/route.ts
│       │   │   ├── admin/
│       │   │   │   ├── page.tsx            ← Admin overview
│       │   │   │   ├── services/page.tsx
│       │   │   │   ├── monitors/page.tsx
│       │   │   │   ├── incidents/page.tsx
│       │   │   │   ├── incidents/new/page.tsx
│       │   │   │   ├── maintenance/page.tsx
│       │   │   │   ├── maintenance/new/page.tsx
│       │   │   │   ├── subscribers/page.tsx
│       │   │   │   ├── notifications/page.tsx
│       │   │   │   ├── dependencies/page.tsx
│       │   │   │   ├── metrics/page.tsx
│       │   │   │   ├── audit-logs/page.tsx
│       │   │   │   └── settings/page.tsx
│       │   │   ├── health/route.ts
│       │   │   ├── rss.xml/route.ts
│       │   │   └── atom.xml/route.ts
│       │   ├── components/
│       │   │   ├── status-header/
│       │   │   ├── service-list/
│       │   │   ├── status-indicator/
│       │   │   ├── incident-card/
│       │   │   ├── incident-timeline/
│       │   │   ├── uptime-chart/
│       │   │   ├── maintenance-card/
│       │   │   └── subscribe-form/
│       │   ├── lib/
│       │   │   ├── api/
│       │   │   ├── auth/
│       │   │   ├── status/
│       │   │   └── notifications/
│       │   └── middleware.ts
│       ├── api/                ← Status API (Fastify)
│       │   ├── src/
│       │   │   ├── routes/
│       │   │   ├── services/
│       │   │   ├── middleware/
│       │   │   └── config/
│       │   └── package.json
│       └── workers/            ← Background workers
│           ├── monitoring/     ← Uptime checks, multi-region
│           ├── incident-engine/ ← Failure aggregation, incident lifecycle
│           └── notifications/  ← Email, webhook, Slack, Teams
├── packages/
│   ├── ui/                     ← Shared UI components
│   ├── status-db/              ← Status App database schema (Drizzle)
│   │   ├── src/
│   │   │   ├── schema.ts
│   │   │   ├── migrations/
│   │   │   └── client.ts
│   │   └── package.json
│   ├── status-types/           ← Shared TypeScript types
│   │   ├── src/
│   │   │   ├── service.ts
│       │   │   ├── monitor.ts
│       │   │   ├── incident.ts
│       │   │   ├── maintenance.ts
│       │   │   ├── subscriber.ts
│       │   │   ├── notification.ts
│       │   │   └── index.ts
│   │   └── package.json
│   └── status-config/          ← Shared configuration
├── docs/
│   └── apps/
│       └── status-app/
│           └── status-app-spec.md
└── README.md
```

---

# 87. Next.js Structure (Status Web)

```text
apps/status/web/
│
├── app/
│   ├── page.tsx                          ← Public status dashboard
│   ├── incidents/
│   │   └── [slug]/page.tsx               ← Incident detail page
│   ├── services/
│   │   └── [slug]/page.tsx               ← Service detail page
│   ├── maintenance/
│   │   └── [slug]/page.tsx               ← Maintenance detail page
│   ├── subscribe/page.tsx                ← Subscription management
│   ├── api/
│   │   └── v1/
│   │       ├── status/route.ts           ← Public status API
│   │       ├── services/route.ts         ← Services list
│   │       ├── services/[slug]/route.ts  ← Service detail
│   │       ├── incidents/route.ts        ← Incidents list
│   │       ├── incidents/[id]/route.ts   ← Incident detail
│   │       ├── maintenance/route.ts      ← Maintenance list
│   │       ├── badge/route.ts            ← Status badge SVG
│   │       └── subscribe/route.ts        ← Subscription API
│   ├── admin/
│   │   ├── page.tsx                      ← Admin overview
│   │   ├── services/page.tsx             ← Service management
│   │   ├── services/[id]/page.tsx        ← Service edit
│   │   ├── monitors/page.tsx             ← Monitor list
│   │   ├── monitors/[id]/page.tsx        ← Monitor edit
│   │   ├── incidents/page.tsx            ← Incident list
│   │   ├── incidents/new/page.tsx        ← Create incident
│   │   ├── incidents/[id]/page.tsx       ← Incident detail
│   │   ├── maintenance/page.tsx          ← Maintenance list
│   │   ├── maintenance/new/page.tsx      ← Schedule maintenance
│   │   ├── subscribers/page.tsx          ← Subscriber management
│   │   ├── notifications/page.tsx        ← Notification history
│   │   ├── dependencies/page.tsx         ← Dependency mapping
│   │   ├── metrics/page.tsx              ← Metrics dashboard
│   │   ├── audit-logs/page.tsx           ← Audit trail
│   │   └── settings/page.tsx             ← System settings
│   ├── health/route.ts                   ← Health check endpoint
│   ├── rss.xml/route.ts                  ← RSS feed
│   └── atom.xml/route.ts                 ← Atom feed
│
├── components/
│   ├── status-header/                    ← Status page header + overall status
│   ├── service-list/                     ← Grouped service status list
│   ├── status-indicator/                 ← Status dot + label component
│   ├── incident-card/                    ← Incident summary card
│   ├── incident-timeline/                ← Incident update timeline
│   ├── uptime-chart/                     ← Uptime bar chart
│   ├── maintenance-card/                 ← Maintenance schedule card
│   └── subscribe-form/                   ← Email/webhook subscription form
│
├── lib/
│   ├── api/                              ← API client for status endpoints
│   ├── auth/                             ← Admin authentication helpers
│   ├── status/                           ← Status calculation utilities
│   └── notifications/                    ← Notification helpers
│
└── middleware.ts                         ← Admin auth guard, rate limiting
```

---

# 88. Admin UI Routes

```text
/admin                                ← Overview dashboard
/admin/services                       ← Service list + create
/admin/services/:id                   ← Service edit + config
/admin/monitors                       ← Monitor list + create
/admin/monitors/:id                   ← Monitor edit + regions
/admin/incidents                      ← Incident list + search + filter
/admin/incidents/new                  ← Create incident
/admin/incidents/:id                  ← Incident detail + timeline
/admin/maintenance                    ← Maintenance list
/admin/maintenance/new                ← Schedule maintenance
/admin/subscribers                    ← Subscriber management
/admin/notifications                  ← Notification history
/admin/dependencies                   ← Service dependency graph
/admin/metrics                        ← Availability + latency metrics
/admin/audit-logs                     ← Audit trail
/admin/settings                       ← System settings + branding
```

---

# 89. API Authentication

Public:

```text
No authentication
```

Admin:

```text
Authenticated session
```

Machine-to-machine:

```text
API Key
```

For admin automation:

```text
POST /api/v1/incidents
Authorization: Bearer <token>
```

API keys must:

- Be hashed at rest
- Have scopes
- Support expiration
- Support revocation
- Have audit records

---

# 90. API Versioning

Use:

```text
/api/v1/...
```

When breaking changes are introduced:

```text
/api/v2/...
```

Do not silently break the public status API.

---

# 91. Error Format

Use consistent API errors:

```json
{
  "error": {
    "code": "INCIDENT_NOT_FOUND",
    "message": "Incident not found"
  }
}
```

Never expose stack traces.

---

# 92. Logging

Use structured JSON logs.

Example:

```json
{
  "timestamp": "2026-09-02T06:42:00Z",
  "level": "error",
  "service": "monitor-worker",
  "monitorId": "mon_123",
  "region": "india",
  "message": "Health check failed"
}
```

Use correlation IDs:

```text
X-Request-ID
```

---

# 93. Observability

Monitor the Status App itself using:

```text
Metrics
Logs
Traces
```

Important metrics:

```text
monitor_checks_total
monitor_failures_total
monitor_latency_ms
active_incidents
incident_resolution_time
notification_failures
webhook_failures
queue_depth
worker_heartbeat_age
api_latency
status_page_latency
```

---

# 94. Important Business Metrics

Track:

```text
Availability %
MTTR
MTTD
Incident count
Incident duration
False positive rate
Notification delivery rate
Webhook success rate
```

Definitions:

```text
MTTD = Mean Time To Detect

MTTR = Mean Time To Resolve
```

---

# 95. False Positive Protection

Monitoring should tolerate transient errors.

Example:

```text
Request fails
    ↓
Retry immediately
    ↓
Retry after short delay
    ↓
Only then count as failure
```

This significantly reduces false incidents caused by temporary network problems.

---

# 96. Incident Severity Rules

Example:

```text
Minor
Only small subset affected.

Major
Important functionality unavailable.

Critical
Most or all customers affected.
```

Severity may also be manually overridden by an incident manager.

---

# 97. Customer Impact

Incident updates should describe impact in business terms.

Avoid:

```text
PostgreSQL replication lag increased.
```

Prefer:

```text
Some customers may experience delays when creating invoices.
```

Technical details can remain internal.

---

# 98. Incident Communication Rules

Public updates should:

- Be factual
- Avoid speculation
- Avoid sensitive infrastructure details
- Clearly explain customer impact
- Include next update expectations
- Use consistent terminology

---

# 99. Private Incident Notes

Incident managers may maintain private notes.

Example:

```text
Public:
Customers may experience invoice delays.

Private:
Database node db-03 is experiencing replication problems.
```

Private notes must never appear on the public status page.

---

# 100. Incident Postmortem

Resolved incidents should optionally contain a postmortem.

Fields:

```text
summary
root_cause
impact
timeline
resolution
preventive_actions
follow_up_tasks
```

Public visibility should be configurable.

---

# 101. Postmortem Example

```text
Incident:
GSTfy API outage

Impact:
API requests failed for approximately 18 minutes.

Root Cause:
...

Resolution:
...

Preventive Actions:
...

Completed:
...
```

---

# 102. Status History

Store every public status transition.

Example:

```text
operational
    ↓
degraded
    ↓
major_outage
    ↓
degraded
    ↓
operational
```

This enables accurate uptime calculation and historical display.

---

# 103. Status Transition Table

```text
service_status_history
----------------------
id
service_id
old_status
new_status
reason
incident_id
created_at
```

---

# 104. Uptime Calculation

Do not calculate uptime from only the current status.

Use:

```text
service_status_history
```

and monitoring results to calculate downtime.

Scheduled maintenance may be excluded according to the configured SLA policy.

---

# 105. SLA Support

Allow configurable availability targets.

Example:

```text
API:
99.90%

Invoice Engine:
99.95%

Authentication:
99.99%
```

Display:

```text
Target:
99.95%

Actual:
99.98%

Status:
Meeting SLA
```

---

# 106. SLA Reporting

Monthly report:

```text
September 2026

API
Uptime: 99.97%
Target: 99.90%

Invoice Engine
Uptime: 99.99%
Target: 99.95%
```

Reports can be exported as:

```text
CSV
JSON
PDF
```

---

# 107. Status Page Analytics

Track:

```text
Page views
Incident views
Service views
Subscription conversions
Notification clicks
```

Do not collect unnecessary personally identifiable information.

---

# 108. Privacy

Subscribers must be able to:

```text
Unsubscribe
Change subscriptions
Delete subscription
```

Store only necessary information.

Do not expose subscriber emails publicly.

---

# 109. Email Unsubscribe

Every notification email must include:

```text
Unsubscribe
Manage subscriptions
```

Use signed links rather than exposing raw database identifiers.

---

# 110. Anti-Abuse

Protect subscription endpoints against:

```text
Spam
Email bombing
Webhook abuse
API scraping
Incident spam
```

Use:

```text
Rate limiting
Captcha where necessary
Email verification
Abuse detection
```

---

# 111. Public Incident URL

Every incident should have a stable URL:

```text
https://status.gstfy.in/incidents/2026-09-02-api-outage
```

Do not change the public URL after publication.

---

# 112. Public Maintenance URL

Example:

```text
https://status.gstfy.in/maintenance/2026-09-05-api-maintenance
```

---

# 113. Incident Search

Admin dashboard should support search by:

```text
Title
Service
Severity
Status
Date
Incident ID
```

---

# 114. Incident Filtering

Filters:

```text
Active
Resolved
Major
Critical
Service
Date range
Automated
Manual
```

---

# 115. Export

Admin can export:

```text
Incidents CSV
Monitoring CSV
Availability CSV
Subscribers CSV
Audit logs CSV
```

Exports should use background jobs for large datasets.

---

# 116. Configuration

Environment example:

```env
STATUS_BASE_URL=https://status.gstfy.in

DATABASE_URL=...

REDIS_URL=...

SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASSWORD=...

WEBHOOK_SIGNING_SECRET=...

ENCRYPTION_KEY=...

MONITOR_DEFAULT_INTERVAL=60

MONITOR_DEFAULT_TIMEOUT=10

INCIDENT_FAILURE_THRESHOLD=5

INCIDENT_RECOVERY_THRESHOLD=3
```

Never commit real secrets.

---

# 117. DNS

Production:

```text
status.gstfy.in → Status App
```

This does not need to share the tenant wildcard application.

Main application:

```text
*.gstfy.in
```

Status application:

```text
status.gstfy.in
```

The explicit `status` DNS record should take precedence over any wildcard record.

---

# 118. TLS

Certificate must cover:

```text
status.gstfy.in
```

Use automatic certificate renewal.

HTTPS must redirect from HTTP.

---

# 119. Main GSTfy Relationship

The status application should monitor:

```text
https://gstfy.in
https://api.gstfy.in
https://auth.gstfy.in
```

It should NOT use:

```text
status.gstfy.in → GSTfy backend
```

as a dependency.

---

# 120. Tenant Awareness

The status application is NOT tenant-specific by default.

It represents the global GSTfy platform.

Therefore:

```text
acme.gstfy.in
tcs.gstfy.in
reliance.gstfy.in
```

all use:

```text
status.gstfy.in
```

unless a future requirement introduces tenant-specific service status.

---

# 121. Optional Tenant-Specific Status

Future support may allow:

```text
status.gstfy.in/tenants/acme
```

but this should not be implemented unless there is a clear business requirement.

The default status page should remain global.

---

# 122. Status Page Availability Goal

The status page should have a higher reliability target than the main application.

Example:

```text
GSTfy application:
99.9%

Status page:
99.99%+
```

The exact target depends on infrastructure and budget.

---

# 123. Deployment Separation

Preferred:

```text
Main GSTfy
├── web
├── backend
└── workers

GSTfy Status
├── status-web
├── status-api
├── monitoring-workers
└── notification-workers
```

Do not force both systems to share the same deployment lifecycle.

---

# 124. Database Separation

Use a separate database:

```text
GSTfy PostgreSQL
```

and:

```text
GSTfy Status PostgreSQL
```

The status application should not depend on the main application's database.

---

# 125. Failure Scenario

### GSTfy API goes down

```text
Monitor
   ↓
API health check fails
   ↓
Retry
   ↓
Threshold exceeded
   ↓
Incident created
   ↓
API = Major Outage
   ↓
Email subscribers
   ↓
Status page updated
```

---

# 126. Status App Failure Scenario

If the Status App itself goes down:

```text
External monitor
        ↓
status.gstfy.in unavailable
        ↓
Alert GSTfy operations
```

Do not rely on the Status App to monitor itself.

Use an external monitoring system.

---

# 127. Recommended External Monitoring

The Status App should itself be monitored by an independent monitoring service.

Example:

```text
External Uptime Monitor
        ↓
status.gstfy.in
```

This prevents a silent Status App outage.

---

# 128. Testing

Automated tests should cover:

### Unit

```text
Status calculation
Incident transitions
Availability calculation
Failure thresholds
Recovery thresholds
Slug generation
Notification templates
```

### Integration

```text
Monitor → Incident
Incident → Notification
Maintenance → Notification
Webhook delivery
Subscription verification
```

### End-to-End

```text
Create monitor
Trigger outage
Verify incident
Verify public page
Verify notification
Recover service
Verify resolution
```

---

# 129. Chaos Testing

Simulate:

```text
API outage
Database unavailable
Redis unavailable
Monitoring worker failure
Notification provider failure
Webhook endpoint unavailable
Status API failure
Network partition
```

Verify graceful recovery.

---

# 130. Load Testing

Test:

```text
Public status page
Public API
Incident spikes
Large subscriber list
High webhook volume
Large monitoring result volume
```

---

# 131. Migration Strategy

Start with:

```text
Services
Monitors
Incidents
Maintenance
Subscribers
Notifications
```

Then add:

```text
Multi-region
Dependency graph
SLA
Postmortem
Analytics
Advanced integrations
```

The architecture should support these from the beginning even if they are enabled progressively.

---

# 132. Recommended Technology Stack

Frontend:

```text
Next.js
TypeScript
React
Tailwind CSS
```

Backend:

```text
Node.js
TypeScript
Fastify / NestJS / Next.js API
```

Database:

```text
PostgreSQL
```

Queue/cache:

```text
Redis
```

Background workers:

```text
Node.js workers
```

Monitoring:

```text
Custom monitoring workers
```

Email:

```text
SMTP provider / transactional email provider
```

Notifications:

```text
Webhook
Slack
Teams
Email
```

Deployment:

```text
Cloudflare
Docker
Managed compute / Kubernetes / ECS / VM
```

The stack can be adjusted to match GSTfy's existing infrastructure.

---

# 133. Suggested Status Components

Initial GSTfy service catalog:

```text
GSTfy Web Application

GSTfy API

Authentication

Invoice Engine

Purchase Invoice Service

Sales Invoice Service

GST Integration

Payment Integration

File Storage

Email Notifications

SMS Notifications
```

Infrastructure:

```text
Primary Database

Redis

Background Workers

Object Storage
```

External:

```text
Payment Provider

GST Services

Email Provider

SMS Provider
```

---

# 134. Status Page Navigation

Public:

```text
Status
Services
Incidents
Maintenance
Subscribe
```

Footer:

```text
GSTfy
Support
Privacy
Terms
```

Admin:

```text
Overview
Services
Monitors
Incidents
Maintenance
Subscribers
Notifications
Dependencies
Metrics
Audit Logs
Settings
```

---

# 135. Overall User Experience

A customer opening the site should be able to understand the state in less than 5 seconds.

First visible information:

```text
GSTfy System Status

● All Systems Operational
```

Then:

```text
What is affected?
```

Then:

```text
What happened?
```

Then:

```text
When will it be fixed?
```

Avoid overwhelming users with infrastructure details.

---

# 136. Example Final Public Page

```text
──────────────────────────────────────────────

              GSTfy System Status

          ● All Systems Operational

             Updated 2 min ago

──────────────────────────────────────────────

GSTfy Platform

Web Application             ● Operational
API                         ● Operational
Authentication              ● Operational
Invoice Engine              ● Operational

Infrastructure

Database                    ● Operational
File Storage                ● Operational
Background Workers          ● Operational

External Services

Payments                    ● Operational
GST Integration             ● Operational

──────────────────────────────────────────────

30-Day Availability

API                         99.98%
Authentication              99.99%
Invoice Engine              99.97%

──────────────────────────────────────────────

Past Incidents

September 1, 2026
API latency
Resolved

August 28, 2026
Scheduled maintenance
Completed

──────────────────────────────────────────────

Subscribe to Status Updates

Email  |  Webhook  |  RSS

──────────────────────────────────────────────

GSTfy
Support · Privacy · Terms

──────────────────────────────────────────────
```

---

# 137. Example Active Incident

```text
──────────────────────────────────────────────

             GSTfy System Status

          🔴 Major Outage

──────────────────────────────────────────────

API

● Major Outage

We are investigating increased API failures
affecting invoice and customer requests.

──────────────────────────────────────────────

Incident Timeline

11:42 IST
Investigating

11:51 IST
Identified

12:10 IST
Monitoring

──────────────────────────────────────────────

Affected Services

API                         ● Major Outage
Invoice Engine              ● Degraded
Web Application             ● Operational

──────────────────────────────────────────────

Subscribe to Updates

──────────────────────────────────────────────
```

---

# 138. Example Scheduled Maintenance

```text
──────────────────────────────────────────────

GSTfy System Status

🟡 Scheduled Maintenance

──────────────────────────────────────────────

GSTfy API Infrastructure Maintenance

September 5, 2026

01:00–02:00 IST

Expected impact:

Invoice creation may be temporarily
unavailable during the maintenance window.

──────────────────────────────────────────────

Affected Services

API
Invoice Engine

──────────────────────────────────────────────
```

---

# 139. Operational Principles

The system must follow these principles:

```text
1. Status page must remain independent.
2. Monitoring must be automated.
3. One transient failure must not create an incident.
4. Public communication must be simple.
5. Technical diagnostics must remain private.
6. Every incident must have a timeline.
7. Every notification must be auditable.
8. Monitoring must monitor itself.
9. Tenant data must never be exposed.
10. All critical administrative actions must be logged.
```

---

# 140. Final Architecture

```text
                            ┌───────────────────────────┐
                            │        Customers          │
                            └─────────────┬─────────────┘
                                          │
                                          ▼
                              https://status.gstfy.in
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ Cloudflare/WAF  │
                                 └────────┬────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ Next.js Web     │
                                 └────────┬────────┘
                                          │
                               ┌──────────┴───────────┐
                               │                      │
                               ▼                      ▼
                       Public Status API        Admin API
                               │                      │
                               └──────────┬───────────┘
                                          │
                                          ▼
                                  PostgreSQL
                                          │
              ┌───────────────────────────┼─────────────────────────┐
              │                           │                         │
              ▼                           ▼                         ▼
        Monitoring Engine          Incident Engine          Notification
              │                           │                    Engine
              │                           │                         │
      ┌───────┼────────┐                  │          ┌──────────────┼────────────┐
      ▼       ▼        ▼                  ▼          ▼              ▼            ▼
    India   Europe   Singapore       Incidents    Email         Slack        Webhook
      │       │        │
      └───────┴────────┘
              │
              ▼
       GSTfy Infrastructure
              │
     ┌────────┼──────────┐
     ▼        ▼          ▼
   Web App   API       External APIs
```

The final platform provides:

```text
PUBLIC STATUS PAGE
        +
UPTIME MONITORING
        +
MULTI-REGION CHECKS
        +
AUTOMATIC INCIDENT DETECTION
        +
MANUAL INCIDENT MANAGEMENT
        +
MAINTENANCE WINDOWS
        +
INCIDENT HISTORY
        +
UPTIME / LATENCY METRICS
        +
EMAIL / WEBHOOK / SLACK / TEAMS
        +
RSS / ATOM
        +
PUBLIC API
        +
EMBEDDED BADGES / WIDGETS
        +
DEPENDENCY MANAGEMENT
        +
SLA REPORTING
        +
POSTMORTEMS
        +
ADMIN DASHBOARD
        +
RBAC / MFA
        +
AUDIT LOGGING
        +
SECURITY / RATE LIMITING
        +
DISASTER RECOVERY
        +
SELF-MONITORING
```

# 141. Definition of Done

The GSTfy Status App is production-ready when:

```text
[ ] status.gstfy.in is publicly accessible
[ ] HTTPS is enabled
[ ] Status infrastructure is independent
[ ] Public service catalog exists
[ ] Automated monitoring works
[ ] Multi-region monitoring works
[ ] Failure thresholds work
[ ] Recovery thresholds work
[ ] Automatic incidents work
[ ] Manual incidents work
[ ] Incident timelines work
[ ] Maintenance scheduling works
[ ] Email subscriptions work
[ ] Webhooks work
[ ] Slack integration works
[ ] RSS works
[ ] Public API works
[ ] Uptime calculation works
[ ] Latency metrics work
[ ] Regional status works
[ ] Dependency mapping works
[ ] Admin authentication works
[ ] MFA is enabled
[ ] RBAC is enforced
[ ] Audit logging works
[ ] Rate limiting is enabled
[ ] SSRF protection is enabled
[ ] Database backups work
[ ] Disaster recovery is documented
[ ] Status App itself is externally monitored
[ ] Logs and metrics are available
[ ] Automated tests pass
[ ] Load tests pass
[ ] Security review completed
[ ] Incident communication templates are configured
[ ] Production alerting is configured
```

# 142. Recommended GSTfy Production Principle

The most important architectural rule is:

```text
GSTfy can be DOWN
        ↓
status.gstfy.in must still be UP
        ↓
so customers can see
what is happening
```

The Status App should therefore be treated as an **independent operational platform**, not merely another page inside the GSTfy application.