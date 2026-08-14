"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  BriefcaseBusinessIcon,
  Building2Icon,
  CreditCardIcon,
  FileChartColumnIcon,
  GalleryVerticalEndIcon,
  HandCoinsIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  MessageSquareMoreIcon,
  ReceiptTextIcon,
  Settings2Icon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  UsersIcon,
  WarehouseIcon,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import { getCurrentUser, type CurrentUserResponse } from "@/lib/auth/api"
import {
  currentPlan,
  getVisibleFeatureCategories,
  planLabels,
} from "@/lib/dashboard/modules"
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"

type SidebarNavItem = {
  title: string
  url: string
  icon?: React.ReactNode
  isActive?: boolean
  disabled?: boolean
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const storedSession = getStoredAuthSession()
  const accessToken = storedSession?.session.accessToken ?? ""
  const { data: currentUser } = useQuery({
    queryKey: ["auth", "current-user"],
    queryFn: () => getCurrentUser(accessToken),
    enabled: accessToken.length > 0,
    staleTime: 1000 * 60 * 5,
  })

  const overviewItem: SidebarNavItem = {
    title: "Overview",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
    isActive: pathname === "/dashboard",
  }

  const visibleCategories = getVisibleFeatureCategories(currentPlan)
    .map((category) => ({
      title: category.title,
      items: [
        ...category.items.map((item) => ({
          title: item.title,
          url: item.url,
          isActive:
            item.url !== "#" &&
            (pathname === item.url || pathname.startsWith(`${item.url}/`)),
          disabled: item.url === "#",
          icon:
            item.module === "invoices" ? <CreditCardIcon /> :
            item.module === "pos" ? <Building2Icon /> :
            item.module === "purchases" ? <ShoppingCartIcon /> :
            item.module === "expenses" ? <HandCoinsIcon /> :
            item.module === "gstr" ? <ReceiptTextIcon /> :
            item.module === "inventory" ? <WarehouseIcon /> :
            item.module === "parties" ? <UsersIcon /> :
            item.module === "reports" ? <FileChartColumnIcon /> :
            undefined,
        })),
        ...(category.title === "Contacts" ?
          [
            {
              title: "Users",
              url: "/users",
              isActive: pathname === "/users" || pathname.startsWith("/users/"),
              icon: <ShieldCheckIcon />,
            },
          ]
        : []),
      ],
    }))

  visibleCategories.push({
    title: "CA Workspace",
    items: [
      {
        title: "Clients",
        url: "/ca",
        isActive: pathname === "/ca" || pathname.startsWith("/ca/"),
        icon: <BriefcaseBusinessIcon />,
      },
    ],
  })

  const sidebarUser = buildSidebarUser(storedSession?.user ?? null, currentUser)
  const sidebarTeam = buildSidebarTeam(currentUser)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={[sidebarTeam]} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain overview={overviewItem} categories={visibleCategories} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/settings" />}
              data-active={pathname === "/settings" || pathname.startsWith("/settings/")}
              tooltip="Settings"
            >
              <Settings2Icon />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton render={<a href="#" />}>
              <MessageSquareMoreIcon />
              <span>Feedback</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton render={<a href="#" />}>
              <LifeBuoyIcon />
              <span>Support</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <NavUser user={sidebarUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function buildSidebarUser(
  authUser: { email: string | null; phone: string | null } | null,
  currentUser?: CurrentUserResponse
) {
  const primaryMembership = currentUser?.memberships[0] ?? null
  const name =
    currentUser?.profile?.display_name ??
    primaryMembership?.business_name ??
    getUserDisplayName(authUser?.email, authUser?.phone)

  return {
    name,
    email: authUser?.email ?? authUser?.phone ?? "No identifier",
    avatar: "",
  }
}

function buildSidebarTeam(currentUser?: CurrentUserResponse) {
  const primaryMembership = currentUser?.memberships[0] ?? null

  return {
    name:
      primaryMembership?.business_name ??
      currentUser?.profile?.display_name ??
      "GSTFY Workspace",
    logo: <GalleryVerticalEndIcon />,
    plan: primaryMembership?.gstin ?? `${planLabels[currentPlan]} plan`,
  }
}

function getUserDisplayName(email?: string | null, phone?: string | null) {
  if (email) {
    return email.split("@")[0] ?? email
  }

  if (phone) {
    return phone
  }

  return "GSTFY User"
}
