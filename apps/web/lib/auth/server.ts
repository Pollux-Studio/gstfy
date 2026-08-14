import { cookies } from "next/headers"
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

  if (accountType) {
    redirect(accountType === "ca" ? "/ca" : "/dashboard")
  }
}
