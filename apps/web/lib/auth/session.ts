import type { AuthSession, AuthUser } from "@/lib/auth/api"

const AUTH_SESSION_STORAGE_KEY = "gstfy.auth.session"
export const AUTH_LOGGED_IN_COOKIE_NAME = "gstfy.auth.logged_in"
const AUTH_EXPIRY_SKEW_SECONDS = 30

export type StoredAuthSession = {
  isAuthenticated: true
  user: AuthUser
  session: AuthSession
}

type StoredAuthSessionInput = Omit<StoredAuthSession, "isAuthenticated">

export function getStoredAuthSession() {
  if (typeof window === "undefined") {
    return null
  }

  const rawValue = window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<StoredAuthSession>

    if (!parsedValue.user || !parsedValue.session) {
      throw new Error("Invalid auth session payload")
    }

    if (isAuthSessionExpired(parsedValue.session)) {
      clearStoredAuthSession()
      return null
    }

    return {
      isAuthenticated: true,
      user: parsedValue.user,
      session: parsedValue.session,
    }
  } catch {
    window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
    clearAuthCookie()
    return null
  }
}

export function setStoredAuthSession(value: StoredAuthSessionInput) {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.setItem(
    AUTH_SESSION_STORAGE_KEY,
    JSON.stringify({
      isAuthenticated: true,
      user: value.user,
      session: value.session,
    } satisfies StoredAuthSession)
  )
  setAuthCookie()
}

export function clearStoredAuthSession() {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
  clearAuthCookie()
}

export function expireAuthSessionAndRedirectToLogin() {
  if (typeof window === "undefined") {
    return
  }

  clearStoredAuthSession()

  const nextPath = `${window.location.pathname}${window.location.search}`
  const loginPath =
    window.location.pathname === "/ca" ||
    window.location.pathname.startsWith("/ca/clients")
      ? "/auth/ca/login"
      : "/auth/login"

  if (window.location.pathname !== loginPath) {
    window.location.replace(`${loginPath}?next=${encodeURIComponent(nextPath)}`)
  }
}

export function isAuthSessionExpired(session: Partial<AuthSession> | null | undefined) {
  if (!session?.expiresAt) {
    return false
  }

  const expiresAtMs = session.expiresAt * 1000
  return Date.now() >= expiresAtMs - AUTH_EXPIRY_SKEW_SECONDS * 1000
}

function setAuthCookie() {
  document.cookie = `${AUTH_LOGGED_IN_COOKIE_NAME}=1; path=/; SameSite=Lax`
}

function clearAuthCookie() {
  document.cookie = `${AUTH_LOGGED_IN_COOKIE_NAME}=; path=/; Max-Age=0; SameSite=Lax`
}
