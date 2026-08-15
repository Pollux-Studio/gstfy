import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { CaClientSummaryPage } from "@/components/ca/ca-client-summary-page"

export default async function CaDashboardClientSummaryRoute({
  params,
}: {
  params: Promise<{ businessId: string }>
}) {
  const headersList = await headers()
  const host = headersList.get("host")?.split(":")[0]?.toLowerCase() ?? ""

  if (!host.startsWith("ca.")) {
    redirect("/dashboard")
  }

  const { businessId } = await params

  return <CaClientSummaryPage businessId={businessId} />
}
