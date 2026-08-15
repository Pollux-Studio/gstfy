import { and, eq, inArray } from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { db } from "../../db/client.js"
import {
  branchWarehouses,
  businessBranches,
  businessLocations,
  businessMemberBranches,
  businessMembers,
  gstRegistrations,
  warehouses,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import {
  assertCanManageBusiness,
  requirePrimaryBusinessAccess,
} from "../businesses/business-access.js"
import {
  branchUserItemParamsSchema,
  branchUserParamsSchema,
  branchWarehouseItemParamsSchema,
  branchWarehouseParamsSchema,
  createBranchSchema,
  createBranchUserLinkSchema,
  createBranchWarehouseLinkSchema,
  createGstRegistrationSchema,
  createLocationSchema,
  createWarehouseSchema,
  idParamsSchema,
  updateBranchSchema,
  updateBranchWarehousesSchema,
  updateGstRegistrationSchema,
  updateLocationSchema,
  updateWarehouseSchema,
} from "./organization.schemas.js"

export async function registerOrganizationRoutes(app: FastifyInstance) {
  app.get("/gst-registrations", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)

    return {
      gstRegistrations: await db
        .select()
        .from(gstRegistrations)
        .where(eq(gstRegistrations.businessId, access.business.id)),
    }
  })

  app.post("/gst-registrations", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const body = createGstRegistrationSchema.parse(request.body)
    await assertLocationBelongsToBusiness(
      access.business.id,
      body.principalLocationId ?? null
    )

    const [registration] = await db
      .insert(gstRegistrations)
      .values({
        businessId: access.business.id,
        ...body,
        principalLocationId: body.principalLocationId ?? null,
      })
      .returning()

    return {
      gstRegistration: registration,
    }
  })

  app.patch("/gst-registrations/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const { id } = idParamsSchema.parse(request.params)
    await requireGstRegistration(access.business.id, id)

    const body = compactObject(updateGstRegistrationSchema.parse(request.body))
    if ("principalLocationId" in body) {
      await assertLocationBelongsToBusiness(
        access.business.id,
        body.principalLocationId ?? null
      )
    }

    const [registration] = await db
      .update(gstRegistrations)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(and(eq(gstRegistrations.id, id), eq(gstRegistrations.businessId, access.business.id)))
      .returning()

    return {
      gstRegistration: registration,
    }
  })

  app.delete("/gst-registrations/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const { id } = idParamsSchema.parse(request.params)
    await requireGstRegistration(access.business.id, id)

    await db
      .update(gstRegistrations)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(gstRegistrations.id, id), eq(gstRegistrations.businessId, access.business.id)))

    return { ok: true }
  })

  app.get("/locations", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)

    return {
      locations: await db
        .select()
        .from(businessLocations)
        .where(eq(businessLocations.businessId, access.business.id)),
    }
  })

  app.post("/locations", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const body = createLocationSchema.parse(request.body)
    const [location] = await db
      .insert(businessLocations)
      .values({
        businessId: access.business.id,
        ...body,
      })
      .returning()

    return {
      location,
    }
  })

  app.patch("/locations/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const { id } = idParamsSchema.parse(request.params)
    await requireLocation(access.business.id, id)

    const [location] = await db
      .update(businessLocations)
      .set({
        ...compactObject(updateLocationSchema.parse(request.body)),
        updatedAt: new Date(),
      })
      .where(and(eq(businessLocations.id, id), eq(businessLocations.businessId, access.business.id)))
      .returning()

    return {
      location,
    }
  })

  app.delete("/locations/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const { id } = idParamsSchema.parse(request.params)
    await requireLocation(access.business.id, id)

    await db
      .update(businessLocations)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(businessLocations.id, id), eq(businessLocations.businessId, access.business.id)))

    return { ok: true }
  })

  app.get("/branches", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)

    return {
      branches: await listBranches(access.business.id),
    }
  })

  app.get("/branches/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const { id } = idParamsSchema.parse(request.params)

    return {
      branch: await listBranch(access.business.id, id),
    }
  })

  app.post("/branches", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const body = createBranchSchema.parse(request.body)
    await requireLocation(access.business.id, body.locationId)
    await assertGstRegistrationBelongsToBusiness(
      access.business.id,
      body.gstRegistrationId ?? null
    )

    const [branch] = await db
      .insert(businessBranches)
      .values({
        businessId: access.business.id,
        ...body,
        email: body.email || null,
        openingDate: body.openingDate || null,
      })
      .returning()

    return {
      branch,
    }
  })

  app.patch("/branches/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const { id } = idParamsSchema.parse(request.params)
    await requireBranch(access.business.id, id)

    const body = compactObject(updateBranchSchema.parse(request.body))
    if (body.locationId) {
      await requireLocation(access.business.id, body.locationId)
    }
    if ("gstRegistrationId" in body) {
      await assertGstRegistrationBelongsToBusiness(
        access.business.id,
        body.gstRegistrationId ?? null
      )
    }

    const [branch] = await db
      .update(businessBranches)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(and(eq(businessBranches.id, id), eq(businessBranches.businessId, access.business.id)))
      .returning()

    return {
      branch,
    }
  })

  app.delete("/branches/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const { id } = idParamsSchema.parse(request.params)
    await requireBranch(access.business.id, id)

    await db
      .update(businessBranches)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(and(eq(businessBranches.id, id), eq(businessBranches.businessId, access.business.id)))

    return { ok: true }
  })

  app.get("/warehouses", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)

    return {
      warehouses: await db
        .select()
        .from(warehouses)
        .where(eq(warehouses.businessId, access.business.id)),
    }
  })

  app.get("/warehouses/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const { id } = idParamsSchema.parse(request.params)

    return {
      warehouse: await requireWarehouse(access.business.id, id),
    }
  })

  app.post("/warehouses", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const body = createWarehouseSchema.parse(request.body)
    await requireLocation(access.business.id, body.locationId)

    const [warehouse] = await db
      .insert(warehouses)
      .values({
        businessId: access.business.id,
        ...body,
      })
      .returning()

    return {
      warehouse,
    }
  })

  app.patch("/warehouses/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const { id } = idParamsSchema.parse(request.params)
    await requireWarehouse(access.business.id, id)

    const body = compactObject(updateWarehouseSchema.parse(request.body))
    if (body.locationId) {
      await requireLocation(access.business.id, body.locationId)
    }

    const [warehouse] = await db
      .update(warehouses)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(and(eq(warehouses.id, id), eq(warehouses.businessId, access.business.id)))
      .returning()

    return {
      warehouse,
    }
  })

  app.delete("/warehouses/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const { id } = idParamsSchema.parse(request.params)
    await requireWarehouse(access.business.id, id)

    await db
      .update(warehouses)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(and(eq(warehouses.id, id), eq(warehouses.businessId, access.business.id)))

    return { ok: true }
  })

  app.post("/branches/:branchId/warehouses", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const { branchId } = branchWarehouseParamsSchema.parse(request.params)
    const body = createBranchWarehouseLinkSchema.parse(request.body)
    await requireBranch(access.business.id, branchId)
    await requireWarehouse(access.business.id, body.warehouseId)

    await db.transaction(async (tx) => {
      if (body.isDefault) {
        await tx
          .update(branchWarehouses)
          .set({ isDefault: false })
          .where(eq(branchWarehouses.branchId, branchId))
      }

      await tx
        .insert(branchWarehouses)
        .values({
          branchId,
          warehouseId: body.warehouseId,
          isDefault: body.isDefault,
        })
        .onConflictDoUpdate({
          target: [branchWarehouses.branchId, branchWarehouses.warehouseId],
          set: {
            isDefault: body.isDefault,
          },
        })
    })

    return {
      branch: await listBranch(access.business.id, branchId),
    }
  })

  app.delete("/branches/:branchId/warehouses/:warehouseId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const { branchId, warehouseId } = branchWarehouseItemParamsSchema.parse(
      request.params
    )
    await requireBranch(access.business.id, branchId)
    await requireWarehouse(access.business.id, warehouseId)

    await db
      .delete(branchWarehouses)
      .where(
        and(
          eq(branchWarehouses.branchId, branchId),
          eq(branchWarehouses.warehouseId, warehouseId)
        )
      )

    return {
      branch: await listBranch(access.business.id, branchId),
    }
  })

  app.post("/branches/:branchId/users", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const { branchId } = branchUserParamsSchema.parse(request.params)
    const body = createBranchUserLinkSchema.parse(request.body)
    await requireBranch(access.business.id, branchId)
    await requireBusinessMember(access.business.id, body.memberId)

    await db.transaction(async (tx) => {
      if (body.isPrimary) {
        await tx
          .update(businessMemberBranches)
          .set({ isPrimary: false })
          .where(eq(businessMemberBranches.businessMemberId, body.memberId))
      }

      await tx
        .insert(businessMemberBranches)
        .values({
          businessMemberId: body.memberId,
          branchId,
          isPrimary: body.isPrimary,
        })
        .onConflictDoUpdate({
          target: [
            businessMemberBranches.businessMemberId,
            businessMemberBranches.branchId,
          ],
          set: {
            isPrimary: body.isPrimary,
          },
        })
    })

    return {
      branch: await listBranch(access.business.id, branchId),
    }
  })

  app.delete("/branches/:branchId/users/:memberId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const { branchId, memberId } = branchUserItemParamsSchema.parse(request.params)
    await requireBranch(access.business.id, branchId)
    await requireBusinessMember(access.business.id, memberId)

    await db
      .delete(businessMemberBranches)
      .where(
        and(
          eq(businessMemberBranches.branchId, branchId),
          eq(businessMemberBranches.businessMemberId, memberId)
        )
      )

    return {
      branch: await listBranch(access.business.id, branchId),
    }
  })

  app.put("/branches/:branchId/warehouses", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    assertCanManageBusiness(access.membership)

    const { branchId } = branchWarehouseParamsSchema.parse(request.params)
    const body = updateBranchWarehousesSchema.parse(request.body)
    await requireBranch(access.business.id, branchId)

    if (body.defaultWarehouseId && !body.warehouseIds.includes(body.defaultWarehouseId)) {
      throw new HttpError(400, "Default warehouse must be part of this branch.")
    }

    if (body.warehouseIds.length > 0) {
      const ownedWarehouses = await db
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(
          and(
            eq(warehouses.businessId, access.business.id),
            inArray(warehouses.id, body.warehouseIds)
          )
        )

      if (ownedWarehouses.length !== body.warehouseIds.length) {
        throw new HttpError(400, "One or more warehouses do not belong to this business.")
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(branchWarehouses).where(eq(branchWarehouses.branchId, branchId))

      if (body.warehouseIds.length > 0) {
        await tx.insert(branchWarehouses).values(
          body.warehouseIds.map((warehouseId) => ({
            branchId,
            warehouseId,
            isDefault: warehouseId === body.defaultWarehouseId,
          }))
        )
      }
    })

    return {
      branch: await listBranch(access.business.id, branchId),
    }
  })
}

