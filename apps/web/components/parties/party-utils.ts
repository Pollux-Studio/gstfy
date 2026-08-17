import {
  addPartyAddress,
  addPartyBankAccount,
  addPartyContact,
  addPartyGstRegistration,
  archivePartyAddress,
  archivePartyBankAccount,
  archivePartyContact,
  archivePartyGstRegistration,
  saveCustomerProfile,
  saveSupplierProfile,
  updatePartyAddress,
  updatePartyBankAccount,
  updatePartyContact,
  updatePartyGstRegistration,
  type CreatePartyPayload,
  type PartyDetail,
  type PartyAddress,
  type PartyBankAccount,
  type PartyContact,
  type PartyGstRegistration,
  type PartyGstRegistrationPayload,
  type PartyAddressPayload,
  type PartyContactPayload,
  type PartyBankAccountPayload,
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
  type PartyAddressFormState,
  type PartyBankAccountFormState,
  type PartyContactFormState,
  type PartyFormErrors,
  type PartyFormState,
  type PartyGstRegistrationFormState,
} from "./party-types"

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function createPartyFormKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyGstRegistration(
  overrides: Partial<PartyGstRegistrationFormState> = {}
): PartyGstRegistrationFormState {
  return {
    key: createPartyFormKey("gst"),
    gstin: "",
    legalName: "",
    tradeName: "",
    registrationType: "gst",
    taxpayerType: "",
    stateCode: "",
    state: "",
    effectiveFrom: "",
    effectiveTo: "",
    registeredAddressKey: "",
    status: "active",
    isPrimary: overrides.isPrimary ?? true,
    ...overrides,
  }
}

export function createEmptyAddress(
  overrides: Partial<PartyAddressFormState> = {}
): PartyAddressFormState {
  return {
    key: createPartyFormKey("address"),
    addressType: "billing",
    label: "",
    addressLine1: "",
    addressLine2: "",
    locality: "",
    city: "",
    district: "",
    state: "",
    stateCode: "",
    pincode: "",
    country: "India",
    isPrimary: overrides.isPrimary ?? true,
    isActive: true,
    ...overrides,
  }
}

export function createEmptyContact(
  overrides: Partial<PartyContactFormState> = {}
): PartyContactFormState {
  return {
    key: createPartyFormKey("contact"),
    name: "",
    designation: "",
    email: "",
    phone: "",
    mobile: "",
    contactRole: "billing_contact",
    isPrimary: overrides.isPrimary ?? true,
    status: "active",
    ...overrides,
  }
}

export function createEmptyBankAccount(
  overrides: Partial<PartyBankAccountFormState> = {}
): PartyBankAccountFormState {
  return {
    key: createPartyFormKey("bank"),
    bankName: "",
    accountName: "",
    accountNumber: "",
    ifsc: "",
    branch: "",
    accountType: "current",
    isPrimary: overrides.isPrimary ?? true,
    status: "active",
    ...overrides,
  }
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
  const gstRegistrations =
    "gstRegistrations" in party ?
      party.gstRegistrations
        .filter((registration) => registration.status !== "archived")
        .map(createGstRegistrationFormFromPartyRegistration)
    : party.primaryGstRegistration ?
      [createGstRegistrationFormFromPartyRegistration(party.primaryGstRegistration)]
    : []
  const addresses =
    "addresses" in party ?
      party.addresses
        .filter((address) => address.isActive)
        .map(createAddressFormFromPartyAddress)
    : primaryAddress ?
      [createAddressFormFromPartyAddress(primaryAddress)]
    : []
  const contacts =
    "contacts" in party ?
      party.contacts
        .filter((contact) => contact.status !== "inactive")
        .map(createContactFormFromPartyContact)
    : primaryContact ?
      [createContactFormFromPartyContact(primaryContact)]
    : []
  const bankAccounts =
    "bankAccounts" in party ?
      party.bankAccounts
        .filter((bankAccount) => bankAccount.status !== "archived")
        .map(createBankAccountFormFromPartyBankAccount)
    : []

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
    gstRegistrations,
    addresses,
    contacts,
    bankAccounts,
  }
}

