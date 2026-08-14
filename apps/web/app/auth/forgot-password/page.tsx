import { ForgotPasswordForm } from "@/components/forgot-password-form"
import { redirectAuthenticatedUser } from "@/lib/auth/server"

export default async function ForgotPasswordPage() {
  await redirectAuthenticatedUser()

  return (
    <div className="mx-auto w-full max-w-[22rem] sm:max-w-sm">
      <ForgotPasswordForm />
    </div>
  )
}
