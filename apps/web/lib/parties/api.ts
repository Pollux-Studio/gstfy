import { apiRequest } from "@/lib/api/client"

export type PartyRole = "customer" | "supplier"
export type PartyType = "business" | "individual" | "government" | "other"
export type PartyStatus = "active" | "inactive" | "blocked" | "archived"
export type PartySortBy =
  | "name"
  | "role"
  | "gstin"
  | "pan"
  | "contact"
  | "status"
  | "createdAt"
  | "updatedAt"
export type PartySortDir = "asc" | "desc"

export type PartyGstRegistration = {
  id: string
  businessId: string
  partyId: string
  gstin: string
  legalName: string | null
  tradeName: string | null
  registrationType: "gst" | "composition" | "uin"
  taxpayerType: string | null
  stateCode: string
  state: string | null
  effectiveFrom: string | null
  effectiveTo: string | null
  status: "active" | "inactive" | "cancelled" | "suspended" | "archived"
  isPrimary: boolean
}

export type PartyAddress = {
  id: string
  businessId: string
  partyId: string
  addressType: "registered" | "billing" | "shipping" | "office" | "warehouse" | "other"
  label: string | null
  addressLine1: string | null
  addressLine2: string | null
  locality: string | null
  city: string | null
  district: string | null
  state: string | null
  stateCode: string | null
  pincode: string | null
  country: string
  isPrimary: boolean
  isActive: boolean
}

export type PartyContact = {
  id: string
  businessId: string
  partyId: string
  name: string
  designation: string | null
  email: string | null
  phone: string | null
  mobile: string | null
  contactRole: "billing_contact" | "sales_contact" | "purchase_contact" | null
  isPrimary: boolean
  status: "active" | "inactive"
}

export type PartyBankAccount = {
  id: string
  businessId: string
  partyId: string
  bankName: string
  accountName: string | null
  accountNumberLast4: string | null
  accountNumberMasked: string | null
  ifsc: string | null
  branch: string | null
  accountType: "current" | "savings" | "od" | "cash_credit" | "other" | null
  isPrimary: boolean
  status: "active" | "inactive" | "archived"
}

export type PartyCustomerProfile = {
  partyId: string
  businessId: string
  customerCode: string
  creditLimit: string
  creditDays: number
  defaultPaymentTermId: string | null
  defaultBillingAddressId: string | null
  defaultShippingAddressId: string | null
  defaultGstRegistrationId: string | null
  priceGroupId: string | null
  salesRepId: string | null
  status: PartyStatus
}

export type PartySupplierProfile = {
  partyId: string
  businessId: string
  supplierCode: string
  creditDays: number
  defaultPaymentTermId: string | null
  defaultPurchaseAddressId: string | null
  defaultGstRegistrationId: string | null
  preferredWarehouseId: string | null
  leadTimeDays: number
  status: PartyStatus
}

export type PartyOutstandingSummary = {
  receivable: string
  payable: string
  overdueReceivable: string
  overduePayable: string
  openReceivableCount: number
  openPayableCount: number
}

export type PartyListItem = {
  id: string
  partyType: PartyType
  displayName: string
  legalName: string | null
  tradeName: string | null
  shortName: string | null
  pan: string | null
  profileImageSeed: string | null
  status: PartyStatus
  roles: PartyRole[]
  customerCode: string | null
  supplierCode: string | null
  primaryGstRegistration: PartyGstRegistration | null
  primaryContact: PartyContact | null
  createdAt: string
  updatedAt: string
}

export type PartyDetail = PartyListItem & {
  businessId: string
  notes: string | null
  customerProfile: PartyCustomerProfile | null
  supplierProfile: PartySupplierProfile | null
  gstRegistrations: PartyGstRegistration[]
  addresses: PartyAddress[]
  contacts: PartyContact[]
  bankAccounts: PartyBankAccount[]
  outstandingSummary: PartyOutstandingSummary
}

