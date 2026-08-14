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
      { module: "invoices", title: "Invoices", url: "#" },
      { module: "pos", title: "POS", url: "#" },
    ],
  },
  {
    title: "Purchases",
    items: [
      { module: "purchases", title: "Purchases", url: "/purchases" },
      { module: "expenses", title: "Expenses", url: "#" },
    ],
  },
  {
    title: "Compliance",
    items: [{ module: "gstr", title: "GST Returns", url: "#" }],
  },
  {
    title: "Inventory",
    items: [{ module: "inventory", title: "Inventory", url: "#" }],
  },
  {
    title: "Contacts",
    items: [{ module: "parties", title: "Parties", url: "#" }],
  },
  {
    title: "Business",
    items: [{ module: "reports", title: "Reports", url: "#" }],
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
