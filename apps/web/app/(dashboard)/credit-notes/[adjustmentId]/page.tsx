import { AdjustmentDetailPage } from "@/components/adjustments/adjustment-detail-page"

export default function CreditNoteDetailRoute({
  params,
}: {
  params: { adjustmentId: string }
}) {
  return <AdjustmentDetailPage mode="credit-note" adjustmentId={params.adjustmentId} />
}
