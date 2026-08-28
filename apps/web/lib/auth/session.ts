import type { AuthSession, AuthTenant, AuthUser } from "@/lib/auth/api"
import { API_BASE_PATH, API_BASE_URL } from "@/lib/api/config"
import { getAuthSubdomainUrl } from "@/lib/auth/workspace-url"

const AUTH_SESSION_STORAGE_KEY = "gstfy.auth.session"
export const AUTH_SESSION_CHANGE_EVENT = "gstfy.auth.session_changed"
export const AUTH_LOGGED_IN_COOKIE_NAME = "gstfy.auth.logged_in"
export const AUTH_ACCOUNT_TYPE_COOKIE_NAME = "gstfy.auth.account_type"
const AUTH_REFRESH_BEFORE_EXPIRY_SECONDS = 60
const AUTH_REFRESH_TIMEOUT_MS = 10_000

export type AuthAccountType = "business" | "ca"
export type StoredAuthTenant = Pick<AuthTenant, "id" | "slug"> &
  Partial<Pick<AuthTenant, "legalName" | "tradeName" | "url">>

export type StoredAuthSession = {
  isAuthenticated: true
  accountType: AuthAccountType
  user: AuthUser
  session: AuthSession
  tenant?: StoredAuthTenant | null
}

type StoredAuthSessionInput = {
  user: AuthUser
  session: AuthSession
  accountType?: AuthAccountType
  tenant?: StoredAuthTenant | null
}

type RefreshSessionResponse = {
  user: {
    id: string
    mustChangePassword?: boolean
  }
  accountType?: AuthAccountType
  accessToken: string
  accessTokenExpiresIn: number
  tenant?: Pick<AuthTenant, "id" | "slug"> | null
}

let activeRefreshPromise: Promise<StoredAuthSession | null> | null = null
let cachedSessionRawValue: string | null = null
let cachedStoredAuthSession: StoredAuthSession | null = null

export function getStoredAuthSession(): StoredAuthSession | null {
  if (typeof window === "undefined") {
    return null
  }

  const rawValue = window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)

  if (!rawValue) {
    cachedSessionRawValue = null
    cachedStoredAuthSession = null
    return null
  }

  if (rawValue === cachedSessionRawValue) {
    return cachedStoredAuthSession
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<StoredAuthSession>

    if (!parsedValue.user || !parsedValue.session) {
      throw new Error("Invalid auth session payload")
    }

    const nextSession: StoredAuthSession = {
      isAuthenticated: true,
      accountType: getSafeAccountType(parsedValue.accountType) ?? "business",
      user: {
        ...parsedValue.user,
        mustChangePassword: Boolean(parsedValue.user.mustChangePassword),
      },
      session: parsedValue.session,
      tenant: parsedValue.tenant ?? null,
    }

    cachedSessionRawValue = rawValue
    cachedStoredAuthSession = nextSession

    return nextSession
  } catch {
    window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
    cachedSessionRawValue = null
    cachedStoredAuthSession = null
    clearAuthCookie()
    return null
  }
}

export function subscribeToAuthSessionChange(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {}
  }

  window.addEventListener(AUTH_SESSION_CHANGE_EVENT, callback)

  return () => {
    window.removeEventListener(AUTH_SESSION_CHANGE_EVENT, callback)
  }
}

export function refreshStoredAuthSession() {
  if (!activeRefreshPromise) {
    activeRefreshPromise = refreshAuthSession().finally(() => {
      activeRefreshPromise = null
    })
  }

  return activeRefreshPromise
}

export function setStoredAuthSession(value: StoredAuthSessionInput) {
  if (typeof window === "undefined") {
    return
  }

  const nextSession = {
    isAuthenticated: true,
    accountType: value.accountType ?? "business",
    user: value.user,
    session: value.session,
    tenant: value.tenant ?? null,
  } satisfies StoredAuthSession
  const rawValue = JSON.stringify(nextSession)

  window.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, rawValue)
  cachedSessionRawValue = rawValue
  cachedStoredAuthSession = nextSession
  setAuthCookie(value.accountType ?? "business")
  notifyAuthSessionChange()
}

export function clearStoredAuthSession() {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
  cachedSessionRawValue = null
  cachedStoredAuthSession = null
  clearAuthCookie()
  notifyAuthSessionChange()
}

export function expireAuthSessionAndRedirectToLogin() {
  if (typeof window === "undefined") {
    return
  }

  clearStoredAuthSession()

  const nextPath = `${window.location.pathname}${window.location.search}`
  const hostname = window.location.hostname.toLowerCase()
  const isCaPath =
    hostname.startsWith("ca.") ||
    window.location.pathname === "/ca" ||
    window.location.pathname.startsWith("/ca/clients") ||
    window.location.pathname.startsWith("/ca/referral-codes") ||
    window.location.pathname.startsWith("/dashboard/clients") ||
    window.location.pathname.startsWith("/dashboard/referral-codes")
  const loginPath = isCaPath ? getAuthSubdomainUrl("/auth/ca/login") : "/auth/login"
  const isAlreadyOnLogin =
    isCaPath ? window.location.href.startsWith(loginPath) : window.location.pathname === loginPath

  if (!isAlreadyOnLogin) {
    window.location.replace(`${loginPath}?next=${encodeURIComponent(nextPath)}`)
  }
}

