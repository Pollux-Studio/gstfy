import {
  expireAuthSessionAndRedirectToLogin,
  getStoredAuthSession,
  refreshStoredAuthSession,
  shouldRefreshAuthSession,
} from "@/lib/auth/session"
import { API_BASE_PATH, API_BASE_URL } from "@/lib/api/config"

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
  const requestHeaders = new Headers(headers)
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData

  if (body !== undefined && !isFormData) {
    requestHeaders.set("Content-Type", "application/json")
  }

  if (resolvedAccessToken) {
    requestHeaders.set("Authorization", `Bearer ${resolvedAccessToken}`)
  }

  for (const [key, value] of Object.entries(getTenantHeaders())) {
    requestHeaders.set(key, value)
  }

  const response = await fetch(`${API_BASE_URL}${API_BASE_PATH}${path}`, {
    ...restOptions,
    credentials: "include",
    headers: requestHeaders,
    body:
      body === undefined ? undefined
      : isFormData ? body
      : JSON.stringify(body),
  })

  const payload = await parseResponse(response)

  return {
    response,
    payload,
  }
}

function getTenantHeaders(): Record<string, string> {
  const tenantSlug = getTenantSlugFromLocation() ?? getStoredAuthSession()?.tenant?.slug

  return tenantSlug ? { "X-GSTFY-Tenant": tenantSlug } : {}
}

function getTenantSlugFromLocation() {
  if (typeof window === "undefined") {
    return null
  }

  const hostname = window.location.hostname.toLowerCase()

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  ) {
    return null
  }

  const [subdomain, ...domainParts] = hostname.split(".")

  if (!subdomain) {
    return null
  }

  const parentDomain = domainParts.join(".")

  if (parentDomain !== "localhost" && domainParts.length < 2) {
    return null
  }

  if (["api", "app", "auth", "ca", "www"].includes(subdomain)) {
    return null
  }

  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(subdomain)) {
    return null
  }

  return subdomain
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
