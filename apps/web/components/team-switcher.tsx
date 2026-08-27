"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ChevronsUpDownIcon, PlusIcon } from "lucide-react"

export function TeamSwitcher({
  teams,
  label = "Workspaces",
  showAddBranch = true,
}: {
  teams: {
    name: string
    logo: React.ReactNode
    logoUrl?: string | null
    plan: string
  }[]
  label?: string
  showAddBranch?: boolean
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const activeTeam = teams[0]
  if (!activeTeam) {
    return null
  }
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            <TeamLogo team={activeTeam} size="lg" />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{activeTeam.name}</span>
              <span className="truncate text-xs">{activeTeam.plan}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {label}
              </DropdownMenuLabel>
              {teams.map((team) => (
                <DropdownMenuItem
                  key={team.name}
                  className="gap-2 p-2"
                >
                  <TeamLogo team={team} size="sm" />
                  {team.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            {showAddBranch ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem className="gap-2 p-2" onClick={() => router.push("/branches/new")}>
                    <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                      <PlusIcon className="size-4" />
                    </div>
                    <div className="font-medium text-muted-foreground">
                      Add Branch
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
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
  }
  size: "sm" | "lg"
}) {
  const logoUrl = team.logoUrl?.trim()
  const className =
    size === "lg" ?
      "relative flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-sidebar-border bg-background text-sidebar-primary"
    : "relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background text-muted-foreground"

  if (logoUrl) {
    return (
      <div className={className}>
        <Image
          src={logoUrl}
          alt={`${team.name} logo`}
          fill
          sizes={size === "lg" ? "32px" : "24px"}
          className="rounded-[inherit] object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={
        size === "lg" ?
          "flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
        : "flex size-6 shrink-0 items-center justify-center rounded-md border"
      }
    >
      {team.logo}
    </div>
  )
}
