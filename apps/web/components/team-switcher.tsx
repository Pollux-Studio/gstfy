"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"

import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { PlusIcon } from "lucide-react"

export function TeamSwitcher({
  teams,
  label = "Workspaces",
  showAddBranch = true,
}: {
  teams: {
    name: string
    logo: React.ReactNode
    logoUrl?: string | null
    branchCount?: number
    plan: string
  }[]
  label?: string
  showAddBranch?: boolean
}) {
  const router = useRouter()
  const activeTeam = teams[0]
  if (!activeTeam) {
    return null
  }
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          tooltip={activeTeam.name}
          className="cursor-default hover:bg-transparent hover:text-sidebar-foreground active:bg-transparent active:text-sidebar-foreground"
          aria-label={`${activeTeam.name} ${label}`}
        >
          <TeamLogo team={activeTeam} size="lg" />
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-medium">{activeTeam.name}</span>
            <span className="truncate text-xs text-sidebar-foreground/70">
              {activeTeam.plan}
            </span>
          </div>
        </SidebarMenuButton>
        {showAddBranch ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <SidebarMenuAction
                  type="button"
                  aria-label="Add branch"
                  className="right-2 top-2.5 size-7 border border-sidebar-border bg-background text-sidebar-foreground opacity-100 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-data-[size=lg]/menu-button:top-2.5"
                  onClick={() => router.push("/branches/new")}
                />
              }
            >
              <PlusIcon />
            </TooltipTrigger>
            <TooltipContent side="right" align="center">
              Add branch
            </TooltipContent>
          </Tooltip>
        ) : null}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function TeamLogo({
  team,
  size,
}: {
  team: {
    name: string
    logo: React.ReactNode
    logoUrl?: string | null
    branchCount?: number
  }
  size: "sm" | "lg"
}) {
  const logoUrl = team.logoUrl?.trim()
  const extraBranchCount =
    size === "lg" ? Math.max((team.branchCount ?? 0) - 1, 0) : 0
  const className =
    size === "lg" ?
      "relative z-10 flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-sidebar-border bg-background text-sidebar-primary"
    : "relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background text-muted-foreground"

  if (logoUrl) {
    return (
      <LogoStack branchCount={extraBranchCount}>
        <div className={className}>
          <Image
            src={logoUrl}
            alt={`${team.name} logo`}
            fill
            sizes={size === "lg" ? "32px" : "24px"}
            className="rounded-[inherit] object-cover"
          />
        </div>
      </LogoStack>
    )
  }

  return (
    <LogoStack branchCount={extraBranchCount}>
      <div
        className={
          size === "lg" ?
            "relative z-10 flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
          : "flex size-6 shrink-0 items-center justify-center rounded-md border"
        }
      >
        {team.logo}
      </div>
    </LogoStack>
  )
}

function LogoStack({
  branchCount,
  children,
}: {
  branchCount: number
  children: React.ReactNode
}) {
  if (branchCount <= 0) {
    return children
  }

  return (
    <span className="relative h-8 w-12 shrink-0 group-data-[collapsible=icon]:size-8">
      <span className="absolute left-0 top-0 z-10">{children}</span>
      <span className="absolute left-4 top-0 z-0 flex aspect-square size-8 items-center justify-end rounded-lg border border-blue-200 bg-blue-50 pr-1 text-[9px] font-semibold leading-none text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300 group-data-[collapsible=icon]:hidden">
        +{branchCount}
      </span>
    </span>
  )
}
