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
  timeoutMs?: number
  retry?: false | number
}

type ApiRequestResult = {
  response: Response
  payload: unknown
}

const inFlightGetRequests = new Map<string, Promise<ApiRequestResult>>()

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
  const { body, accessToken, headers, retry, timeoutMs, ...restOptions } = options
  void accessToken
  const requestHeaders = new Headers(headers)
  const method = (restOptions.method ?? "GET").toUpperCase()
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData
  const bodyIdempotencyKey = getBodyIdempotencyKey(body)

  if (body !== undefined && !isFormData) {
    requestHeaders.set("Content-Type", "application/json")
  }

  if (bodyIdempotencyKey && !requestHeaders.has("Idempotency-Key")) {
    requestHeaders.set("Idempotency-Key", bodyIdempotencyKey)
  }

  if (resolvedAccessToken) {
    requestHeaders.set("Authorization", `Bearer ${resolvedAccessToken}`)
  }

  for (const [key, value] of Object.entries(getTenantHeaders())) {
    requestHeaders.set(key, value)
  }

  const url = `${API_BASE_URL}${API_BASE_PATH}${path}`
  const init: RequestInit = {
    ...restOptions,
    method,
    credentials: "include",
    headers: requestHeaders,
    body:
      body === undefined ? undefined
      : isFormData ? body
      : JSON.stringify(body),
  }

  if (method === "GET" && body === undefined) {
    const requestKey = createInFlightGetRequestKey(url, requestHeaders)
    const existingRequest = inFlightGetRequests.get(requestKey)

    if (existingRequest) {
      return existingRequest
    }

    const requestPromise = executeApiFetch(url, init, {
      method,
      retry,
      timeoutMs,
      idempotent: true,
    }).finally(() => {
      inFlightGetRequests.delete(requestKey)
    })

    inFlightGetRequests.set(requestKey, requestPromise)
    return requestPromise
  }

  return executeApiFetch(url, init, {
    method,
    retry,
    timeoutMs,
    idempotent: Boolean(bodyIdempotencyKey || requestHeaders.has("Idempotency-Key")),
  })
}

async function executeApiFetch(
  url: string,
  init: RequestInit,
  config: {
    method: string
    retry: RequestOptions["retry"]
    timeoutMs: number | undefined
    idempotent: boolean
  }
): Promise<ApiRequestResult> {
  const retryCount = getRetryCount(config)
  let lastResult: ApiRequestResult | null = null
  let lastError: unknown = null

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        url,
        init,
        config.timeoutMs ?? getDefaultTimeoutMs(config.method, init.body)
      )
      const payload = await parseResponse(response)
      const result = { response, payload }

      if (!shouldRetryResponse(response, attempt, retryCount, config.idempotent)) {
        return result
      }

      lastResult = result
    } catch (error) {
      lastError = error

      if (!shouldRetryError(error, attempt, retryCount, config.idempotent)) {
        throw normalizeFetchError(error)
      }
    }

    await sleep(getRetryDelayMs(attempt))
  }

  if (lastResult) {
    return lastResult
  }

  throw normalizeFetchError(lastError)
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController()
  const parentSignal = init.signal
  let timedOut = false
  let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const abortFromParent = () => controller.abort()

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort()
    } else {
      parentSignal.addEventListener("abort", abortFromParent, { once: true })
    }
  }

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (timedOut) {
      throw new ApiError("Request timed out. Please try again.", 408, {
        timeoutMs,
      })
    }

    throw error
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    parentSignal?.removeEventListener("abort", abortFromParent)
  }
}

function getRetryCount(config: {
  method: string
  retry: RequestOptions["retry"]
  idempotent: boolean
}) {
  if (config.retry === false) {
    return 0
  }

  if (typeof config.retry === "number") {
    return Math.max(Math.floor(config.retry), 0)
  }

  if (!config.idempotent) {
    return 0
  }

  return config.method === "GET" || config.method === "HEAD" ? 1 : 1
}

function shouldRetryResponse(
  response: Response,
  attempt: number,
  retryCount: number,
  idempotent: boolean
) {
  if (!idempotent || attempt >= retryCount) {
    return false
  }

  return response.status === 408 || response.status === 429 || response.status >= 500
}

function shouldRetryError(
  error: unknown,
  attempt: number,
  retryCount: number,
  idempotent: boolean
) {
  if (!idempotent || attempt >= retryCount) {
    return false
  }

  if (error instanceof ApiError) {
    return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500
  }

  return true
}

function normalizeFetchError(error: unknown) {
  if (error instanceof ApiError) {
    return error
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new ApiError("Request was cancelled. Please try again.", 499)
  }

  return new ApiError("Network error. Check your connection and try again.", 0)
}

function getDefaultTimeoutMs(method: string, body: BodyInit | null | undefined) {
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return 60_000
  }

  if (method === "GET" || method === "HEAD") {
    return 12_000
  }

  return 25_000
}

function getRetryDelayMs(attempt: number) {
  const baseDelayMs = 400 * 2 ** attempt
  const jitterMs = Math.floor(Math.random() * 150)
  return baseDelayMs + jitterMs
}

function sleep(durationMs: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, durationMs))
}

function getBodyIdempotencyKey(body: unknown) {
  if (
    !body ||
    typeof body !== "object" ||
    (typeof FormData !== "undefined" && body instanceof FormData)
  ) {
    return null
  }

  if (!("idempotencyKey" in body)) {
    return null
  }

  const value = (body as Record<string, unknown>).idempotencyKey
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function createInFlightGetRequestKey(url: string, headers: Headers) {
  return [
    url,
    headers.get("Authorization") ?? "",
    headers.get("X-GSTFY-Tenant") ?? "",
  ].join("|")
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

  if (storedSession && storedSession.session.accessToken !== accessToken) {
    return storedSession.session.accessToken
  }

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
