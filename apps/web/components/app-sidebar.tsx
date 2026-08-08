"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import {
  Building2Icon,
  CreditCardIcon,
  FileChartColumnIcon,
  GalleryVerticalEndIcon,
  HandCoinsIcon,
  LayoutDashboardIcon,
  PlugZapIcon,
  LifeBuoyIcon,
  MessageSquareMoreIcon,
  ReceiptTextIcon,
  ScrollTextIcon,
  Settings2Icon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  SparklesIcon,
  TruckIcon,
  UsersIcon,
  WarehouseIcon,
} from "lucide-react"
import { canAccess } from "@repo/core/lib/featureFlags"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  currentPlan,
  getVisibleFeatureCategories,
  planLabels,
} from "@/lib/dashboard/modules"
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

const data = {
  user: {
    name: "GSTFY Demo",
    email: "owner@gstfy.in",
    avatar: "",
  },
  teams: [
    {
      name: "Gstfy",
      logo: <GalleryVerticalEndIcon />,
      plan: `${planLabels[currentPlan]} plan`,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

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
            item.module === "einvoice" ? <ScrollTextIcon /> :
            item.module === "ewaybill" ? <TruckIcon /> :
            item.module === "pos" ? <Building2Icon /> :
            item.module === "purchases" ? <ShoppingCartIcon /> :
            item.module === "expenses" ? <HandCoinsIcon /> :
            item.module === "gstr" ? <ReceiptTextIcon /> :
            item.module === "aireview" ? <SparklesIcon /> :
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

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain overview={overviewItem} categories={visibleCategories} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<a href="#" />}>
              <Settings2Icon />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {canAccess("integrations", currentPlan) ? (
            <SidebarMenuItem>
              <SidebarMenuButton render={<a href="#" />}>
                <PlugZapIcon />
                <span>Integrations</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
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
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
