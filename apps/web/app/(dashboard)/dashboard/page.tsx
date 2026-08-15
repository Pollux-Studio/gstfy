import { headers } from "next/headers"

import { CaDashboardPage } from "@/components/ca/ca-dashboard-page"
import { OverviewDashboard } from "@/components/dashboard/overview-dashboard"

export default async function DashboardPage() {
  const headersList = await headers()
  const host = headersList.get("host")?.split(":")[0]?.toLowerCase() ?? ""

  if (host.startsWith("ca.")) {
    return <CaDashboardPage />
  }

  return <OverviewDashboard />
}
