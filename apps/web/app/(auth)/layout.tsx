import { AuthSystemControls } from "@/components/auth-system-controls"

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-svh flex-col bg-background p-4 sm:p-6 md:p-10">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
        <div className="flex justify-end">
          <AuthSystemControls />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[22rem] sm:max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  )
}
