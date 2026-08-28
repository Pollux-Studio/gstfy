import type { FastifyInstance } from "fastify"

import { getServiceHealth } from "./service-status.service.js"

export async function registerServiceStatusRoutes(app: FastifyInstance) {
  app.get("/health/services", async (_request, reply) => {
    reply.header("Cache-Control", "no-store")
    return getServiceHealth()
  })
}
