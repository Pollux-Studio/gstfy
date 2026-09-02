import { timingSafeEqual } from "node:crypto"

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"

import { getEnv } from "../../config/env.js"
import { StatusHttpError } from "../../utils/http-error.js"
import {
  addIncidentUpdate,
  aggregateMonitorResults,
  cleanupOldMonitorResults,
  createAdminUser,
  createApiKey,
  createIncident,
  createMaintenance,
  createMonitor,
  createService,
  createServiceGroup,
  createSubscription,
  getAdminOverview,
  getIncidentDetail,
  getMaintenanceDetail,
  getPostmortem,
  getPublicServiceDetail,
  getPublicStatusOverview,
  getSlaReport,
  listAdminUsers,
  listApiKeys,
  listAuditLogs,
  listEnabledMonitoringMonitors,
  listIncidents,
  listMaintenance,
  listMonitors,
  listNotificationDeliveries,
  listPendingNotificationDeliveries,
  listPostmortems,
  listServiceGroups,
  listServiceGroupsWithServices,
  listServices,
  listSubscriptions,
  listWorkerHeartbeats,
  loginAdmin,
  logoutAdmin,
  markNotificationDelivered,
  markNotificationFailed,
  recordMonitorResult,
  recordWorkerHeartbeat,
  revokeApiKey,
  type StatusAdminActor,
  updateIncident,
  updateMaintenance,
  updateMonitor,
  updatePostmortem,
  updateService,
  updateServiceGroup,
  upsertPostmortem,
  upsertSlaTarget,
  validateAdminAccess,
  verifySubscription,
} from "./status.repository.js"
import {
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
  idParamSchema,
  listQuerySchema,
  monitorResultSchema,
  notificationFailureSchema,
  postmortemSchema,
  slaTargetSchema,
  slugParamSchema,
  updateIncidentSchema,
  updateMaintenanceSchema,
  updateMonitorSchema,
  updatePostmortemSchema,
  updateServiceGroupSchema,
  updateServiceSchema,
  verifySubscriptionSchema,
  workerHeartbeatSchema,
} from "./status.schemas.js"

const env = getEnv()
const adminActors = new WeakMap<FastifyRequest, StatusAdminActor>()

