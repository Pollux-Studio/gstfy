export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = "HttpError"
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError
}
