import { CaRegisterForm } from "@/components/ca-register-form"
import { redirectAuthenticatedUser } from "@/lib/auth/server"

export default async function CaRegisterPage() {
  await redirectAuthenticatedUser()

  return (
    <div className="mx-auto w-full max-w-[24rem] sm:max-w-md">
      <CaRegisterForm />
    </div>
  )
}
