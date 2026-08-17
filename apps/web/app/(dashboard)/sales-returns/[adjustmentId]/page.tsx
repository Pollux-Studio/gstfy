import { AdjustmentDetailPage } from "@/components/adjustments/adjustment-detail-page"

export default function SalesReturnDetailRoute({
  params,
}: {
  params: { adjustmentId: string }
}) {
  return <AdjustmentDetailPage mode="sales-return" adjustmentId={params.adjustmentId} />
}