export async function registerStatusApiRoutes(app: FastifyInstance) {
  app.get("/status", async (_request, reply) => {
    setPublicCache(reply)
    return getPublicStatusOverview()
  })

  app.get("/services", async (_request, reply) => {
    setPublicCache(reply)
    return {
      groups: await listServiceGroupsWithServices({ publicOnly: true }),
    }
  })

  app.get("/services/:slug", async (request, reply) => {
    setPublicCache(reply)
    const params = slugParamSchema.parse(request.params)
    return getPublicServiceDetail(params.slug)
  })

  app.get("/incidents", async (request, reply) => {
    setPublicCache(reply)
    const query = listQuerySchema.parse(request.query)
    return listIncidents({ ...query, publicOnly: true })
  })

  app.get("/incidents/:slug", async (request, reply) => {
    setPublicCache(reply)
    const params = slugParamSchema.parse(request.params)
    return getIncidentDetail(params.slug, true)
  })

  app.get("/maintenance", async (request, reply) => {
    setPublicCache(reply)
    const query = listQuerySchema.parse(request.query)
    return listMaintenance({ ...query, publicOnly: true })
  })

  app.get("/maintenance/:slug", async (request, reply) => {
    setPublicCache(reply)
    const params = slugParamSchema.parse(request.params)
    return getMaintenanceDetail(params.slug, true)
  })

  app.get("/badge", async (_request, reply) => {
    const overview = await getPublicStatusOverview()
    const svg = renderStatusBadgeSvg(overview.label, overview.status)

    reply
      .header("Cache-Control", `public, max-age=${env.STATUS_PUBLIC_CACHE_SECONDS}`)
      .type("image/svg+xml")

    return svg
  })

  app.post("/subscriptions", async (request, reply) => {
    const body = createSubscriptionSchema.parse(request.body)
    const result = await createSubscription(body)

    return reply.status(201).send(result)
  })

  app.post("/subscriptions/verify", async (request) => {
    const body = verifySubscriptionSchema.parse(request.body)
    return {
      subscription: await verifySubscription(body.token),
    }
  })

  app.post("/admin/auth/login", async (request, reply) => {
    const body = adminLoginSchema.parse(request.body)
    const result = await loginAdmin(body, getAuditContext(request))

    return reply.status(201).send(result)
  })

  app.get(
    "/admin/auth/session",
    {
      preHandler: requireAdmin,
    },
    async (request) => ({
      actor: adminActors.get(request) ?? null,
    })
  )

  app.post(
    "/admin/auth/logout",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const token = requireRequestToken(request)
      return logoutAdmin(token, getAuditContext(request))
    }
  )

  app.post(
    "/monitoring/results",
    {
      preHandler: requireMonitoringToken,
    },
    async (request, reply) => {
      const body = monitorResultSchema.parse(request.body)
      const result = await recordMonitorResult(body)

      return reply.status(201).send(result)
    }
  )

  app.get(
    "/monitoring/monitors",
    {
      preHandler: requireMonitoringToken,
    },
    async (request) => {
      const query = listQuerySchema.parse(request.query)
      return listEnabledMonitoringMonitors(query.q)
    }
  )

  app.post(
    "/monitoring/heartbeats",
    {
      preHandler: requireMonitoringToken,
    },
    async (request, reply) => {
      const body = workerHeartbeatSchema.parse(request.body)
      const heartbeat = await recordWorkerHeartbeat(body)

      return reply.status(201).send({ heartbeat })
    }
  )

  app.get(
    "/worker/notifications/pending",
    {
      preHandler: requireMonitoringToken,
    },
    async (request) => {
      const query = listQuerySchema.parse(request.query)
      return listPendingNotificationDeliveries(query)
    }
  )

  app.post(
    "/worker/notifications/:id/delivered",
    {
      preHandler: requireMonitoringToken,
    },
    async (request) => {
      const params = idParamSchema.parse(request.params)
      return {
        delivery: await markNotificationDelivered(params.id),
      }
    }
  )

  app.post(
    "/worker/notifications/:id/failed",
    {
      preHandler: requireMonitoringToken,
    },
    async (request) => {
      const params = idParamSchema.parse(request.params)
      const body = notificationFailureSchema.parse(request.body)
      return {
        delivery: await markNotificationFailed(params.id, body),
      }
    }
  )

  app.get(
    "/admin/overview",
    {
      preHandler: requireAdmin,
    },
    async () => getAdminOverview()
  )

  app.get(
    "/admin/users",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const query = listQuerySchema.parse(request.query)
      return listAdminUsers(query)
    }
  )

  app.post(
    "/admin/users",
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
      const body = createAdminUserSchema.parse(request.body)
      const user = await createAdminUser(body, getAuditContext(request))

      return reply.status(201).send({ user })
    }
  )

  app.get(
    "/admin/api-keys",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const query = listQuerySchema.parse(request.query)
      return listApiKeys(query)
    }
  )

  app.post(
    "/admin/api-keys",
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
      const body = createApiKeySchema.parse(request.body)
      const apiKey = await createApiKey(body, getAuditContext(request))

      return reply.status(201).send(apiKey)
    }
  )

  app.delete(
    "/admin/api-keys/:id",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const params = idParamSchema.parse(request.params)
      return {
        apiKey: await revokeApiKey(params.id, getAuditContext(request)),
      }
    }
  )

  app.get(
    "/admin/service-groups",
    {
      preHandler: requireAdmin,
    },
    async () => ({
      items: await listServiceGroups(),
    })
  )

  app.post(
    "/admin/service-groups",
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
      const body = createServiceGroupSchema.parse(request.body)
      const serviceGroup = await createServiceGroup(body, getAuditContext(request))

      return reply.status(201).send({ serviceGroup })
    }
  )

  app.patch(
    "/admin/service-groups/:id",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const params = idParamSchema.parse(request.params)
      const body = updateServiceGroupSchema.parse(request.body)

      return {
        serviceGroup: await updateServiceGroup(params.id, body, getAuditContext(request)),
      }
    }
  )

  app.get(
    "/admin/services",
    {
      preHandler: requireAdmin,
    },
    async () => ({
      items: await listServices({ publicOnly: false }),
    })
  )

  app.post(
    "/admin/services",
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
      const body = createServiceSchema.parse(request.body)
      const service = await createService(body, getAuditContext(request))

      return reply.status(201).send({ service })
    }
  )

  app.patch(
    "/admin/services/:id",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const params = idParamSchema.parse(request.params)
      const body = updateServiceSchema.parse(request.body)

      return {
        service: await updateService(params.id, body, getAuditContext(request)),
      }
    }
  )

  app.get(
    "/admin/monitors",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const query = listQuerySchema.parse(request.query)
      return listMonitors(query)
    }
  )

  app.post(
    "/admin/monitors",
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
      const body = createMonitorSchema.parse(request.body)
      const monitor = await createMonitor(body, getAuditContext(request))

      return reply.status(201).send({ monitor })
    }
  )

  app.patch(
    "/admin/monitors/:id",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const params = idParamSchema.parse(request.params)
      const body = updateMonitorSchema.parse(request.body)

      return {
        monitor: await updateMonitor(params.id, body, getAuditContext(request)),
      }
    }
  )

  app.get(
    "/admin/incidents",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const query = listQuerySchema.parse(request.query)
      return listIncidents({ ...query, publicOnly: false })
    }
  )

  app.post(
    "/admin/incidents",
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
      const body = createIncidentSchema.parse(request.body)
      const incident = await createIncident(body, getAuditContext(request))

      return reply.status(201).send({ incident })
    }
  )

  app.get(
    "/admin/incidents/:slug",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const params = slugParamSchema.parse(request.params)
      return getIncidentDetail(params.slug, false)
    }
  )

  app.patch(
    "/admin/incidents/:id",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const params = idParamSchema.parse(request.params)
      const body = updateIncidentSchema.parse(request.body)

      return {
        incident: await updateIncident(params.id, body, getAuditContext(request)),
      }
    }
  )

  app.post(
    "/admin/incidents/:id/updates",
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
      const params = idParamSchema.parse(request.params)
      const body = createIncidentUpdateSchema.parse(request.body)
      const update = await addIncidentUpdate(params.id, body, getAuditContext(request))

      return reply.status(201).send({ update })
    }
  )

  app.get(
    "/admin/maintenance",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const query = listQuerySchema.parse(request.query)
      return listMaintenance({ ...query, publicOnly: false })
    }
  )

  app.post(
    "/admin/maintenance",
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
      const body = createMaintenanceSchema.parse(request.body)
      const maintenance = await createMaintenance(body, getAuditContext(request))

      return reply.status(201).send({ maintenance })
    }
  )

  app.get(
    "/admin/maintenance/:slug",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const params = slugParamSchema.parse(request.params)
      return getMaintenanceDetail(params.slug, false)
    }
  )

  app.patch(
    "/admin/maintenance/:id",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const params = idParamSchema.parse(request.params)
      const body = updateMaintenanceSchema.parse(request.body)

      return {
        maintenance: await updateMaintenance(params.id, body, getAuditContext(request)),
      }
    }
  )

  app.get(
    "/admin/subscriptions",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const query = listQuerySchema.parse(request.query)
      return listSubscriptions(query)
    }
  )

  app.get(
    "/admin/workers",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const query = listQuerySchema.parse(request.query)
      return listWorkerHeartbeats(query)
    }
  )

  app.get(
    "/admin/notifications",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const query = listQuerySchema.parse(request.query)
      return listNotificationDeliveries(query)
    }
  )

  app.get(
    "/admin/metrics/sla",
    {
      preHandler: requireAdmin,
    },
    async () => getSlaReport()
  )

  app.put(
    "/admin/metrics/sla/:id",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const params = idParamSchema.parse(request.params)
      const body = slaTargetSchema.parse(request.body)
      return {
        target: await upsertSlaTarget(params.id, body, getAuditContext(request)),
      }
    }
  )

  app.get(
    "/admin/postmortems",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const query = listQuerySchema.parse(request.query)
      return listPostmortems(query)
    }
  )

  app.post(
    "/admin/postmortems",
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
      const body = postmortemSchema.parse(request.body)
      const postmortem = await upsertPostmortem(body, getAuditContext(request))

      return reply.status(201).send({ postmortem })
    }
  )

  app.get(
    "/admin/postmortems/:id",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const params = idParamSchema.parse(request.params)
      return {
        postmortem: await getPostmortem(params.id),
      }
    }
  )

  app.patch(
    "/admin/postmortems/:id",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const params = idParamSchema.parse(request.params)
      const body = updatePostmortemSchema.parse(request.body)
      return {
        postmortem: await updatePostmortem(params.id, body, getAuditContext(request)),
      }
    }
  )

  app.post(
    "/admin/jobs/aggregate-monitor-results",
    {
      preHandler: requireAdmin,
    },
    async () => aggregateMonitorResults("1h")
  )

  app.post(
    "/admin/jobs/cleanup-monitor-results",
    {
      preHandler: requireAdmin,
    },
    async () => cleanupOldMonitorResults()
  )

  app.get(
    "/admin/audit-logs",
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const query = listQuerySchema.parse(request.query)
      return listAuditLogs(query)
    }
  )
}

