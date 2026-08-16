import type {
  PartyGstRegistration,
  PartyRole,
  PartyStatus,
  PartyType,
} from "@/lib/parties/api"

export type FilterState = {
  search: string
  role: PartyRole | "all"
  status: PartyStatus | "all"
}

export type SheetMode = "create" | "edit"

export type PartyFormState = {
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

export type PartyFormErrors = Partial<Record<keyof PartyFormState | "roles", string>>

export type GstRegistrationFormState = {
  gstin: string
  legalName: string
  tradeName: string
  registrationType: PartyGstRegistration["registrationType"]
  taxpayerType: string
  stateCode: string
  state: string
  status: PartyGstRegistration["status"]
  isPrimary: boolean
}

export type GstRegistrationFormErrors = Partial<
  Record<keyof GstRegistrationFormState, string>
>

export const emptyForm: PartyFormState = {
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

export const emptyGstRegistrationForm: GstRegistrationFormState = {
  gstin: "",
  legalName: "",
  tradeName: "",
  registrationType: "gst",
  taxpayerType: "",
  stateCode: "",
  state: "",
  status: "active",
  isPrimary: false,
}

export const partyTypeLabels: Record<PartyType, string> = {
  business: "Business",
  individual: "Individual",
  government: "Government",
  other: "Other",
}

export const statusLabels: Record<PartyStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  blocked: "Blocked",
  archived: "Archived",
}

export const partyTypes: PartyType[] = ["business", "individual", "government", "other"]
export const partyStatuses: PartyStatus[] = ["active", "inactive", "blocked", "archived"]

export const partyTypeOptions: ReadonlyArray<{ value: PartyType; label: string }> =
  partyTypes.map((type) => ({
    value: type,
    label: partyTypeLabels[type],
  }))

export const statusOptions: ReadonlyArray<{ value: PartyStatus; label: string }> =
  partyStatuses.map((status) => ({
    value: status,
    label: statusLabels[status],
  }))

export const roleFilterOptions: ReadonlyArray<{
  value: PartyRole | "all"
  label: string
}> = [
  { value: "all", label: "All roles" },
  { value: "customer", label: "Customers" },
  { value: "supplier", label: "Suppliers" },
]

export const statusFilterOptions: ReadonlyArray<{
  value: PartyStatus | "all"
  label: string
}> = [{ value: "all", label: "All statuses" }, ...statusOptions]

export const gstRegistrationTypeOptions: ReadonlyArray<{
  value: PartyGstRegistration["registrationType"]
  label: string
}> = [
  { value: "gst", label: "GST" },
  { value: "composition", label: "Composition" },
  { value: "uin", label: "UIN" },
]

export const gstRegistrationStatusOptions: ReadonlyArray<{
  value: PartyGstRegistration["status"]
  label: string
}> = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "cancelled", label: "Cancelled" },
  { value: "suspended", label: "Suspended" },
  { value: "archived", label: "Archived" },
]
