"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar"
import {
  clearStoredAuthSession,
  expireAuthSessionAndRedirectToLogin,
  getAuthRefreshDelayMs,
  getStoredAuthSession,
  refreshStoredAuthSession,
} from "@/lib/auth/session"
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
  const accountType = storedSession?.accountType ?? "business"
  const isCaRoute = pathname === "/ca" || pathname.startsWith("/ca/clients")

  useEffect(() => {
    if (!hasSession) {
      clearStoredAuthSession()
      const loginPath =
        pathname === "/ca" || pathname.startsWith("/ca/clients")
          ? "/auth/ca/login"
          : "/auth/login"
      router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`)
      return
    }

    if (isCaRoute && accountType !== "ca") {
      router.replace("/dashboard")
      return
    }

    if (!isCaRoute && accountType === "ca") {
      router.replace("/ca")
    }
  }, [accountType, hasSession, isCaRoute, pathname, router])

  useEffect(() => {
    if (!hasSession) {
      return
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let disposed = false

    async function refreshAndScheduleNext() {
      const refreshedSession = await refreshStoredAuthSession()

      if (disposed) {
        return
      }

      if (!refreshedSession) {
        if (!getStoredAuthSession()) {
          expireAuthSessionAndRedirectToLogin()
          return
        }

        timeoutId = setTimeout(scheduleRefresh, 30000)
        return
      }

      scheduleRefresh()
    }

    function scheduleRefresh() {
      const currentSession = getStoredAuthSession()
      const delayMs = getAuthRefreshDelayMs(currentSession?.session)

      if (!currentSession || delayMs === null) {
        return
      }

      timeoutId = setTimeout(
        () => {
          void refreshAndScheduleNext()
        },
        Math.max(delayMs, 1000)
      )
    }

    scheduleRefresh()

    return () => {
      disposed = true

      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [hasSession])

  if (
    !hasSession ||
    (isCaRoute && accountType !== "ca") ||
    (!isCaRoute && accountType === "ca")
  ) {
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
