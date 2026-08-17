"use client"

import * as React from "react"
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ContactRoundIcon,
  EyeIcon,
  LandmarkIcon,
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
import { toast } from "@/components/ui/toast"
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  archiveParty,
  createParty,
  findPartyDuplicates,
  getParty,
  listParties,
  updateParty,
  type PartyDetail,
  type PartyListItem,
  type PartyRole,
  type PartySortBy,
  type PartySortDir,
  type PartyStatus,
} from "@/lib/parties/api"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getProfileAvatarUrl } from "@/lib/avatar"
import { cn } from "@/lib/utils"
import {
  emptyForm,
  partyTypeLabels,
  roleFilterOptions,
  statusFilterOptions,
  type FilterState,
  type PartyFormErrors,
  type PartyFormState,
  type SheetMode,
} from "./party-types"
import {
  buildCreatePayload,
  buildUpdatePayload,
  createFormFromParty,
  getErrorMessage,
  getInitials,
  getPartyDuplicateWarnings,
  savePartyChildrenForCreate,
  savePartyChildrenForEdit,
  sortParties,
  validatePartyForm,
} from "./party-utils"
import { PartyDetailDialog } from "./party-detail-dialog"
import { PartyFormDialog } from "./party-form-dialog"
import { PartyStatusBadge } from "./party-status-badge"