export async function registerStatusFeedRoutes(app: FastifyInstance) {
  app.get("/rss.xml", async (_request, reply) => {
    const incidents = await listIncidents({
      limit: 20,
      offset: 0,
      publicOnly: true,
    })

    reply
      .header("Cache-Control", `public, max-age=${env.STATUS_PUBLIC_CACHE_SECONDS}`)
      .type("application/rss+xml")

    return renderRssFeed(incidents.items)
  })

  app.get("/atom.xml", async (_request, reply) => {
    const incidents = await listIncidents({
      limit: 20,
      offset: 0,
      publicOnly: true,
    })

    reply
      .header("Cache-Control", `public, max-age=${env.STATUS_PUBLIC_CACHE_SECONDS}`)
      .type("application/atom+xml")

    return renderAtomFeed(incidents.items)
  })

  app.get("/widget.js", async (_request, reply) => {
    reply
      .header("Cache-Control", `public, max-age=${env.STATUS_PUBLIC_CACHE_SECONDS}`)
      .type("application/javascript")

    return renderWidgetScript(env.STATUS_PUBLIC_BASE_URL)
  })
}

function setPublicCache(reply: FastifyReply) {
  reply.header("Cache-Control", `public, max-age=${env.STATUS_PUBLIC_CACHE_SECONDS}`)
}

