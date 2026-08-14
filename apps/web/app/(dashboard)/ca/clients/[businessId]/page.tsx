import { CaClientSummaryPage } from "@/components/ca/ca-client-summary-page"

export default async function CaClientSummaryRoute({
  params,
}: {
  params: Promise<{ businessId: string }>
}) {
  const { businessId } = await params

  return <CaClientSummaryPage businessId={businessId} />
}
