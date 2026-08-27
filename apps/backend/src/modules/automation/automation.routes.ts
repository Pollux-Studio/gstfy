import { and, eq } from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { db } from "../../db/client.js"
import { automationJobs } from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import {
  assertCanManageBusiness,
  requirePrimaryBusinessAccess,
} from "../businesses/business-access.js"
import { enqueueAutomationJob } from "./automation.queue.js"
import {
  ensureAutomationSettings,
  listAutomationJobs,
  updateAutomationSettings,
} from "./automation.repository.js"
import {
  automationJobParamsSchema,
  automationSettingsPayloadSchema,
  listAutomationJobsQuerySchema,
} from "./automation.schemas.js"
import type { AutomationJobType } from "./automation.types.js"

export async function registerAutomationRoutes(app: FastifyInstance) {
  app.get("/automation/settings", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)

    return {
      settings: await ensureAutomationSettings(access.business.id),
    }
  })

  app.patch("/automation/settings", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)
    const body = automationSettingsPayloadSchema.parse(request.body)

    return {
      settings: await updateAutomationSettings(access.business.id, body),
    }
  })

  app.get("/automation/jobs", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const query = listAutomationJobsQuerySchema.parse(request.query)

    return {
      jobs: await listAutomationJobs(access.business.id, query),
    }
  })

  app.post("/automation/jobs/:id/retry", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)
    const { id } = automationJobParamsSchema.parse(request.params)
    const job = await db.query.automationJobs.findFirst({
      where: and(
        eq(automationJobs.businessId, access.business.id),
        eq(automationJobs.id, id)
      ),
    })

    if (!job) {
      throw new HttpError(404, "Automation job not found.")
    }

    if (job.status !== "failed" && job.status !== "retry_scheduled") {
      throw new HttpError(409, "Only failed automation jobs can be retried.")
    }

    const queued = await enqueueAutomationJob(
      {
        businessId: access.business.id,
        jobType: job.jobType as AutomationJobType,
        sourceType: job.sourceType,
        sourceId: job.sourceId,
        payload: toPayloadRecord(job.payload),
        createdBy: access.userId,
        priority: job.priority,
        maxAttempts: job.maxAttempts,
      },
      request.log
    )

    return {
      job: queued,
    }
  })
}

function toPayloadRecord(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {}
  }

  return payload as Record<string, unknown>
}
