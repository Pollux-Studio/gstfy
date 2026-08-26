import { SalesInvoiceViewerPage } from "@/components/sales/sales-invoice-viewer-page"

export default async function SalesInvoiceRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <SalesInvoiceViewerPage invoiceId={id} />
}
