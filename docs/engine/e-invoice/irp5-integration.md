# E-INVOICE-IRP5-INTEGRATION.md — GSTfy IRP5 Sandbox → Production Integration

## 0. Purpose

This document defines the concrete IRP5 integration for GSTfy using:

```text
Sandbox first
    ↓
Complete API testing
    ↓
Production approval/access
    ↓
Switch configuration only
    ↓
Production IRP5
```

The core E-Invoice domain must remain provider-independent.

```text
GSTfy E-Invoice Engine
        ↓
EInvoiceProviderAdapter
        ↓
IRP5 Adapter
        ↓
Sandbox / Production
```

The application code must NOT fork into:

```text
if sandbox:
   logic A

if production:
   logic B
```

Only endpoint/credential/environment configuration changes.

---

# 1. IRP5 Endpoints

Use the IRP5 endpoints supplied for this integration.

## Sandbox

```text
Authenticate:
https://einvapisandbox.irp5.in/irp5/irpauthapi/v1.0/apiAuth

Generate IRN:
https://einvapisandbox.irp5.in/irp5/irpapi/v1.0/api/generate

Cancel IRN:
https://einvapisandbox.irp5.in/irp5/irpapi/v1.0/api/cancel

Search IRN:
https://einvapisandbox.irp5.in/irp5/irpapi/v1.0/enSearch

Get GSTIN Details:
https://einvapisandbox.irp5.in/irp5/gstin_management/v1.0/gstin

Sync GSTIN Details:
https://einvapisandbox.irp5.in/irp5/gstin_management/v1.0/syncgstin
```

## Production

```text
Authenticate:
https://api.einvoice5.gst.gov.in/irp5/irpauthapi/v1.0/apiAuth

Generate IRN:
https://api.einvoice5.gst.gov.in/irp5/irpapi/v1.0/api/generate

Cancel IRN:
https://api.einvoice5.gst.gov.in/irp5/irpapi/v1.0/api/cancel

Search IRN:
https://api.einvoice5.gst.gov.in/irp5/irpapi/v1.0/enSearch

Get GSTIN Details:
https://api.einvoice5.gst.gov.in/irp5/gstin_management/v1.0/gstin

Sync GSTIN Details:
https://api.einvoice5.gst.gov.in/irp5/gstin_management/v1.0/syncgstin
```

Keep endpoint URLs in environment/configuration, never hard-code them into service logic.

---

# 2. Environment Configuration

Recommended:

```text
EINVOICE_PROVIDER=IRP5
EINVOICE_ENVIRONMENT=sandbox
```

Sandbox:

```text
IRP5_BASE_URL=https://einvapisandbox.irp5.in
IRP5_CLIENT_ID=<sandbox client id>
IRP5_CLIENT_SECRET=<sandbox client secret>
IRP5_USERNAME=<sandbox username>
IRP5_PASSWORD=<sandbox password>
IRP5_APP_SECRET=<sandbox app secret>
```

Production:

```text
IRP5_BASE_URL=https://api.einvoice5.gst.gov.in
IRP5_CLIENT_ID=<production client id>
IRP5_CLIENT_SECRET=<production client secret>
IRP5_USERNAME=<production username>
IRP5_PASSWORD=<production password>
IRP5_APP_SECRET=<production app secret>
```

Never use Sandbox credentials against Production endpoints or Production credentials against Sandbox.

Official IRIS documentation states that API integrators receive separate Sandbox and Production API credentials for core e-invoice APIs. citeturn921648search0

---

# 3. Secret Storage

Store:

```text
client_id
client_secret
username
password
app_secret
portal_id where applicable
```

only in secure backend secret storage.

Never store them in:

```text
frontend
Party Master
GST registration ordinary fields
invoice records
logs
source code
git
```

Frontend only receives:

```text
provider
environment
connection status
last successful authentication
last sync
```

never the secret values.

---

# 4. Multi-Tenant Credential Model

GSTfy is a SaaS/API integrator.

Do not make the whole system depend on one dealer credential record.

Use two levels.

## Provider configuration

Global/system-level:

```text
irp_provider
environment
provider_client_id
provider_client_secret_reference
provider_app_secret_reference
```

## Dealer/GSTIN authorization

Per GST registration:

