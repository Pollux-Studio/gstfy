"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArchiveIcon,
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ContactRoundIcon,
  EyeIcon,
  LandmarkIcon,
  MapPinIcon,
  MinusIcon,
  MoreHorizontalIcon,
  PencilLineIcon,
  PlusIcon,
  ReceiptTextIcon,
  SearchIcon,
  ShieldCheckIcon,
  StoreIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"

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
import { IndianPhoneInput } from "@/components/ui/indian-phone-input"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectDisplayValue,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  addPartyAddress,
  addPartyContact,
  addPartyGstRegistration,
  archivePartyAddress,
  archivePartyContact,
  archivePartyGstRegistration,
  archiveParty,
  createParty,
  getParty,
  listParties,
  saveCustomerProfile,
  saveSupplierProfile,
  updateParty,
  updatePartyAddress,
  updatePartyContact,
  updatePartyGstRegistration,
  type CreatePartyPayload,
  type PartyDetail,
  type PartyListItem,
  type PartyRole,
  type PartySortBy,
  type PartySortDir,
  type PartyStatus,
  type PartyType,
  type UpdatePartyPayload,
} from "@/lib/parties/api"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getProfileAvatarUrl } from "@/lib/avatar"
import { cn } from "@/lib/utils"

type FilterState = {
  search: string
  role: PartyRole | "all"
  status: PartyStatus | "all"
}

type SheetMode = "create" | "edit"

type PartyFormState = {
  displayName: string
  partyType: PartyType
  isCustomer: boolean
  isSupplier: boolean
  legalName: string
  tradeName: string
  shortName: string
  pan: string
  status: PartyStatus
  notes: string
  hasGst: boolean
  gstin: string
  gstLegalName: string
  gstTradeName: string
  gstStateCode: string
  gstState: string
  taxpayerType: string
  addressLine1: string
  addressLine2: string
  city: string
  district: string
  state: string
  stateCode: string
  pincode: string
  contactName: string
  contactEmail: string
  contactMobile: string
  customerCreditLimit: string
  customerCreditDays: string
  supplierCreditDays: string
  supplierLeadTimeDays: string
}

type PartyFormErrors = Partial<Record<keyof PartyFormState | "roles", string>>

const emptyForm: PartyFormState = {
  displayName: "",
  partyType: "business",
  isCustomer: true,
  isSupplier: false,
  legalName: "",
  tradeName: "",
  shortName: "",
  pan: "",
  status: "active",
  notes: "",
  hasGst: false,
  gstin: "",
  gstLegalName: "",
  gstTradeName: "",
  gstStateCode: "",
  gstState: "",
  taxpayerType: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  district: "",
  state: "",
  stateCode: "",
  pincode: "",
  contactName: "",
  contactEmail: "",
  contactMobile: "",
  customerCreditLimit: "0",
  customerCreditDays: "0",
  supplierCreditDays: "0",
  supplierLeadTimeDays: "0",
}

const partyTypeLabels: Record<PartyType, string> = {
  business: "Business",
  individual: "Individual",
  government: "Government",
  other: "Other",
}

const statusLabels: Record<PartyStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  blocked: "Blocked",
  archived: "Archived",
}

const partyTypes: PartyType[] = ["business", "individual", "government", "other"]
const partyStatuses: PartyStatus[] = ["active", "inactive", "blocked", "archived"]
const partyTypeOptions: ReadonlyArray<{ value: PartyType; label: string }> =
  partyTypes.map((type) => ({
    value: type,
    label: partyTypeLabels[type],
  }))
const statusOptions: ReadonlyArray<{ value: PartyStatus; label: string }> =
  partyStatuses.map((status) => ({
    value: status,
    label: statusLabels[status],
  }))
const roleFilterOptions: ReadonlyArray<{ value: PartyRole | "all"; label: string }> = [
  { value: "all", label: "All roles" },
  { value: "customer", label: "Customers" },
  { value: "supplier", label: "Suppliers" },
]
const statusFilterOptions: ReadonlyArray<{
  value: PartyStatus | "all"
  label: string
}> = [
  { value: "all", label: "All statuses" },
  ...statusOptions,
]

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function createFormFromParty(party: PartyListItem | PartyDetail): PartyFormState {
  const primaryAddress =
    "addresses" in party ?
      party.addresses.find((address) => address.isPrimary) ?? party.addresses[0] ?? null
    : null
  const primaryContact =
    party.primaryContact ??
    ("contacts" in party ?
      party.contacts.find((contact) => contact.isPrimary) ?? party.contacts[0] ?? null
    : null)
  const customerProfile = "customerProfile" in party ? party.customerProfile : null
  const supplierProfile = "supplierProfile" in party ? party.supplierProfile : null

  return {
    ...emptyForm,
    displayName: party.displayName,
    partyType: party.partyType,
    isCustomer: party.roles.includes("customer"),
    isSupplier: party.roles.includes("supplier"),
    legalName: party.legalName ?? "",
    tradeName: party.tradeName ?? "",
    shortName: party.shortName ?? "",
    pan: party.pan ?? "",
    status: party.status,
    hasGst: Boolean(party.primaryGstRegistration),
    gstin: party.primaryGstRegistration?.gstin ?? "",
    gstLegalName: party.primaryGstRegistration?.legalName ?? "",
    gstTradeName: party.primaryGstRegistration?.tradeName ?? "",
    gstStateCode: party.primaryGstRegistration?.stateCode ?? "",
    gstState: party.primaryGstRegistration?.state ?? "",
    taxpayerType: party.primaryGstRegistration?.taxpayerType ?? "",
    addressLine1: primaryAddress?.addressLine1 ?? "",
    addressLine2: primaryAddress?.addressLine2 ?? "",
    city: primaryAddress?.city ?? "",
    district: primaryAddress?.district ?? "",
    state: primaryAddress?.state ?? "",
    stateCode: primaryAddress?.stateCode ?? "",
    pincode: primaryAddress?.pincode ?? "",
    contactName: primaryContact?.name ?? "",
    contactEmail: primaryContact?.email ?? "",
    contactMobile: primaryContact?.mobile ?? "",
    customerCreditLimit: customerProfile?.creditLimit ?? "0",
    customerCreditDays: customerProfile?.creditDays.toString() ?? "0",
    supplierCreditDays: supplierProfile?.creditDays.toString() ?? "0",
    supplierLeadTimeDays: supplierProfile?.leadTimeDays.toString() ?? "0",
  }
}

