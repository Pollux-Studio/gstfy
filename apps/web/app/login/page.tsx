import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-[22rem] sm:max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
