import type { FastifyInstance } from "fastify"
import { ZodError } from "zod"

import { getEnv } from "../config/env.js"
import { isHttpError } from "./http-error.js"

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (isHttpError(error)) {
      request.log.warn(
        {
          requestId: request.id,
          method: request.method,
          url: request.url,
          statusCode: error.statusCode,
          message: error.message,
        },
        "request rejected"
      )
      void reply.status(error.statusCode).send({
        message: error.message,
        ...(error.details ?? {}),
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
        "request validation failed"
      )
      void reply.status(400).send({
        message: "Invalid request payload.",
        issues: error.issues,
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
      "request failed with unexpected error"
    )

    const env = getEnv()
    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong. Please try again."

    void reply.status(500).send({
      message:
        env.NODE_ENV === "development" ?
          errorMessage
        : "Something went wrong. Please try again.",
    })
  })
}
