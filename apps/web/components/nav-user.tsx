"use client"

import { useRouter } from "next/navigation"

import { logout } from "@/lib/auth/api"
import { clearStoredAuthSession } from "@/lib/auth/session"
import { getAuthSubdomainUrl } from "@/lib/auth/workspace-url"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
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
import { VerifiedBadge } from "@/components/ui/verified-badge"
import { ChevronsUpDownIcon, BadgeCheckIcon, CreditCardIcon, LogOutIcon } from "lucide-react"

export function NavUser({
  user,
  logoutPath = "/auth/login",
  showAccountLinks = true,
}: {
  user: {
    name: string
    email: string
    avatar: string
    isOwner?: boolean
  }
  logoutPath?: string
  showAccountLinks?: boolean
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()

  async function handleLogout() {
    try {
      await logout()
    } catch {
      // Local session should still be cleared if the server logout request fails.
    } finally {
      clearStoredAuthSession()
      const targetPath = getLogoutTarget(logoutPath)

      if (/^https?:\/\//.test(targetPath)) {
        window.location.replace(targetPath)
        return
      }

      router.replace(targetPath)
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar>
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium">{user.name}</span>
                {user.isOwner ? (
                  <VerifiedBadge
                    aria-label="Workspace owner"
                    size="sm"
                    tone="brand"
                    variant="static"
                  />
                ) : null}
              </span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-medium">{user.name}</span>
                      {user.isOwner ? (
                        <VerifiedBadge
                          aria-label="Workspace owner"
                          size="sm"
                          tone="brand"
                          variant="static"
                        />
                      ) : null}
                    </span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            {showAccountLinks ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push("/account")}>
                    <BadgeCheckIcon
                    />
                    Account
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <CreditCardIcon
                    />
                    Billing
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOutIcon
              />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function getLogoutTarget(path: string) {
  return path.startsWith("/auth") ? getAuthSubdomainUrl(path) : path
}

function getInitials(value: string) {
  const [first = "", second = ""] = value
    .split(/\s+|[._-]+/)
    .filter(Boolean)

  return `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase() || "GF"
}