function createGstRegistrationFormFromPartyRegistration(
  registration: PartyGstRegistration
): PartyGstRegistrationFormState {
  return {
    key: registration.id,
    id: registration.id,
    gstin: registration.gstin,
    legalName: registration.legalName ?? "",
    tradeName: registration.tradeName ?? "",
    registrationType: registration.registrationType,
    taxpayerType: registration.taxpayerType ?? "",
    stateCode: registration.stateCode,
    state: registration.state ?? "",
    effectiveFrom: registration.effectiveFrom ?? "",
    effectiveTo: registration.effectiveTo ?? "",
    registeredAddressKey: registration.registeredAddressId ?? "",
    status: registration.status,
    isPrimary: registration.isPrimary,
  }
}

function createAddressFormFromPartyAddress(address: PartyAddress): PartyAddressFormState {
  return {
    key: address.id,
    id: address.id,
    addressType: address.addressType,
    label: address.label ?? "",
    addressLine1: address.addressLine1 ?? "",
    addressLine2: address.addressLine2 ?? "",
    locality: address.locality ?? "",
    city: address.city ?? "",
    district: address.district ?? "",
    state: address.state ?? "",
    stateCode: address.stateCode ?? "",
    pincode: address.pincode ?? "",
    country: address.country,
    isPrimary: address.isPrimary,
    isActive: address.isActive,
  }
}

function createContactFormFromPartyContact(contact: PartyContact): PartyContactFormState {
  return {
    key: contact.id,
    id: contact.id,
    name: contact.name,
    designation: contact.designation ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    mobile: contact.mobile ?? "",
    contactRole: contact.contactRole ?? "billing_contact",
    isPrimary: contact.isPrimary,
    status: contact.status,
  }
}

function createBankAccountFormFromPartyBankAccount(
  bankAccount: PartyBankAccount
): PartyBankAccountFormState {
  return {
    key: bankAccount.id,
    id: bankAccount.id,
    bankName: bankAccount.bankName,
    accountName: bankAccount.accountName ?? "",
    accountNumber: "",
    ifsc: bankAccount.ifsc ?? "",
    branch: bankAccount.branch ?? "",
    accountType: bankAccount.accountType ?? "current",
    isPrimary: bankAccount.isPrimary,
    status: bankAccount.status,
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
  const gstins = getComparableGstins(form)
  const emails = getComparableContactEmails(form)
  const mobiles = getComparableContactMobiles(form)
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
      Boolean(party.primaryGstRegistration?.gstin) &&
      gstins.has(normalizeComparable(party.primaryGstRegistration?.gstin ?? ""))
  )
  if (sameGstin) {
    warnings.push(`GSTIN is already used by ${sameGstin.displayName}.`)
  }

  const sameEmail = candidates.find(
    (party) =>
      Boolean(party.primaryContact?.email) &&
      emails.has(normalizeComparable(party.primaryContact?.email ?? ""))
  )
  if (sameEmail) {
    warnings.push(`Email is already used by ${sameEmail.displayName}.`)
  }

  const sameMobile = candidates.find(
    (party) =>
      Boolean(party.primaryContact?.mobile) &&
      mobiles.has((party.primaryContact?.mobile ?? "").replace(/\D/g, ""))
  )
  if (sameMobile) {
    warnings.push(`Mobile number is already used by ${sameMobile.displayName}.`)
  }

  return warnings
}

function getComparableGstins(form: PartyFormState) {
  const values = form.gstRegistrations.map((registration) => registration.gstin)

  if (form.gstin) {
    values.push(form.gstin)
  }

  return new Set(
    values.map(normalizeComparable).filter((value) => value.length > 0)
  )
}

function getComparableContactEmails(form: PartyFormState) {
  const values = form.contacts.map((contact) => contact.email)

  if (form.contactEmail) {
    values.push(form.contactEmail)
  }

  return new Set(
    values.map(normalizeComparable).filter((value) => value.length > 0)
  )
}

function getComparableContactMobiles(form: PartyFormState) {
  const values = form.contacts.map((contact) => contact.mobile)

  if (form.contactMobile) {
    values.push(form.contactMobile)
  }

  return new Set(
    values.map((value) => value.replace(/\D/g, "")).filter((value) => value.length > 0)
  )
}

function normalizeComparable(value: string) {
  return value.trim().toUpperCase()
}

