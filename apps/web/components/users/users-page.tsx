"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BadgeCheckIcon,
  Building2Icon,
  MoreHorizontalIcon,
  PencilLineIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react"
import { toast } from "sonner"

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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  getPermissionCategories,
  permissionActionKeys,
  type PermissionActionKey,
  type PermissionModuleKey,
} from "@/lib/dashboard/modules"
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
  type PermissionPresetKey,
  type UserBranchRecord,
  type UserPermissionMap,
  type UserProvisioningRecord,
  type UserPresetRecord,
  type UserRecord,
  type UserStatus,
  type UserStatusValue,
} from "@/lib/users/api"
import {
  buildPresetPermissions,
  clonePermissionMap,
  countGrantedActions,
  countGrantedModules,
  createEmptyPermissionMap,
  createPermissionEntry,
  hasAtLeastOnePermission,
} from "@/lib/users/presets"
import { cn } from "@/lib/utils"

type SheetMode = "create" | "edit"
type EditablePresetKey = Exclude<PermissionPresetKey, "owner">

type UserFormState = {
  name: string
  contact: string
  designation: string
  status: UserStatus
  permissionPreset: EditablePresetKey
  permissions: UserPermissionMap
  branchIds: string[]
  primaryBranchId: string | null
}

type UserFormErrors = {
  name?: string
  contact?: string
  permissions?: string
  branchIds?: string
}

const permissionCategories = getPermissionCategories()
const moduleTitleMap = new Map(
  permissionCategories.flatMap((category) =>
    category.items.map((item) => [item.module, item.title] as const)
  )
)

const statusOptions: UserStatus[] = ["Active", "Inactive"]

const permissionActionLabels: Record<PermissionActionKey, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
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

function createEmptyUserForm(
  presets: UserPresetRecord[],
  branches: UserBranchRecord[]
): UserFormState {
  const defaultPreset = presets[0]?.key ?? "cashier"
  const primaryBranch = branches.find((branch) => branch.isPrimary) ?? branches[0] ?? null
  const requiresBranch =
    presets.find((preset) => preset.key === defaultPreset)?.branchSelection === "required"

  return {
    name: "",
    contact: "",
    designation:
      presets.find((preset) => preset.key === defaultPreset)?.defaultDesignation ??
      "Cashier",
    status: "Active",
    permissionPreset: defaultPreset,
    permissions: buildPresetPermissions(defaultPreset),
    branchIds: requiresBranch && primaryBranch ? [primaryBranch.id] : [],
    primaryBranchId: requiresBranch && primaryBranch ? primaryBranch.id : null,
  }
}

function createFormFromUser(user: UserRecord): UserFormState {
  return {
    name: user.name,
    contact: user.contact,
    designation: user.designation,
    status: user.status === "Invited" ? "Active" : user.status,
    permissionPreset:
      user.permissionPreset === "owner" ? "manager" : user.permissionPreset,
    permissions: clonePermissionMap(user.permissions),
    branchIds: [...user.branchIds],
    primaryBranchId: user.primaryBranchId,
  }
}

function validateForm(
  form: UserFormState,
  presets: UserPresetRecord[]
): UserFormErrors {
  const errors: UserFormErrors = {}
  const activePreset = presets.find((preset) => preset.key === form.permissionPreset)

  if (!form.name.trim()) {
    errors.name = "Enter the user name."
  }

  if (!form.contact.trim()) {
    errors.contact = "Enter an email or phone number."
  }

  if (activePreset?.branchSelection === "required" && form.branchIds.length === 0) {
    errors.branchIds = "Select at least one branch for this preset."
  }

  if (!hasAtLeastOnePermission(form.permissions)) {
    errors.permissions = "Grant at least one module action."
  }

  return errors
}

function toApiStatus(status: UserStatus): UserStatusValue {
  switch (status) {
    case "Active":
      return "active"
    case "Inactive":
      return "inactive"
    case "Invited":
      return "invited"
  }
}

