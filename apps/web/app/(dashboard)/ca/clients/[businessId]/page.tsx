import { CaClientSummaryPage } from "@/components/ca/ca-client-summary-page"

export default function CaClientSummaryRoute({
  params,
}: {
  params: { businessId: string }
}) {
  return <CaClientSummaryPage businessId={params.businessId} />
}
