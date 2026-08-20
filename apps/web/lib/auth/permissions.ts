import type { CurrentUserResponse } from "@/lib/auth/api"
import type { PermissionModuleKey } from "@/lib/dashboard/modules"

type BusinessMembership = CurrentUserResponse["memberships"][number]

const pathModuleMap: Array<{
  test: (pathname: string) => boolean
  module: PermissionModuleKey
}> = [
  {
    test: (pathname) => pathname === "/dashboard",
    module: "overview",
  },
  {
    test: (pathname) =>
      pathname === "/invoices" ||
      pathname.startsWith("/invoices/") ||
      pathname === "/sales-returns" ||
      pathname.startsWith("/sales-returns/") ||
      pathname === "/credit-notes" ||
      pathname.startsWith("/credit-notes/"),
    module: "invoices",
  },
  {
    test: (pathname) =>
      pathname === "/purchases" ||
      pathname.startsWith("/purchases/") ||
      pathname === "/purchase-returns" ||
      pathname.startsWith("/purchase-returns/") ||
      pathname === "/debit-notes" ||
      pathname.startsWith("/debit-notes/"),
    module: "purchases",
  },
  {
    test: (pathname) => pathname === "/inventory" || pathname.startsWith("/inventory/"),
    module: "inventory",
  },
  {
    test: (pathname) => pathname === "/products" || pathname.startsWith("/products/"),
    module: "inventory",
  },
  {
    test: (pathname) => pathname === "/pos" || pathname.startsWith("/pos/"),
    module: "pos",
  },
  {
    test: (pathname) => pathname === "/parties" || pathname.startsWith("/parties/"),
    module: "parties",
  },
  {
    test: (pathname) => pathname === "/accounting" || pathname.startsWith("/accounting/"),
    module: "accounting",
  },
  {
    test: (pathname) =>
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
      pathname === "/payment-reports" ||
      pathname.startsWith("/payment-reports/") ||
      pathname === "/bank-reconciliation" ||
      pathname.startsWith("/bank-reconciliation/"),
    module: "accounting",
  },
]

export function getActiveBusinessMembership(
  currentUser: CurrentUserResponse | undefined,
  tenantId: string | null | undefined
) {
  if (!currentUser) {
    return null
  }

  return (
    currentUser.memberships.find(
      (membership) => membership.business_id === tenantId && membership.status === "active"
    ) ??
    currentUser.memberships.find((membership) => membership.status === "active") ??
    currentUser.memberships[0] ??
    null
  )
}

export function canManageWorkspace(membership: BusinessMembership | null) {
  return membership?.role === "owner" || membership?.role === "admin"
}

export function canViewModule(
  membership: BusinessMembership | null,
  module: PermissionModuleKey
) {
  if (!membership) {
    return false
  }

  if (canManageWorkspace(membership)) {
    return true
  }

  return Boolean(membership.permissions?.[module]?.view)
}

export function getRoutePermissionModule(pathname: string) {
  return pathModuleMap.find((entry) => entry.test(pathname))?.module ?? null
}

export function canAccessBusinessPath(
  pathname: string,
  currentUser: CurrentUserResponse | undefined,
  tenantId: string | null | undefined
) {
  if (pathname === "/account") {
    return true
  }

  const membership = getActiveBusinessMembership(currentUser, tenantId)

  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return canManageWorkspace(membership)
  }

  if (pathname === "/users" || pathname.startsWith("/users/")) {
    return canManageWorkspace(membership)
  }

  const requiredModule = getRoutePermissionModule(pathname)

  if (!requiredModule) {
    return true
  }

  return canViewModule(membership, requiredModule)
}