async function listBranches(businessId: string) {
  return db
    .select({
      id: businessBranches.id,
      businessId: businessBranches.businessId,
      locationId: businessBranches.locationId,
      gstRegistrationId: businessBranches.gstRegistrationId,
      branchCode: businessBranches.branchCode,
      name: businessBranches.name,
      branchType: businessBranches.branchType,
      managerName: businessBranches.managerName,
      phone: businessBranches.phone,
      email: businessBranches.email,
      openingDate: businessBranches.openingDate,
      status: businessBranches.status,
      locationName: businessLocations.name,
      stateCode: businessLocations.stateCode,
      gstin: gstRegistrations.gstin,
      createdAt: businessBranches.createdAt,
      updatedAt: businessBranches.updatedAt,
    })
    .from(businessBranches)
    .innerJoin(businessLocations, eq(businessLocations.id, businessBranches.locationId))
    .leftJoin(gstRegistrations, eq(gstRegistrations.id, businessBranches.gstRegistrationId))
    .where(eq(businessBranches.businessId, businessId))
    .then((branches) => enrichBranchesWithWarehouses(branches))
}

async function listBranch(businessId: string, branchId: string) {
  const branches = await listBranches(businessId)
  const branch = branches.find((item) => item.id === branchId)

  if (!branch) {
    throw new HttpError(404, "Branch not found.")
  }

  return branch
}

