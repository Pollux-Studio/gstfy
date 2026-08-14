import { redirect } from "next/navigation"

import { isAuthenticatedRequest } from "@/lib/auth/server"

export default async function Home() {
  redirect(await isAuthenticatedRequest() ? "/dashboard" : "/auth/login")
}
