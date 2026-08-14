import { Suspense } from "react"

import { CaLoginForm } from "@/components/ca-login-form"
import { redirectAuthenticatedUser } from "@/lib/auth/server"

export default async function CaLoginPage() {
  await redirectAuthenticatedUser()

  return (
    <div className="mx-auto w-full max-w-[22rem] sm:max-w-sm">
      <Suspense>
        <CaLoginForm />
      </Suspense>
    </div>
  )
}
