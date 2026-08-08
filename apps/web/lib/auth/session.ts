import type { AuthSession, AuthUser } from "@/lib/auth/api"

const AUTH_SESSION_STORAGE_KEY = "gstfy.auth.session"

export type StoredAuthSession = {
  user: AuthUser
  session: AuthSession
}

export function getStoredAuthSession() {
  if (typeof window === "undefined") {
    return null
  }

  const rawValue = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as StoredAuthSession
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
    return null
  }
}

export function setStoredAuthSession(value: StoredAuthSession) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(value))
}

export function clearStoredAuthSession() {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
}