```text
business_id
gst_registration_id
provider
authorization_status
irp_username_reference
irp_password_reference
provider_taxpayer_reference
authorized_at
expires_at
last_authenticated_at
last_error
```

This allows:

```text
GSTfy
 |
 +-- Dealer A
 |     +-- TN GSTIN
 |     +-- KA GSTIN
 |
 +-- Dealer B
       +-- KL GSTIN
```

without mixing credentials.

---

# 5. API Integrator vs Taxpayer

IRP onboarding distinguishes the:

```text
API Integrator / Intermediary
```

from:

```text
Taxpayer
```

IRP documentation explicitly supports an Intermediary user type for solution providers integrating for clients. citeturn921648search5turn921648search11

For GSTfy the intended model is:

```text
GSTfy
  = API Integrator / Intermediary

Dealer
  = Taxpayer
```

Do not require every dealer to become the API integrator.

---

# 6. Dealer Authorization Model

A dealer must authorize GSTfy for that GSTIN.

Conceptually:

```text
Dealer
   ↓
GSTIN verification
   ↓
GSTFY / IRP5 onboarding
   ↓
OTP / authorization
   ↓
Manage API Access
   ↓
GSTIN linked to GSTfy
```

IRP's onboarding documentation describes:

```text
Add User
Generate OTP
Verify OTP
Set IRP Credentials
Manage API Access
```

for solution providers offering end-to-end client integration. citeturn921648search3turn921648search9

Do not consider:

```text
GSTIN saved in GSTfy
```

equal to:

```text
GSTIN authorized for API operations
```

---

# 7. Initial Sandbox Strategy

Do NOT start with a real dealer's production GSTIN.

Use:

```text
IRP5 Sandbox
+
Test GSTIN
```

IRP documentation states that sandbox supports dummy/test GSTINs and also supports actual GSTIN testing when required, with OTP verification for actual GSTIN onboarding. citeturn921648search4turn921648search5

Recommended first development path:

```text
1. Create IRP5 API integrator sandbox account
2. Add test GSTIN
3. Configure sandbox credentials
4. Authenticate
5. Get GSTIN details
6. Generate test IRN
7. Search/get IRN
8. Cancel test IRN
9. Test errors
10. Test retry/idempotency
11. Complete IRP5 test cases
```

---

# 8. Authentication Service

Create:

```text
IRP5AuthService
```

Responsibilities:

```text
authenticate
store token securely
track expiry
refresh/re-authenticate when required
invalidate on auth failure
```

Do NOT authenticate on every invoice if the IRP token is reusable for its validity period.

Official IRIS documentation describes Authentication as the mechanism to obtain the authorization token used for core e-invoice APIs. citeturn921648search7

---

# 9. Authentication Flow

Conceptually:

```text
GSTfy Backend
     ↓
IRP5 Authenticate API
     ↓
token
     ↓
encrypted/in-memory token cache
     ↓
Generate IRN / Search / Cancel
```

Never expose the token to the frontend.

Store only what is necessary for recovery/audit.

---

# 10. Token Cache

Recommended key:

```text
provider
environment
GSTIN / authorization context
```

Example:

```text
irp5:sandbox:GSTIN_33XXXXXXXX
```

Cache:

```text
access_token
expires_at
issued_at
```

Token cache may be Redis or encrypted application storage depending on deployment.

---

# 11. Authentication Failure

If:

```text
401 / unauthorized
```

then:

```text
invalidate token
authenticate again
retry once where safe
```

Never perform unlimited authentication loops.

Return a controlled:

```text
EINV_AUTH_FAILED
```

after the retry limit.

---

# 12. Generate IRN Service

Create:

```text
IRP5EInvoiceService.generateIRN()
```

Flow:

```text
Posted Invoice
    ↓
Eligibility
    ↓
Canonical Payload
    ↓
IRP5 Payload Mapper
    ↓
Validate
    ↓
Authenticate
    ↓
Generate IRN API
    ↓
Persist response
    ↓
IRN Generated
```

---

# 13. Generate IRN Payload Boundary

Do not send the internal GSTfy invoice entity directly.

Use:

```text
GSTfy Canonical E-Invoice Payload
              ↓
        IRP5 Mapper
              ↓
        IRP5 JSON payload
```

This protects GSTfy from provider schema changes.

---

# 14. Payload Snapshot

Before submission persist:

```text
canonical_payload
canonical_payload_hash

external_payload
external_payload_hash

schema_version
provider
environment
```

The submitted snapshot becomes immutable.

---

# 15. Generate IRN Response

Persist at minimum:

```text
IRN
Ack Number
Ack Date
Status
Provider Reference
Signed/response data where supplied
QR/response metadata where supplied
Raw response reference
```

Never invent or locally calculate:

```text
IRN
Ack Number
government QR
```

---

# 16. Search/Get IRN

Use the provided IRP5 Search/Get capabilities to recover state after:

```text
network timeout
unknown response
application restart
provider processing
retry investigation
```

Flow:

```text
Local status uncertain
      ↓
Search IRN / document
      ↓
Provider response
      ↓
Reconcile local state
```

This is critical to prevent duplicate submissions.

---

# 17. Get GSTIN Details

Use:

```text
GET GSTIN Details
```

to populate/validate provider-side GSTIN data.

Do not overwrite the Party Master blindly.

Provider data can be used as:

```text
verification/reference snapshot
```

while Party Master remains the local business master.

---

# 18. Sync GSTIN Details

Use:

```text
Sync GSTIN Details from Common Portal
```

as an integration operation when required by the provider flow.

Persist:

```text
last_synced_at
sync_status
provider_snapshot
```

Do not turn sync into a destructive Party update.

---

# 19. Cancel IRN

Flow:

```text
IRN_GENERATED
      ↓
Check cancellation eligibility
      ↓
User confirms reason
      ↓
Authenticate
      ↓
IRP5 Cancel API
      ↓
Persist response
      ↓
CANCELLED
```

Never delete the local e-invoice record.

---

# 20. Cancellation Idempotency

If the user clicks Cancel twice:

```text
first -> submitted
second -> detect current state
```

Do not send duplicate cancellation requests when the provider already confirms cancellation.

---

# 21. Retry Rules

## Safe retry

```text
timeout
temporary network failure
provider 5xx
```

First:

```text
Search/Get IRN
```

Then retry only if no successful IRN exists and provider semantics permit it.

## Unsafe blind retry

Never blindly resend:

```text
Generate IRN
```

just because the HTTP response was lost.

The first request may have succeeded.

---

# 22. Idempotency

Local mutation identity:

```text
business_id
gst_registration_id
source_voucher_id
document_number
document_date
payload_hash
```

Store:

```text
idempotency_key
request_hash
provider_reference
result
status
```

Same request:

```text
return original result
```

Changed request with same key:

```text
409
```

---

# 23. Provider Status

Map provider states into internal:

```text
READY
SUBMITTING
PROCESSING
IRN_GENERATED
FAILED
CANCELLED
```

Do not expose provider-specific strings throughout the application.

Keep:

```text
provider_status
```

for diagnostics.

---

# 24. Environment Safety

Every request must carry/use an explicit environment:

```text
SANDBOX
PRODUCTION
```

Production must fail fast if:

```text sandbox credentials
sandbox endpoint
test configuration
```

are detected.

Likewise sandbox must not accidentally use production credentials.

---

# 25. Production Feature Flag

Recommended:

```text
EINVOICE_LIVE_ENABLED=false
```

Initial:

```text
EINVOICE_ENVIRONMENT=sandbox
```

Only after production access approval:

```text
EINVOICE_LIVE_ENABLED=true
EINVOICE_ENVIRONMENT=production
```

Additionally require an administrative confirmation before the first live submission.

---

# 26. Production Onboarding

IRIS documentation describes a production application process after sandbox integration/testing, including test report submission, KYC information, SPOC details, Indian static IP whitelisting, and authorised-signatory OTP verification. citeturn921648search10

Therefore GSTfy production deployment should plan for:

```text
sandbox testing
test-case report
KYC/organization documents
SPOC
static Indian IP
production API credentials
production GSTIN onboarding
```

Do not assume receiving Sandbox credentials automatically enables Production.

---

# 27. Network Architecture

Recommended:

```text
Browser
   |
GSTfy API
   |
E-Invoice Service
   |
IRP5 Adapter
   |
Internet
   |
IRP5
```

Never:

```text
Browser
   ↓
IRP5 directly
```

---

# 28. Background Job

Long-running provider operations should support a job:

```text
e_invoice_submission_job
```

Flow:

