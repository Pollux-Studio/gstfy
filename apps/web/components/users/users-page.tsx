"use client"

import * as React from "react"
import {
  MoreHorizontalIcon,
  PencilLineIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getPermissionCategories,
  permissionActionKeys,
  type PermissionActionKey,
  type PermissionModuleKey,
} from "@/lib/dashboard/modules"
import {
  mockUsers,
  type ModulePermissionState,
  type UserPermissionMap,
  type UserRecord,
  type UserStatus,
} from "@/lib/users/mock-users"
import { cn } from "@/lib/utils"

type SheetMode = "create" | "edit"

type UserFormState = {
  name: string
  contact: string
  designation: string
  status: UserStatus
  permissions: UserPermissionMap
}

type UserFormErrors = {
  name?: string
  contact?: string
  permissions?: string
}

const permissionCategories = getPermissionCategories()
const moduleTitleMap = new Map(
  permissionCategories.flatMap((category) =>
    category.items.map((item) => [item.module, item.title] as const)
  )
)

const designationOptions = [
  "Owner",
  "Manager",
  "Cashier",
  "Accountant",
  "Operations",
] as const

const statusOptions: UserStatus[] = ["Active", "Inactive"]

const permissionActionLabels: Record<PermissionActionKey, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
}

function createPermissionEntry(
  permissions?: ModulePermissionState
): ModulePermissionState {
  return {
    view: permissions?.view ?? false,
    create: permissions?.create ?? false,
    edit: permissions?.edit ?? false,
    delete: permissions?.delete ?? false,
  }
}

function clonePermissionMap(permissions: UserPermissionMap): UserPermissionMap {
  return Object.fromEntries(
    Object.entries(permissions).map(([module, value]) => [
      module,
      createPermissionEntry(value),
    ])
  )
}

function createEmptyPermissionMap(): UserPermissionMap {
  const permissions: UserPermissionMap = {}

  permissionCategories.forEach((category) => {
    category.items.forEach((item) => {
      permissions[item.module] = createPermissionEntry()
    })
  })

  return permissions
}

function createEmptyUserForm(): UserFormState {
  return {
    name: "",
    contact: "",
    designation: "Cashier",
    status: "Active",
    permissions: createEmptyPermissionMap(),
  }
}

