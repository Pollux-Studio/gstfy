import { AdjustmentDetailPage } from "@/components/adjustments/adjustment-detail-page"

export default function DebitNoteDetailRoute({
  params,
}: {
  params: { adjustmentId: string }
}) {
  return <AdjustmentDetailPage mode="debit-note" adjustmentId={params.adjustmentId} />
}
