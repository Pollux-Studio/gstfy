"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArchiveIcon,
  Building2Icon,
  ContactRoundIcon,
  EyeIcon,
  LandmarkIcon,
  MapPinIcon,
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
  archiveParty,
  createParty,
  getParty,
  listParties,
  updateParty,
  type CreatePartyPayload,
  type PartyDetail,
  type PartyListItem,
  type PartyRole,
  type PartyStatus,
  type PartyType,
  type UpdatePartyPayload,
} from "@/lib/parties/api"
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

function createFormFromParty(party: PartyListItem): PartyFormState {
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
    contactName: party.primaryContact?.name ?? "",
    contactEmail: party.primaryContact?.email ?? "",
    contactMobile: party.primaryContact?.mobile ?? "",
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
  const [sheetMode, setSheetMode] = React.useState<SheetMode | null>(null)
  const [selectedPartyId, setSelectedPartyId] = React.useState<string | null>(null)
  const [detailPartyId, setDetailPartyId] = React.useState<string | null>(null)
  const [partyPendingArchive, setPartyPendingArchive] =
    React.useState<PartyListItem | null>(null)
  const [formState, setFormState] = React.useState<PartyFormState>(emptyForm)
  const [formErrors, setFormErrors] = React.useState<PartyFormErrors>({})

  const partiesQuery = useQuery({
    queryKey: ["parties", filters],
    queryFn: () =>
      listParties(accessToken, {
        search: filters.search.trim() || undefined,
        role: filters.role === "all" ? undefined : filters.role,
        status: filters.status === "all" ? undefined : filters.status,
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

  const parties = partiesQuery.data?.parties ?? []
  const selectedParty = parties.find((party) => party.id === selectedPartyId) ?? null
  const detailParty = detailQuery.data?.party ?? null

  const upsertMutation = useMutation({
    mutationFn: (payload: { mode: SheetMode; partyId?: string; form: PartyFormState }) => {
      if (payload.mode === "edit" && payload.partyId) {
        return updateParty(payload.partyId, buildUpdatePayload(payload.form), accessToken)
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

  function openCreateSheet() {
    setSelectedPartyId(null)
    setFormState(emptyForm)
    setFormErrors({})
    setSheetMode("create")
  }

  function openEditSheet(party: PartyListItem) {
    setSelectedPartyId(party.id)
    setFormState(createFormFromParty(party))
    setFormErrors({})
    setSheetMode("edit")
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
    const errors = validatePartyForm(formState, sheetMode ?? "create")

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

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
        <section className="rounded-2xl border border-border bg-card text-card-foreground">
          <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
            <div className="space-y-2">
              <Badge variant="outline" className="gap-1.5 bg-background/70">
                <UsersIcon className="size-3.5" />
                Party Master
              </Badge>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Parties</h1>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Maintain one customer/supplier identity with GST registrations,
                  contacts, addresses, and commercial role profiles.
                </p>
              </div>
            </div>
            <Button type="button" className="h-10 rounded-xl" onClick={openCreateSheet}>
              <PlusIcon className="size-4" />
              Add Party
            </Button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
          <div className="border-b border-border px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Party register</h2>
                <p className="text-sm text-muted-foreground">
                  Search by name, GSTIN, PAN, phone, email, or party code.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="relative sm:col-span-1">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={filters.search}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        search: event.target.value,
                      }))
                    }
                    className="pl-8"
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
                  <SelectTrigger className="w-full min-w-[10rem]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent align="end" sideOffset={8}>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="customer">Customers</SelectItem>
                    <SelectItem value="supplier">Suppliers</SelectItem>
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
                  <SelectTrigger className="w-full min-w-[10rem]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent align="end" sideOffset={8}>
                    <SelectItem value="all">All statuses</SelectItem>
                    {partyStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabels[status]}
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
            <div className="flex min-h-80 flex-col items-center justify-center gap-4 px-4 py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                <ContactRoundIcon className="size-7 text-muted-foreground" />
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
            <div className="app-scrollbar overflow-x-auto">
              <Table className="min-w-[1120px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Party</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>GSTIN</TableHead>
                    <TableHead>PAN</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parties.map((party) => (
                    <TableRow key={party.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-muted/30">
                            {party.partyType === "individual" ?
                              <ContactRoundIcon className="size-4 text-muted-foreground" />
                            : <Building2Icon className="size-4 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <p className="truncate font-medium">{party.displayName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {party.legalName || party.tradeName || partyTypeLabels[party.partyType]}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {party.roles.map((role) => (
                            <Badge key={role} variant="outline" className="capitalize">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {party.primaryGstRegistration ? (
                          <div className="space-y-1">
                            <p className="font-mono text-xs tracking-[0.12em]">
                              {party.primaryGstRegistration.gstin}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {party.primaryGstRegistration.state ||
                                `State ${party.primaryGstRegistration.stateCode}`}
                            </p>
                          </div>
                        ) : (
                          <Badge variant="secondary">Unregistered</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {party.pan ? (
                          <span className="font-mono text-xs tracking-[0.12em]">
                            {party.pan}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not added</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {party.primaryContact ? (
                          <div className="space-y-1">
                            <p className="font-medium">{party.primaryContact.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {party.primaryContact.mobile ||
                                party.primaryContact.email ||
                                "No phone/email"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No contact</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <PartyStatusBadge status={party.status} />
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>

      <Sheet open={sheetMode !== null} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className="w-full sm:max-w-3xl">
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
            <SheetHeader className="border-b border-border px-4 py-4">
              <SheetTitle>{sheetMode === "edit" ? "Edit party" : "Add party"}</SheetTitle>
              <SheetDescription>
                {sheetMode === "edit" ?
                  "Update the party identity. GST, address and contact records can be expanded from the detail flow."
                : "Create one external party identity and attach customer/supplier roles as needed."}
              </SheetDescription>
            </SheetHeader>

            <div className="app-scrollbar flex-1 overflow-y-auto px-4 py-4">
              <PartyForm
                mode={sheetMode ?? "create"}
                form={formState}
                errors={formErrors}
                onChange={updateFormValue}
              />
            </div>

            <SheetFooter className="border-t border-border px-4 py-4 sm:flex-row sm:justify-end">
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
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

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
                `Archive ${partyPendingArchive.displayName}? Historical transactions remain visible, but it will not be an active party.`
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
    </>
  )
}

function PartyForm({
  mode,
  form,
  errors,
  onChange,
}: {
  mode: SheetMode
  form: PartyFormState
  errors: PartyFormErrors
  onChange: <K extends keyof PartyFormState>(key: K, value: PartyFormState[K]) => void
}) {
  const gstStateCode = form.gstin.trim().slice(0, 2)
  const isCreate = mode === "create"

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
              onValueChange={(value) =>
                onChange("partyType", (value as PartyType | null) ?? "business")
              }
            >
              <SelectTrigger id="party-type" className="w-full">
                <SelectValue placeholder="Choose party type" />
              </SelectTrigger>
              <SelectContent align="start" sideOffset={8}>
                {partyTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {partyTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
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
                onChange("pan", event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              className="font-mono uppercase tracking-[0.16em]"
              placeholder="ABCDE1234F"
            />
            <FieldError>{errors.pan}</FieldError>
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeading
          icon={<ShieldCheckIcon />}
          title="Role"
          description="A party can be a customer, supplier, or both without duplicate records."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <RoleButton
            active={form.isCustomer}
            title="Customer"
            description="Use this party in sales invoices and receivables."
            onClick={() => onChange("isCustomer", !form.isCustomer)}
          />
          <RoleButton
            active={form.isSupplier}
            title="Supplier"
            description="Use this party in purchases, ITC and payables."
            onClick={() => onChange("isSupplier", !form.isSupplier)}
          />
        </div>
        <FieldError>{errors.roles}</FieldError>
      </div>

      {isCreate ? (
        <>
          <div className="space-y-3">
            <SectionHeading
              icon={<ReceiptTextIcon />}
              title="GST registration"
              description="GSTIN is optional for unregistered parties and can be added later."
            />
            <button
              type="button"
              onClick={() => onChange("hasGst", !form.hasGst)}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-colors",
                form.hasGst ? "border-foreground bg-muted/40" : "border-border"
              )}
            >
              <div>
                <p className="text-sm font-medium">
                  {form.hasGst ? "Registered party" : "Unregistered party"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {form.hasGst ?
                    "Capture GSTIN and state details for transaction selection."
                  : "Skip GSTIN for now. GST rules can require it on specific transactions."}
                </p>
              </div>
              <Badge variant={form.hasGst ? "default" : "secondary"}>
                {form.hasGst ? "GSTIN enabled" : "No GSTIN"}
              </Badge>
            </button>

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
                <Input
                  id="party-contact-mobile"
                  value={form.contactMobile}
                  maxLength={10}
                  inputMode="numeric"
                  onChange={(event) =>
                    onChange("contactMobile", event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="0000000000"
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
      ) : null}

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
                <SelectValue placeholder="Choose status" />
              </SelectTrigger>
              <SelectContent align="start" sideOffset={8}>
                {partyStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels[status]}
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

function RoleButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition-colors",
        active ? "border-foreground bg-muted/40" : "border-border bg-background hover:bg-muted/20"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {active ? <Badge>Selected</Badge> : <Badge variant="outline">Optional</Badge>}
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{party?.displayName ?? "Party details"}</DialogTitle>
          <DialogDescription>
            View GST registrations, addresses, contacts and role profile details.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : party ? (
          <div className="app-scrollbar max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoTile label="Type" value={partyTypeLabels[party.partyType]} />
              <InfoTile label="PAN" value={party.pan ?? "Not added"} mono={Boolean(party.pan)} />
              <InfoTile label="Status" value={statusLabels[party.status]} />
            </div>

            <DetailSection title="Role profiles">
              <div className="grid gap-3 md:grid-cols-2">
                {party.customerProfile ? (
                  <InfoTile
                    label="Customer"
                    value={`${party.customerProfile.customerCode} · ${party.customerProfile.creditDays} credit days`}
                  />
                ) : null}
                {party.supplierProfile ? (
                  <InfoTile
                    label="Supplier"
                    value={`${party.supplierProfile.supplierCode} · ${party.supplierProfile.creditDays} credit days`}
                  />
                ) : null}
                {!party.customerProfile && !party.supplierProfile ? (
                  <p className="text-sm text-muted-foreground">No role profile attached.</p>
                ) : null}
              </div>
            </DetailSection>

            <DetailSection title="GST registrations">
              <div className="grid gap-3">
                {party.gstRegistrations.map((registration) => (
                  <div key={registration.id} className="rounded-2xl border border-border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="font-mono text-sm tracking-[0.12em]">
                          {registration.gstin}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {registration.legalName || registration.tradeName || "GST registration"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {registration.isPrimary ? <Badge>Primary</Badge> : null}
                        <Badge variant="outline">{registration.stateCode}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
                {party.gstRegistrations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Unregistered party.</p>
                ) : null}
              </div>
            </DetailSection>

            <DetailSection title="Addresses">
              <div className="grid gap-3">
                {party.addresses.map((address) => (
                  <div key={address.id} className="rounded-2xl border border-border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="font-medium capitalize">{address.addressType}</p>
                        <p className="text-sm text-muted-foreground">
                          {[
                            address.addressLine1,
                            address.addressLine2,
                            address.city,
                            address.district,
                            address.state,
                            address.pincode,
                          ]
                            .filter(Boolean)
                            .join(", ") || "No address text"}
                        </p>
                      </div>
                      {address.isPrimary ? <Badge>Primary</Badge> : null}
                    </div>
                  </div>
                ))}
                {party.addresses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No address records.</p>
                ) : null}
              </div>
            </DetailSection>

            <DetailSection title="Contacts">
              <div className="grid gap-3">
                {party.contacts.map((contact) => (
                  <div key={contact.id} className="rounded-2xl border border-border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">{contact.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {[contact.mobile, contact.email].filter(Boolean).join(" · ") ||
                            "No phone/email"}
                        </p>
                      </div>
                      {contact.isPrimary ? <Badge>Primary</Badge> : null}
                    </div>
                  </div>
                ))}
                {party.contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contact records.</p>
                ) : null}
              </div>
            </DetailSection>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Unable to load party details.</p>
        )}

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
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
    <div className="rounded-2xl border border-border p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-2 text-sm font-medium", mono && "font-mono tracking-[0.12em]")}>
        {value}
      </p>
    </div>
  )
}

function PartyStatusBadge({ status }: { status: PartyStatus }) {
  if (status === "active") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        Active
      </Badge>
    )
  }

  if (status === "blocked") {
    return <Badge variant="destructive">Blocked</Badge>
  }

  return <Badge variant="secondary">{statusLabels[status]}</Badge>
}

function validatePartyForm(form: PartyFormState, mode: SheetMode): PartyFormErrors {
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

  if (mode === "create" && form.hasGst) {
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
  const roles: PartyRole[] = [
    form.isCustomer ? "customer" : null,
    form.isSupplier ? "supplier" : null,
  ].filter((role): role is PartyRole => Boolean(role))

  const payload: CreatePartyPayload = {
    partyType: form.partyType,
    roles,
    displayName: form.displayName.trim(),
    legalName: trimOrNull(form.legalName),
    tradeName: trimOrNull(form.tradeName),
    shortName: trimOrNull(form.shortName),
    pan: trimOrNull(form.pan),
    status: form.status,
    notes: trimOrNull(form.notes),
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
    payload.gstRegistration = {
      gstin: form.gstin.trim().toUpperCase(),
      legalName: trimOrNull(form.gstLegalName),
      tradeName: trimOrNull(form.gstTradeName),
      stateCode: form.gstStateCode.trim(),
      state: trimOrNull(form.gstState),
      taxpayerType: trimOrNull(form.taxpayerType),
      status: "active",
      isPrimary: true,
    }
  }

  if (
    form.addressLine1 ||
    form.addressLine2 ||
    form.city ||
    form.district ||
    form.state ||
    form.pincode
  ) {
    payload.address = {
      addressType: "billing",
      addressLine1: trimOrNull(form.addressLine1),
      addressLine2: trimOrNull(form.addressLine2),
      city: trimOrNull(form.city),
      district: trimOrNull(form.district),
      state: trimOrNull(form.state),
      stateCode: trimOrNull(form.stateCode || form.gstStateCode),
      pincode: trimOrNull(form.pincode),
      isPrimary: true,
      isActive: true,
    }
  }

  if (form.contactName.trim()) {
    payload.contact = {
      name: form.contactName.trim(),
      mobile: trimOrNull(form.contactMobile),
      email: trimOrNull(form.contactEmail),
      contactRole: "billing_contact",
      isPrimary: true,
      status: "active",
    }
  }

  return payload
}

function buildUpdatePayload(form: PartyFormState): UpdatePartyPayload {
  return {
    partyType: form.partyType,
    displayName: form.displayName.trim(),
    legalName: trimOrNull(form.legalName),
    tradeName: trimOrNull(form.tradeName),
    shortName: trimOrNull(form.shortName),
    pan: trimOrNull(form.pan),
    status: form.status,
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
  }
}

function trimOrNull(value: string) {
  return value.trim() || null
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}

function PartiesTableSkeleton() {
  return (
    <div className="space-y-3 px-4 py-4 sm:px-5 lg:px-6">
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((__, itemIndex) => (
            <Skeleton key={itemIndex} className="h-12 rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  )
}
