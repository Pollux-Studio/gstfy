import type { FastifyRequest } from "fastify"

import { getEnv } from "../config/env.js"
import { HttpError } from "./http-error.js"

const tenantHeaderName = "x-gstfy-tenant"
const reservedSubdomains = new Set(["app", "api", "auth", "www"])

export function getTenantSlugFromRequest(request: FastifyRequest) {
  const env = getEnv()
  const headerTenant = normalizeTenantSlugHeader(
    getFirstHeaderValue(request.headers[tenantHeaderName])
  )
  const originTenant = getTenantSlugFromHost(getFirstHeaderValue(request.headers.origin))
  const refererTenant = getTenantSlugFromHost(
    getFirstHeaderValue(request.headers.referer)
  )
  const hostTenant = getTenantSlugFromHost(getFirstHeaderValue(request.headers.host))
  const resolvedTenant = originTenant ?? refererTenant ?? hostTenant

  if (resolvedTenant) {
    if (headerTenant && headerTenant !== resolvedTenant) {
      throw new HttpError(400, "Tenant header does not match request origin.")
    }

    return resolvedTenant
  }

  if (headerTenant && canUseTenantHeaderFallback(request, env)) {
    return headerTenant
  }

  return null
}

export function getTenantSlugFromHost(value: string | undefined) {
  if (!value) {
    return null
  }

  const host = normalizeHost(value)
  const baseDomain = normalizeHost(getEnv().APP_BASE_DOMAIN)

  if (!host || !baseDomain || host === baseDomain) {
    return null
  }

  if (isLocalhostBaseDomain(baseDomain)) {
    return getTenantSlugFromLocalhostHost(host)
  }

  if (isLocalhostHost(host)) {
    return null
  }

  if (!host.endsWith(`.${baseDomain}`)) {
    return null
  }

  const subdomain = host.slice(0, -(baseDomain.length + 1)).split(".")[0] ?? ""
  const tenantSlug = normalizeTenantSlugHeader(subdomain)

  if (!tenantSlug || reservedSubdomains.has(tenantSlug)) {
    return null
  }

  return tenantSlug
}

function canUseTenantHeaderFallback(
  request: FastifyRequest,
  env: ReturnType<typeof getEnv>
) {
  if (env.NODE_ENV === "production") {
    return false
  }

  const host = normalizeHost(getFirstHeaderValue(request.headers.host) ?? "")
  const origin = normalizeHost(getFirstHeaderValue(request.headers.origin) ?? "")
  const referer = normalizeHost(getFirstHeaderValue(request.headers.referer) ?? "")
  const baseDomain = normalizeHost(env.APP_BASE_DOMAIN)

  return [host, origin, referer, baseDomain].some(
    (value) => value && isLocalhostHost(value)
  )
}

function getTenantSlugFromLocalhostHost(host: string) {
  if (!host.endsWith(".localhost")) {
    return null
  }

  const subdomain = host.slice(0, -".localhost".length).split(".")[0] ?? ""
  const tenantSlug = normalizeTenantSlugHeader(subdomain)

  if (!tenantSlug || reservedSubdomains.has(tenantSlug)) {
    return null
  }

  return tenantSlug
}

function getFirstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function normalizeTenantSlugHeader(value: string | undefined) {
  const normalizedValue = value?.trim().toLowerCase() ?? ""

  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(normalizedValue)) {
    return null
  }

  return normalizedValue
}

function normalizeHost(value: string) {
  let hostValue = value

  if (value.includes("://")) {
    try {
      hostValue = new URL(value).host
    } catch {
      return ""
    }
  }

  return hostValue
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
}

function isLocalhostHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")
}

function isLocalhostBaseDomain(host: string) {
  return host === "localhost" || host === "127.0.0.1"
}
