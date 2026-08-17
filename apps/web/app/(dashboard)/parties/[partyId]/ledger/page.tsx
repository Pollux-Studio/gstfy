import { PartyLedgerPage } from "@/components/parties/party-ledger-page"

export default async function PartyLedgerRoute({
  params,
}: {
  params: Promise<{ partyId: string }>
}) {
  const { partyId } = await params

  return <PartyLedgerPage partyId={partyId} />
}
