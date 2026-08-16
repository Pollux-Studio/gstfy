import { apiRequest } from "@/lib/api/client"

export type ProductItemType = "GOODS" | "SERVICE"
export type ProductStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED"
export type Taxability =
  | "TAXABLE"
  | "EXEMPT"
  | "NIL_RATED"
  | "NON_GST"
  | "ZERO_RATED"
export type PriceType =
  | "RETAIL"
  | "WHOLESALE"
  | "DEALER"
  | "ONLINE"
  | "SPECIAL"
  | "PURCHASE"
export type TaxMode = "EXCLUSIVE" | "INCLUSIVE"

export type HsnSacCode = {
  id: string
  code: string
  codeType: "HSN" | "SAC"
  description: string
  status: string
}

export type UqcCode = {
  id: string
  code: string
  description: string
  status: string
}

export type ProductTaxProfile = {
  id: string
  itemId: string
  taxability: Taxability
  hsnSac: string | null
  gstRate: string
  cessRuleId: string | null
  effectiveFrom: string
  effectiveTo: string | null
  status: ProductStatus
}

export type ProductUnitProfile = {
  id: string
  itemId: string
  baseUnit: string
  secondaryUnit: string | null
  conversionFactor: string
  gstUqc: string | null
}

export type ProductPrice = {
  id: string
  itemId: string
  priceType: PriceType
  price: string
  taxMode: TaxMode
  currency: string
  minimumQuantity: string
  customerGroupId: string | null
  effectiveFrom: string
  effectiveTo: string | null
  status: ProductStatus
}

export type ProductBarcode = {
  id: string
  itemId: string
  barcode: string
  barcodeType: string | null
  isPrimary: boolean
  status: ProductStatus
}

export type ProductInventoryProfile = {
  itemId: string
  trackInventory: boolean
  defaultWarehouseId: string | null
  reorderLevel: string
  minimumStock: string
  maximumStock: string
  batchTracking: boolean
  serialTracking: boolean
}

export type ProductSupplier = {
  id: string
  itemId: string
  supplierId: string
  supplierName: string
  supplierItemCode: string | null
  purchasePrice: string | null
  minimumOrderQuantity: string
  leadTimeDays: number
  isPreferred: boolean
  effectiveFrom: string | null
  effectiveTo: string | null
  status: ProductStatus
}

export type ProductListItem = {
  id: string
  name: string
  itemType: ProductItemType
  sku: string
  description: string | null
  categoryId: string | null
  brandId: string | null
  manufacturer: string | null
  modelNumber: string | null
  status: ProductStatus
  activeTaxProfile: ProductTaxProfile | null
  unitProfile: ProductUnitProfile | null
  activePrice: ProductPrice | null
  primaryBarcode: ProductBarcode | null
  inventoryProfile: ProductInventoryProfile | null
  createdAt: string
  updatedAt: string
}

export type ProductDetail = ProductListItem & {
  taxProfiles: ProductTaxProfile[]
  units: ProductUnitProfile[]
  prices: ProductPrice[]
  suppliers: ProductSupplier[]
  barcodes: ProductBarcode[]
  inventoryProfile: ProductInventoryProfile | null
  accountingProfile: unknown | null
}

export type CreateProductPayload = {
  name: string
  itemType: ProductItemType
  sku: string
  description?: string | null
  manufacturer?: string | null
  modelNumber?: string | null
  status?: ProductStatus
  taxProfile?: {
    taxability: Taxability
    hsnSac?: string | null
    gstRate: string | number
    effectiveFrom: string
    effectiveTo?: string | null
    status?: ProductStatus
  }
  unitProfile?: {
    baseUnit: string
    secondaryUnit?: string | null
    conversionFactor: string | number
    gstUqc?: string | null
  }
  price?: {
    priceType: PriceType
    price: string | number
    taxMode: TaxMode
    currency?: string
    minimumQuantity?: string | number
    effectiveFrom: string
    effectiveTo?: string | null
    status?: ProductStatus
  }
  inventoryProfile?: {
    trackInventory: boolean
    reorderLevel?: string | number
    minimumStock?: string | number
    maximumStock?: string | number
    batchTracking?: boolean
    serialTracking?: boolean
  }
  barcodes?: Array<{
    barcode: string
    barcodeType?: string | null
    isPrimary?: boolean
    status?: ProductStatus
  }>
}

export type UpdateProductPayload = Partial<
  Pick<
    CreateProductPayload,
    "name" | "itemType" | "sku" | "description" | "manufacturer" | "modelNumber" | "status"
  >
>

export function listProductMasters(accessToken: string) {
  return apiRequest<{ hsnSacCodes: HsnSacCode[]; uqcCodes: UqcCode[] }>(
    "/products/masters",
    {
      method: "GET",
      accessToken,
    }
  )
}

export function listProducts(
  accessToken: string,
  filters: {
    search?: string
    itemType?: ProductItemType
    status?: ProductStatus
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
  return apiRequest<{ products: ProductListItem[] }>(`/products${query}`, {
    method: "GET",
    accessToken,
  })
}

export function getProduct(productId: string, accessToken: string) {
  return apiRequest<{ product: ProductDetail }>(`/products/${productId}`, {
    method: "GET",
    accessToken,
  })
}

export function createProduct(payload: CreateProductPayload, accessToken: string) {
  return apiRequest<{ product: ProductDetail }>("/products", {
    method: "POST",
    body: payload,
    accessToken,
  })
}

export function updateProduct(
  productId: string,
  payload: UpdateProductPayload,
  accessToken: string
) {
  return apiRequest<{ product: ProductDetail }>(`/products/${productId}`, {
    method: "PATCH",
    body: payload,
    accessToken,
  })
}

export function archiveProduct(productId: string, accessToken: string) {
  return apiRequest<{ product: ProductDetail }>(`/products/${productId}`, {
    method: "DELETE",
    accessToken,
  })
}
