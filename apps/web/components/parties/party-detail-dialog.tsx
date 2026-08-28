"use client"

import * as React from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import Link from "next/link"
import {
  ArchiveIcon,
  BadgeIndianRupeeIcon,
  BanknoteIcon,
  BookOpenTextIcon,
  BriefcaseBusinessIcon,
  CalendarClockIcon,
  CheckIcon,
  ClipboardListIcon,
  ContactRoundIcon,
  FileTextIcon,
  HistoryIcon,
  MapPinIcon,
  PlusIcon,
  ReceiptTextIcon,
  StoreIcon,
  TrendingUpIcon,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"
import { getProfileAvatarUrl } from "@/lib/avatar"
import {
  addPartyDocument,
  addPartyGstRegistration,
  archivePartyDocument,
  archivePartyGstRegistration,
  getPartyAudit,
  getPartyDocuments,
  getPartyLedger,
  updatePartyGstRegistration,
  type PartyAuditEntry,
  type PartyDetail,
  type PartyDocument,
  type PartyGstRegistration,
  type PartyLedgerEntry,
  type PartyLedgerTotals,
} from "@/lib/parties/api"
import { cn } from "@/lib/utils"
import {
  emptyGstRegistrationForm,
  addressTypeOptions,
  gstRegistrationStatusOptions,
  gstRegistrationTypeOptions,
  partyTypeLabels,
  statusLabels,
  type GstRegistrationFormErrors,
  type GstRegistrationFormState,
} from "./party-types"
import {
  buildGstRegistrationPayloadFromState,
  createGstFormFromRegistration,
  formatCurrencyValue,
  getErrorMessage,
  getInitials,
  validateGstRegistrationForm,
} from "./party-utils"
import { PartyStatusBadge } from "./party-status-badge"

type PartyWorkspaceTab =
  | "overview"
  | "gst"
  | "addresses"
  | "contacts"
  | "bank"
  | "commercial"
  | "ledger"
  | "documents"
  | "audit"
  | "more"

const partyWorkspaceTabs: Array<{
  value: PartyWorkspaceTab
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
    { value: "overview", label: "Overview", icon: ClipboardListIcon },
    { value: "gst", label: "GST", icon: ReceiptTextIcon },
    { value: "addresses", label: "Addresses", icon: MapPinIcon },
    { value: "contacts", label: "Contacts", icon: ContactRoundIcon },
    { value: "bank", label: "Bank", icon: BanknoteIcon },
    { value: "commercial", label: "Commercial", icon: BriefcaseBusinessIcon },
    { value: "ledger", label: "Ledger", icon: BookOpenTextIcon },
    { value: "documents", label: "Documents", icon: FileTextIcon },
    { value: "audit", label: "Audit", icon: HistoryIcon },
    { value: "more", label: "More", icon: FileTextIcon },
  ]

type PartyDocumentFormState = {
  documentType: PartyDocument["documentType"]
  title: string
  fileReference: string
  fileName: string
  mimeType: string
  fileSizeBytes: string
  notes: string
}

const emptyDocumentForm: PartyDocumentFormState = {
  documentType: "gst_certificate",
  title: "",
  fileReference: "",
  fileName: "",
  mimeType: "",
  fileSizeBytes: "",
  notes: "",
}

const documentTypeOptions: Array<{ value: PartyDocument["documentType"]; label: string }> = [
  { value: "gst_certificate", label: "GST Certificate" },
  { value: "pan", label: "PAN" },
  { value: "bank_proof", label: "Bank proof" },
  { value: "agreement", label: "Agreement" },
  { value: "vendor_onboarding", label: "Vendor onboarding" },
  { value: "other", label: "Other" },
]

export function PartyDetailDialog({
  accessToken,
  isLoading,
  onOpenChange,
  onPartyChanged,
  open,
  party,
}: {
  accessToken: string
  isLoading: boolean
  onOpenChange: (open: boolean) => void
  onPartyChanged: (party: PartyDetail) => void
  open: boolean
  party: PartyDetail | null
}) {
  const [gstFormMode, setGstFormMode] = React.useState<"create" | "edit" | null>(null)
  const [editingGstRegistrationId, setEditingGstRegistrationId] =
    React.useState<string | null>(null)
  const [gstForm, setGstForm] =
    React.useState<GstRegistrationFormState>(emptyGstRegistrationForm)
  const [gstErrors, setGstErrors] = React.useState<GstRegistrationFormErrors>({})
  const [documentForm, setDocumentForm] =
    React.useState<PartyDocumentFormState>(emptyDocumentForm)
  const [activeTab, setActiveTab] = React.useState<PartyWorkspaceTab>("overview")
  const activeGstRegistrations =
    party?.gstRegistrations.filter((registration) => registration.status !== "archived") ?? []
  const activeAddresses = party?.addresses.filter((address) => address.isActive) ?? []
  const activeContacts =
    party?.contacts.filter((contact) => contact.status !== "inactive") ?? []
  const activeBankAccounts =
    party?.bankAccounts.filter((bankAccount) => bankAccount.status !== "archived") ?? []
  const primaryGst = selectPrimaryRecord(activeGstRegistrations)
  const primaryAddress = selectPrimaryRecord(activeAddresses)
  const primaryContact = selectPrimaryRecord(activeContacts)
  const primaryBankAccount = selectPrimaryRecord(activeBankAccounts)

  const ledgerPreviewQuery = useQuery({
    queryKey: ["parties", party?.id, "ledger-preview"],
    queryFn: () =>
      getPartyLedger(party?.id ?? "", accessToken, {
        entryType: "all",
        status: "all",
        limit: 500,
      }),
    enabled: Boolean(
      open &&
      party?.id &&
      accessToken &&
      (activeTab === "ledger" || activeTab === "overview")
    ),
    staleTime: 1000 * 60,
  })

  const documentsQuery = useQuery({
    queryKey: ["parties", party?.id, "documents"],
    queryFn: () => getPartyDocuments(party?.id ?? "", accessToken),
    enabled: Boolean(open && party?.id && accessToken && activeTab === "documents"),
    staleTime: 1000 * 30,
  })

  const auditQuery = useQuery({
    queryKey: ["parties", party?.id, "audit"],
    queryFn: () => getPartyAudit(party?.id ?? "", accessToken, { page: 1, limit: 50 }),
    enabled: Boolean(open && party?.id && accessToken && activeTab === "audit"),
    staleTime: 1000 * 20,
  })

  const gstMutation = useMutation({
    mutationFn: async () => {
      if (!party) {
        throw new Error("Party not loaded.")
      }

      const errors = validateGstRegistrationForm(gstForm, party.addresses)
      if (Object.keys(errors).length > 0) {
        setGstErrors(errors)
        throw new Error("Fix the GST registration fields.")
      }

      const payload = buildGstRegistrationPayloadFromState(gstForm)

      if (gstFormMode === "edit" && editingGstRegistrationId) {
        return updatePartyGstRegistration(
          party.id,
          editingGstRegistrationId,
          payload,
          accessToken
        )
      }

      return addPartyGstRegistration(party.id, payload, accessToken)
    },
    onSuccess: (response) => {
      onPartyChanged(response.party)
      resetGstForm()
      toast.success("GST registration saved.")
    },
    onError: (error) => {
      if (getErrorMessage(error) !== "Fix the GST registration fields.") {
        toast.error(getErrorMessage(error))
      }
    },
  })

  const gstArchiveMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      if (!party) {
        throw new Error("Party not loaded.")
      }

      return archivePartyGstRegistration(party.id, registrationId, accessToken)
    },
    onSuccess: (response) => {
      onPartyChanged(response.party)
      toast.success("GST registration archived.")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const gstPrimaryMutation = useMutation({
    mutationFn: async (registration: PartyGstRegistration) => {
      if (!party) {
        throw new Error("Party not loaded.")
      }

      return updatePartyGstRegistration(
        party.id,
        registration.id,
        { isPrimary: true },
        accessToken
      )
    },
    onSuccess: (response) => {
      onPartyChanged(response.party)
      toast.success("Primary GST registration updated.")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const documentMutation = useMutation({
    mutationFn: async () => {
      if (!party) {
        throw new Error("Party not loaded.")
      }

      const title = documentForm.title.trim()
      const fileReference = documentForm.fileReference.trim()
      if (!title || !fileReference) {
        throw new Error("Add a document title and secured file reference.")
      }

      const fileSizeBytes = documentForm.fileSizeBytes.trim()

      return addPartyDocument(
        party.id,
        {
          documentType: documentForm.documentType,
          title,
          fileReference,
          fileName: documentForm.fileName.trim() || null,
          mimeType: documentForm.mimeType.trim() || null,
          fileSizeBytes: fileSizeBytes ? Number(fileSizeBytes) : null,
          notes: documentForm.notes.trim() || null,
          status: "active",
        },
        accessToken
      )
    },
    onSuccess: async (response) => {
      onPartyChanged(response.party)
      setDocumentForm(emptyDocumentForm)
      await Promise.all([documentsQuery.refetch(), auditQuery.refetch()])
      toast.success("Party document saved.")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const documentArchiveMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (!party) {
        throw new Error("Party not loaded.")
      }

      return archivePartyDocument(party.id, documentId, accessToken)
    },
    onSuccess: async (response) => {
      onPartyChanged(response.party)
      await Promise.all([documentsQuery.refetch(), auditQuery.refetch()])
      toast.success("Party document archived.")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function updateGstFormValue<K extends keyof GstRegistrationFormState>(
    key: K,
    value: GstRegistrationFormState[K]
  ) {
    setGstForm((current) => ({ ...current, [key]: value }))
    setGstErrors((currentErrors) => ({ ...currentErrors, [key]: undefined }))
  }

  function resetGstForm() {
    setGstFormMode(null)
    setEditingGstRegistrationId(null)
    setGstForm(emptyGstRegistrationForm)
    setGstErrors({})
  }

  function resetDocumentForm() {
    setDocumentForm(emptyDocumentForm)
  }

  function startCreateGstRegistration() {
    setGstFormMode("create")
    setEditingGstRegistrationId(null)
    setGstForm({
      ...emptyGstRegistrationForm,
      isPrimary: activeGstRegistrations.length === 0,
    })
    setGstErrors({})
  }

  function startEditGstRegistration(registration: PartyGstRegistration) {
    setGstFormMode("edit")
    setEditingGstRegistrationId(registration.id)
    setGstForm(createGstFormFromRegistration(registration))
    setGstErrors({})
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetGstForm()
      resetDocumentForm()
      setActiveTab("overview")
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-5xl gap-0 overflow-hidden p-0">
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
                    <Button
                      nativeButton={false}
                      render={<Link href={`/parties/${party.id}/ledger`} />}
                      size="xs"
                      variant="outline"
                    >
                      <BookOpenTextIcon className="size-3.5" />
                      Ledger
                    </Button>
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

            <Tabs
              value={activeTab}
              defaultValue="overview"
              onValueChange={(value) => setActiveTab(value as PartyWorkspaceTab)}
              className="min-h-0 flex-1 gap-0 overflow-hidden"
            >
              <div className="border-b border-border px-4 py-2">
                <TabsList className="app-scrollbar flex h-auto max-w-full justify-start gap-1 overflow-x-auto rounded-none border-0 bg-transparent p-0">
                  {partyWorkspaceTabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="min-w-fit gap-1.5 rounded-lg px-2.5 py-1.5 text-xs data-[state=active]:bg-muted data-[state=active]:shadow-none"
                      >
                        <Icon className="size-3.5" />
                        {tab.label}
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </div>

              <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
                <TabsContent value="overview" className="space-y-3">
                  <PartyOverviewTab
                    ledgerEntries={ledgerPreviewQuery.data?.entries ?? []}
                    ledgerLoading={ledgerPreviewQuery.isLoading}
                    party={party}
                    primaryAddress={primaryAddress}
                    primaryBankAccount={primaryBankAccount}
                    primaryContact={primaryContact}
                    primaryGst={primaryGst}
                  />
                </TabsContent>

                <TabsContent value="gst" className="space-y-3">
                  <GstWorkspaceTab
                    addresses={party.addresses}
                    activeGstRegistrations={activeGstRegistrations}
                    errors={gstErrors}
                    form={gstForm}
                    formMode={gstFormMode}
                    isArchivingOrPrimaryPending={
                      gstArchiveMutation.isPending || gstPrimaryMutation.isPending
                    }
                    isSaving={gstMutation.isPending}
                    onAdd={startCreateGstRegistration}
                    onArchive={(registrationId) => gstArchiveMutation.mutate(registrationId)}
                    onCancel={resetGstForm}
                    onChange={updateGstFormValue}
                    onEdit={startEditGstRegistration}
                    onSave={() => gstMutation.mutate()}
                    onSetPrimary={(registration) => gstPrimaryMutation.mutate(registration)}
                  />
                </TabsContent>

                <TabsContent value="addresses" className="space-y-3">
                  <AddressesWorkspaceTab
                    addresses={party.addresses}
                    gstRegistrations={activeGstRegistrations}
                  />
                </TabsContent>

                <TabsContent value="contacts" className="space-y-3">
                  <ContactsWorkspaceTab contacts={party.contacts} />
                </TabsContent>

                <TabsContent value="bank" className="space-y-3">
                  <BankWorkspaceTab bankAccounts={party.bankAccounts} />
                </TabsContent>

                <TabsContent value="commercial" className="space-y-3">
                  <CommercialWorkspaceTab party={party} />
                </TabsContent>

                <TabsContent value="ledger" className="space-y-3">
                  <LedgerWorkspaceTab
                    entries={ledgerPreviewQuery.data?.entries ?? []}
                    isLoading={ledgerPreviewQuery.isLoading}
                    party={party}
                    totals={ledgerPreviewQuery.data?.totals}
                  />
                </TabsContent>

                <TabsContent value="documents" className="space-y-3">
                  <DocumentsWorkspaceTab
                    documents={documentsQuery.data?.documents ?? []}
                    form={documentForm}
                    isArchiving={documentArchiveMutation.isPending}
                    isLoading={documentsQuery.isLoading}
                    isSaving={documentMutation.isPending}
                    onArchive={(documentId) => documentArchiveMutation.mutate(documentId)}
                    onChange={(patch) =>
                      setDocumentForm((current) => ({ ...current, ...patch }))
                    }
                    onReset={resetDocumentForm}
                    onSave={() => documentMutation.mutate()}
                    pendingArchiveId={documentArchiveMutation.variables ?? null}
                  />
                </TabsContent>

                <TabsContent value="audit" className="space-y-3">
                  <AuditWorkspaceTab
                    entries={auditQuery.data?.audit ?? []}
                    isLoading={auditQuery.isLoading}
                    pagination={auditQuery.data?.pagination}
                  />
                </TabsContent>

                <TabsContent value="more" className="space-y-3">
                  <MoreWorkspaceTab party={party} />
                </TabsContent>
              </div>
            </Tabs>
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

function PartyOverviewTab({
  ledgerEntries,
  ledgerLoading,
  party,
  primaryAddress,
  primaryBankAccount,
  primaryContact,
  primaryGst,
}: {
  ledgerEntries: PartyLedgerEntry[]
  ledgerLoading: boolean
  party: PartyDetail
  primaryAddress: PartyDetail["addresses"][number] | null
  primaryBankAccount: PartyDetail["bankAccounts"][number] | null
  primaryContact: PartyDetail["contacts"][number] | null
  primaryGst: PartyGstRegistration | null
}) {
  return (
    <>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoTile label="PAN" value={party.pan ?? "Not added"} mono={Boolean(party.pan)} />
        <InfoTile
          label="Primary GSTIN"
          value={primaryGst?.gstin ?? "Not GST registered"}
          mono={Boolean(primaryGst)}
        />
        <InfoTile
          label="Receivable"
          value={formatCurrencyValue(party.outstandingSummary.receivable)}
        />
        <InfoTile
          label="Payable"
          value={formatCurrencyValue(party.outstandingSummary.payable)}
        />
        <InfoTile
          label="Open sales"
          value={`${party.outstandingSummary.openReceivableCount} invoices`}
        />
        <InfoTile
          label="Open purchases"
          value={`${party.outstandingSummary.openPayableCount} bills`}
        />
        <InfoTile
          label="Overdue receivable"
          value={formatCurrencyValue(party.outstandingSummary.overdueReceivable)}
        />
        <InfoTile
          label="Overdue payable"
          value={formatCurrencyValue(party.outstandingSummary.overduePayable)}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <DetailSection
          count={4}
          icon={<ClipboardListIcon className="size-3.5" />}
          title="Default transaction records"
        >
          <div className="grid gap-2">
            <DetailRow
              badge={primaryGst?.isPrimary ? "Primary" : undefined}
              description={
                primaryGst ?
                  `${primaryGst.state || `State ${primaryGst.stateCode}`} · ${capitalizeText(primaryGst.registrationType)}`
                  : "New B2C/POS transactions can still use this party without GST."
              }
              icon={<ReceiptTextIcon className="size-3.5" />}
              meta={[primaryGst?.status ? capitalizeText(primaryGst.status) : null]}
              monoTitle={Boolean(primaryGst)}
              title={primaryGst?.gstin ?? "No GSTIN selected"}
            />
            <DetailRow
              badge={primaryAddress?.isPrimary ? "Primary" : undefined}
              description={
                primaryAddress ? formatAddress(primaryAddress) : "No active address is saved."
              }
              icon={<MapPinIcon className="size-3.5" />}
              meta={[primaryAddress?.label, capitalizeText(primaryAddress?.addressType)]}
              title={primaryAddress?.label || "Primary address"}
            />
            <DetailRow
              badge={primaryContact?.isPrimary ? "Primary" : undefined}
              description={
                primaryContact ?
                  [primaryContact.mobile, primaryContact.phone, primaryContact.email]
                    .filter(Boolean)
                    .join(" · ") || "No phone/email"
                  : "No active contact is saved."
              }
              icon={<ContactRoundIcon className="size-3.5" />}
              meta={[primaryContact?.designation, capitalizeText(primaryContact?.contactRole)]}
              title={primaryContact?.name ?? "Primary contact"}
            />
            <DetailRow
              badge={primaryBankAccount?.isPrimary ? "Primary" : undefined}
              description={
                primaryBankAccount ?
                  [
                    primaryBankAccount.accountName,
                    primaryBankAccount.accountNumberMasked,
                    primaryBankAccount.ifsc,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Masked bank account"
                  : "Party bank account is optional and distinct from your business bank."
              }
              icon={<BanknoteIcon className="size-3.5" />}
              meta={[capitalizeText(primaryBankAccount?.accountType), primaryBankAccount?.branch]}
              title={primaryBankAccount?.bankName ?? "No party bank account"}
            />
          </div>
        </DetailSection>

        <DetailSection
          count={ledgerEntries.length}
          icon={<TrendingUpIcon className="size-3.5" />}
          title="Aging snapshot"
          action={
            <Button
              nativeButton={false}
              render={<Link href={`/parties/${party.id}/ledger`} />}
              size="xs"
              variant="outline"
            >
              Open ledger
            </Button>
          }
        >
          {ledgerLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
            </div>
          ) : (
            <AgingBucketsView entries={ledgerEntries} />
          )}
        </DetailSection>
      </div>
    </>
  )
}

function GstWorkspaceTab({
  activeGstRegistrations,
  addresses,
  errors,
  form,
  formMode,
  isArchivingOrPrimaryPending,
  isSaving,
  onAdd,
  onArchive,
  onCancel,
  onChange,
  onEdit,
  onSave,
  onSetPrimary,
}: {
  activeGstRegistrations: PartyGstRegistration[]
  addresses: PartyDetail["addresses"]
  errors: GstRegistrationFormErrors
  form: GstRegistrationFormState
  formMode: "create" | "edit" | null
  isArchivingOrPrimaryPending: boolean
  isSaving: boolean
  onAdd: () => void
  onArchive: (registrationId: string) => void
  onCancel: () => void
  onChange: <K extends keyof GstRegistrationFormState>(
    key: K,
    value: GstRegistrationFormState[K]
  ) => void
  onEdit: (registration: PartyGstRegistration) => void
  onSave: () => void
  onSetPrimary: (registration: PartyGstRegistration) => void
}) {
  return (
    <DetailSection
      count={activeGstRegistrations.length}
      icon={<ReceiptTextIcon className="size-3.5" />}
      title="GST registrations"
      action={
        <Button type="button" size="xs" variant="outline" onClick={onAdd}>
          <PlusIcon className="size-3.5" />
          Add GSTIN
        </Button>
      }
    >
      <div className="grid gap-2">
        {formMode ? (
          <GstRegistrationInlineForm
            addresses={addresses}
            errors={errors}
            form={form}
            isPending={isSaving}
            mode={formMode}
            onCancel={onCancel}
            onChange={onChange}
            onSubmit={onSave}
          />
        ) : null}

        {activeGstRegistrations.map((registration) => (
          <GstRegistrationDetailRow
            key={registration.id}
            isMutating={isArchivingOrPrimaryPending}
            registration={registration}
            addresses={addresses}
            onArchive={() => onArchive(registration.id)}
            onEdit={() => onEdit(registration)}
            onSetPrimary={() => onSetPrimary(registration)}
          />
        ))}
        {activeGstRegistrations.length === 0 && !formMode ? (
          <EmptyDetailLine text="This party is not GST registered." />
        ) : null}
      </div>
    </DetailSection>
  )
}

function AddressesWorkspaceTab({
  addresses,
  gstRegistrations,
}: {
  addresses: PartyDetail["addresses"]
  gstRegistrations: PartyGstRegistration[]
}) {
  return (
    <DetailSection
      count={addresses.length}
      icon={<MapPinIcon className="size-3.5" />}
      title="Addresses"
    >
      <div className="grid gap-2">
        {addresses.map((address) => {
          const mappedGstins = gstRegistrations.filter(
            (registration) => registration.registeredAddressId === address.id
          )
          return (
            <DetailRow
              key={address.id}
              badge={address.isPrimary ? "Primary" : undefined}
              description={formatAddress(address)}
              icon={<MapPinIcon className="size-3.5" />}
              meta={[
                address.label,
                capitalizeText(address.addressType),
                address.isActive ? "Active" : "Inactive",
                ...mappedGstins.map((registration) => `${registration.stateCode} GSTIN`),
              ]}
              title={address.label || capitalizeText(address.addressType) || "Address"}
            />
          )
        })}
        {addresses.length === 0 ? (
          <EmptyDetailLine text="No address records are saved for this party." />
        ) : null}
      </div>
    </DetailSection>
  )
}

function ContactsWorkspaceTab({ contacts }: { contacts: PartyDetail["contacts"] }) {
  return (
    <DetailSection
      count={contacts.length}
      icon={<ContactRoundIcon className="size-3.5" />}
      title="Contacts"
    >
      <div className="grid gap-2">
        {contacts.map((contact) => (
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
        {contacts.length === 0 ? (
          <EmptyDetailLine text="No contact people are saved for this party." />
        ) : null}
      </div>
    </DetailSection>
  )
}

function BankWorkspaceTab({ bankAccounts }: { bankAccounts: PartyDetail["bankAccounts"] }) {
  return (
    <DetailSection
      count={bankAccounts.length}
      icon={<BanknoteIcon className="size-3.5" />}
      title="Party bank accounts"
    >
      <div className="grid gap-2">
        {bankAccounts.map((account) => (
          <DetailRow
            key={account.id}
            badge={account.isPrimary ? "Primary" : capitalizeText(account.status) ?? undefined}
            description={
              [account.accountName, account.accountNumberMasked, account.ifsc]
                .filter(Boolean)
                .join(" · ") || "Masked account details"
            }
            icon={<BanknoteIcon className="size-3.5" />}
            meta={[
              capitalizeText(account.accountType),
              account.branch,
              account.status === "archived" ? "Archived" : null,
            ]}
            title={account.bankName}
          />
        ))}
        {bankAccounts.length === 0 ? (
          <EmptyDetailLine text="No party bank accounts are saved. This does not affect your business cash/bank ledger accounts." />
        ) : null}
      </div>
    </DetailSection>
  )
}

function CommercialWorkspaceTab({ party }: { party: PartyDetail }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <DetailSection
        count={party.customerProfile ? 1 : 0}
        icon={<StoreIcon className="size-3.5" />}
        title="Customer commercial terms"
      >
        {party.customerProfile ? (
          <div className="grid gap-2">
            <InfoGridRow label="Customer code" value={party.customerProfile.customerCode} />
            <InfoGridRow
              label="Credit limit"
              value={formatCurrencyValue(party.customerProfile.creditLimit)}
            />
            <InfoGridRow label="Credit days" value={`${party.customerProfile.creditDays} days`} />
            <InfoGridRow
              label="Payment term"
              value={party.customerProfile.defaultPaymentTermId ? "Configured" : "Not set"}
            />
            <InfoGridRow
              label="Default billing"
              value={party.customerProfile.defaultBillingAddressId ? "Configured" : "Not set"}
            />
            <InfoGridRow
              label="Default shipping"
              value={party.customerProfile.defaultShippingAddressId ? "Configured" : "Not set"}
            />
          </div>
        ) : (
          <EmptyDetailLine text="Customer role is not active for this party." />
        )}
      </DetailSection>

      <DetailSection
        count={party.supplierProfile ? 1 : 0}
        icon={<ArchiveIcon className="size-3.5" />}
        title="Supplier commercial terms"
      >
        {party.supplierProfile ? (
          <div className="grid gap-2">
            <InfoGridRow label="Supplier code" value={party.supplierProfile.supplierCode} />
            <InfoGridRow label="Credit days" value={`${party.supplierProfile.creditDays} days`} />
            <InfoGridRow
              label="Lead time"
              value={`${party.supplierProfile.leadTimeDays} days`}
            />
            <InfoGridRow
              label="Payment term"
              value={party.supplierProfile.defaultPaymentTermId ? "Configured" : "Not set"}
            />
            <InfoGridRow
              label="Purchase address"
              value={party.supplierProfile.defaultPurchaseAddressId ? "Configured" : "Not set"}
            />
            <InfoGridRow
              label="Warehouse"
              value={party.supplierProfile.preferredWarehouseId ? "Configured" : "Not set"}
            />
          </div>
        ) : (
          <EmptyDetailLine text="Supplier role is not active for this party." />
        )}
      </DetailSection>

      <DetailSection
        count={4}
        icon={<BadgeIndianRupeeIcon className="size-3.5" />}
        title="Accounting mapping"
      >
        <EmptyDetailLine text="Receivable, payable, customer advance, and supplier advance mappings are enforced by backend ledger-account integrity. Editable account mapping UI belongs with Accounting permissions." />
      </DetailSection>

      <DetailSection
        count={0}
        icon={<BriefcaseBusinessIcon className="size-3.5" />}
        title="Branch preferences"
      >
        <EmptyDetailLine text="Party remains business-wide. Branch-specific payment terms, price group, sales rep, or address can be added without duplicating this party." />
      </DetailSection>
    </div>
  )
}

function LedgerWorkspaceTab({
  entries,
  isLoading,
  party,
  totals,
}: {
  entries: PartyLedgerEntry[]
  isLoading: boolean
  party: PartyDetail
  totals?: PartyLedgerTotals
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Receivable"
          value={formatCurrencyValue(totals?.receivableOutstanding ?? party.outstandingSummary.receivable)}
          helper={`${party.outstandingSummary.openReceivableCount} open invoices`}
        />
        <MetricCard
          label="Payable"
          value={formatCurrencyValue(totals?.payableOutstanding ?? party.outstandingSummary.payable)}
          helper={`${party.outstandingSummary.openPayableCount} open bills`}
        />
        <MetricCard
          label="Overdue receivable"
          value={formatCurrencyValue(party.outstandingSummary.overdueReceivable)}
          helper="Derived from due dates"
        />
        <MetricCard
          label="Overdue payable"
          value={formatCurrencyValue(party.outstandingSummary.overduePayable)}
          helper="Derived from due dates"
        />
      </div>

      <DetailSection
        count={entries.length}
        icon={<CalendarClockIcon className="size-3.5" />}
        title="Aging"
        action={
          <Button
            nativeButton={false}
            render={<Link href={`/parties/${party.id}/ledger`} />}
            size="xs"
            variant="outline"
          >
            Full ledger
          </Button>
        }
      >
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
        ) : (
          <AgingBucketsView entries={entries} />
        )}
      </DetailSection>

      <DetailSection
        count={entries.length}
        icon={<BookOpenTextIcon className="size-3.5" />}
        title="Recent ledger movement"
      >
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        ) : entries.length > 0 ? (
          <div className="grid gap-2">
            {entries.slice(0, 8).map((entry) => (
              <LedgerPreviewRow key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <EmptyDetailLine text="No ledger movement yet. Posted sales, purchases, receipts, and payments will appear here." />
        )}
      </DetailSection>
    </>
  )
}

function MoreWorkspaceTab({ party }: { party: PartyDetail }) {
  return (
    <div className="grid gap-3">
      <DetailSection
        count={0}
        icon={<ClipboardListIcon className="size-3.5" />}
        title="Transactions"
      >
        <EmptyDetailLine text="Sales invoices, purchase bills, credit/debit notes, returns, receipts, and payments will drill down here as those engines post source documents." />
      </DetailSection>
      <p className="text-xs text-muted-foreground">
        Documents and audit history are available as dedicated tabs for {party.displayName}.
      </p>
    </div>
  )
}

function DocumentsWorkspaceTab({
  documents,
  form,
  isArchiving,
  isLoading,
  isSaving,
  onArchive,
  onChange,
  onReset,
  onSave,
  pendingArchiveId,
}: {
  documents: PartyDocument[]
  form: PartyDocumentFormState
  isArchiving: boolean
  isLoading: boolean
  isSaving: boolean
  onArchive: (documentId: string) => void
  onChange: (patch: Partial<PartyDocumentFormState>) => void
  onReset: () => void
  onSave: () => void
  pendingArchiveId: string | null
}) {
  const activeDocuments = documents.filter((document) => document.status !== "archived")
  const archivedDocuments = documents.filter((document) => document.status === "archived")
  const canSave = Boolean(form.title.trim() && form.fileReference.trim() && !isSaving)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <DetailSection
        count={activeDocuments.length}
        icon={<FileTextIcon className="size-3.5" />}
        title="Save document reference"
      >
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="party-document-type">Document type</FieldLabel>
              <Select
                value={form.documentType}
                onValueChange={(value) =>
                  onChange({ documentType: value as PartyDocument["documentType"] })
                }
              >
                <SelectTrigger id="party-document-type" className="w-full">
                  <SelectDisplayValue
                    value={form.documentType}
                    options={documentTypeOptions}
                    placeholder="Choose type"
                  />
                </SelectTrigger>
                <SelectContent align="start" sideOffset={8}>
                  {documentTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="party-document-title">Title *</FieldLabel>
              <Input
                id="party-document-title"
                value={form.title}
                onChange={(event) => onChange({ title: event.target.value })}
                placeholder="GST certificate FY 2026"
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="party-document-reference">
                Secured file reference *
              </FieldLabel>
              <Input
                id="party-document-reference"
                value={form.fileReference}
                onChange={(event) => onChange({ fileReference: event.target.value })}
                placeholder="r2://party-documents/... or https://secure-file-url"
              />
              <p className="text-xs text-muted-foreground">
                Store only the storage key or signed-access reference. Do not paste raw file data.
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="party-document-file-name">File name</FieldLabel>
              <Input
                id="party-document-file-name"
                value={form.fileName}
                onChange={(event) => onChange({ fileName: event.target.value })}
                placeholder="gst-certificate.pdf"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="party-document-mime">MIME type</FieldLabel>
              <Input
                id="party-document-mime"
                value={form.mimeType}
                onChange={(event) => onChange({ mimeType: event.target.value })}
                placeholder="application/pdf"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="party-document-size">Size in bytes</FieldLabel>
              <Input
                id="party-document-size"
                inputMode="numeric"
                value={form.fileSizeBytes}
                onChange={(event) =>
                  onChange({ fileSizeBytes: event.target.value.replace(/\D/g, "") })
                }
                placeholder="245760"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="party-document-notes">Notes</FieldLabel>
              <Input
                id="party-document-notes"
                value={form.notes}
                onChange={(event) => onChange({ notes: event.target.value })}
                placeholder="Verified during onboarding"
              />
            </Field>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onReset}>
              Clear
            </Button>
            <Button type="button" disabled={!canSave} onClick={onSave}>
              {isSaving ? <Spinner /> : "Save document"}
            </Button>
          </div>
        </div>
      </DetailSection>

      <DetailSection
        count={documents.length}
        icon={<ArchiveIcon className="size-3.5" />}
        title="Document vault"
      >
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : documents.length > 0 ? (
          <div className="grid gap-2">
            {activeDocuments.map((document) => (
              <PartyDocumentRow
                key={document.id}
                document={document}
                isArchiving={isArchiving && pendingArchiveId === document.id}
                onArchive={() => onArchive(document.id)}
              />
            ))}
            {archivedDocuments.length > 0 ? (
              <div className="pt-2">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Archived
                </p>
                {archivedDocuments.map((document) => (
                  <PartyDocumentRow
                    key={document.id}
                    document={document}
                    isArchiving={false}
                    onArchive={() => undefined}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyDetailLine text="No documents saved yet. Add GST certificates, PAN, bank proof, agreements, and onboarding documents as secured references." />
        )}
      </DetailSection>
    </div>
  )
}

function PartyDocumentRow({
  document,
  isArchiving,
  onArchive,
}: {
  document: PartyDocument
  isArchiving: boolean
  onArchive: () => void
}) {
  const isArchived = document.status === "archived"
  const canOpen = isHttpUrl(document.fileReference)

  return (
    <div className="flex gap-2 border-t border-border/60 py-2 first:border-t-0">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-muted-foreground">
        <FileTextIcon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{document.title}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {document.fileName || document.fileReference}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1">
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
              {getDocumentTypeLabel(document.documentType)}
            </Badge>
            {isArchived ? (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                Archived
              </Badge>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDate(document.createdAt)}
          {document.fileSizeBytes ? ` · ${formatBytes(document.fileSizeBytes)}` : ""}
          {document.mimeType ? ` · ${document.mimeType}` : ""}
        </p>
        {document.notes ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{document.notes}</p>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {canOpen ? (
            <Button
              nativeButton={false}
              render={
                <a
                  href={document.fileReference}
                  rel="noreferrer"
                  target="_blank"
                />
              }
              size="xs"
              variant="outline"
            >
              Open
            </Button>
          ) : null}
          {!isArchived ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={isArchiving}
              onClick={onArchive}
            >
              {isArchiving ? <Spinner /> : "Archive"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function AuditWorkspaceTab({
  entries,
  isLoading,
  pagination,
}: {
  entries: PartyAuditEntry[]
  isLoading: boolean
  pagination?: { total: number }
}) {
  return (
    <DetailSection
      count={pagination?.total ?? entries.length}
      icon={<HistoryIcon className="size-3.5" />}
      title="Audit timeline"
    >
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : entries.length > 0 ? (
        <div className="relative space-y-0">
          {entries.map((entry, index) => (
            <AuditTimelineRow
              key={entry.id}
              entry={entry}
              isLast={index === entries.length - 1}
            />
          ))}
        </div>
      ) : (
        <EmptyDetailLine text="No party audit events yet. Changes to identity, roles, GSTIN, addresses, contacts, bank accounts, documents, and archive status will appear here." />
      )}
    </DetailSection>
  )
}

function AuditTimelineRow({
  entry,
  isLast,
}: {
  entry: PartyAuditEntry
  isLast: boolean
}) {
  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">
      {!isLast ? (
        <span className="absolute left-[7px] top-4 h-full w-px bg-border" aria-hidden="true" />
      ) : null}
      <span className="relative mt-1 flex size-3.5 shrink-0 rounded-full border border-primary/30 bg-primary/15" />
      <div className="min-w-0 flex-1 rounded-xl border border-border bg-background p-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{formatAuditAction(entry.action)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDateTime(entry.createdAt)} by {getAuditActorLabel(entry)}
            </p>
          </div>
          <Badge variant="secondary" className="h-5 w-fit px-1.5 text-[10px] font-normal">
            {entry.entityType}
          </Badge>
        </div>
        {entry.reason ? (
          <p className="mt-2 text-xs text-muted-foreground">{entry.reason}</p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          {getAuditPayloadSummary(entry)}
        </p>
      </div>
    </div>
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
  action,
  children,
  count,
  icon,
  title,
}: {
  action?: React.ReactNode
  children: React.ReactNode
  count: number
  icon: React.ReactNode
  title: string
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
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      {action}
      {children}
    </section>
  )
}

function GstRegistrationInlineForm({
  addresses,
  errors,
  form,
  isPending,
  mode,
  onCancel,
  onChange,
  onSubmit,
}: {
  addresses: PartyDetail["addresses"]
  errors: GstRegistrationFormErrors
  form: GstRegistrationFormState
  isPending: boolean
  mode: "create" | "edit"
  onCancel: () => void
  onChange: <K extends keyof GstRegistrationFormState>(
    key: K,
    value: GstRegistrationFormState[K]
  ) => void
  onSubmit: () => void
}) {
  const addressOptions = [
    { value: "none", label: "No registered address" },
    ...addresses.map((address, index) => ({
      value: address.id,
      label: formatDetailAddressOptionLabel(address, index),
    })),
  ]
  const selectedAddress = addresses.find(
    (address) => address.id === form.registeredAddressId
  )

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {mode === "edit" ? "Edit GST registration" : "Add GST registration"}
          </p>
          <p className="text-xs text-muted-foreground">
            The first two digits must match the GST state code.
          </p>
        </div>
        <Button type="button" size="xs" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="detail-gstin">GSTIN *</FieldLabel>
          <Input
            id="detail-gstin"
            value={form.gstin}
            maxLength={15}
            onChange={(event) => {
              const gstin = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
              onChange("gstin", gstin)
              if (gstin.length >= 2) {
                onChange("stateCode", gstin.slice(0, 2))
              }
            }}
            className="font-mono uppercase tracking-[0.14em]"
            placeholder="33ABCDE1234F1Z5"
          />
          <FieldError>{errors.gstin}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="detail-gst-state-code">State code *</FieldLabel>
          <Input
            id="detail-gst-state-code"
            value={form.stateCode}
            maxLength={2}
            inputMode="numeric"
            onChange={(event) =>
              onChange("stateCode", event.target.value.replace(/\D/g, ""))
            }
            placeholder="33"
          />
          <FieldError>{errors.stateCode}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="detail-gst-legal-name">Legal name</FieldLabel>
          <Input
            id="detail-gst-legal-name"
            value={form.legalName}
            onChange={(event) => onChange("legalName", event.target.value)}
            placeholder="As per GST certificate"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="detail-gst-trade-name">Trade name</FieldLabel>
          <Input
            id="detail-gst-trade-name"
            value={form.tradeName}
            onChange={(event) => onChange("tradeName", event.target.value)}
            placeholder="Trade name"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="detail-gst-registration-type">Registration type</FieldLabel>
          <Select
            value={form.registrationType}
            onValueChange={(value) =>
              onChange(
                "registrationType",
                (value as PartyGstRegistration["registrationType"] | null) ?? "gst"
              )
            }
          >
            <SelectTrigger id="detail-gst-registration-type" className="w-full">
              <SelectDisplayValue
                value={form.registrationType}
                options={gstRegistrationTypeOptions}
                placeholder="Choose type"
              />
            </SelectTrigger>
            <SelectContent align="start" sideOffset={8}>
              {gstRegistrationTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="detail-gst-status">Status</FieldLabel>
          <Select
            value={form.status}
            onValueChange={(value) =>
              onChange(
                "status",
                (value as PartyGstRegistration["status"] | null) ?? "active"
              )
            }
          >
            <SelectTrigger id="detail-gst-status" className="w-full">
              <SelectDisplayValue
                value={form.status}
                options={gstRegistrationStatusOptions}
                placeholder="Choose status"
              />
            </SelectTrigger>
            <SelectContent align="start" sideOffset={8}>
              {gstRegistrationStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="detail-gst-state">State</FieldLabel>
          <Input
            id="detail-gst-state"
            value={form.state}
            onChange={(event) => onChange("state", event.target.value)}
            placeholder="Tamil Nadu"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="detail-taxpayer-type">Taxpayer type</FieldLabel>
          <Input
            id="detail-taxpayer-type"
            value={form.taxpayerType}
            onChange={(event) => onChange("taxpayerType", event.target.value)}
            placeholder="Regular / Composition"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="detail-effective-from">Effective from</FieldLabel>
          <Input
            id="detail-effective-from"
            type="date"
            value={form.effectiveFrom}
            onChange={(event) => onChange("effectiveFrom", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="detail-effective-to">Effective to</FieldLabel>
          <Input
            id="detail-effective-to"
            type="date"
            value={form.effectiveTo}
            onChange={(event) => onChange("effectiveTo", event.target.value)}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="detail-gst-registered-address">
            Registered address for this GSTIN
          </FieldLabel>
          <Select
            value={form.registeredAddressId || "none"}
            onValueChange={(value) => {
              const nextValue = value ?? "none"
              onChange("registeredAddressId", nextValue === "none" ? "" : nextValue)
            }}
          >
            <SelectTrigger id="detail-gst-registered-address" className="w-full">
              <SelectDisplayValue
                value={form.registeredAddressId || "none"}
                options={addressOptions}
                placeholder="Choose registered address"
              />
            </SelectTrigger>
            <SelectContent align="start" sideOffset={8}>
              {addressOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAddress?.stateCode &&
            form.stateCode &&
            selectedAddress.stateCode !== form.stateCode ? (
            <p className="text-xs text-destructive">
              Address state code {selectedAddress.stateCode} does not match GSTIN
              state code {form.stateCode}.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Map this GSTIN to the address printed on its registration certificate.
            </p>
          )}
          <FieldError>{errors.registeredAddressId}</FieldError>
        </Field>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CompactCheckOption
          checked={form.isPrimary}
          label="Primary GSTIN"
          helper="Use as default on new transactions"
          onClick={() => onChange("isPrimary", !form.isPrimary)}
        />
        <Button type="button" disabled={isPending} onClick={onSubmit}>
          {isPending ? <Spinner /> : "Save GSTIN"}
        </Button>
      </div>
    </div>
  )
}

function CompactCheckOption({
  checked,
  helper,
  label,
  onClick,
}: {
  checked: boolean
  helper: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        checked ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/30"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"
        )}
      >
        {checked ? <CheckIcon className="size-3" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{helper}</span>
      </span>
    </button>
  )
}

function GstRegistrationDetailRow({
  addresses,
  isMutating,
  onArchive,
  onEdit,
  onSetPrimary,
  registration,
}: {
  addresses: PartyDetail["addresses"]
  isMutating: boolean
  onArchive: () => void
  onEdit: () => void
  onSetPrimary: () => void
  registration: PartyGstRegistration
}) {
  const registeredAddress =
    addresses.find((address) => address.id === registration.registeredAddressId) ?? null

  return (
    <div className="flex gap-2 border-t border-border/60 py-2 first:border-t-0">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-muted-foreground">
        <ReceiptTextIcon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-mono text-xs font-medium tracking-[0.12em]">
              {registration.gstin}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {registration.legalName || registration.tradeName || "GST registration"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1">
            {registration.isPrimary ? (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                Primary
              </Badge>
            ) : null}
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
              {capitalizeText(registration.status) ?? registration.status}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {[
            registration.state || registration.stateCode,
            capitalizeText(registration.registrationType),
            capitalizeText(registration.taxpayerType),
          ]
            .filter((item): item is string => Boolean(item))
            .map((item) => (
              <Badge
                key={item}
                variant="secondary"
                className="h-5 px-1.5 text-[10px] font-normal"
              >
                {item}
              </Badge>
            ))}
        </div>
        {registeredAddress ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            Registered address: {formatCompactAddressLabel(registeredAddress)}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {!registration.isPrimary ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={isMutating}
              onClick={onSetPrimary}
            >
              Set primary
            </Button>
          ) : null}
          <Button type="button" size="xs" variant="ghost" onClick={onEdit}>
            Edit
          </Button>
          <Button
            type="button"
            size="xs"
            variant="destructive"
            disabled={isMutating}
            onClick={onArchive}
          >
            Archive
          </Button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({
  badge,
  description,
  icon,
  meta,
  monoTitle,
  title,
}: {
  badge?: string
  description: string
  icon: React.ReactNode
  meta?: Array<string | null | undefined>
  monoTitle?: boolean
  title: string
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
  return <p className="py-1 text-xs text-muted-foreground">{text}</p>
}

function formatDetailAddressOptionLabel(
  address: PartyDetail["addresses"][number],
  index: number
) {
  const label = address.label?.trim()
  const typeLabel =
    addressTypeOptions.find((option) => option.value === address.addressType)?.label ??
    "Address"
  const line = address.addressLine1?.trim()
  const city = address.city?.trim() || address.district?.trim()
  const stateCode = address.stateCode?.trim()

  return [
    label || `${typeLabel} ${index + 1}`,
    line,
    city,
    stateCode ? `State ${stateCode}` : null,
    address.isActive ? null : "Inactive",
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ")
}

function formatCompactAddressLabel(address: PartyDetail["addresses"][number]) {
  const label = address.label?.trim()
  const line = address.addressLine1?.trim()
  const city = address.city?.trim() || address.district?.trim()
  const stateCode = address.stateCode?.trim()

  return [label, line, city, stateCode ? `State ${stateCode}` : null]
    .filter((part): part is string => Boolean(part))
    .join(" · ")
}

function AgingBucketsView({ entries }: { entries: PartyLedgerEntry[] }) {
  const receivableBuckets = calculateAgingBuckets(entries, "receivable")
  const payableBuckets = calculateAgingBuckets(entries, "payable")

  return (
    <div className="space-y-3">
      <AgingBucketRow label="Receivable" buckets={receivableBuckets} />
      <AgingBucketRow label="Payable" buckets={payableBuckets} />
    </div>
  )
}

function AgingBucketRow({
  buckets,
  label,
}: {
  buckets: ReturnType<typeof calculateAgingBuckets>
  label: string
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {formatCurrencyValue(
            buckets.reduce((total, bucket) => total + bucket.amount, 0)
          )}
        </p>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="min-w-0 rounded-lg bg-muted/40 px-2 py-1.5">
            <p className="truncate text-[10px] text-muted-foreground">{bucket.label}</p>
            <p className="truncate text-[11px] font-medium">
              {formatCurrencyValue(bucket.amount)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function LedgerPreviewRow({ entry }: { entry: PartyLedgerEntry }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border/60 py-2 first:border-t-0">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">
          {entry.voucherNumber || entry.voucherType || "Ledger entry"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDate(entry.voucherDate ?? entry.createdAt)} · {capitalizeText(entry.entryType)} ·{" "}
          {capitalizeText(entry.status)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-xs font-medium">
          {formatCurrencyValue(entry.outstandingAmount)}
        </p>
        <p className="text-[10px] text-muted-foreground">outstanding</p>
      </div>
    </div>
  )
}

function MetricCard({
  helper,
  label,
  value,
}: {
  helper: string
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-base font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}

function InfoGridRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-t border-border/60 py-2 first:border-t-0 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="min-w-0 truncate text-xs font-medium">{value}</p>
    </div>
  )
}

function InfoTile({
  label,
  mono,
  value,
}: {
  label: string
  mono?: boolean
  value: string
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

function getDocumentTypeLabel(value: PartyDocument["documentType"]) {
  return documentTypeOptions.find((option) => option.value === value)?.label ?? "Document"
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B"
  }

  const units = ["B", "KB", "MB", "GB"]
  let amount = value
  let unitIndex = 0

  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024
    unitIndex += 1
  }

  return `${amount.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatAuditAction(action: string) {
  const label = action
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

  return label || "Party event"
}

function getAuditActorLabel(entry: PartyAuditEntry) {
  return entry.actor?.name || entry.actor?.email || "System"
}

function getAuditPayloadSummary(entry: PartyAuditEntry) {
  const after = getPlainObject(entry.after)
  const before = getPlainObject(entry.before)

  if (after) {
    const fields = Object.keys(after)
      .filter((field) => !["businessId", "partyId", "updatedAt"].includes(field))
      .slice(0, 4)

    if (fields.length > 0) {
      return `Recorded fields: ${fields
        .map((field) => capitalizeText(field) ?? field)
        .join(", ")}.`
    }
  }

  if (before) {
    return "Previous state was captured before this change."
  }

  return "Change recorded for this party."
}

function getPlainObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function selectPrimaryRecord<T extends { isPrimary: boolean }>(records: T[]) {
  return records.find((record) => record.isPrimary) ?? records[0] ?? null
}

function formatAddress(address: PartyDetail["addresses"][number]) {
  return (
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
  )
}

function calculateAgingBuckets(
  entries: PartyLedgerEntry[],
  entryType: PartyLedgerEntry["entryType"]
) {
  const today = startOfDay(new Date())
  const buckets = [
    { label: "Current", min: Number.NEGATIVE_INFINITY, max: 0, amount: 0 },
    { label: "1-30", min: 1, max: 30, amount: 0 },
    { label: "31-60", min: 31, max: 60, amount: 0 },
    { label: "61-90", min: 61, max: 90, amount: 0 },
    { label: "90+", min: 91, max: Number.POSITIVE_INFINITY, amount: 0 },
  ]

  for (const entry of entries) {
    if (entry.entryType !== entryType || ["closed", "settled", "cancelled"].includes(entry.status)) {
      continue
    }

    const outstanding = Number(entry.outstandingAmount)
    if (!Number.isFinite(outstanding) || outstanding <= 0) {
      continue
    }

    const dueDate = entry.dueDate ? startOfDay(new Date(entry.dueDate)) : today
    const ageDays = Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000)
    const bucket = buckets.find((row) => ageDays >= row.min && ageDays <= row.max)
    if (bucket) {
      bucket.amount += outstanding
    }
  }

  return buckets
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "No date"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "No date"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
