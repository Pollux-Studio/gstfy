import { createHash } from "node:crypto"

import { and, desc, eq, ilike, inArray, or, sql as drizzleSql, type SQL } from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { db } from "../../db/client.js"
import {
  auditLogs,
  businessMemberPermissions,
  partyAddresses,
  partyBankAccounts,
  partyContacts,
  partyCustomerProfiles,
  partyDocuments,
  partyGstRegistrations,
  parties,
  partySupplierProfiles,
  partyTaxIdentifiers,
  paymentTerms,
  receivablePayableEntries,
  users,
  vouchers,
  warehouses,
  type PartyCustomerProfileRecord,
  type PartyRecord,
  type PartySupplierProfileRecord,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { createProfileImage } from "../../utils/avatar.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"
import {
  customerProfileSchema,
  idParamsSchema,
  listPartiesQuerySchema,
  partyAuditQuerySchema,
  partyDuplicateQuerySchema,
  partyLedgerQuerySchema,
  partyAddressParamsSchema,
  partyAddressSchema,
  partyBankAccountParamsSchema,
  partyBankAccountSchema,
  partyContactParamsSchema,
  partyContactSchema,
  partyDocumentParamsSchema,
  partyDocumentSchema,
  partyGstRegistrationParamsSchema,
  partyGstRegistrationSchema,
  supplierProfileSchema,
  updateCustomerProfileSchema,
  updatePartyAddressSchema,
  updatePartyBankAccountSchema,
  updatePartyContactSchema,
  updatePartyDocumentSchema,
  updatePartyGstRegistrationSchema,
  updatePartySchema,
  updateSupplierProfileSchema,
  createPartySchema,
} from "./parties.schemas.js"

type BusinessAccess = Awaited<ReturnType<typeof requirePrimaryBusinessAccess>>
type PartyAction = "view" | "create" | "edit" | "delete"

export async function registerPartiesRoutes(app: FastifyInstance) {
  app.get("/parties", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "view")
    const query = listPartiesQuerySchema.parse(request.query)

    const rolePartyIds =
      query.role ? await findPartyIdsByRole(access.business.id, query.role) : null

    if (rolePartyIds && rolePartyIds.length === 0) {
      return {
        parties: [],
        pagination: createPaginationMeta(query.page, query.limit, 0),
      }
    }

    const conditions: SQL[] = [eq(parties.businessId, access.business.id)]

    if (query.status) {
      conditions.push(eq(parties.status, query.status))
    }

    if (rolePartyIds) {
      conditions.push(inArray(parties.id, rolePartyIds))
    }

    if (query.search) {
      const matchedIds = await findPartyIdsBySearch(access.business.id, query.search)
      const term = `%${escapeLikeTerm(query.search)}%`
      const searchConditions: SQL[] = [
        ilike(parties.displayName, term),
        ilike(parties.legalName, term),
        ilike(parties.tradeName, term),
        ilike(parties.shortName, term),
        ilike(parties.pan, term),
      ]

      if (matchedIds.length > 0) {
        searchConditions.push(inArray(parties.id, matchedIds))
      }

      const searchCondition = or(...searchConditions)
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }

    const rows = await db
      .select()
      .from(parties)
      .where(and(...conditions))
      .orderBy(desc(parties.updatedAt))

    const summaries = sortPartySummaries(
      await buildPartySummaries(access.business.id, rows),
      query.sortBy,
      query.sortDir
    )
    const { items, pagination } = paginateArray(summaries, query.page, query.limit)

    return {
      parties: items,
      pagination,
    }
  })

  app.get("/parties/duplicates", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "view")
    const query = partyDuplicateQuerySchema.parse(request.query)

    return {
      suggestions: await findPartyDuplicateSuggestions(access.business.id, query),
    }
  })

  app.post("/parties", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "create")
    const body = createPartySchema.parse(request.body)

    await assertPartyCodesAvailable(access.business.id, body.customerProfile, body.supplierProfile)
    if (body.gstRegistration) {
      await assertGstinAvailable(access.business.id, body.gstRegistration.gstin)
    }

    const customerCode =
      body.roles.includes("customer") ?
        body.customerProfile?.customerCode ?? (await allocateCustomerCode(access.business.id))
      : null
    const supplierCode =
      body.roles.includes("supplier") ?
        body.supplierProfile?.supplierCode ?? (await allocateSupplierCode(access.business.id))
      : null

    const party = await db.transaction(async (tx) => {
      const [insertedParty] = await tx
        .insert(parties)
        .values({
          businessId: access.business.id,
          partyType: body.partyType,
          displayName: body.displayName,
          legalName: body.legalName ?? null,
          tradeName: body.tradeName ?? null,
          shortName: body.shortName ?? null,
          pan: body.pan ?? null,
          profileImageSeed: createProfileImage().profileImageSeed,
          status: body.status,
          notes: body.notes ?? null,
          createdBy: access.userId,
          updatedBy: access.userId,
        })
        .returning()

      if (!insertedParty) {
        throw new HttpError(500, "Unable to create party.")
      }

      if (body.pan) {
        await tx.insert(partyTaxIdentifiers).values({
          businessId: access.business.id,
          partyId: insertedParty.id,
          identifierType: "pan",
          identifierValue: body.pan,
          status: "active",
        })
      }

      let addressId: string | null = null
      if (body.address) {
        const [address] = await tx
          .insert(partyAddresses)
          .values({
            businessId: access.business.id,
            partyId: insertedParty.id,
            addressType: body.address.addressType,
            label: body.address.label ?? null,
            addressLine1: body.address.addressLine1 ?? null,
            addressLine2: body.address.addressLine2 ?? null,
            locality: body.address.locality ?? null,
            city: body.address.city ?? null,
            district: body.address.district ?? null,
            state: body.address.state ?? null,
            stateCode: body.address.stateCode ?? null,
            pincode: body.address.pincode ?? null,
            country: body.address.country,
            isPrimary: true,
            isActive: body.address.isActive,
          })
          .returning()

        addressId = address?.id ?? null
      }

      let gstRegistrationId: string | null = null
      if (body.gstRegistration) {
        const registeredAddressId =
          body.gstRegistration.registeredAddressId !== undefined ?
            body.gstRegistration.registeredAddressId
          :
          (addressId && body.address?.stateCode === body.gstRegistration.stateCode ?
            addressId
          : null)

        if (registeredAddressId) {
          if (registeredAddressId === addressId) {
            assertAddressStateMatchesGst(
              body.address?.stateCode ?? null,
              body.gstRegistration.stateCode
            )
          } else {
            await assertRegisteredAddressForGst(
              access.business.id,
              insertedParty.id,
              body.gstRegistration.stateCode,
              registeredAddressId
            )
          }
        }

        const [registration] = await tx
          .insert(partyGstRegistrations)
          .values({
            businessId: access.business.id,
            partyId: insertedParty.id,
            gstin: body.gstRegistration.gstin,
            legalName: body.gstRegistration.legalName ?? null,
            tradeName: body.gstRegistration.tradeName ?? null,
            registrationType: body.gstRegistration.registrationType,
            taxpayerType: body.gstRegistration.taxpayerType ?? null,
            stateCode: body.gstRegistration.stateCode,
            state: body.gstRegistration.state ?? null,
            effectiveFrom: body.gstRegistration.effectiveFrom ?? null,
            effectiveTo: body.gstRegistration.effectiveTo ?? null,
            registeredAddressId,
            status: body.gstRegistration.status,
            isPrimary: true,
          })
          .returning()

        gstRegistrationId = registration?.id ?? null
      }

      let contactId: string | null = null
      if (body.contact) {
        const [contact] = await tx
          .insert(partyContacts)
          .values({
            businessId: access.business.id,
            partyId: insertedParty.id,
            name: body.contact.name,
            designation: body.contact.designation ?? null,
            email: body.contact.email ?? null,
            phone: body.contact.phone ?? null,
            mobile: body.contact.mobile ?? null,
            contactRole: body.contact.contactRole ?? null,
            isPrimary: true,
            status: body.contact.status,
          })
          .returning()

        contactId = contact?.id ?? null
      }

      if (body.bankAccount) {
        const bankAccount = serializeBankAccountCreate(body.bankAccount)
        await tx.insert(partyBankAccounts).values({
          businessId: access.business.id,
          partyId: insertedParty.id,
          ...bankAccount,
          isPrimary: true,
        })
      }

      if (body.roles.includes("customer") && customerCode) {
        const input = customerProfileSchema.parse(body.customerProfile ?? {})
        await assertCustomerProfileReferences(access.business.id, insertedParty.id, input)
        await tx.insert(partyCustomerProfiles).values({
          businessId: access.business.id,
          partyId: insertedParty.id,
          customerCode,
          creditLimit: normalizeMoney(input.creditLimit),
          creditDays: input.creditDays,
          defaultPaymentTermId: input.defaultPaymentTermId ?? null,
          defaultBillingAddressId: input.defaultBillingAddressId ?? addressId,
          defaultShippingAddressId: input.defaultShippingAddressId ?? addressId,
          defaultGstRegistrationId: input.defaultGstRegistrationId ?? gstRegistrationId,
          priceGroupId: input.priceGroupId ?? null,
          salesRepId: input.salesRepId ?? null,
          status: input.status,
        })
      }

      if (body.roles.includes("supplier") && supplierCode) {
        const input = supplierProfileSchema.parse(body.supplierProfile ?? {})
        await assertSupplierProfileReferences(access.business.id, insertedParty.id, input)
        await tx.insert(partySupplierProfiles).values({
          businessId: access.business.id,
          partyId: insertedParty.id,
          supplierCode,
          creditDays: input.creditDays,
          defaultPaymentTermId: input.defaultPaymentTermId ?? null,
          defaultPurchaseAddressId: input.defaultPurchaseAddressId ?? addressId,
          defaultGstRegistrationId: input.defaultGstRegistrationId ?? gstRegistrationId,
          preferredWarehouseId: input.preferredWarehouseId ?? null,
          leadTimeDays: input.leadTimeDays,
          status: input.status,
        })
      }

      await tx.insert(auditLogs).values({
        businessId: access.business.id,
        entityType: "party",
        entityId: insertedParty.id,
        action: "PARTY_CREATED",
        userId: access.userId,
        before: null,
        after: {
          party: insertedParty,
          roles: body.roles,
          gstRegistrationId,
          addressId,
          contactId,
        },
        reason: null,
      })

      return insertedParty
    })

    return {
      party: await getPartyDetail(access.business.id, party.id),
    }
  })

  app.get("/parties/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "view")
    const { id } = idParamsSchema.parse(request.params)

    return {
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.get("/parties/:id/ledger", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "view")
    const { id } = idParamsSchema.parse(request.params)
    const query = partyLedgerQuerySchema.parse(request.query)
    const party = await requireParty(access.business.id, id)

    return {
      party: {
        id: party.id,
        displayName: party.displayName,
        status: party.status,
      },
      ...(await getPartyLedger(access.business.id, id, query)),
    }
  })

  app.get("/parties/:id/audit", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "view")
    const { id } = idParamsSchema.parse(request.params)
    const query = partyAuditQuerySchema.parse(request.query)
    await requireParty(access.business.id, id)

    return getPartyAuditTimeline(access.business.id, id, query)
  })

  app.patch("/parties/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    const before = await requireParty(access.business.id, id)
    const parsedBody = compactObject(updatePartySchema.parse(request.body))
    const { roles, ...body } = parsedBody

    const [party] = await db
      .update(parties)
      .set({
        ...body,
        updatedBy: access.userId,
        updatedAt: new Date(),
      })
      .where(and(eq(parties.id, id), eq(parties.businessId, access.business.id)))
      .returning()

    if (!party) {
      throw new HttpError(500, "Unable to update party.")
    }

    if (roles) {
      await reconcilePartyRoles(access, id, roles)
    }

    const after = await getPartyDetail(access.business.id, id)
    await writeAudit(access, "party", id, "PARTY_UPDATED", before, after)

    return {
      party: after,
    }
  })

  app.delete("/parties/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "delete")
    const { id } = idParamsSchema.parse(request.params)
    const before = await requireParty(access.business.id, id)

    await db
      .update(parties)
      .set({
        status: "archived",
        updatedBy: access.userId,
        updatedAt: new Date(),
      })
      .where(and(eq(parties.id, id), eq(parties.businessId, access.business.id)))

    await writeAudit(access, "party", id, "PARTY_DEACTIVATED", before, {
      ...before,
      status: "archived",
    })

    return { ok: true }
  })

  app.post("/parties/:id/customer", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    await requireParty(access.business.id, id)
    const body = customerProfileSchema.parse(request.body)
    await assertCustomerProfileReferences(access.business.id, id, body)
    const customerCode = body.customerCode ?? (await allocateCustomerCode(access.business.id))
    await assertCustomerCodeAvailable(access.business.id, customerCode, id)

    await db
      .insert(partyCustomerProfiles)
      .values({
        businessId: access.business.id,
        partyId: id,
        customerCode,
        creditLimit: normalizeMoney(body.creditLimit),
        creditDays: body.creditDays,
        defaultPaymentTermId: body.defaultPaymentTermId ?? null,
        defaultBillingAddressId: body.defaultBillingAddressId ?? null,
        defaultShippingAddressId: body.defaultShippingAddressId ?? null,
        defaultGstRegistrationId: body.defaultGstRegistrationId ?? null,
        priceGroupId: body.priceGroupId ?? null,
        salesRepId: body.salesRepId ?? null,
        status: body.status,
      })
      .onConflictDoUpdate({
        target: partyCustomerProfiles.partyId,
        set: {
          customerCode,
          creditLimit: normalizeMoney(body.creditLimit),
          creditDays: body.creditDays,
          defaultPaymentTermId: body.defaultPaymentTermId ?? null,
          defaultBillingAddressId: body.defaultBillingAddressId ?? null,
          defaultShippingAddressId: body.defaultShippingAddressId ?? null,
          defaultGstRegistrationId: body.defaultGstRegistrationId ?? null,
          priceGroupId: body.priceGroupId ?? null,
          salesRepId: body.salesRepId ?? null,
          status: body.status,
          updatedAt: new Date(),
        },
      })

    await writeAudit(access, "party", id, "CUSTOMER_PROFILE_UPDATED", null, body)

    return {
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.patch("/parties/:id/customer", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    await requireCustomerProfile(access.business.id, id)
    const body = compactObject(updateCustomerProfileSchema.parse(request.body))
    await assertCustomerProfileReferences(access.business.id, id, body)

    if (body.customerCode) {
      await assertCustomerCodeAvailable(access.business.id, body.customerCode, id)
    }

    const before = await requireCustomerProfile(access.business.id, id)
    const [profile] = await db
      .update(partyCustomerProfiles)
      .set({
        ...body,
        creditLimit:
          body.creditLimit === undefined ? undefined : normalizeMoney(body.creditLimit),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(partyCustomerProfiles.businessId, access.business.id),
          eq(partyCustomerProfiles.partyId, id)
        )
      )
      .returning()

    await writeAudit(access, "party", id, "CUSTOMER_PROFILE_UPDATED", before, profile)

    return {
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.post("/parties/:id/supplier", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    await requireParty(access.business.id, id)
    const body = supplierProfileSchema.parse(request.body)
    await assertSupplierProfileReferences(access.business.id, id, body)
    const supplierCode = body.supplierCode ?? (await allocateSupplierCode(access.business.id))
    await assertSupplierCodeAvailable(access.business.id, supplierCode, id)

    await db
      .insert(partySupplierProfiles)
      .values({
        businessId: access.business.id,
        partyId: id,
        supplierCode,
        creditDays: body.creditDays,
        defaultPaymentTermId: body.defaultPaymentTermId ?? null,
        defaultPurchaseAddressId: body.defaultPurchaseAddressId ?? null,
        defaultGstRegistrationId: body.defaultGstRegistrationId ?? null,
        preferredWarehouseId: body.preferredWarehouseId ?? null,
        leadTimeDays: body.leadTimeDays,
        status: body.status,
      })
      .onConflictDoUpdate({
        target: partySupplierProfiles.partyId,
        set: {
          supplierCode,
          creditDays: body.creditDays,
          defaultPaymentTermId: body.defaultPaymentTermId ?? null,
          defaultPurchaseAddressId: body.defaultPurchaseAddressId ?? null,
          defaultGstRegistrationId: body.defaultGstRegistrationId ?? null,
          preferredWarehouseId: body.preferredWarehouseId ?? null,
          leadTimeDays: body.leadTimeDays,
          status: body.status,
          updatedAt: new Date(),
        },
      })

    await writeAudit(access, "party", id, "SUPPLIER_PROFILE_UPDATED", null, body)

    return {
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.patch("/parties/:id/supplier", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    await requireSupplierProfile(access.business.id, id)
    const body = compactObject(updateSupplierProfileSchema.parse(request.body))
    await assertSupplierProfileReferences(access.business.id, id, body)

    if (body.supplierCode) {
      await assertSupplierCodeAvailable(access.business.id, body.supplierCode, id)
    }

    const before = await requireSupplierProfile(access.business.id, id)
    const [profile] = await db
      .update(partySupplierProfiles)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(partySupplierProfiles.businessId, access.business.id),
          eq(partySupplierProfiles.partyId, id)
        )
      )
      .returning()

    await writeAudit(access, "party", id, "SUPPLIER_PROFILE_UPDATED", before, profile)

    return {
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.get("/parties/:id/gst-registrations", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "view")
    const { id } = idParamsSchema.parse(request.params)
    await requireParty(access.business.id, id)

    return {
      gstRegistrations: await listGstRegistrations(access.business.id, id),
    }
  })

  app.post("/parties/:id/gst-registrations", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    await requireParty(access.business.id, id)
    const body = partyGstRegistrationSchema.parse(request.body)
    await assertGstinAvailable(access.business.id, body.gstin)
    if (body.registeredAddressId) {
      await assertRegisteredAddressForGst(
        access.business.id,
        id,
        body.stateCode,
        body.registeredAddressId
      )
    }
    const isPrimary = body.isPrimary || (await listGstRegistrations(access.business.id, id)).length === 0

    const [registration] = await db.transaction(async (tx) => {
      if (isPrimary) {
        await tx
          .update(partyGstRegistrations)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(partyGstRegistrations.partyId, id))
      }

      return tx
        .insert(partyGstRegistrations)
        .values({
          businessId: access.business.id,
          partyId: id,
          gstin: body.gstin,
          legalName: body.legalName ?? null,
          tradeName: body.tradeName ?? null,
          registrationType: body.registrationType,
          taxpayerType: body.taxpayerType ?? null,
          stateCode: body.stateCode,
          state: body.state ?? null,
          effectiveFrom: body.effectiveFrom ?? null,
          effectiveTo: body.effectiveTo ?? null,
          registeredAddressId: body.registeredAddressId ?? null,
          status: body.status,
          isPrimary,
        })
        .returning()
    })

    await writeAudit(access, "party", id, "GSTIN_ADDED", null, registration)

    return {
      gstRegistration: registration,
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.patch("/parties/:id/gst-registrations/:registrationId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id, registrationId } = partyGstRegistrationParamsSchema.parse(request.params)
    const before = await requireGstRegistration(access.business.id, id, registrationId)
    const body = compactObject(updatePartyGstRegistrationSchema.parse(request.body))

    const nextGstin = body.gstin ?? before.gstin
    const nextStateCode = body.stateCode ?? before.stateCode
    if (nextGstin.slice(0, 2) !== nextStateCode) {
      throw new HttpError(400, "State code must match the first two digits of GSTIN.")
    }
    if (body.gstin) {
      await assertGstinAvailable(access.business.id, body.gstin, registrationId)
    }
    const nextRegisteredAddressId =
      body.registeredAddressId === undefined ?
        before.registeredAddressId
      : body.registeredAddressId
    if (nextRegisteredAddressId) {
      await assertRegisteredAddressForGst(
        access.business.id,
        id,
        nextStateCode,
        nextRegisteredAddressId
      )
    }

    const [registration] = await db.transaction(async (tx) => {
      if (body.isPrimary) {
        await tx
          .update(partyGstRegistrations)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(partyGstRegistrations.partyId, id))
      }

      return tx
        .update(partyGstRegistrations)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(partyGstRegistrations.id, registrationId),
            eq(partyGstRegistrations.businessId, access.business.id),
            eq(partyGstRegistrations.partyId, id)
          )
        )
        .returning()
    })

    await writeAudit(access, "party", id, "GSTIN_UPDATED", before, registration)

    return {
      gstRegistration: registration,
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.delete("/parties/:id/gst-registrations/:registrationId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id, registrationId } = partyGstRegistrationParamsSchema.parse(request.params)
    const before = await requireGstRegistration(access.business.id, id, registrationId)

    await db
      .update(partyGstRegistrations)
      .set({ status: "archived", isPrimary: false, updatedAt: new Date() })
      .where(
        and(
          eq(partyGstRegistrations.id, registrationId),
          eq(partyGstRegistrations.businessId, access.business.id),
          eq(partyGstRegistrations.partyId, id)
        )
      )

    await writeAudit(access, "party", id, "GSTIN_UPDATED", before, {
      ...before,
      status: "archived",
      isPrimary: false,
    })

    return {
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.get("/parties/:id/addresses", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "view")
    const { id } = idParamsSchema.parse(request.params)
    await requireParty(access.business.id, id)

    return {
      addresses: await listAddresses(access.business.id, id),
    }
  })

  app.post("/parties/:id/addresses", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    await requireParty(access.business.id, id)
    const body = partyAddressSchema.parse(request.body)
    const isPrimary = body.isPrimary || (await listAddresses(access.business.id, id)).length === 0

    const [address] = await db.transaction(async (tx) => {
      if (isPrimary) {
        await tx
          .update(partyAddresses)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(partyAddresses.partyId, id))
      }

      return tx
        .insert(partyAddresses)
        .values({
          businessId: access.business.id,
          partyId: id,
          addressType: body.addressType,
          label: body.label ?? null,
          addressLine1: body.addressLine1 ?? null,
          addressLine2: body.addressLine2 ?? null,
          locality: body.locality ?? null,
          city: body.city ?? null,
          district: body.district ?? null,
          state: body.state ?? null,
          stateCode: body.stateCode ?? null,
          pincode: body.pincode ?? null,
          country: body.country,
          isPrimary,
          isActive: body.isActive,
        })
        .returning()
    })

    await writeAudit(access, "party", id, "ADDRESS_ADDED", null, address)

    return {
      address,
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.patch("/parties/:id/addresses/:addressId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id, addressId } = partyAddressParamsSchema.parse(request.params)
    const before = await requireAddress(access.business.id, id, addressId)
    const body = compactObject(updatePartyAddressSchema.parse(request.body))

    const [address] = await db.transaction(async (tx) => {
      if (body.isPrimary) {
        await tx
          .update(partyAddresses)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(partyAddresses.partyId, id))
      }

      return tx
        .update(partyAddresses)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(partyAddresses.id, addressId),
            eq(partyAddresses.businessId, access.business.id),
            eq(partyAddresses.partyId, id)
          )
        )
        .returning()
    })

    await writeAudit(access, "party", id, "ADDRESS_UPDATED", before, address)

    return {
      address,
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.delete("/parties/:id/addresses/:addressId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id, addressId } = partyAddressParamsSchema.parse(request.params)
    const before = await requireAddress(access.business.id, id, addressId)

    await db
      .update(partyAddresses)
      .set({ isActive: false, isPrimary: false, updatedAt: new Date() })
      .where(
        and(
          eq(partyAddresses.id, addressId),
          eq(partyAddresses.businessId, access.business.id),
          eq(partyAddresses.partyId, id)
        )
      )

    await writeAudit(access, "party", id, "ADDRESS_UPDATED", before, {
      ...before,
      isActive: false,
      isPrimary: false,
    })

    return {
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.get("/parties/:id/contacts", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "view")
    const { id } = idParamsSchema.parse(request.params)
    await requireParty(access.business.id, id)

    return {
      contacts: await listContacts(access.business.id, id),
    }
  })

  app.post("/parties/:id/contacts", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    await requireParty(access.business.id, id)
    const body = partyContactSchema.parse(request.body)
    const isPrimary = body.isPrimary || (await listContacts(access.business.id, id)).length === 0

    const [contact] = await db.transaction(async (tx) => {
      if (isPrimary) {
        await tx
          .update(partyContacts)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(partyContacts.partyId, id))
      }

      return tx
        .insert(partyContacts)
        .values({
          businessId: access.business.id,
          partyId: id,
          name: body.name,
          designation: body.designation ?? null,
          email: body.email ?? null,
          phone: body.phone ?? null,
          mobile: body.mobile ?? null,
          contactRole: body.contactRole ?? null,
          isPrimary,
          status: body.status,
        })
        .returning()
    })

    await writeAudit(access, "party", id, "CONTACT_ADDED", null, contact)

    return {
      contact,
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.patch("/parties/:id/contacts/:contactId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id, contactId } = partyContactParamsSchema.parse(request.params)
    const before = await requireContact(access.business.id, id, contactId)
    const body = compactObject(updatePartyContactSchema.parse(request.body))

    const [contact] = await db.transaction(async (tx) => {
      if (body.isPrimary) {
        await tx
          .update(partyContacts)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(partyContacts.partyId, id))
      }

      return tx
        .update(partyContacts)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(partyContacts.id, contactId),
            eq(partyContacts.businessId, access.business.id),
            eq(partyContacts.partyId, id)
          )
        )
        .returning()
    })

    await writeAudit(access, "party", id, "CONTACT_UPDATED", before, contact)

    return {
      contact,
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.delete("/parties/:id/contacts/:contactId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id, contactId } = partyContactParamsSchema.parse(request.params)
    const before = await requireContact(access.business.id, id, contactId)

    await db
      .update(partyContacts)
      .set({ status: "inactive", isPrimary: false, updatedAt: new Date() })
      .where(
        and(
          eq(partyContacts.id, contactId),
          eq(partyContacts.businessId, access.business.id),
          eq(partyContacts.partyId, id)
        )
      )

    await writeAudit(access, "party", id, "CONTACT_UPDATED", before, {
      ...before,
      status: "inactive",
      isPrimary: false,
    })

    return {
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.get("/parties/:id/bank-accounts", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "view")
    const { id } = idParamsSchema.parse(request.params)
    await requireParty(access.business.id, id)

    return {
      bankAccounts: await listBankAccounts(access.business.id, id),
    }
  })

  app.post("/parties/:id/bank-accounts", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    await requireParty(access.business.id, id)
    const body = partyBankAccountSchema.parse(request.body)
    const bankAccount = serializeBankAccountCreate(body)
    const isPrimary = body.isPrimary || (await listBankAccounts(access.business.id, id)).length === 0

    const [createdBankAccount] = await db.transaction(async (tx) => {
      if (isPrimary) {
        await tx
          .update(partyBankAccounts)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(partyBankAccounts.partyId, id))
      }

      return tx
        .insert(partyBankAccounts)
        .values({
          businessId: access.business.id,
          partyId: id,
          ...bankAccount,
          isPrimary,
        })
        .returning()
    })

    if (!createdBankAccount) {
      throw new HttpError(500, "Unable to create bank account.")
    }

    await writeAudit(access, "party", id, "BANK_ACCOUNT_ADDED", null, {
      ...createdBankAccount,
      accountNumberHash: Boolean(createdBankAccount?.accountNumberHash),
    })

    return {
      bankAccount: maskBankAccount(createdBankAccount),
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.patch("/parties/:id/bank-accounts/:bankAccountId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id, bankAccountId } = partyBankAccountParamsSchema.parse(request.params)
    const before = await requireBankAccount(access.business.id, id, bankAccountId)
    const body = compactObject(updatePartyBankAccountSchema.parse(request.body))
    const bankAccountUpdate = serializeBankAccountUpdate(body)

    const [updatedBankAccount] = await db.transaction(async (tx) => {
      if (body.isPrimary) {
        await tx
          .update(partyBankAccounts)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(partyBankAccounts.partyId, id))
      }

      return tx
        .update(partyBankAccounts)
        .set({
          ...bankAccountUpdate,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(partyBankAccounts.id, bankAccountId),
            eq(partyBankAccounts.businessId, access.business.id),
            eq(partyBankAccounts.partyId, id)
          )
        )
        .returning()
    })

    if (!updatedBankAccount) {
      throw new HttpError(500, "Unable to update bank account.")
    }

    await writeAudit(access, "party", id, "BANK_ACCOUNT_UPDATED", before, {
      ...updatedBankAccount,
      accountNumberHash: Boolean(updatedBankAccount?.accountNumberHash),
    })

    return {
      bankAccount: maskBankAccount(updatedBankAccount),
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.delete("/parties/:id/bank-accounts/:bankAccountId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id, bankAccountId } = partyBankAccountParamsSchema.parse(request.params)
    const before = await requireBankAccount(access.business.id, id, bankAccountId)

    await db
      .update(partyBankAccounts)
      .set({ status: "archived", isPrimary: false, updatedAt: new Date() })
      .where(
        and(
          eq(partyBankAccounts.id, bankAccountId),
          eq(partyBankAccounts.businessId, access.business.id),
          eq(partyBankAccounts.partyId, id)
        )
      )

    await writeAudit(access, "party", id, "BANK_ACCOUNT_UPDATED", before, {
      ...before,
      status: "archived",
      isPrimary: false,
    })

    return {
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.get("/parties/:id/documents", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "view")
    const { id } = idParamsSchema.parse(request.params)
    await requireParty(access.business.id, id)

    return {
      documents: await listDocuments(access.business.id, id),
    }
  })

  app.post("/parties/:id/documents", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    await requireParty(access.business.id, id)
    const body = partyDocumentSchema.parse(request.body)

    const [document] = await db
      .insert(partyDocuments)
      .values({
        businessId: access.business.id,
        partyId: id,
        documentType: body.documentType,
        title: body.title,
        fileReference: body.fileReference,
        fileName: body.fileName ?? null,
        mimeType: body.mimeType ?? null,
        fileSizeBytes: body.fileSizeBytes ?? null,
        notes: body.notes ?? null,
        status: body.status,
        uploadedBy: access.userId,
      })
      .returning()

    if (!document) {
      throw new HttpError(500, "Unable to save party document.")
    }

    await writeAudit(access, "party", id, "DOCUMENT_ADDED", null, document)

    return {
      document,
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.patch("/parties/:id/documents/:documentId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id, documentId } = partyDocumentParamsSchema.parse(request.params)
    const before = await requireDocument(access.business.id, id, documentId)
    const body = compactObject(updatePartyDocumentSchema.parse(request.body))

    const [document] = await db
      .update(partyDocuments)
      .set({
        ...body,
        archivedAt: body.status === "archived" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(partyDocuments.id, documentId),
          eq(partyDocuments.businessId, access.business.id),
          eq(partyDocuments.partyId, id)
        )
      )
      .returning()

    if (!document) {
      throw new HttpError(500, "Unable to update party document.")
    }

    await writeAudit(access, "party", id, "DOCUMENT_UPDATED", before, document)

    return {
      document,
      party: await getPartyDetail(access.business.id, id),
    }
  })

  app.delete("/parties/:id/documents/:documentId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseParties(access, "edit")
    const { id, documentId } = partyDocumentParamsSchema.parse(request.params)
    const before = await requireDocument(access.business.id, id, documentId)

    const [document] = await db
      .update(partyDocuments)
      .set({
        status: "archived",
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(partyDocuments.id, documentId),
          eq(partyDocuments.businessId, access.business.id),
          eq(partyDocuments.partyId, id)
        )
      )
      .returning()

    await writeAudit(access, "party", id, "DOCUMENT_ARCHIVED", before, document)

    return {
      document,
      party: await getPartyDetail(access.business.id, id),
    }
  })
}

async function getPartyDetail(businessId: string, partyId: string) {
  const party = await requireParty(businessId, partyId)
  const [customerProfile, supplierProfile] = await Promise.all([
    db.query.partyCustomerProfiles.findFirst({
      where: and(
        eq(partyCustomerProfiles.businessId, businessId),
        eq(partyCustomerProfiles.partyId, partyId)
      ),
    }),
    db.query.partySupplierProfiles.findFirst({
      where: and(
        eq(partySupplierProfiles.businessId, businessId),
        eq(partySupplierProfiles.partyId, partyId)
      ),
    }),
  ])
  const [gstRegistrations, addresses, contacts, bankAccounts, outstandingSummary] = await Promise.all([
    listGstRegistrations(businessId, partyId),
    listAddresses(businessId, partyId),
    listContacts(businessId, partyId),
    listBankAccounts(businessId, partyId),
    getPartyOutstandingSummary(businessId, partyId),
  ])

  return {
    ...party,
    roles: resolveRoles(customerProfile ?? null, supplierProfile ?? null),
    customerCode: customerProfile?.customerCode ?? null,
    supplierCode: supplierProfile?.supplierCode ?? null,
    primaryGstRegistration: selectPrimary(gstRegistrations),
    primaryContact: selectPrimary(contacts),
    customerProfile: customerProfile ?? null,
    supplierProfile: supplierProfile ?? null,
    gstRegistrations,
    addresses,
    contacts,
    bankAccounts,
    outstandingSummary,
  }
}

async function getPartyOutstandingSummary(businessId: string, partyId: string) {
  const rows = await db
    .select({
      entryType: receivablePayableEntries.entryType,
      outstandingAmount: receivablePayableEntries.outstandingAmount,
      dueDate: receivablePayableEntries.dueDate,
      status: receivablePayableEntries.status,
    })
    .from(receivablePayableEntries)
    .where(
      and(
        eq(receivablePayableEntries.businessId, businessId),
        eq(receivablePayableEntries.partyId, partyId)
      )
    )

  const today = new Date().toISOString().slice(0, 10)
  const summary = {
    receivable: 0,
    payable: 0,
    overdueReceivable: 0,
    overduePayable: 0,
    openReceivableCount: 0,
    openPayableCount: 0,
  }

  for (const row of rows) {
    const amount = Number(row.outstandingAmount)
    const isClosed = ["closed", "settled", "cancelled"].includes(row.status)

    if (!Number.isFinite(amount) || amount <= 0 || isClosed) {
      continue
    }

    const isOverdue = Boolean(row.dueDate && row.dueDate < today)

    if (row.entryType === "receivable") {
      summary.receivable += amount
      summary.openReceivableCount += 1
      if (isOverdue) {
        summary.overdueReceivable += amount
      }
    }

    if (row.entryType === "payable") {
      summary.payable += amount
      summary.openPayableCount += 1
      if (isOverdue) {
        summary.overduePayable += amount
      }
    }
  }

  return {
    receivable: formatMoney(summary.receivable),
    payable: formatMoney(summary.payable),
    overdueReceivable: formatMoney(summary.overdueReceivable),
    overduePayable: formatMoney(summary.overduePayable),
    openReceivableCount: summary.openReceivableCount,
    openPayableCount: summary.openPayableCount,
  }
}

async function getPartyLedger(
  businessId: string,
  partyId: string,
  query: {
    entryType: "all" | "receivable" | "payable"
    status: "all" | "open" | "partially_settled" | "settled" | "closed" | "cancelled"
    limit: number
  }
) {
  const conditions: SQL[] = [
    eq(receivablePayableEntries.businessId, businessId),
    eq(receivablePayableEntries.partyId, partyId),
  ]

  if (query.entryType !== "all") {
    conditions.push(eq(receivablePayableEntries.entryType, query.entryType))
  }

  if (query.status !== "all") {
    conditions.push(eq(receivablePayableEntries.status, query.status))
  }

  const rows = await db
    .select({
      id: receivablePayableEntries.id,
      entryType: receivablePayableEntries.entryType,
      originalAmount: receivablePayableEntries.originalAmount,
      settledAmount: receivablePayableEntries.settledAmount,
      outstandingAmount: receivablePayableEntries.outstandingAmount,
      dueDate: receivablePayableEntries.dueDate,
      status: receivablePayableEntries.status,
      createdAt: receivablePayableEntries.createdAt,
      voucherId: receivablePayableEntries.voucherId,
      voucherType: vouchers.voucherType,
      voucherNumber: vouchers.voucherNumber,
      voucherDate: vouchers.voucherDate,
    })
    .from(receivablePayableEntries)
    .leftJoin(
      vouchers,
      and(
        eq(vouchers.id, receivablePayableEntries.voucherId),
        eq(vouchers.businessId, businessId)
      )
    )
    .where(and(...conditions))
    .orderBy(desc(receivablePayableEntries.createdAt))
    .limit(query.limit)

  const totalRows = await db
    .select({
      entryType: receivablePayableEntries.entryType,
      originalAmount: receivablePayableEntries.originalAmount,
      settledAmount: receivablePayableEntries.settledAmount,
      outstandingAmount: receivablePayableEntries.outstandingAmount,
    })
    .from(receivablePayableEntries)
    .where(and(...conditions))

  const totals = {
    receivableOriginal: 0,
    receivableSettled: 0,
    receivableOutstanding: 0,
    payableOriginal: 0,
    payableSettled: 0,
    payableOutstanding: 0,
  }

  for (const row of totalRows) {
    const originalAmount = Number(row.originalAmount)
    const settledAmount = Number(row.settledAmount)
    const outstandingAmount = Number(row.outstandingAmount)
    const isReceivable = row.entryType === "receivable"

    if (isReceivable) {
      totals.receivableOriginal += originalAmount
      totals.receivableSettled += settledAmount
      totals.receivableOutstanding += outstandingAmount
    } else {
      totals.payableOriginal += originalAmount
      totals.payableSettled += settledAmount
      totals.payableOutstanding += outstandingAmount
    }
  }

  const entries = rows.map((row) => {
    return {
      id: row.id,
      entryType: row.entryType,
      originalAmount: row.originalAmount,
      settledAmount: row.settledAmount,
      outstandingAmount: row.outstandingAmount,
      dueDate: row.dueDate,
      status: row.status,
      createdAt: row.createdAt,
      voucherId: row.voucherId,
      voucherType: row.voucherType,
      voucherNumber: row.voucherNumber,
      voucherDate: row.voucherDate,
    }
  })

  return {
    entries,
    totals: {
      receivableOriginal: formatMoney(totals.receivableOriginal),
      receivableSettled: formatMoney(totals.receivableSettled),
      receivableOutstanding: formatMoney(totals.receivableOutstanding),
      payableOriginal: formatMoney(totals.payableOriginal),
      payableSettled: formatMoney(totals.payableSettled),
      payableOutstanding: formatMoney(totals.payableOutstanding),
      netOutstanding: formatMoney(
        totals.receivableOutstanding - totals.payableOutstanding
      ),
    },
  }
}

async function getPartyAuditTimeline(
  businessId: string,
  partyId: string,
  query: { page: number; limit: number }
) {
  const where = and(
    eq(auditLogs.businessId, businessId),
    eq(auditLogs.entityType, "party"),
    eq(auditLogs.entityId, partyId)
  )
  const offset = (query.page - 1) * query.limit
  const [countRow] = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(auditLogs)
    .where(where)

  const rows = await db
    .select({
      id: auditLogs.id,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      action: auditLogs.action,
      before: auditLogs.before,
      after: auditLogs.after,
      reason: auditLogs.reason,
      createdAt: auditLogs.createdAt,
      actorId: users.id,
      actorName: users.fullName,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(query.limit)
    .offset(offset)

  return {
    audit: rows.map((row) => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      before: row.before,
      after: row.after,
      reason: row.reason,
      createdAt: row.createdAt,
      actor: row.actorId
        ? {
            id: row.actorId,
            name: row.actorName,
            email: row.actorEmail,
          }
        : null,
    })),
    pagination: createPaginationMeta(query.page, query.limit, Number(countRow?.count ?? 0)),
  }
}

async function findPartyDuplicateSuggestions(
  businessId: string,
  query: {
    displayName?: string
    legalName?: string
    tradeName?: string
    pan?: string
    gstin?: string
    email?: string
    mobile?: string
    excludePartyId?: string
    limit: number
  }
) {
  const input = {
    names: [query.displayName, query.legalName, query.tradeName]
      .map((value) => normalizeNameForMatch(value ?? ""))
      .filter(Boolean),
    pan: normalizeComparable(query.pan ?? ""),
    gstin: normalizeComparable(query.gstin ?? ""),
    email: normalizeEmail(query.email ?? ""),
    mobile: normalizeDigits(query.mobile ?? ""),
  }

  if (
    input.names.length === 0 &&
    !input.pan &&
    !input.gstin &&
    !input.email &&
    !input.mobile
  ) {
    return []
  }

  const partyRows = (
    await db
      .select()
      .from(parties)
      .where(eq(parties.businessId, businessId))
      .orderBy(desc(parties.updatedAt))
      .limit(500)
  ).filter((party) => party.id !== query.excludePartyId)

  if (partyRows.length === 0) {
    return []
  }

  const partyIds = partyRows.map((party) => party.id)
  const [gstRows, contactRows, summaries] = await Promise.all([
    db
      .select()
      .from(partyGstRegistrations)
      .where(
        and(
          eq(partyGstRegistrations.businessId, businessId),
          inArray(partyGstRegistrations.partyId, partyIds)
        )
      ),
    db
      .select()
      .from(partyContacts)
      .where(
        and(eq(partyContacts.businessId, businessId), inArray(partyContacts.partyId, partyIds))
      ),
    buildPartySummaries(businessId, partyRows),
  ])

  return partyRows
    .map((party) => {
      const reasons: Array<{
        field: string
        label: string
        confidence: "high" | "medium"
      }> = []
      const partyGstins = gstRows
        .filter((row) => row.partyId === party.id)
        .map((row) => normalizeComparable(row.gstin))
      const partyContacts = contactRows.filter((row) => row.partyId === party.id)
      const partyEmails = partyContacts.map((row) => normalizeEmail(row.email ?? ""))
      const partyMobiles = partyContacts.map((row) => normalizeDigits(row.mobile ?? ""))
      const partyNames = [party.displayName, party.legalName, party.tradeName, party.shortName]
        .map((value) => normalizeNameForMatch(value ?? ""))
        .filter(Boolean)

      let score = 0

      if (input.gstin && partyGstins.includes(input.gstin)) {
        score = Math.max(score, 100)
        reasons.push({
          field: "gstin",
          label: "Same GSTIN",
          confidence: "high",
        })
      }

      if (input.pan && normalizeComparable(party.pan ?? "") === input.pan) {
        score = Math.max(score, 95)
        reasons.push({
          field: "pan",
          label: "Same PAN",
          confidence: "high",
        })
      }

      if (input.email && partyEmails.includes(input.email)) {
        score = Math.max(score, 90)
        reasons.push({
          field: "email",
          label: "Same email",
          confidence: "high",
        })
      }

      if (input.mobile && partyMobiles.includes(input.mobile)) {
        score = Math.max(score, 90)
        reasons.push({
          field: "mobile",
          label: "Same mobile",
          confidence: "high",
        })
      }

      const nameScore = getBestNameMatchScore(input.names, partyNames)
      if (nameScore >= 70) {
        score = Math.max(score, nameScore)
        reasons.push({
          field: "name",
          label: nameScore >= 85 ? "Very similar name" : "Similar name",
          confidence: nameScore >= 85 ? "high" : "medium",
        })
      }

      return {
        party: summaries.find((summary) => summary.id === party.id) ?? null,
        score,
        reasons,
      }
    })
    .filter((suggestion) => suggestion.party && suggestion.score >= 70)
    .sort((left, right) => right.score - left.score)
    .slice(0, query.limit)
}

async function buildPartySummaries(businessId: string, partyRows: PartyRecord[]) {
  if (partyRows.length === 0) {
    return []
  }

  const partyIds = partyRows.map((party) => party.id)
  const [customerProfiles, supplierProfiles, gstRegistrations, contacts] =
    await Promise.all([
      db
        .select()
        .from(partyCustomerProfiles)
        .where(inArray(partyCustomerProfiles.partyId, partyIds)),
      db
        .select()
        .from(partySupplierProfiles)
        .where(inArray(partySupplierProfiles.partyId, partyIds)),
      db
        .select()
        .from(partyGstRegistrations)
        .where(
          and(
            eq(partyGstRegistrations.businessId, businessId),
            inArray(partyGstRegistrations.partyId, partyIds)
          )
        ),
      db
        .select()
        .from(partyContacts)
        .where(
          and(eq(partyContacts.businessId, businessId), inArray(partyContacts.partyId, partyIds))
        ),
    ])

  return partyRows.map((party) => {
    const customerProfile = customerProfiles.find((profile) => profile.partyId === party.id) ?? null
    const supplierProfile = supplierProfiles.find((profile) => profile.partyId === party.id) ?? null
    const partyGst = gstRegistrations.filter((registration) => registration.partyId === party.id)
    const partyContacts = contacts.filter((contact) => contact.partyId === party.id)

    return {
      id: party.id,
      partyType: party.partyType,
      displayName: party.displayName,
      legalName: party.legalName,
      tradeName: party.tradeName,
      shortName: party.shortName,
      pan: party.pan,
      profileImageSeed: party.profileImageSeed,
      status: party.status,
      roles: resolveRoles(customerProfile, supplierProfile),
      customerCode: customerProfile?.customerCode ?? null,
      supplierCode: supplierProfile?.supplierCode ?? null,
      primaryGstRegistration: selectPrimary(partyGst),
      primaryContact: selectPrimary(partyContacts),
      createdAt: party.createdAt,
      updatedAt: party.updatedAt,
    }
  })
}

async function findPartyIdsByRole(businessId: string, role: "customer" | "supplier") {
  if (role === "customer") {
    const rows = await db
      .select({ partyId: partyCustomerProfiles.partyId })
      .from(partyCustomerProfiles)
      .where(
        and(
          eq(partyCustomerProfiles.businessId, businessId),
          inArray(partyCustomerProfiles.status, ["active", "blocked"])
        )
      )

    return rows.map((row) => row.partyId)
  }

  const rows = await db
    .select({ partyId: partySupplierProfiles.partyId })
    .from(partySupplierProfiles)
    .where(
      and(
        eq(partySupplierProfiles.businessId, businessId),
        inArray(partySupplierProfiles.status, ["active", "blocked"])
      )
    )

  return rows.map((row) => row.partyId)
}

async function reconcilePartyRoles(
  access: BusinessAccess,
  partyId: string,
  roles: ("customer" | "supplier")[]
) {
  const wantsCustomer = roles.includes("customer")
  const wantsSupplier = roles.includes("supplier")
  const [customerProfile, supplierProfile] = await Promise.all([
    db.query.partyCustomerProfiles.findFirst({
      where: and(
        eq(partyCustomerProfiles.businessId, access.business.id),
        eq(partyCustomerProfiles.partyId, partyId)
      ),
    }),
    db.query.partySupplierProfiles.findFirst({
      where: and(
        eq(partySupplierProfiles.businessId, access.business.id),
        eq(partySupplierProfiles.partyId, partyId)
      ),
    }),
  ])

  if (wantsCustomer && !customerProfile) {
    await db.insert(partyCustomerProfiles).values({
      businessId: access.business.id,
      partyId,
      customerCode: await allocateCustomerCode(access.business.id),
      creditLimit: "0.00",
      creditDays: 0,
      defaultPaymentTermId: null,
      defaultBillingAddressId: null,
      defaultShippingAddressId: null,
      defaultGstRegistrationId: null,
      priceGroupId: null,
      salesRepId: null,
      status: "active",
    })
  }

  if (wantsCustomer && customerProfile && customerProfile.status !== "active") {
    await db
      .update(partyCustomerProfiles)
      .set({ status: "active", updatedAt: new Date() })
      .where(
        and(
          eq(partyCustomerProfiles.businessId, access.business.id),
          eq(partyCustomerProfiles.partyId, partyId)
        )
      )
  }

  if (!wantsCustomer && customerProfile) {
    await db
      .update(partyCustomerProfiles)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(
        and(
          eq(partyCustomerProfiles.businessId, access.business.id),
          eq(partyCustomerProfiles.partyId, partyId)
        )
      )
  }

  if (wantsSupplier && !supplierProfile) {
    await db.insert(partySupplierProfiles).values({
      businessId: access.business.id,
      partyId,
      supplierCode: await allocateSupplierCode(access.business.id),
      creditDays: 0,
      defaultPaymentTermId: null,
      defaultPurchaseAddressId: null,
      defaultGstRegistrationId: null,
      preferredWarehouseId: null,
      leadTimeDays: 0,
      status: "active",
    })
  }

  if (wantsSupplier && supplierProfile && supplierProfile.status !== "active") {
    await db
      .update(partySupplierProfiles)
      .set({ status: "active", updatedAt: new Date() })
      .where(
        and(
          eq(partySupplierProfiles.businessId, access.business.id),
          eq(partySupplierProfiles.partyId, partyId)
        )
      )
  }

  if (!wantsSupplier && supplierProfile) {
    await db
      .update(partySupplierProfiles)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(
        and(
          eq(partySupplierProfiles.businessId, access.business.id),
          eq(partySupplierProfiles.partyId, partyId)
        )
      )
  }
}

async function findPartyIdsBySearch(businessId: string, search: string) {
  const term = `%${escapeLikeTerm(search)}%`
  const [customerRows, supplierRows, gstRows, contactRows] = await Promise.all([
    db
      .select({ partyId: partyCustomerProfiles.partyId })
      .from(partyCustomerProfiles)
      .where(
        and(
          eq(partyCustomerProfiles.businessId, businessId),
          ilike(partyCustomerProfiles.customerCode, term)
        )
      ),
    db
      .select({ partyId: partySupplierProfiles.partyId })
      .from(partySupplierProfiles)
      .where(
        and(
          eq(partySupplierProfiles.businessId, businessId),
          ilike(partySupplierProfiles.supplierCode, term)
        )
      ),
    db
      .select({ partyId: partyGstRegistrations.partyId })
      .from(partyGstRegistrations)
      .where(
        and(
          eq(partyGstRegistrations.businessId, businessId),
          ilike(partyGstRegistrations.gstin, term)
        )
      ),
    db
      .select({ partyId: partyContacts.partyId })
      .from(partyContacts)
      .where(
        and(
          eq(partyContacts.businessId, businessId),
          or(
            ilike(partyContacts.name, term),
            ilike(partyContacts.email, term),
            ilike(partyContacts.mobile, term),
            ilike(partyContacts.phone, term)
          )
        )
      ),
  ])

  return Array.from(
    new Set([
      ...customerRows.map((row) => row.partyId),
      ...supplierRows.map((row) => row.partyId),
      ...gstRows.map((row) => row.partyId),
      ...contactRows.map((row) => row.partyId),
    ])
  )
}

async function requireParty(businessId: string, partyId: string) {
  const party = await db.query.parties.findFirst({
    where: and(eq(parties.businessId, businessId), eq(parties.id, partyId)),
  })

  if (!party) {
    throw new HttpError(404, "Party not found.")
  }

  return party
}

async function requireCustomerProfile(businessId: string, partyId: string) {
  const profile = await db.query.partyCustomerProfiles.findFirst({
    where: and(
      eq(partyCustomerProfiles.businessId, businessId),
      eq(partyCustomerProfiles.partyId, partyId)
    ),
  })

  if (!profile) {
    throw new HttpError(404, "Customer profile not found.")
  }

  return profile
}

async function requireSupplierProfile(businessId: string, partyId: string) {
  const profile = await db.query.partySupplierProfiles.findFirst({
    where: and(
      eq(partySupplierProfiles.businessId, businessId),
      eq(partySupplierProfiles.partyId, partyId)
    ),
  })

  if (!profile) {
    throw new HttpError(404, "Supplier profile not found.")
  }

  return profile
}

async function requireGstRegistration(
  businessId: string,
  partyId: string,
  registrationId: string
) {
  const registration = await db.query.partyGstRegistrations.findFirst({
    where: and(
      eq(partyGstRegistrations.businessId, businessId),
      eq(partyGstRegistrations.partyId, partyId),
      eq(partyGstRegistrations.id, registrationId)
    ),
  })

  if (!registration) {
    throw new HttpError(404, "GST registration not found.")
  }

  return registration
}

async function requireAddress(businessId: string, partyId: string, addressId: string) {
  const address = await db.query.partyAddresses.findFirst({
    where: and(
      eq(partyAddresses.businessId, businessId),
      eq(partyAddresses.partyId, partyId),
      eq(partyAddresses.id, addressId)
    ),
  })

  if (!address) {
    throw new HttpError(404, "Address not found.")
  }

  return address
}

async function assertRegisteredAddressForGst(
  businessId: string,
  partyId: string,
  gstStateCode: string,
  addressId: string
) {
  const address = await requireAddress(businessId, partyId, addressId)

  if (!address.isActive) {
    throw new HttpError(400, "Selected registered address is inactive.")
  }

  assertAddressStateMatchesGst(address.stateCode, gstStateCode)
}

function assertAddressStateMatchesGst(
  addressStateCode: string | null,
  gstStateCode: string
) {
  if (addressStateCode && addressStateCode !== gstStateCode) {
    throw new HttpError(400, "Registered address state must match the GSTIN state code.")
  }
}

async function requireContact(businessId: string, partyId: string, contactId: string) {
  const contact = await db.query.partyContacts.findFirst({
    where: and(
      eq(partyContacts.businessId, businessId),
      eq(partyContacts.partyId, partyId),
      eq(partyContacts.id, contactId)
    ),
  })

  if (!contact) {
    throw new HttpError(404, "Contact not found.")
  }

  return contact
}

async function requireBankAccount(
  businessId: string,
  partyId: string,
  bankAccountId: string
) {
  const bankAccount = await db.query.partyBankAccounts.findFirst({
    where: and(
      eq(partyBankAccounts.businessId, businessId),
      eq(partyBankAccounts.partyId, partyId),
      eq(partyBankAccounts.id, bankAccountId)
    ),
  })

  if (!bankAccount) {
    throw new HttpError(404, "Bank account not found.")
  }

  return bankAccount
}

async function requireDocument(businessId: string, partyId: string, documentId: string) {
  const document = await db.query.partyDocuments.findFirst({
    where: and(
      eq(partyDocuments.businessId, businessId),
      eq(partyDocuments.partyId, partyId),
      eq(partyDocuments.id, documentId)
    ),
  })

  if (!document) {
    throw new HttpError(404, "Party document not found.")
  }

  return document
}

async function listGstRegistrations(businessId: string, partyId: string) {
  return db
    .select()
    .from(partyGstRegistrations)
    .where(
      and(
        eq(partyGstRegistrations.businessId, businessId),
        eq(partyGstRegistrations.partyId, partyId)
      )
    )
    .orderBy(desc(partyGstRegistrations.isPrimary), desc(partyGstRegistrations.createdAt))
}

async function listAddresses(businessId: string, partyId: string) {
  return db
    .select()
    .from(partyAddresses)
    .where(
      and(eq(partyAddresses.businessId, businessId), eq(partyAddresses.partyId, partyId))
    )
    .orderBy(desc(partyAddresses.isPrimary), desc(partyAddresses.createdAt))
}

async function listContacts(businessId: string, partyId: string) {
  return db
    .select()
    .from(partyContacts)
    .where(
      and(eq(partyContacts.businessId, businessId), eq(partyContacts.partyId, partyId))
    )
    .orderBy(desc(partyContacts.isPrimary), desc(partyContacts.createdAt))
}

async function listBankAccounts(businessId: string, partyId: string) {
  const rows = await db
    .select()
    .from(partyBankAccounts)
    .where(
      and(
        eq(partyBankAccounts.businessId, businessId),
        eq(partyBankAccounts.partyId, partyId)
      )
    )
    .orderBy(desc(partyBankAccounts.isPrimary), desc(partyBankAccounts.createdAt))

  return rows.map(maskBankAccount)
}

async function listDocuments(businessId: string, partyId: string) {
  return db
    .select()
    .from(partyDocuments)
    .where(and(eq(partyDocuments.businessId, businessId), eq(partyDocuments.partyId, partyId)))
    .orderBy(desc(partyDocuments.createdAt))
}

async function assertCanUseParties(access: BusinessAccess, action: PartyAction) {
  if (access.membership.role === "owner" || access.membership.role === "admin") {
    return
  }

  if (action === "view") {
    return
  }

  const permissionColumn = {
    create: businessMemberPermissions.canCreate,
    edit: businessMemberPermissions.canEdit,
    delete: businessMemberPermissions.canDelete,
  }[action]

  const permission = await db.query.businessMemberPermissions.findFirst({
    where: and(
      eq(businessMemberPermissions.businessMemberId, access.membership.id),
      eq(businessMemberPermissions.module, "parties"),
      eq(permissionColumn, true)
    ),
  })

  if (!permission) {
    throw new HttpError(403, "You do not have permission to manage parties.")
  }
}

async function assertPartyCodesAvailable(
  businessId: string,
  customerProfile: { customerCode?: string } | undefined,
  supplierProfile: { supplierCode?: string } | undefined
) {
  if (customerProfile?.customerCode) {
    await assertCustomerCodeAvailable(businessId, customerProfile.customerCode)
  }

  if (supplierProfile?.supplierCode) {
    await assertSupplierCodeAvailable(businessId, supplierProfile.supplierCode)
  }
}

async function assertCustomerCodeAvailable(
  businessId: string,
  customerCode: string,
  currentPartyId?: string
) {
  const existing = await db.query.partyCustomerProfiles.findFirst({
    where: and(
      eq(partyCustomerProfiles.businessId, businessId),
      eq(partyCustomerProfiles.customerCode, customerCode)
    ),
  })

  if (existing && existing.partyId !== currentPartyId) {
    throw new HttpError(409, "Customer code is already used by another party.")
  }
}

async function assertSupplierCodeAvailable(
  businessId: string,
  supplierCode: string,
  currentPartyId?: string
) {
  const existing = await db.query.partySupplierProfiles.findFirst({
    where: and(
      eq(partySupplierProfiles.businessId, businessId),
      eq(partySupplierProfiles.supplierCode, supplierCode)
    ),
  })

  if (existing && existing.partyId !== currentPartyId) {
    throw new HttpError(409, "Supplier code is already used by another party.")
  }
}

async function assertGstinAvailable(
  businessId: string,
  gstin: string,
  currentRegistrationId?: string
) {
  const existing = await db.query.partyGstRegistrations.findFirst({
    where: and(
      eq(partyGstRegistrations.businessId, businessId),
      eq(partyGstRegistrations.gstin, gstin)
    ),
  })

  if (existing && existing.id !== currentRegistrationId) {
    throw new HttpError(409, "GSTIN is already used by another party.")
  }
}

async function assertCustomerProfileReferences(
  businessId: string,
  partyId: string,
  body: {
    defaultPaymentTermId?: string | null
    defaultBillingAddressId?: string | null
    defaultShippingAddressId?: string | null
    defaultGstRegistrationId?: string | null
  }
) {
  if (body.defaultPaymentTermId) {
    await requirePaymentTerm(businessId, body.defaultPaymentTermId)
  }

  if (body.defaultBillingAddressId) {
    await requireAddress(businessId, partyId, body.defaultBillingAddressId)
  }

  if (body.defaultShippingAddressId) {
    await requireAddress(businessId, partyId, body.defaultShippingAddressId)
  }

  if (body.defaultGstRegistrationId) {
    await requireGstRegistration(businessId, partyId, body.defaultGstRegistrationId)
  }
}

async function assertSupplierProfileReferences(
  businessId: string,
  partyId: string,
  body: {
    defaultPaymentTermId?: string | null
    defaultPurchaseAddressId?: string | null
    defaultGstRegistrationId?: string | null
    preferredWarehouseId?: string | null
  }
) {
  if (body.defaultPaymentTermId) {
    await requirePaymentTerm(businessId, body.defaultPaymentTermId)
  }

  if (body.defaultPurchaseAddressId) {
    await requireAddress(businessId, partyId, body.defaultPurchaseAddressId)
  }

  if (body.defaultGstRegistrationId) {
    await requireGstRegistration(businessId, partyId, body.defaultGstRegistrationId)
  }

  if (body.preferredWarehouseId) {
    await requireWarehouse(businessId, body.preferredWarehouseId)
  }
}

async function requirePaymentTerm(businessId: string, paymentTermId: string) {
  const paymentTerm = await db.query.paymentTerms.findFirst({
    where: and(eq(paymentTerms.businessId, businessId), eq(paymentTerms.id, paymentTermId)),
  })

  if (!paymentTerm) {
    throw new HttpError(404, "Payment term not found.")
  }

  return paymentTerm
}

async function requireWarehouse(businessId: string, warehouseId: string) {
  const warehouse = await db.query.warehouses.findFirst({
    where: and(eq(warehouses.businessId, businessId), eq(warehouses.id, warehouseId)),
  })

  if (!warehouse) {
    throw new HttpError(404, "Warehouse not found.")
  }

  return warehouse
}

async function allocateCustomerCode(businessId: string) {
  const [row] = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(partyCustomerProfiles)
    .where(eq(partyCustomerProfiles.businessId, businessId))

  return `CUS-${String(Number(row?.count ?? 0) + 1).padStart(6, "0")}`
}

async function allocateSupplierCode(businessId: string) {
  const [row] = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(partySupplierProfiles)
    .where(eq(partySupplierProfiles.businessId, businessId))

  return `SUP-${String(Number(row?.count ?? 0) + 1).padStart(6, "0")}`
}

async function writeAudit(
  access: BusinessAccess,
  entityType: string,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown
) {
  await db.insert(auditLogs).values({
    businessId: access.business.id,
    entityType,
    entityId,
    action,
    userId: access.userId,
    before: sanitizeAuditPayload(before),
    after: sanitizeAuditPayload(after),
    reason: null,
  })
}

function resolveRoles(
  customerProfile: PartyCustomerProfileRecord | null,
  supplierProfile: PartySupplierProfileRecord | null
) {
  return [
    isEnabledRoleProfile(customerProfile) ? "customer" : null,
    isEnabledRoleProfile(supplierProfile) ? "supplier" : null,
  ].filter((role): role is "customer" | "supplier" => Boolean(role))
}

function isEnabledRoleProfile(
  profile: PartyCustomerProfileRecord | PartySupplierProfileRecord | null
) {
  return Boolean(profile && !["inactive", "archived"].includes(profile.status))
}

function selectPrimary<T extends { isPrimary: boolean; createdAt: Date }>(rows: T[]) {
  return rows.find((row) => row.isPrimary) ?? rows[0] ?? null
}

function serializeBankAccountCreate(input: {
  bankName: string
  accountName?: string | null
  accountNumber?: string
  ifsc?: string | null
  branch?: string | null
  accountType?: string
  status: string
}) {
  const accountNumber = normalizeAccountNumber(input.accountNumber)

  return {
    bankName: input.bankName,
    accountName: input.accountName ?? null,
    accountNumberHash: accountNumber ? hashAccountNumber(accountNumber) : null,
    accountNumberLast4: accountNumber ? accountNumber.slice(-4) : null,
    ifsc: input.ifsc ?? null,
    branch: input.branch ?? null,
    accountType: input.accountType ?? null,
    status: input.status,
  }
}

function serializeBankAccountUpdate(input: {
  bankName?: string
  accountName?: string | null
  accountNumber?: string
  ifsc?: string | null
  branch?: string | null
  accountType?: string
  isPrimary?: boolean
  status?: string
}) {
  const accountNumber = normalizeAccountNumber(input.accountNumber)
  const update: Record<string, string | boolean | null | undefined> = {
    bankName: input.bankName,
    accountName: input.accountName,
    ifsc: input.ifsc,
    branch: input.branch,
    accountType: input.accountType,
    isPrimary: input.isPrimary,
    status: input.status,
  }

  if (accountNumber) {
    update.accountNumberHash = hashAccountNumber(accountNumber)
    update.accountNumberLast4 = accountNumber.slice(-4)
  }

  return compactObject(update)
}

function normalizeAccountNumber(accountNumber: string | undefined) {
  return accountNumber?.replace(/\s+/g, "") || null
}

function hashAccountNumber(accountNumber: string) {
  return createHash("sha256").update(accountNumber).digest("hex")
}

function maskBankAccount<T extends { accountNumberHash: string | null; accountNumberLast4: string | null }>(
  bankAccount: T
) {
  return {
    ...bankAccount,
    accountNumberHash: undefined,
    accountNumberMasked: bankAccount.accountNumberLast4
      ? `****${bankAccount.accountNumberLast4}`
      : null,
  }
}

function sanitizeAuditPayload(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "accountNumberHash" in value &&
    value.accountNumberHash
  ) {
    return {
      ...(value as Record<string, unknown>),
      accountNumberHash: true,
    }
  }

  return value
}

function normalizeComparable(value: string) {
  return value.trim().toUpperCase()
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "")
}

function normalizeNameForMatch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(private|limited|pvt|ltd|llp|company|co|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function getBestNameMatchScore(inputNames: string[], partyNames: string[]) {
  let bestScore = 0

  for (const inputName of inputNames) {
    for (const partyName of partyNames) {
      bestScore = Math.max(bestScore, getNameMatchScore(inputName, partyName))
    }
  }

  return bestScore
}

function getNameMatchScore(left: string, right: string) {
  if (!left || !right) {
    return 0
  }

  if (left === right) {
    return 95
  }

  if (left.length >= 5 && right.length >= 5 && (left.includes(right) || right.includes(left))) {
    return 82
  }

  const tokenScore = getTokenOverlapScore(left, right)
  const editScore = getEditSimilarityScore(left, right)

  return Math.max(tokenScore, editScore)
}

function getTokenOverlapScore(left: string, right: string) {
  const leftTokens = new Set(left.split(" ").filter((token) => token.length >= 2))
  const rightTokens = new Set(right.split(" ").filter((token) => token.length >= 2))

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0
  }

  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length
  const ratio = overlap / Math.max(leftTokens.size, rightTokens.size)

  if (ratio >= 0.8) {
    return 88
  }

  if (ratio >= 0.6) {
    return 76
  }

  return 0
}

function getEditSimilarityScore(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length)

  if (maxLength < 6) {
    return 0
  }

  const distance = getLevenshteinDistance(left, right)
  const similarity = 1 - distance / maxLength

  if (similarity >= 0.88) {
    return 86
  }

  if (similarity >= 0.78) {
    return 72
  }

  return 0
}

function getLevenshteinDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_value, index) => index)

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1]

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const cost = left[leftIndex] === right[rightIndex] ? 0 : 1
      current[rightIndex + 1] = Math.min(
        (current[rightIndex] ?? 0) + 1,
        (previous[rightIndex + 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + cost
      )
    }

    previous.splice(0, previous.length, ...current)
  }

  return previous[right.length] ?? 0
}

