import {
  expireAuthSessionAndRedirectToLogin,
  getStoredAuthSession,
  refreshStoredAuthSession,
  shouldRefreshAuthSession,
} from "@/lib/auth/session"

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

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(
  /\/$/,
  ""
)

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const { response, payload } = await sendApiRequest(
    path,
    options,
    await getRequestAccessToken(options.accessToken)
  )

  if (response.ok) {
    return payload as T
  }

  if (response.status === 401 && options.accessToken) {
    const refreshedSession = await refreshStoredAuthSession()

    if (refreshedSession) {
      const retryResult = await sendApiRequest(
        path,
        options,
        refreshedSession.session.accessToken
      )

      if (retryResult.response.ok) {
        return retryResult.payload as T
      }
    }

    expireAuthSessionAndRedirectToLogin()
  }

  throw new ApiError(extractErrorMessage(payload), response.status, payload)
}

async function sendApiRequest(
  path: string,
  options: RequestOptions,
  resolvedAccessToken?: string
) {
  const { body, accessToken, headers, ...restOptions } = options
  void accessToken
  const requestHeaders = {
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    ...(resolvedAccessToken ? { Authorization: `Bearer ${resolvedAccessToken}` } : {}),
    ...headers,
  }

  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...restOptions,
    credentials: "include",
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const payload = await parseResponse(response)

  return {
    response,
    payload,
  }
}

async function getRequestAccessToken(accessToken: string | undefined) {
  if (!accessToken) {
    return undefined
  }

  const storedSession = getStoredAuthSession()

  if (
    !storedSession ||
    storedSession.session.accessToken !== accessToken ||
    !shouldRefreshAuthSession(storedSession.session)
  ) {
    return accessToken
  }

  const refreshedSession = await refreshStoredAuthSession()
  return refreshedSession?.session.accessToken ?? accessToken
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