export function PartiesPage() {
  const storedSession = getStoredAuthSession()
  const accessToken = storedSession?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const [filters, setFilters] = React.useState<FilterState>({
    search: "",
    role: "all",
    status: "active",
  })
  const [sortBy, setSortBy] = React.useState<PartySortBy>("name")
  const [sortDir, setSortDir] = React.useState<PartySortDir>("asc")
  const [selectedPartyIds, setSelectedPartyIds] = React.useState<string[]>([])
  const [bulkArchiveDialogOpen, setBulkArchiveDialogOpen] = React.useState(false)
  const [sheetMode, setSheetMode] = React.useState<SheetMode | null>(null)
  const [selectedPartyId, setSelectedPartyId] = React.useState<string | null>(null)
  const [detailPartyId, setDetailPartyId] = React.useState<string | null>(null)
  const [partyPendingArchive, setPartyPendingArchive] =
    React.useState<PartyListItem | null>(null)
  const [formState, setFormState] = React.useState<PartyFormState>(emptyForm)
  const [formErrors, setFormErrors] = React.useState<PartyFormErrors>({})

  const partiesQuery = useQuery({
    queryKey: ["parties", filters, sortBy, sortDir],
    queryFn: () =>
      listParties(accessToken, {
        search: filters.search.trim() || undefined,
        role: filters.role === "all" ? undefined : filters.role,
        status: filters.status === "all" ? undefined : filters.status,
        sortBy,
        sortDir,
        limit: 100,
      }),
    enabled: accessToken.length > 0,
    staleTime: 1000 * 60 * 3,
  })

  const detailQuery = useQuery({
    queryKey: ["parties", "detail", detailPartyId],
    queryFn: () => getParty(detailPartyId ?? "", accessToken),
    enabled: accessToken.length > 0 && Boolean(detailPartyId),
    staleTime: 1000 * 60 * 3,
  })
  const rawParties = React.useMemo(
    () => partiesQuery.data?.parties ?? [],
    [partiesQuery.data?.parties]
  )
  const parties = React.useMemo(
    () => sortParties(rawParties, sortBy, sortDir),
    [rawParties, sortBy, sortDir]
  )
  const selectedPartyIdsSet = React.useMemo(
    () => new Set(selectedPartyIds),
    [selectedPartyIds]
  )
  const selectedParties = React.useMemo(
    () => parties.filter((party) => selectedPartyIdsSet.has(party.id)),
    [parties, selectedPartyIdsSet]
  )
  const selectedArchivableParties = React.useMemo(
    () => selectedParties.filter((party) => party.status !== "archived"),
    [selectedParties]
  )
  const selectablePartyIds = parties.map((party) => party.id)
  const allSelectablePartiesSelected =
    selectablePartyIds.length > 0 &&
    selectablePartyIds.every((partyId) => selectedPartyIdsSet.has(partyId))
  const someSelectablePartiesSelected =
    selectablePartyIds.some((partyId) => selectedPartyIdsSet.has(partyId)) &&
    !allSelectablePartiesSelected
  const canBulkMarkActive = selectedParties.some((party) => party.status !== "active")
  const canBulkMarkInactive = selectedParties.some((party) => party.status !== "inactive")
  const shouldConstrainPartiesTable = parties.length > 7
  const selectedParty = parties.find((party) => party.id === selectedPartyId) ?? null
  const detailParty = detailQuery.data?.party ?? null
  const customerPartiesCount = parties.filter((party) =>
    party.roles.includes("customer")
  ).length
  const supplierPartiesCount = parties.filter((party) =>
    party.roles.includes("supplier")
  ).length
  const gstRegisteredPartiesCount = parties.filter((party) =>
    Boolean(party.primaryGstRegistration)
  ).length

  const upsertMutation = useMutation({
    mutationFn: async (payload: {
      mode: SheetMode
      partyId?: string
      form: PartyFormState
    }) => {
      if (payload.mode === "edit" && payload.partyId) {
        const updatedParty = await updateParty(
          payload.partyId,
          buildUpdatePayload(payload.form),
          accessToken
        )

        return savePartyChildrenForEdit(
          payload.partyId,
          payload.form,
          updatedParty.party,
          accessToken
        )
      }

      return createParty(buildCreatePayload(payload.form), accessToken)
    },
    onSuccess: (response, payload) => {
      queryClient.invalidateQueries({ queryKey: ["parties"] })
      queryClient.setQueryData(["parties", "detail", response.party.id], response)
      closeSheet()
      toast.success(payload.mode === "edit" ? "Party updated." : "Party created.")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const archiveMutation = useMutation({
    mutationFn: (partyId: string) => archiveParty(partyId, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] })
      setPartyPendingArchive(null)
      toast.success("Party archived.")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const bulkStatusMutation = useMutation({
    mutationFn: async (status: PartyStatus) => {
      const partiesToUpdate = selectedParties.filter((party) => party.status !== status)

      await Promise.all(
        partiesToUpdate.map((party) => updateParty(party.id, { status }, accessToken))
      )
    },
    onSuccess: (_result, status) => {
      queryClient.invalidateQueries({ queryKey: ["parties"] })
      const updatedCount = selectedParties.filter((party) => party.status !== status).length

      setSelectedPartyIds([])
      toast.success(
        `${updatedCount} part${updatedCount === 1 ? "y" : "ies"} marked ${status}.`
      )
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const bulkArchiveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        selectedArchivableParties.map((party) => archiveParty(party.id, accessToken))
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] })
      const archivedCount = selectedArchivableParties.length

      setSelectedPartyIds([])
      setBulkArchiveDialogOpen(false)
      toast.success(
        `${archivedCount} part${archivedCount === 1 ? "y" : "ies"} archived.`
      )
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openCreateSheet() {
    setSelectedPartyId(null)
    setFormState(emptyForm)
    setFormErrors({})
    setSheetMode("create")
  }

  async function openEditSheet(party: PartyListItem) {
    setSelectedPartyId(party.id)
    setFormState(createFormFromParty(party))
    setFormErrors({})
    setSheetMode("edit")

    try {
      const response = await queryClient.fetchQuery({
        queryKey: ["parties", "detail", party.id],
        queryFn: () => getParty(party.id, accessToken),
        staleTime: 1000 * 60 * 3,
      })
      setFormState(createFormFromParty(response.party))
      setFormErrors({})
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  function closeSheet() {
    setSheetMode(null)
    setSelectedPartyId(null)
    setFormErrors({})
  }

  function updateFormValue<K extends keyof PartyFormState>(
    key: K,
    value: PartyFormState[K]
  ) {
    setFormState((current) => ({ ...current, [key]: value }))
    setFormErrors((currentErrors) => ({ ...currentErrors, [key]: undefined }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = validatePartyForm(formState)

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    upsertMutation.mutate({
      mode: sheetMode ?? "create",
      partyId: selectedParty?.id,
      form: formState,
    })
  }

  function handleSortChange(nextSortBy: PartySortBy) {
    setSortDir((currentSortDir) =>
      sortBy === nextSortBy && currentSortDir === "asc" ? "desc" : "asc"
    )
    setSortBy(nextSortBy)
  }

  function toggleAllVisibleParties() {
    setSelectedPartyIds((currentPartyIds) => {
      const currentPartyIdsSet = new Set(currentPartyIds)

      if (allSelectablePartiesSelected) {
        return currentPartyIds.filter((partyId) => !selectablePartyIds.includes(partyId))
      }

      for (const partyId of selectablePartyIds) {
        currentPartyIdsSet.add(partyId)
      }

      return Array.from(currentPartyIdsSet)
    })
  }

  function togglePartySelection(party: PartyListItem) {
    setSelectedPartyIds((currentPartyIds) =>
      currentPartyIds.includes(party.id) ?
        currentPartyIds.filter((partyId) => partyId !== party.id)
      : [...currentPartyIds, party.id]
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
                  <UsersIcon className="size-3.5" />
                  Party Master
                </Badge>
                <Badge
                  variant="outline"
                  className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  GST ready
                </Badge>
              </div>
              <div className="mt-3 max-w-2xl space-y-1.5">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Parties
                </h1>
                <p className="max-w-xl text-sm leading-5 text-muted-foreground">
                  Keep customers and suppliers in one clean register with GSTIN,
                  PAN, contact, and credit profile context.
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button type="button" className="h-8 rounded-lg" onClick={openCreateSheet}>
                  <PlusIcon className="size-4" />
                  Add Party
                </Button>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheckIcon className="size-3.5" />
                  One identity can be customer, supplier, or both.
                </div>
              </div>
            </div>
            <div className="border-t border-border bg-muted/10 p-3.5 sm:p-4 lg:border-l lg:border-t-0 lg:p-5">
              <div className="grid grid-cols-2 gap-2">
                <PartiesTopMetric
                  icon={<ContactRoundIcon className="size-4" />}
                  label="Visible"
                  value={parties.length.toString()}
                />
                <PartiesTopMetric
                  icon={<StoreIcon className="size-4" />}
                  label="Customers"
                  value={customerPartiesCount.toString()}
                  tone="success"
                />
                <PartiesTopMetric
                  icon={<ReceiptTextIcon className="size-4" />}
                  label="Suppliers"
                  value={supplierPartiesCount.toString()}
                />
                <PartiesTopMetric
                  icon={<LandmarkIcon className="size-4" />}
                  label="GSTIN"
                  value={gstRegisteredPartiesCount.toString()}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
          <div className="border-b border-border px-4 py-3 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Party register</h2>
                <p className="text-sm text-muted-foreground">
                  Search by name, GSTIN, PAN, phone, email, or party code.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <div className="relative sm:w-56 lg:w-64">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={filters.search}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        search: event.target.value,
                      }))
                    }
                    className="h-7 rounded-md pl-7 text-xs"
                    placeholder="Search parties..."
                  />
                </div>
                <Select
                  value={filters.role}
                  onValueChange={(value) =>
                    setFilters((current) => ({
                      ...current,
                      role: (value as PartyRole | "all" | null) ?? "all",
                    }))
                  }
                >
                  <SelectTrigger size="sm" className="w-full justify-between sm:w-32">
                    <SelectDisplayValue
                      value={filters.role}
                      options={roleFilterOptions}
                      placeholder="Role"
                    />
                  </SelectTrigger>
                  <SelectContent align="end" sideOffset={6} className="min-w-32">
                    {roleFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters((current) => ({
                      ...current,
                      status: (value as PartyStatus | "all" | null) ?? "all",
                    }))
                  }
                >
                  <SelectTrigger size="sm" className="w-full justify-between sm:w-32">
                    <SelectDisplayValue
                      value={filters.status}
                      options={statusFilterOptions}
                      placeholder="Status"
                    />
                  </SelectTrigger>
                  <SelectContent align="end" sideOffset={6} className="min-w-32">
                    {statusFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {partiesQuery.isLoading ? (
            <PartiesTableSkeleton />
          ) : parties.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                <ContactRoundIcon className="size-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h3 className="font-medium">No parties found</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  Add your first customer, supplier, or both-role party to start using
                  them in sales, purchases, and GST reconciliation.
                </p>
              </div>
              <Button type="button" onClick={openCreateSheet}>
                <PlusIcon className="size-4" />
                Add Party
              </Button>
            </div>
          ) : (
            <div
              className={cn(
                selectedParties.length > 0 && "grid grid-rows-[auto_minmax(0,1fr)]",
                selectedParties.length > 0 &&
                  shouldConstrainPartiesTable &&
                  "h-[35rem] overflow-hidden"
              )}
            >
              {selectedParties.length > 0 ? (
                <div className="flex flex-col gap-2 border-b border-border bg-muted/20 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
                  <div className="text-sm">
                    <span className="font-medium">{selectedParties.length}</span> selected
                    <span className="ml-2 text-muted-foreground">
                      {selectedArchivableParties.length} archivable
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
                        selectedArchivableParties.length === 0 ||
                        bulkArchiveMutation.isPending
                      }
                      onClick={() => setBulkArchiveDialogOpen(true)}
                    >
                      Archive selected
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPartyIds([])}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              ) : null}
              <div
                className={cn(
                  "app-scrollbar overflow-y-auto overflow-x-hidden",
                  selectedParties.length > 0 && shouldConstrainPartiesTable ?
                    "min-h-0"
                  : "max-h-[35rem]"
                )}
              >
                <Table className="w-full table-fixed text-[11px] sm:text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-2">
                  <colgroup>
                    <col className="w-[4%]" />
                    <col className="w-[24%]" />
                    <col className="w-[12%]" />
                    <col className="w-[19%]" />
                    <col className="w-[12%]" />
                    <col className="w-[17%]" />
                    <col className="w-[7%]" />
                    <col className="w-[5%]" />
                  </colgroup>
                  <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-3">
                        <SelectionCheckbox
                          checked={allSelectablePartiesSelected}
                          indeterminate={someSelectablePartiesSelected}
                          disabled={selectablePartyIds.length === 0}
                          label="Select all parties"
                          onCheckedChange={toggleAllVisibleParties}
                        />
                      </TableHead>
                      <SortablePartiesTableHead
                        sortKey="name"
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={handleSortChange}
                      >
                        Party
                      </SortablePartiesTableHead>
                      <SortablePartiesTableHead
                        sortKey="role"
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={handleSortChange}
                      >
                        Roles
                      </SortablePartiesTableHead>
                      <SortablePartiesTableHead
                        sortKey="gstin"
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={handleSortChange}
                      >
                        GSTIN
                      </SortablePartiesTableHead>
                      <SortablePartiesTableHead
                        sortKey="pan"
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={handleSortChange}
                      >
                        PAN
                      </SortablePartiesTableHead>
                      <SortablePartiesTableHead
                        sortKey="contact"
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={handleSortChange}
                      >
                        Contact
                      </SortablePartiesTableHead>
                      <SortablePartiesTableHead
                        sortKey="status"
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={handleSortChange}
                      >
                        Status
                      </SortablePartiesTableHead>
                      <TableHead className="pr-3 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parties.map((party) => {
                      const isSelected = selectedPartyIdsSet.has(party.id)

                      return (
                        <TableRow
                          key={party.id}
                          data-state={isSelected ? "selected" : undefined}
                        >
                          <TableCell className="pl-3">
                            <SelectionCheckbox
                              checked={isSelected}
                              label={`Select ${party.displayName}`}
                              onCheckedChange={() => togglePartySelection(party)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-0 items-center gap-1.5">
                              <Avatar className="size-6 rounded-md">
                                {party.profileImageSeed ? (
                                  <AvatarImage
                                    src={getProfileAvatarUrl(party.profileImageSeed)}
                                    alt={`${party.displayName} avatar`}
                                  />
                                ) : null}
                                <AvatarFallback>{getInitials(party.displayName)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 space-y-0.5">
                                <p className="truncate font-medium">{party.displayName}</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {party.legalName ||
                                    party.tradeName ||
                                    partyTypeLabels[party.partyType]}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-0 flex-wrap gap-1">
                              {party.roles.map((role) => (
                                <Badge
                                  key={role}
                                  variant="outline"
                                  className="h-5 px-1.5 text-[10px] capitalize"
                                >
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {party.primaryGstRegistration ? (
                              <div className="min-w-0 space-y-0.5">
                                <p className="truncate font-mono text-[11px] tracking-[0.12em]">
                                  {party.primaryGstRegistration.gstin}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {party.primaryGstRegistration.state ||
                                    `State ${party.primaryGstRegistration.stateCode}`}
                                </p>
                              </div>
                            ) : (
                              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                Unregistered
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {party.pan ? (
                              <span className="truncate font-mono text-[11px] tracking-[0.12em]">
                                {party.pan}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">Not added</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {party.primaryContact ? (
                              <div className="min-w-0 space-y-0.5">
                                <p className="truncate font-medium">
                                  {party.primaryContact.name}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {party.primaryContact.mobile ||
                                    party.primaryContact.email ||
                                    "No phone/email"}
                                </p>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">No contact</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <PartyStatusBadge compact status={party.status} />
                          </TableCell>
                          <TableCell className="pr-3 text-right">
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
                                <span className="sr-only">Open party actions</span>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" sideOffset={8} className="w-44">
                                <DropdownMenuItem onClick={() => setDetailPartyId(party.id)}>
                                  <EyeIcon className="text-muted-foreground" />
                                  <span>View details</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditSheet(party)}>
                                  <PencilLineIcon className="text-muted-foreground" />
                                  <span>Edit</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setPartyPendingArchive(party)}
                                >
                                  <Trash2Icon className="text-muted-foreground" />
                                  <span>Archive</span>
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
            </div>
          )}
        </section>
      </div>

      <Dialog open={sheetMode !== null} onOpenChange={(open) => !open && closeSheet()}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
            <DialogHeader className="border-b border-border px-4 py-4">
              <DialogTitle>{sheetMode === "edit" ? "Edit party" : "Add party"}</DialogTitle>
              <DialogDescription>
                {sheetMode === "edit" ?
                  "Update the party identity. GST, address and contact records can be expanded from the detail flow."
                : "Create one external party identity and attach customer/supplier roles as needed."}
              </DialogDescription>
            </DialogHeader>

            <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <PartyForm
                form={formState}
                errors={formErrors}
                onChange={updateFormValue}
              />
            </div>

            <DialogFooter className="border-t border-border px-4 py-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={closeSheet}>
                Cancel
              </Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? (
                  <Spinner />
                ) : sheetMode === "edit" ? (
                  "Save changes"
                ) : (
                  "Create party"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PartyDetailDialog
        party={detailParty}
        isLoading={detailQuery.isLoading}
        open={detailPartyId !== null}
        onOpenChange={(open) => !open && setDetailPartyId(null)}
      />

      <Dialog
        open={partyPendingArchive !== null}
        onOpenChange={(open) => !open && setPartyPendingArchive(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Archive party</DialogTitle>
            <DialogDescription>
              {partyPendingArchive ?
                `Archive ${partyPendingArchive.displayName}? Existing sales and POS invoices keep their saved party snapshot, but this party cannot be used for new transactions.`
              : "Archive this party?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPartyPendingArchive(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={archiveMutation.isPending}
              onClick={() =>
                partyPendingArchive && archiveMutation.mutate(partyPendingArchive.id)
              }
            >
              {archiveMutation.isPending ? <Spinner /> : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkArchiveDialogOpen}
        onOpenChange={(open) => !open && setBulkArchiveDialogOpen(false)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Archive selected parties</DialogTitle>
            <DialogDescription>
              Existing sales and POS invoices keep their saved party snapshots. Archived
              parties cannot be used for new transactions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/20 p-3 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Selected
                </p>
                <p className="mt-1 text-lg font-semibold">{selectedParties.length}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Archivable
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {selectedArchivableParties.length}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Skipped
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {selectedParties.length - selectedArchivableParties.length}
                </p>
              </div>
            </div>
            <div className="app-scrollbar max-h-48 space-y-2 overflow-y-auto pr-1">
              {selectedArchivableParties.map((party) => (
                <div
                  key={party.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{party.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {party.primaryGstRegistration?.gstin ?? party.pan ?? "No GSTIN/PAN"}
                    </p>
                  </div>
                  <PartyStatusBadge compact status={party.status} />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkArchiveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                selectedArchivableParties.length === 0 || bulkArchiveMutation.isPending
              }
              onClick={() => bulkArchiveMutation.mutate()}
            >
              {bulkArchiveMutation.isPending ?
                <Spinner />
              : `Archive ${selectedArchivableParties.length} part${
                  selectedArchivableParties.length === 1 ? "y" : "ies"
                }`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function sortParties(
  parties: PartyListItem[],
  sortBy: PartySortBy,
  sortDir: PartySortDir
) {
  const direction = sortDir === "asc" ? 1 : -1

  return [...parties].sort((firstParty, secondParty) => {
    const firstValue = getPartySortValue(firstParty, sortBy)
    const secondValue = getPartySortValue(secondParty, sortBy)

    return firstValue.localeCompare(secondValue, undefined, {
      numeric: true,
      sensitivity: "base",
    }) * direction
  })
}

function getPartySortValue(party: PartyListItem, sortBy: PartySortBy) {
  switch (sortBy) {
    case "name":
      return party.displayName
    case "role":
      return party.roles.join(", ")
    case "gstin":
      return party.primaryGstRegistration?.gstin ?? ""
    case "pan":
      return party.pan ?? ""
    case "contact":
      return [
        party.primaryContact?.name,
        party.primaryContact?.mobile,
        party.primaryContact?.email,
      ]
        .filter(Boolean)
        .join(" ")
    case "status":
      return party.status
    case "createdAt":
      return party.createdAt
    case "updatedAt":
      return party.updatedAt
    default:
      return party.displayName
  }
}

function SortablePartiesTableHead({
  children,
  onSort,
  sortBy,
  sortDir,
  sortKey,
}: {
  children: React.ReactNode
  onSort: (sortBy: PartySortBy) => void
  sortBy: PartySortBy
  sortDir: PartySortDir
  sortKey: PartySortBy
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

function PartyForm({
  form,
  errors,
  onChange,
}: {
  form: PartyFormState
  errors: PartyFormErrors
  onChange: <K extends keyof PartyFormState>(key: K, value: PartyFormState[K]) => void
}) {
  const gstStateCode = form.gstin.trim().slice(0, 2)
  const isIndividual = form.partyType === "individual"

  return (
    <FieldGroup>
      <div className="space-y-3">
        <SectionHeading
          icon={<StoreIcon />}
          title="Identity"
          description="This is the single master record used across sales and purchases."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="party-display-name">Display name *</FieldLabel>
            <Input
              id="party-display-name"
              value={form.displayName}
              onChange={(event) => onChange("displayName", event.target.value)}
              placeholder="ABC Traders"
            />
            <FieldError>{errors.displayName}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="party-type">Party type</FieldLabel>
            <Select
              value={form.partyType}
              onValueChange={(value) => {
                const nextType = (value as PartyType | null) ?? "business"
                onChange("partyType", nextType)

                if (nextType === "individual") {
                  onChange("legalName", "")
                  onChange("tradeName", "")
                  onChange("shortName", "")
                  onChange("pan", "")
                }
              }}
            >
              <SelectTrigger id="party-type" className="w-full">
                <SelectDisplayValue
                  value={form.partyType}
                  options={partyTypeOptions}
                  placeholder="Choose party type"
                />
              </SelectTrigger>
              <SelectContent align="start" sideOffset={8}>
                {partyTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {isIndividual ? (
          <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Individual parties only need a display name. Add contact details below if
            this is a regular customer.
          </p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="party-legal-name">Legal name</FieldLabel>
                <Input
                  id="party-legal-name"
                  value={form.legalName}
                  onChange={(event) => onChange("legalName", event.target.value)}
                  placeholder="ABC Traders Private Limited"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="party-trade-name">Trade name</FieldLabel>
                <Input
                  id="party-trade-name"
                  value={form.tradeName}
                  onChange={(event) => onChange("tradeName", event.target.value)}
                  placeholder="ABC Traders"
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="party-short-name">Short name</FieldLabel>
                <Input
                  id="party-short-name"
                  value={form.shortName}
                  onChange={(event) => onChange("shortName", event.target.value)}
                  placeholder="ABC"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="party-pan">PAN</FieldLabel>
                <Input
                  id="party-pan"
                  value={form.pan}
                  maxLength={10}
                  onChange={(event) =>
                    onChange(
                      "pan",
                      event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                    )
                  }
                  className="font-mono uppercase tracking-[0.16em]"
                  placeholder="ABCDE1234F"
                />
                <FieldError>{errors.pan}</FieldError>
              </Field>
            </div>
          </>
        )}
      </div>

      <div className="space-y-3">
        <SectionHeading
          icon={<ShieldCheckIcon />}
          title="Role"
          description="Select how this party will be used."
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <CompactCheckOption
            checked={form.isCustomer}
            label="Customer"
            helper="Sales invoices and receivables"
            onClick={() => onChange("isCustomer", !form.isCustomer)}
          />
          <CompactCheckOption
            checked={form.isSupplier}
            label="Supplier"
            helper="Purchases, ITC and payables"
            onClick={() => onChange("isSupplier", !form.isSupplier)}
          />
        </div>
        <FieldError>{errors.roles}</FieldError>
      </div>

      <>
          <div className="space-y-3">
            <SectionHeading
              icon={<ReceiptTextIcon />}
              title="GST registration"
              description="Enable only when the party has a GSTIN."
            />
            <CompactCheckOption
              checked={form.hasGst}
              label="GST registered"
              helper="Show GSTIN and registration fields"
              onClick={() => onChange("hasGst", !form.hasGst)}
            />

            {form.hasGst ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="party-gstin">GSTIN *</FieldLabel>
                  <Input
                    id="party-gstin"
                    value={form.gstin}
                    maxLength={15}
                    onChange={(event) => {
                      const gstin = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                      onChange("gstin", gstin)
                      if (gstin.length >= 2) {
                        onChange("gstStateCode", gstin.slice(0, 2))
                      }
                    }}
                    className="font-mono uppercase tracking-[0.14em]"
                    placeholder="33ABCDE1234F1Z5"
                  />
                  <FieldDescription>
                    State code is derived from the first two digits: {gstStateCode || "--"}.
                  </FieldDescription>
                  <FieldError>{errors.gstin}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="party-gst-state-code">GST state code *</FieldLabel>
                  <Input
                    id="party-gst-state-code"
                    value={form.gstStateCode}
                    maxLength={2}
                    onChange={(event) =>
                      onChange("gstStateCode", event.target.value.replace(/\D/g, ""))
                    }
                    inputMode="numeric"
                    placeholder="33"
                  />
                  <FieldError>{errors.gstStateCode}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="party-gst-legal-name">GST legal name</FieldLabel>
                  <Input
                    id="party-gst-legal-name"
                    value={form.gstLegalName}
                    onChange={(event) => onChange("gstLegalName", event.target.value)}
                    placeholder="As per GST certificate"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="party-taxpayer-type">Taxpayer type</FieldLabel>
                  <Input
                    id="party-taxpayer-type"
                    value={form.taxpayerType}
                    onChange={(event) => onChange("taxpayerType", event.target.value)}
                    placeholder="Regular / Composition"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="party-gst-state">State</FieldLabel>
                  <Input
                    id="party-gst-state"
                    value={form.gstState}
                    onChange={(event) => onChange("gstState", event.target.value)}
                    placeholder="Tamil Nadu"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="party-gst-trade-name">GST trade name</FieldLabel>
                  <Input
                    id="party-gst-trade-name"
                    value={form.gstTradeName}
                    onChange={(event) => onChange("gstTradeName", event.target.value)}
                    placeholder="Trade name"
                  />
                </Field>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <SectionHeading
              icon={<MapPinIcon />}
              title="Primary address"
              description="Optional default address used while creating transactions."
            />
            <PartyAddressFields form={form} errors={errors} onChange={onChange} />
          </div>

          <div className="space-y-3">
            <SectionHeading
              icon={<ContactRoundIcon />}
              title="Primary contact"
              description="Optional contact person for billing, purchase or sales follow-up."
            />
            <div className="grid gap-4 md:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="party-contact-name">Name</FieldLabel>
                <Input
                  id="party-contact-name"
                  value={form.contactName}
                  onChange={(event) => onChange("contactName", event.target.value)}
                  placeholder="Contact person"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="party-contact-mobile">Mobile</FieldLabel>
                <IndianPhoneInput
                  id="party-contact-mobile"
                  value={form.contactMobile}
                  onChange={(event) =>
                    onChange("contactMobile", event.target.value.replace(/\D/g, ""))
                  }
                />
                <FieldError>{errors.contactMobile}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="party-contact-email">Email</FieldLabel>
                <Input
                  id="party-contact-email"
                  value={form.contactEmail}
                  onChange={(event) => onChange("contactEmail", event.target.value)}
                  placeholder="billing@example.com"
                />
                <FieldError>{errors.contactEmail}</FieldError>
              </Field>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {form.isCustomer ? (
              <div className="rounded-2xl border border-border p-4">
                <SectionHeading
                  icon={<UsersIcon />}
                  title="Customer terms"
                  description="Default commercial terms for receivables."
                />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="customer-credit-limit">Credit limit</FieldLabel>
                    <Input
                      id="customer-credit-limit"
                      value={form.customerCreditLimit}
                      onChange={(event) =>
                        onChange("customerCreditLimit", event.target.value)
                      }
                      inputMode="decimal"
                      placeholder="0.00"
                    />
                    <FieldError>{errors.customerCreditLimit}</FieldError>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="customer-credit-days">Credit days</FieldLabel>
                    <Input
                      id="customer-credit-days"
                      value={form.customerCreditDays}
                      onChange={(event) =>
                        onChange("customerCreditDays", event.target.value.replace(/\D/g, ""))
                      }
                      inputMode="numeric"
                      placeholder="0"
                    />
                    <FieldError>{errors.customerCreditDays}</FieldError>
                  </Field>
                </div>
              </div>
            ) : null}

            {form.isSupplier ? (
              <div className="rounded-2xl border border-border p-4">
                <SectionHeading
                  icon={<LandmarkIcon />}
                  title="Supplier terms"
                  description="Default purchase payment and lead-time settings."
                />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="supplier-credit-days">Credit days</FieldLabel>
                    <Input
                      id="supplier-credit-days"
                      value={form.supplierCreditDays}
                      onChange={(event) =>
                        onChange("supplierCreditDays", event.target.value.replace(/\D/g, ""))
                      }
                      inputMode="numeric"
                      placeholder="0"
                    />
                    <FieldError>{errors.supplierCreditDays}</FieldError>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="supplier-lead-days">Lead time days</FieldLabel>
                    <Input
                      id="supplier-lead-days"
                      value={form.supplierLeadTimeDays}
                      onChange={(event) =>
                        onChange("supplierLeadTimeDays", event.target.value.replace(/\D/g, ""))
                      }
                      inputMode="numeric"
                      placeholder="0"
                    />
                    <FieldError>{errors.supplierLeadTimeDays}</FieldError>
                  </Field>
                </div>
              </div>
            ) : null}
          </div>
        </>

      <div className="space-y-3">
        <SectionHeading
          icon={<ArchiveIcon />}
          title="Status and notes"
          description="Inactive or blocked parties remain visible for historical transactions."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="party-status">Status</FieldLabel>
            <Select
              value={form.status}
              onValueChange={(value) =>
                onChange("status", (value as PartyStatus | null) ?? "active")
              }
            >
              <SelectTrigger id="party-status" className="w-full">
                <SelectDisplayValue
                  value={form.status}
                  options={statusOptions}
                  placeholder="Choose status"
                />
              </SelectTrigger>
              <SelectContent align="start" sideOffset={8}>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="party-notes">Notes</FieldLabel>
            <Textarea
              id="party-notes"
              value={form.notes}
              onChange={(event) => onChange("notes", event.target.value)}
              placeholder="Internal remarks"
              className="min-h-20"
            />
          </Field>
        </div>
      </div>
    </FieldGroup>
  )
}

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground [&_svg]:size-4">
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function PartyAddressFields({
  form,
  errors,
  onChange,
}: {
  form: PartyFormState
  errors: PartyFormErrors
  onChange: <K extends keyof PartyFormState>(key: K, value: PartyFormState[K]) => void
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field className="md:col-span-2">
        <FieldLabel htmlFor="party-address-line-1">Address line 1</FieldLabel>
        <Input
          id="party-address-line-1"
          value={form.addressLine1}
          onChange={(event) => onChange("addressLine1", event.target.value)}
          placeholder="Door / building / street"
        />
      </Field>
      <Field className="md:col-span-2">
        <FieldLabel htmlFor="party-address-line-2">Address line 2</FieldLabel>
        <Input
          id="party-address-line-2"
          value={form.addressLine2}
          onChange={(event) => onChange("addressLine2", event.target.value)}
          placeholder="Area / landmark"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="party-city">City</FieldLabel>
        <Input
          id="party-city"
          value={form.city}
          onChange={(event) => onChange("city", event.target.value)}
          placeholder="Chennai"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="party-district">District</FieldLabel>
        <Input
          id="party-district"
          value={form.district}
          onChange={(event) => onChange("district", event.target.value)}
          placeholder="Chennai"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="party-state">State</FieldLabel>
        <Input
          id="party-state"
          value={form.state}
          onChange={(event) => onChange("state", event.target.value)}
          placeholder="Tamil Nadu"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="party-pincode">Pincode</FieldLabel>
        <Input
          id="party-pincode"
          value={form.pincode}
          maxLength={6}
          inputMode="numeric"
          onChange={(event) =>
            onChange("pincode", event.target.value.replace(/\D/g, ""))
          }
          placeholder="600001"
        />
        <FieldError>{errors.pincode}</FieldError>
      </Field>
    </div>
  )
}

function CompactCheckOption({
  checked,
  label,
  helper,
  onClick,
}: {
  checked: boolean
  label: string
  helper?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
        checked ?
          "border-blue-200 bg-blue-50/70 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100"
        : "border-border bg-background hover:bg-muted/30"
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
          checked ?
            "border-blue-600 bg-blue-600 text-white"
          : "border-input bg-background text-transparent"
        )}
      >
        <CheckIcon className="size-3" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-5">{label}</p>
        {helper ? (
          <p className="truncate text-xs leading-4 text-muted-foreground">{helper}</p>
        ) : null}
      </div>
    </button>
  )
}

function PartyDetailDialog({
  party,
  isLoading,
  open,
  onOpenChange,
}: {
  party: PartyDetail | null
  isLoading: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl gap-0 overflow-hidden p-0">
        {isLoading ? (
          <div className="flex min-h-64 flex-col overflow-hidden">
            <DialogHeader className="border-b border-border px-4 py-3 text-left">
              <DialogTitle className="text-base">Party details</DialogTitle>
              <DialogDescription className="text-xs">
                Loading party profile and linked records.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-14 rounded-xl" />
              ))}
            </div>
            <DialogFooter className="mt-auto border-t border-border px-4 py-3">
              <Button type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : party ? (
          <div className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden">
            <DialogHeader className="border-b border-border bg-muted/20 px-4 py-3 text-left">
              <div className="flex min-w-0 gap-3">
                <Avatar className="size-9 rounded-xl">
                  {party.profileImageSeed ? (
                    <AvatarImage
                      src={getProfileAvatarUrl(party.profileImageSeed)}
                      alt={`${party.displayName} avatar`}
                    />
                  ) : null}
                  <AvatarFallback>{getInitials(party.displayName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-base">{party.displayName}</DialogTitle>
                    <DialogDescription className="mt-0.5 line-clamp-1 text-xs">
                      {party.legalName ||
                        party.tradeName ||
                        `${partyTypeLabels[party.partyType]} party`}
                    </DialogDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      {partyTypeLabels[party.partyType]}
                    </Badge>
                    <PartyStatusBadge compact status={party.status} />
                    {party.roles.map((role) => (
                      <Badge
                        key={role}
                        variant="secondary"
                        className="h-5 px-1.5 text-[10px] capitalize"
                      >
                        {role}
                      </Badge>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-x-3 gap-y-1 border-t border-border/70 pt-2">
                    <DetailStat label="GST" value={party.gstRegistrations.length} />
                    <DetailStat label="Contact" value={party.contacts.length} />
                    <DetailStat label="Address" value={party.addresses.length} />
                    <DetailStat label="PAN" value={party.pan ? "Yes" : "No"} />
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="app-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="grid gap-x-4 gap-y-2 sm:grid-cols-3">
                <InfoTile label="PAN" value={party.pan ?? "Not added"} mono={Boolean(party.pan)} />
                <InfoTile
                  label="Customer terms"
                  value={
                    party.customerProfile ?
                      `${party.customerProfile.creditDays} days · ₹${party.customerProfile.creditLimit}`
                    : "Not configured"
                  }
                />
                <InfoTile
                  label="Supplier terms"
                  value={
                    party.supplierProfile ?
                      `${party.supplierProfile.creditDays} days · ${party.supplierProfile.leadTimeDays} lead`
                    : "Not configured"
                  }
                />
              </div>

              <DetailSection
                count={
                  Number(Boolean(party.customerProfile)) +
                  Number(Boolean(party.supplierProfile))
                }
                icon={<UsersIcon className="size-3.5" />}
                title="Role profiles"
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {party.customerProfile ? (
                    <DetailRow
                      badge={statusLabels[party.customerProfile.status]}
                      description={`${party.customerProfile.creditDays} days · ₹${party.customerProfile.creditLimit} limit`}
                      icon={<StoreIcon className="size-3.5" />}
                      meta={[
                        party.customerProfile.defaultPaymentTerm,
                        party.customerProfile.priceGroupId ? "Price group" : null,
                      ]}
                      title={party.customerProfile.customerCode}
                    />
                  ) : null}
                  {party.supplierProfile ? (
                    <DetailRow
                      badge={statusLabels[party.supplierProfile.status]}
                      description={`${party.supplierProfile.creditDays} days · ${party.supplierProfile.leadTimeDays} lead`}
                      icon={<ArchiveIcon className="size-3.5" />}
                      meta={[
                        party.supplierProfile.defaultPaymentTerm,
                        party.supplierProfile.preferredWarehouseId ? "Warehouse" : null,
                      ]}
                      title={party.supplierProfile.supplierCode}
                    />
                  ) : null}
                  {!party.customerProfile && !party.supplierProfile ? (
                    <EmptyDetailLine text="No customer or supplier profile is attached." />
                  ) : null}
                </div>
              </DetailSection>

              <DetailSection
                count={party.gstRegistrations.length}
                icon={<ReceiptTextIcon className="size-3.5" />}
                title="GST registrations"
              >
                <div className="grid gap-2">
                  {party.gstRegistrations.map((registration) => (
                    <DetailRow
                      key={registration.id}
                      badge={
                        registration.isPrimary ?
                          "Primary"
                        : capitalizeText(registration.status) ?? registration.status
                      }
                      description={
                        registration.legalName ||
                        registration.tradeName ||
                        "GST registration"
                      }
                      icon={<ReceiptTextIcon className="size-3.5" />}
                      meta={[
                        registration.state || registration.stateCode,
                        capitalizeText(registration.registrationType),
                        capitalizeText(registration.taxpayerType),
                      ]}
                      monoTitle
                      title={registration.gstin}
                    />
                  ))}
                  {party.gstRegistrations.length === 0 ? (
                    <EmptyDetailLine text="This party is not GST registered." />
                  ) : null}
                </div>
              </DetailSection>

              <DetailSection
                count={party.addresses.length}
                icon={<MapPinIcon className="size-3.5" />}
                title="Addresses"
              >
                <div className="grid gap-2">
                  {party.addresses.map((address) => (
                    <DetailRow
                      key={address.id}
                      badge={address.isPrimary ? "Primary" : undefined}
                      description={
                        [
                          address.addressLine1,
                          address.addressLine2,
                          address.locality,
                          address.city,
                          address.district,
                          address.state,
                          address.pincode,
                        ]
                          .filter(Boolean)
                          .join(", ") || "No address text"
                      }
                      icon={<MapPinIcon className="size-3.5" />}
                      meta={[
                        address.label,
                        capitalizeText(address.addressType),
                        address.isActive ? "Active" : "Inactive",
                      ]}
                      title={address.label || capitalizeText(address.addressType) || "Address"}
                    />
                  ))}
                  {party.addresses.length === 0 ? (
                    <EmptyDetailLine text="No address records are saved for this party." />
                  ) : null}
                </div>
              </DetailSection>

              <DetailSection
                count={party.contacts.length}
                icon={<ContactRoundIcon className="size-3.5" />}
                title="Contacts"
              >
                <div className="grid gap-2">
                  {party.contacts.map((contact) => (
                    <DetailRow
                      key={contact.id}
                      badge={contact.isPrimary ? "Primary" : statusLabels[contact.status]}
                      description={
                        [contact.mobile, contact.phone, contact.email].filter(Boolean).join(" · ") ||
                        "No phone/email"
                      }
                      icon={<ContactRoundIcon className="size-3.5" />}
                      meta={[contact.designation, capitalizeText(contact.contactRole)]}
                      title={contact.name}
                    />
                  ))}
                  {party.contacts.length === 0 ? (
                    <EmptyDetailLine text="No contact people are saved for this party." />
                  ) : null}
                </div>
              </DetailSection>
            </div>
            <DialogFooter className="border-t border-border px-4 py-3">
              <Button type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex min-h-44 flex-col overflow-hidden">
            <p className="p-5 text-sm text-muted-foreground">Unable to load party details.</p>
            <DialogFooter className="mt-auto border-t border-border px-4 py-3">
              <Button type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DetailStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-xs font-semibold">{value}</p>
    </div>
  )
}

function DetailSection({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center text-muted-foreground">
            {icon}
          </span>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {count}
        </span>
      </div>
      {children}
    </section>
  )
}

function DetailRow({
  icon,
  title,
  description,
  meta,
  badge,
  monoTitle,
}: {
  icon: React.ReactNode
  title: string
  description: string
  meta?: Array<string | null | undefined>
  badge?: string
  monoTitle?: boolean
}) {
  const visibleMeta = meta?.filter((item): item is string => Boolean(item)) ?? []

  return (
    <div className="flex gap-2 border-t border-border/60 py-2 first:border-t-0">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-xs font-medium",
                monoTitle && "font-mono tracking-[0.12em]"
              )}
            >
              {title}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {description}
            </p>
          </div>
          {badge ? (
            <Badge variant="outline" className="h-5 w-fit shrink-0 px-1.5 text-[10px]">
              {badge}
            </Badge>
          ) : null}
        </div>
        {visibleMeta.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {visibleMeta.map((item) => (
              <Badge key={item} variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                {item}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function EmptyDetailLine({ text }: { text: string }) {
  return (
    <p className="py-1 text-xs text-muted-foreground">
      {text}
    </p>
  )
}

function InfoTile({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 truncate text-xs font-medium", mono && "font-mono tracking-[0.12em]")}>
        {value}
      </p>
    </div>
  )
}

function capitalizeText(value: string | null | undefined) {
  if (!value) {
    return null
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function PartyStatusBadge({
  status,
  compact,
}: {
  status: PartyStatus
  compact?: boolean
}) {
  const compactClassName = compact ? "h-5 px-1.5 text-[10px]" : undefined

  if (status === "active") {
    return (
      <Badge
        className={cn(
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          compactClassName
        )}
      >
        Active
      </Badge>
    )
  }

  if (status === "blocked") {
    return (
      <Badge variant="destructive" className={compactClassName}>
        Blocked
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className={compactClassName}>
      {statusLabels[status]}
    </Badge>
  )
}

function PartiesTopMetric({
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

function validatePartyForm(form: PartyFormState): PartyFormErrors {
  const errors: PartyFormErrors = {}

  if (!form.displayName.trim()) {
    errors.displayName = "Enter the party display name."
  }

  if (!form.isCustomer && !form.isSupplier) {
    errors.roles = "Select customer, supplier, or both."
  }

  if (form.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(form.pan)) {
    errors.pan = "Enter a valid PAN."
  }

  if (form.hasGst) {
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(form.gstin)) {
      errors.gstin = "Enter a valid GSTIN."
    }

    if (!/^\d{2}$/.test(form.gstStateCode)) {
      errors.gstStateCode = "Enter the two-digit GST state code."
    }

    if (form.gstin.length >= 2 && form.gstin.slice(0, 2) !== form.gstStateCode) {
      errors.gstStateCode = "State code must match the first two digits of GSTIN."
    }
  }

  if (form.pincode && !/^\d{6}$/.test(form.pincode)) {
    errors.pincode = "Enter a valid 6-digit pincode."
  }

  if (form.contactMobile && !/^\d{10}$/.test(form.contactMobile)) {
    errors.contactMobile = "Enter a valid 10-digit mobile number."
  }

  if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
    errors.contactEmail = "Enter a valid email address."
  }

  if (!/^\d+(\.\d{1,2})?$/.test(form.customerCreditLimit || "0")) {
    errors.customerCreditLimit = "Enter a valid amount."
  }

  for (const key of ["customerCreditDays", "supplierCreditDays", "supplierLeadTimeDays"] as const) {
    if (!/^\d+$/.test(form[key] || "0")) {
      errors[key] = "Enter a valid day count."
    }
  }

  return errors
}

function buildCreatePayload(form: PartyFormState): CreatePartyPayload {
  const isIndividual = form.partyType === "individual"
  const roles: PartyRole[] = [
    form.isCustomer ? "customer" : null,
    form.isSupplier ? "supplier" : null,
  ].filter((role): role is PartyRole => Boolean(role))

  const payload: CreatePartyPayload = {
    partyType: form.partyType,
    roles,
    displayName: form.displayName.trim(),
    status: form.status,
  }
  const optionalIdentityFields = {
    legalName: isIndividual ? undefined : trimOrUndefined(form.legalName),
    tradeName: isIndividual ? undefined : trimOrUndefined(form.tradeName),
    shortName: isIndividual ? undefined : trimOrUndefined(form.shortName),
    pan: isIndividual ? undefined : trimOrUndefined(form.pan),
    notes: trimOrUndefined(form.notes),
  }

  for (const [key, value] of Object.entries(optionalIdentityFields)) {
    if (value !== undefined) {
      payload[key as keyof typeof optionalIdentityFields] = value
    }
  }

  if (form.isCustomer) {
    payload.customerProfile = {
      creditLimit: form.customerCreditLimit || "0",
      creditDays: Number(form.customerCreditDays || 0),
    }
  }

  if (form.isSupplier) {
    payload.supplierProfile = {
      creditDays: Number(form.supplierCreditDays || 0),
      leadTimeDays: Number(form.supplierLeadTimeDays || 0),
    }
  }

  if (form.hasGst) {
    payload.gstRegistration = buildGstRegistrationPayload(form)
  }

  if (hasAddressInput(form)) {
    payload.address = buildAddressPayload(form)
  }

  if (hasContactInput(form)) {
    payload.contact = buildContactPayload(form)
  }

  return payload
}

function buildUpdatePayload(form: PartyFormState): UpdatePartyPayload {
  const isIndividual = form.partyType === "individual"
  const roles: PartyRole[] = [
    form.isCustomer ? "customer" : null,
    form.isSupplier ? "supplier" : null,
  ].filter((role): role is PartyRole => Boolean(role))

  return {
    partyType: form.partyType,
    roles,
    displayName: form.displayName.trim(),
    legalName: isIndividual ? null : trimOrNull(form.legalName),
    tradeName: isIndividual ? null : trimOrNull(form.tradeName),
    shortName: isIndividual ? null : trimOrNull(form.shortName),
    pan: isIndividual ? null : trimOrNull(form.pan),
    status: form.status,
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
  }
}

async function savePartyChildrenForEdit(
  partyId: string,
  form: PartyFormState,
  party: PartyDetail,
  accessToken: string
) {
  let latestParty = party

  latestParty = (
    await savePrimaryGstRegistrationForEdit(partyId, form, latestParty, accessToken)
  ).party
  latestParty = (
    await savePrimaryAddressForEdit(partyId, form, latestParty, accessToken)
  ).party
  latestParty = (
    await savePrimaryContactForEdit(partyId, form, latestParty, accessToken)
  ).party
  latestParty = (
    await savePartyTermsForEdit(partyId, form, latestParty, accessToken)
  ).party

  return { party: latestParty }
}

async function savePrimaryGstRegistrationForEdit(
  partyId: string,
  form: PartyFormState,
  party: PartyDetail,
  accessToken: string
) {
  const primaryRegistration =
    party.gstRegistrations.find((registration) => registration.isPrimary) ??
    party.gstRegistrations[0] ??
    null

  if (!form.hasGst && primaryRegistration) {
    return archivePartyGstRegistration(partyId, primaryRegistration.id, accessToken)
  }

  if (!form.hasGst) {
    return { party }
  }

  const gstPayload = buildGstRegistrationPayload(form)

  if (primaryRegistration) {
    return updatePartyGstRegistration(
      partyId,
      primaryRegistration.id,
      gstPayload,
      accessToken
    )
  }

  return addPartyGstRegistration(partyId, gstPayload, accessToken)
}

async function savePrimaryAddressForEdit(
  partyId: string,
  form: PartyFormState,
  party: PartyDetail,
  accessToken: string
) {
  const primaryAddress =
    party.addresses.find((address) => address.isPrimary) ?? party.addresses[0] ?? null

  if (!hasAddressInput(form)) {
    if (primaryAddress) {
      return archivePartyAddress(partyId, primaryAddress.id, accessToken)
    }

    return { party }
  }

  const addressPayload = buildAddressPayload(form)

  if (primaryAddress) {
    return updatePartyAddress(partyId, primaryAddress.id, addressPayload, accessToken)
  }

  return addPartyAddress(partyId, addressPayload, accessToken)
}

async function savePrimaryContactForEdit(
  partyId: string,
  form: PartyFormState,
  party: PartyDetail,
  accessToken: string
) {
  const primaryContact =
    party.contacts.find((contact) => contact.isPrimary) ?? party.contacts[0] ?? null

  if (!hasContactInput(form)) {
    if (primaryContact) {
      return archivePartyContact(partyId, primaryContact.id, accessToken)
    }

    return { party }
  }

  const contactPayload = buildContactPayload(form)

  if (primaryContact) {
    return updatePartyContact(partyId, primaryContact.id, contactPayload, accessToken)
  }

  return addPartyContact(partyId, contactPayload, accessToken)
}

async function savePartyTermsForEdit(
  partyId: string,
  form: PartyFormState,
  party: PartyDetail,
  accessToken: string
) {
  let latestParty = party

  if (form.isCustomer) {
    latestParty = (
      await saveCustomerProfile(
        partyId,
        {
          creditLimit: form.customerCreditLimit || "0",
          creditDays: Number(form.customerCreditDays || 0),
        },
        accessToken,
        latestParty.customerProfile ? "PATCH" : "POST"
      )
    ).party
  }

  if (form.isSupplier) {
    latestParty = (
      await saveSupplierProfile(
        partyId,
        {
          creditDays: Number(form.supplierCreditDays || 0),
          leadTimeDays: Number(form.supplierLeadTimeDays || 0),
        },
        accessToken,
        latestParty.supplierProfile ? "PATCH" : "POST"
      )
    ).party
  }

  return { party: latestParty }
}

function buildGstRegistrationPayload(form: PartyFormState) {
  return {
    gstin: form.gstin.trim().toUpperCase(),
    legalName: trimOrNull(form.gstLegalName),
    tradeName: trimOrNull(form.gstTradeName),
    stateCode: form.gstStateCode.trim(),
    state: trimOrNull(form.gstState),
    taxpayerType: trimOrNull(form.taxpayerType),
    status: "active" as const,
    isPrimary: true,
  }
}

function buildAddressPayload(form: PartyFormState) {
  return compactUndefined({
    addressType: "billing" as const,
    addressLine1: trimOrUndefined(form.addressLine1),
    addressLine2: trimOrUndefined(form.addressLine2),
    city: trimOrUndefined(form.city),
    district: trimOrUndefined(form.district),
    state: trimOrUndefined(form.state),
    stateCode: trimOrUndefined(form.stateCode || form.gstStateCode),
    pincode: trimOrUndefined(form.pincode),
    isPrimary: true,
    isActive: true,
  })
}

function hasAddressInput(form: PartyFormState) {
  return [
    form.addressLine1,
    form.addressLine2,
    form.city,
    form.district,
    form.state,
    form.stateCode,
    form.pincode,
  ].some((value) => value.trim().length > 0)
}

function buildContactPayload(form: PartyFormState) {
  return {
    name: form.contactName.trim() || form.displayName.trim(),
    mobile: trimOrNull(form.contactMobile),
    email: trimOrNull(form.contactEmail),
    contactRole: "billing_contact" as const,
    isPrimary: true,
    status: "active" as const,
  }
}

function hasContactInput(form: PartyFormState) {
  return [form.contactName, form.contactMobile, form.contactEmail].some(
    (value) => value.trim().length > 0
  )
}

function trimOrNull(value: string) {
  return value.trim() || null
}

function trimOrUndefined(value: string) {
  return value.trim() || undefined
}

function compactUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}

function PartiesTableSkeleton() {
  return (
    <div className="space-y-2 px-4 py-3 sm:px-5 lg:px-6">
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((__, itemIndex) => (
            <Skeleton key={itemIndex} className="h-10 rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  )
}
