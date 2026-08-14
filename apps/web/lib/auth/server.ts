import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AUTH_LOGGED_IN_COOKIE_NAME } from "@/lib/auth/session"

export async function isAuthenticatedRequest() {
  const cookieStore = await cookies()
  return cookieStore.get(AUTH_LOGGED_IN_COOKIE_NAME)?.value === "1"
}

export async function redirectAuthenticatedUser() {
  if (await isAuthenticatedRequest()) {
    redirect("/dashboard")
  }
}
