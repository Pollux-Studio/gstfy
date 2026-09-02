# TENANT-SUBDOMAIN.md — GSTfy Tenant-Based Subdomain System

## 0. Purpose

Every GSTfy business gets a dedicated subdomain that serves as its workspace identity. This document explains how the subdomain system works across the backend (tenant resolution, slug management, URL generation) and the frontend (routing, session management, workspace switching).

---

## 1. URL Structure

### Production

```text
https://{tenant-slug}.gstfy.in/dashboard
```

### Local Development

```text
http://{tenant-slug}.localhost:3000/dashboard
```

### Reserved Subdomains

These subdomains are never used as tenant slugs:

```text
app      — main app redirect
api      — backend API
auth     — login/register screens
ca       — CA partner dashboard
www      — marketing site
admin    — reserved
mail     — reserved
support  — reserved
gstfy    — reserved
```

---

## 2. Backend: Tenant Resolution

### Source File

```text
apps/backend/src/utils/tenant-context.ts
```

### How the Backend Identifies the Current Tenant

Every API request must carry tenant context. The backend resolves the tenant slug from the request using a priority chain:

```text
1. Origin header subdomain
2. Referer header subdomain
3. Host header subdomain
4. X-GSTFY-Tenant header (development fallback only)
```

#### Production Resolution (subdomain from Host)

```text
Request Host: acme-corp.gstfy.in
Base Domain:  gstfy.in
Subdomain:    acme-corp
Tenant Slug:  acme-corp
```

The function `getTenantSlugFromHost()` extracts the subdomain:

1. Normalize the host (lowercase, strip port, strip trailing dot)
2. Check that the host ends with `.{APP_BASE_DOMAIN}`
3. Extract the first label before the base domain
4. Validate the slug format: `^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$`
5. Reject if the slug is in the reserved subdomains set

#### Development Resolution (localhost)

```text
Request Host: acme-corp.localhost
Base Domain:  localhost:3000
Subdomain:    acme-corp
Tenant Slug:  acme-corp
```

In development, `APP_BASE_DOMAIN` is `localhost:3000`. The backend detects localhost and looks for `{slug}.localhost` patterns.

#### Header Fallback (development only)

```text
Header: X-GSTFY-Tenant: acme-corp
```

In non-production environments, if no subdomain is detected from the host but the `X-GSTFY-Tenant` header is present, the backend uses the header value. This enables the Next.js API routes to forward tenant context to the backend when the web app runs on a different port.

If the header value conflicts with a subdomain detected from the host, the backend rejects the request with a `400` error.

### Tenant Validation Rules

| Rule | Detail |
|---|---|
| Format | Lowercase alphanumeric and hyphens only |
| Length | 3–48 characters |
| Pattern | `^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$` |
| Reserved | `api`, `app`, `auth`, `ca`, `admin`, `www`, `mail`, `support`, `gstfy` |

Reserved slugs are automatically suffixed with `-business` (e.g., `api` → `api-business`).

---

## 3. Backend: Tenant Slug Management

### Source Files

```text
apps/backend/src/utils/tenant-slug.ts
apps/backend/src/utils/tenant-url.ts
apps/backend/src/modules/settings/settings.routes.ts
```

### Slug Creation

Tenant slugs are derived from the business trade name using `createTenantSlug()`:

```text
Input:  "Acme Corp & Sons"
Steps:
  1. Trim and lowercase → "acme corp & sons"
  2. Replace & with " and " → "acme corp and sons"
  3. Replace non-alphanumeric with hyphens → "acme-corp-and-sons"
  4. Trim leading/trailing hyphens → "acme-corp-and-sons"
  5. Slice to 48 characters → "acme-corp-and-sons"
  6. If result is shorter than 3 chars → "business"
  7. If result is a reserved slug → append "-business"
```

### Unique Slug Generation

During registration, the auth service calls `createUniqueTenantSlug()` which:

1. Generates the base slug from the trade name
2. Checks if the slug already exists in the `businesses` table
3. If taken, appends an incrementing suffix: `acme-corp-2`, `acme-corp-3`, etc.

```typescript
private async createUniqueTenantSlug(
  tradeName: string,
  exists: (slug: string) => Promise<boolean>
) {
  const baseSlug = createTenantSlug(tradeName)
  let slug = baseSlug
  let suffix = 2

  while (await exists(slug)) {
    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }

  return slug
}
```

### URL Generation

`getTenantUrl()` builds the full workspace URL from a slug:

```text
Slug: "acme-corp"
Base Domain: "gstfy.in"
Result: "https://acme-corp.gstfy.in"

Slug: "acme-corp"
Base Domain: "localhost:3000"
Result: "http://acme-corp.localhost:3000"
```

Protocol is derived from the `APP_BASE_DOMAIN` or `WEB_ORIGIN` env vars.

### Workspace URL Settings

Business owners can set a custom workspace URL once through Settings → Business → Workspace URL:

```text
Endpoint: PATCH /api/v1/settings/business/tenant
Schema:   { tenantSlug: string }
```

