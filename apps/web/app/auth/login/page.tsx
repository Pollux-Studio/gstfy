import { Suspense } from "react"

import { LoginForm } from "@/components/login-form"
import { redirectAuthenticatedUser } from "@/lib/auth/server"
import { getTranslation } from "@/lib/i18n/resources"

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await redirectAuthenticatedUser()

  const params = searchParams ? await searchParams : {}
  const registered = params.registered
  const verification = params.verification
  const registeredValue = Array.isArray(registered) ? registered[0] : registered
  const verificationValue = Array.isArray(verification) ? verification[0] : verification
  const registrationBanner =
    registeredValue === "1"
      ? verificationValue === "phone"
        ? getTranslation("auth.login.registrationSuccessPhone")
        : getTranslation("auth.login.registrationSuccessEmail")
      : ""

  return (
    <div className="mx-auto w-full max-w-[22rem] sm:max-w-sm">
      <Suspense>
        <LoginForm registrationBanner={registrationBanner} />
      </Suspense>
    </div>
  )
}
