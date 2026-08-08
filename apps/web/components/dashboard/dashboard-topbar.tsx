"use client"

import Image from "next/image"
import { memo, useState } from "react"
import { SearchIcon } from "lucide-react"

import { DashboardCommandMenu } from "@/components/dashboard/dashboard-command-menu"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { SidebarInput, SidebarTrigger } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { overviewDashboardData } from "@/lib/dashboard/mock-overview"
import { getGstStateMeta } from "@/lib/gst-state"

export const DashboardTopbar = memo(function DashboardTopbar() {
  const stateMeta = getGstStateMeta(overviewDashboardData.business.gstin)
  const [isCommandOpen, setIsCommandOpen] = useState(false)

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
              placeholder="Search invoices, parties, filings..."
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
          {stateMeta?.emblemSrc ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-lg border border-border bg-background/80"
                  />
                }
              >
                <Image
                  src={stateMeta.emblemSrc}
                  alt={stateMeta.name}
                  width={20}
                  height={20}
                  className="size-5 rounded-sm object-contain"
                />
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">{stateMeta.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {overviewDashboardData.business.gstin}
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
      />
    </>
  )
})
