import {
  permissionActionKeys,
  type PermissionActionKey,
  type PermissionModuleKey,
} from "@/lib/dashboard/modules"
import type {
  ModulePermissionState,
  PermissionPresetKey,
  UserPermissionMap,
} from "@/lib/users/api"

const availableModules: PermissionModuleKey[] = [
  "overview",
  "invoices",
  "purchases",
  "expenses",
  "gstr",
  "inventory",
  "parties",
  "reports",
]

export function createPermissionEntry(
  value?: Partial<Record<PermissionActionKey, boolean>>
): ModulePermissionState {
  return {
    view: Boolean(value?.view),
    create: Boolean(value?.create),
    edit: Boolean(value?.edit),
    delete: Boolean(value?.delete),
  }
}

export function clonePermissionMap(permissions: UserPermissionMap): UserPermissionMap {
  return Object.fromEntries(
    Object.entries(permissions).map(([module, value]) => [
      module,
      createPermissionEntry(value),
    ])
  )
}

export function createEmptyPermissionMap(): UserPermissionMap {
  const permissions: UserPermissionMap = {}

  availableModules.forEach((module) => {
    permissions[module] = createPermissionEntry()
  })

  return permissions
}

export function buildPresetPermissions(
  preset: PermissionPresetKey
): UserPermissionMap {
  const permissions = createEmptyPermissionMap()
  const fullAccess = createPermissionEntry({
    view: true,
    create: true,
    edit: true,
    delete: true,
  })

  switch (preset) {
    case "owner":
      availableModules.forEach((module) => {
        permissions[module] = { ...fullAccess }
      })
      break
    case "manager":
      permissions.overview = createPermissionEntry({ view: true })
      permissions.invoices = createPermissionEntry({
        view: true,
        create: true,
        edit: true,
      })
      permissions.purchases = createPermissionEntry({
        view: true,
        create: true,
        edit: true,
      })
      permissions.expenses = createPermissionEntry({
        view: true,
        create: true,
        edit: true,
      })
      permissions.gstr = createPermissionEntry({
        view: true,
        create: true,
        edit: true,
      })
      permissions.inventory = createPermissionEntry({
        view: true,
        create: true,
        edit: true,
      })
      permissions.parties = createPermissionEntry({
        view: true,
        create: true,
        edit: true,
      })
      permissions.reports = createPermissionEntry({ view: true })
      break
    case "cashier":
      permissions.overview = createPermissionEntry({ view: true })
      permissions.invoices = createPermissionEntry({
        view: true,
        create: true,
      })
      permissions.parties = createPermissionEntry({ view: true })
      break
    case "accountant":
      permissions.overview = createPermissionEntry({ view: true })
      permissions.purchases = createPermissionEntry({
        view: true,
        create: true,
        edit: true,
      })
      permissions.expenses = createPermissionEntry({
        view: true,
        create: true,
        edit: true,
      })
      permissions.gstr = createPermissionEntry({
        view: true,
        create: true,
        edit: true,
      })
      permissions.parties = createPermissionEntry({ view: true })
      permissions.reports = createPermissionEntry({ view: true })
      break
    case "operations":
      permissions.overview = createPermissionEntry({ view: true })
      permissions.inventory = createPermissionEntry({
        view: true,
        create: true,
        edit: true,
      })
      permissions.purchases = createPermissionEntry({
        view: true,
        create: true,
        edit: true,
      })
      permissions.parties = createPermissionEntry({ view: true })
      break
    case "custom":
      break
  }

  return permissions
}

export function countGrantedModules(permissions: UserPermissionMap) {
  return Object.values(permissions).filter((permission) =>
    permissionActionKeys.some((action) => permission?.[action])
  ).length
}

export function countGrantedActions(permissions: UserPermissionMap) {
  return Object.values(permissions).reduce(
    (count, permission) =>
      count +
      permissionActionKeys.reduce(
        (total, action) => total + (permission?.[action] ? 1 : 0),
        0
      ),
    0
  )
}

export function hasAtLeastOnePermission(permissions: UserPermissionMap) {
  return countGrantedActions(permissions) > 0
}
