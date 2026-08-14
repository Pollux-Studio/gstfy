import { Suspense } from "react"

import { CaLoginForm } from "@/components/ca-login-form"

export default function CaLoginPage() {
  return (
    <div className="mx-auto w-full max-w-[22rem] sm:max-w-sm">
      <Suspense>
        <CaLoginForm />
      </Suspense>
    </div>
  )
}
