"use client"

import Image from "next/image"
import { memo, useMemo, useState } from "react"
import { SearchIcon } from "lucide-react"

import { DashboardCommandMenu } from "@/components/dashboard/dashboard-command-menu"
// import { ServiceStatusCenter } from "@/components/dashboard/service-status-center"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import type { CurrentUserResponse } from "@/lib/auth/api"
import type { StoredAuthSession } from "@/lib/auth/session"
import {
  canManageWorkspace,
  canViewModule,
  getActiveBusinessMembership,
} from "@/lib/auth/permissions"
import type { PermissionModuleKey } from "@/lib/dashboard/modules"
import { Button } from "@/components/ui/button"
import { SidebarInput, SidebarTrigger } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getGstStateMeta } from "@/lib/gst-state"

type DashboardTopbarProps = {
  storedSession: StoredAuthSession
  currentUser?: CurrentUserResponse
}

export const DashboardTopbar = memo(function DashboardTopbar({
  storedSession,
  currentUser,
}: DashboardTopbarProps) {
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const accountType = storedSession.accountType
  const isCaAccount = accountType === "ca"
  const currentUserForSession = currentUser
  const activeBusinessMembership = useMemo(
    () => getActiveBusinessMembership(currentUserForSession, storedSession.tenant?.id),
    [currentUserForSession, storedSession.tenant?.id]
  )
  const canManageBusinessWorkspace = canManageWorkspace(activeBusinessMembership)
  const visibleCommandModules = useMemo<Partial<Record<PermissionModuleKey, boolean>>>(
    () => ({
      overview: isCaAccount || canViewModule(activeBusinessMembership, "overview"),
      invoices: !isCaAccount && canViewModule(activeBusinessMembership, "invoices"),
      pos: !isCaAccount && canViewModule(activeBusinessMembership, "pos"),
      purchases: !isCaAccount && canViewModule(activeBusinessMembership, "purchases"),
      inventory: !isCaAccount && canViewModule(activeBusinessMembership, "inventory"),
      parties: !isCaAccount && canViewModule(activeBusinessMembership, "parties"),
      accounting: !isCaAccount && canViewModule(activeBusinessMembership, "accounting"),
      gstr: !isCaAccount && canViewModule(activeBusinessMembership, "gstr"),
      einvoice: !isCaAccount && canViewModule(activeBusinessMembership, "einvoice"),
    }),
    [activeBusinessMembership, isCaAccount]
  )
  const activeGstin = currentUserForSession?.memberships[0]?.gstin ?? null
  const stateMeta = activeGstin ? getGstStateMeta(activeGstin) : null

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-[width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="md:hidden"
            aria-label="Open dashboard search"
            onClick={() => setIsCommandOpen(true)}
          >
            <SearchIcon className="size-4" />
            <span>Search</span>
          </Button>
          <button
            type="button"
            className="relative hidden w-full max-w-xl md:block"
            aria-label="Open dashboard search"
            onClick={() => setIsCommandOpen(true)}
          >
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <SidebarInput
              readOnly
              value=""
              placeholder="Search services, settings, actions..."
              className="cursor-pointer bg-background pl-8 pr-16 text-sm text-foreground placeholder:text-muted-foreground"
              aria-label="Search dashboard"
              tabIndex={-1}
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              Ctrl K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* <ServiceStatusCenter /> */}
          {stateMeta?.emblemSrc ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-border bg-background/80"
                  />
                }
              >
                <Image
                  src={stateMeta.emblemSrc}
                  alt={stateMeta.name}
                  width={20}
                  height={20}
                  className="size-4 rounded-sm object-contain"
                />
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">{stateMeta.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {activeGstin}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          ) : null}
          <ThemeToggle />
          <div className="hidden md:block">
            <LocaleSwitcher />
          </div>
        </div>
      </header>
      <DashboardCommandMenu
        open={isCommandOpen}
        onOpenChange={setIsCommandOpen}
        accountType={accountType}
        canManageBusinessWorkspace={canManageBusinessWorkspace}
        visibleModules={visibleCommandModules}
      />
    </>
  )
})
