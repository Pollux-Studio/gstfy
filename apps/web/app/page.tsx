import { redirect } from "next/navigation"
import { headers } from "next/headers"

import {
  getAuthenticatedAccountType,
  getCaAppUrlForRequest,
  isAuthSubdomainRequest,
  isAuthenticatedRequest,
} from "@/lib/auth/server"

export default async function Home() {
  const headersList = await headers()
  const host = headersList.get("host")?.split(":")[0]?.toLowerCase() ?? ""

  if (host.startsWith("ca.")) {
    redirect("/dashboard")
  }

  if (await isAuthSubdomainRequest()) {
    redirect("/auth/login")
  }

  const accountType = await getAuthenticatedAccountType()

  if (accountType) {
    redirect(accountType === "ca" ? await getCaAppUrlForRequest("/dashboard") : "/dashboard")
  }

  redirect((await isAuthenticatedRequest()) ? "/dashboard" : "/auth/login")
}
