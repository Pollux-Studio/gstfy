import type {
  PartyAddress,
  PartyBankAccount,
  PartyContact,
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

export type PartyGstRegistrationFormState = {
  key: string
  id?: string
  gstin: string
  legalName: string
  tradeName: string
  registrationType: PartyGstRegistration["registrationType"]
  taxpayerType: string
  stateCode: string
  state: string
  effectiveFrom: string
  effectiveTo: string
  registeredAddressKey: string
  status: PartyGstRegistration["status"]
  isPrimary: boolean
}

export type PartyAddressFormState = {
  key: string
  id?: string
  addressType: PartyAddress["addressType"]
  label: string
  addressLine1: string
  addressLine2: string
  locality: string
  city: string
  district: string
  state: string
  stateCode: string
  pincode: string
  country: string
  isPrimary: boolean
  isActive: boolean
}

export type PartyContactFormState = {
  key: string
  id?: string
  name: string
  designation: string
  email: string
  phone: string
  mobile: string
  contactRole: NonNullable<PartyContact["contactRole"]>
  isPrimary: boolean
  status: PartyContact["status"]
}

export type PartyBankAccountFormState = {
  key: string
  id?: string
  bankName: string
  accountName: string
  accountNumber: string
  ifsc: string
  branch: string
  accountType: NonNullable<PartyBankAccount["accountType"]>
  isPrimary: boolean
  status: PartyBankAccount["status"]
}

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
  gstRegistrations: PartyGstRegistrationFormState[]
  addresses: PartyAddressFormState[]
  contacts: PartyContactFormState[]
  bankAccounts: PartyBankAccountFormState[]
}

type PartyScalarErrorKey =
  | Exclude<
    keyof PartyFormState,
    "gstRegistrations" | "addresses" | "contacts" | "bankAccounts"
  >
  | "roles"

export type PartyFormErrors = Partial<Record<PartyScalarErrorKey, string>> & {
  gstRegistrations?: Record<
    string,
    Partial<Record<keyof PartyGstRegistrationFormState, string>>
  >
  addresses?: Record<string, Partial<Record<keyof PartyAddressFormState, string>>>
  contacts?: Record<string, Partial<Record<keyof PartyContactFormState, string>>>
  bankAccounts?: Record<string, Partial<Record<keyof PartyBankAccountFormState, string>>>
}

export type GstRegistrationFormState = {
  gstin: string
  legalName: string
  tradeName: string
  registrationType: PartyGstRegistration["registrationType"]
  taxpayerType: string
  stateCode: string
  state: string
  effectiveFrom: string
  effectiveTo: string
  registeredAddressId: string
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
  gstRegistrations: [],
  addresses: [],
  contacts: [],
  bankAccounts: [],
}

export const emptyGstRegistrationForm: GstRegistrationFormState = {
  gstin: "",
  legalName: "",
  tradeName: "",
  registrationType: "gst",
  taxpayerType: "",
  stateCode: "",
  state: "",
  effectiveFrom: "",
  effectiveTo: "",
  registeredAddressId: "",
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

export const addressTypeOptions: ReadonlyArray<{
  value: PartyAddress["addressType"]
  label: string
}> = [
    { value: "registered", label: "Registered" },
    { value: "billing", label: "Billing" },
    { value: "shipping", label: "Shipping" },
    { value: "office", label: "Office" },
    { value: "warehouse", label: "Warehouse" },
    { value: "other", label: "Other" },
  ]

export const contactRoleOptions: ReadonlyArray<{
  value: NonNullable<PartyContact["contactRole"]>
  label: string
}> = [
    { value: "billing_contact", label: "Billing contact" },
    { value: "sales_contact", label: "Sales contact" },
    { value: "purchase_contact", label: "Purchase contact" },
  ]

export const contactStatusOptions: ReadonlyArray<{
  value: PartyContact["status"]
  label: string
}> = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ]

export const bankAccountTypeOptions: ReadonlyArray<{
  value: NonNullable<PartyBankAccount["accountType"]>
  label: string
}> = [
    { value: "current", label: "Current" },
    { value: "savings", label: "Savings" },
    { value: "od", label: "Overdraft" },
    { value: "cash_credit", label: "Cash credit" },
    { value: "other", label: "Other" },
  ]

export const bankAccountStatusOptions: ReadonlyArray<{
  value: PartyBankAccount["status"]
  label: string
}> = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "archived", label: "Archived" },
  ]
