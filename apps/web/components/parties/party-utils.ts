import {
  addPartyAddress,
  addPartyContact,
  addPartyGstRegistration,
  archivePartyAddress,
  archivePartyContact,
  archivePartyGstRegistration,
  saveCustomerProfile,
  saveSupplierProfile,
  updatePartyAddress,
  updatePartyContact,
  updatePartyGstRegistration,
  type CreatePartyPayload,
  type PartyDetail,
  type PartyGstRegistration,
  type PartyListItem,
  type PartyRole,
  type PartySortBy,
  type PartySortDir,
  type UpdatePartyPayload,
} from "@/lib/parties/api"

import {
  emptyForm,
  type GstRegistrationFormErrors,
  type GstRegistrationFormState,
  type PartyFormErrors,
  type PartyFormState,
} from "./party-types"

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function createFormFromParty(
  party: PartyListItem | PartyDetail
): PartyFormState {
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

export function sortParties(
  parties: PartyListItem[],
  sortBy: PartySortBy,
  sortDir: PartySortDir
) {
  const direction = sortDir === "asc" ? 1 : -1

  return [...parties].sort((firstParty, secondParty) => {
    const firstValue = getPartySortValue(firstParty, sortBy)
    const secondValue = getPartySortValue(secondParty, sortBy)

    return (
      firstValue.localeCompare(secondValue, undefined, {
        numeric: true,
        sensitivity: "base",
      }) * direction
    )
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

export function getPartyDuplicateWarnings(
  form: PartyFormState,
  parties: PartyListItem[],
  selectedPartyId: string | null
) {
  const warnings: string[] = []
  const displayName = normalizeComparable(form.displayName)
  const pan = normalizeComparable(form.pan)
  const gstin = normalizeComparable(form.gstin)
  const email = normalizeComparable(form.contactEmail)
  const mobile = form.contactMobile.replace(/\D/g, "")
  const candidates = parties.filter((party) => party.id !== selectedPartyId)

  const sameName = candidates.find(
    (party) =>
      Boolean(displayName) && normalizeComparable(party.displayName) === displayName
  )
  if (sameName) {
    warnings.push(`Name already exists as ${sameName.displayName}.`)
  }

  const samePan = candidates.find(
    (party) => Boolean(pan) && normalizeComparable(party.pan ?? "") === pan
  )
  if (samePan) {
    warnings.push(`PAN is already used by ${samePan.displayName}.`)
  }

  const sameGstin = candidates.find(
    (party) =>
      Boolean(gstin) &&
      normalizeComparable(party.primaryGstRegistration?.gstin ?? "") === gstin
  )
  if (sameGstin) {
    warnings.push(`GSTIN is already used by ${sameGstin.displayName}.`)
  }

  const sameEmail = candidates.find(
    (party) =>
      Boolean(email) && normalizeComparable(party.primaryContact?.email ?? "") === email
  )
  if (sameEmail) {
    warnings.push(`Email is already used by ${sameEmail.displayName}.`)
  }

  const sameMobile = candidates.find(
    (party) =>
      Boolean(mobile) && (party.primaryContact?.mobile ?? "").replace(/\D/g, "") === mobile
  )
  if (sameMobile) {
    warnings.push(`Mobile number is already used by ${sameMobile.displayName}.`)
  }

  return warnings
}

function normalizeComparable(value: string) {
  return value.trim().toUpperCase()
}

export function createGstFormFromRegistration(
  registration: PartyGstRegistration
): GstRegistrationFormState {
  return {
    gstin: registration.gstin,
    legalName: registration.legalName ?? "",
    tradeName: registration.tradeName ?? "",
    registrationType: registration.registrationType,
    taxpayerType: registration.taxpayerType ?? "",
    stateCode: registration.stateCode,
    state: registration.state ?? "",
    status: registration.status,
    isPrimary: registration.isPrimary,
  }
}

export function validateGstRegistrationForm(
  form: GstRegistrationFormState
): GstRegistrationFormErrors {
  const errors: GstRegistrationFormErrors = {}

  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(form.gstin)) {
    errors.gstin = "Enter a valid GSTIN."
  }

  if (!/^\d{2}$/.test(form.stateCode)) {
    errors.stateCode = "Enter the two-digit GST state code."
  }

  if (form.gstin.length >= 2 && form.gstin.slice(0, 2) !== form.stateCode) {
    errors.stateCode = "State code must match the first two digits of GSTIN."
  }

  return errors
}

export function buildGstRegistrationPayloadFromState(
  form: GstRegistrationFormState
) {
  return {
    gstin: form.gstin.trim().toUpperCase(),
    legalName: trimOrNull(form.legalName),
    tradeName: trimOrNull(form.tradeName),
    registrationType: form.registrationType,
    taxpayerType: trimOrNull(form.taxpayerType),
    stateCode: form.stateCode.trim(),
    state: trimOrNull(form.state),
    status: form.status,
    isPrimary: form.isPrimary,
  }
}

export function formatCurrencyValue(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value)

  if (!Number.isFinite(amount)) {
    return "₹0.00"
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function validatePartyForm(form: PartyFormState): PartyFormErrors {
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

  for (const key of [
    "customerCreditDays",
    "supplierCreditDays",
    "supplierLeadTimeDays",
  ] as const) {
    if (!/^\d+$/.test(form[key] || "0")) {
      errors[key] = "Enter a valid day count."
    }
  }

  return errors
}

export function buildCreatePayload(form: PartyFormState): CreatePartyPayload {
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

export function buildUpdatePayload(form: PartyFormState): UpdatePartyPayload {
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

export async function savePartyChildrenForEdit(
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

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}
