"use client"

import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import {
  ArchiveIcon,
  CheckIcon,
  ContactRoundIcon,
  MapPinIcon,
  PlusIcon,
  ReceiptTextIcon,
  StoreIcon,
  UsersIcon,
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
import { toast } from "@/components/ui/toast"
import { getProfileAvatarUrl } from "@/lib/avatar"
import {
  addPartyGstRegistration,
  archivePartyGstRegistration,
  updatePartyGstRegistration,
  type PartyDetail,
  type PartyGstRegistration,
} from "@/lib/parties/api"
import { cn } from "@/lib/utils"
import {
  emptyGstRegistrationForm,
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
  const activeGstRegistrations =
    party?.gstRegistrations.filter((registration) => registration.status !== "archived") ?? []

  React.useEffect(() => {
    if (!open) {
      resetGstForm()
    }
  }, [open])

  const gstMutation = useMutation({
    mutationFn: async () => {
      if (!party) {
        throw new Error("Party not loaded.")
      }

      const errors = validateGstRegistrationForm(gstForm)
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
                <InfoTile
                  label="Receivable"
                  value={formatCurrencyValue(party.outstandingSummary.receivable)}
                />
                <InfoTile
                  label="Payable"
                  value={formatCurrencyValue(party.outstandingSummary.payable)}
                />
                <InfoTile
                  label="Overdue"
                  value={formatCurrencyValue(
                    Math.max(
                      Number(party.outstandingSummary.overdueReceivable),
                      Number(party.outstandingSummary.overduePayable)
                    )
                  )}
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
                        party.customerProfile.defaultPaymentTermId ? "Payment term set" : null,
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
                        party.supplierProfile.defaultPaymentTermId ? "Payment term set" : null,
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
                count={activeGstRegistrations.length}
                icon={<ReceiptTextIcon className="size-3.5" />}
                title="GST registrations"
                action={
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={startCreateGstRegistration}
                  >
                    <PlusIcon className="size-3.5" />
                    Add GSTIN
                  </Button>
                }
              >
                <div className="grid gap-2">
                  {gstFormMode ? (
                    <GstRegistrationInlineForm
                      errors={gstErrors}
                      form={gstForm}
                      isPending={gstMutation.isPending}
                      mode={gstFormMode}
                      onCancel={resetGstForm}
                      onChange={updateGstFormValue}
                      onSubmit={() => gstMutation.mutate()}
                    />
                  ) : null}

                  {activeGstRegistrations.map((registration) => (
                    <GstRegistrationDetailRow
                      key={registration.id}
                      isMutating={
                        gstArchiveMutation.isPending || gstPrimaryMutation.isPending
                      }
                      registration={registration}
                      onArchive={() => gstArchiveMutation.mutate(registration.id)}
                      onEdit={() => startEditGstRegistration(registration)}
                      onSetPrimary={() => gstPrimaryMutation.mutate(registration)}
                    />
                  ))}
                  {activeGstRegistrations.length === 0 && !gstFormMode ? (
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
  errors,
  form,
  isPending,
  mode,
  onCancel,
  onChange,
  onSubmit,
}: {
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
  isMutating,
  onArchive,
  onEdit,
  onSetPrimary,
  registration,
}: {
  isMutating: boolean
  onArchive: () => void
  onEdit: () => void
  onSetPrimary: () => void
  registration: PartyGstRegistration
}) {
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