Constraints:
- The workspace URL can only be set once per business (locked after creation)
- The slug must be unique across all businesses
- Only business owners and admins can modify it

---

## 4. Database Schema

### Source File

```text
apps/backend/src/db/schema/index.ts
```

### Businesses Table

```sql
CREATE TABLE businesses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT NOT NULL UNIQUE,
  legal_name  TEXT NOT NULL,
  trade_name  TEXT NOT NULL,
  pan         TEXT NOT NULL,
  constitution TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending_verification',
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX businesses_tenant_slug_unique
  ON businesses (tenant_slug);
```

The `tenant_slug` column has a unique index — no two businesses can share a slug.

---

## 5. Backend: Business Access with Tenant Context

### Source File

```text
apps/backend/src/modules/businesses/business-access.ts
```

### How Tenant Context Is Used for Data Isolation

Every authenticated API endpoint that operates on business data calls `requirePrimaryBusinessAccess()`:

```text
Request → getTenantSlugFromRequest(request)
       → JOIN business_members + businesses
       → WHERE business_members.user_id = :userId
          AND business_members.status = 'active'
          AND businesses.tenant_slug = :tenantSlug   (if present)
       → Return business + membership
```

This ensures that:
1. A user can only access businesses they are a member of
2. When a tenant slug is present, the query is scoped to that specific business
3. When no tenant slug is present (legacy users), the user's first active business is used
4. If no matching business is found, a `404 "Business workspace not found"` error is thrown

---

## 6. Backend: Auth Flow with Tenant Context

### Source File

```text
apps/backend/src/modules/auth/auth.service.ts
```

### Registration

When a new business registers:

1. User provides GSTIN, trade name, and other details
2. Backend generates a unique tenant slug from the trade name
3. Business record is created with the slug
4. Auth session includes the tenant info
5. Response includes `redirectTo: https://{slug}.{domain}/dashboard`

### Login

When an existing user logs in:

1. Backend extracts the tenant slug from the request host/origin/referer
2. Looks up the user's business membership matching that slug
3. If slug is present but no matching membership → `403 "You do not have access to this workspace."`
4. If no slug is present and no business membership exists → `404 "Business account not found."`
5. On success, redirects to `{tenant-url}/dashboard`

### Session Response

After login, the auth response includes tenant context:

```json
{
  "tenant": {
    "id": "uuid",
    "slug": "acme-corp",
    "url": "https://acme-corp.gstfy.in"
  },
  "redirectTo": "https://acme-corp.gstfy.in/dashboard",
  "memberships": [
    {
      "business_id": "uuid",
      "business_name": "Acme Corp",
      "tenant_slug": "acme-corp",
      "tenant_url": "https://acme-corp.gstfy.in",
      "role": "owner",
      "status": "active"
    }
  ]
}
```

---

## 7. Frontend: Subdomain Routing

### Source Files

```text
apps/web/app/page.tsx
apps/web/lib/auth/server.ts
apps/web/lib/auth/workspace-url.ts
```

### Root Page Redirect Logic

The root page (`/`) detects the subdomain and redirects:

```text
Host: ca.localhost:3000        → /dashboard (CA dashboard)
Host: auth.localhost:3000      → /auth/login
Host: acme.localhost:3000      → /dashboard (workspace)
Host: localhost:3000 (logged in) → /dashboard
Host: localhost:3000 (not logged in) → /auth/login
```

### Auth Subdomain Detection

```typescript
async function isAuthSubdomainRequest() {
  const hostname = headersList.get("host")
  return hostname === "auth.localhost" || hostname.startsWith("auth.")
}
```

### Workspace URL Helpers

The frontend builds subdomain URLs dynamically from `window.location`:

```typescript
function buildSubdomainUrl(subdomain: string, path = "") {
  const { protocol, hostname, port } = window.location
  const baseHost = getBaseHost(hostname)  // strips tenant subdomain
  const portSuffix = port ? `:${port}` : ""

  return `${protocol}//${subdomain}.${baseHost}${portSuffix}${path}`
}
```

Key functions:
- `getWorkspaceUrlPreview(slug)` — builds `{slug}.{baseHost}:{port}`
- `getAuthSubdomainUrl(path)` — builds `auth.{baseHost}:{port}{path}`
- `getCaAppSubdomainUrl(path)` — builds `ca.{baseHost}:{port}{path}`
- `createWorkspaceSlugPreview(input)` — client-side slug preview (mirrors backend logic)

### Base Host Extraction

The frontend derives the base host from the current hostname:

```text
localhost                    → localhost
127.0.0.1                   → 127.0.0.1
auth.localhost              → localhost
acme.localhost              → localhost
auth.gstfy.in               → gstfy.in
acme.gstfy.in               → gstfy.in
app.staging.gstfy.in        → gstfy.in
```

---

## 8. Frontend: Auth Layout Redirect

### Source File

```text
apps/web/components/auth-layout-shell.tsx
```

When a user visits the auth pages (login/register) and already has a valid session, the auth layout shell redirects them to their workspace:

```text
1. Check stored auth session
2. If accountType === "ca" → redirect to ca.{domain}/dashboard
3. If session has tenant.url → redirect to {tenant.url}/dashboard
4. If session has tenant.slug → redirect to getWorkspaceUrlPreview(slug)/dashboard
5. If on auth host → stay on auth page
6. Otherwise → /dashboard
```

---

## 9. Frontend: API Proxy Tenant Forwarding

### Source Files

```text
apps/web/app/api/sales-invoices/[invoiceId]/route.ts
apps/web/app/api/purchase-invoices/[billId]/route.ts
```

When the Next.js API routes proxy requests to the backend, they forward the tenant context:

```typescript
const tenantSlug =
  request.headers.get("x-gstfy-tenant") ??
  getTenantSlugFromHost(request.headers.get("host"))