export function UsersPage() {
  const storedSession = getStoredAuthSession()
  const accessToken = storedSession?.session.accessToken ?? ""
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(accessToken),
    enabled: accessToken.length > 0,
    staleTime: 1000 * 60 * 5,
  })

  const [sheetMode, setSheetMode] = React.useState<SheetMode | null>(null)
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null)
  const [userPendingDelete, setUserPendingDelete] = React.useState<UserRecord | null>(null)
  const [provisioningResult, setProvisioningResult] =
    React.useState<UserProvisioningRecord | null>(null)
  const [formState, setFormState] = React.useState<UserFormState>({
    name: "",
    contact: "",
    designation: "",
    status: "Active",
    permissionPreset: "cashier",
    permissions: createEmptyPermissionMap(),
    branchIds: [],
    primaryBranchId: null,
  })
  const [formErrors, setFormErrors] = React.useState<UserFormErrors>({})

  const users = React.useMemo(() => data?.users ?? [], [data?.users])
  const presets = data?.presets ?? []
  const branches = data?.branches ?? []
  const businessName = data?.meta.businessName ?? "Primary Branch"
  const getBranchDisplayName = React.useCallback(
    (branch: UserBranchRecord) =>
      branch.isPrimary && branch.name === "Primary Branch" ? businessName : branch.name,
    [businessName]
  )
  const selectedPrimaryBranch =
    branches.find((branch) => branch.id === formState.primaryBranchId) ??
    branches.find((branch) => branch.id === formState.branchIds[0]) ??
    null
  const selectedPrimaryBranchName =
    (selectedPrimaryBranch ? getBranchDisplayName(selectedPrimaryBranch) : null) ??
    "Select primary branch"

  const selectedUser = React.useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  )

  const upsertMutation = useMutation({
    mutationFn: (payload: {
      mode: SheetMode
      userId?: string
      formState: UserFormState
    }) => {
      const body = {
        name: payload.formState.name.trim(),
        contact: payload.formState.contact.trim(),
        designation: payload.formState.designation.trim(),
        status: toApiStatus(payload.formState.status),
        permissionPreset: payload.formState.permissionPreset,
        branchIds: payload.formState.branchIds,
        ...(payload.formState.primaryBranchId ?
          { primaryBranchId: payload.formState.primaryBranchId }
        : {}),
        permissions: payload.formState.permissions,
      }

      return payload.mode === "edit" && payload.userId ?
          updateUser(payload.userId, body, accessToken)
        : createUser(body, accessToken)
    },
    onSuccess: (nextData, payload) => {
      queryClient.setQueryData(["users"], nextData)
      closeSheet()
      setProvisioningResult(payload.mode === "create" ? nextData.provisioning : null)
      toast.success(
        payload.mode === "edit" ?
          "User access updated."
        : "Workspace user created."
      )
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUser(userId, accessToken),
    onSuccess: (nextData) => {
      queryClient.setQueryData(["users"], nextData)
      setUserPendingDelete(null)
      toast.success("Workspace user deleted.")
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  function openCreateSheet() {
    if (!data) {
      return
    }

    setSelectedUserId(null)
    setFormState(createEmptyUserForm(data.presets, data.branches))
    setFormErrors({})
    setSheetMode("create")
  }

  function openEditSheet(user: UserRecord) {
    if (!user.canEdit) {
      return
    }

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

  function handlePresetChange(nextPreset: EditablePresetKey) {
    const preset = presets.find((item) => item.key === nextPreset)
    const primaryBranch = branches.find((branch) => branch.isPrimary) ?? branches[0] ?? null

    setFormState((currentState) => {
      const nextBranchIds =
        preset?.branchSelection === "required" && currentState.branchIds.length === 0 && primaryBranch ?
          [primaryBranch.id]
        : currentState.branchIds

      return {
        ...currentState,
        permissionPreset: nextPreset,
        designation: preset?.defaultDesignation ?? currentState.designation,
        permissions:
          nextPreset === "custom" ?
            createEmptyPermissionMap()
          : buildPresetPermissions(nextPreset),
        branchIds: nextBranchIds,
        primaryBranchId:
          nextBranchIds.length === 0 ? null
          : currentState.primaryBranchId && nextBranchIds.includes(currentState.primaryBranchId) ?
            currentState.primaryBranchId
          : nextBranchIds[0] ?? null,
      }
    })
    setFormErrors((currentErrors) => ({
      ...currentErrors,
      branchIds: undefined,
      permissions: undefined,
    }))
  }

  function handlePermissionToggle(
    module: PermissionModuleKey,
    action: PermissionActionKey
  ) {
    setFormState((currentState) => ({
      ...currentState,
      permissionPreset: "custom",
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

  function handleBranchToggle(branchId: string) {
    setFormState((currentState) => {
      const exists = currentState.branchIds.includes(branchId)
      const branchIds =
        exists ?
          currentState.branchIds.filter((currentBranchId) => currentBranchId !== branchId)
        : [...currentState.branchIds, branchId]

      return {
        ...currentState,
        branchIds,
        primaryBranchId:
          branchIds.length === 0 ? null
          : currentState.primaryBranchId && branchIds.includes(currentState.primaryBranchId) ?
            currentState.primaryBranchId
          : branchIds[0] ?? null,
      }
    })
    setFormErrors((currentErrors) => ({ ...currentErrors, branchIds: undefined }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateForm(formState, presets)

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }

    upsertMutation.mutate({
      mode: sheetMode ?? "create",
      userId: selectedUser?.id,
      formState,
    })
  }

  function handleDeleteConfirmed() {
    if (!userPendingDelete) {
      return
    }

    deleteMutation.mutate(userPendingDelete.id)
  }

  if (isLoading) {
    return <UsersPageSkeleton />
  }

  if (!data) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
        <section className="rounded-2xl border border-destructive/30 bg-card p-6">
          <h1 className="text-lg font-semibold">Users unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {getErrorMessage(error) || "Unable to load workspace users right now."}
          </p>
        </section>
      </div>
    )
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
                  Add team members, assign a preset like Cashier or Manager, and scope their access to the right branch.
                </p>
              </div>
            </div>
            {data.meta.canManageUsers ? (
              <Button type="button" className="h-10 rounded-xl" onClick={openCreateSheet}>
                <UserPlusIcon className="size-4" />
                Add User
              </Button>
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Available users</h2>
                <p className="text-sm text-muted-foreground">
                  Review branch assignments, update access presets, or remove a workspace user.
                </p>
              </div>
              <Badge variant="outline">{users.length} users</Badge>
            </div>
          </div>
          <div className="app-scrollbar overflow-x-auto">
            <Table className="min-w-[1080px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>User</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Branches</TableHead>
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
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium">{user.name}</p>
                              {user.isSystemManaged ? (
                                <Badge variant="outline" className="gap-1.5">
                                  <BadgeCheckIcon className="size-3.5" />
                                  Owner sync
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {user.linkedAuthUser ?
                                "Ready for GSTFY login"
                              : "Stored as a workspace-only user profile"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.contact}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{user.designation}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPresetLabel(user.permissionPreset)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">
                            {user.branchNames[0] ?? "No branch assigned"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {user.branchNames.length > 1 ?
                              `${user.branchNames.length} branches linked`
                            : "Primary scope"}
                          </p>
                        </div>
                      </TableCell>
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
                        {user.canEdit || user.canDelete ? (
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
                            <DropdownMenuContent align="end" sideOffset={8} className="w-44">
                              {user.canEdit ? (
                                <DropdownMenuItem onClick={() => openEditSheet(user)}>
                                  <PencilLineIcon className="text-muted-foreground" />
                                  <span>Edit access</span>
                                </DropdownMenuItem>
                              ) : null}
                              {user.canEdit && user.canDelete ? <DropdownMenuSeparator /> : null}
                              {user.canDelete ? (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setUserPendingDelete(user)}
                                >
                                  <Trash2Icon className="text-muted-foreground" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-xs text-muted-foreground">Locked</span>
                        )}
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
        <SheetContent className="w-full sm:max-w-3xl">
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
            <SheetHeader className="border-b border-border px-4 py-4">
              <SheetTitle>
                {sheetMode === "edit" ? "Edit user access" : "Add a new user"}
              </SheetTitle>
              <SheetDescription>
                {sheetMode === "edit" ?
                  "Update the branch scope and module actions for this workspace user."
                : "Choose a preset such as Cashier or Manager, then fine-tune module access if needed."}
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
                      placeholder="owner@gstfy.in or 9876543210"
                    />
                    <FieldError>{formErrors.contact}</FieldError>
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="user-designation">Designation</FieldLabel>
                    <Input
                      id="user-designation"
                      value={formState.designation}
                      onChange={(event) =>
                        setFormState((currentState) => ({
                          ...currentState,
                          designation: event.target.value,
                        }))
                      }
                      placeholder="Branch manager, cashier, accountant..."
                    />
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
                    <h3 className="text-sm font-medium">Preset access</h3>
                    <FieldDescription>
                      Pick a default permission pack first. You can still adjust individual module actions below.
                    </FieldDescription>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {presets.map((preset) => {
                      const isActive = formState.permissionPreset === preset.key

                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => handlePresetChange(preset.key)}
                          className={cn(
                            "rounded-2xl border p-3 text-left transition-colors",
                            isActive ?
                              "border-foreground bg-muted/40"
                            : "border-border bg-background hover:bg-muted/20"
                          )}
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium">{preset.label}</p>
                              <Badge
                                variant={isActive ? "default" : "outline"}
                                className="shrink-0"
                              >
                                {preset.branchSelection === "required" ? "Branch required" : "Flexible"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {preset.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Default role: {preset.defaultDesignation}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2Icon className="size-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium">Branch access</h3>
                    </div>
                    <FieldDescription>
                      Scope this user to the branches they actually operate in. Manager, Cashier, and Operations presets require at least one branch.
                    </FieldDescription>
                  </div>
                  <FieldError>{formErrors.branchIds}</FieldError>
                  <div className="grid gap-3 md:grid-cols-2">
                    {branches.map((branch) => {
                      const isSelected = formState.branchIds.includes(branch.id)
                      const branchDisplayName = getBranchDisplayName(branch)

                      return (
                        <button
                          key={branch.id}
                          type="button"
                          onClick={() => handleBranchToggle(branch.id)}
                          className={cn(
                            "rounded-2xl border p-4 text-left transition-colors",
                            isSelected ?
                              "border-foreground bg-muted/40"
                            : "border-border bg-background hover:bg-muted/20"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-medium">{branchDisplayName}</p>
                              <p className="text-xs text-muted-foreground">
                                {branch.code} • {formatBranchType(branch.type)}
                              </p>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                              {branch.isPrimary ? <Badge variant="outline">Primary</Badge> : null}
                              {isSelected ? <Badge>Selected</Badge> : null}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {formState.branchIds.length > 0 ? (
                    <Field>
                      <FieldLabel htmlFor="primary-branch">Primary branch</FieldLabel>
                      <Select
                        key={`primary-branch-${selectedPrimaryBranchName}-${formState.branchIds.join("-")}`}
                        value={formState.primaryBranchId ?? formState.branchIds[0] ?? ""}
                        onValueChange={(value) =>
                          setFormState((currentState) => ({
                            ...currentState,
                            primaryBranchId: value,
                          }))
                        }
                      >
                        <SelectTrigger id="primary-branch" className="w-full">
                          <span
                            data-slot="select-value"
                            className="flex flex-1 items-center gap-1.5 text-left line-clamp-1"
                          >
                            {selectedPrimaryBranchName}
                          </span>
                        </SelectTrigger>
                        <SelectContent align="start">
                          {branches
                            .filter((branch) => formState.branchIds.includes(branch.id))
                            .map((branch) => {
                              const branchDisplayName = getBranchDisplayName(branch)

                              return (
                                <SelectItem
                                  key={`${branch.id}-${branchDisplayName}`}
                                  value={branch.id}
                                >
                                  {branchDisplayName}
                                </SelectItem>
                              )
                            })}
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">Module access</h3>
                    <FieldDescription>
                      Adjust individual actions if this user needs something more specific than the preset default.
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
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ?
                  "Saving..."
                : sheetMode === "edit" ?
                  "Save changes"
                : "Create user"}
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
                `Remove ${userPendingDelete.name} from this workspace?`
              : "Remove this user from the workspace?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUserPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirmed}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={provisioningResult !== null}
        onOpenChange={(open) => !open && setProvisioningResult(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login ready</DialogTitle>
            <DialogDescription>
              {provisioningResult?.temporaryPassword ?
                "Share these first-login details with the team member. They can change the password later from Forgot password."
              : "This contact is already linked to a GSTFY login. The user can sign in with their existing credentials."}
            </DialogDescription>
          </DialogHeader>

          {provisioningResult ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Login ID
                  </p>
                  <p className="text-sm font-medium">{provisioningResult.identifier}</p>
                </div>
                {provisioningResult.temporaryPassword ? (
                  <div className="mt-4 space-y-1">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Temporary password
                    </p>
                    <p className="font-mono text-sm">{provisioningResult.temporaryPassword}</p>
                  </div>
                ) : null}
              </div>

              <p className="text-sm text-muted-foreground">
                {provisioningResult.temporaryPassword ?
                  "If the user signs in with a mobile number, the current login screen will continue through OTP after account lookup. Use email contact when you want a direct password login."
                : "No new password was created because this contact already belongs to an existing GSTFY account."}
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" onClick={() => setProvisioningResult(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function formatBranchType(value: string) {
  switch (value) {
    case "retail_store":
      return "Retail store"
    case "warehouse":
      return "Warehouse"
    case "office":
      return "Office"
    default:
      return value
  }
}

function formatPresetLabel(value: PermissionPresetKey) {
  switch (value) {
    case "owner":
      return "Owner"
    case "manager":
      return "Manager"
    case "cashier":
      return "Cashier"
    case "accountant":
      return "Accountant"
    case "operations":
      return "Operations"
    case "custom":
      return "Custom"
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}

function UsersPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="space-y-3">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-4 w-[24rem] max-w-full" />
          </div>
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-[24rem] max-w-full" />
          </div>
        </div>
        <div className="space-y-3 px-4 py-4 sm:px-5 lg:px-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="grid grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((__, itemIndex) => (
                <Skeleton key={itemIndex} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
