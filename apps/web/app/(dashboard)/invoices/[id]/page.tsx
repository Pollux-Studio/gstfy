import { SalesInvoiceDetailPage } from "@/components/sales/sales-invoice-detail-page"

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <SalesInvoiceDetailPage invoiceId={id} />
}