async function requireLocation(businessId: string, locationId: string) {
  const location = await db.query.businessLocations.findFirst({
    where: and(
      eq(businessLocations.id, locationId),
      eq(businessLocations.businessId, businessId)
    ),
  })

  if (!location) {
    throw new HttpError(404, "Location not found.")
  }

  return location
}

async function requireGstRegistration(businessId: string, registrationId: string) {
  const registration = await db.query.gstRegistrations.findFirst({
    where: and(
      eq(gstRegistrations.id, registrationId),
      eq(gstRegistrations.businessId, businessId)
    ),
  })

  if (!registration) {
    throw new HttpError(404, "GST registration not found.")
  }

  return registration
}

async function requireBranch(businessId: string, branchId: string) {
  const branch = await db.query.businessBranches.findFirst({
    where: and(
      eq(businessBranches.id, branchId),
      eq(businessBranches.businessId, businessId)
    ),
  })

  if (!branch) {
    throw new HttpError(404, "Branch not found.")
  }

  return branch
}

async function requireWarehouse(businessId: string, warehouseId: string) {
  const warehouse = await db.query.warehouses.findFirst({
    where: and(eq(warehouses.id, warehouseId), eq(warehouses.businessId, businessId)),
  })

  if (!warehouse) {
    throw new HttpError(404, "Warehouse not found.")
  }

  return warehouse
}

