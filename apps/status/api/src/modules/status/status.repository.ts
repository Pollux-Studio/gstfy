import { createHash, randomBytes } from "node:crypto"

import argon2 from "argon2"
import type postgres from "postgres"

import { getEnv } from "../../config/env.js"
import { sql } from "../../db/client.js"
import { decryptSecret, encryptSecret } from "../../utils/encryption.js"
import { StatusHttpError } from "../../utils/http-error.js"
import { slugify } from "../../utils/slug.js"
import {
  calculateOverallStatus,
  deriveServiceStatusFromMonitorResult,
  getOverallStatusLabel,
  type IncidentImpact,
  type IncidentSeverity,
  type IncidentStatus,
  type MaintenanceStatus,
  type MonitorResultStatus,
  type ServiceStatus,
} from "./status.domain.js"
import type {
  adminLoginSchema,
  createAdminUserSchema,
  createApiKeySchema,
  createIncidentSchema,
  createIncidentUpdateSchema,
  createMaintenanceSchema,
  createMonitorSchema,
  createServiceGroupSchema,
  createServiceSchema,
  createSubscriptionSchema,
  monitorResultSchema,
  notificationFailureSchema,
  postmortemSchema,
  slaTargetSchema,
  updateIncidentSchema,
  updateMaintenanceSchema,
  updateMonitorSchema,
  updatePostmortemSchema,
  updateServiceGroupSchema,
  updateServiceSchema,
  workerHeartbeatSchema,
} from "./status.schemas.js"
import type { z } from "zod"

type AdminLoginInput = z.infer<typeof adminLoginSchema>
type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>
type CreateApiKeyInput = z.infer<typeof createApiKeySchema>
type CreateServiceGroupInput = z.infer<typeof createServiceGroupSchema>
type UpdateServiceGroupInput = z.infer<typeof updateServiceGroupSchema>
type CreateServiceInput = z.infer<typeof createServiceSchema>
type UpdateServiceInput = z.infer<typeof updateServiceSchema>
type CreateMonitorInput = z.infer<typeof createMonitorSchema>
type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>
type CreateIncidentInput = z.infer<typeof createIncidentSchema>
type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>
type CreateIncidentUpdateInput = z.infer<typeof createIncidentUpdateSchema>
type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>
type UpdateMaintenanceInput = z.infer<typeof updateMaintenanceSchema>
type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>
type MonitorResultInput = z.infer<typeof monitorResultSchema>
type WorkerHeartbeatInput = z.infer<typeof workerHeartbeatSchema>
type SlaTargetInput = z.infer<typeof slaTargetSchema>
type PostmortemInput = z.infer<typeof postmortemSchema>
type UpdatePostmortemInput = z.infer<typeof updatePostmortemSchema>
type NotificationFailureInput = z.infer<typeof notificationFailureSchema>

const env = getEnv()

type ServiceGroupRow = {
  id: string
  name: string
  slug: string
  description: string | null
  displayOrder: number
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
}

