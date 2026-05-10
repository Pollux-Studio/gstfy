"use client"

import { usePathname } from "next/navigation"

import { AuthSystemControls } from "@/components/auth-system-controls"

export function AuthLayoutShell({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()

  if (pathname === "/register") {
    return <div className="min-h-svh bg-background">{children}</div>
  }

  return (
    <div className="relative min-h-svh bg-background">
      <div className="absolute inset-x-0 top-0 z-10 p-4 sm:p-6 md:p-10">
        <div className="mx-auto flex w-full max-w-5xl justify-end">
          <AuthSystemControls />
        </div>
      </div>
      <div className="flex min-h-svh items-center justify-center p-4 sm:p-6 md:p-10">
        <div className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center">
          <div className="w-full">{children}</div>
        </div>
      </div>
    </div>
  )
}
