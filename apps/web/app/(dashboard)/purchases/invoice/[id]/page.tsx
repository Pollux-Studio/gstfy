import { PurchaseInvoiceViewerPage } from "@/components/purchases/purchase-invoice-viewer-page"

export default async function PurchaseInvoiceRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <PurchaseInvoiceViewerPage billId={id} />
}
