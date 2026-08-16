"use client"

import * as React from "react"
import {
  AlertTriangleIcon,
  ArchiveIcon,
  CheckIcon,
  ContactRoundIcon,
  LandmarkIcon,
  MapPinIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  StoreIcon,
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
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import {
  partyTypeOptions,
  statusOptions,
  type PartyFormErrors,
  type PartyFormState,
  type SheetMode,
} from "./party-types"
import type { PartyStatus, PartyType } from "@/lib/parties/api"

type PartyFormDialogProps = {
  mode: SheetMode | null
  form: PartyFormState
  errors: PartyFormErrors
  duplicateWarnings: string[]
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
                "Update the party identity. GST, address and contact records can be expanded from the detail flow."
              : "Create one external party identity and attach customer/supplier roles as needed."}
            </DialogDescription>
          </DialogHeader>

          <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <PartyForm
              mode={mode ?? "create"}
              form={form}
              errors={errors}
              duplicateWarnings={duplicateWarnings}
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
  mode,
  form,
  errors,
  duplicateWarnings,
  onChange,
}: {
  mode: SheetMode
  form: PartyFormState
  errors: PartyFormErrors
  duplicateWarnings: string[]
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
        <DuplicateWarningList warnings={duplicateWarnings} />
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
        {mode === "create" ? (
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
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            GST registrations are managed from the party details panel so each
            GSTIN can be edited, archived, or marked primary independently.
          </div>
        )}

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

function DuplicateWarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return null
  }

  return (
    <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
      <div className="flex items-center gap-2 text-xs font-medium">
        <AlertTriangleIcon className="size-3.5" />
        Possible duplicate party
      </div>
      <ul className="space-y-1 pl-5 text-xs">
        {warnings.map((warning) => (
          <li key={warning} className="list-disc">
            {warning}
          </li>
        ))}
      </ul>
    </div>
  )
}
