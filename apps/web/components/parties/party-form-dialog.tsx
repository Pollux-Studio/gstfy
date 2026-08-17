"use client"

import * as React from "react"
import {
  AlertTriangleIcon,
  ArchiveIcon,
  CheckIcon,
  ContactRoundIcon,
  LandmarkIcon,
  MapPinIcon,
  PlusIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  StoreIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"

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
  Field,
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
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import {
  addressTypeOptions,
  bankAccountStatusOptions,
  bankAccountTypeOptions,
  contactRoleOptions,
  contactStatusOptions,
  gstRegistrationStatusOptions,
  gstRegistrationTypeOptions,
  partyTypeOptions,
  statusOptions,
  type PartyAddressFormState,
  type PartyBankAccountFormState,
  type PartyContactFormState,
  type PartyFormErrors,
  type PartyFormState,
  type PartyGstRegistrationFormState,
  type SheetMode,
} from "./party-types"
import type { PartyDuplicateSuggestion, PartyStatus, PartyType } from "@/lib/parties/api"
import {
  createEmptyAddress,
  createEmptyBankAccount,
  createEmptyContact,
  createEmptyGstRegistration,
} from "./party-utils"

type PartyFormDialogProps = {
  mode: SheetMode | null
  form: PartyFormState
  errors: PartyFormErrors
  duplicateWarnings: string[]
  duplicateSuggestions: PartyDuplicateSuggestion[]
  isCheckingDuplicates: boolean
  isPending: boolean
  onChange: <K extends keyof PartyFormState>(
    key: K,
    value: PartyFormState[K]
  ) => void
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

export function PartyFormDialog({
  mode,
  form,
  errors,
  duplicateWarnings,
  duplicateSuggestions,
  isCheckingDuplicates,
  isPending,
  onChange,
  onClose,
  onSubmit,
}: PartyFormDialogProps) {
  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
          <DialogHeader className="border-b border-border px-4 py-4">
            <DialogTitle>{mode === "edit" ? "Edit party" : "Add party"}</DialogTitle>
            <DialogDescription>
              {mode === "edit" ?
                "Update identity, roles, GST registrations, addresses, contacts and bank details in one place."
              : "Create one external party identity with customer/supplier roles, GST registrations, addresses, contacts and bank details."}
            </DialogDescription>
          </DialogHeader>

          <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <PartyForm
              form={form}
              errors={errors}
              duplicateWarnings={duplicateWarnings}
              duplicateSuggestions={duplicateSuggestions}
              isCheckingDuplicates={isCheckingDuplicates}
              onChange={onChange}
            />
          </div>

          <DialogFooter className="border-t border-border px-4 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : mode === "edit" ? "Save changes" : "Create party"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PartyForm({
  form,
  errors,
  duplicateWarnings,
  duplicateSuggestions,
  isCheckingDuplicates,
  onChange,
}: {
  form: PartyFormState
  errors: PartyFormErrors
  duplicateWarnings: string[]
  duplicateSuggestions: PartyDuplicateSuggestion[]
  isCheckingDuplicates: boolean
  onChange: <K extends keyof PartyFormState>(key: K, value: PartyFormState[K]) => void
}) {
  const isIndividual = form.partyType === "individual"

  function updateGstRegistration(
    key: string,
    patch: Partial<PartyGstRegistrationFormState>
  ) {
    onChange(
      "gstRegistrations",
      form.gstRegistrations.map((registration) =>
        registration.key === key ? { ...registration, ...patch } : registration
      )
    )
  }

  function addGstRegistration() {
    onChange(
      "gstRegistrations",
      [
        ...form.gstRegistrations,
        createEmptyGstRegistration({ isPrimary: form.gstRegistrations.length === 0 }),
      ]
    )
    onChange("hasGst", true)
  }

  function removeGstRegistration(key: string) {
    const nextRows = form.gstRegistrations.filter((registration) => registration.key !== key)
    onChange(
      "gstRegistrations",
      nextRows.some((registration) => registration.isPrimary) || nextRows.length === 0 ?
        nextRows
      : nextRows.map((registration, index) => ({
          ...registration,
          isPrimary: index === 0,
        }))
    )
    onChange("hasGst", nextRows.length > 0)
  }

  function markPrimaryGstRegistration(key: string) {
    onChange(
      "gstRegistrations",
      form.gstRegistrations.map((registration) => ({
        ...registration,
        isPrimary: registration.key === key,
      }))
    )
  }

  function updateAddress(key: string, patch: Partial<PartyAddressFormState>) {
    onChange(
      "addresses",
      form.addresses.map((address) =>
        address.key === key ? { ...address, ...patch } : address
      )
    )
  }

  function addAddress() {
    onChange(
      "addresses",
      [
        ...form.addresses,
        createEmptyAddress({ isPrimary: form.addresses.length === 0 }),
      ]
    )
  }

  function removeAddress(key: string) {
    const nextRows = form.addresses.filter((address) => address.key !== key)
    onChange(
      "addresses",
      nextRows.some((address) => address.isPrimary) || nextRows.length === 0 ?
        nextRows
      : nextRows.map((address, index) => ({ ...address, isPrimary: index === 0 }))
    )
  }

  function markPrimaryAddress(key: string) {
    onChange(
      "addresses",
      form.addresses.map((address) => ({
        ...address,
        isPrimary: address.key === key,
      }))
    )
  }

  function updateContact(key: string, patch: Partial<PartyContactFormState>) {
    onChange(
      "contacts",
      form.contacts.map((contact) =>
        contact.key === key ? { ...contact, ...patch } : contact
      )
    )
  }

  function addContact() {
    onChange(
      "contacts",
      [
        ...form.contacts,
        createEmptyContact({ isPrimary: form.contacts.length === 0 }),
      ]
    )
  }

  function removeContact(key: string) {
    const nextRows = form.contacts.filter((contact) => contact.key !== key)
    onChange(
      "contacts",
      nextRows.some((contact) => contact.isPrimary) || nextRows.length === 0 ?
        nextRows
      : nextRows.map((contact, index) => ({ ...contact, isPrimary: index === 0 }))
    )
  }

  function markPrimaryContact(key: string) {
    onChange(
      "contacts",
      form.contacts.map((contact) => ({
        ...contact,
        isPrimary: contact.key === key,
      }))
    )
  }

  function updateBankAccount(key: string, patch: Partial<PartyBankAccountFormState>) {
    onChange(
      "bankAccounts",
      form.bankAccounts.map((bankAccount) =>
        bankAccount.key === key ? { ...bankAccount, ...patch } : bankAccount
      )
    )
  }

  function addBankAccount() {
    onChange(
      "bankAccounts",
      [
        ...form.bankAccounts,
        createEmptyBankAccount({ isPrimary: form.bankAccounts.length === 0 }),
      ]
    )
  }

  function removeBankAccount(key: string) {
    const nextRows = form.bankAccounts.filter((bankAccount) => bankAccount.key !== key)
    onChange(
      "bankAccounts",
      nextRows.some((bankAccount) => bankAccount.isPrimary) || nextRows.length === 0 ?
        nextRows
      : nextRows.map((bankAccount, index) => ({
          ...bankAccount,
          isPrimary: index === 0,
        }))
    )
  }

  function markPrimaryBankAccount(key: string) {
    onChange(
      "bankAccounts",
      form.bankAccounts.map((bankAccount) => ({
        ...bankAccount,
        isPrimary: bankAccount.key === key,
      }))
    )
  }

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
        <DuplicateWarningList
          isChecking={isCheckingDuplicates}
          suggestions={duplicateSuggestions}
          warnings={duplicateWarnings}
        />
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
        <RepeatableSection
          icon={<MapPinIcon />}
          title="Addresses"
          description="Collect registered, billing, shipping, office or warehouse addresses."
          actionLabel="Add address"
          onAdd={addAddress}
        >
          {form.addresses.length === 0 ? (
            <EmptyCollectionHint text="Add addresses first when the party has multiple GSTINs, then map each GSTIN to the correct registered address." />
          ) : (
            <div className="space-y-3">
              {form.addresses.map((address, index) => (
                <AddressCard
                  key={address.key}
                  index={index}
                  address={address}
                  errors={errors.addresses?.[address.key]}
                  onChange={(patch) => updateAddress(address.key, patch)}
                  onMakePrimary={() => markPrimaryAddress(address.key)}
                  onRemove={() => removeAddress(address.key)}
                />
              ))}
            </div>
          )}
        </RepeatableSection>

        <RepeatableSection
          icon={<ReceiptTextIcon />}
          title="GST registrations"
          description="Add every GSTIN/UIN and map each one to its registered address."
          actionLabel="Add GSTIN"
          onAdd={addGstRegistration}
        >
          {form.gstRegistrations.length === 0 ? (
            <EmptyCollectionHint text="No GST registration added. Keep this empty for unregistered customers." />
          ) : (
            <div className="space-y-3">
              {form.gstRegistrations.map((registration, index) => (
                <GstRegistrationCard
                  key={registration.key}
                  index={index}
                  addresses={form.addresses}
                  registration={registration}
                  errors={errors.gstRegistrations?.[registration.key]}
                  onChange={(patch) => updateGstRegistration(registration.key, patch)}
                  onMakePrimary={() => markPrimaryGstRegistration(registration.key)}
                  onRemove={() => removeGstRegistration(registration.key)}
                />
              ))}
            </div>
          )}
        </RepeatableSection>

        <RepeatableSection
          icon={<ContactRoundIcon />}
          title="Contacts"
          description="Add billing, sales and purchase contacts with phone and email details."
          actionLabel="Add contact"
          onAdd={addContact}
        >
          {form.contacts.length === 0 ? (
            <EmptyCollectionHint text="No contact added. Add one for regular customers and suppliers." />
          ) : (
            <div className="space-y-3">
              {form.contacts.map((contact, index) => (
                <ContactCard
                  key={contact.key}
                  index={index}
                  contact={contact}
                  errors={errors.contacts?.[contact.key]}
                  onChange={(patch) => updateContact(contact.key, patch)}
                  onMakePrimary={() => markPrimaryContact(contact.key)}
                  onRemove={() => removeContact(contact.key)}
                />
              ))}
            </div>
          )}
        </RepeatableSection>

        <RepeatableSection
          icon={<LandmarkIcon />}
          title="Bank accounts"
          description="Optional bank details for supplier payouts and future payment matching."
          actionLabel="Add bank"
          onAdd={addBankAccount}
        >
          {form.bankAccounts.length === 0 ? (
            <EmptyCollectionHint text="No bank account added. This can be skipped for normal retail customers." />
          ) : (
            <div className="space-y-3">
              {form.bankAccounts.map((bankAccount, index) => (
                <BankAccountCard
                  key={bankAccount.key}
                  index={index}
                  bankAccount={bankAccount}
                  errors={errors.bankAccounts?.[bankAccount.key]}
                  onChange={(patch) => updateBankAccount(bankAccount.key, patch)}
                  onMakePrimary={() => markPrimaryBankAccount(bankAccount.key)}
                  onRemove={() => removeBankAccount(bankAccount.key)}
                />
              ))}
            </div>
          )}
        </RepeatableSection>

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

function RepeatableSection({
  actionLabel,
  children,
  description,
  icon,
  onAdd,
  title,
}: {
  actionLabel: string
  children: React.ReactNode
  description: string
  icon: React.ReactNode
  onAdd: () => void
  title: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading icon={icon} title={title} description={description} />
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <PlusIcon className="size-4" />
          {actionLabel}
        </Button>
      </div>
      {children}
    </div>
  )
}

function EmptyCollectionHint({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
      {text}
    </div>
  )
}

function CollectionCard({
  children,
  index,
  isPrimary,
  onMakePrimary,
  onRemove,
  title,
}: {
  children: React.ReactNode
  index: number
  isPrimary: boolean
  onMakePrimary: () => void
  onRemove: () => void
  title: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-3">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {title} {index + 1}
          </p>
          <p className="text-xs text-muted-foreground">
            {isPrimary ? "Primary record" : "Secondary record"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant={isPrimary ? "secondary" : "outline"}
            onClick={onMakePrimary}
          >
            {isPrimary ? "Primary" : "Make primary"}
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={onRemove}>
            <Trash2Icon className="size-3.5" />
            Remove
          </Button>
        </div>
      </div>
      {children}
    </div>
  )
}

function GstRegistrationCard({
  addresses,
  errors,
  index,
  onChange,
  onMakePrimary,
  onRemove,
  registration,
}: {
  addresses: PartyAddressFormState[]
  errors?: Partial<Record<keyof PartyGstRegistrationFormState, string>>
  index: number
  onChange: (patch: Partial<PartyGstRegistrationFormState>) => void
  onMakePrimary: () => void
  onRemove: () => void
  registration: PartyGstRegistrationFormState
}) {
  const addressOptions = [
    { value: "none", label: "No registered address" },
    ...addresses.map((address, index) => ({
      value: address.key,
      label: formatAddressOptionLabel(address, index),
    })),
  ]
  const selectedAddress = addresses.find(
    (address) => address.key === registration.registeredAddressKey
  )

  return (
    <CollectionCard
      title="GST registration"
      index={index}
      isPrimary={registration.isPrimary}
      onMakePrimary={onMakePrimary}
      onRemove={onRemove}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel>GSTIN *</FieldLabel>
          <Input
            value={registration.gstin}
            maxLength={15}
            onChange={(event) => {
              const gstin = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
              onChange({
                gstin,
                stateCode: gstin.length >= 2 ? gstin.slice(0, 2) : registration.stateCode,
              })
            }}
            className="font-mono uppercase tracking-[0.14em]"
            placeholder="33ABCDE1234F1Z5"
          />
          <FieldError>{errors?.gstin}</FieldError>
        </Field>
        <Field>
          <FieldLabel>Registration type</FieldLabel>
          <Select
            value={registration.registrationType}
            onValueChange={(value) =>
              onChange({
                registrationType:
                  (value as PartyGstRegistrationFormState["registrationType"] | null) ??
                  "gst",
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectDisplayValue
                value={registration.registrationType}
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
          <FieldLabel>State code *</FieldLabel>
          <Input
            value={registration.stateCode}
            maxLength={2}
            inputMode="numeric"
            onChange={(event) =>
              onChange({ stateCode: event.target.value.replace(/\D/g, "") })
            }
            placeholder="33"
          />
          <FieldError>{errors?.stateCode}</FieldError>
        </Field>
        <Field>
          <FieldLabel>State</FieldLabel>
          <Input
            value={registration.state}
            onChange={(event) => onChange({ state: event.target.value })}
            placeholder="Tamil Nadu"
          />
        </Field>
        <Field>
          <FieldLabel>Legal name</FieldLabel>
          <Input
            value={registration.legalName}
            onChange={(event) => onChange({ legalName: event.target.value })}
            placeholder="As per GST certificate"
          />
        </Field>
        <Field>
          <FieldLabel>Trade name</FieldLabel>
          <Input
            value={registration.tradeName}
            onChange={(event) => onChange({ tradeName: event.target.value })}
            placeholder="Trade name"
          />
        </Field>
        <Field>
          <FieldLabel>Taxpayer type</FieldLabel>
          <Input
            value={registration.taxpayerType}
            onChange={(event) => onChange({ taxpayerType: event.target.value })}
            placeholder="Regular / Composition"
          />
        </Field>
        <Field>
          <FieldLabel>Status</FieldLabel>
          <Select
            value={registration.status}
            onValueChange={(value) =>
              onChange({
                status:
                  (value as PartyGstRegistrationFormState["status"] | null) ??
                  "active",
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectDisplayValue
                value={registration.status}
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
        <Field className="md:col-span-2">
          <FieldLabel>Registered address for this GSTIN</FieldLabel>
          <Select
            value={registration.registeredAddressKey || "none"}
            onValueChange={(value) => {
              const nextValue = value ?? "none"
              onChange({
                registeredAddressKey: nextValue === "none" ? "" : nextValue,
              })
            }}
          >
            <SelectTrigger className="w-full">
              <SelectDisplayValue
                value={registration.registeredAddressKey || "none"}
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
          registration.stateCode &&
          selectedAddress.stateCode !== registration.stateCode ? (
            <p className="text-xs text-destructive">
              Address state code {selectedAddress.stateCode} does not match GSTIN state
              code {registration.stateCode}.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Select the registered place of business for this GST number.
            </p>
          )}
          <FieldError>{errors?.registeredAddressKey}</FieldError>
        </Field>
        <Field>
          <FieldLabel>Effective from</FieldLabel>
          <Input
            type="date"
            value={registration.effectiveFrom}
            onChange={(event) => onChange({ effectiveFrom: event.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel>Effective to</FieldLabel>
          <Input
            type="date"
            value={registration.effectiveTo}
            onChange={(event) => onChange({ effectiveTo: event.target.value })}
          />
          <FieldError>{errors?.effectiveTo}</FieldError>
        </Field>
      </div>
    </CollectionCard>
  )
}

function AddressCard({
  address,
  errors,
  index,
  onChange,
  onMakePrimary,
  onRemove,
}: {
  address: PartyAddressFormState
  errors?: Partial<Record<keyof PartyAddressFormState, string>>
  index: number
  onChange: (patch: Partial<PartyAddressFormState>) => void
  onMakePrimary: () => void
  onRemove: () => void
}) {
  return (
    <CollectionCard
      title="Address"
      index={index}
      isPrimary={address.isPrimary}
      onMakePrimary={onMakePrimary}
      onRemove={onRemove}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel>Address type</FieldLabel>
          <Select
            value={address.addressType}
            onValueChange={(value) =>
              onChange({
                addressType:
                  (value as PartyAddressFormState["addressType"] | null) ?? "billing",
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectDisplayValue
                value={address.addressType}
                options={addressTypeOptions}
                placeholder="Choose type"
              />
            </SelectTrigger>
            <SelectContent align="start" sideOffset={8}>
              {addressTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Label</FieldLabel>
          <Input
            value={address.label}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="Head office / Chennai billing"
          />
        </Field>
        <Field className="md:col-span-2">
          <FieldLabel>Address line 1</FieldLabel>
          <Input
            value={address.addressLine1}
            onChange={(event) => onChange({ addressLine1: event.target.value })}
            placeholder="Door / building / street"
          />
        </Field>
        <Field className="md:col-span-2">
          <FieldLabel>Address line 2</FieldLabel>
          <Input
            value={address.addressLine2}
            onChange={(event) => onChange({ addressLine2: event.target.value })}
            placeholder="Area / landmark"
          />
        </Field>
        <Field>
          <FieldLabel>Locality</FieldLabel>
          <Input
            value={address.locality}
            onChange={(event) => onChange({ locality: event.target.value })}
            placeholder="T Nagar"
          />
        </Field>
        <Field>
          <FieldLabel>City</FieldLabel>
          <Input
            value={address.city}
            onChange={(event) => onChange({ city: event.target.value })}
            placeholder="Chennai"
          />
        </Field>
        <Field>
          <FieldLabel>District</FieldLabel>
          <Input
            value={address.district}
            onChange={(event) => onChange({ district: event.target.value })}
            placeholder="Chennai"
          />
        </Field>
        <Field>
          <FieldLabel>State</FieldLabel>
          <Input
            value={address.state}
            onChange={(event) => onChange({ state: event.target.value })}
            placeholder="Tamil Nadu"
          />
        </Field>
        <Field>
          <FieldLabel>State code</FieldLabel>
          <Input
            value={address.stateCode}
            maxLength={2}
            inputMode="numeric"
            onChange={(event) =>
              onChange({ stateCode: event.target.value.replace(/\D/g, "") })
            }
            placeholder="33"
          />
          <FieldError>{errors?.stateCode}</FieldError>
        </Field>
        <Field>
          <FieldLabel>Pincode</FieldLabel>
          <Input
            value={address.pincode}
            maxLength={6}
            inputMode="numeric"
            onChange={(event) =>
              onChange({ pincode: event.target.value.replace(/\D/g, "") })
            }
            placeholder="600001"
          />
          <FieldError>{errors?.pincode}</FieldError>
        </Field>
        <Field>
          <FieldLabel>Country</FieldLabel>
          <Input
            value={address.country}
            onChange={(event) => onChange({ country: event.target.value })}
            placeholder="India"
          />
        </Field>
        <CompactCheckOption
          checked={address.isActive}
          label="Active address"
          helper="Available for new transactions"
          onClick={() => onChange({ isActive: !address.isActive })}
        />
      </div>
    </CollectionCard>
  )
}

function formatAddressOptionLabel(address: PartyAddressFormState, index: number) {
  const label = address.label.trim()
  const line = address.addressLine1.trim()
  const city = address.city.trim() || address.district.trim()
  const stateCode = address.stateCode.trim()
  const parts = [
    label || `${addressTypeOptions.find((option) => option.value === address.addressType)?.label ?? "Address"} ${index + 1}`,
    line,
    city,
    stateCode ? `State ${stateCode}` : null,
  ].filter((part): part is string => Boolean(part))

  return parts.join(" · ")
}

function ContactCard({
  contact,
  errors,
  index,
  onChange,
  onMakePrimary,
  onRemove,
}: {
  contact: PartyContactFormState
  errors?: Partial<Record<keyof PartyContactFormState, string>>
  index: number
  onChange: (patch: Partial<PartyContactFormState>) => void
  onMakePrimary: () => void
  onRemove: () => void
}) {
  return (
    <CollectionCard
      title="Contact"
      index={index}
      isPrimary={contact.isPrimary}
      onMakePrimary={onMakePrimary}
      onRemove={onRemove}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Field>
          <FieldLabel>Name *</FieldLabel>
          <Input
            value={contact.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Contact person"
          />
          <FieldError>{errors?.name}</FieldError>
        </Field>
        <Field>
          <FieldLabel>Role</FieldLabel>
          <Select
            value={contact.contactRole}
            onValueChange={(value) =>
              onChange({
                contactRole:
                  (value as PartyContactFormState["contactRole"] | null) ??
                  "billing_contact",
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectDisplayValue
                value={contact.contactRole}
                options={contactRoleOptions}
                placeholder="Choose role"
              />
            </SelectTrigger>
            <SelectContent align="start" sideOffset={8}>
              {contactRoleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Status</FieldLabel>
          <Select
            value={contact.status}
            onValueChange={(value) =>
              onChange({
                status: (value as PartyContactFormState["status"] | null) ?? "active",
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectDisplayValue
                value={contact.status}
                options={contactStatusOptions}
                placeholder="Choose status"
              />
            </SelectTrigger>
            <SelectContent align="start" sideOffset={8}>
              {contactStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Designation</FieldLabel>
          <Input
            value={contact.designation}
            onChange={(event) => onChange({ designation: event.target.value })}
            placeholder="Owner / Accounts"
          />
        </Field>
        <Field>
          <FieldLabel>Mobile</FieldLabel>
          <IndianPhoneInput
            value={contact.mobile}
            onChange={(event) =>
              onChange({ mobile: event.target.value.replace(/\D/g, "") })
            }
          />
          <FieldError>{errors?.mobile}</FieldError>
        </Field>
        <Field>
          <FieldLabel>Phone</FieldLabel>
          <Input
            value={contact.phone}
            onChange={(event) => onChange({ phone: event.target.value })}
            placeholder="044-00000000"
          />
        </Field>
        <Field className="md:col-span-3">
          <FieldLabel>Email</FieldLabel>
          <Input
            value={contact.email}
            onChange={(event) => onChange({ email: event.target.value })}
            placeholder="billing@example.com"
          />
          <FieldError>{errors?.email}</FieldError>
        </Field>
      </div>
    </CollectionCard>
  )
}

function BankAccountCard({
  bankAccount,
  errors,
  index,
  onChange,
  onMakePrimary,
  onRemove,
}: {
  bankAccount: PartyBankAccountFormState
  errors?: Partial<Record<keyof PartyBankAccountFormState, string>>
  index: number
  onChange: (patch: Partial<PartyBankAccountFormState>) => void
  onMakePrimary: () => void
  onRemove: () => void
}) {
  return (
    <CollectionCard
      title="Bank account"
      index={index}
      isPrimary={bankAccount.isPrimary}
      onMakePrimary={onMakePrimary}
      onRemove={onRemove}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel>Bank name *</FieldLabel>
          <Input
            value={bankAccount.bankName}
            onChange={(event) => onChange({ bankName: event.target.value })}
            placeholder="HDFC Bank"
          />
          <FieldError>{errors?.bankName}</FieldError>
        </Field>
        <Field>
          <FieldLabel>Account holder</FieldLabel>
          <Input
            value={bankAccount.accountName}
            onChange={(event) => onChange({ accountName: event.target.value })}
            placeholder="ABC Traders"
          />
        </Field>
        <Field>
          <FieldLabel>Account number {bankAccount.id ? "" : "*"}</FieldLabel>
          <Input
            value={bankAccount.accountNumber}
            onChange={(event) =>
              onChange({ accountNumber: event.target.value.replace(/\s/g, "") })
            }
            placeholder={bankAccount.id ? "Leave blank to keep existing" : "Account number"}
          />
          <FieldError>{errors?.accountNumber}</FieldError>
        </Field>
        <Field>
          <FieldLabel>IFSC</FieldLabel>
          <Input
            value={bankAccount.ifsc}
            maxLength={11}
            onChange={(event) =>
              onChange({
                ifsc: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
              })
            }
            className="font-mono uppercase tracking-[0.12em]"
            placeholder="HDFC0001234"
          />
          <FieldError>{errors?.ifsc}</FieldError>
        </Field>
        <Field>
          <FieldLabel>Branch</FieldLabel>
          <Input
            value={bankAccount.branch}
            onChange={(event) => onChange({ branch: event.target.value })}
            placeholder="T Nagar"
          />
        </Field>
        <Field>
          <FieldLabel>Account type</FieldLabel>
          <Select
            value={bankAccount.accountType}
            onValueChange={(value) =>
              onChange({
                accountType:
                  (value as PartyBankAccountFormState["accountType"] | null) ??
                  "current",
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectDisplayValue
                value={bankAccount.accountType}
                options={bankAccountTypeOptions}
                placeholder="Choose type"
              />
            </SelectTrigger>
            <SelectContent align="start" sideOffset={8}>
              {bankAccountTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Status</FieldLabel>
          <Select
            value={bankAccount.status}
            onValueChange={(value) =>
              onChange({
                status:
                  (value as PartyBankAccountFormState["status"] | null) ??
                  "active",
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectDisplayValue
                value={bankAccount.status}
                options={bankAccountStatusOptions}
                placeholder="Choose status"
              />
            </SelectTrigger>
            <SelectContent align="start" sideOffset={8}>
              {bankAccountStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </CollectionCard>
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

function DuplicateWarningList({
  isChecking,
  suggestions,
  warnings,
}: {
  isChecking: boolean
  suggestions: PartyDuplicateSuggestion[]
  warnings: string[]
}) {
  if (warnings.length === 0 && suggestions.length === 0 && !isChecking) {
    return null
  }

  return (
    <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium">
          <AlertTriangleIcon className="size-3.5" />
          Possible duplicate party
        </div>
        {isChecking ? <Spinner className="size-3.5" /> : null}
      </div>
      {suggestions.length > 0 ? (
        <div className="space-y-1.5">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.party.id}
              className="rounded-lg border border-amber-200/70 bg-background/75 px-2.5 py-2 text-xs text-foreground dark:border-amber-900/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{suggestion.party.displayName}</p>
                  <p className="truncate text-muted-foreground">
                    {suggestion.party.pan ||
                      suggestion.party.primaryGstRegistration?.gstin ||
                      suggestion.party.primaryContact?.mobile ||
                      "Existing party"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950">
                  {suggestion.score}%
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {suggestion.reasons.map((reason) => (
                  <span
                    key={`${suggestion.party.id}-${reason.field}-${reason.label}`}
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[10px]",
                      reason.confidence === "high" ?
                        "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
                      : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    {reason.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="space-y-1 pl-5 text-xs">
          {warnings.map((warning) => (
            <li key={warning} className="list-disc">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
