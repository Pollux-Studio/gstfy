import type { AppEnv } from "../config/env.js"
import { getEnv } from "../config/env.js"

export function getTenantUrl(tenantSlug: string, env: AppEnv = getEnv()) {
  const normalizedTenantSlug = tenantSlug.trim().toLowerCase()
  const baseDomain = getBaseDomain(env.APP_BASE_DOMAIN)

  if (!normalizedTenantSlug || !baseDomain) {
    return ""
  }

  const protocol =
    getProtocol(env.APP_BASE_DOMAIN) ?? getProtocol(env.WEB_ORIGIN) ?? "https:"

  return `${protocol}//${normalizedTenantSlug}.${baseDomain}`
}

export function getAuthUrl(path = "", env: AppEnv = getEnv()) {
  const baseDomain = getBaseDomain(env.APP_BASE_DOMAIN)

  if (!baseDomain) {
    return path || env.WEB_ORIGIN
  }

  const protocol =
    getProtocol(env.APP_BASE_DOMAIN) ?? getProtocol(env.WEB_ORIGIN) ?? "https:"
  const normalizedPath = path.startsWith("/") || path.length === 0 ? path : `/${path}`

  return `${protocol}//auth.${baseDomain}${normalizedPath}`
}

function getBaseDomain(value: string) {
  const trimmedValue = value.trim().replace(/\/+$/, "")

  if (!trimmedValue) {
    return ""
  }

  if (trimmedValue.includes("://")) {
    try {
      return new URL(trimmedValue).host.toLowerCase()
    } catch {
      return ""
    }
  }

  return trimmedValue.toLowerCase()
}

function getProtocol(value: string) {
  if (!value.includes("://")) {
    return null
  }

  try {
    return new URL(value).protocol
  } catch {
    return null
  }
}