```text
User clicks Generate
      ↓
Create submission job
      ↓
Worker submits to IRP5
      ↓
Persist status
      ↓
Frontend polls/subscribes
```

For a fast provider response, synchronous submission may be acceptable initially, but the domain must still support `PROCESSING`.

---

# 29. Audit Events

Record:

```text
IRP5_AUTH_STARTED
IRP5_AUTH_SUCCESS
IRP5_AUTH_FAILED

EINV_PAYLOAD_CREATED
EINV_VALIDATION_FAILED
EINV_SUBMITTED
EINV_PROCESSING
EINV_IRN_GENERATED
EINV_SUBMISSION_FAILED

EINV_CANCEL_REQUESTED
EINV_CANCELLED
EINV_CANCEL_FAILED

EINV_RETRY
EINV_STATUS_RECONCILED
```

Never log secrets or full authentication payloads.

---

# 30. Error Mapping

Map IRP5/provider errors to internal categories:

```text
AUTH_ERROR
VALIDATION_ERROR
DUPLICATE_ERROR
BUSINESS_RULE_ERROR
RATE_LIMIT
NETWORK_ERROR
SERVER_ERROR
UNKNOWN_PROVIDER_ERROR
```

Persist both:

```text
internal_error_code
provider_error_code
provider_message
```

---

# 31. Frontend Connection Settings

GSTfy Admin/Owner view:

```text
E-Invoice Provider
IRP5

Environment
Sandbox / Production

Connection
Connected / Reconnect Required / Error

Last Authentication
...
```

Never show:

```text
client secret
password
app secret
token
```

---

# 32. Dealer GST Connection UI

For each GSTIN:

```text
Tamil Nadu GSTIN
IRP5
Sandbox Connected
Last Auth: ...
```

Actions:

```text
Connect
Reconnect
Test Connection
Disconnect
```

Production connection requires elevated permission.

---

# 33. E-Invoice Invoice UI

On Sales Invoice:

```text
E-Invoice
----------------
Status: Ready

[Generate IRN]
```

After success:

```text
Status: IRN Generated
IRN: ...
Ack No: ...
Ack Date: ...
```

Actions:

```text
View Response
Search IRN
Cancel
```

---

# 34. IRP5 Environments

Runtime supports:

```text
IRP5_SANDBOX
IRP5_PRODUCTION
```

Sandbox and production both use the IRP5 adapter, authentication flow, encrypted request payloads, and decrypted provider responses. Production additionally requires `EINVOICE_LIVE_ENABLED=true`.

Sandbox:

```text
real IRP5 sandbox endpoint
```

Production:

```text
real IRP5 production endpoint
```

The provider interface stays identical.

---

# 35. Security Checklist

```text
[ ] secrets encrypted
[ ] secrets server-side only
[ ] token never sent to browser
[ ] provider responses sanitized in logs
[ ] production credentials isolated
[ ] tenant/GSTIN isolation
[ ] RBAC for submit/cancel
[ ] audit every submission
[ ] no credentials in git
[ ] no credentials in frontend bundle
```

---

# 36. Sandbox Test Matrix

### Authentication

```text
[ ] valid credentials
[ ] invalid credentials
[ ] expired token
[ ] re-authentication
```

### GSTIN

```text
[ ] valid test GSTIN
[ ] GSTIN details
[ ] GSTIN sync
```

### Generate IRN

```text
[ ] valid invoice
[ ] invalid GSTIN
[ ] invalid HSN/SAC
[ ] invalid totals
[ ] invalid document number
[ ] duplicate document
[ ] provider rejection
```

### Search

```text
[ ] existing IRN
[ ] missing IRN
[ ] document lookup
```

### Cancellation

```text
[ ] valid cancellation
[ ] invalid cancellation
[ ] duplicate cancellation
```

### Reliability

```text
[ ] timeout
[ ] retry
[ ] duplicate retry
[ ] provider 5xx
[ ] provider processing
```

---

# 37. Production Cutover Checklist

```text
[ ] sandbox integration complete
[ ] sandbox test cases pass
[ ] production access approved
[ ] production credentials stored
[ ] production IP whitelisted
[ ] live feature flag disabled by default
[ ] production health check passes
[ ] first live GSTIN connected
[ ] test/controlled live submission
[ ] IRN verified
[ ] cancellation tested where allowed
[ ] alerting enabled
[ ] audit verified
[ ] rollback plan
```

