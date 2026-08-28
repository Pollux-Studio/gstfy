"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { AuthSystemControls } from "@/components/auth-system-controls"
import {
  getStoredAuthSession,
  refreshStoredAuthSession,
  type StoredAuthSession,
} from "@/lib/auth/session"
import {
  appendPathToUrl,
  getCaAppSubdomainUrl,
  getWorkspaceUrlPreview,
} from "@/lib/auth/workspace-url"

export function AuthLayoutShell({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const router = useRouter()
  const pathname = usePathname()
  const [hasCheckedSession, setHasCheckedSession] = useState(false)

  useEffect(() => {
    let disposed = false

    async function redirectIfAuthenticated() {
      const existingSession = getStoredAuthSession()
      const session = existingSession ?? (await refreshStoredAuthSession())

      if (disposed) {
        return
      }

      if (!session) {
        setHasCheckedSession(true)
        return
      }

      const redirectTarget = getAuthenticatedRedirectTarget(session)

      if (!redirectTarget) {
        setHasCheckedSession(true)
        return
      }

      navigateToAuthenticatedTarget(redirectTarget, router)
    }

    void redirectIfAuthenticated()

    return () => {
      disposed = true
    }
  }, [router])

  if (!hasCheckedSession) {
    return <div className="min-h-svh bg-background" />
  }

  if (pathname === "/auth/register") {
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

function getAuthenticatedRedirectTarget(session: StoredAuthSession) {
  if (session.accountType === "ca") {
    return getCaAppSubdomainUrl("/dashboard")
  }

  if (session.tenant?.url) {
    return appendPathToUrl(session.tenant.url, "/dashboard")
  }

  if (session.tenant?.slug) {
    return appendPathToUrl(getWorkspaceUrlPreview(session.tenant.slug), "/dashboard")
  }

  return isCurrentAuthHost() ? null : "/dashboard"
}

function navigateToAuthenticatedTarget(
  redirectTarget: string,
  router: ReturnType<typeof useRouter>
) {
  const targetUrl = new URL(redirectTarget, window.location.href)

  if (targetUrl.href === window.location.href) {
    return
  }

  if (targetUrl.origin === window.location.origin) {
    router.replace(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`)
    return
  }

  window.location.replace(targetUrl.href)
}

function isCurrentAuthHost() {
  const hostname = window.location.hostname.toLowerCase()

  return hostname === "auth.localhost" || hostname.startsWith("auth.")
}
