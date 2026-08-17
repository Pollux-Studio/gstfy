import { AdjustmentDetailPage } from "@/components/adjustments/adjustment-detail-page"

export default function PurchaseReturnDetailRoute({
  params,
}: {
  params: { adjustmentId: string }
}) {
  return <AdjustmentDetailPage mode="purchase-return" adjustmentId={params.adjustmentId} />
}