if (tenantSlug) {
  backendHeaders.set("X-GSTFY-Tenant", tenantSlug)
}
```

This ensures the backend receives the correct tenant context even when the request originates from a Next.js API route running on a different port.

### Tenant Slug Extraction in Proxy Routes

The proxy routes duplicate the subdomain detection logic:

```typescript
function getTenantSlugFromHost(host: string | null) {
  const [subdomain, ...domainParts] = hostname.split(".")
  // Reject reserved subdomains
  // Validate slug format
  // Return slug or null
}
```

---

## 10. Frontend: Session Storage

### Source File

```text
apps/web/lib/auth/session.ts
```

The client-side session stores tenant context in localStorage:

```typescript
type StoredAuthSession = {
  isAuthenticated: true
  accountType: "business" | "ca"
  user: AuthUser
  session: AuthSession
  tenant?: {
    id: string
    slug: string
    legalName?: string
    tradeName?: string
    url?: string
  } | null
}
```

This allows the frontend to:
- Show the workspace name in the sidebar and account switcher
- Build workspace URLs without hitting the API
- Redirect to the correct workspace after login
- Detect workspace membership changes

---

## 11. Environment Configuration

### Backend (apps/backend/.env)

```env
APP_BASE_DOMAIN=localhost:3000     # Production: gstfy.in
WEB_ORIGIN=http://auth.localhost:3000
```

| Variable | Dev Value | Production Value |
|---|---|---|
| `APP_BASE_DOMAIN` | `localhost:3000` | `gstfy.in` |
| `WEB_ORIGIN` | `http://auth.localhost:3000` | `https://auth.gstfy.in` |

The `APP_BASE_DOMAIN` is the key variable — it determines how tenant URLs are constructed on the backend.

---

## 12. CORS Configuration

### Source File

```text
apps/backend/src/app.ts
```

The backend CORS configuration allows `X-GSTFY-Tenant` as an accepted header:

```typescript
allowedHeaders: [
  "Authorization",
  "Content-Type",
  "Idempotency-Key",
  "X-GSTFY-Tenant",
  "X-GSTFY-Account-Type",
],
```

This allows the frontend (running on a tenant subdomain) to make cross-origin requests to the backend API with tenant context.

---

## 13. Request Flow Summary

### Full Request Lifecycle

```text
Browser: acme-corp.gstfy.in/dashboard
  │
  ├── Next.js App Router receives request on Host: acme-corp.gstfy.in
  │     ├── Root page detects subdomain "acme-corp"
  │     ├── Session check → valid session with tenant.slug = "acme-corp"
  │     └── Serves dashboard page
  │
  ├── Dashboard makes API call: GET /api/v1/sales/invoices
  │     ├── Next.js API route extracts tenant slug from Host header
  │     ├── Sets X-GSTFY-Tenant: acme-corp on backend request
  │     └── Proxies to backend
  │
  └── Backend: acme-corp.gstfy.in → Host: api.gstfy.in (or similar)
        ├── getTenantSlugFromRequest() extracts "acme-corp" from X-GSTFY-Tenant
        ├── requirePrimaryBusinessAccess() queries:
        │     SELECT * FROM business_members bm
        │     JOIN businesses b ON b.id = bm.business_id
        │     WHERE bm.user_id = :userId
        │       AND bm.status = 'active'
        │       AND b.tenant_slug = 'acme-corp'
        └── Returns scoped business data
```

---

## 14. Key Design Decisions

### Why subdomains over path-based routing?

- Clean URL separation between businesses
- Cookie domain isolation between tenants
- Natural fit for the multi-business CA partner model
- Easier to configure proxy rules and caching

### Why one-time slug creation?

- Prevents broken bookmarks and shared links
- Simplifies audit logging (slug is stable)
- Avoids slug squatting concerns after initial setup

### Why header fallback in development?

- Local development often runs frontend and backend on different ports
- Subdomain resolution doesn't work across port boundaries
- The `X-GSTFY-Tenant` header bridges this gap without requiring complex local DNS setup

### Why Origin/Referer priority over Host?

- Browser requests to API endpoints may use a different Host header than the subdomain the user is browsing
- The Origin and Referer headers reflect the actual page the user is on, making them more reliable for tenant resolution
