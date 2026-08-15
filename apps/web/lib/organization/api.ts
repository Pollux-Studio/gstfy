import { apiRequest } from "@/lib/api/client"

export type GstRegistrationRecord = {
  id: string
  businessId: string
  gstin: string
  legalName: string
  tradeName: string
  taxpayerType: string | null
  registrationType: string
  stateCode: string
  state: string | null
  registrationDate: string | null
  effectiveFrom: string | null
  effectiveTo: string | null
  status: string
  principalLocationId: string | null
}

export type BusinessLocationRecord = {
  id: string
  businessId: string
  name: string
  locationCode: string
  addressLine1: string | null
  addressLine2: string | null
  locality: string | null
  district: string | null
  city: string | null
  pincode: string | null
  stateCode: string | null
  state: string | null
  country: string
  status: string
  isPrincipalPlace: boolean
  isAdditionalPlace: boolean
  isSalesLocation: boolean
  isPurchaseLocation: boolean
  isDispatchLocation: boolean
  isWarehouseLocation: boolean
  isOffice: boolean
}

export type BusinessBranchRecord = {
  id: string
  businessId: string
  locationId: string
  gstRegistrationId: string | null
  branchCode: string
  name: string
  branchType: string
  managerName: string | null
  phone: string | null
  email: string | null
  openingDate: string | null
  status: string
  locationName?: string
  stateCode?: string | null
  gstin?: string | null
  warehouses?: Array<{
    warehouseId: string
    warehouseCode: string
    warehouseName: string
    warehouseType: string | null
    isDefault: boolean
  }>
}

export type WarehouseRecord = {
  id: string
  businessId: string
  locationId: string
  warehouseCode: string
  name: string
  warehouseType: string | null
  capacity: string | null
  managerName: string | null
  status: string
}

export type CreateLocationPayload = {
  name: string
  locationCode: string
  addressLine1?: string | null
  addressLine2?: string | null
  locality?: string | null
  district?: string | null
  city?: string | null
  pincode?: string | null
  stateCode?: string | null
  state?: string | null
  country?: string
  status?: "active" | "inactive" | "archived"
  isPrincipalPlace?: boolean
  isAdditionalPlace?: boolean
  isSalesLocation?: boolean
  isPurchaseLocation?: boolean
  isDispatchLocation?: boolean
  isWarehouseLocation?: boolean
  isOffice?: boolean
}

export type CreateBranchPayload = {
  name: string
  branchCode: string
  branchType?: string
  locationId: string
  gstRegistrationId: string
  managerName?: string
  phone?: string
  email?: string
  openingDate?: string
  status?: "active" | "closing" | "inactive" | "archived"
}

export type CreateWarehousePayload = {
  name: string
  warehouseCode: string
  locationId: string
  warehouseType?: "central" | "branch" | "distribution" | "transit" | "returns" | "damaged"
  capacity?: string
  managerName?: string
  status?: "active" | "inactive" | "archived"
}

export function getGstRegistrations(accessToken: string) {
  return apiRequest<{ gstRegistrations: GstRegistrationRecord[] }>(
    "/gst-registrations",
    {
      method: "GET",
      accessToken,
    }
  )
}

export function getLocations(accessToken: string) {
  return apiRequest<{ locations: BusinessLocationRecord[] }>("/locations", {
    method: "GET",
    accessToken,
  })
}

export function getBranches(accessToken: string) {
  return apiRequest<{ branches: BusinessBranchRecord[] }>("/branches", {
    method: "GET",
    accessToken,
  })
}

export function getWarehouses(accessToken: string) {
  return apiRequest<{ warehouses: WarehouseRecord[] }>("/warehouses", {
    method: "GET",
    accessToken,
  })
}

export function createLocation(payload: CreateLocationPayload, accessToken: string) {
  return apiRequest<{ location: BusinessLocationRecord }>("/locations", {
    method: "POST",
    body: payload,
    accessToken,
  })
}

export function createBranch(payload: CreateBranchPayload, accessToken: string) {
  return apiRequest<{ branch: BusinessBranchRecord }>("/branches", {
    method: "POST",
    body: payload,
    accessToken,
  })
}

export function createWarehouse(
  payload: CreateWarehousePayload,
  accessToken: string
) {
  return apiRequest<{ warehouse: WarehouseRecord }>("/warehouses", {
    method: "POST",
    body: payload,
    accessToken,
  })
}

export function updateBranchWarehouses(
  branchId: string,
  payload: { warehouseIds: string[]; defaultWarehouseId?: string | null },
  accessToken: string
) {
  return apiRequest<{ branch: BusinessBranchRecord }>(
    `/branches/${branchId}/warehouses`,
    {
      method: "PUT",
      body: payload,
      accessToken,
    }
  )
}

export function linkBranchWarehouse(
  branchId: string,
  payload: { warehouseId: string; isDefault?: boolean },
  accessToken: string
) {
  return apiRequest<{ branch: BusinessBranchRecord }>(
    `/branches/${branchId}/warehouses`,
    {
      method: "POST",
      body: payload,
      accessToken,
    }
  )
}

export function assignBranchUser(
  branchId: string,
  payload: { memberId: string; isPrimary?: boolean },
  accessToken: string
) {
  return apiRequest<{ branch: BusinessBranchRecord }>(
    `/branches/${branchId}/users`,
    {
      method: "POST",
      body: payload,
      accessToken,
    }
  )
}