async function requireBusinessMember(businessId: string, businessMemberId: string) {
  const member = await db.query.businessMembers.findFirst({
    where: and(
      eq(businessMembers.id, businessMemberId),
      eq(businessMembers.businessId, businessId)
    ),
  })

  if (!member) {
    throw new HttpError(404, "Business member not found.")
  }

  return member
}

async function enrichBranchesWithWarehouses<
  T extends Array<{
    id: string
  }>,
>(branches: T) {
  if (branches.length === 0) {
    return branches.map((branch) => ({
      ...branch,
      warehouses: [],
    }))
  }

  const warehouseLinks = await db
    .select({
      branchId: branchWarehouses.branchId,
      warehouseId: warehouses.id,
      warehouseCode: warehouses.warehouseCode,
      warehouseName: warehouses.name,
      warehouseType: warehouses.warehouseType,
      isDefault: branchWarehouses.isDefault,
    })
    .from(branchWarehouses)
    .innerJoin(warehouses, eq(warehouses.id, branchWarehouses.warehouseId))
    .where(
      inArray(
        branchWarehouses.branchId,
        branches.map((branch) => branch.id)
      )
    )

  return branches.map((branch) => ({
    ...branch,
    warehouses: warehouseLinks
      .filter((warehouse) => warehouse.branchId === branch.id)
      .map(({ branchId, ...warehouse }) => warehouse),
  }))
}

async function assertLocationBelongsToBusiness(
  businessId: string,
  locationId: string | null
) {
  if (!locationId) {
    return
  }

  await requireLocation(businessId, locationId)
}

async function assertGstRegistrationBelongsToBusiness(
  businessId: string,
  registrationId: string | null
) {
  if (!registrationId) {
    return
  }

  await requireGstRegistration(businessId, registrationId)
}

function compactObject<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as T
}
