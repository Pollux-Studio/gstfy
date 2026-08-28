"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  BadgeIndianRupeeIcon,
  BarChart3Icon,
  BriefcaseBusinessIcon,
  Building2Icon,
  CreditCardIcon,
  FileChartColumnIcon,
  FileSignatureIcon,
  GalleryVerticalEndIcon,
  HandCoinsIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  MessageSquareMoreIcon,
  NotebookTextIcon,
  PackageIcon,
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
import { getProfileAvatarUrl } from "@/lib/avatar"
import type { CurrentUserResponse } from "@/lib/auth/api"
import { getCaDashboard, type CaDashboardResponse } from "@/lib/ca/api"
import {
  currentPlan,
  getVisibleFeatureCategories,
  planLabels,
} from "@/lib/dashboard/modules"
import {
  canManageWorkspace,
  canViewModule,
  getActiveBusinessMembership,
} from "@/lib/auth/permissions"
import {
  type StoredAuthSession,
} from "@/lib/auth/session"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

type SidebarNavItem = {
  title: string
  url: string
  icon?: React.ReactNode
  isActive?: boolean
  disabled?: boolean
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  storedSession: StoredAuthSession
  currentUser?: CurrentUserResponse
}

export function AppSidebar({
  storedSession,
  currentUser,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const accountType = storedSession.accountType
  const isCaAccount = accountType === "ca"
  const userId = storedSession.user.id
  const accessToken = storedSession.session.accessToken
  const currentUserForSession = currentUser
  const activeBusinessMembership = React.useMemo(
    () => getActiveBusinessMembership(currentUserForSession, storedSession.tenant?.id),
    [currentUserForSession, storedSession.tenant?.id]
  )
  const canManageBusinessWorkspace = canManageWorkspace(activeBusinessMembership)
  const { data: caDashboard } = useQuery({
    queryKey: ["ca", "dashboard", userId],
    queryFn: () => getCaDashboard(accessToken),
    enabled: isCaAccount && accessToken.length > 0 && userId.length > 0,
    staleTime: 1000 * 60 * 3,
  })

  const overviewItem: SidebarNavItem | null = React.useMemo(() => {
    if (isCaAccount) {
      return {
        title: "Filing Dashboard",
        url: "/dashboard",
        icon: <LayoutDashboardIcon />,
        isActive: pathname === "/dashboard" || pathname === "/ca",
      }
    }

    if (
      !currentUserForSession ||
      !canViewModule(activeBusinessMembership, "overview")
    ) {
      return null
    }

    return {
      title: "Overview",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
      isActive: pathname === "/dashboard",
    }
  }, [activeBusinessMembership, currentUserForSession, isCaAccount, pathname])

  const visibleCategories = React.useMemo(() => {
    if (isCaAccount) {
      return [
        {
          title: "GST Filing",
          items: [
            {
              title: "Clients",
              url: "/dashboard/clients",
              isActive:
                pathname === "/dashboard/clients" ||
                pathname.startsWith("/dashboard/clients/") ||
                pathname === "/ca/clients" ||
                pathname.startsWith("/ca/clients/"),
              icon: <UsersIcon />,
            },
            {
              title: "Referral Codes",
              url: "/dashboard/referral-codes",
              isActive:
                pathname === "/dashboard/referral-codes" ||
                pathname === "/ca/referral-codes",
              icon: <KeyRoundIcon />,
            },
            {
              title: "Data Exports",
              url: "#",
              isActive: false,
              disabled: true,
              icon: <FileChartColumnIcon />,
            },
          ],
        },
      ]
    }

    if (!currentUserForSession) {
      return []
    }

    const categories = getVisibleFeatureCategories(currentPlan).map((category) => ({
      title: category.title,
      items: [
        ...category.items
          .filter((item) => canViewModule(activeBusinessMembership, item.module))
          .map((item) => {
            const isMoneyEntry = item.title === "Money" && item.url === "/money"

            return {
              title: item.title,
              url: item.url,
              isActive:
                item.url !== "#" &&
                (isMoneyEntry ?
                  isMoneyPath(pathname)
                : pathname === item.url || pathname.startsWith(`${item.url}/`)),
              disabled: item.url === "#",
              icon:
                item.module === "invoices" ? <CreditCardIcon /> :
                item.module === "pos" ? <Building2Icon /> :
                item.module === "purchases" ? <ShoppingCartIcon /> :
                item.module === "expenses" ? <HandCoinsIcon /> :
                item.title === "Money" ? <BadgeIndianRupeeIcon /> :
                item.module === "gstr" ? <ReceiptTextIcon /> :
                item.module === "einvoice" ? <FileSignatureIcon /> :
                item.title === "Payment Reports" ? <BarChart3Icon /> :
                item.title === "Products" ? <PackageIcon /> :
                item.module === "inventory" ? <WarehouseIcon /> :
                item.module === "parties" ? <UsersIcon /> :
                item.module === "reports" ? <FileChartColumnIcon /> :
                item.module === "accounting" ? <NotebookTextIcon /> :
                undefined,
            }
          }),
        ...(category.title === "Contacts" && canManageBusinessWorkspace ?
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
    })).filter((category) => category.items.length > 0)

    return categories
  }, [
    activeBusinessMembership,
    canManageBusinessWorkspace,
    currentUserForSession,
    isCaAccount,
    pathname,
  ])

  const sidebarUser = React.useMemo(
    () => buildSidebarUser(storedSession.user, currentUserForSession),
    [storedSession.user, currentUserForSession]
  )
  const sidebarTeam = React.useMemo(
    () => buildSidebarTeam(accountType, currentUserForSession, caDashboard),
    [accountType, caDashboard, currentUserForSession]
  )

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          teams={[sidebarTeam]}
          label={isCaAccount ? "Practice" : "Workspaces"}
          showAddBranch={!isCaAccount}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          overview={overviewItem}
          categories={visibleCategories}
          workspaceLabel={isCaAccount ? "CA Workspace" : "Workspace"}
        />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {!isCaAccount && canManageBusinessWorkspace ? (
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
          ) : null}
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/feedback" />}
              data-active={pathname === "/feedback"}
              tooltip="Feedback"
            >
              <MessageSquareMoreIcon />
              <span>Feedback</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/support" />}
              data-active={pathname === "/support"}
              tooltip="Support"
            >
              <LifeBuoyIcon />
              <span>Support</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <NavUser
          user={sidebarUser}
          logoutPath={isCaAccount ? "/auth/ca/login" : "/auth/login"}
        />
      </SidebarFooter>
    </Sidebar>
  )
}

function buildSidebarUser(
  authUser: {
    email: string | null
    phone: string | null
    profileImageSeed?: string | null
  } | null,
  currentUser?: CurrentUserResponse
) {
  const primaryMembership = currentUser?.memberships[0] ?? null
  const avatarSeed =
    authUser?.profileImageSeed ?? currentUser?.profile?.profile_image_seed ?? null
  const identifier =
    currentUser?.profile?.email ??
    currentUser?.auth.email ??
    authUser?.email ??
    currentUser?.profile?.phone_e164 ??
    currentUser?.auth.phone ??
    authUser?.phone ??
    "No identifier"
  const name =
    currentUser?.profile?.display_name ??
    primaryMembership?.business_name ??
    getUserDisplayName(identifier, null)

  return {
    name,
    email: identifier,
    avatar: getProfileAvatarUrl(avatarSeed),
    isOwner: primaryMembership?.role === "owner",
  }
}

function buildSidebarTeam(
  accountType: StoredAuthSession["accountType"],
  currentUser?: CurrentUserResponse,
  caDashboard?: CaDashboardResponse
) {
  if (accountType === "ca") {
    return {
      name:
        caDashboard?.practice.name ??
        currentUser?.profile?.display_name ??
        "CA Practice",
      logo: <BriefcaseBusinessIcon />,
      plan: "Client filing workspace",
    }
  }

  const primaryMembership = currentUser?.memberships[0] ?? null

  return {
    name:
      primaryMembership?.business_name ??
      currentUser?.profile?.display_name ??
      "GSTFY Workspace",
    logo: <GalleryVerticalEndIcon />,
    logoUrl: primaryMembership?.logo_url ?? null,
    branchCount: primaryMembership?.branch_count ?? 0,
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

function isMoneyPath(pathname: string) {
  return (
    pathname === "/money" ||
    pathname.startsWith("/money/") ||
    pathname === "/receipts" ||
    pathname.startsWith("/receipts/") ||
    pathname === "/payments" ||
    pathname.startsWith("/payments/") ||
    pathname === "/receivables" ||
    pathname.startsWith("/receivables/") ||
    pathname === "/payables" ||
    pathname.startsWith("/payables/") ||
    pathname === "/bank-reconciliation" ||
    pathname.startsWith("/bank-reconciliation/")
  )
}
