import type { FastifyInstance } from "fastify"
import { ZodError } from "zod"

import { isStatusHttpError } from "./http-error.js"

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (isStatusHttpError(error)) {
      request.log.warn(
        {
          requestId: request.id,
          method: request.method,
          url: request.url,
          statusCode: error.statusCode,
          code: error.code,
        },
        "status request rejected"
      )

      void reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      })
      return
    }

    if (error instanceof ZodError) {
      request.log.warn(
        {
          requestId: request.id,
          method: request.method,
          url: request.url,
          statusCode: 400,
          issues: error.issues,
        },
        "status request validation failed"
      )

      void reply.status(400).send({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid request payload.",
          details: {
            issues: error.issues,
          },
        },
      })
      return
    }

    request.log.error(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        err: error,
      },
      "status request failed"
    )

    void reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Please try again.",
      },
    })
  })
}
