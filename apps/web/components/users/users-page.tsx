"use client"

import * as React from "react"
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  Building2Icon,
  CheckIcon,
  ChevronDownIcon,
  Clock3Icon,
  LoaderCircleIcon,
  MinusIcon,
  MoreHorizontalIcon,
  PencilLineIcon,
  SearchXIcon,
  SearchIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  UserCheckIcon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { VerifiedBadge } from "@/components/ui/verified-badge"
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { IndianPhoneInput } from "@/components/ui/indian-phone-input"
import {
  Select,
  SelectContent,
  SelectDisplayValue,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getProfileAvatarUrl } from "@/lib/avatar"
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
  type UpsertUserPayload,
  type UsersQueryParams,
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

type UserDialogMode = "create" | "edit"
type EditablePresetKey = Exclude<PermissionPresetKey, "owner">
type UserStatusFilterValue = "all" | UserStatusValue
type UserPresetFilterValue = "all" | PermissionPresetKey
type UserSortBy = NonNullable<UsersQueryParams["sortBy"]>
type UserSortDir = NonNullable<UsersQueryParams["sortDir"]>

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
  designation?: string
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
const customDesignationValue = "other"
const designationOptions: ReadonlyArray<{
  value: EditablePresetKey | typeof customDesignationValue
  label: string
  designation: string
}> = [
  { value: "cashier", label: "Cashier", designation: "Cashier" },
  { value: "manager", label: "Manager", designation: "Branch Manager" },
  { value: "accountant", label: "Accountant", designation: "Accountant" },
  { value: "operations", label: "Operations", designation: "Operations" },
  { value: "other", label: "Other", designation: "" },
]
const designationDisplayOptions = designationOptions.map((option) => ({
  value: option.value,
  label: option.label,
}))

const userStatusFilterOptions: ReadonlyArray<{ value: UserStatusFilterValue; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
  { value: "inactive", label: "Inactive" },
]

const userPresetFilterOptions: ReadonlyArray<{ value: UserPresetFilterValue; label: string }> = [
  { value: "all", label: "All presets" },
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
  { value: "accountant", label: "Accountant" },
  { value: "operations", label: "Operations" },
  { value: "custom", label: "Custom" },
]

const permissionActionLabels: Record<PermissionActionKey, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
}
const tablePageSize = 15

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-1 text-destructive">
      *
    </span>
  )
}

function getAccessSummary(
  user: Pick<UserRecord, "isSystemManaged" | "permissionPreset" | "permissions">
) {
  if (user.isSystemManaged || user.permissionPreset === "owner") {
    return {
      labels: "Owner access is implicit",
      primaryLine: "All modules",
      secondaryLine: "Full access",
    }
  }

  const { permissions } = user
  const grantedTitles = Object.entries(permissions)
    .filter(([, permission]) => permissionActionKeys.some((action) => permission?.[action]))
    .map(([module]) => moduleTitleMap.get(module as PermissionModuleKey))
    .filter((title): title is string => Boolean(title))

  const firstLabels = grantedTitles.slice(0, 2).join(", ")
  const remainingCount = Math.max(grantedTitles.length - 2, 0)
  const moduleCount = countGrantedModules(permissions)
  const actionCount = countGrantedActions(permissions)

  return {
    actionCount,
    labels:
      grantedTitles.length === 0 ?
        "No module access assigned"
      : remainingCount > 0 ?
        `${firstLabels} +${remainingCount}`
      : firstLabels,
    moduleCount,
    primaryLine: `${moduleCount} modules /`,
    secondaryLine: `${actionCount} actions`,
  }
}