export type PartyGstRegistrationPayload = {
  gstin: string
  legalName?: string | null
  tradeName?: string | null
  registrationType?: "gst" | "composition" | "uin"
  taxpayerType?: string | null
  stateCode: string
  state?: string | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  status?: PartyGstRegistration["status"]
  isPrimary?: boolean
}

export type PartyAddressPayload = Omit<
  Partial<PartyAddress>,
  "id" | "businessId" | "partyId"
>

export type PartyContactPayload = Omit<
  Partial<PartyContact>,
  "id" | "businessId" | "partyId"
> & {
  name?: string
}

export type PartyBankAccountPayload = Omit<
  Partial<PartyBankAccount>,
  "id" | "businessId" | "partyId" | "accountNumberLast4" | "accountNumberMasked"
> & {
  accountNumber?: string
}

export type PartyCustomerProfilePayload = Partial<
  Omit<PartyCustomerProfile, "partyId" | "businessId">
>

export type PartySupplierProfilePayload = Partial<
  Omit<PartySupplierProfile, "partyId" | "businessId">
>

export type CreatePartyPayload = {
  partyType?: PartyType
  roles: PartyRole[]
  displayName: string
  legalName?: string | null
  tradeName?: string | null
  shortName?: string | null
  pan?: string | null
  status?: PartyStatus
  notes?: string | null
  customerProfile?: PartyCustomerProfilePayload
  supplierProfile?: PartySupplierProfilePayload
  gstRegistration?: PartyGstRegistrationPayload
  address?: PartyAddressPayload
  contact?: PartyContactPayload & { name: string }
  bankAccount?: PartyBankAccountPayload & { bankName: string }
}

export type UpdatePartyPayload = Partial<
  Pick<
    CreatePartyPayload,
    | "partyType"
    | "roles"
    | "displayName"
    | "legalName"
    | "tradeName"
    | "shortName"
    | "pan"
    | "status"
    | "notes"
  >
>

export function listParties(
  accessToken: string,
  filters: {
    search?: string
    role?: PartyRole
    status?: PartyStatus
    sortBy?: PartySortBy
    sortDir?: PartySortDir
    limit?: number
  } = {}
) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value))
    }
  }

  const query = params.size > 0 ? `?${params.toString()}` : ""
  return apiRequest<{ parties: PartyListItem[] }>(`/parties${query}`, {
    method: "GET",
    accessToken,
  })
}

export function getParty(partyId: string, accessToken: string) {
  return apiRequest<{ party: PartyDetail }>(`/parties/${partyId}`, {
    method: "GET",
    accessToken,
  })
}

export function createParty(payload: CreatePartyPayload, accessToken: string) {
  return apiRequest<{ party: PartyDetail }>("/parties", {
    method: "POST",
    body: payload,
    accessToken,
  })
}

export function updateParty(
  partyId: string,
  payload: UpdatePartyPayload,
  accessToken: string
) {
  return apiRequest<{ party: PartyDetail }>(`/parties/${partyId}`, {
    method: "PATCH",
    body: payload,
    accessToken,
  })
}

export function archiveParty(partyId: string, accessToken: string) {
  return apiRequest<{ ok: true }>(`/parties/${partyId}`, {
    method: "DELETE",
    accessToken,
  })
}

export function saveCustomerProfile(
  partyId: string,
  payload: PartyCustomerProfilePayload,
  accessToken: string,
  method: "POST" | "PATCH" = "PATCH"
) {
  return apiRequest<{ party: PartyDetail }>(`/parties/${partyId}/customer`, {
    method,
    body: payload,
    accessToken,
  })
}

export function saveSupplierProfile(
  partyId: string,
  payload: PartySupplierProfilePayload,
  accessToken: string,
  method: "POST" | "PATCH" = "PATCH"
) {
  return apiRequest<{ party: PartyDetail }>(`/parties/${partyId}/supplier`, {
    method,
    body: payload,
    accessToken,
  })
}

