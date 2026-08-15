import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  AUTH_ACCOUNT_TYPE_COOKIE_NAME,
  AUTH_LOGGED_IN_COOKIE_NAME,
  type AuthAccountType,
} from "@/lib/auth/session"

export async function isAuthenticatedRequest() {
  const cookieStore = await cookies()
  return cookieStore.get(AUTH_LOGGED_IN_COOKIE_NAME)?.value === "1"
}

export async function getAuthenticatedAccountType(): Promise<AuthAccountType | null> {
  const cookieStore = await cookies()

  if (cookieStore.get(AUTH_LOGGED_IN_COOKIE_NAME)?.value !== "1") {
    return null
  }

  return cookieStore.get(AUTH_ACCOUNT_TYPE_COOKIE_NAME)?.value === "ca"
    ? "ca"
    : "business"
}

export async function redirectAuthenticatedUser() {
  const accountType = await getAuthenticatedAccountType()

  if (accountType && !(await isAuthSubdomainRequest())) {
    redirect(accountType === "ca" ? await getCaAppUrlForRequest("/dashboard") : "/dashboard")
  }
}

export async function getCaAppUrlForRequest(path = "/dashboard") {
  return getSubdomainUrlForRequest("ca", path)
}

export async function isAuthSubdomainRequest() {
  const headersList = await headers()
  const hostHeader = headersList.get("host") ?? ""
  const { hostname } = splitHost(hostHeader)

  return hostname === "auth.localhost" || hostname.startsWith("auth.")
}

async function getSubdomainUrlForRequest(subdomain: string, path = "") {
  const headersList = await headers()
  const hostHeader = headersList.get("host") ?? "localhost"
  const forwardedProto = headersList.get("x-forwarded-proto")
  const { hostname, port } = splitHost(hostHeader)
  const protocol =
    forwardedProto ??
    (hostname === "localhost" || hostname.endsWith(".localhost")
      ? "http"
      : "https")
  const normalizedPath = path.startsWith("/") || path.length === 0 ? path : `/${path}`
  const portSuffix = port ? `:${port}` : ""

  return `${protocol}://${subdomain}.${getBaseHost(hostname)}${portSuffix}${normalizedPath}`
}

function splitHost(hostHeader: string) {
  const [hostname = "localhost", port = ""] = hostHeader.trim().toLowerCase().split(":")

  return {
    hostname,
    port,
  }
}

function getBaseHost(hostname: string) {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost")
  ) {
    return "localhost"
  }

  const labels = hostname.split(".").filter(Boolean)

  return labels.length <= 2 ? hostname : labels.slice(-2).join(".")
}