async function requireAdmin(request: FastifyRequest) {
  const token = getRequestToken(request)

  if (!token) {
    throw new StatusHttpError(401, "UNAUTHORIZED", "Admin token is required.")
  }

  if (safeTokenEqual(token, env.STATUS_ADMIN_TOKEN)) {
    adminActors.set(request, {
      actorId: "status-admin-token",
      role: "static_token",
      permissions: ["admin:*"],
      authType: "static_token",
    })
    return
  }

  adminActors.set(request, await validateAdminAccess(token))
}

async function requireMonitoringToken(request: FastifyRequest) {
  const token = getRequestToken(request)

  if (!token || !safeTokenEqual(token, env.STATUS_MONITORING_TOKEN)) {
    throw new StatusHttpError(
      401,
      "UNAUTHORIZED",
      "Monitoring token is required."
    )
  }
}

function getRequestToken(request: FastifyRequest) {
  const authorization = request.headers.authorization

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim()
  }

  const adminToken = request.headers["x-status-admin-token"]
  const monitoringToken = request.headers["x-status-monitoring-token"]

  if (typeof adminToken === "string") {
    return adminToken
  }

  if (typeof monitoringToken === "string") {
    return monitoringToken
  }

  return null
}

function requireRequestToken(request: FastifyRequest) {
  const token = getRequestToken(request)

  if (!token) {
    throw new StatusHttpError(401, "UNAUTHORIZED", "Token is required.")
  }

  return token
}

function safeTokenEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function getAuditContext(request: FastifyRequest) {
  const actor = adminActors.get(request)
  const actorHeader = request.headers["x-status-admin-user"]

  return {
    actorId:
      actor?.actorId ??
      (typeof actorHeader === "string" ? actorHeader : "status-admin"),
    ipAddress: request.ip,
    userAgent:
      typeof request.headers["user-agent"] === "string" ?
        request.headers["user-agent"]
      : undefined,
  }
}

function renderStatusBadgeSvg(label: string, status: string) {
  const color =
    status === "operational" ? "#16a34a"
    : status === "degraded" || status === "maintenance" ? "#d97706"
    : status === "unknown" ? "#64748b"
    : "#dc2626"
  const safeLabel = escapeXml(label)
  const width = Math.max(180, safeLabel.length * 8 + 64)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="32" role="img" aria-label="${safeLabel}">
  <rect width="${width}" height="32" rx="16" fill="#0f172a"/>
  <circle cx="18" cy="16" r="5" fill="${color}"/>
  <text x="32" y="21" font-family="Arial, sans-serif" font-size="13" fill="#ffffff">${safeLabel}</text>
</svg>`
}

function renderRssFeed(
  incidents: Array<{
    title: string
    slug: string
    status: string
    updatedAt: string
  }>
) {
  const items = incidents
    .map(
      (incident) => `<item>
  <title>${escapeXml(incident.title)}</title>
  <link>${env.STATUS_PUBLIC_BASE_URL}/incidents/${escapeXml(incident.slug)}</link>
  <guid>${env.STATUS_PUBLIC_BASE_URL}/incidents/${escapeXml(incident.slug)}</guid>
  <pubDate>${new Date(incident.updatedAt).toUTCString()}</pubDate>
  <description>${escapeXml(`Status: ${incident.status}`)}</description>
</item>`
    )
    .join("")

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>GSTfy Status</title>
  <link>${env.STATUS_PUBLIC_BASE_URL}</link>
  <description>GSTfy incidents and maintenance updates</description>
  ${items}
</channel>
</rss>`
}

function renderAtomFeed(
  incidents: Array<{
    title: string
    slug: string
    status: string
    updatedAt: string
  }>
) {
  const updatedAt = incidents[0]?.updatedAt ?? new Date().toISOString()
  const entries = incidents
    .map(
      (incident) => `<entry>
  <title>${escapeXml(incident.title)}</title>
  <id>${env.STATUS_PUBLIC_BASE_URL}/incidents/${escapeXml(incident.slug)}</id>
  <link href="${env.STATUS_PUBLIC_BASE_URL}/incidents/${escapeXml(incident.slug)}"/>
  <updated>${incident.updatedAt}</updated>
  <summary>${escapeXml(`Status: ${incident.status}`)}</summary>
</entry>`
    )
    .join("")

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>GSTfy Status</title>
  <id>${env.STATUS_PUBLIC_BASE_URL}</id>
  <updated>${updatedAt}</updated>
  ${entries}
</feed>`
}

function renderWidgetScript(baseUrl: string) {
  const escapedBaseUrl = JSON.stringify(baseUrl)

  return `(function(){
  var scripts = document.getElementsByTagName('script');
  var script = scripts[scripts.length - 1];
  var root = document.createElement('span');
  root.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font:13px system-ui,sans-serif;color:#0f172a';
  root.textContent = 'GSTfy status loading...';
  script.parentNode.insertBefore(root, script);
  fetch(${escapedBaseUrl} + '/api/v1/status')
    .then(function(response){ return response.json(); })
    .then(function(data){
      var color = data.status === 'operational' ? '#16a34a' : data.status === 'unknown' ? '#64748b' : '#dc2626';
      root.innerHTML = '<span style="width:8px;height:8px;border-radius:999px;background:' + color + ';display:inline-block"></span><span>GSTfy ' + data.label + '</span>';
    })
    .catch(function(){
      root.textContent = 'GSTfy status unavailable';
    });
})();`
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
