import { redirect } from "next/navigation"

export default async function CaClientSummaryRoute({
  params,
}: {
  params: Promise<{ businessId: string }>
}) {
  const { businessId } = await params

  redirect(`/dashboard/clients/${businessId}`)
}
