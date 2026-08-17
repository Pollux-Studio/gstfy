import { MoneyDetailPage } from "@/components/payment-receipt/money-detail-page"

export default async function ReceiptDetailRoute({
  params,
}: {
  params: Promise<{ receiptId: string }>
}) {
  const { receiptId } = await params

  return <MoneyDetailPage mode="receipt" documentId={receiptId} />
}
