import { Suspense } from "react"

import { AcceptCaInvitePage } from "@/components/ca/accept-ca-invite-page"

export default function AcceptCaInviteRoute() {
  return (
    <Suspense>
      <AcceptCaInvitePage />
    </Suspense>
  )
}