export function addPartyGstRegistration(
  partyId: string,
  payload: PartyGstRegistrationPayload,
  accessToken: string
) {
  return apiRequest<{ gstRegistration: PartyGstRegistration; party: PartyDetail }>(
    `/parties/${partyId}/gst-registrations`,
    {
      method: "POST",
      body: payload,
      accessToken,
    }
  )
}

export function updatePartyGstRegistration(
  partyId: string,
  registrationId: string,
  payload: Partial<PartyGstRegistrationPayload>,
  accessToken: string
) {
  return apiRequest<{ gstRegistration: PartyGstRegistration; party: PartyDetail }>(
    `/parties/${partyId}/gst-registrations/${registrationId}`,
    {
      method: "PATCH",
      body: payload,
      accessToken,
    }
  )
}

export function archivePartyGstRegistration(
  partyId: string,
  registrationId: string,
  accessToken: string
) {
  return apiRequest<{ party: PartyDetail }>(
    `/parties/${partyId}/gst-registrations/${registrationId}`,
    {
      method: "DELETE",
      accessToken,
    }
  )
}

export function addPartyAddress(
  partyId: string,
  payload: PartyAddressPayload,
  accessToken: string
) {
  return apiRequest<{ address: PartyAddress; party: PartyDetail }>(
    `/parties/${partyId}/addresses`,
    {
      method: "POST",
      body: payload,
      accessToken,
    }
  )
}

export function updatePartyAddress(
  partyId: string,
  addressId: string,
  payload: PartyAddressPayload,
  accessToken: string
) {
  return apiRequest<{ address: PartyAddress; party: PartyDetail }>(
    `/parties/${partyId}/addresses/${addressId}`,
    {
      method: "PATCH",
      body: payload,
      accessToken,
    }
  )
}

export function archivePartyAddress(partyId: string, addressId: string, accessToken: string) {
  return apiRequest<{ party: PartyDetail }>(`/parties/${partyId}/addresses/${addressId}`, {
    method: "DELETE",
    accessToken,
  })
}

export function addPartyContact(
  partyId: string,
  payload: PartyContactPayload & { name: string },
  accessToken: string
) {
  return apiRequest<{ contact: PartyContact; party: PartyDetail }>(
    `/parties/${partyId}/contacts`,
    {
      method: "POST",
      body: payload,
      accessToken,
    }
  )
}

export function updatePartyContact(
  partyId: string,
  contactId: string,
  payload: PartyContactPayload,
  accessToken: string
) {
  return apiRequest<{ contact: PartyContact; party: PartyDetail }>(
    `/parties/${partyId}/contacts/${contactId}`,
    {
      method: "PATCH",
      body: payload,
      accessToken,
    }
  )
}

export function archivePartyContact(partyId: string, contactId: string, accessToken: string) {
  return apiRequest<{ party: PartyDetail }>(`/parties/${partyId}/contacts/${contactId}`, {
    method: "DELETE",
    accessToken,
  })
}

export function addPartyBankAccount(
  partyId: string,
  payload: PartyBankAccountPayload & { bankName: string },
  accessToken: string
) {
  return apiRequest<{ bankAccount: PartyBankAccount; party: PartyDetail }>(
    `/parties/${partyId}/bank-accounts`,
    {
      method: "POST",
      body: payload,
      accessToken,
    }
  )
}

export function updatePartyBankAccount(
  partyId: string,
  bankAccountId: string,
  payload: PartyBankAccountPayload,
  accessToken: string
) {
  return apiRequest<{ bankAccount: PartyBankAccount; party: PartyDetail }>(
    `/parties/${partyId}/bank-accounts/${bankAccountId}`,
    {
      method: "PATCH",
      body: payload,
      accessToken,
    }
  )
}

export function archivePartyBankAccount(
  partyId: string,
  bankAccountId: string,
  accessToken: string
) {
  return apiRequest<{ party: PartyDetail }>(
    `/parties/${partyId}/bank-accounts/${bankAccountId}`,
    {
      method: "DELETE",
      accessToken,
    }
  )
}
