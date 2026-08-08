export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown
  accessToken?: string
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(
  /\/$/,
  ""
)

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const { body, accessToken, headers, ...restOptions } = options
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const payload = await parseResponse(response)

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(payload), response.status, payload)
  }

  return payload as T
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? ""

  if (!contentType.includes("application/json")) {
    return null
  }

  return response.json()
}

function extractErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    Array.isArray(payload.message) &&
    typeof payload.message[0] === "string"
  ) {
    return payload.message[0]
  }

  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message
  }

  return "Something went wrong. Please try again."
}
