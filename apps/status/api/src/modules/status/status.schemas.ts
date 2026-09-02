import { z } from "zod"

import {
  incidentImpacts,
  incidentSeverities,
  incidentStatuses,
  maintenanceStatuses,
  monitorCheckTypes,
  monitorResultStatuses,
  serviceStatuses,
  subscriptionTypes,
} from "./status.domain.js"

const optionalText = z
  .union([z.string().trim().min(1), z.literal("")])
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().date())

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
})

export const slugParamSchema = z.object({
  slug: z.string().trim().min(1),
})

export const idParamSchema = z.object({
  id: z.string().uuid(),
})

export const createServiceGroupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(140).optional(),
  description: optionalText,
  displayOrder: z.coerce.number().int().default(0),
  isPublic: z.boolean().default(true),
})

export const updateServiceGroupSchema = createServiceGroupSchema.partial()

export const createServiceSchema = z.object({
  groupId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(140).optional(),
  description: optionalText,
  status: z.enum(serviceStatuses).default("operational"),
  displayOrder: z.coerce.number().int().default(0),
  isPublic: z.boolean().default(true),
  monitoringEnabled: z.boolean().default(true),
  dependencyServiceIds: z.array(z.string().uuid()).default([]),
})

export const updateServiceSchema = createServiceSchema.partial()

export const createMonitorSchema = z.object({
  serviceId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  checkType: z.enum(monitorCheckTypes),
  target: z.string().trim().min(1).max(2048),
  intervalSeconds: z.coerce
    .number()
    .int()
    .refine((value) => [60, 300, 600, 900, 1800, 3600].includes(value), {
      message: "Interval must be one of 60, 300, 600, 900, 1800, or 3600 seconds.",
    })
    .default(300),
  timeoutSeconds: z.coerce.number().int().positive().max(120).default(10),
  expectedStatus: z.coerce.number().int().min(100).max(599).nullable().optional(),
  expectedBody: optionalText,
  expectedHeaders: z.record(z.string(), z.string()).default({}),
  regions: z.array(z.string().trim().min(2)).min(1).default(["india"]),
  retryCount: z.coerce.number().int().min(0).max(10).default(1),
  failureThreshold: z.coerce.number().int().positive().max(20).default(3),
  recoveryThreshold: z.coerce.number().int().positive().max(20).default(3),
  enabled: z.boolean().default(true),
})

export const updateMonitorSchema = createMonitorSchema.partial()

export const createIncidentSchema = z.object({
  title: z.string().trim().min(3).max(180),
  slug: z.string().trim().min(3).max(220).optional(),
  status: z.enum(incidentStatuses).default("investigating"),
  severity: z.enum(incidentSeverities).default("minor"),
  impact: z.enum(incidentImpacts).default("degraded"),
  createdBy: z.string().trim().min(1).max(120).optional(),
  detectedAutomatically: z.boolean().default(false),
  public: z.boolean().default(true),
  startedAt: isoDate.optional(),
  serviceIds: z.array(z.string().uuid()).default([]),
  message: z.string().trim().min(1).max(5000).optional(),
})

export const updateIncidentSchema = z.object({
  title: z.string().trim().min(3).max(180).optional(),
  status: z.enum(incidentStatuses).optional(),
  severity: z.enum(incidentSeverities).optional(),
  impact: z.enum(incidentImpacts).optional(),
  public: z.boolean().optional(),
  resolvedAt: isoDate.nullable().optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
})

export const createIncidentUpdateSchema = z.object({
  status: z.enum(incidentStatuses),
  message: z.string().trim().min(1).max(5000),
  authorId: z.string().trim().min(1).max(120).optional(),
  public: z.boolean().default(true),
})

export const createMaintenanceSchema = z.object({
  title: z.string().trim().min(3).max(180),
  slug: z.string().trim().min(3).max(220).optional(),
  description: z.string().trim().min(1).max(5000).nullable().optional(),
  status: z.enum(maintenanceStatuses).default("scheduled"),
  startAt: isoDate,
  endAt: isoDate,
  timezone: z.string().trim().min(1).default("Asia/Kolkata"),
  public: z.boolean().default(true),
  createdBy: z.string().trim().min(1).max(120).optional(),
  serviceIds: z.array(z.string().uuid()).default([]),
})

export const updateMaintenanceSchema = createMaintenanceSchema.partial()

export const createSubscriptionSchema = z
  .object({
    type: z.enum(subscriptionTypes),
    email: z.string().trim().email().nullable().optional(),
    webhookUrl: z.string().trim().url().nullable().optional(),
    slackWebhookUrl: z.string().trim().url().nullable().optional(),
    teamsWebhookUrl: z.string().trim().url().nullable().optional(),
    subscribedAll: z.boolean().default(true),
    incidentUpdates: z.boolean().default(true),
    maintenanceUpdates: z.boolean().default(true),
    serviceIds: z.array(z.string().uuid()).default([]),
  })
  .superRefine((value, ctx) => {
    const hasDestination =
      (value.type === "email" && value.email) ||
      (value.type === "webhook" && value.webhookUrl) ||
      (value.type === "slack" && value.slackWebhookUrl) ||
      (value.type === "teams" && value.teamsWebhookUrl)

    if (!hasDestination) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [value.type === "email" ? "email" : `${value.type}WebhookUrl`],
        message: "A destination is required for this subscription type.",
      })
    }
  })

export const verifySubscriptionSchema = z.object({
  token: z.string().trim().min(24),
})

export const monitorResultSchema = z.object({
  monitorId: z.string().uuid(),
  region: z.string().trim().min(2).max(80),
  status: z.enum(monitorResultStatuses),
  httpStatus: z.coerce.number().int().min(100).max(599).nullable().optional(),
  responseTimeMs: z.coerce.number().int().min(0).nullable().optional(),
  error: z.string().trim().max(2000).nullable().optional(),
  checkedAt: isoDate.optional(),
})

export const adminLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
})

export const createAdminUserSchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(200),
  role: z
    .enum(["owner", "admin", "incident_manager", "viewer"])
    .default("admin"),
  permissions: z.array(z.string().trim().min(1).max(120)).default([]),
})

export const createApiKeySchema = z.object({
  name: z.string().trim().min(2).max(120),
  scopes: z.array(z.string().trim().min(1).max(120)).default(["admin:*"]),
  expiresAt: isoDate.nullable().optional(),
})

export const workerHeartbeatSchema = z.object({
  workerId: z.string().trim().min(2).max(160),
  workerType: z.enum(["monitoring", "incident-engine", "notifications"]),
  region: z.string().trim().min(2).max(80),
  version: z.string().trim().min(1).max(80),
  status: z.enum(["starting", "healthy", "degraded", "stopped"]),
  queueName: z.string().trim().min(1).max(160).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export const slaTargetSchema = z.object({
  availabilityTarget: z.coerce.number().positive().max(100).default(99.9),
  latencyP95TargetMs: z.coerce.number().int().positive().nullable().optional(),
  excludeMaintenance: z.boolean().default(true),
  active: z.boolean().default(true),
})

export const postmortemSchema = z.object({
  incidentId: z.string().uuid(),
  summary: z.string().trim().min(10).max(10000),
  rootCause: optionalText,
  impact: optionalText,
  timeline: optionalText,
  resolution: optionalText,
  preventiveActions: optionalText,
  followUpTasks: optionalText,
  public: z.boolean().default(false),
})

export const updatePostmortemSchema = postmortemSchema
  .omit({ incidentId: true })
  .partial()

export const notificationFailureSchema = z.object({
  error: z.string().trim().min(1).max(4000),
})
