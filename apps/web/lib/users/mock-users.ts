import {
  currentPlan,
  getPermissionCategories,
  permissionActionKeys,
  type PermissionActionKey,
  type PermissionModuleKey,
} from "@/lib/dashboard/modules"

export type UserStatus = "Active" | "Inactive"

export type ModulePermissionState = Record<PermissionActionKey, boolean>
export type UserPermissionMap = Partial<
  Record<PermissionModuleKey, ModulePermissionState>
>

export type UserRecord = {
  id: string
  name: string
  contact: string
  designation: string
  status: UserStatus
  permissions: UserPermissionMap
}

const permissionCategories = getPermissionCategories(currentPlan)

function createPermissionEntry(
  allowedActions: PermissionActionKey[] = []
): ModulePermissionState {
  return {
    view: allowedActions.includes("view"),
    create: allowedActions.includes("create"),
    edit: allowedActions.includes("edit"),
    delete: allowedActions.includes("delete"),
  }
}

function createFullAccessPermissions(): UserPermissionMap {
  const permissions: UserPermissionMap = {}

  permissionCategories.forEach((category) => {
    category.items.forEach((item) => {
      permissions[item.module] = createPermissionEntry([...permissionActionKeys])
    })
  })

  return permissions
}

export const mockUsers: UserRecord[] = [
  {
    id: "usr_owner_01",
    name: "Priya Natarajan",
    contact: "owner@gstfy.in",
    designation: "Owner",
    status: "Active",
    permissions: createFullAccessPermissions(),
  },
  {
    id: "usr_cashier_01",
    name: "Meena Ravi",
    contact: "+91 98402 11442",
    designation: "Cashier",
    status: "Active",
    permissions: {
      overview: createPermissionEntry(["view"]),
      invoices: createPermissionEntry(["view", "create"]),
      parties: createPermissionEntry(["view"]),
    },
  },
  {
    id: "usr_accountant_01",
    name: "Arjun S",
    contact: "accounts@gstfy.in",
    designation: "Accountant",
    status: "Active",
    permissions: {
      overview: createPermissionEntry(["view"]),
      expenses: createPermissionEntry(["view", "create", "edit"]),
      purchases: createPermissionEntry(["view", "create", "edit"]),
      gstr: createPermissionEntry(["view", "create", "edit"]),
      aireview: createPermissionEntry(["view"]),
      reports: createPermissionEntry(["view"]),
    },
  },
  {
    id: "usr_ops_01",
    name: "Karthik Vel",
    contact: "ops@gstfy.in",
    designation: "Operations",
    status: "Inactive",
    permissions: {
      overview: createPermissionEntry(["view"]),
      inventory: createPermissionEntry(["view", "edit"]),
      purchases: createPermissionEntry(["view"]),
    },
  },
]
