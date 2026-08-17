import { PLANS, canAccess, type ModuleKey, type PlanKey } from "@repo/core/lib/featureFlags"

export const currentPlan: PlanKey = PLANS.small

export const planLabels: Record<PlanKey, string> = {
  micro: "Micro",
  small: "Small",
  pro: "Pro",
  ca: "CA",
}

export type SidebarFeatureItem = {
  module: ModuleKey
  title: string
  url: string
}

export type SidebarFeatureCategory = {
  title: string
  items: SidebarFeatureItem[]
}

const featureCategories: SidebarFeatureCategory[] = [
  {
    title: "Sales",
    items: [
      { module: "invoices", title: "Invoices", url: "/invoices" },
      { module: "invoices", title: "Sales Returns", url: "/sales-returns" },
      { module: "invoices", title: "Credit Notes", url: "/credit-notes" },
      { module: "pos", title: "POS", url: "/pos" },
    ],
  },
  {
    title: "Purchases",
    items: [
      { module: "purchases", title: "Purchases", url: "/purchases" },
      { module: "purchases", title: "Purchase Returns", url: "/purchase-returns" },
      { module: "purchases", title: "Debit Notes", url: "/debit-notes" },
      { module: "expenses", title: "Expenses", url: "#" },
    ],
  },
  {
    title: "Money",
    items: [
      { module: "accounting", title: "Receipts", url: "/receipts" },
      { module: "accounting", title: "Payments", url: "/payments" },
      { module: "accounting", title: "Receivables", url: "/receivables" },
      { module: "accounting", title: "Payables", url: "/payables" },
      { module: "accounting", title: "Payment Reports", url: "/payment-reports" },
      {
        module: "accounting",
        title: "Bank Reconciliation",
        url: "/bank-reconciliation",
      },
    ],
  },
  {
    title: "Compliance",
    items: [{ module: "gstr", title: "GST Returns", url: "#" }],
  },
  {
    title: "Inventory",
    items: [
      { module: "inventory", title: "Inventory", url: "/inventory" },
      { module: "inventory", title: "Products", url: "/products" },
    ],
  },
  {
    title: "Contacts",
    items: [{ module: "parties", title: "Parties", url: "/parties" }],
  },
  {
    title: "Business",
    items: [
      { module: "reports", title: "Reports", url: "#" },
      { module: "accounting", title: "Accounting", url: "/accounting" },
    ],
  },
]

export function getVisibleFeatureCategories(
  plan: PlanKey = currentPlan
): SidebarFeatureCategory[] {
  return featureCategories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => canAccess(item.module, plan)),
    }))
    .filter((category) => category.items.length > 0)
}

export type PermissionModuleKey = ModuleKey | "overview"
export type PermissionCategory = {
  title: string
  items: {
    module: PermissionModuleKey
    title: string
  }[]
}

export const permissionActionKeys = ["view", "create", "edit", "delete"] as const
export type PermissionActionKey = (typeof permissionActionKeys)[number]

export function getPermissionCategories(
  plan: PlanKey = currentPlan
): PermissionCategory[] {
  return [
    {
      title: "Workspace",
      items: [{ module: "overview", title: "Overview" }],
    },
    ...getVisibleFeatureCategories(plan).map((category) => ({
      title: category.title,
      items: category.items.map((item) => ({
        module: item.module,
        title: item.title,
      })),
    })),
  ]
}
