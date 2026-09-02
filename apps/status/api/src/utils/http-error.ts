export class StatusHttpError extends Error {
  readonly code: string
  readonly details?: Record<string, unknown>
  readonly statusCode: number

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = "StatusHttpError"
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export function isStatusHttpError(error: unknown): error is StatusHttpError {
  return error instanceof StatusHttpError
}