---

# 38. Metrics

Track:

```text
e_invoice_submission_count
e_invoice_success_count
e_invoice_failure_count
e_invoice_processing_count
e_invoice_cancel_count
e_invoice_retry_count
e_invoice_latency
e_invoice_auth_failure_count
```

Break down by:

```text
environment
provider
GSTIN
business
```

---

# 39. API Health

Use the IRP5 health facility where available.

Expose internally:

```text
IRP5 Reachable
Authentication Healthy
Last Successful Generate
Last Provider Error
```

Do not expose provider credentials.

---

# 40. Complete Backend Structure

```text
modules/e-invoice/
├── domain/
│   ├── eligibility.ts
│   ├── states.ts
│   ├── payload.ts
│   └── errors.ts
├── application/
│   ├── generate.service.ts
│   ├── cancel.service.ts
│   ├── status.service.ts
│   └── connection.service.ts
├── providers/
│   ├── e-invoice-provider.ts
│   └── irp5/
│       ├── auth.ts
│       ├── mapper.ts
│       ├── client.ts
│       ├── response.ts
│       └── adapter.ts
├── routes/
├── schemas/
├── jobs/
└── tests/
```

---

# 41. Complete Frontend Structure

```text
components/e-invoice/
├── e-invoice-dashboard
├── e-invoice-status
├── e-invoice-connection
├── e-invoice-payload-preview
├── e-invoice-error-dialog
├── e-invoice-cancel-dialog
├── e-invoice-history
└── provider-settings
```

---

# 42. APIs Used by GSTfy Backend

Initial IRP5 integration:

```text
POST /irp5/irpauthapi/v1.0/apiAuth
POST /irp5/irpapi/v1.0/api/generate
POST /irp5/irpapi/v1.0/api/cancel
GET  /irp5/irpapi/v1.0/enSearch
GET  /irp5/gstin_management/v1.0/gstin
GET  /irp5/gstin_management/v1.0/syncgstin
```

Use the exact request/response headers and payloads defined by the IRP5 sandbox documentation.

Do not invent field names when implementing the provider client.

---

# 43. Production Environment Switch

The application should require only configuration change:

```text
# Sandbox
EINVOICE_ENVIRONMENT=sandbox
IRP5_BASE_URL=https://einvapisandbox.irp5.in
IRP5_CLIENT_ID=...
IRP5_CLIENT_SECRET=...
```

Then production:

```text
EINVOICE_ENVIRONMENT=production
IRP5_BASE_URL=https://api.einvoice5.gst.gov.in
IRP5_CLIENT_ID=...
IRP5_CLIENT_SECRET=...
```

The same:

```text
IRP5Adapter
GenerateService
CancelService
StatusService
```

must run in both environments.

---

# 44. Definition of Done

## Sandbox

```text
[ ] API integrator sandbox account
[ ] Test GSTIN onboarded
[ ] Dealer authorization flow understood/implemented
[ ] Authentication
[ ] GSTIN details
[ ] GSTIN sync
[ ] Generate IRN
[ ] Search IRN
[ ] Cancel IRN
[ ] Error handling
[ ] Idempotency
[ ] Timeout recovery
[ ] Mock tests
[ ] Sandbox tests
```

## Production

```text
[ ] Production application approved
[ ] KYC/test-report requirements completed
[ ] Static IP whitelisting
[ ] Production credentials
[ ] Production GSTIN authorization
[ ] Production health test
[ ] Controlled first submission
[ ] Monitoring
[ ] Audit
[ ] Rollback/recovery
```

---

# 45. Final Architecture

```text
                         GSTfy
                           |
                    E-Invoice Engine
                           |
                  EInvoiceProviderAdapter
                           |
                     IRP5 Adapter
                           |
            +--------------+--------------+
            |                             |
         SANDBOX                      PRODUCTION
            |                             |
    IRP5 Sandbox APIs             IRP5 Production APIs
            |                             |
       Test IRNs                    Live IRNs
```

## Final Rule

> GSTfy uses one provider-independent E-Invoice Engine and one IRP5 adapter. Sandbox and production differ only by credentials and endpoint configuration. Dealer GSTIN authorization remains tenant/GSTIN-specific, secrets remain backend-only, submitted payloads are immutable, and every IRN operation is idempotent, auditable, and recoverable.