const tablePageSize = 15

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

  const partiesQuery = useInfiniteQuery({
    queryKey: ["parties", filters, sortBy, sortDir],
    queryFn: ({ pageParam }) =>
      listParties(accessToken, {
        search: filters.search.trim() || undefined,
        role: filters.role === "all" ? undefined : filters.role,
        status: filters.status === "all" ? undefined : filters.status,
        sortBy,
        sortDir,
        page: pageParam,
        limit: tablePageSize,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
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
    () => partiesQuery.data?.pages.flatMap((page) => page.parties) ?? [],
    [partiesQuery.data?.pages]
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
  const totalPartiesCount = partiesQuery.data?.pages[0]?.pagination.total ?? parties.length
  const duplicateWarnings = React.useMemo(
    () => getPartyDuplicateWarnings(formState, rawParties, selectedPartyId),
    [formState, rawParties, selectedPartyId]
  )
  const duplicateLookupInput = React.useMemo(
    () => buildDuplicateLookupInput(formState, selectedPartyId),
    [formState, selectedPartyId]
  )
  const deferredDuplicateLookupInput = React.useDeferredValue(duplicateLookupInput)
  const duplicateSuggestionsQuery = useQuery({
    queryKey: ["parties", "duplicates", deferredDuplicateLookupInput],
    queryFn: () => findPartyDuplicates(accessToken, deferredDuplicateLookupInput),
    enabled:
      sheetMode !== null &&
      accessToken.length > 0 &&
      hasDuplicateLookupInput(deferredDuplicateLookupInput),
    staleTime: 1000 * 30,
  })
  const duplicateSuggestions = duplicateSuggestionsQuery.data?.suggestions ?? []

  function handleDetailPartyChanged(party: PartyDetail) {
    queryClient.setQueryData(["parties", "detail", party.id], { party })
    queryClient.invalidateQueries({ queryKey: ["parties"] })
  }

  function openPartyDetails(partyId: string) {
    setSheetMode(null)
    setSelectedPartyId(null)
    setPartyPendingArchive(null)
    setBulkArchiveDialogOpen(false)
    setDetailPartyId(partyId)
  }

  function openPartyArchive(party: PartyListItem) {
    setSheetMode(null)
    setSelectedPartyId(null)
    setDetailPartyId(null)
    setBulkArchiveDialogOpen(false)
    setPartyPendingArchive(party)
  }

  function handlePartiesTableScroll(event: React.UIEvent<HTMLDivElement>) {
    const target = event.currentTarget
    const remainingScroll =
      target.scrollHeight - target.scrollTop - target.clientHeight

    if (
      remainingScroll < 160 &&
      partiesQuery.hasNextPage &&
      !partiesQuery.isFetchingNextPage
    ) {
      void partiesQuery.fetchNextPage()
    }
  }

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

      const createdParty = await createParty(buildCreatePayload(payload.form), accessToken)

      return savePartyChildrenForCreate(
        createdParty.party.id,
        payload.form,
        createdParty.party,
        accessToken
      )
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
                onScroll={handlePartiesTableScroll}
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
                                <DropdownMenuItem onClick={() => openPartyDetails(party.id)}>
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
                                  onClick={() => openPartyArchive(party)}
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
                {partiesQuery.isFetchingNextPage ? (
                  <div className="flex items-center justify-center gap-2 border-t border-border px-3 py-3 text-xs text-muted-foreground">
                    <Spinner />
                    Loading more parties
                  </div>
                ) : partiesQuery.hasNextPage ? (
                  <div className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
                    Scroll to load more · {parties.length} of {totalPartiesCount}
                  </div>
                ) : parties.length > tablePageSize ? (
                  <div className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
                    All {totalPartiesCount} parties loaded
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>

      <PartyFormDialog
        mode={sheetMode}
        form={formState}
        errors={formErrors}
        duplicateWarnings={duplicateWarnings}
        duplicateSuggestions={duplicateSuggestions}
        isCheckingDuplicates={duplicateSuggestionsQuery.isFetching}
        isPending={upsertMutation.isPending}
        onChange={updateFormValue}
        onClose={closeSheet}
        onSubmit={handleSubmit}
      />

      {detailPartyId ? (
        <PartyDetailDialog
          party={detailParty}
          accessToken={accessToken}
          isLoading={detailQuery.isLoading}
          open
          onPartyChanged={handleDetailPartyChanged}
          onOpenChange={(open) => !open && setDetailPartyId(null)}
        />
      ) : null}

      {partyPendingArchive ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setPartyPendingArchive(null)}
        >
          <DialogContent showCloseButton={false} className="max-w-xl gap-4">
            <DialogHeader className="text-left">
              <div className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <Trash2Icon className="size-5" />
              </div>
              <DialogTitle>Archive party</DialogTitle>
              <DialogDescription>
                This moves the party out of active use without deleting historical
                transactions or saved snapshots.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-2xl border border-border bg-muted/20 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-10 rounded-xl">
                  {partyPendingArchive.profileImageSeed ? (
                    <AvatarImage
                      src={getProfileAvatarUrl(partyPendingArchive.profileImageSeed)}
                      alt={`${partyPendingArchive.displayName} avatar`}
                    />
                  ) : null}
                  <AvatarFallback>
                    {getInitials(partyPendingArchive.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {partyPendingArchive.displayName}
                  </p>
                  <p className="truncate font-mono text-xs tracking-[0.12em] text-muted-foreground">
                    {partyPendingArchive.primaryGstRegistration?.gstin ??
                      partyPendingArchive.pan ??
                      "NO GSTIN / PAN"}
                  </p>
                </div>
                <PartyStatusBadge compact status={partyPendingArchive.status} />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <ArchiveImpactCard
                icon={<ReceiptTextIcon className="size-3.5" />}
                label="History"
                value="Kept"
                description="Invoices, POS bills, and ledger snapshots remain intact."
              />
              <ArchiveImpactCard
                icon={<ShieldCheckIcon className="size-3.5" />}
                label="New usage"
                value="Blocked"
                description="Archived parties cannot be selected for new transactions."
              />
              <ArchiveImpactCard
                icon={<StoreIcon className="size-3.5" />}
                label="Roles"
                value={partyPendingArchive.roles.length || 0}
                description="Customer/supplier profiles are preserved, not deleted."
              />
            </div>

            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              Archive only if this party should no longer appear in active sales,
              purchase, POS, or payment selection flows.
            </div>

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
                onClick={() => archiveMutation.mutate(partyPendingArchive.id)}
              >
                {archiveMutation.isPending ? <Spinner /> : "Archive party"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

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

function ArchiveImpactCard({
  description,
  icon,
  label,
  value,
}: {
  description: string
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex size-6 items-center justify-center text-muted-foreground">
          {icon}
        </span>
        <p className="text-xs font-medium text-foreground">{value}</p>
      </div>
      <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
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

function buildDuplicateLookupInput(
  form: PartyFormState,
  selectedPartyId: string | null
) {
  const gstin =
    form.gstRegistrations.find((registration) => registration.gstin.trim())?.gstin ||
    form.gstin
  const email =
    form.contacts.find((contact) => contact.email.trim())?.email || form.contactEmail
  const mobile =
    form.contacts.find((contact) => contact.mobile.trim())?.mobile || form.contactMobile

  return {
    displayName: form.displayName.trim(),
    legalName: form.legalName.trim(),
    tradeName: form.tradeName.trim(),
    pan: form.pan.trim(),
    gstin: gstin.trim(),
    email: email.trim(),
    mobile: mobile.trim(),
    excludePartyId: selectedPartyId,
    limit: 5,
  }
}

function hasDuplicateLookupInput(input: ReturnType<typeof buildDuplicateLookupInput>) {
  return (
    input.displayName.length >= 4 ||
    input.legalName.length >= 4 ||
    input.tradeName.length >= 4 ||
    input.pan.length >= 5 ||
    input.gstin.length >= 4 ||
    input.email.length >= 5 ||
    input.mobile.replace(/\D/g, "").length >= 6
  )
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
