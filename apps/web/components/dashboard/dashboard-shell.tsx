"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar"
import {
  AUTH_SESSION_CHANGE_EVENT,
  clearStoredAuthSession,
  expireAuthSessionAndRedirectToLogin,
  getAuthRefreshDelayMs,
  getStoredAuthSession,
  refreshStoredAuthSession,
  type StoredAuthSession,
} from "@/lib/auth/session"
import {
  getAuthSubdomainUrl,
  getCaAppSubdomainUrl,
} from "@/lib/auth/workspace-url"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function DashboardShell({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const router = useRouter()
  const pathname = usePathname()
  const [storedSession, setStoredSession] = useState<StoredAuthSession | null>(null)
  const [hasCheckedBrowserSession, setHasCheckedBrowserSession] = useState(false)
  const [isCaHost, setIsCaHost] = useState(false)
  const hasSession =
    storedSession?.isAuthenticated === true && Boolean(storedSession.session.accessToken)
  const accountType = storedSession?.accountType ?? "business"
  const isLegacyCaRoute = pathname === "/ca" || pathname.startsWith("/ca/clients")
  const isCaDashboardRoute =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/clients")
  const isCaRoute = isLegacyCaRoute || (isCaHost && isCaDashboardRoute)

  useEffect(() => {
    function syncStoredSession() {
      setStoredSession(getStoredAuthSession())
      setIsCaHost(window.location.hostname.toLowerCase().startsWith("ca."))
      setHasCheckedBrowserSession(true)
    }

    syncStoredSession()
    window.addEventListener(AUTH_SESSION_CHANGE_EVENT, syncStoredSession)
    window.addEventListener("storage", syncStoredSession)

    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGE_EVENT, syncStoredSession)
      window.removeEventListener("storage", syncStoredSession)
    }
  }, [])

  useEffect(() => {
    if (!hasCheckedBrowserSession) {
      return
    }

    if (!hasSession) {
      let disposed = false

      async function bootstrapSession() {
        const refreshedSession = await refreshStoredAuthSession()

        if (disposed) {
          return
        }

        if (refreshedSession) {
          setStoredSession(refreshedSession)
          router.refresh()
          return
        }

        clearStoredAuthSession()
        const shouldUseCaLogin = isCaHost || isLegacyCaRoute
        const loginPath =
          shouldUseCaLogin
            ? getAuthSubdomainUrl("/auth/ca/login")
            : "/auth/login"
        const loginUrl = `${loginPath}?next=${encodeURIComponent(pathname)}`

        if (/^https?:\/\//.test(loginUrl)) {
          window.location.replace(loginUrl)
          return
        }

        router.replace(loginUrl)
      }

      void bootstrapSession()

      return () => {
        disposed = true
      }
    }

    if (isCaRoute && accountType !== "ca") {
      clearStoredAuthSession()
      window.location.replace(
        `${getAuthSubdomainUrl("/auth/login")}?next=${encodeURIComponent(pathname)}`
      )
      return
    }

    if (!isCaRoute && accountType === "ca") {
      const caDashboardUrl = isCaHost ? "/dashboard" : getCaAppSubdomainUrl("/dashboard")

      if (/^https?:\/\//.test(caDashboardUrl)) {
        window.location.replace(caDashboardUrl)
        return
      }

      router.replace(caDashboardUrl)
    }
  }, [
    accountType,
    hasCheckedBrowserSession,
    hasSession,
    isCaHost,
    isCaRoute,
    isLegacyCaRoute,
    pathname,
    router,
  ])

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

      setStoredSession(refreshedSession)
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
    !hasCheckedBrowserSession ||
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
