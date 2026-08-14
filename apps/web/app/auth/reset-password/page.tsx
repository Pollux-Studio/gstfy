import { Suspense } from "react"

import { ResetPasswordForm } from "@/components/reset-password-form"

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-[22rem] sm:max-w-sm">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
