import { AccountingAccountDetailPage } from "@/components/accounting/accounting-account-detail-page"

export default async function AccountingAccountRoute({
  params,
}: {
  params: Promise<{ accountId: string }>
}) {
  const { accountId } = await params

  return <AccountingAccountDetailPage accountId={accountId} />
}