function normalizeNullable(value: string | null | undefined) {
  return normalizeComparable(value ?? "")
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
    effectiveFrom: registration.effectiveFrom ?? "",
    effectiveTo: registration.effectiveTo ?? "",
    registeredAddressId: registration.registeredAddressId ?? "",
    status: registration.status,
    isPrimary: registration.isPrimary,
  }
}

export function validateGstRegistrationForm(
  form: GstRegistrationFormState,
  addresses: PartyAddress[] = []
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

  if (form.registeredAddressId) {
    const address = addresses.find((row) => row.id === form.registeredAddressId)

    if (!address) {
      errors.registeredAddressId = "Select an address from this party."
    } else if (!address.isActive) {
      errors.registeredAddressId = "Selected registered address is inactive."
    } else if (
      address.stateCode &&
      form.stateCode &&
      address.stateCode !== form.stateCode
    ) {
      errors.registeredAddressId =
        "Address state code must match this GSTIN state code."
    }
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
    effectiveFrom: trimOrNull(form.effectiveFrom),
    effectiveTo: trimOrNull(form.effectiveTo),
    registeredAddressId: trimOrNull(form.registeredAddressId),
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

  const gstRegistrationErrors: NonNullable<PartyFormErrors["gstRegistrations"]> = {}
  const addressByKey = new Map(form.addresses.map((address) => [address.key, address]))
  for (const registration of form.gstRegistrations) {
    const itemErrors: Partial<Record<keyof PartyGstRegistrationFormState, string>> = {}

    if (!hasGstRegistrationInput(registration)) {
      continue
    }

    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(registration.gstin)) {
      itemErrors.gstin = "Enter a valid GSTIN."
    }

    if (!/^\d{2}$/.test(registration.stateCode)) {
      itemErrors.stateCode = "Enter the two-digit GST state code."
    }

    if (
      registration.gstin.length >= 2 &&
      registration.stateCode &&
      registration.gstin.slice(0, 2) !== registration.stateCode
    ) {
      itemErrors.stateCode = "State code must match GSTIN."
    }

    if (
      registration.effectiveFrom &&
      registration.effectiveTo &&
      registration.effectiveFrom > registration.effectiveTo
    ) {
      itemErrors.effectiveTo = "End date must be after start date."
    }

    if (registration.registeredAddressKey) {
      const address = addressByKey.get(registration.registeredAddressKey)

      if (!address) {
        itemErrors.registeredAddressKey = "Select an address from this party."
      } else if (
        address.stateCode &&
        registration.stateCode &&
        address.stateCode !== registration.stateCode
      ) {
        itemErrors.registeredAddressKey =
          "Address state code must match this GSTIN state code."
      }
    }

    if (Object.keys(itemErrors).length > 0) {
      gstRegistrationErrors[registration.key] = itemErrors
    }
  }

  if (Object.keys(gstRegistrationErrors).length > 0) {
    errors.gstRegistrations = gstRegistrationErrors
  }

  const addressErrors: NonNullable<PartyFormErrors["addresses"]> = {}
  for (const address of form.addresses) {
    const itemErrors: Partial<Record<keyof PartyAddressFormState, string>> = {}

    if (!hasAddressRowInput(address)) {
      continue
    }

    if (address.pincode && !/^\d{6}$/.test(address.pincode)) {
      itemErrors.pincode = "Enter a valid 6-digit pincode."
    }

    if (address.stateCode && !/^\d{2}$/.test(address.stateCode)) {
      itemErrors.stateCode = "Enter a two-digit state code."
    }

    if (Object.keys(itemErrors).length > 0) {
      addressErrors[address.key] = itemErrors
    }
  }

  if (Object.keys(addressErrors).length > 0) {
    errors.addresses = addressErrors
  }

  const contactErrors: NonNullable<PartyFormErrors["contacts"]> = {}
  for (const contact of form.contacts) {
    const itemErrors: Partial<Record<keyof PartyContactFormState, string>> = {}

    if (!hasContactRowInput(contact)) {
      continue
    }

    if (!contact.name.trim()) {
      itemErrors.name = "Enter the contact name."
    }

    if (contact.mobile && !/^\d{10}$/.test(contact.mobile)) {
      itemErrors.mobile = "Enter a valid 10-digit mobile number."
    }

    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      itemErrors.email = "Enter a valid email address."
    }

    if (Object.keys(itemErrors).length > 0) {
      contactErrors[contact.key] = itemErrors
    }
  }

  if (Object.keys(contactErrors).length > 0) {
    errors.contacts = contactErrors
  }

  const bankAccountErrors: NonNullable<PartyFormErrors["bankAccounts"]> = {}
  for (const bankAccount of form.bankAccounts) {
    const itemErrors: Partial<Record<keyof PartyBankAccountFormState, string>> = {}

    if (!hasBankAccountInput(bankAccount)) {
      continue
    }

    if (!bankAccount.bankName.trim()) {
      itemErrors.bankName = "Enter the bank name."
    }

    if (!bankAccount.id && bankAccount.accountNumber.trim().length < 4) {
      itemErrors.accountNumber = "Enter at least 4 digits."
    }

    if (
      bankAccount.ifsc &&
      !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankAccount.ifsc.toUpperCase())
    ) {
      itemErrors.ifsc = "Enter a valid IFSC."
    }

    if (Object.keys(itemErrors).length > 0) {
      bankAccountErrors[bankAccount.key] = itemErrors
    }
  }

  if (Object.keys(bankAccountErrors).length > 0) {
    errors.bankAccounts = bankAccountErrors
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
  const gstRegistrations = getEnteredGstRegistrations(form)
  const addresses = getEnteredAddresses(form)
  const contacts = getEnteredContacts(form)
  const bankAccounts = getEnteredBankAccounts(form)

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

  if (gstRegistrations[0]) {
    payload.gstRegistration = buildGstRegistrationPayload(gstRegistrations[0])
  }

  if (addresses[0]) {
    payload.address = buildAddressPayload(addresses[0])
  }

  if (contacts[0]) {
    payload.contact = buildContactPayload(contacts[0], form.displayName)
  }

  if (bankAccounts[0]) {
    payload.bankAccount = buildBankAccountPayload(bankAccounts[0])
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

export async function savePartyChildrenForCreate(
  partyId: string,
  form: PartyFormState,
  createdParty: PartyDetail,
  accessToken: string
) {
  let latestParty = createdParty
  const gstRegistrations = getEnteredGstRegistrations(form)
  const addresses = getEnteredAddresses(form)
  const contacts = getEnteredContacts(form)
  const bankAccounts = getEnteredBankAccounts(form)
  const addressIdByKey = createExistingAddressIdMap(addresses)
  const createdInlineAddress = findMatchingAddress(addresses[0] ?? null, latestParty.addresses)
  if (addresses[0] && createdInlineAddress) {
    addressIdByKey.set(addresses[0].key, createdInlineAddress.id)
  }
  const createdInlineGst = findMatchingGstRegistration(
    gstRegistrations[0] ?? null,
    latestParty.gstRegistrations
  )

  for (const address of addresses.slice(1)) {
    const response = await addPartyAddress(partyId, buildAddressPayload(address), accessToken)
    addressIdByKey.set(address.key, response.address.id)
    latestParty = response.party
  }

  if (gstRegistrations[0]?.registeredAddressKey && createdInlineGst) {
    latestParty = (
      await updatePartyGstRegistration(
        partyId,
        createdInlineGst.id,
        buildGstRegistrationPayload(gstRegistrations[0], addressIdByKey),
        accessToken
      )
    ).party
  }

  for (const registration of gstRegistrations.slice(1)) {
    latestParty = (
      await addPartyGstRegistration(
        partyId,
        buildGstRegistrationPayload(registration, addressIdByKey),
        accessToken
      )
    ).party
  }

  for (const contact of contacts.slice(1)) {
    latestParty = (
      await addPartyContact(
        partyId,
        buildContactPayload(contact, form.displayName),
        accessToken
      )
    ).party
  }

  for (const bankAccount of bankAccounts.slice(1)) {
    latestParty = (
      await addPartyBankAccount(
        partyId,
        buildBankAccountPayload(bankAccount),
        accessToken
      )
    ).party
  }

  return { party: latestParty }
}

export async function savePartyChildrenForEdit(
  partyId: string,
  form: PartyFormState,
  party: PartyDetail,
  accessToken: string
) {
  let latestParty = party
  const addressIdByKey = createExistingAddressIdMap(form.addresses)

  latestParty = (
    await syncAddressesForEdit(partyId, form, latestParty, accessToken, addressIdByKey)
  ).party
  latestParty = (
    await syncGstRegistrationsForEdit(
      partyId,
      form,
      latestParty,
      accessToken,
      addressIdByKey
    )
  ).party
  latestParty = (await syncContactsForEdit(partyId, form, latestParty, accessToken)).party
  latestParty = (await syncBankAccountsForEdit(partyId, form, latestParty, accessToken)).party
  latestParty = (
    await savePartyTermsForEdit(partyId, form, latestParty, accessToken)
  ).party

  return { party: latestParty }
}

async function syncGstRegistrationsForEdit(
  partyId: string,
  form: PartyFormState,
  party: PartyDetail,
  accessToken: string,
  addressIdByKey: Map<string, string>
) {
  let latestParty = party
  const rows = getEnteredGstRegistrations(form)
  const activeExisting = party.gstRegistrations.filter(
    (registration) => registration.status !== "archived"
  )
  const retainedIds = new Set(rows.map((row) => row.id).filter(Boolean))

  for (const existing of activeExisting) {
    if (!retainedIds.has(existing.id)) {
      latestParty = (await archivePartyGstRegistration(partyId, existing.id, accessToken)).party
    }
  }

  for (const row of rows) {
    if (row.id) {
      latestParty = (
        await updatePartyGstRegistration(
          partyId,
          row.id,
          buildGstRegistrationPayload(row, addressIdByKey),
          accessToken
        )
      ).party
    } else {
      latestParty = (
        await addPartyGstRegistration(
          partyId,
          buildGstRegistrationPayload(row, addressIdByKey),
          accessToken
        )
      ).party
    }
  }

  return { party: latestParty }
}

async function syncAddressesForEdit(
  partyId: string,
  form: PartyFormState,
  party: PartyDetail,
  accessToken: string,
  addressIdByKey: Map<string, string>
) {
  let latestParty = party
  const rows = getEnteredAddresses(form)
  const activeExisting = party.addresses.filter((address) => address.isActive)
  const retainedIds = new Set(rows.map((row) => row.id).filter(Boolean))

  for (const existing of activeExisting) {
    if (!retainedIds.has(existing.id)) {
      latestParty = (await archivePartyAddress(partyId, existing.id, accessToken)).party
    }
  }

  for (const row of rows) {
    if (row.id) {
      const response = await updatePartyAddress(
        partyId,
        row.id,
        buildAddressPayload(row),
        accessToken
      )
      addressIdByKey.set(row.key, response.address.id)
      latestParty = response.party
    } else {
      const response = await addPartyAddress(partyId, buildAddressPayload(row), accessToken)
      addressIdByKey.set(row.key, response.address.id)
      latestParty = response.party
    }
  }

  return { party: latestParty }
}

async function syncContactsForEdit(
  partyId: string,
  form: PartyFormState,
  party: PartyDetail,
  accessToken: string
) {
  let latestParty = party
  const rows = getEnteredContacts(form)
  const activeExisting = party.contacts.filter((contact) => contact.status !== "inactive")
  const retainedIds = new Set(rows.map((row) => row.id).filter(Boolean))

  for (const existing of activeExisting) {
    if (!retainedIds.has(existing.id)) {
      latestParty = (await archivePartyContact(partyId, existing.id, accessToken)).party
    }
  }

  for (const row of rows) {
    if (row.id) {
      latestParty = (
        await updatePartyContact(
          partyId,
          row.id,
          buildContactPayload(row, form.displayName),
          accessToken
        )
      ).party
    } else {
      latestParty = (
        await addPartyContact(
          partyId,
          buildContactPayload(row, form.displayName),
          accessToken
        )
      ).party
    }
  }

  return { party: latestParty }
}

async function syncBankAccountsForEdit(
  partyId: string,
  form: PartyFormState,
  party: PartyDetail,
  accessToken: string
) {
  let latestParty = party
  const rows = getEnteredBankAccounts(form)
  const activeExisting = party.bankAccounts.filter(
    (bankAccount) => bankAccount.status !== "archived"
  )
  const retainedIds = new Set(rows.map((row) => row.id).filter(Boolean))

  for (const existing of activeExisting) {
    if (!retainedIds.has(existing.id)) {
      latestParty = (await archivePartyBankAccount(partyId, existing.id, accessToken)).party
    }
  }

  for (const row of rows) {
    if (row.id) {
      latestParty = (
        await updatePartyBankAccount(
          partyId,
          row.id,
          buildBankAccountPayload(row),
          accessToken
        )
      ).party
    } else {
      latestParty = (
        await addPartyBankAccount(
          partyId,
          buildBankAccountPayload(row),
          accessToken
        )
      ).party
    }
  }

  return { party: latestParty }
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

function getEnteredGstRegistrations(form: PartyFormState) {
  const rows = form.gstRegistrations.filter(hasGstRegistrationInput)

  if (rows.length > 0) {
    return normalizePrimaryRows(rows)
  }

  if (form.hasGst) {
    return [
      createEmptyGstRegistration({
        gstin: form.gstin,
        legalName: form.gstLegalName,
        tradeName: form.gstTradeName,
        stateCode: form.gstStateCode,
        state: form.gstState,
        taxpayerType: form.taxpayerType,
        isPrimary: true,
      }),
    ].filter(hasGstRegistrationInput)
  }

  return []
}

function getEnteredAddresses(form: PartyFormState) {
  const rows = form.addresses.filter(hasAddressRowInput)

  if (rows.length > 0) {
    return normalizePrimaryRows(rows)
  }

  if (hasAddressInput(form)) {
    return [
      createEmptyAddress({
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2,
        city: form.city,
        district: form.district,
        state: form.state,
        stateCode: form.stateCode || form.gstStateCode,
        pincode: form.pincode,
        isPrimary: true,
      }),
    ]
  }

  return []
}

function getEnteredContacts(form: PartyFormState) {
  const rows = form.contacts.filter(hasContactRowInput)

  if (rows.length > 0) {
    return normalizePrimaryRows(rows)
  }

  if (hasContactInput(form)) {
    return [
      createEmptyContact({
        name: form.contactName,
        email: form.contactEmail,
        mobile: form.contactMobile,
        isPrimary: true,
      }),
    ]
  }

  return []
}

function getEnteredBankAccounts(form: PartyFormState) {
  return normalizePrimaryRows(form.bankAccounts.filter(hasBankAccountInput))
}

function normalizePrimaryRows<T extends { isPrimary: boolean }>(rows: T[]) {
  const primaryIndex = rows.findIndex((row) => row.isPrimary)

  if (primaryIndex !== -1) {
    return rows
  }

  return rows.map((row, index) => ({
    ...row,
    isPrimary: index === 0,
  }))
}

function buildGstRegistrationPayload(
  registration: PartyGstRegistrationFormState,
  addressIdByKey = new Map<string, string>()
): PartyGstRegistrationPayload {
  return {
    gstin: registration.gstin.trim().toUpperCase(),
    legalName: trimOrNull(registration.legalName),
    tradeName: trimOrNull(registration.tradeName),
    registrationType: registration.registrationType,
    taxpayerType: trimOrNull(registration.taxpayerType),
    stateCode: registration.stateCode.trim(),
    state: trimOrNull(registration.state),
    effectiveFrom: trimOrNull(registration.effectiveFrom),
    effectiveTo: trimOrNull(registration.effectiveTo),
    registeredAddressId: resolveRegisteredAddressId(
      registration.registeredAddressKey,
      addressIdByKey
    ),
    status: registration.status,
    isPrimary: registration.isPrimary,
  }
}

function createExistingAddressIdMap(addresses: PartyAddressFormState[]) {
  return new Map(
    addresses
      .filter((address): address is PartyAddressFormState & { id: string } =>
        Boolean(address.id)
      )
      .map((address) => [address.key, address.id])
  )
}

function resolveRegisteredAddressId(
  registeredAddressKey: string,
  addressIdByKey: Map<string, string>
) {
  if (!registeredAddressKey) {
    return null
  }

  return addressIdByKey.get(registeredAddressKey) ?? null
}

function findMatchingAddress(
  formAddress: PartyAddressFormState | null,
  addresses: PartyAddress[]
) {
  if (!formAddress) {
    return null
  }

  if (formAddress.id) {
    return addresses.find((address) => address.id === formAddress.id) ?? null
  }

  return (
    addresses.find(
      (address) =>
        normalizeNullable(address.addressLine1) ===
          normalizeComparable(formAddress.addressLine1) &&
        normalizeNullable(address.pincode) === normalizeComparable(formAddress.pincode)
    ) ?? addresses.find((address) => address.isPrimary) ?? addresses[0] ?? null
  )
}

function findMatchingGstRegistration(
  formRegistration: PartyGstRegistrationFormState | null,
  registrations: PartyGstRegistration[]
) {
  if (!formRegistration) {
    return null
  }

  if (formRegistration.id) {
    return (
      registrations.find((registration) => registration.id === formRegistration.id) ??
      null
    )
  }

  return (
    registrations.find(
      (registration) =>
        normalizeComparable(registration.gstin) ===
        normalizeComparable(formRegistration.gstin)
    ) ?? registrations.find((registration) => registration.isPrimary) ?? registrations[0] ?? null
  )
}

function buildAddressPayload(address: PartyAddressFormState): PartyAddressPayload {
  return compactUndefined({
    addressType: address.addressType,
    label: trimOrUndefined(address.label),
    addressLine1: trimOrUndefined(address.addressLine1),
    addressLine2: trimOrUndefined(address.addressLine2),
    locality: trimOrUndefined(address.locality),
    city: trimOrUndefined(address.city),
    district: trimOrUndefined(address.district),
    state: trimOrUndefined(address.state),
    stateCode: trimOrUndefined(address.stateCode),
    pincode: trimOrUndefined(address.pincode),
    country: trimOrUndefined(address.country) ?? "India",
    isPrimary: address.isPrimary,
    isActive: address.isActive,
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

function buildContactPayload(
  contact: PartyContactFormState,
  fallbackName: string
): PartyContactPayload & { name: string } {
  return {
    name: contact.name.trim() || fallbackName.trim(),
    designation: trimOrNull(contact.designation),
    email: trimOrNull(contact.email),
    phone: trimOrNull(contact.phone),
    mobile: trimOrNull(contact.mobile),
    contactRole: contact.contactRole,
    isPrimary: contact.isPrimary,
    status: contact.status,
  }
}

function hasContactInput(form: PartyFormState) {
  return [form.contactName, form.contactMobile, form.contactEmail].some(
    (value) => value.trim().length > 0
  )
}

function buildBankAccountPayload(
  bankAccount: PartyBankAccountFormState
): PartyBankAccountPayload & { bankName: string } {
  return compactUndefined({
    bankName: bankAccount.bankName.trim(),
    accountName: trimOrUndefined(bankAccount.accountName),
    accountNumber: trimOrUndefined(bankAccount.accountNumber),
    ifsc: trimOrUndefined(bankAccount.ifsc.toUpperCase()),
    branch: trimOrUndefined(bankAccount.branch),
    accountType: bankAccount.accountType,
    isPrimary: bankAccount.isPrimary,
    status: bankAccount.status,
  }) as PartyBankAccountPayload & { bankName: string }
}

function hasGstRegistrationInput(registration: PartyGstRegistrationFormState) {
  return [
    registration.gstin,
    registration.legalName,
    registration.tradeName,
    registration.taxpayerType,
    registration.stateCode,
    registration.state,
    registration.effectiveFrom,
    registration.effectiveTo,
    registration.registeredAddressKey,
  ].some((value) => value.trim().length > 0)
}

function hasAddressRowInput(address: PartyAddressFormState) {
  return [
    address.label,
    address.addressLine1,
    address.addressLine2,
    address.locality,
    address.city,
    address.district,
    address.state,
    address.stateCode,
    address.pincode,
  ].some((value) => value.trim().length > 0)
}

function hasContactRowInput(contact: PartyContactFormState) {
  return [
    contact.name,
    contact.designation,
    contact.email,
    contact.phone,
    contact.mobile,
  ].some((value) => value.trim().length > 0)
}

function hasBankAccountInput(bankAccount: PartyBankAccountFormState) {
  return [
    bankAccount.bankName,
    bankAccount.accountName,
    bankAccount.accountNumber,
    bankAccount.ifsc,
    bankAccount.branch,
  ].some((value) => value.trim().length > 0)
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