function normalizeMoney(value: string) {
  const [whole = "0", fraction = ""] = value.trim().split(".")
  return `${Number(whole)}.${fraction.padEnd(2, "0").slice(0, 2)}`
}

function formatMoney(value: number) {
  return value.toFixed(2)
}

function compactObject<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as T
}

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

type PartySummary = Awaited<ReturnType<typeof buildPartySummaries>>[number]

function sortPartySummaries(
  partySummaries: PartySummary[],
  sortBy: string,
  sortDir: "asc" | "desc"
) {
  const direction = sortDir === "asc" ? 1 : -1

  return [...partySummaries].sort((firstParty, secondParty) => {
    const firstValue = getPartySummarySortValue(firstParty, sortBy)
    const secondValue = getPartySummarySortValue(secondParty, sortBy)

    return (
      firstValue.localeCompare(secondValue, "en", {
        numeric: true,
        sensitivity: "base",
      }) * direction
    )
  })
}

function getPartySummarySortValue(party: PartySummary, sortBy: string) {
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
      return party.createdAt.toISOString()
    case "updatedAt":
      return party.updatedAt.toISOString()
    default:
      return party.updatedAt.toISOString()
  }
}

function paginateArray<T>(rows: T[], page: number, limit: number) {
  const offset = (page - 1) * limit
  const items = rows.slice(offset, offset + limit)

  return {
    items,
    pagination: createPaginationMeta(page, limit, rows.length),
  }
}

function createPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    hasMore: page * limit < total,
  }
}
