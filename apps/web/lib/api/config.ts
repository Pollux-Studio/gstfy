export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "https://api.gstfy.in"
).replace(/\/$/, "")

export const API_BASE_PATH = "/api/v1"

export const APP_BASE_DOMAIN = normalizePublicHost(
  process.env.NEXT_PUBLIC_APP_BASE_DOMAIN ?? "gstfy.in"
)

export const APP_BASE_HOSTNAME = APP_BASE_DOMAIN.replace(/:\d+$/, "")

export const APP_BASE_PORT = APP_BASE_DOMAIN.match(/:(\d+)$/)?.[1] ?? ""

export const APP_BASE_PROTOCOL = normalizeProtocol(
  process.env.NEXT_PUBLIC_APP_PROTOCOL,
  APP_BASE_HOSTNAME
)

export const RESERVED_APP_SUBDOMAINS = new Set([
  "api",
  "app",
  "auth",
  "ca",
  "admin",
  "www",
  "mail",
  "support",
  "gstfy",
])

export function getAppSubdomainFromHostname(hostname: string) {
  const normalizedHostname = normalizePublicHost(hostname).replace(/:\d+$/, "")
  const configuredHostname = APP_BASE_HOSTNAME

  if (!normalizedHostname || normalizedHostname === configuredHostname) {
    return null
  }

  if (!normalizedHostname.endsWith(`.${configuredHostname}`)) {
    return null
  }

  const prefix = normalizedHostname.slice(0, -(configuredHostname.length + 1))

  if (!prefix || prefix.includes(".")) {
    return null
  }

  return prefix
}

export function getTenantSlugFromHostname(hostname: string) {
  const subdomain = getAppSubdomainFromHostname(hostname)

  if (!subdomain || RESERVED_APP_SUBDOMAINS.has(subdomain)) {
    return null
  }

  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(subdomain)) {
    return null
  }

  return subdomain
}

export function getPublicSubdomainUrl(subdomain: string, path = "") {
  const normalizedPath = path.startsWith("/") || path.length === 0 ? path : `/${path}`
  const portSuffix = APP_BASE_PORT ? `:${APP_BASE_PORT}` : ""

  return `${APP_BASE_PROTOCOL}://${subdomain}.${APP_BASE_HOSTNAME}${portSuffix}${normalizedPath}`
}

function normalizePublicHost(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
}

function normalizeProtocol(value: string | undefined, hostname: string) {
  const normalizedValue = value?.trim().toLowerCase().replace(/:$/, "")

  if (normalizedValue === "http" || normalizedValue === "https") {
    return normalizedValue
  }

  return hostname === "localhost" || hostname.endsWith(".localhost")
    ? "http"
    : "https"
}