type ServiceRow = {
  id: string
  groupId: string | null
  groupName: string | null
  groupSlug: string | null
  name: string
  slug: string
  description: string | null
  status: ServiceStatus
  displayOrder: number
  isPublic: boolean
  monitoringEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

type MonitorRow = {
  id: string
  serviceId: string
  serviceName: string
  serviceSlug: string
  serviceStatus: ServiceStatus
  name: string
  checkType: string
  target: string
  intervalSeconds: number
  timeoutSeconds: number
  expectedStatus: number | null
  expectedBody: string | null
  expectedHeaders: Record<string, string>
  regions: string[]
  retryCount: number
  failureThreshold: number
  recoveryThreshold: number
  consecutiveFailures: number
  consecutiveSuccesses: number
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

type IncidentRow = {
  id: string
  title: string
  slug: string
  status: IncidentStatus
  severity: IncidentSeverity
  impact: IncidentImpact
  createdBy: string | null
  detectedAutomatically: boolean
  scheduled: boolean
  public: boolean
  startedAt: Date
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type IncidentUpdateRow = {
  id: string
  incidentId: string
  status: IncidentStatus
  message: string
  authorId: string | null
  public: boolean
  createdAt: Date
}

type MaintenanceRow = {
  id: string
  title: string
  slug: string
  description: string | null
  status: MaintenanceStatus
  startAt: Date
  endAt: Date
  timezone: string
  public: boolean
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

type MonitorResultRow = {
  id: string
  monitorId: string
  serviceId: string
  region: string
  status: MonitorResultStatus
  httpStatus: number | null
  responseTimeMs: number | null
  errorMessage: string | null
  checkedAt: Date
  createdAt: Date
}

type SubscriptionRow = {
  id: string
  type: string
  email: string | null
  webhookUrl: string | null
  slackWebhookUrl: string | null
  teamsWebhookUrl: string | null
  webhookSecretCiphertext?: string | null
  webhookSecretIv?: string | null
  webhookSecretTag?: string | null
  webhookUnhealthy?: boolean
  verified: boolean
  active: boolean
  subscribedAll: boolean
  incidentUpdates: boolean
  maintenanceUpdates: boolean
  createdAt: Date
  updatedAt: Date
}

type AdminUserRow = {
  id: string
  email: string
  displayName: string
  role: "owner" | "admin" | "incident_manager" | "viewer"
  permissions: string[]
  mfaEnabled: boolean
  active: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type AdminAuthRow = AdminUserRow & {
  passwordHash: string
}

type ApiKeyRow = {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  active: boolean
  expiresAt: Date | null
  revokedAt: Date | null
  lastUsedAt: Date | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

type WorkerHeartbeatRow = {
  workerId: string
  workerType: "monitoring" | "incident-engine" | "notifications"
  region: string
  version: string
  status: "starting" | "healthy" | "degraded" | "stopped"
  queueName: string | null
  lastSeen: Date
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

type NotificationDeliveryRow = {
  id: string
  subscriptionId: string | null
  subscriptionType: string | null
  event: string
  target: string
  status: "pending" | "delivered" | "failed" | "retrying" | "disabled"
  attempts: number
  lastError: string | null
  nextAttemptAt: Date | null
  payload: Record<string, unknown>
  headers: Record<string, string>
  deliveryId: string
  createdAt: Date
  updatedAt: Date
}

type PendingNotificationDeliveryRow = NotificationDeliveryRow & {
  email: string | null
  webhookUrl: string | null
  slackWebhookUrl: string | null
  teamsWebhookUrl: string | null
  webhookSecretCiphertext: string | null
  webhookSecretIv: string | null
  webhookSecretTag: string | null
}

type SlaTargetRow = {
  id: string
  serviceId: string
  serviceName: string
  serviceSlug: string
  availabilityTarget: string
  latencyP95TargetMs: number | null
  excludeMaintenance: boolean
  active: boolean
  createdAt: Date
  updatedAt: Date
}

type PostmortemRow = {
  id: string
  incidentId: string
  incidentTitle: string
  incidentSlug: string
  summary: string
  rootCause: string | null
  impact: string | null
  timeline: string | null
  resolution: string | null
  preventiveActions: string | null
  followUpTasks: string | null
  public: boolean
  publishedAt: Date | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

type AuditContext = {
  actorId?: string
  ipAddress?: string
  userAgent?: string
}

export type StatusAdminActor = {
  actorId: string
  role: AdminUserRow["role"] | "api_key" | "static_token"
  permissions: string[]
  authType: "session" | "api_key" | "static_token"
}

type StatusTransaction = postgres.TransactionSql<Record<string, unknown>>

type ListInput = {
  limit: number
  offset: number
  q?: string
  status?: string
}

export async function ensureBootstrapAdmin() {
  if (!env.STATUS_BOOTSTRAP_ADMIN_EMAIL || !env.STATUS_BOOTSTRAP_ADMIN_PASSWORD) {
    return { created: false, configured: false }
  }

  const email = env.STATUS_BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
  const existingRows = await sql<{ id: string }[]>`
    select id
    from public.status_admin_users
    where lower(email) = ${email}
    limit 1
  `

  if (existingRows[0]) {
    return { created: false, configured: true }
  }

  const passwordHash = await argon2.hash(env.STATUS_BOOTSTRAP_ADMIN_PASSWORD)
  await sql`
    insert into public.status_admin_users (
      email,
      display_name,
      password_hash,
      role,
      permissions
    )
    values (
      ${email},
      'GSTfy Status Owner',
      ${passwordHash},
      'owner',
      ${["admin:*"]}
    )
  `

  return { created: true, configured: true }
}

export async function loginAdmin(input: AdminLoginInput, audit: AuditContext) {
  const rows = await sql<AdminAuthRow[]>`
    select
      id,
      email,
      display_name as "displayName",
      password_hash as "passwordHash",
      role,
      permissions,
      mfa_enabled as "mfaEnabled",
      active,
      last_login_at as "lastLoginAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from public.status_admin_users
    where lower(email) = ${input.email.toLowerCase()}
      and active = true
    limit 1
  `
  const user = rows[0]

  if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
    throw new StatusHttpError(
      401,
      "ADMIN_LOGIN_INVALID",
      "Email or password is incorrect."
    )
  }

  const token = `st_sess_${randomBytes(32).toString("base64url")}`
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000)

  await sql.begin(async (transaction) => {
    await transaction`
      insert into public.status_admin_sessions (
        user_id,
        token_hash,
        expires_at
      )
      values (${user.id}, ${hashToken(token)}, ${expiresAt})
    `
    await transaction`
      update public.status_admin_users
      set last_login_at = now()
      where id = ${user.id}
    `
  })

  await recordAuditLog({
    ...audit,
    actorId: user.id,
    action: "admin.login",
    entityType: "admin_user",
    entityId: user.id,
  })

  return {
    accessToken: token,
    expiresAt: expiresAt.toISOString(),
    user: serializeAdminUser({
      ...user,
      lastLoginAt: new Date(),
    }),
  }
}

export async function validateAdminAccess(token: string): Promise<StatusAdminActor> {
  const tokenHash = hashToken(token)
  const sessionRows = await sql<
    (AdminUserRow & { sessionId: string })[]
  >`
    select
      u.id,
      u.email,
      u.display_name as "displayName",
      u.role,
      u.permissions,
      u.mfa_enabled as "mfaEnabled",
      u.active,
      u.last_login_at as "lastLoginAt",
      u.created_at as "createdAt",
      u.updated_at as "updatedAt",
      s.id as "sessionId"
    from public.status_admin_sessions s
    join public.status_admin_users u on u.id = s.user_id
    where s.token_hash = ${tokenHash}
      and s.revoked_at is null
      and s.expires_at > now()
      and u.active = true
    limit 1
  `

  if (sessionRows[0]) {
    return {
      actorId: sessionRows[0].id,
      role: sessionRows[0].role,
      permissions: sessionRows[0].permissions,
      authType: "session",
    }
  }

  const keyRows = await sql<ApiKeyRow[]>`
    update public.status_api_keys
    set last_used_at = now()
    where key_hash = ${tokenHash}
      and active = true
      and revoked_at is null
      and (expires_at is null or expires_at > now())
    returning
      id,
      name,
      key_prefix as "keyPrefix",
      scopes,
      active,
      expires_at as "expiresAt",
      revoked_at as "revokedAt",
      last_used_at as "lastUsedAt",
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `

  if (keyRows[0]) {
    return {
      actorId: `api-key:${keyRows[0].id}`,
      role: "api_key",
      permissions: keyRows[0].scopes,
      authType: "api_key",
    }
  }

  throw new StatusHttpError(401, "UNAUTHORIZED", "Admin access is required.")
}

export async function logoutAdmin(token: string, audit: AuditContext) {
  const rows = await sql<{ userId: string }[]>`
    update public.status_admin_sessions
    set revoked_at = now()
    where token_hash = ${hashToken(token)}
      and revoked_at is null
    returning user_id as "userId"
  `

  if (rows[0]) {
    await recordAuditLog({
      ...audit,
      actorId: rows[0].userId,
      action: "admin.logout",
      entityType: "admin_session",
    })
  }

  return { revoked: rows.length > 0 }
}

export async function listAdminUsers(input: ListInput) {
  const rows = await sql<AdminUserRow[]>`
    select
      id,
      email,
      display_name as "displayName",
      role,
      permissions,
      mfa_enabled as "mfaEnabled",
      active,
      last_login_at as "lastLoginAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from public.status_admin_users
    where
      (${input.status ?? null}::text is null or (${input.status ?? ""} = 'active' and active = true) or (${input.status ?? ""} = 'inactive' and active = false))
      and (${input.q ?? null}::text is null or email ilike ${`%${input.q ?? ""}%`} or display_name ilike ${`%${input.q ?? ""}%`})
    order by created_at desc
    limit ${input.limit}
    offset ${input.offset}
  `

  return {
    items: rows.map(serializeAdminUser),
    limit: input.limit,
    offset: input.offset,
  }
}

export async function createAdminUser(
  input: CreateAdminUserInput,
  audit: AuditContext
) {
  const rows = await sql<AdminUserRow[]>`
    insert into public.status_admin_users (
      email,
      display_name,
      password_hash,
      role,
      permissions
    )
    values (
      ${input.email.toLowerCase()},
      ${input.displayName},
      ${await argon2.hash(input.password)},
      ${input.role},
      ${input.permissions}
    )
    returning
      id,
      email,
      display_name as "displayName",
      role,
      permissions,
      mfa_enabled as "mfaEnabled",
      active,
      last_login_at as "lastLoginAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  const user = requireRow(rows, "ADMIN_USER_CREATE_FAILED", "Admin user could not be created.")

  await recordAuditLog({
    ...audit,
    action: "admin_user.created",
    entityType: "admin_user",
    entityId: user.id,
  })

  return serializeAdminUser(user)
}

export async function listApiKeys(input: ListInput) {
  const rows = await sql<ApiKeyRow[]>`
    select
      id,
      name,
      key_prefix as "keyPrefix",
      scopes,
      active,
      expires_at as "expiresAt",
      revoked_at as "revokedAt",
      last_used_at as "lastUsedAt",
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from public.status_api_keys
    where
      (${input.status ?? null}::text is null or (${input.status ?? ""} = 'active' and active = true and revoked_at is null) or (${input.status ?? ""} = 'revoked' and revoked_at is not null))
      and (${input.q ?? null}::text is null or name ilike ${`%${input.q ?? ""}%`} or key_prefix ilike ${`%${input.q ?? ""}%`})
    order by created_at desc
    limit ${input.limit}
    offset ${input.offset}
  `

  return {
    items: rows.map(serializeApiKey),
    limit: input.limit,
    offset: input.offset,
  }
}

export async function createApiKey(
  input: CreateApiKeyInput,
  audit: AuditContext
) {
  const token = `st_key_${randomBytes(32).toString("base64url")}`
  const createdBy: string | null =
    audit.actorId && isUuid(audit.actorId) ? audit.actorId : null
  const rows = await sql<ApiKeyRow[]>`
    insert into public.status_api_keys (
      name,
      key_hash,
      key_prefix,
      scopes,
      expires_at,
      created_by
    )
    values (
      ${input.name},
      ${hashToken(token)},
      ${token.slice(0, 15)},
      ${input.scopes},
      ${input.expiresAt ? new Date(input.expiresAt) : null},
      ${createdBy}
    )
    returning
      id,
      name,
      key_prefix as "keyPrefix",
      scopes,
      active,
      expires_at as "expiresAt",
      revoked_at as "revokedAt",
      last_used_at as "lastUsedAt",
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  const apiKey = requireRow(rows, "API_KEY_CREATE_FAILED", "API key could not be created.")

  await recordAuditLog({
    ...audit,
    action: "api_key.created",
    entityType: "api_key",
    entityId: apiKey.id,
    metadata: { scopes: input.scopes },
  })

  return {
    apiKey: serializeApiKey(apiKey),
    token,
  }
}

export async function revokeApiKey(id: string, audit: AuditContext) {
  const rows = await sql<ApiKeyRow[]>`
    update public.status_api_keys
    set active = false, revoked_at = now()
    where id = ${id}
      and revoked_at is null
    returning
      id,
      name,
      key_prefix as "keyPrefix",
      scopes,
      active,
      expires_at as "expiresAt",
      revoked_at as "revokedAt",
      last_used_at as "lastUsedAt",
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  const apiKey = requireRow(rows, "API_KEY_NOT_FOUND", "API key not found or already revoked.")

  await recordAuditLog({
    ...audit,
    action: "api_key.revoked",
    entityType: "api_key",
    entityId: id,
  })

  return serializeApiKey(apiKey)
}

export async function getPublicStatusOverview() {
  const groups = await listServiceGroupsWithServices({ publicOnly: true })
  const services = groups.flatMap((group) => group.services)
  const status = calculateOverallStatus(
    services.map((service) => ({
      isPublic: service.isPublic,
      status: service.status,
    }))
  )
  const [incidents, maintenance] = await Promise.all([
    listIncidents({ limit: 5, offset: 0, status: "active", publicOnly: true }),
    listMaintenance({ limit: 5, offset: 0, status: "active", publicOnly: true }),
  ])

  return {
    status,
    label: getOverallStatusLabel(status),
    updatedAt: latestTimestamp(services.map((service) => service.updatedAt)),
    services,
    groups,
    activeIncidents: incidents.items,
    activeMaintenance: maintenance.items,
    counts: {
      services: services.length,
      activeIncidents: incidents.items.length,
      scheduledMaintenance: maintenance.items.length,
      degradedServices: services.filter(
        (service) => service.status === "degraded_performance"
      ).length,
      outageServices: services.filter((service) =>
        ["partial_outage", "major_outage"].includes(service.status)
      ).length,
    },
  }
}

export async function listServiceGroupsWithServices({
  publicOnly,
}: {
  publicOnly: boolean
}) {
  const groupRows = await sql<ServiceGroupRow[]>`
    select
      id,
      name,
      slug,
      description,
      display_order as "displayOrder",
      is_public as "isPublic",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from public.status_service_groups
    where ${publicOnly} = false or is_public = true
    order by display_order asc, name asc
  `
  const serviceRows = await listServiceRows({ publicOnly })

  return groupRows.map((group) => ({
    ...serializeServiceGroup(group),
    services: serviceRows
      .filter((service) => service.groupId === group.id)
      .map(serializeService),
  }))
}

export async function listServices({ publicOnly }: { publicOnly: boolean }) {
  return (await listServiceRows({ publicOnly })).map(serializeService)
}

export async function getPublicServiceDetail(slug: string) {
  const service = await findServiceBySlug(slug, { publicOnly: true })
  const [incidents, maintenance, monitors, metrics, results] = await Promise.all([
    listIncidentsForService(service.id, { publicOnly: true }),
    listMaintenanceForService(service.id, { publicOnly: true }),
    listPublicMonitorSummariesForService(service.id),
    getServiceMetrics(service.id),
    listRecentResultsForService(service.id, 20),
  ])

  return {
    service: serializeService(service),
    incidents,
    maintenance,
    monitors,
    metrics,
    recentResults: results.map(serializeMonitorResult),
  }
}

export async function listServiceGroups() {
  const rows = await sql<ServiceGroupRow[]>`
    select
      id,
      name,
      slug,
      description,
      display_order as "displayOrder",
      is_public as "isPublic",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from public.status_service_groups
    order by display_order asc, name asc
  `

  return rows.map(serializeServiceGroup)
}

export async function createServiceGroup(
  input: CreateServiceGroupInput,
  audit: AuditContext
) {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name)
  const rows = await sql<ServiceGroupRow[]>`
    insert into public.status_service_groups (
      name,
      slug,
      description,
      display_order,
      is_public
    )
    values (
      ${input.name},
      ${slug},
      ${input.description ?? null},
      ${input.displayOrder},
      ${input.isPublic}
    )
    returning
      id,
      name,
      slug,
      description,
      display_order as "displayOrder",
      is_public as "isPublic",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  const row = requireRow(rows, "SERVICE_GROUP_CREATE_FAILED", "Service group could not be created.")
  await recordAuditLog({
    ...audit,
    action: "service_group.created",
    entityType: "service_group",
    entityId: row.id,
    metadata: { slug },
  })

  return serializeServiceGroup(row)
}

export async function updateServiceGroup(
  id: string,
  input: UpdateServiceGroupInput,
  audit: AuditContext
) {
  const current = await findServiceGroupById(id)
  const rows = await sql<ServiceGroupRow[]>`
    update public.status_service_groups
    set
      name = ${input.name ?? current.name},
      slug = ${input.slug ? slugify(input.slug) : current.slug},
      description = ${input.description === undefined ? current.description : input.description},
      display_order = ${input.displayOrder ?? current.displayOrder},
      is_public = ${input.isPublic ?? current.isPublic}
    where id = ${id}
    returning
      id,
      name,
      slug,
      description,
      display_order as "displayOrder",
      is_public as "isPublic",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  const row = requireRow(rows, "SERVICE_GROUP_NOT_FOUND", "Service group not found.")
  await recordAuditLog({
    ...audit,
    action: "service_group.updated",
    entityType: "service_group",
    entityId: row.id,
  })

  return serializeServiceGroup(row)
}

export async function createService(input: CreateServiceInput, audit: AuditContext) {
  if (input.groupId) {
    await findServiceGroupById(input.groupId)
  }

  const slug = input.slug ? slugify(input.slug) : slugify(input.name)

  const rows = await sql<ServiceRow[]>`
    insert into public.status_services (
      group_id,
      name,
      slug,
      description,
      status,
      display_order,
      is_public,
      monitoring_enabled
    )
    values (
      ${input.groupId ?? null},
      ${input.name},
      ${slug},
      ${input.description ?? null},
      ${input.status},
      ${input.displayOrder},
      ${input.isPublic},
      ${input.monitoringEnabled}
    )
    returning
      id,
      group_id as "groupId",
      null::text as "groupName",
      null::text as "groupSlug",
      name,
      slug,
      description,
      status,
      display_order as "displayOrder",
      is_public as "isPublic",
      monitoring_enabled as "monitoringEnabled",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  const row = requireRow(rows, "SERVICE_CREATE_FAILED", "Service could not be created.")

  await replaceServiceDependencies(row.id, input.dependencyServiceIds)
  await setServiceStatus(row.id, input.status, "Initial service status", null)
  await recordAuditLog({
    ...audit,
    action: "service.created",
    entityType: "service",
    entityId: row.id,
    metadata: { slug },
  })

  return getAdminService(row.id)
}

export async function updateService(
  id: string,
  input: UpdateServiceInput,
  audit: AuditContext
) {
  const current = await getAdminServiceRow(id)

  if (input.groupId) {
    await findServiceGroupById(input.groupId)
  }

  const rows = await sql<ServiceRow[]>`
    update public.status_services
    set
      group_id = ${input.groupId === undefined ? current.groupId : input.groupId},
      name = ${input.name ?? current.name},
      slug = ${input.slug ? slugify(input.slug) : current.slug},
      description = ${input.description === undefined ? current.description : input.description},
      display_order = ${input.displayOrder ?? current.displayOrder},
      is_public = ${input.isPublic ?? current.isPublic},
      monitoring_enabled = ${input.monitoringEnabled ?? current.monitoringEnabled}
    where id = ${id}
    returning
      id,
      group_id as "groupId",
      null::text as "groupName",
      null::text as "groupSlug",
      name,
      slug,
      description,
      status,
      display_order as "displayOrder",
      is_public as "isPublic",
      monitoring_enabled as "monitoringEnabled",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  requireRow(rows, "SERVICE_NOT_FOUND", "Service not found.")

  if (input.status && input.status !== current.status) {
    await setServiceStatus(id, input.status, "Manual status update", null)
  }

  if (input.dependencyServiceIds) {
    await replaceServiceDependencies(id, input.dependencyServiceIds)
  }

  await recordAuditLog({
    ...audit,
    action: "service.updated",
    entityType: "service",
    entityId: id,
  })

  return getAdminService(id)
}

export async function getAdminService(id: string) {
  const service = await getAdminServiceRow(id)
  const dependencies = await listServiceDependencies(id)

  return {
    ...serializeService(service),
    dependencies,
  }
}

export async function listMonitors(input: ListInput) {
  const rows = await sql<MonitorRow[]>`
    select
      m.id,
      m.service_id as "serviceId",
      s.name as "serviceName",
      s.slug as "serviceSlug",
      s.status as "serviceStatus",
      m.name,
      m.check_type as "checkType",
      m.target,
      m.interval_seconds as "intervalSeconds",
      m.timeout_seconds as "timeoutSeconds",
      m.expected_status as "expectedStatus",
      m.expected_body as "expectedBody",
      m.expected_headers as "expectedHeaders",
      m.regions,
      m.retry_count as "retryCount",
      m.failure_threshold as "failureThreshold",
      m.recovery_threshold as "recoveryThreshold",
      m.consecutive_failures as "consecutiveFailures",
      m.consecutive_successes as "consecutiveSuccesses",
      m.enabled,
      m.created_at as "createdAt",
      m.updated_at as "updatedAt"
    from public.status_monitors m
    join public.status_services s on s.id = m.service_id
    where
      (${input.q ?? null}::text is null or m.name ilike ${`%${input.q ?? ""}%`} or s.name ilike ${`%${input.q ?? ""}%`})
      and (${input.status ?? null}::text is null or (${input.status ?? ""} = 'enabled' and m.enabled = true) or (${input.status ?? ""} = 'disabled' and m.enabled = false))
    order by m.created_at desc
    limit ${input.limit}
    offset ${input.offset}
  `

  return {
    items: rows.map(serializeMonitor),
    limit: input.limit,
    offset: input.offset,
  }
}

export async function createMonitor(input: CreateMonitorInput, audit: AuditContext) {
  await getAdminServiceRow(input.serviceId)

  const rows = await sql<MonitorRow[]>`
    insert into public.status_monitors (
      service_id,
      name,
      check_type,
      target,
      interval_seconds,
      timeout_seconds,
      expected_status,
      expected_body,
      expected_headers,
      regions,
      retry_count,
      failure_threshold,
      recovery_threshold,
      enabled
    )
    values (
      ${input.serviceId},
      ${input.name},
      ${input.checkType},
      ${input.target},
      ${input.intervalSeconds},
      ${input.timeoutSeconds},
      ${input.expectedStatus ?? null},
      ${input.expectedBody ?? null},
      ${sql.json(input.expectedHeaders)},
      ${input.regions},
      ${input.retryCount},
      ${input.failureThreshold},
      ${input.recoveryThreshold},
      ${input.enabled}
    )
    returning
      id,
      service_id as "serviceId",
      ''::text as "serviceName",
      ''::text as "serviceSlug",
      'unknown'::text as "serviceStatus",
      name,
      check_type as "checkType",
      target,
      interval_seconds as "intervalSeconds",
      timeout_seconds as "timeoutSeconds",
      expected_status as "expectedStatus",
      expected_body as "expectedBody",
      expected_headers as "expectedHeaders",
      regions,
      retry_count as "retryCount",
      failure_threshold as "failureThreshold",
      recovery_threshold as "recoveryThreshold",
      consecutive_failures as "consecutiveFailures",
      consecutive_successes as "consecutiveSuccesses",
      enabled,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  const row = requireRow(rows, "MONITOR_CREATE_FAILED", "Monitor could not be created.")
  await recordAuditLog({
    ...audit,
    action: "monitor.created",
    entityType: "monitor",
    entityId: row.id,
  })

  return getMonitor(row.id)
}

export async function updateMonitor(
  id: string,
  input: UpdateMonitorInput,
  audit: AuditContext
) {
  const current = await getMonitorRow(id)

  if (input.serviceId) {
    await getAdminServiceRow(input.serviceId)
  }

  const rows = await sql<MonitorRow[]>`
    update public.status_monitors
    set
      service_id = ${input.serviceId ?? current.serviceId},
      name = ${input.name ?? current.name},
      check_type = ${input.checkType ?? current.checkType},
      target = ${input.target ?? current.target},
      interval_seconds = ${input.intervalSeconds ?? current.intervalSeconds},
      timeout_seconds = ${input.timeoutSeconds ?? current.timeoutSeconds},
      expected_status = ${input.expectedStatus === undefined ? current.expectedStatus : input.expectedStatus},
      expected_body = ${input.expectedBody === undefined ? current.expectedBody : input.expectedBody},
      expected_headers = ${input.expectedHeaders ? sql.json(input.expectedHeaders) : sql.json(current.expectedHeaders)},
      regions = ${input.regions ?? current.regions},
      retry_count = ${input.retryCount ?? current.retryCount},
      failure_threshold = ${input.failureThreshold ?? current.failureThreshold},
      recovery_threshold = ${input.recoveryThreshold ?? current.recoveryThreshold},
      enabled = ${input.enabled ?? current.enabled}
    where id = ${id}
    returning
      id,
      service_id as "serviceId",
      ''::text as "serviceName",
      ''::text as "serviceSlug",
      'unknown'::text as "serviceStatus",
      name,
      check_type as "checkType",
      target,
      interval_seconds as "intervalSeconds",
      timeout_seconds as "timeoutSeconds",
      expected_status as "expectedStatus",
      expected_body as "expectedBody",
      expected_headers as "expectedHeaders",
      regions,
      retry_count as "retryCount",
      failure_threshold as "failureThreshold",
      recovery_threshold as "recoveryThreshold",
      consecutive_failures as "consecutiveFailures",
      consecutive_successes as "consecutiveSuccesses",
      enabled,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  requireRow(rows, "MONITOR_NOT_FOUND", "Monitor not found.")
  await recordAuditLog({
    ...audit,
    action: "monitor.updated",
    entityType: "monitor",
    entityId: id,
  })

  return getMonitor(id)
}

export async function getMonitor(id: string) {
  return serializeMonitor(await getMonitorRow(id))
}

export async function listIncidents({
  publicOnly,
  ...input
}: ListInput & { publicOnly: boolean }) {
  const active = input.status === "active"
  const rows = await sql<IncidentRow[]>`
    select
      id,
      title,
      slug,
      status,
      severity,
      impact,
      created_by as "createdBy",
      detected_automatically as "detectedAutomatically",
      scheduled,
      public,
      started_at as "startedAt",
      resolved_at as "resolvedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from public.status_incidents
    where
      (${publicOnly} = false or public = true)
      and (
        ${input.status ?? null}::text is null
        or (${active} = true and status <> 'resolved')
        or status = ${input.status ?? ""}
      )
      and (${input.q ?? null}::text is null or title ilike ${`%${input.q ?? ""}%`})
    order by started_at desc
    limit ${input.limit}
    offset ${input.offset}
  `

  return {
    items: await Promise.all(rows.map((row) => serializeIncidentWithServices(row))),
    limit: input.limit,
    offset: input.offset,
  }
}

export async function getIncidentDetail(value: string, publicOnly: boolean) {
  const rows = await sql<IncidentRow[]>`
    select
      id,
      title,
      slug,
      status,
      severity,
      impact,
      created_by as "createdBy",
      detected_automatically as "detectedAutomatically",
      scheduled,
      public,
      started_at as "startedAt",
      resolved_at as "resolvedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from public.status_incidents
    where (id::text = ${value} or slug = ${value})
      and (${publicOnly} = false or public = true)
    limit 1
  `
  const incident = requireRow(rows, "INCIDENT_NOT_FOUND", "Incident not found.")
  const [services, updates] = await Promise.all([
    listIncidentServices(incident.id),
    listIncidentUpdates(incident.id, publicOnly),
  ])

  return {
    ...serializeIncident(incident),
    services,
    updates,
  }
}

export async function createIncident(input: CreateIncidentInput, audit: AuditContext) {
  const slug = input.slug ? slugify(input.slug) : await uniqueIncidentSlug(input.title)
  const startedAt = input.startedAt ? new Date(input.startedAt) : new Date()

  const rows = await sql<IncidentRow[]>`
    insert into public.status_incidents (
      title,
      slug,
      status,
      severity,
      impact,
      created_by,
      detected_automatically,
      public,
      started_at,
      resolved_at
    )
    values (
      ${input.title},
      ${slug},
      ${input.status},
      ${input.severity},
      ${input.impact},
      ${input.createdBy ?? audit.actorId ?? null},
      ${input.detectedAutomatically},
      ${input.public},
      ${startedAt},
      ${input.status === "resolved" ? new Date() : null}
    )
    returning
      id,
      title,
      slug,
      status,
      severity,
      impact,
      created_by as "createdBy",
      detected_automatically as "detectedAutomatically",
      scheduled,
      public,
      started_at as "startedAt",
      resolved_at as "resolvedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  const incident = requireRow(rows, "INCIDENT_CREATE_FAILED", "Incident could not be created.")
  await replaceIncidentServices(incident.id, input.serviceIds)

  if (input.message) {
    await createIncidentUpdate(incident.id, {
      status: input.status,
      message: input.message,
      authorId: input.createdBy ?? audit.actorId,
      public: input.public,
    })
  }

  await Promise.all(
    input.serviceIds.map((serviceId) =>
      setServiceStatus(serviceId, serviceStatusFromImpact(input.impact), input.title, incident.id)
    )
  )

  await recordAuditLog({
    ...audit,
    action: "incident.created",
    entityType: "incident",
    entityId: incident.id,
    metadata: { slug },
  })

  const detail = await getIncidentDetail(incident.id, false)
  await enqueueStatusNotifications({
    event: "incident.created",
    entityType: "incident",
    entityId: incident.id,
    serviceIds: input.serviceIds,
    payload: detail,
  })

  return detail
}

export async function updateIncident(
  id: string,
  input: UpdateIncidentInput,
  audit: AuditContext
) {
  const current = await getIncidentRow(id)
  const nextStatus = input.status ?? current.status
  const resolvedAt =
    input.resolvedAt !== undefined ? input.resolvedAt && new Date(input.resolvedAt)
    : nextStatus === "resolved" && current.status !== "resolved" ? new Date()
    : nextStatus !== "resolved" ? null
    : current.resolvedAt

  const rows = await sql<IncidentRow[]>`
    update public.status_incidents
    set
      title = ${input.title ?? current.title},
      status = ${nextStatus},
      severity = ${input.severity ?? current.severity},
      impact = ${input.impact ?? current.impact},
      public = ${input.public ?? current.public},
      resolved_at = ${resolvedAt}
    where id = ${id}
    returning
      id,
      title,
      slug,
      status,
      severity,
      impact,
      created_by as "createdBy",
      detected_automatically as "detectedAutomatically",
      scheduled,
      public,
      started_at as "startedAt",
      resolved_at as "resolvedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  requireRow(rows, "INCIDENT_NOT_FOUND", "Incident not found.")

  if (input.serviceIds) {
    await replaceIncidentServices(id, input.serviceIds)
  }

  if (nextStatus === "resolved") {
    const services = input.serviceIds ?? (await listIncidentServices(id)).map((service) => service.id)
    await Promise.all(
      services.map((serviceId) =>
        setServiceStatus(serviceId, "operational", `Incident resolved: ${current.title}`, id)
      )
    )
  }

  await recordAuditLog({
    ...audit,
    action: "incident.updated",
    entityType: "incident",
    entityId: id,
  })

  const detail = await getIncidentDetail(id, false)
  await enqueueStatusNotifications({
    event: "incident.updated",
    entityType: "incident",
    entityId: id,
    serviceIds: detail.services.map((service) => service.id),
    payload: detail,
  })

  return detail
}

export async function addIncidentUpdate(
  id: string,
  input: CreateIncidentUpdateInput,
  audit: AuditContext
) {
  await getIncidentRow(id)
  const update = await createIncidentUpdate(id, input)

  if (input.status === "resolved") {
    await updateIncident(
      id,
      {
        status: "resolved",
        resolvedAt: new Date().toISOString(),
      },
      audit
    )
  } else {
    await sql`
      update public.status_incidents
      set status = ${input.status}
      where id = ${id}
    `
  }

  await recordAuditLog({
    ...audit,
    action: "incident_update.created",
    entityType: "incident",
    entityId: id,
  })

  const detail = await getIncidentDetail(id, false)
  await enqueueStatusNotifications({
    event: "incident.update.created",
    entityType: "incident",
    entityId: id,
    serviceIds: detail.services.map((service) => service.id),
    payload: { incident: detail, update },
  })

  return update
}

export async function listMaintenance({
  publicOnly,
  ...input
}: ListInput & { publicOnly: boolean }) {
  const active = input.status === "active"
  const rows = await sql<MaintenanceRow[]>`
    select
      id,
      title,
      slug,
      description,
      status,
      start_at as "startAt",
      end_at as "endAt",
      timezone,
      public,
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from public.status_maintenance_windows
    where
      (${publicOnly} = false or public = true)
      and (
        ${input.status ?? null}::text is null
        or (${active} = true and status in ('scheduled', 'in_progress'))
        or status = ${input.status ?? ""}
      )
      and (${input.q ?? null}::text is null or title ilike ${`%${input.q ?? ""}%`})
    order by start_at desc
    limit ${input.limit}
    offset ${input.offset}
  `

  return {
    items: await Promise.all(rows.map((row) => serializeMaintenanceWithServices(row))),
    limit: input.limit,
    offset: input.offset,
  }
}

export async function getMaintenanceDetail(value: string, publicOnly: boolean) {
  const rows = await sql<MaintenanceRow[]>`
    select
      id,
      title,
      slug,
      description,
      status,
      start_at as "startAt",
      end_at as "endAt",
      timezone,
      public,
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from public.status_maintenance_windows
    where (id::text = ${value} or slug = ${value})
      and (${publicOnly} = false or public = true)
    limit 1
  `
  const maintenance = requireRow(rows, "MAINTENANCE_NOT_FOUND", "Maintenance not found.")

  return {
    ...serializeMaintenance(maintenance),
    services: await listMaintenanceServices(maintenance.id),
  }
}

export async function createMaintenance(
  input: CreateMaintenanceInput,
  audit: AuditContext
) {
  const slug = input.slug ? slugify(input.slug) : await uniqueMaintenanceSlug(input.title)

  const rows = await sql<MaintenanceRow[]>`
    insert into public.status_maintenance_windows (
      title,
      slug,
      description,
      status,
      start_at,
      end_at,
      timezone,
      public,
      created_by
    )
    values (
      ${input.title},
      ${slug},
      ${input.description ?? null},
      ${input.status},
      ${new Date(input.startAt)},
      ${new Date(input.endAt)},
      ${input.timezone},
      ${input.public},
      ${input.createdBy ?? audit.actorId ?? null}
    )
    returning
      id,
      title,
      slug,
      description,
      status,
      start_at as "startAt",
      end_at as "endAt",
      timezone,
      public,
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  const maintenance = requireRow(
    rows,
    "MAINTENANCE_CREATE_FAILED",
    "Maintenance could not be created."
  )
  await replaceMaintenanceServices(maintenance.id, input.serviceIds)
  await recordAuditLog({
    ...audit,
    action: "maintenance.created",
    entityType: "maintenance",
    entityId: maintenance.id,
    metadata: { slug },
  })

  const detail = await getMaintenanceDetail(maintenance.id, false)
  await enqueueStatusNotifications({
    event: "maintenance.created",
    entityType: "maintenance",
    entityId: maintenance.id,
    serviceIds: input.serviceIds,
    payload: detail,
  })

  return detail
}

export async function updateMaintenance(
  id: string,
  input: UpdateMaintenanceInput,
  audit: AuditContext
) {
  const current = await getMaintenanceRow(id)

  const rows = await sql<MaintenanceRow[]>`
    update public.status_maintenance_windows
    set
      title = ${input.title ?? current.title},
      slug = ${input.slug ? slugify(input.slug) : current.slug},
      description = ${input.description === undefined ? current.description : input.description},
      status = ${input.status ?? current.status},
      start_at = ${input.startAt ? new Date(input.startAt) : current.startAt},
      end_at = ${input.endAt ? new Date(input.endAt) : current.endAt},
      timezone = ${input.timezone ?? current.timezone},
      public = ${input.public ?? current.public},
      created_by = ${input.createdBy ?? current.createdBy}
    where id = ${id}
    returning
      id,
      title,
      slug,
      description,
      status,
      start_at as "startAt",
      end_at as "endAt",
      timezone,
      public,
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  requireRow(rows, "MAINTENANCE_NOT_FOUND", "Maintenance not found.")

  if (input.serviceIds) {
    await replaceMaintenanceServices(id, input.serviceIds)
  }

  await recordAuditLog({
    ...audit,
    action: "maintenance.updated",
    entityType: "maintenance",
    entityId: id,
  })

  const detail = await getMaintenanceDetail(id, false)
  await enqueueStatusNotifications({
    event: "maintenance.updated",
    entityType: "maintenance",
    entityId: id,
    serviceIds: detail.services.map((service) => service.id),
    payload: detail,
  })

  return detail
}

export async function createSubscription(input: CreateSubscriptionInput) {
  const verificationToken = randomBytes(32).toString("hex")
  const verificationTokenHash = hashToken(verificationToken)
  const verified = input.type !== "email"
  const webhookSigningSecret =
    input.type === "webhook" ? `whsec_${randomBytes(32).toString("base64url")}` : null
  const encryptedWebhookSigningSecret =
    webhookSigningSecret ? encryptSecret(webhookSigningSecret) : null

  const rows = await sql<SubscriptionRow[]>`
    insert into public.status_subscriptions (
      type,
      email,
      webhook_url,
      slack_webhook_url,
      teams_webhook_url,
      verification_token_hash,
      webhook_secret_ciphertext,
      webhook_secret_iv,
      webhook_secret_tag,
      verified,
      active,
      subscribed_all,
      incident_updates,
      maintenance_updates
    )
    values (
      ${input.type},
      ${input.email?.toLowerCase() ?? null},
      ${input.webhookUrl ?? null},
      ${input.slackWebhookUrl ?? null},
      ${input.teamsWebhookUrl ?? null},
      ${verificationTokenHash},
      ${encryptedWebhookSigningSecret?.ciphertext ?? null},
      ${encryptedWebhookSigningSecret?.iv ?? null},
      ${encryptedWebhookSigningSecret?.tag ?? null},
      ${verified},
      true,
      ${input.subscribedAll},
      ${input.incidentUpdates},
      ${input.maintenanceUpdates}
    )
    returning
      id,
      type,
      email,
      webhook_url as "webhookUrl",
      slack_webhook_url as "slackWebhookUrl",
      teams_webhook_url as "teamsWebhookUrl",
      webhook_secret_ciphertext as "webhookSecretCiphertext",
      webhook_secret_iv as "webhookSecretIv",
      webhook_secret_tag as "webhookSecretTag",
      webhook_unhealthy as "webhookUnhealthy",
      verified,
      active,
      subscribed_all as "subscribedAll",
      incident_updates as "incidentUpdates",
      maintenance_updates as "maintenanceUpdates",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  const subscription = requireRow(
    rows,
    "SUBSCRIPTION_CREATE_FAILED",
    "Subscription could not be created."
  )

  if (!input.subscribedAll && input.serviceIds.length > 0) {
    await replaceSubscriptionServices(subscription.id, input.serviceIds)
  }

  if (input.type === "email" && subscription.email) {
    await sql`
      insert into public.status_notification_deliveries (
        subscription_id,
        subscription_type,
        event,
        target,
        status,
        payload
      )
      values (
        ${subscription.id},
        'email',
        'subscription.verify',
        ${subscription.email},
        'pending',
        ${sql.json({
          event: "subscription.verify",
          email: subscription.email,
          verificationToken,
          verificationUrl: `${env.STATUS_PUBLIC_BASE_URL}/subscribe/verify?token=${verificationToken}`,
        } as postgres.JSONValue)}
      )
    `
  }

  return {
    subscription: serializeSubscription(subscription),
    verificationRequired: input.type === "email",
    verificationToken: input.type === "email" ? verificationToken : null,
    webhookSigningSecret,
  }
}

export async function verifySubscription(token: string) {
  const rows = await sql<SubscriptionRow[]>`
    update public.status_subscriptions
    set verified = true, active = true
    where verification_token_hash = ${hashToken(token)}
    returning
      id,
      type,
      email,
      webhook_url as "webhookUrl",
      slack_webhook_url as "slackWebhookUrl",
      teams_webhook_url as "teamsWebhookUrl",
      verified,
      active,
      subscribed_all as "subscribedAll",
      incident_updates as "incidentUpdates",
      maintenance_updates as "maintenanceUpdates",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  const subscription = requireRow(
    rows,
    "SUBSCRIPTION_TOKEN_INVALID",
    "Subscription verification token is invalid or expired."
  )

  return serializeSubscription(subscription)
}

export async function listSubscriptions(input: ListInput) {
  const rows = await sql<SubscriptionRow[]>`
    select
      id,
      type,
      email,
      webhook_url as "webhookUrl",
      slack_webhook_url as "slackWebhookUrl",
      teams_webhook_url as "teamsWebhookUrl",
      verified,
      active,
      subscribed_all as "subscribedAll",
      incident_updates as "incidentUpdates",
      maintenance_updates as "maintenanceUpdates",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from public.status_subscriptions
    where
      (${input.status ?? null}::text is null or (${input.status ?? ""} = 'active' and active = true) or (${input.status ?? ""} = 'inactive' and active = false))
      and (${input.q ?? null}::text is null or coalesce(email, webhook_url, slack_webhook_url, teams_webhook_url, '') ilike ${`%${input.q ?? ""}%`})
    order by created_at desc
    limit ${input.limit}
    offset ${input.offset}
  `

  return {
    items: rows.map(serializeSubscription),
    limit: input.limit,
    offset: input.offset,
  }
}

export async function listAuditLogs(input: ListInput) {
  const rows = await sql<
    {
      id: string
      actorType: string
      actorId: string | null
      action: string
      entityType: string
      entityId: string | null
      metadata: Record<string, unknown>
      ipAddress: string | null
      userAgent: string | null
      createdAt: Date
    }[]
  >`
    select
      id,
      actor_type as "actorType",
      actor_id as "actorId",
      action,
      entity_type as "entityType",
      entity_id as "entityId",
      metadata,
      ip_address as "ipAddress",
      user_agent as "userAgent",
      created_at as "createdAt"
    from public.status_audit_logs
    where
      (${input.q ?? null}::text is null or action ilike ${`%${input.q ?? ""}%`} or entity_type ilike ${`%${input.q ?? ""}%`})
    order by created_at desc
    limit ${input.limit}
    offset ${input.offset}
  `

  return {
    items: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    limit: input.limit,
    offset: input.offset,
  }
}

export async function getAdminOverview() {
  const overview = await getPublicStatusOverview()
  const failedMonitorRows = await sql<{ count: string }[]>`
    select count(*)::text as count
    from public.status_monitor_results
    where status in ('failed', 'timeout')
      and checked_at >= now() - interval '15 minutes'
  `
  const notificationRows = await sql<{ count: string }[]>`
    select count(*)::text as count
    from public.status_notification_deliveries
    where status in ('pending', 'retrying', 'failed')
  `

  return {
    ...overview,
    monitoringFailuresLast15Minutes: Number(failedMonitorRows[0]?.count ?? 0),
    pendingNotifications: Number(notificationRows[0]?.count ?? 0),
  }
}

export async function recordMonitorResult(input: MonitorResultInput) {
  return sql.begin(async (transaction) => {
    const monitorRows = await transaction<MonitorRow[]>`
      select
        m.id,
        m.service_id as "serviceId",
        s.name as "serviceName",
        s.slug as "serviceSlug",
        s.status as "serviceStatus",
        m.name,
        m.check_type as "checkType",
        m.target,
        m.interval_seconds as "intervalSeconds",
        m.timeout_seconds as "timeoutSeconds",
        m.expected_status as "expectedStatus",
        m.expected_body as "expectedBody",
        m.expected_headers as "expectedHeaders",
        m.regions,
        m.retry_count as "retryCount",
        m.failure_threshold as "failureThreshold",
        m.recovery_threshold as "recoveryThreshold",
        m.consecutive_failures as "consecutiveFailures",
        m.consecutive_successes as "consecutiveSuccesses",
        m.enabled,
        m.created_at as "createdAt",
        m.updated_at as "updatedAt"
      from public.status_monitors m
      join public.status_services s on s.id = m.service_id
      where m.id = ${input.monitorId}
      for update of m, s
    `
    const monitor = requireRow(monitorRows, "MONITOR_NOT_FOUND", "Monitor not found.")

    if (!monitor.enabled) {
      throw new StatusHttpError(
        409,
        "MONITOR_DISABLED",
        "Monitor is disabled and cannot accept new results."
      )
    }

    const isSuccess = input.status === "success"
    const nextConsecutiveFailures = isSuccess ? 0 : monitor.consecutiveFailures + 1
    const nextConsecutiveSuccesses = isSuccess ? monitor.consecutiveSuccesses + 1 : 0

    const resultRows = await transaction<MonitorResultRow[]>`
      insert into public.status_monitor_results (
        monitor_id,
        service_id,
        region,
        status,
        http_status,
        response_time_ms,
        error_message,
        checked_at
      )
      values (
        ${monitor.id},
        ${monitor.serviceId},
        ${input.region},
        ${input.status},
        ${input.httpStatus ?? null},
        ${input.responseTimeMs ?? null},
        ${input.error ?? null},
        ${input.checkedAt ? new Date(input.checkedAt) : new Date()}
      )
      returning
        id,
        monitor_id as "monitorId",
        service_id as "serviceId",
        region,
        status,
        http_status as "httpStatus",
        response_time_ms as "responseTimeMs",
        error_message as "errorMessage",
        checked_at as "checkedAt",
        created_at as "createdAt"
    `

    await transaction`
      update public.status_monitors
      set
        consecutive_failures = ${nextConsecutiveFailures},
        consecutive_successes = ${nextConsecutiveSuccesses}
      where id = ${monitor.id}
    `

    const nextServiceStatus = deriveServiceStatusFromMonitorResult(
      input.status,
      nextConsecutiveFailures,
      monitor.failureThreshold,
      nextConsecutiveSuccesses,
      monitor.recoveryThreshold
    )

    if (nextServiceStatus && nextServiceStatus !== monitor.serviceStatus) {
      await setServiceStatusInTransaction({
        transaction,
        serviceId: monitor.serviceId,
        newStatus: nextServiceStatus,
        reason: `Monitor ${monitor.name} reported ${input.status}`,
        incidentId: null,
      })

      if (nextServiceStatus === "major_outage" || nextServiceStatus === "degraded_performance") {
        await ensureAutomaticIncident({
          transaction,
          serviceId: monitor.serviceId,
          serviceName: monitor.serviceName,
          serviceSlug: monitor.serviceSlug,
          status: nextServiceStatus,
          monitorName: monitor.name,
        })
      }

      if (nextServiceStatus === "operational") {
        await resolveAutomaticIncidents({
          transaction,
          serviceId: monitor.serviceId,
          serviceName: monitor.serviceName,
        })
      }
    }

    return {
      result: serializeMonitorResult(
        requireRow(
          resultRows,
          "MONITOR_RESULT_CREATE_FAILED",
          "Monitor result could not be recorded."
        )
      ),
      counters: {
        consecutiveFailures: nextConsecutiveFailures,
        consecutiveSuccesses: nextConsecutiveSuccesses,
      },
      serviceStatus: nextServiceStatus ?? monitor.serviceStatus,
    }
  })
}

export async function listEnabledMonitoringMonitors(region?: string) {
  const rows = await sql<MonitorRow[]>`
    select
      m.id,
      m.service_id as "serviceId",
      s.name as "serviceName",
      s.slug as "serviceSlug",
      s.status as "serviceStatus",
      m.name,
      m.check_type as "checkType",
      m.target,
      m.interval_seconds as "intervalSeconds",
      m.timeout_seconds as "timeoutSeconds",
      m.expected_status as "expectedStatus",
      m.expected_body as "expectedBody",
      m.expected_headers as "expectedHeaders",
      m.regions,
      m.retry_count as "retryCount",
      m.failure_threshold as "failureThreshold",
      m.recovery_threshold as "recoveryThreshold",
      m.consecutive_failures as "consecutiveFailures",
      m.consecutive_successes as "consecutiveSuccesses",
      m.enabled,
      m.created_at as "createdAt",
      m.updated_at as "updatedAt"
    from public.status_monitors m
    join public.status_services s on s.id = m.service_id
    where m.enabled = true
      and s.monitoring_enabled = true
      and (${region ?? null}::text is null or ${region ?? ""} = any(m.regions))
    order by m.interval_seconds asc, m.name asc
  `

  return { items: rows.map(serializeMonitor) }
}

export async function recordWorkerHeartbeat(input: WorkerHeartbeatInput) {
  const rows = await sql<WorkerHeartbeatRow[]>`
    insert into public.status_worker_heartbeats (
      worker_id,
      worker_type,
      region,
      version,
      status,
      queue_name,
      last_seen,
      metadata
    )
    values (
      ${input.workerId},
      ${input.workerType},
      ${input.region},
      ${input.version},
      ${input.status},
      ${input.queueName ?? null},
      now(),
      ${sql.json(input.metadata as postgres.JSONValue)}
    )
    on conflict (worker_id)
    do update set
      worker_type = excluded.worker_type,
      region = excluded.region,
      version = excluded.version,
      status = excluded.status,
      queue_name = excluded.queue_name,
      last_seen = now(),
      metadata = excluded.metadata
    returning
      worker_id as "workerId",
      worker_type as "workerType",
      region,
      version,
      status,
      queue_name as "queueName",
      last_seen as "lastSeen",
      metadata,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `

  return serializeWorkerHeartbeat(
    requireRow(rows, "WORKER_HEARTBEAT_FAILED", "Worker heartbeat could not be recorded.")
  )
}

export async function listWorkerHeartbeats(input: ListInput) {
  const rows = await sql<WorkerHeartbeatRow[]>`
    select
      worker_id as "workerId",
      worker_type as "workerType",
      region,
      version,
      status,
      queue_name as "queueName",
      last_seen as "lastSeen",
      metadata,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from public.status_worker_heartbeats
    where
      (${input.status ?? null}::text is null or status = ${input.status ?? ""})
      and (${input.q ?? null}::text is null or worker_id ilike ${`%${input.q ?? ""}%`} or worker_type ilike ${`%${input.q ?? ""}%`} or region ilike ${`%${input.q ?? ""}%`})
    order by last_seen desc
    limit ${input.limit}
    offset ${input.offset}
  `

  return {
    items: rows.map(serializeWorkerHeartbeat),
    limit: input.limit,
    offset: input.offset,
  }
}

export async function listPendingNotificationDeliveries(input: ListInput) {
  const rows = await sql<PendingNotificationDeliveryRow[]>`
    with picked as (
      select d.id
      from public.status_notification_deliveries d
      where d.status in ('pending', 'retrying')
        and (d.next_attempt_at is null or d.next_attempt_at <= now())
      order by d.created_at asc
      limit ${input.limit}
      offset ${input.offset}
      for update skip locked
    ),
    claimed as (
      update public.status_notification_deliveries d
      set status = 'retrying'
      from picked
      where d.id = picked.id
      returning d.*
    )
    select
      d.id,
      d.subscription_id as "subscriptionId",
      d.subscription_type as "subscriptionType",
      d.event,
      d.target,
      d.status,
      d.attempts,
      d.last_error as "lastError",
      d.next_attempt_at as "nextAttemptAt",
      d.payload,
      d.headers,
      d.delivery_id as "deliveryId",
      d.created_at as "createdAt",
      d.updated_at as "updatedAt",
      s.email,
      s.webhook_url as "webhookUrl",
      s.slack_webhook_url as "slackWebhookUrl",
      s.teams_webhook_url as "teamsWebhookUrl",
      s.webhook_secret_ciphertext as "webhookSecretCiphertext",
      s.webhook_secret_iv as "webhookSecretIv",
      s.webhook_secret_tag as "webhookSecretTag"
    from claimed d
    left join public.status_subscriptions s on s.id = d.subscription_id
    order by d.created_at asc
  `

  return {
    items: rows.map(serializePendingNotificationDelivery),
    limit: input.limit,
    offset: input.offset,
  }
}

export async function listNotificationDeliveries(input: ListInput) {
  const rows = await sql<NotificationDeliveryRow[]>`
    select
      id,
      subscription_id as "subscriptionId",
      subscription_type as "subscriptionType",
      event,
      target,
      status,
      attempts,
      last_error as "lastError",
      next_attempt_at as "nextAttemptAt",
      payload,
      headers,
      delivery_id as "deliveryId",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from public.status_notification_deliveries
    where
      (${input.status ?? null}::text is null or status = ${input.status ?? ""})
      and (${input.q ?? null}::text is null or event ilike ${`%${input.q ?? ""}%`} or target ilike ${`%${input.q ?? ""}%`})
    order by created_at desc
    limit ${input.limit}
    offset ${input.offset}
  `

  return {
    items: rows.map(serializeNotificationDelivery),
    limit: input.limit,
    offset: input.offset,
  }
}

export async function markNotificationDelivered(id: string) {
  const rows = await sql<NotificationDeliveryRow[]>`
    update public.status_notification_deliveries
    set status = 'delivered',
        last_error = null,
        next_attempt_at = null,
        attempts = attempts + 1
    where id = ${id}
    returning
      id,
      subscription_id as "subscriptionId",
      subscription_type as "subscriptionType",
      event,
      target,
      status,
      attempts,
      last_error as "lastError",
      next_attempt_at as "nextAttemptAt",
      payload,
      headers,
      delivery_id as "deliveryId",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `

  return serializeNotificationDelivery(
    requireRow(rows, "NOTIFICATION_NOT_FOUND", "Notification delivery not found.")
  )
}

export async function markNotificationFailed(
  id: string,
  input: NotificationFailureInput
) {
  const rows = await sql<NotificationDeliveryRow[]>`
    update public.status_notification_deliveries
    set
      status = case when attempts + 1 >= 5 then 'failed' else 'retrying' end,
      attempts = attempts + 1,
      last_error = ${input.error},
      next_attempt_at = case
        when attempts + 1 >= 5 then null
        else now() + ((attempts + 1) * interval '5 minutes')
      end
    where id = ${id}
    returning
      id,
      subscription_id as "subscriptionId",
      subscription_type as "subscriptionType",
      event,
      target,
      status,
      attempts,
      last_error as "lastError",
      next_attempt_at as "nextAttemptAt",
      payload,
      headers,
      delivery_id as "deliveryId",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `

  return serializeNotificationDelivery(
    requireRow(rows, "NOTIFICATION_NOT_FOUND", "Notification delivery not found.")
  )
}

export async function getSlaReport() {
  const rows = await sql<
    (SlaTargetRow & {
      totalChecks: string
      successfulChecks: string
      p95: number | null
    })[]
  >`
    select
      t.id,
      s.id as "serviceId",
      s.name as "serviceName",
      s.slug as "serviceSlug",
      t.availability_target as "availabilityTarget",
      t.latency_p95_target_ms as "latencyP95TargetMs",
      t.exclude_maintenance as "excludeMaintenance",
      t.active,
      t.created_at as "createdAt",
      t.updated_at as "updatedAt",
      count(r.id)::text as "totalChecks",
      count(r.id) filter (where r.status = 'success')::text as "successfulChecks",
      percentile_cont(0.95) within group (order by r.response_time_ms) filter (where r.response_time_ms is not null) as p95
    from public.status_sla_targets t
    join public.status_services s on s.id = t.service_id
    left join public.status_monitor_results r on r.service_id = s.id
      and r.checked_at >= now() - interval '30 days'
    where t.active = true
    group by t.id, s.id
    order by s.name asc
  `

  return {
    window: "30d",
    items: rows.map((row) => {
      const totalChecks = Number(row.totalChecks)
      const successfulChecks = Number(row.successfulChecks)
      const availabilityPercent =
        totalChecks === 0 ? null : Number(((successfulChecks / totalChecks) * 100).toFixed(3))

      return {
        target: serializeSlaTarget(row),
        measured: {
          totalChecks,
          successfulChecks,
          availabilityPercent,
          latencyP95Ms: row.p95 === null ? null : Math.round(row.p95),
        },
        passed: {
          availability:
            availabilityPercent === null ?
              null
            : availabilityPercent >= Number(row.availabilityTarget),
          latency:
            row.latencyP95TargetMs === null || row.p95 === null ?
              null
            : row.p95 <= row.latencyP95TargetMs,
        },
      }
    }),
  }
}

export async function upsertSlaTarget(
  serviceId: string,
  input: SlaTargetInput,
  audit: AuditContext
) {
  await getAdminServiceRow(serviceId)

  const rows = await sql<SlaTargetRow[]>`
    insert into public.status_sla_targets (
      service_id,
      availability_target,
      latency_p95_target_ms,
      exclude_maintenance,
      active
    )
    values (
      ${serviceId},
      ${input.availabilityTarget},
      ${input.latencyP95TargetMs ?? null},
      ${input.excludeMaintenance},
      ${input.active}
    )
    on conflict (service_id)
    do update set
      availability_target = excluded.availability_target,
      latency_p95_target_ms = excluded.latency_p95_target_ms,
      exclude_maintenance = excluded.exclude_maintenance,
      active = excluded.active
    returning
      id,
      service_id as "serviceId",
      (select name from public.status_services where id = service_id) as "serviceName",
      (select slug from public.status_services where id = service_id) as "serviceSlug",
      availability_target as "availabilityTarget",
      latency_p95_target_ms as "latencyP95TargetMs",
      exclude_maintenance as "excludeMaintenance",
      active,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  const target = requireRow(rows, "SLA_TARGET_SAVE_FAILED", "SLA target could not be saved.")

  await recordAuditLog({
    ...audit,
    action: "sla_target.saved",
    entityType: "sla_target",
    entityId: target.id,
  })

  return serializeSlaTarget(target)
}

export async function listPostmortems(input: ListInput) {
  const rows = await sql<PostmortemRow[]>`
    select
      p.id,
      p.incident_id as "incidentId",
      i.title as "incidentTitle",
      i.slug as "incidentSlug",
      p.summary,
      p.root_cause as "rootCause",
      p.impact,
      p.timeline,
      p.resolution,
      p.preventive_actions as "preventiveActions",
      p.follow_up_tasks as "followUpTasks",
      p.public,
      p.published_at as "publishedAt",
      p.created_by as "createdBy",
      p.created_at as "createdAt",
      p.updated_at as "updatedAt"
    from public.status_postmortems p
    join public.status_incidents i on i.id = p.incident_id
    where
      (${input.status ?? null}::text is null or (${input.status ?? ""} = 'public' and p.public = true) or (${input.status ?? ""} = 'private' and p.public = false))
      and (${input.q ?? null}::text is null or i.title ilike ${`%${input.q ?? ""}%`} or p.summary ilike ${`%${input.q ?? ""}%`})
    order by p.created_at desc
    limit ${input.limit}
    offset ${input.offset}
  `

  return {
    items: rows.map(serializePostmortem),
    limit: input.limit,
    offset: input.offset,
  }
}

export async function getPostmortem(id: string) {
  return serializePostmortem(await getPostmortemRow(id))
}

export async function upsertPostmortem(
  input: PostmortemInput,
  audit: AuditContext
) {
  await getIncidentRow(input.incidentId)

  const rows = await sql<PostmortemRow[]>`
    insert into public.status_postmortems (
      incident_id,
      summary,
      root_cause,
      impact,
      timeline,
      resolution,
      preventive_actions,
      follow_up_tasks,
      public,
      published_at,
      created_by
    )
    values (
      ${input.incidentId},
      ${input.summary},
      ${input.rootCause ?? null},
      ${input.impact ?? null},
      ${input.timeline ?? null},
      ${input.resolution ?? null},
      ${input.preventiveActions ?? null},
      ${input.followUpTasks ?? null},
      ${input.public},
      ${input.public ? new Date() : null},
      ${audit.actorId ?? null}
    )
    on conflict (incident_id)
    do update set
      summary = excluded.summary,
      root_cause = excluded.root_cause,
      impact = excluded.impact,
      timeline = excluded.timeline,
      resolution = excluded.resolution,
      preventive_actions = excluded.preventive_actions,
      follow_up_tasks = excluded.follow_up_tasks,
      public = excluded.public,
      published_at = excluded.published_at
    returning
      id,
      incident_id as "incidentId",
      (select title from public.status_incidents where id = incident_id) as "incidentTitle",
      (select slug from public.status_incidents where id = incident_id) as "incidentSlug",
      summary,
      root_cause as "rootCause",
      impact,
      timeline,
      resolution,
      preventive_actions as "preventiveActions",
      follow_up_tasks as "followUpTasks",
      public,
      published_at as "publishedAt",
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  const postmortem = requireRow(
    rows,
    "POSTMORTEM_SAVE_FAILED",
    "Postmortem could not be saved."
  )

  await recordAuditLog({
    ...audit,
    action: "postmortem.saved",
    entityType: "postmortem",
    entityId: postmortem.id,
  })

  return serializePostmortem(postmortem)
}

export async function updatePostmortem(
  id: string,
  input: UpdatePostmortemInput,
  audit: AuditContext
) {
  const current = await getPostmortemRow(id)
  const isPublishing = input.public === true && !current.public

  const rows = await sql<PostmortemRow[]>`
    update public.status_postmortems
    set
      summary = ${input.summary ?? current.summary},
      root_cause = ${input.rootCause === undefined ? current.rootCause : input.rootCause},
      impact = ${input.impact === undefined ? current.impact : input.impact},
      timeline = ${input.timeline === undefined ? current.timeline : input.timeline},
      resolution = ${input.resolution === undefined ? current.resolution : input.resolution},
      preventive_actions = ${input.preventiveActions === undefined ? current.preventiveActions : input.preventiveActions},
      follow_up_tasks = ${input.followUpTasks === undefined ? current.followUpTasks : input.followUpTasks},
      public = ${input.public ?? current.public},
      published_at = ${isPublishing ? new Date() : current.publishedAt}
    where id = ${id}
    returning
      id,
      incident_id as "incidentId",
      (select title from public.status_incidents where id = incident_id) as "incidentTitle",
      (select slug from public.status_incidents where id = incident_id) as "incidentSlug",
      summary,
      root_cause as "rootCause",
      impact,
      timeline,
      resolution,
      preventive_actions as "preventiveActions",
      follow_up_tasks as "followUpTasks",
      public,
      published_at as "publishedAt",
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `
  const postmortem = requireRow(rows, "POSTMORTEM_NOT_FOUND", "Postmortem not found.")

  await recordAuditLog({
    ...audit,
    action: "postmortem.updated",
    entityType: "postmortem",
    entityId: postmortem.id,
  })

  return serializePostmortem(postmortem)
}

export async function aggregateMonitorResults(bucketSize: "5m" | "1h" | "1d" = "1h") {
  const bucketExpression =
    bucketSize === "5m" ? "date_bin('5 minutes', checked_at, '1970-01-01'::timestamptz)"
    : bucketSize === "1h" ? "date_trunc('hour', checked_at)"
    : "date_trunc('day', checked_at)"

  const result = await sql.unsafe(
    `
      insert into public.status_monitor_aggregates (
        service_id,
        monitor_id,
        region,
        bucket_start,
        bucket_size,
        total_checks,
        success_checks,
        failed_checks,
        degraded_checks,
        avg_response_time_ms,
        p95_response_time_ms,
        p99_response_time_ms
      )
      select
        service_id,
        monitor_id,
        region,
        ${bucketExpression} as bucket_start,
        $1 as bucket_size,
        count(*)::integer as total_checks,
        count(*) filter (where status = 'success')::integer as success_checks,
        count(*) filter (where status in ('failed', 'timeout'))::integer as failed_checks,
        count(*) filter (where status = 'degraded')::integer as degraded_checks,
        avg(response_time_ms)::numeric(12,2) as avg_response_time_ms,
        (percentile_cont(0.95) within group (order by response_time_ms) filter (where response_time_ms is not null))::integer as p95_response_time_ms,
        (percentile_cont(0.99) within group (order by response_time_ms) filter (where response_time_ms is not null))::integer as p99_response_time_ms
      from public.status_monitor_results
      where checked_at >= now() - interval '32 days'
      group by service_id, monitor_id, region, bucket_start
      on conflict do nothing
    `,
    [bucketSize]
  )

  return { inserted: result.count }
}

export async function cleanupOldMonitorResults(retentionDays = 45) {
  const result = await sql`
    delete from public.status_monitor_results
    where checked_at < now() - (${retentionDays}::text || ' days')::interval
  `

  return { deleted: result.count }
}

async function listServiceRows({ publicOnly }: { publicOnly: boolean }) {
  return sql<ServiceRow[]>`
    select
      s.id,
      s.group_id as "groupId",
      g.name as "groupName",
      g.slug as "groupSlug",
      s.name,
      s.slug,
      s.description,
      s.status,
      s.display_order as "displayOrder",
      s.is_public as "isPublic",
      s.monitoring_enabled as "monitoringEnabled",
      s.created_at as "createdAt",
      s.updated_at as "updatedAt"
    from public.status_services s
    left join public.status_service_groups g on g.id = s.group_id
    where ${publicOnly} = false or s.is_public = true
    order by coalesce(g.display_order, 9999) asc, s.display_order asc, s.name asc
  `
}

async function findServiceBySlug(slug: string, { publicOnly }: { publicOnly: boolean }) {
  const rows = await sql<ServiceRow[]>`
    select
      s.id,
      s.group_id as "groupId",
      g.name as "groupName",
      g.slug as "groupSlug",
      s.name,
      s.slug,
      s.description,
      s.status,
      s.display_order as "displayOrder",
      s.is_public as "isPublic",
      s.monitoring_enabled as "monitoringEnabled",
      s.created_at as "createdAt",
      s.updated_at as "updatedAt"
    from public.status_services s
    left join public.status_service_groups g on g.id = s.group_id
    where s.slug = ${slug}
      and (${publicOnly} = false or s.is_public = true)
    limit 1
  `

  return requireRow(rows, "SERVICE_NOT_FOUND", "Service not found.")
}

async function getAdminServiceRow(id: string) {
  const rows = await sql<ServiceRow[]>`
    select
      s.id,
      s.group_id as "groupId",
      g.name as "groupName",
      g.slug as "groupSlug",
      s.name,
      s.slug,
      s.description,
      s.status,
      s.display_order as "displayOrder",
      s.is_public as "isPublic",
      s.monitoring_enabled as "monitoringEnabled",
      s.created_at as "createdAt",
      s.updated_at as "updatedAt"
    from public.status_services s
    left join public.status_service_groups g on g.id = s.group_id
    where s.id = ${id}
    limit 1
  `

  return requireRow(rows, "SERVICE_NOT_FOUND", "Service not found.")
}

async function findServiceGroupById(id: string) {
  const rows = await sql<ServiceGroupRow[]>`
    select
      id,
      name,
      slug,
      description,
      display_order as "displayOrder",
      is_public as "isPublic",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from public.status_service_groups
    where id = ${id}
    limit 1
  `

  return requireRow(rows, "SERVICE_GROUP_NOT_FOUND", "Service group not found.")
}

async function getMonitorRow(id: string) {
  const rows = await sql<MonitorRow[]>`
    select
      m.id,
      m.service_id as "serviceId",
      s.name as "serviceName",
      s.slug as "serviceSlug",
      s.status as "serviceStatus",
      m.name,
      m.check_type as "checkType",
      m.target,
      m.interval_seconds as "intervalSeconds",
      m.timeout_seconds as "timeoutSeconds",
      m.expected_status as "expectedStatus",
      m.expected_body as "expectedBody",
      m.expected_headers as "expectedHeaders",
      m.regions,
      m.retry_count as "retryCount",
      m.failure_threshold as "failureThreshold",
      m.recovery_threshold as "recoveryThreshold",
      m.consecutive_failures as "consecutiveFailures",
      m.consecutive_successes as "consecutiveSuccesses",
      m.enabled,
      m.created_at as "createdAt",
      m.updated_at as "updatedAt"
    from public.status_monitors m
    join public.status_services s on s.id = m.service_id
    where m.id = ${id}
    limit 1
  `

  return requireRow(rows, "MONITOR_NOT_FOUND", "Monitor not found.")
}

async function getIncidentRow(id: string) {
  const rows = await sql<IncidentRow[]>`
    select
      id,
      title,
      slug,
      status,
      severity,
      impact,
      created_by as "createdBy",
      detected_automatically as "detectedAutomatically",
      scheduled,
      public,
      started_at as "startedAt",
      resolved_at as "resolvedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from public.status_incidents
    where id = ${id}
    limit 1
  `

  return requireRow(rows, "INCIDENT_NOT_FOUND", "Incident not found.")
}

async function getMaintenanceRow(id: string) {
  const rows = await sql<MaintenanceRow[]>`
    select
      id,
      title,
      slug,
      description,
      status,
      start_at as "startAt",
      end_at as "endAt",
      timezone,
      public,
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from public.status_maintenance_windows
    where id = ${id}
    limit 1
  `

  return requireRow(rows, "MAINTENANCE_NOT_FOUND", "Maintenance not found.")
}

async function getPostmortemRow(id: string) {
  const rows = await sql<PostmortemRow[]>`
    select
      p.id,
      p.incident_id as "incidentId",
      i.title as "incidentTitle",
      i.slug as "incidentSlug",
      p.summary,
      p.root_cause as "rootCause",
      p.impact,
      p.timeline,
      p.resolution,
      p.preventive_actions as "preventiveActions",
      p.follow_up_tasks as "followUpTasks",
      p.public,
      p.published_at as "publishedAt",
      p.created_by as "createdBy",
      p.created_at as "createdAt",
      p.updated_at as "updatedAt"
    from public.status_postmortems p
    join public.status_incidents i on i.id = p.incident_id
    where p.id = ${id}
    limit 1
  `

  return requireRow(rows, "POSTMORTEM_NOT_FOUND", "Postmortem not found.")
}

async function listServiceDependencies(serviceId: string) {
  const rows = await sql<ServiceRow[]>`
    select
      s.id,
      s.group_id as "groupId",
      g.name as "groupName",
      g.slug as "groupSlug",
      s.name,
      s.slug,
      s.description,
      s.status,
      s.display_order as "displayOrder",
      s.is_public as "isPublic",
      s.monitoring_enabled as "monitoringEnabled",
      s.created_at as "createdAt",
      s.updated_at as "updatedAt"
    from public.status_service_dependencies d
    join public.status_services s on s.id = d.depends_on_service_id
    left join public.status_service_groups g on g.id = s.group_id
    where d.service_id = ${serviceId}
    order by s.name asc
  `

  return rows.map(serializeService)
}

async function replaceServiceDependencies(serviceId: string, dependencyServiceIds: string[]) {
  await sql.begin(async (transaction) => {
    await transaction`
      delete from public.status_service_dependencies
      where service_id = ${serviceId}
    `

    for (const dependencyServiceId of dependencyServiceIds) {
      if (dependencyServiceId === serviceId) {
        throw new StatusHttpError(
          400,
          "SERVICE_DEPENDENCY_SELF_REFERENCE",
          "A service cannot depend on itself."
        )
      }

      await getAdminServiceRow(dependencyServiceId)
      await transaction`
        insert into public.status_service_dependencies (
          service_id,
          depends_on_service_id
        )
        values (${serviceId}, ${dependencyServiceId})
        on conflict do nothing
      `
    }
  })
}

async function replaceIncidentServices(incidentId: string, serviceIds: string[]) {
  await sql.begin(async (transaction) => {
    await transaction`
      delete from public.status_incident_services
      where incident_id = ${incidentId}
    `

    for (const serviceId of serviceIds) {
      await getAdminServiceRow(serviceId)
      await transaction`
        insert into public.status_incident_services (incident_id, service_id)
        values (${incidentId}, ${serviceId})
        on conflict do nothing
      `
    }
  })
}

async function replaceMaintenanceServices(maintenanceId: string, serviceIds: string[]) {
  await sql.begin(async (transaction) => {
    await transaction`
      delete from public.status_maintenance_services
      where maintenance_id = ${maintenanceId}
    `

    for (const serviceId of serviceIds) {
      await getAdminServiceRow(serviceId)
      await transaction`
        insert into public.status_maintenance_services (maintenance_id, service_id)
        values (${maintenanceId}, ${serviceId})
        on conflict do nothing
      `
    }
  })
}

async function replaceSubscriptionServices(subscriptionId: string, serviceIds: string[]) {
  await sql.begin(async (transaction) => {
    await transaction`
      delete from public.status_subscription_services
      where subscription_id = ${subscriptionId}
    `

    for (const serviceId of serviceIds) {
      await getAdminServiceRow(serviceId)
      await transaction`
        insert into public.status_subscription_services (subscription_id, service_id)
        values (${subscriptionId}, ${serviceId})
        on conflict do nothing
      `
    }
  })
}

async function listIncidentServices(incidentId: string) {
  const rows = await sql<ServiceRow[]>`
    select
      s.id,
      s.group_id as "groupId",
      g.name as "groupName",
      g.slug as "groupSlug",
      s.name,
      s.slug,
      s.description,
      s.status,
      s.display_order as "displayOrder",
      s.is_public as "isPublic",
      s.monitoring_enabled as "monitoringEnabled",
      s.created_at as "createdAt",
      s.updated_at as "updatedAt"
    from public.status_incident_services ins
    join public.status_services s on s.id = ins.service_id
    left join public.status_service_groups g on g.id = s.group_id
    where ins.incident_id = ${incidentId}
    order by s.name asc
  `

  return rows.map(serializeService)
}

async function listMaintenanceServices(maintenanceId: string) {
  const rows = await sql<ServiceRow[]>`
    select
      s.id,
      s.group_id as "groupId",
      g.name as "groupName",
      g.slug as "groupSlug",
      s.name,
      s.slug,
      s.description,
      s.status,
      s.display_order as "displayOrder",
      s.is_public as "isPublic",
      s.monitoring_enabled as "monitoringEnabled",
      s.created_at as "createdAt",
      s.updated_at as "updatedAt"
    from public.status_maintenance_services ms
    join public.status_services s on s.id = ms.service_id
    left join public.status_service_groups g on g.id = s.group_id
    where ms.maintenance_id = ${maintenanceId}
    order by s.name asc
  `

  return rows.map(serializeService)
}

async function listIncidentUpdates(incidentId: string, publicOnly: boolean) {
  const rows = await sql<IncidentUpdateRow[]>`
    select
      id,
      incident_id as "incidentId",
      status,
      message,
      author_id as "authorId",
      public,
      created_at as "createdAt"
    from public.status_incident_updates
    where incident_id = ${incidentId}
      and (${publicOnly} = false or public = true)
    order by created_at asc
  `

  return rows.map(serializeIncidentUpdate)
}

async function createIncidentUpdate(
  incidentId: string,
  input: CreateIncidentUpdateInput
) {
  const rows = await sql<IncidentUpdateRow[]>`
    insert into public.status_incident_updates (
      incident_id,
      status,
      message,
      author_id,
      public
    )
    values (
      ${incidentId},
      ${input.status},
      ${input.message},
      ${input.authorId ?? null},
      ${input.public}
    )
    returning
      id,
      incident_id as "incidentId",
      status,
      message,
      author_id as "authorId",
      public,
      created_at as "createdAt"
  `

  return serializeIncidentUpdate(
    requireRow(rows, "INCIDENT_UPDATE_CREATE_FAILED", "Incident update could not be created.")
  )
}

async function listIncidentsForService(
  serviceId: string,
  { publicOnly }: { publicOnly: boolean }
) {
  const rows = await sql<IncidentRow[]>`
    select
      i.id,
      i.title,
      i.slug,
      i.status,
      i.severity,
      i.impact,
      i.created_by as "createdBy",
      i.detected_automatically as "detectedAutomatically",
      i.scheduled,
      i.public,
      i.started_at as "startedAt",
      i.resolved_at as "resolvedAt",
      i.created_at as "createdAt",
      i.updated_at as "updatedAt"
    from public.status_incident_services ins
    join public.status_incidents i on i.id = ins.incident_id
    where ins.service_id = ${serviceId}
      and (${publicOnly} = false or i.public = true)
    order by i.started_at desc
    limit 10
  `

  return rows.map(serializeIncident)
}

async function listMaintenanceForService(
  serviceId: string,
  { publicOnly }: { publicOnly: boolean }
) {
  const rows = await sql<MaintenanceRow[]>`
    select
      m.id,
      m.title,
      m.slug,
      m.description,
      m.status,
      m.start_at as "startAt",
      m.end_at as "endAt",
      m.timezone,
      m.public,
      m.created_by as "createdBy",
      m.created_at as "createdAt",
      m.updated_at as "updatedAt"
    from public.status_maintenance_services ms
    join public.status_maintenance_windows m on m.id = ms.maintenance_id
    where ms.service_id = ${serviceId}
      and (${publicOnly} = false or m.public = true)
    order by m.start_at desc
    limit 10
  `

  return rows.map(serializeMaintenance)
}

async function listPublicMonitorSummariesForService(serviceId: string) {
  const rows = await sql<
    {
      id: string
      name: string
      checkType: string
      regions: string[]
      enabled: boolean
      lastStatus: MonitorResultStatus | null
      lastCheckedAt: Date | null
      lastResponseTimeMs: number | null
    }[]
  >`
    select
      m.id,
      m.name,
      m.check_type as "checkType",
      m.regions,
      m.enabled,
      latest.status as "lastStatus",
      latest.checked_at as "lastCheckedAt",
      latest.response_time_ms as "lastResponseTimeMs"
    from public.status_monitors m
    left join lateral (
      select status, checked_at, response_time_ms
      from public.status_monitor_results r
      where r.monitor_id = m.id
      order by checked_at desc
      limit 1
    ) latest on true
    where m.service_id = ${serviceId}
      and m.enabled = true
    order by m.name asc
  `

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    checkType: row.checkType,
    regions: row.regions,
    enabled: row.enabled,
    lastStatus: row.lastStatus,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    lastResponseTimeMs: row.lastResponseTimeMs,
  }))
}

async function getServiceMetrics(serviceId: string) {
  const rows = await sql<
    {
      totalChecks: string
      successfulChecks: string
      p50: number | null
      p95: number | null
      p99: number | null
    }[]
  >`
    select
      count(*)::text as "totalChecks",
      count(*) filter (where status = 'success')::text as "successfulChecks",
      percentile_cont(0.5) within group (order by response_time_ms) filter (where response_time_ms is not null) as p50,
      percentile_cont(0.95) within group (order by response_time_ms) filter (where response_time_ms is not null) as p95,
      percentile_cont(0.99) within group (order by response_time_ms) filter (where response_time_ms is not null) as p99
    from public.status_monitor_results
    where service_id = ${serviceId}
      and checked_at >= now() - interval '30 days'
  `
  const row = rows[0]
  const totalChecks = Number(row?.totalChecks ?? 0)
  const successfulChecks = Number(row?.successfulChecks ?? 0)

  return {
    window: "30d",
    totalChecks,
    successfulChecks,
    availabilityPercent:
      totalChecks === 0 ? null : Number(((successfulChecks / totalChecks) * 100).toFixed(3)),
    responseTimeMs: {
      p50: row?.p50 === null || row?.p50 === undefined ? null : Math.round(row.p50),
      p95: row?.p95 === null || row?.p95 === undefined ? null : Math.round(row.p95),
      p99: row?.p99 === null || row?.p99 === undefined ? null : Math.round(row.p99),
    },
  }
}

async function listRecentResultsForService(serviceId: string, limit: number) {
  return sql<MonitorResultRow[]>`
    select
      id,
      monitor_id as "monitorId",
      service_id as "serviceId",
      region,
      status,
      http_status as "httpStatus",
      response_time_ms as "responseTimeMs",
      error_message as "errorMessage",
      checked_at as "checkedAt",
      created_at as "createdAt"
    from public.status_monitor_results
    where service_id = ${serviceId}
    order by checked_at desc
    limit ${limit}
  `
}

async function serializeIncidentWithServices(row: IncidentRow) {
  return {
    ...serializeIncident(row),
    services: await listIncidentServices(row.id),
  }
}

async function serializeMaintenanceWithServices(row: MaintenanceRow) {
  return {
    ...serializeMaintenance(row),
    services: await listMaintenanceServices(row.id),
  }
}

async function setServiceStatus(
  serviceId: string,
  newStatus: ServiceStatus,
  reason: string,
  incidentId: string | null
) {
  await sql.begin(async (transaction) => {
    await setServiceStatusInTransaction({
      transaction,
      serviceId,
      newStatus,
      reason,
      incidentId,
    })
  })
}

async function setServiceStatusInTransaction({
  transaction,
  serviceId,
  newStatus,
  reason,
  incidentId,
}: {
  transaction: StatusTransaction
  serviceId: string
  newStatus: ServiceStatus
  reason: string
  incidentId: string | null
}) {
  const serviceRows = await transaction<{ status: ServiceStatus }[]>`
    select status
    from public.status_services
    where id = ${serviceId}
    for update
  `
  const current = requireRow(serviceRows, "SERVICE_NOT_FOUND", "Service not found.")

  if (current.status === newStatus) {
    return
  }

  await transaction`
    update public.status_services
    set status = ${newStatus}
    where id = ${serviceId}
  `

  await transaction`
    insert into public.status_service_status_history (
      service_id,
      old_status,
      new_status,
      reason,
      incident_id
    )
    values (${serviceId}, ${current.status}, ${newStatus}, ${reason}, ${incidentId})
  `
}

async function ensureAutomaticIncident({
  transaction,
  serviceId,
  serviceName,
  serviceSlug,
  status,
  monitorName,
}: {
  transaction: StatusTransaction
  serviceId: string
  serviceName: string
  serviceSlug: string
  status: ServiceStatus
  monitorName: string
}) {
  const existingRows = await transaction<{ id: string }[]>`
    select i.id
    from public.status_incidents i
    join public.status_incident_services ins on ins.incident_id = i.id
    where ins.service_id = ${serviceId}
      and i.detected_automatically = true
      and i.status <> 'resolved'
    limit 1
  `

  if (existingRows[0]) {
    return
  }

  const impact = status === "major_outage" ? "major" : "degraded"
  const title =
    status === "major_outage" ?
      `${serviceName} outage detected`
    : `${serviceName} degraded performance detected`
  const slug = `${serviceSlug}-${Date.now()}`

  const incidentRows = await transaction<{ id: string }[]>`
    insert into public.status_incidents (
      title,
      slug,
      status,
      severity,
      impact,
      created_by,
      detected_automatically,
      public,
      started_at
    )
    values (
      ${title},
      ${slug},
      'investigating',
      ${status === "major_outage" ? "major" : "minor"},
      ${impact},
      'monitoring',
      true,
      true,
      now()
    )
    returning id
  `
  const incident = requireRow(
    incidentRows,
    "INCIDENT_CREATE_FAILED",
    "Automatic incident could not be created."
  )

  await transaction`
    insert into public.status_incident_services (incident_id, service_id)
    values (${incident.id}, ${serviceId})
    on conflict do nothing
  `
  await transaction`
    insert into public.status_incident_updates (
      incident_id,
      status,
      message,
      author_id,
      public
    )
    values (
      ${incident.id},
      'investigating',
      ${`Automated monitoring detected a problem from ${monitorName}. We are investigating.`},
      'monitoring',
      true
    )
  `
}

async function resolveAutomaticIncidents({
  transaction,
  serviceId,
  serviceName,
}: {
  transaction: StatusTransaction
  serviceId: string
  serviceName: string
}) {
  const incidents = await transaction<{ id: string }[]>`
    select i.id
    from public.status_incidents i
    join public.status_incident_services ins on ins.incident_id = i.id
    where ins.service_id = ${serviceId}
      and i.detected_automatically = true
      and i.status <> 'resolved'
  `

  for (const incident of incidents) {
    await transaction`
      update public.status_incidents
      set status = 'resolved', resolved_at = now()
      where id = ${incident.id}
    `
    await transaction`
      insert into public.status_incident_updates (
        incident_id,
        status,
        message,
        author_id,
        public
      )
      values (
        ${incident.id},
        'resolved',
        ${`${serviceName} has recovered and monitoring is healthy again.`},
        'monitoring',
        true
      )
    `
  }
}

async function recordAuditLog({
  actorId,
  action,
  entityType,
  entityId,
  metadata = {},
  ipAddress,
  userAgent,
}: AuditContext & {
  action: string
  entityType: string
  entityId?: string
  metadata?: Record<string, unknown>
}) {
  await sql`
    insert into public.status_audit_logs (
      actor_type,
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata,
      ip_address,
      user_agent
    )
    values (
      'admin',
      ${actorId ?? null},
      ${action},
      ${entityType},
      ${entityId ?? null},
      ${sql.json(metadata as postgres.JSONValue)},
      ${ipAddress ?? null},
      ${userAgent ?? null}
    )
  `
}

async function enqueueStatusNotifications({
  event,
  entityType,
  entityId,
  serviceIds,
  payload,
}: {
  event: string
  entityType: "incident" | "maintenance"
  entityId: string
  serviceIds: string[]
  payload: unknown
}) {
  const rows = await sql<
    {
      id: string
      type: string
      target: string
    }[]
  >`
    select
      s.id,
      s.type,
      coalesce(s.email, s.webhook_url, s.slack_webhook_url, s.teams_webhook_url, '') as target
    from public.status_subscriptions s
    where s.active = true
      and s.verified = true
      and (
        (${entityType} = 'incident' and s.incident_updates = true)
        or (${entityType} = 'maintenance' and s.maintenance_updates = true)
      )
      and (
        s.subscribed_all = true
        or exists (
          select 1
          from public.status_subscription_services ss
          where ss.subscription_id = s.id
            and ss.service_id = any(${serviceIds}::uuid[])
        )
      )
  `

  for (const row of rows) {
    await sql`
      insert into public.status_notification_deliveries (
        subscription_id,
        subscription_type,
        event,
        target,
        status,
        payload,
        headers
      )
      values (
        ${row.id},
        ${row.type},
        ${event},
        ${row.target},
        'pending',
        ${sql.json({
          event,
          entityType,
          entityId,
          data: payload,
        } as postgres.JSONValue)},
        ${sql.json({
          "x-gstfy-event": event,
        } as postgres.JSONValue)}
      )
    `
  }
}

async function uniqueIncidentSlug(title: string) {
  return uniqueSlug("status_incidents", title)
}

async function uniqueMaintenanceSlug(title: string) {
  return uniqueSlug("status_maintenance_windows", title)
}

async function uniqueSlug(tableName: "status_incidents" | "status_maintenance_windows", title: string) {
  const baseSlug = slugify(title)

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`
    const rows = await sql<{ exists: boolean }[]>`
      select exists(
        select 1
        from ${sql(tableName)}
        where slug = ${candidate}
      ) as exists
    `

    if (!rows[0]?.exists) {
      return candidate
    }
  }

  return `${baseSlug}-${Date.now()}`
}

function serviceStatusFromImpact(impact: IncidentImpact): ServiceStatus {
  switch (impact) {
    case "major":
      return "major_outage"
    case "partial":
      return "partial_outage"
    case "degraded":
      return "degraded_performance"
    case "none":
      return "operational"
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function isUuid(value: string | undefined) {
  return Boolean(
    value?.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  )
}

function latestTimestamp(values: Array<Date | string>) {
  const latest = values.reduce<Date | null>((current, value) => {
    const dateValue = value instanceof Date ? value : new Date(value)

    if (!current || dateValue.getTime() > current.getTime()) {
      return dateValue
    }

    return current
  }, null)

  return (latest ?? new Date()).toISOString()
}

function requireRow<T>(rows: readonly T[], code: string, message: string) {
  const row = rows[0]

  if (!row) {
    throw new StatusHttpError(404, code, message)
  }

  return row
}

function serializeServiceGroup(row: ServiceGroupRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    displayOrder: row.displayOrder,
    isPublic: row.isPublic,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeService(row: ServiceRow) {
  return {
    id: row.id,
    groupId: row.groupId,
    groupName: row.groupName,
    groupSlug: row.groupSlug,
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: row.status,
    displayOrder: row.displayOrder,
    isPublic: row.isPublic,
    monitoringEnabled: row.monitoringEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeMonitor(row: MonitorRow) {
  return {
    id: row.id,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    serviceSlug: row.serviceSlug,
    serviceStatus: row.serviceStatus,
    name: row.name,
    checkType: row.checkType,
    target: row.target,
    intervalSeconds: row.intervalSeconds,
    timeoutSeconds: row.timeoutSeconds,
    expectedStatus: row.expectedStatus,
    expectedBody: row.expectedBody,
    expectedHeaders: row.expectedHeaders,
    regions: row.regions,
    retryCount: row.retryCount,
    failureThreshold: row.failureThreshold,
    recoveryThreshold: row.recoveryThreshold,
    consecutiveFailures: row.consecutiveFailures,
    consecutiveSuccesses: row.consecutiveSuccesses,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeIncident(row: IncidentRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    severity: row.severity,
    impact: row.impact,
    createdBy: row.createdBy,
    detectedAutomatically: row.detectedAutomatically,
    scheduled: row.scheduled,
    public: row.public,
    startedAt: row.startedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeIncidentUpdate(row: IncidentUpdateRow) {
  return {
    id: row.id,
    incidentId: row.incidentId,
    status: row.status,
    message: row.message,
    authorId: row.authorId,
    public: row.public,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeMaintenance(row: MaintenanceRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    status: row.status,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    timezone: row.timezone,
    public: row.public,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeMonitorResult(row: MonitorResultRow) {
  return {
    id: row.id,
    monitorId: row.monitorId,
    serviceId: row.serviceId,
    region: row.region,
    status: row.status,
    httpStatus: row.httpStatus,
    responseTimeMs: row.responseTimeMs,
    error: row.errorMessage,
    checkedAt: row.checkedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeSubscription(row: SubscriptionRow) {
  return {
    id: row.id,
    type: row.type,
    email: row.email,
    webhookUrl: row.webhookUrl ? redactUrl(row.webhookUrl) : null,
    slackWebhookUrl: row.slackWebhookUrl ? redactUrl(row.slackWebhookUrl) : null,
    teamsWebhookUrl: row.teamsWebhookUrl ? redactUrl(row.teamsWebhookUrl) : null,
    verified: row.verified,
    active: row.active,
    webhookUnhealthy: row.webhookUnhealthy ?? false,
    subscribedAll: row.subscribedAll,
    incidentUpdates: row.incidentUpdates,
    maintenanceUpdates: row.maintenanceUpdates,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeAdminUser(row: AdminUserRow) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    permissions: row.permissions,
    mfaEnabled: row.mfaEnabled,
    active: row.active,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeApiKey(row: ApiKeyRow) {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: row.scopes,
    active: row.active,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeWorkerHeartbeat(row: WorkerHeartbeatRow) {
  return {
    workerId: row.workerId,
    workerType: row.workerType,
    region: row.region,
    version: row.version,
    status: row.status,
    queueName: row.queueName,
    lastSeen: row.lastSeen.toISOString(),
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeNotificationDelivery(row: NotificationDeliveryRow) {
  return {
    id: row.id,
    subscriptionId: row.subscriptionId,
    subscriptionType: row.subscriptionType,
    event: row.event,
    target: row.target,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError,
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    payload: row.payload,
    headers: row.headers,
    deliveryId: row.deliveryId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializePendingNotificationDelivery(row: PendingNotificationDeliveryRow) {
  const base = serializeNotificationDelivery(row)
  const signingSecret =
    row.webhookSecretCiphertext && row.webhookSecretIv && row.webhookSecretTag ?
      decryptSecret({
        ciphertext: row.webhookSecretCiphertext,
        iv: row.webhookSecretIv,
        tag: row.webhookSecretTag,
      })
    : null

  return {
    ...base,
    destination: {
      email: row.email,
      webhookUrl: row.webhookUrl,
      slackWebhookUrl: row.slackWebhookUrl,
      teamsWebhookUrl: row.teamsWebhookUrl,
      signingSecret,
    },
  }
}

function serializeSlaTarget(row: SlaTargetRow) {
  return {
    id: row.id,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    serviceSlug: row.serviceSlug,
    availabilityTarget: Number(row.availabilityTarget),
    latencyP95TargetMs: row.latencyP95TargetMs,
    excludeMaintenance: row.excludeMaintenance,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializePostmortem(row: PostmortemRow) {
  return {
    id: row.id,
    incidentId: row.incidentId,
    incidentTitle: row.incidentTitle,
    incidentSlug: row.incidentSlug,
    summary: row.summary,
    rootCause: row.rootCause,
    impact: row.impact,
    timeline: row.timeline,
    resolution: row.resolution,
    preventiveActions: row.preventiveActions,
    followUpTasks: row.followUpTasks,
    public: row.public,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function redactUrl(value: string) {
  try {
    const url = new URL(value)
    url.username = ""
    url.password = ""
    return url.toString()
  } catch {
    return "[redacted-url]"
  }
}
