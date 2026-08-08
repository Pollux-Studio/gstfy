import { PurchaseFormPage } from "@/components/purchases/purchase-form-page"

export default function EditPurchasePage({
  params,
}: {
  params: { id: string }
}) {
  return <PurchaseFormPage mode="edit" billId={params.id} />
}