export function isAuthSessionExpired(session: Partial<AuthSession> | null | undefined) {
  if (!session?.expiresAt) {
    return false
  }

  const expiresAtMs = session.expiresAt * 1000
  return Date.now() >= expiresAtMs
}

export function shouldRefreshAuthSession(
  session: Partial<AuthSession> | null | undefined
) {
  const delayMs = getAuthRefreshDelayMs(session)
  return delayMs !== null && delayMs <= 0
}

export function getAuthRefreshDelayMs(
  session: Partial<AuthSession> | null | undefined
) {
  if (!session?.expiresAt) {
    return null
  }

  return session.expiresAt * 1000 - Date.now() - AUTH_REFRESH_BEFORE_EXPIRY_SECONDS * 1000
}

async function refreshAuthSession() {
  const currentSession = getStoredAuthSession()

  try {
    const response = await fetchAuthSessionWithTimeout()

    if (!response.ok) {
      if (response.status === 401) {
        clearStoredAuthSession()
      }

      return null
    }

    const payload = (await response.json()) as RefreshSessionResponse
    const payloadAccountType = getSafeAccountType(payload.accountType)
    const accountType =
      currentSession?.accountType ??
      payloadAccountType ??
      getStoredAccountTypeCookie() ??
      inferAccountTypeFromLocation()
    const currentUser = currentSession?.user
    const nextSession: StoredAuthSessionInput = {
      accountType,
      user: {
        id: payload.user.id,
        email: currentUser?.email ?? null,
        phone: currentUser?.phone ?? null,
        profileImageSeed: currentUser?.profileImageSeed ?? null,
        profileImageStyle: currentUser?.profileImageStyle,
        mustChangePassword: Boolean(payload.user.mustChangePassword),
      },
      session: {
        accessToken: payload.accessToken,
        expiresAt: Math.floor(Date.now() / 1000) + payload.accessTokenExpiresIn,
      },
      tenant: payload.tenant ?
        {
          id: payload.tenant.id,
          slug: payload.tenant.slug,
        }
      : null,
    }

    setStoredAuthSession(nextSession)

    return {
      isAuthenticated: true,
      accountType: nextSession.accountType ?? "business",
      user: nextSession.user,
      session: nextSession.session,
      tenant: nextSession.tenant ?? null,
    } satisfies StoredAuthSession
  } catch {
    return null
  }
}

async function fetchAuthSessionWithTimeout() {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, AUTH_REFRESH_TIMEOUT_MS)

  try {
    return await fetch(`${API_BASE_URL}${API_BASE_PATH}/auth/session`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

function inferAccountTypeFromLocation(): AuthAccountType {
  if (typeof window === "undefined") {
    return "business"
  }

  const hostname = window.location.hostname.toLowerCase()
  const pathname = window.location.pathname

  return (
    hostname.startsWith("ca.") ||
    pathname === "/ca" ||
    pathname.startsWith("/ca/") ||
    pathname === "/auth/ca" ||
    pathname.startsWith("/auth/ca/") ||
    pathname.startsWith("/dashboard/clients") ||
    pathname.startsWith("/dashboard/referral-codes")
  )
    ? "ca"
    : "business"
}

function getSafeAccountType(value: unknown): AuthAccountType | null {
  return value === "ca" || value === "business" ? value : null
}

function getStoredAccountTypeCookie(): AuthAccountType | null {
  if (typeof document === "undefined") {
    return null
  }

  const accountTypeCookie = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${AUTH_ACCOUNT_TYPE_COOKIE_NAME}=`))

  if (!accountTypeCookie) {
    return null
  }

  try {
    return getSafeAccountType(
      decodeURIComponent(accountTypeCookie.split("=").slice(1).join("="))
    )
  } catch {
    return null
  }
}

function setAuthCookie(accountType: AuthAccountType) {
  document.cookie = `${AUTH_LOGGED_IN_COOKIE_NAME}=1; path=/; SameSite=Lax`
  document.cookie = `${AUTH_ACCOUNT_TYPE_COOKIE_NAME}=${accountType}; path=/; SameSite=Lax`
}

function clearAuthCookie() {
  document.cookie = `${AUTH_LOGGED_IN_COOKIE_NAME}=; path=/; Max-Age=0; SameSite=Lax`
  document.cookie = `${AUTH_ACCOUNT_TYPE_COOKIE_NAME}=; path=/; Max-Age=0; SameSite=Lax`
}

function notifyAuthSessionChange() {
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGE_EVENT))
}
