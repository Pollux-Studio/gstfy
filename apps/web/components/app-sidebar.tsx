"use client"

import * as React from "react"
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
  ShoppingCartIcon,
  SparklesIcon,
  TruckIcon,
  UsersIcon,
  WarehouseIcon,
} from "lucide-react"
import { PLANS, canAccess, type ModuleKey } from "@repo/core/lib/featureFlags"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
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

type SidebarModule = {
  module: ModuleKey
  title: string
  url: string
}

type SidebarCategory = {
  title: string
  items: SidebarModule[]
}

type SidebarNavItem = {
  title: string
  url: string
  icon?: React.ReactNode
  isActive?: boolean
}

const currentPlan = PLANS.small

const planLabels: Record<(typeof PLANS)[keyof typeof PLANS], string> = {
  micro: "Micro",
  small: "Small",
  pro: "Pro",
  ca: "CA",
}

const overviewItem: SidebarNavItem = {
  title: "Overview",
  url: "/dashboard",
  icon: <LayoutDashboardIcon />,
  isActive: true,
}

const categoryItems: SidebarCategory[] = [
  {
    title: "Sales",
    items: [
      {
        module: "invoices",
        title: "Invoices",
        url: "#",
      },
      {
        module: "einvoice",
        title: "E-Invoice",
        url: "#",
      },
      {
        module: "ewaybill",
        title: "E-Way Bill",
        url: "#",
      },
      {
        module: "pos",
        title: "POS",
        url: "#",
      },
    ],
  },
  {
    title: "Purchases",
    items: [
      {
        module: "purchases",
        title: "Purchases",
        url: "#",
      },
      {
        module: "expenses",
        title: "Expenses",
        url: "#",
      },
    ],
  },
  {
    title: "Compliance",
    items: [
      {
        module: "gstr",
        title: "GST Returns",
        url: "#",
      },
      {
        module: "aireview",
        title: "AI Review",
        url: "#",
      },
    ],
  },
  {
    title: "Inventory",
    items: [
      {
        module: "inventory",
        title: "Inventory",
        url: "#",
      },
    ],
  },
  {
    title: "Contacts",
    items: [
      {
        module: "parties",
        title: "Parties",
        url: "#",
      },
    ],
  },
  {
    title: "Business",
    items: [
      {
        module: "reports",
        title: "Reports",
        url: "#",
      },
    ],
  },
]

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
  const visibleCategories = categoryItems
    .map((category) => ({
      title: category.title,
      items: category.items
        .filter((item) => canAccess(item.module, currentPlan))
        .map((item) => ({
          title: item.title,
          url: item.url,
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
    }))
    .filter((category) => category.items.length > 0)

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