function createEmptyUserForm(branches: UserBranchRecord[]): UserFormState {
  const defaultPreset = "custom"
  const primaryBranch = branches.find((branch) => branch.isPrimary) ?? branches[0] ?? null

  return {
    name: "",
    contact: "",
    designation: "",
    status: "Active",
    permissionPreset: defaultPreset,
    permissions: createEmptyPermissionMap(),
    branchIds: primaryBranch ? [primaryBranch.id] : [],
    primaryBranchId: primaryBranch ? primaryBranch.id : null,
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
  const nameError = getNameValidationError(form.name)
  const contactError = getContactValidationError(form.contact)
  const designationError = getDesignationValidationError(form.designation)

  if (nameError) {
    errors.name = nameError
  }

  if (contactError) {
    errors.contact = contactError
  }

  if (designationError) {
    errors.designation = designationError
  }

  if (activePreset?.branchSelection === "required" && form.branchIds.length === 0) {
    errors.branchIds = "Select at least one branch for this preset."
  }

  if (!hasAtLeastOnePermission(form.permissions)) {
    errors.permissions = "Grant at least one module action."
  }

  return errors
}

function isUserFormReady(form: UserFormState, presets: UserPresetRecord[]) {
  const activePreset = presets.find((preset) => preset.key === form.permissionPreset)

  return (
    !getNameValidationError(form.name) &&
    !getContactValidationError(form.contact) &&
    !getDesignationValidationError(form.designation) &&
    Boolean(form.status) &&
    (activePreset?.branchSelection !== "required" || form.branchIds.length > 0) &&
    hasAtLeastOnePermission(form.permissions)
  )
}

function getNameValidationError(name: string) {
  const trimmedName = name.trim()

  if (!trimmedName) {
    return "Enter the user name."
  }

  if (trimmedName.length < 2) {
    return "Name must be at least 2 characters."
  }

  return null
}

function getDesignationValidationError(designation: string) {
  const trimmedDesignation = designation.trim()

  if (!trimmedDesignation) {
    return "Select or enter the designation."
  }

  if (trimmedDesignation.length < 2) {
    return "Designation must be at least 2 characters."
  }

  return null
}

function getContactValidationError(contact: string) {
  const trimmedContact = contact.trim()

  if (!trimmedContact) {
    return "Enter an email or phone number."
  }

  if (isValidEmailContact(trimmedContact) || isValidIndianMobileContact(trimmedContact)) {
    return null
  }

  return "Enter a valid email or 10-digit Indian mobile number."
}

function isValidEmailContact(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isValidIndianMobileContact(value: string) {
  const digits = value.replace(/\D/g, "")
  const localNumber =
    digits.startsWith("91") && digits.length > 10 ? digits.slice(2) : digits

  return /^[6-9]\d{9}$/.test(localNumber)
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

function isPhoneContactMode(value: string) {
  const trimmedValue = value.trim()
  const digits = normalizePhoneContactInput(trimmedValue)

  return (
    trimmedValue.length > 0 &&
    !trimmedValue.includes("@") &&
    /^[+\d\s()-]*$/.test(trimmedValue) &&
    (trimmedValue.startsWith("+") || digits.length >= 4)
  )
}

function normalizePhoneContactInput(value: string) {
  const digits = value.replace(/\D/g, "")
  const withoutCountryCode =
    digits.startsWith("91") && digits.length > 10 ? digits.slice(2) : digits

  return withoutCountryCode.slice(0, 10)
}

export function UsersPage() {
  const storedSession = getStoredAuthSession()
  const accessToken = storedSession?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const [userSearch, setUserSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<UserStatusFilterValue>("all")
  const [presetFilter, setPresetFilter] = React.useState<UserPresetFilterValue>("all")
  const [branchFilter, setBranchFilter] = React.useState("all")
  const [sortBy, setSortBy] = React.useState<UserSortBy>("name")
  const [sortDir, setSortDir] = React.useState<UserSortDir>("asc")
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([])
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false)
  const [branchAccessOpen, setBranchAccessOpen] = React.useState(false)
  const [openPermissionCategory, setOpenPermissionCategory] = React.useState(
    () => permissionCategories[0]?.title ?? ""
  )
  const deferredUserSearch = React.useDeferredValue(userSearch)
  const usersQueryParams = React.useMemo<UsersQueryParams>(
    () => ({
      search: deferredUserSearch.trim() || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      preset: presetFilter === "all" ? undefined : presetFilter,
      branchId: branchFilter === "all" ? undefined : branchFilter,
      sortBy,
      sortDir,
    }),
    [branchFilter, deferredUserSearch, presetFilter, sortBy, sortDir, statusFilter]
  )

  const usersQuery = useInfiniteQuery({
    queryKey: ["users", usersQueryParams],
    queryFn: ({ pageParam }) =>
      getUsers(accessToken, {
        ...usersQueryParams,
        page: pageParam,
        limit: tablePageSize,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: accessToken.length > 0,
    staleTime: 1000 * 30,
  })
  const data = usersQuery.data?.pages[0]
  const isLoading = usersQuery.isLoading
  const error = usersQuery.error

  const [dialogMode, setDialogMode] = React.useState<UserDialogMode | null>(null)
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null)
  const [userPendingDelete, setUserPendingDelete] = React.useState<UserRecord | null>(null)
  const [provisioningResult, setProvisioningResult] =
    React.useState<UserProvisioningRecord | null>(null)
  const [formState, setFormState] = React.useState<UserFormState>({
    name: "",
    contact: "",
    designation: "",
    status: "Active",
    permissionPreset: "custom",
    permissions: createEmptyPermissionMap(),
    branchIds: [],
    primaryBranchId: null,
  })
  const [formErrors, setFormErrors] = React.useState<UserFormErrors>({})

  const presets = React.useMemo(() => data?.presets ?? [], [data?.presets])
  const branches = React.useMemo(() => data?.branches ?? [], [data?.branches])
  const users = React.useMemo(
    () => usersQuery.data?.pages.flatMap((page) => page.users) ?? [],
    [usersQuery.data?.pages]
  )
  const totalUsersCount = usersQuery.data?.pages[0]?.pagination.total ?? users.length
  const selectableUserIds = React.useMemo(
    () => users.filter((user) => user.canEdit || user.canDelete).map((user) => user.id),
    [users]
  )
  const selectedUserIdsSet = React.useMemo(() => new Set(selectedUserIds), [selectedUserIds])
  const selectedUsers = React.useMemo(
    () => users.filter((user) => selectedUserIdsSet.has(user.id)),
    [selectedUserIdsSet, users]
  )
  const selectedEditableUsers = React.useMemo(
    () =>
      selectedUsers.filter(
        (user) => user.canEdit && isEditablePermissionPreset(user.permissionPreset)
      ),
    [selectedUsers]
  )
  const selectedDeletableUsers = React.useMemo(
    () => selectedUsers.filter((user) => user.canDelete),
    [selectedUsers]
  )
  const canBulkMarkActive = selectedEditableUsers.some(
    (user) => user.status !== "Active"
  )
  const canBulkMarkInactive = selectedEditableUsers.some(
    (user) => user.status !== "Inactive"
  )
  const shouldConstrainUsersTable = users.length > 7
  const allSelectableUsersSelected =
    selectableUserIds.length > 0 &&
    selectableUserIds.every((userId) => selectedUserIdsSet.has(userId))
  const someSelectableUsersSelected =
    selectableUserIds.some((userId) => selectedUserIdsSet.has(userId)) &&
    !allSelectableUsersSelected
  const businessName = data?.meta.businessName ?? "Primary Branch"
  const activeUsersCount = React.useMemo(
    () => users.filter((user) => user.status === "Active").length,
    [users]
  )
  const invitedUsersCount = React.useMemo(
    () => users.filter((user) => user.status === "Invited").length,
    [users]
  )
  const getBranchDisplayName = React.useCallback(
    (branch: UserBranchRecord) =>
      branch.isPrimary && branch.name === "Primary Branch" ? businessName : branch.name,
    [businessName]
  )
  const branchFilterOptions = React.useMemo(
    () => [
      { value: "all", label: "All branches" },
      ...branches.map((branch) => ({
        value: branch.id,
        label: getBranchDisplayName(branch),
      })),
    ],
    [branches, getBranchDisplayName]
  )
  const hasActiveTableControls =
    userSearch.trim().length > 0 ||
    statusFilter !== "all" ||
    presetFilter !== "all" ||
    branchFilter !== "all" ||
    sortBy !== "name" ||
    sortDir !== "asc"
  const hasAdvancedTableControls =
    presetFilter !== "all" ||
    branchFilter !== "all"
  const selectedPrimaryBranch =
    branches.find((branch) => branch.id === formState.primaryBranchId) ??
    branches.find((branch) => branch.id === formState.branchIds[0]) ??
    null
  const selectedPrimaryBranchName =
    (selectedPrimaryBranch ? getBranchDisplayName(selectedPrimaryBranch) : null) ??
    "Select primary branch"
  const formContactPhoneMode = isPhoneContactMode(formState.contact)
  const designationSelectValue = getDesignationSelectValue(
    formState.designation,
    formState.permissionPreset
  )
  const canSubmitUserForm = React.useMemo(
    () => isUserFormReady(formState, presets),
    [formState, presets]
  )

  const selectedUser = React.useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  )

  const upsertMutation = useMutation({
    mutationFn: (payload: {
      mode: UserDialogMode
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
      void queryClient.invalidateQueries({ queryKey: ["users"] })
      closeDialog()
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] })
      setUserPendingDelete(null)
      toast.success("Workspace user deleted.")
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  const bulkStatusMutation = useMutation({
    mutationFn: async (status: UserStatusValue) => {
      const operations: Array<ReturnType<typeof updateUser>> = []

      for (const user of selectedEditableUsers) {
        const payload = createBulkUserUpdatePayload(user, status)

        if (payload) {
          operations.push(updateUser(user.id, payload, accessToken))
        }
      }

      await Promise.all(operations)
    },
    onSuccess: (_result, status) => {
      void queryClient.invalidateQueries({ queryKey: ["users"] })
      const updatedCount = selectedEditableUsers.length

      setSelectedUserIds([])
      toast.success(
        `${updatedCount} user${updatedCount === 1 ? "" : "s"} marked ${status}.`
      )
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        selectedDeletableUsers.map((user) => deleteUser(user.id, accessToken))
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] })
      const deletedCount = selectedDeletableUsers.length

      setSelectedUserIds([])
      setBulkDeleteDialogOpen(false)
      toast.success(`${deletedCount} user${deletedCount === 1 ? "" : "s"} deleted.`)
    },
    onError: (mutationError) => {
      toast.error(getErrorMessage(mutationError))
    },
  })

  function handleUsersTableScroll(event: React.UIEvent<HTMLDivElement>) {
    const target = event.currentTarget
    const remainingScroll =
      target.scrollHeight - target.scrollTop - target.clientHeight

    if (
      remainingScroll < 160 &&
      usersQuery.hasNextPage &&
      !usersQuery.isFetchingNextPage
    ) {
      void usersQuery.fetchNextPage()
    }
  }

  function openCreateDialog() {
    if (!data) {
      return
    }

    setSelectedUserId(null)
    setFormState(createEmptyUserForm(data.branches))
    setFormErrors({})
    setBranchAccessOpen(false)
    setOpenPermissionCategory(permissionCategories[0]?.title ?? "")
    setDialogMode("create")
  }

  function openEditDialog(user: UserRecord) {
    if (!user.canEdit) {
      return
    }

    setSelectedUserId(user.id)
    setFormState(createFormFromUser(user))
    setFormErrors({})
    setBranchAccessOpen(false)
    setOpenPermissionCategory(permissionCategories[0]?.title ?? "")
    setDialogMode("edit")
  }

  function closeDialog() {
    setDialogMode(null)
    setSelectedUserId(null)
    setFormErrors({})
  }

  function handleContactChange(value: string) {
    const nextValue = isPhoneContactMode(value) ? normalizePhoneContactInput(value) : value

    setFormState((currentState) => ({
      ...currentState,
      contact: nextValue,
    }))
    setFormErrors((currentErrors) => ({
      ...currentErrors,
      contact: undefined,
    }))
  }

  function handleDesignationSelectChange(value: string | null) {
    if (!value) {
      return
    }

    if (value === customDesignationValue) {
      setFormState((currentState) => ({
        ...currentState,
        designation: "",
        permissionPreset: "custom",
      }))
      setFormErrors((currentErrors) => ({
        ...currentErrors,
        designation: undefined,
      }))
      return
    }

    const nextPreset = value as EditablePresetKey
    const designationOption = designationOptions.find((option) => option.value === nextPreset)
    const preset = presets.find((item) => item.key === nextPreset)
    const primaryBranch = branches.find((branch) => branch.isPrimary) ?? branches[0] ?? null

    setFormState((currentState) => {
      const nextBranchIds =
        preset?.branchSelection === "required" &&
        currentState.branchIds.length === 0 &&
        primaryBranch ?
          [primaryBranch.id]
        : currentState.branchIds

      return {
        ...currentState,
        designation: designationOption?.designation ?? currentState.designation,
        permissionPreset: nextPreset,
        permissions: buildPresetPermissions(nextPreset),
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
      designation: undefined,
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
      if (nextErrors.branchIds) {
        setBranchAccessOpen(true)
      }
      if (nextErrors.permissions) {
        setOpenPermissionCategory(permissionCategories[0]?.title ?? "")
      }
      return
    }

    upsertMutation.mutate({
      mode: dialogMode ?? "create",
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

  function clearTableControls() {
    setUserSearch("")
    setStatusFilter("all")
    setPresetFilter("all")
    setBranchFilter("all")
    setSortBy("name")
    setSortDir("asc")
  }

  function handleSortChange(nextSortBy: UserSortBy) {
    setSortDir((currentSortDir) =>
      sortBy === nextSortBy && currentSortDir === "asc" ? "desc" : "asc"
    )
    setSortBy(nextSortBy)
  }

  function toggleAllVisibleUsers() {
    setSelectedUserIds((currentUserIds) => {
      const currentUserIdsSet = new Set(currentUserIds)

      if (allSelectableUsersSelected) {
        return currentUserIds.filter((userId) => !selectableUserIds.includes(userId))
      }

      for (const userId of selectableUserIds) {
        currentUserIdsSet.add(userId)
      }

      return Array.from(currentUserIdsSet)
    })
  }

  function toggleUserSelection(user: UserRecord) {
    if (!user.canEdit && !user.canDelete) {
      return
    }

    setSelectedUserIds((currentUserIds) =>
      currentUserIds.includes(user.id) ?
        currentUserIds.filter((userId) => userId !== user.id)
      : [...currentUserIds, user.id]
    )
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
        <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="p-3.5 sm:p-4 lg:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5 bg-background">
                  <ShieldCheckIcon className="size-3.5" />
                  Access Control
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1.5 bg-background",
                    data.meta.canManageUsers &&
                      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {data.meta.canManageUsers ? "Manage access" : "View only"}
                </Badge>
              </div>
              <div className="mt-3 max-w-2xl space-y-1.5">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Users and roles
                </h1>
                <p className="max-w-xl text-sm leading-5 text-muted-foreground">
                  Invite staff, assign branch-scoped presets, and keep every module permission
                  clear before they access the workspace.
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                {data.meta.canManageUsers ? (
                  <Button type="button" className="h-8 rounded-lg" onClick={openCreateDialog}>
                    <UserPlusIcon className="size-4" />
                    Add User
                  </Button>
                ) : null}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <VerifiedBadge
                    aria-label="Owner protected"
                    size={15}
                    tone="brand"
                    variant="static"
                  />
                  Owner access stays locked for safety.
                </div>
              </div>
            </div>
            <div className="border-t border-border bg-muted/10 p-3.5 sm:p-4 lg:border-l lg:border-t-0 lg:p-5">
              <div className="grid grid-cols-2 gap-2">
                <UsersTopMetric
                  icon={<UsersIcon className="size-4" />}
                  label="Total users"
                  value={users.length.toString()}
                />
                <UsersTopMetric
                  icon={<UserCheckIcon className="size-4" />}
                  label="Active"
                  value={activeUsersCount.toString()}
                  tone="success"
                />
                <UsersTopMetric
                  icon={<Clock3Icon className="size-4" />}
                  label="Invited"
                  value={invitedUsersCount.toString()}
                />
                <UsersTopMetric
                  icon={<Building2Icon className="size-4" />}
                  label="Branches"
                  value={branches.length.toString()}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-base font-semibold">Available users</h2>
                <p className="text-sm text-muted-foreground">
                  Review branch assignments, update module access, or remove a workspace user.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:justify-end">
                <div className="relative min-w-0 sm:w-72">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Search users..."
                    className="h-8 pl-8"
                    aria-label="Search users"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter((value ?? "all") as UserStatusFilterValue)
                  }
                >
                  <SelectTrigger className="h-8 w-full sm:w-40">
                    <SelectDisplayValue
                      value={statusFilter}
                      options={userStatusFilterOptions}
                      placeholder="All statuses"
                    />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {userStatusFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-lg"
                        className="relative h-8 w-full sm:w-8"
                        aria-label="Open advanced filters"
                      />
                    }
                  >
                    <SlidersHorizontalIcon className="size-4" />
                    {hasAdvancedTableControls ? (
                      <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-blue-600" />
                    ) : null}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8} className="w-72 p-2">
                    <p className="px-2 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">
                      Advanced filters
                    </p>

                    <p className="px-2 pt-2 text-xs font-medium text-muted-foreground">
                      Preset
                    </p>
                    <DropdownMenuRadioGroup
                      value={presetFilter}
                      onValueChange={(value) =>
                        setPresetFilter((value ?? "all") as UserPresetFilterValue)
                      }
                    >
                      {userPresetFilterOptions.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>

                    <DropdownMenuSeparator />
                    <p className="px-2 text-xs font-medium text-muted-foreground">Branch</p>
                    <DropdownMenuRadioGroup
                      value={branchFilter}
                      onValueChange={(value) => setBranchFilter(value ?? "all")}
                    >
                      {branchFilterOptions.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                          <span className="truncate">{option.label}</span>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive [&_svg]:text-destructive"
                      disabled={!hasActiveTableControls}
                      onClick={clearTableControls}
                    >
                      <XIcon />
                      <span>Clear all filters</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          <div
            className={cn(
              selectedUsers.length > 0 &&
                "grid grid-rows-[auto_minmax(0,1fr)]",
              selectedUsers.length > 0 &&
                shouldConstrainUsersTable &&
                "h-[35rem] overflow-hidden"
            )}
          >
            {selectedUsers.length > 0 ? (
              <div className="flex flex-col gap-2 border-b border-border bg-muted/20 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
                <div className="text-sm">
                  <span className="font-medium">{selectedUsers.length}</span> selected
                  <span className="ml-2 text-muted-foreground">
                    {selectedEditableUsers.length} editable, {selectedDeletableUsers.length} deletable
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canBulkMarkActive || bulkStatusMutation.isPending}
                    onClick={() => bulkStatusMutation.mutate("active")}
                  >
                    Mark active
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canBulkMarkInactive || bulkStatusMutation.isPending}
                    onClick={() => bulkStatusMutation.mutate("inactive")}
                  >
                    Mark inactive
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={
                      selectedDeletableUsers.length === 0 || bulkDeleteMutation.isPending
                    }
                    onClick={() => setBulkDeleteDialogOpen(true)}
                  >
                    Delete selected
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedUserIds([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            ) : null}
          <div
            onScroll={handleUsersTableScroll}
            className={cn(
              "app-scrollbar overflow-y-auto overflow-x-hidden",
              selectedUsers.length > 0 && shouldConstrainUsersTable ?
                "min-h-0"
              : "max-h-[35rem]"
            )}
          >
            <Table className="w-full table-fixed text-[11px] sm:text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-2">
              <colgroup>
                <col className="w-[4%]" />
                <col className="w-[20%]" />
                <col className="w-[19%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[9%]" />
                <col className="w-[6%]" />
              </colgroup>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-3">
                    <SelectionCheckbox
                      checked={allSelectableUsersSelected}
                      indeterminate={someSelectableUsersSelected}
                      disabled={selectableUserIds.length === 0}
                      label="Select all users"
                      onCheckedChange={toggleAllVisibleUsers}
                    />
                  </TableHead>
                  <SortableUsersTableHead
                    sortKey="name"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSortChange}
                  >
                    User
                  </SortableUsersTableHead>
                  <SortableUsersTableHead
                    sortKey="contact"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSortChange}
                  >
                    Contact
                  </SortableUsersTableHead>
                  <SortableUsersTableHead
                    sortKey="designation"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSortChange}
                  >
                    Designation
                  </SortableUsersTableHead>
                  <SortableUsersTableHead
                    sortKey="branch"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSortChange}
                  >
                    Branches
                  </SortableUsersTableHead>
                  <SortableUsersTableHead
                    sortKey="preset"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSortChange}
                  >
                    Access
                  </SortableUsersTableHead>
                  <SortableUsersTableHead
                    sortKey="status"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSortChange}
                  >
                    Status
                  </SortableUsersTableHead>
                  <TableHead className="pr-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-64">
                      <Empty className="border-0 p-4">
                        <EmptyHeader>
                          <EmptyMedia
                            variant="icon"
                            className="bg-muted text-muted-foreground"
                          >
                            <SearchXIcon className="size-4" />
                          </EmptyMedia>
                          <EmptyTitle>No users found</EmptyTitle>
                          <EmptyDescription>
                            Try a different search term or adjust the active filters to find a
                            matching workspace user.
                          </EmptyDescription>
                        </EmptyHeader>
                        {hasActiveTableControls ? (
                          <EmptyContent>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={clearTableControls}
                            >
                              <XIcon className="size-3.5 text-destructive" />
                              Clear filters
                            </Button>
                          </EmptyContent>
                        ) : null}
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => {
                    const accessSummary = getAccessSummary(user)
                    const isSelected = selectedUserIdsSet.has(user.id)
                    const isSelectable = user.canEdit || user.canDelete

                    return (
                    <TableRow key={user.id} data-state={isSelected ? "selected" : undefined}>
                      <TableCell className="pl-3">
                        <SelectionCheckbox
                          checked={isSelected}
                          disabled={!isSelectable}
                          label={`Select ${user.name}`}
                          onCheckedChange={() => toggleUserSelection(user)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Avatar className="size-6">
                            {user.profileImageSeed ? (
                              <AvatarImage
                                src={getProfileAvatarUrl(user.profileImageSeed)}
                                alt={`${user.name} avatar`}
                              />
                            ) : null}
                            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <p className="truncate font-medium">{user.name}</p>
                              {user.isSystemManaged ? (
                                <Badge variant="outline" className="hidden shrink-0 gap-1 sm:inline-flex">
                                  <VerifiedBadge
                                    decorative
                                    size={14}
                                    tone="brand"
                                    variant="static"
                                  />
                                  Owner
                                </Badge>
                              ) : null}
                            </div>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {user.linkedAuthUser ?
                                "Ready for login"
                              : "Workspace-only"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="truncate text-muted-foreground">
                        {user.contact}
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0 space-y-0.5">
                          <p className="truncate font-medium">{user.designation}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {formatPresetLabel(user.permissionPreset)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0 space-y-0.5">
                          <p className="truncate font-medium">
                            {user.branchNames[0] ?? "No branch assigned"}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {user.branchNames.length > 1 ?
                              `${user.branchNames.length} branches linked`
                            : "Primary scope"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-medium leading-4">
                            {accessSummary.primaryLine}
                            <br />
                            {accessSummary.secondaryLine}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {accessSummary.labels}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.status === "Active" ? "default" : "secondary"}
                          className={cn(
                            "max-w-full truncate px-1 py-0 text-[10px]",
                            user.status === "Active" &&
                              "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          )}
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-3 text-right">
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
                                <DropdownMenuItem onClick={() => openEditDialog(user)}>
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
                  })
                )}
              </TableBody>
            </Table>
            {usersQuery.isFetchingNextPage ? (
              <div className="flex items-center justify-center gap-2 border-t border-border px-3 py-3 text-xs text-muted-foreground">
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                Loading more users
              </div>
            ) : usersQuery.hasNextPage ? (
              <div className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
                Scroll to load more · {users.length} of {totalUsersCount}
              </div>
            ) : users.length > tablePageSize ? (
              <div className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
                All {totalUsersCount} users loaded
              </div>
            ) : null}
          </div>
          </div>
        </section>
      </div>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl gap-0 overflow-hidden p-0">
          <form
            className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col"
            onSubmit={handleSubmit}
          >
            <DialogHeader className="border-b border-border px-4 py-4 pr-12">
              <DialogTitle>
                {dialogMode === "edit" ? "Edit user access" : "Add a new user"}
              </DialogTitle>
              <DialogDescription>
                {dialogMode === "edit" ?
                  "Update the branch scope and module actions for this workspace user."
                : "Enter the user details, select branch access, and grant only the module actions they need."}
              </DialogDescription>
            </DialogHeader>

            <div className="app-scrollbar flex-1 overflow-y-auto px-4 py-4">
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field data-invalid={Boolean(formErrors.name)}>
                    <FieldLabel htmlFor="user-name">
                      Full name
                      <RequiredMark />
                    </FieldLabel>
                    <Input
                      id="user-name"
                      aria-invalid={Boolean(formErrors.name)}
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

                  <Field data-invalid={Boolean(formErrors.contact)}>
                    <FieldLabel htmlFor="user-contact">
                      Email or phone number
                      <RequiredMark />
                    </FieldLabel>
                    <IndianPhoneInput
                      id="user-contact"
                      type="text"
                      aria-invalid={Boolean(formErrors.contact)}
                      value={formState.contact}
                      inputMode={formContactPhoneMode ? "numeric" : "email"}
                      maxLength={formContactPhoneMode ? 10 : undefined}
                      numericOnly={false}
                      showPrefix={formContactPhoneMode}
                      placeholder={
                        formContactPhoneMode ? "0000000000" : "owner@gstfy.in"
                      }
                      autoComplete={formContactPhoneMode ? "tel-national" : "email"}
                      inputClassName={cn(formContactPhoneMode && "font-mono")}
                      onChange={(event) => handleContactChange(event.target.value)}
                    />
                    <FieldError>{formErrors.contact}</FieldError>
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    data-invalid={
                      Boolean(formErrors.designation) &&
                      designationSelectValue !== customDesignationValue
                    }
                  >
                    <FieldLabel htmlFor="user-designation">
                      Designation
                      <RequiredMark />
                    </FieldLabel>
                    <Select
                      value={designationSelectValue}
                      onValueChange={handleDesignationSelectChange}
                    >
                      <SelectTrigger
                        id="user-designation"
                        aria-invalid={
                          Boolean(formErrors.designation) &&
                          designationSelectValue !== customDesignationValue
                        }
                        className="w-full"
                      >
                        <SelectDisplayValue
                          value={designationSelectValue}
                          options={designationDisplayOptions}
                          placeholder="Select designation"
                        />
                      </SelectTrigger>
                      <SelectContent
                        align="start"
                        alignItemWithTrigger={false}
                        sideOffset={8}
                      >
                        {designationOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {designationSelectValue !== customDesignationValue ? (
                      <FieldError>{formErrors.designation}</FieldError>
                    ) : null}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="user-status">
                      Status
                      <RequiredMark />
                    </FieldLabel>
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
                      <SelectContent
                        align="start"
                        alignItemWithTrigger={false}
                        sideOffset={8}
                      >
                        {statusOptions.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {designationSelectValue === customDesignationValue ? (
                  <Field data-invalid={Boolean(formErrors.designation)}>
                    <FieldLabel htmlFor="user-custom-designation">
                      Other designation
                      <RequiredMark />
                    </FieldLabel>
                    <Input
                      id="user-custom-designation"
                      aria-invalid={Boolean(formErrors.designation)}
                      value={formState.designation}
                      onChange={(event) => {
                        setFormState((currentState) => ({
                          ...currentState,
                          designation: event.target.value,
                        }))
                        setFormErrors((currentErrors) => ({
                          ...currentErrors,
                          designation: undefined,
                        }))
                      }}
                      placeholder="Enter custom designation"
                    />
                    <FieldError>{formErrors.designation}</FieldError>
                  </Field>
                ) : null}

                <div className="overflow-hidden rounded-2xl border border-border/70">
                  <button
                    type="button"
                    aria-expanded={branchAccessOpen}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                    onClick={() => setBranchAccessOpen((isOpen) => !isOpen)}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2Icon className="size-4 text-muted-foreground" />
                        <h3 className="text-sm font-medium">Branch access</h3>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {formState.branchIds.length === 0 ?
                          "No branches selected"
                        : `${formState.branchIds.length} branch${formState.branchIds.length === 1 ? "" : "es"} selected`}
                      </p>
                    </div>
                    <ChevronDownIcon
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        branchAccessOpen && "rotate-180"
                      )}
                    />
                  </button>
                  {branchAccessOpen ? (
                    <div className="space-y-3 border-t border-border/70 p-3">
                      <FieldDescription>
                        Scope this user to the branches they actually operate in. Manager, Cashier, and Operations presets require at least one branch.
                      </FieldDescription>
                      <FieldError>{formErrors.branchIds}</FieldError>
                      <div className="app-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                        {branches.map((branch) => {
                          const isSelected = formState.branchIds.includes(branch.id)
                          const branchDisplayName = getBranchDisplayName(branch)

                          return (
                            <button
                              key={branch.id}
                              type="button"
                              onClick={() => handleBranchToggle(branch.id)}
                              className={cn(
                                "relative flex w-52 shrink-0 flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
                                isSelected ?
                                  "border-foreground bg-muted/40"
                                : "border-border bg-background hover:bg-muted/20"
                              )}
                            >
                              {isSelected ? (
                                <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                  <CheckIcon className="size-3.5" />
                                  <span className="sr-only">Selected</span>
                                </span>
                              ) : null}
                              <div className="pr-7">
                                <p className="truncate font-medium">{branchDisplayName}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {branch.code} • {formatBranchType(branch.type)}
                                </p>
                              </div>
                              <div className="mt-auto flex items-center gap-2">
                                {branch.isPrimary ? (
                                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                    Primary
                                  </Badge>
                                ) : null}
                                <span
                                  className={cn(
                                    "inline-flex size-2 rounded-full",
                                    branch.status === "active" ?
                                      "bg-emerald-500"
                                    : "bg-muted-foreground/40"
                                  )}
                                  aria-label={branch.status}
                                  title={branch.status}
                                >
                                  <span className="sr-only">{branch.status}</span>
                                </span>
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
                            <SelectContent align="start" alignItemWithTrigger={false}>
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
                  <div className="space-y-2">
                    {permissionCategories.map((category) => {
                      const isOpen = openPermissionCategory === category.title
                      const grantedActions = category.items.reduce((total, item) => {
                        const modulePermission = createPermissionEntry(
                          formState.permissions[item.module]
                        )

                        return (
                          total +
                          permissionActionKeys.filter((action) => modulePermission[action]).length
                        )
                      }, 0)

                      return (
                        <div
                          key={category.title}
                          className="overflow-hidden rounded-2xl border border-border/70"
                        >
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                            onClick={() =>
                              setOpenPermissionCategory((currentCategory) =>
                                currentCategory === category.title ? "" : category.title
                              )
                            }
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{category.title}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {category.items.length} modules • {grantedActions} actions enabled
                              </p>
                            </div>
                            <ChevronDownIcon
                              className={cn(
                                "size-4 shrink-0 text-muted-foreground transition-transform",
                                isOpen && "rotate-180"
                              )}
                            />
                          </button>
                          {isOpen ? (
                            <div className="divide-y divide-border/70 border-t border-border/70">
                              {category.items.map((item) => {
                                const modulePermission = createPermissionEntry(
                                  formState.permissions[item.module]
                                )

                                return (
                                  <div
                                    key={item.module}
                                    className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
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
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </FieldGroup>
            </div>

            <div className="flex flex-col gap-2 border-t border-border px-4 py-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmitUserForm || upsertMutation.isPending}>
                {upsertMutation.isPending ?
                  <LoaderCircleIcon className="size-4 animate-spin" />
                : dialogMode === "edit" ?
                  "Save changes"
                : "Create user"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={userPendingDelete !== null}
        onOpenChange={(open) => !open && setUserPendingDelete(null)}
      >
        {userPendingDelete ? (
          <DialogContent showCloseButton={false} className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Delete workspace user</DialogTitle>
              <DialogDescription>
                Review what will change before removing this user from the workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="size-10">
                    {userPendingDelete.profileImageSeed ? (
                      <AvatarImage
                        src={getProfileAvatarUrl(userPendingDelete.profileImageSeed)}
                        alt={`${userPendingDelete.name} avatar`}
                      />
                    ) : null}
                    <AvatarFallback>{getInitials(userPendingDelete.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{userPendingDelete.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {userPendingDelete.contact}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">{userPendingDelete.designation}</Badge>
                      {userPendingDelete.designation.trim().toLowerCase() !==
                      formatPresetLabel(userPendingDelete.permissionPreset).toLowerCase() ? (
                        <Badge variant="outline">
                          {formatPresetLabel(userPendingDelete.permissionPreset)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
                <DeleteImpactRow
                  label="Branches"
                  value={
                    userPendingDelete.branchNames.length > 0 ?
                      `Access will be removed from ${userPendingDelete.branchNames.join(", ")}.`
                    : "No branch access is currently assigned."
                  }
                />
                <DeleteImpactRow
                  label="Permissions"
                  value={`Module permissions will be removed: ${getAccessSummary(userPendingDelete).labels}.`}
                />
                <DeleteImpactRow
                  label="Login"
                  value="Their GSTFY login account stays active for other workspaces."
                />
              </div>
              <p className="text-sm text-destructive">
                This action removes workspace access. Add the user again if they need access later.
              </p>
            </div>
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
                {deleteMutation.isPending ?
                  <LoaderCircleIcon className="size-4 animate-spin" />
                : "Delete user"}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={bulkDeleteDialogOpen}
        onOpenChange={(open) => !open && setBulkDeleteDialogOpen(false)}
      >
        {bulkDeleteDialogOpen ? (
          <DialogContent showCloseButton={false} className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Delete selected users</DialogTitle>
              <DialogDescription>
                Review the selected users before removing their workspace access.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Selected</p>
                  <p className="mt-1 text-xl font-semibold">{selectedUsers.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Will delete</p>
                  <p className="mt-1 text-xl font-semibold text-destructive">
                    {selectedDeletableUsers.length}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Locked</p>
                  <p className="mt-1 text-xl font-semibold">
                    {selectedUsers.length - selectedDeletableUsers.length}
                  </p>
                </div>
              </div>
              <div className="app-scrollbar max-h-56 space-y-2 overflow-y-auto pr-1">
                {selectedDeletableUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
                  >
                    <Avatar className="size-8">
                      {user.profileImageSeed ? (
                        <AvatarImage
                          src={getProfileAvatarUrl(user.profileImageSeed)}
                          alt={`${user.name} avatar`}
                        />
                      ) : null}
                      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.contact}</p>
                    </div>
                    <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
                      {formatPresetLabel(user.permissionPreset)}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                Owner and locked users are skipped. Deleted users lose branch and module access for this workspace, but their login account remains available for other workspaces.
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setBulkDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => bulkDeleteMutation.mutate()}
                disabled={selectedDeletableUsers.length === 0 || bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ?
                  <LoaderCircleIcon className="size-4 animate-spin" />
                : `Delete ${selectedDeletableUsers.length} user${
                    selectedDeletableUsers.length === 1 ? "" : "s"
                  }`}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={provisioningResult !== null}
        onOpenChange={(open) => !open && setProvisioningResult(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login ready</DialogTitle>
            <DialogDescription>
              {provisioningResult ?
                getProvisioningDescription(provisioningResult)
              : "The user login details are ready."}
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
                {provisioningResult.emailDelivery?.attempted ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1.5",
                        provisioningResult.emailDelivery.sent &&
                          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
                        !provisioningResult.emailDelivery.sent &&
                          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                      )}
                    >
                      {provisioningResult.emailDelivery.sent ?
                        "Email sent"
                      : "Email not sent"}
                    </Badge>
                    {!provisioningResult.emailDelivery.sent &&
                    provisioningResult.emailDelivery.reason ? (
                      <span className="text-xs text-muted-foreground">
                        {provisioningResult.emailDelivery.reason}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <p className="text-sm text-muted-foreground">
                {getProvisioningHelpText(provisioningResult)}
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

function getProvisioningDescription(provisioning: UserProvisioningRecord) {
  if (provisioning.temporaryPassword) {
    return provisioning.emailDelivery?.sent ?
        "A temporary password was created and emailed to the team member."
      : "A temporary password was created. Share it manually if email delivery was skipped or failed."
  }

  if (provisioning.loginMethod === "otp") {
    return "This mobile number can sign in through OTP after account lookup."
  }

  return "This email is already linked to a GSTFY login. The user can sign in with their existing credentials."
}

function getProvisioningHelpText(provisioning: UserProvisioningRecord) {
  if (provisioning.temporaryPassword) {
    return provisioning.emailDelivery?.sent ?
        "The email contains the login email and temporary password. The user can change it after first login."
      : "Email delivery did not complete, so copy the login ID and temporary password from here and share it securely."
  }

  if (provisioning.loginMethod === "otp") {
    return "No password or email is generated for mobile-only users."
  }

  return "No new password was created because this contact already belongs to an existing GSTFY account."
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

function getDesignationSelectValue(
  designation: string,
  permissionPreset: EditablePresetKey
) {
  if (permissionPreset !== "custom") {
    return permissionPreset
  }

  const normalizedDesignation = designation.trim().toLowerCase()
  const matchedOption = designationOptions.find(
    (option) =>
      option.value !== customDesignationValue &&
      option.designation.toLowerCase() === normalizedDesignation
  )

  return matchedOption?.value ?? customDesignationValue
}

function isEditablePermissionPreset(
  preset: PermissionPresetKey
): preset is EditablePresetKey {
  return preset !== "owner"
}

function createBulkUserUpdatePayload(
  user: UserRecord,
  status: UserStatusValue
): UpsertUserPayload | null {
  if (!isEditablePermissionPreset(user.permissionPreset)) {
    return null
  }

  return {
    name: user.name,
    contact: user.contact,
    designation: user.designation,
    status,
    permissionPreset: user.permissionPreset,
    branchIds: user.branchIds,
    ...(user.primaryBranchId ? { primaryBranchId: user.primaryBranchId } : {}),
    permissions: user.permissions,
  }
}

function SortableUsersTableHead({
  children,
  onSort,
  sortBy,
  sortDir,
  sortKey,
}: {
  children: React.ReactNode
  onSort: (sortBy: UserSortBy) => void
  sortBy: UserSortBy
  sortDir: UserSortDir
  sortKey: UserSortBy
}) {
  const isActive = sortBy === sortKey
  const SortIcon =
    !isActive ? ArrowUpDownIcon
    : sortDir === "asc" ? ArrowUpIcon
    : ArrowDownIcon

  return (
    <TableHead>
      <button
        type="button"
        className={cn(
          "flex max-w-full items-center gap-1 rounded-md text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive ? "text-primary" : "text-foreground"
        )}
        onClick={() => onSort(sortKey)}
      >
        <span className="truncate">{children}</span>
        <SortIcon
          className={cn(
            "size-3 shrink-0",
            !isActive && "text-muted-foreground/70"
          )}
        />
      </button>
    </TableHead>
  )
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  label,
  onCheckedChange,
}: {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  label: string
  onCheckedChange: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      disabled={disabled}
      onClick={onCheckedChange}
      className={cn(
        "flex size-4 items-center justify-center rounded-sm border border-input bg-background text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40",
        (checked || indeterminate) && "border-primary bg-primary text-primary-foreground"
      )}
    >
      {checked ? (
        <CheckIcon className="size-3" />
      ) : indeterminate ? (
        <MinusIcon className="size-3" />
      ) : null}
    </button>
  )
}

function UsersTopMetric({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: "default" | "success"
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground",
            tone === "success" &&
              "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function DeleteImpactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-start">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="min-w-0 break-words text-sm leading-5 text-muted-foreground">
        {value}
      </p>
    </div>
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}

function UsersPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="p-3.5 sm:p-4 lg:p-5">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="mt-3 space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-[32rem] max-w-full" />
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="border-t border-border bg-muted/10 p-3.5 sm:p-4 lg:border-l lg:border-t-0 lg:p-5">
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-lg border border-border bg-background p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="size-6 rounded-md" />
                  </div>
                  <Skeleton className="mt-1 h-6 w-10" />
                </div>
              ))}
            </div>
          </div>
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
