import { PurchaseDetailPage } from "@/components/purchases/purchase-detail-page"

export default function ViewPurchasePage({
  params,
}: {
  params: { id: string }
}) {
  return <PurchaseDetailPage billId={params.id} />
}
