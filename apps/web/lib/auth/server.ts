import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  getAppSubdomainFromHostname,
  getPublicSubdomainUrl,
} from "@/lib/api/config"
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

  return getAppSubdomainFromHostname(hostname) === "auth"
}

async function getSubdomainUrlForRequest(subdomain: string, path = "") {
  return getPublicSubdomainUrl(subdomain, path)
}

function splitHost(hostHeader: string) {
  const [hostname = "localhost", port = ""] = hostHeader.trim().toLowerCase().split(":")

  return {
    hostname,
    port,
  }
}
