"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar"
import { clearStoredAuthSession, getStoredAuthSession } from "@/lib/auth/session"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function DashboardShell({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const router = useRouter()
  const pathname = usePathname()
  const storedSession = getStoredAuthSession()
  const hasSession =
    storedSession?.isAuthenticated === true && Boolean(storedSession.session.accessToken)

  useEffect(() => {
    if (!hasSession) {
      clearStoredAuthSession()
      const loginPath =
        pathname === "/ca" || pathname.startsWith("/ca/clients")
          ? "/auth/ca/login"
          : "/auth/login"
      router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`)
    }
  }, [hasSession, pathname, router])

  if (!hasSession) {
    return null
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <DashboardTopbar />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