function createFormFromUser(user: UserRecord): UserFormState {
  return {
    name: user.name,
    contact: user.contact,
    designation: user.designation,
    status: user.status,
    permissions: clonePermissionMap(user.permissions),
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function countGrantedModules(permissions: UserPermissionMap) {
  return Object.values(permissions).filter((permission) =>
    permissionActionKeys.some((action) => permission?.[action])
  ).length
}

function countGrantedActions(permissions: UserPermissionMap) {
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

function getAccessSummary(permissions: UserPermissionMap) {
  const grantedTitles = Object.entries(permissions)
    .filter(([, permission]) => permissionActionKeys.some((action) => permission?.[action]))
    .map(([module]) => moduleTitleMap.get(module as PermissionModuleKey))
    .filter((title): title is string => Boolean(title))

  const firstLabels = grantedTitles.slice(0, 2).join(", ")
  const remainingCount = Math.max(grantedTitles.length - 2, 0)

  return {
    totals: `${countGrantedModules(permissions)} modules / ${countGrantedActions(permissions)} actions`,
    labels:
      grantedTitles.length === 0 ?
        "No module access assigned"
      : remainingCount > 0 ?
        `${firstLabels} +${remainingCount}`
      : firstLabels,
  }
}

function hasAtLeastOnePermission(permissions: UserPermissionMap) {
  return countGrantedActions(permissions) > 0
}

function createUserId() {
  return `usr_${Date.now()}`
}

function validateForm(form: UserFormState): UserFormErrors {
  const errors: UserFormErrors = {}

  if (!form.name.trim()) {
    errors.name = "Enter the user name."
  }

  if (!form.contact.trim()) {
    errors.contact = "Enter an email or phone number."
  }

  if (!hasAtLeastOnePermission(form.permissions)) {
    errors.permissions = "Grant at least one module action."
  }

  return errors
}

export function UsersPage() {
  const [users, setUsers] = React.useState<UserRecord[]>(mockUsers)
  const [sheetMode, setSheetMode] = React.useState<SheetMode | null>(null)
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null)
  const [userPendingDelete, setUserPendingDelete] = React.useState<UserRecord | null>(null)
  const [formState, setFormState] = React.useState<UserFormState>(createEmptyUserForm)
  const [formErrors, setFormErrors] = React.useState<UserFormErrors>({})

  const selectedUser = React.useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  )

  function openCreateSheet() {
    setSelectedUserId(null)
    setFormState(createEmptyUserForm())
    setFormErrors({})
    setSheetMode("create")
  }

  function openEditSheet(user: UserRecord) {
    setSelectedUserId(user.id)
    setFormState(createFormFromUser(user))
    setFormErrors({})
    setSheetMode("edit")
  }

  function closeSheet() {
    setSheetMode(null)
    setSelectedUserId(null)
    setFormErrors({})
  }

  function confirmDelete(user: UserRecord) {
    setUserPendingDelete(user)
  }

  function handleDeleteConfirmed() {
    if (!userPendingDelete) {
      return
    }

    setUsers((currentUsers) =>
      currentUsers.filter((item) => item.id !== userPendingDelete.id)
    )
    setUserPendingDelete(null)
  }

  function handlePermissionToggle(
    module: PermissionModuleKey,
    action: PermissionActionKey
  ) {
    setFormState((currentState) => ({
      ...currentState,
      permissions: {
        ...currentState.permissions,
        [module]: {
          ...createPermissionEntry(currentState.permissions[module]),
          [action]: !currentState.permissions[module]?.[action],
        },
      },
    }))
    setFormErrors((currentErrors) => ({ ...currentErrors, permissions: undefined }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateForm(formState)

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }

    if (sheetMode === "edit" && selectedUser) {
      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === selectedUser.id ?
            {
              ...user,
              ...formState,
              permissions: clonePermissionMap(formState.permissions),
            }
          : user
        )
      )
    } else {
      setUsers((currentUsers) => [
        {
          id: createUserId(),
          ...formState,
          permissions: clonePermissionMap(formState.permissions),
        },
        ...currentUsers,
      ])
    }

    closeSheet()
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
        <section className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
            <div className="space-y-2">
              <Badge variant="outline" className="gap-1.5 bg-background/70">
                <ShieldCheckIcon className="size-3.5" />
                Contacts
              </Badge>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Add team members and control module-level access for each user.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Button type="button" className="h-10 rounded-xl" onClick={openCreateSheet}>
                <UserPlusIcon className="size-4" />
                Add User
              </Button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Available users</h2>
                <p className="text-sm text-muted-foreground">
                  Review access, update permissions, or remove a user from the workspace.
                </p>
              </div>
              <Badge variant="outline">{users.length} users</Badge>
            </div>
          </div>
          <div className="app-scrollbar overflow-x-auto">
            <Table className="min-w-[920px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>User</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Access summary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const accessSummary = getAccessSummary(user.permissions)

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {user.status === "Active" ? "Workspace access enabled" : "Access paused"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.contact}</TableCell>
                      <TableCell>{user.designation}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{accessSummary.totals}</p>
                          <p className="text-xs text-muted-foreground">
                            {accessSummary.labels}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.status === "Active" ? "default" : "secondary"}
                          className={cn(
                            user.status === "Active" &&
                              "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          )}
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="aria-expanded:bg-muted"
                              />
                            }
                          >
                            <MoreHorizontalIcon className="size-4" />
                            <span className="sr-only">Open user actions</span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={8} className="w-40">
                            <DropdownMenuItem onClick={() => openEditSheet(user)}>
                              <PencilLineIcon className="text-muted-foreground" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => confirmDelete(user)}
                            >
                              <Trash2Icon className="text-muted-foreground" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <Sheet open={sheetMode !== null} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className="w-full sm:max-w-2xl">
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
            <SheetHeader className="border-b border-border px-4 py-4">
              <SheetTitle>
                {sheetMode === "edit" ? "Edit user access" : "Add a new user"}
              </SheetTitle>
              <SheetDescription>
                {sheetMode === "edit" ?
                  "Update user details and module-level permissions for this workspace."
                : "Create a user profile and define which modules they can access."}
              </SheetDescription>
            </SheetHeader>

            <div className="app-scrollbar flex-1 overflow-y-auto px-4 py-4">
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="user-name">Full name</FieldLabel>
                    <Input
                      id="user-name"
                      value={formState.name}
                      onChange={(event) => {
                        setFormState((currentState) => ({
                          ...currentState,
                          name: event.target.value,
                        }))
                        setFormErrors((currentErrors) => ({
                          ...currentErrors,
                          name: undefined,
                        }))
                      }}
                      placeholder="Enter user name"
                    />
                    <FieldError>{formErrors.name}</FieldError>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="user-contact">Email or phone number</FieldLabel>
                    <Input
                      id="user-contact"
                      value={formState.contact}
                      onChange={(event) => {
                        setFormState((currentState) => ({
                          ...currentState,
                          contact: event.target.value,
                        }))
                        setFormErrors((currentErrors) => ({
                          ...currentErrors,
                          contact: undefined,
                        }))
                      }}
                      placeholder="owner@gstfy.in or +91 98765 43210"
                    />
                    <FieldError>{formErrors.contact}</FieldError>
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="user-designation">Designation</FieldLabel>
                    <Select
                      value={formState.designation}
                      onValueChange={(value) =>
                        setFormState((currentState) => ({
                          ...currentState,
                          designation: value ?? currentState.designation,
                        }))
                      }
                    >
                      <SelectTrigger id="user-designation" className="w-full">
                        <SelectValue placeholder="Select designation" />
                      </SelectTrigger>
                      <SelectContent align="start" sideOffset={8}>
                        {designationOptions.map((designation) => (
                          <SelectItem key={designation} value={designation}>
                            {designation}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="user-status">Status</FieldLabel>
                    <Select
                      value={formState.status}
                      onValueChange={(value) =>
                        setFormState((currentState) => ({
                          ...currentState,
                          status: (value as UserStatus | null) ?? currentState.status,
                        }))
                      }
                    >
                      <SelectTrigger id="user-status" className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent align="start" sideOffset={8}>
                        {statusOptions.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">Module access</h3>
                    <FieldDescription>
                      Only modules available in the current business plan are shown here.
                    </FieldDescription>
                  </div>
                  <FieldError>{formErrors.permissions}</FieldError>
                  <div className="space-y-4">
                    {permissionCategories.map((category) => (
                      <div
                        key={category.title}
                        className="overflow-hidden rounded-2xl border border-border/70"
                      >
                        <div className="border-b border-border/70 bg-muted/30 px-4 py-3">
                          <p className="text-sm font-medium">{category.title}</p>
                        </div>
                        <div className="divide-y divide-border/70">
                          {category.items.map((item) => {
                            const modulePermission = createPermissionEntry(
                              formState.permissions[item.module]
                            )

                            return (
                              <div
                                key={item.module}
                                className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                              >
                                <div className="space-y-1">
                                  <p className="text-sm font-medium">{item.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Set the allowed actions for this module.
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {permissionActionKeys.map((action) => (
                                    <Button
                                      key={action}
                                      type="button"
                                      size="sm"
                                      variant={modulePermission[action] ? "default" : "outline"}
                                      className="min-w-[4.75rem]"
                                      onClick={() =>
                                        handlePermissionToggle(item.module, action)
                                      }
                                    >
                                      {permissionActionLabels[action]}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </FieldGroup>
            </div>

            <div className="flex flex-col gap-2 border-t border-border px-4 py-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={closeSheet}>
                Cancel
              </Button>
              <Button type="submit">
                {sheetMode === "edit" ? "Save changes" : "Create user"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog
        open={userPendingDelete !== null}
        onOpenChange={(open) => !open && setUserPendingDelete(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              {userPendingDelete ?
                `Remove ${userPendingDelete.name} from this workspace? This action only updates the frontend list in this demo.`
              : "Remove this user from the workspace?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUserPendingDelete(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteConfirmed}>
              Delete user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
