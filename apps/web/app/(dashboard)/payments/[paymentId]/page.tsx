import { MoneyDetailPage } from "@/components/payment-receipt/money-detail-page"

export default async function PaymentDetailRoute({
  params,
}: {
  params: Promise<{ paymentId: string }>
}) {
  const { paymentId } = await params

  return <MoneyDetailPage mode="payment" documentId={paymentId} />
}
