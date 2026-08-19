import type {
  ProductItemType,
  ProductImage,
  ProductStatus,
  Taxability,
  TaxMode,
} from "@/lib/products/api"

export type SheetMode = "create" | "edit"

export type ProductFormState = {
  name: string
  itemType: ProductItemType
  sku: string
  description: string
  categoryId: string
  brandId: string
  manufacturer: string
  modelNumber: string
  status: ProductStatus
  images: ProductImage[]
  taxability: Taxability
  hsnSac: string
  gstRate: string
  cessRuleId: string
  effectiveFrom: string
  effectiveTo: string
  baseUnit: string
  gstUqc: string
  conversionFactor: string
  price: string
  marginPercent: string
  taxMode: TaxMode
  barcode: string
  trackInventory: boolean
  defaultWarehouseId: string
  reorderLevel: string
  minimumStock: string
  maximumStock: string
  batchTracking: boolean
  serialTracking: boolean
}

export type ProductFormErrors = Partial<Record<keyof ProductFormState, string>>
