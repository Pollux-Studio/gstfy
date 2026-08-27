import { apiRequest } from "@/lib/api/client";

export type ProductItemType = "GOODS" | "SERVICE";
export type ProductStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type Taxability =
  | "TAXABLE"
  | "EXEMPT"
  | "NIL_RATED"
  | "NON_GST"
  | "ZERO_RATED";
export type PriceType =
  | "RETAIL"
  | "WHOLESALE"
  | "DEALER"
  | "ONLINE"
  | "SPECIAL"
  | "PURCHASE";
export type TaxMode = "EXCLUSIVE" | "INCLUSIVE";

export type HsnSacCode = {
  id: string;
  code: string;
  codeType: "HSN" | "SAC";
  description: string;
  status: string;
};

export type HsnCodeSearchResult = {
  code: string;
  description: string;
  gstRate: string | null;
  source: "master" | "hsnlookup";
};

export type UqcCode = {
  id: string;
  code: string;
  description: string;
  status: string;
};

export type ProductMasterOption = {
  id: string;
  businessId: string;
  name: string;
  status: string;
};

export type ProductTaxProfile = {
  id: string;
  itemId: string;
  taxability: Taxability;
  hsnSac: string | null;
  gstRate: string;
  cessRuleId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: ProductStatus;
};

export type ProductUnitProfile = {
  id: string;
  itemId: string;
  baseUnit: string;
  secondaryUnit: string | null;
  conversionFactor: string;
  gstUqc: string | null;
};

export type ProductPrice = {
  id: string;
  itemId: string;
  priceType: PriceType;
  price: string;
  marginPercent: string;
  taxMode: TaxMode;
  currency: string;
  minimumQuantity: string;
  customerGroupId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: ProductStatus;
};

export type ProductBarcode = {
  id: string;
  itemId: string;
  barcode: string;
  barcodeType: string | null;
  isPrimary: boolean;
  status: ProductStatus;
};

export type ProductImage = {
  id: string;
  businessId: string;
  itemId: string | null;
  objectKey: string;
  publicUrl: string;
  fileName: string | null;
  contentType: string;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  isPrimary: boolean;
  sortOrder: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProductInventoryProfile = {
  itemId: string;
  trackInventory: boolean;
  defaultWarehouseId: string | null;
  reorderLevel: string;
  minimumStock: string;
  maximumStock: string;
  batchTracking: boolean;
  serialTracking: boolean;
};

export type ProductSupplier = {
  id: string;
  itemId: string;
  supplierId: string;
  supplierName: string;
  supplierItemCode: string | null;
  purchasePrice: string | null;
  minimumOrderQuantity: string;
  leadTimeDays: number;
  isPreferred: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  status: ProductStatus;
};

export type ProductListItem = {
  id: string;
  name: string;
  itemType: ProductItemType;
  sku: string;
  description: string | null;
  categoryId: string | null;
  brandId: string | null;
  manufacturer: string | null;
  modelNumber: string | null;
  status: ProductStatus;
  activeTaxProfile: ProductTaxProfile | null;
  unitProfile: ProductUnitProfile | null;
  activePrice: ProductPrice | null;
  primaryBarcode: ProductBarcode | null;
  images: ProductImage[];
  primaryImage: ProductImage | null;
  inventoryProfile: ProductInventoryProfile | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductDetail = ProductListItem & {
  taxProfiles: ProductTaxProfile[];
  units: ProductUnitProfile[];
  prices: ProductPrice[];
  suppliers: ProductSupplier[];
  barcodes: ProductBarcode[];
  images: ProductImage[];
  inventoryProfile: ProductInventoryProfile | null;
  accountingProfile: unknown | null;
};

export type CreateProductPayload = {
  name: string;
  itemType: ProductItemType;
  sku: string;
  description?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  manufacturer?: string | null;
  modelNumber?: string | null;
  status?: ProductStatus;
  imageIds?: string[];
  taxProfile?: {
    taxability: Taxability;
    hsnSac?: string | null;
    gstRate: string | number;
    cessRuleId?: string | null;
    effectiveFrom: string;
    effectiveTo?: string | null;
    status?: ProductStatus;
  };
  unitProfile?: {
    baseUnit: string;
    secondaryUnit?: string | null;
    conversionFactor: string | number;
    gstUqc?: string | null;
  };
  price?: {
    priceType: PriceType;
    price: string | number;
    marginPercent?: string | number;
    taxMode: TaxMode;
    currency?: string;
    minimumQuantity?: string | number;
    effectiveFrom: string;
    effectiveTo?: string | null;
    status?: ProductStatus;
  };
  inventoryProfile?: {
    trackInventory: boolean;
    defaultWarehouseId?: string | null;
    reorderLevel?: string | number;
    minimumStock?: string | number;
    maximumStock?: string | number;
    batchTracking?: boolean;
    serialTracking?: boolean;
  };
  barcodes?: Array<{
    barcode: string;
    barcodeType?: string | null;
    isPrimary?: boolean;
    status?: ProductStatus;
  }>;
};

export type ProductTaxProfilePayload = NonNullable<
  CreateProductPayload["taxProfile"]
>;
export type ProductUnitProfilePayload = NonNullable<
  CreateProductPayload["unitProfile"]
>;
export type ProductPricePayload = NonNullable<CreateProductPayload["price"]>;
export type ProductInventoryProfilePayload = NonNullable<
  CreateProductPayload["inventoryProfile"]
>;
export type ProductBarcodePayload = NonNullable<
  CreateProductPayload["barcodes"]
>[number];

export type UpdateProductPayload = Partial<
  Pick<
    CreateProductPayload,
    | "name"
    | "itemType"
    | "sku"
    | "description"
    | "categoryId"
    | "brandId"
    | "manufacturer"
    | "modelNumber"
    | "status"
    | "imageIds"
  >
>;

export function uploadProductImage(file: File, accessToken: string) {
  const formData = new FormData();
  formData.set("file", file);

  return apiRequest<{ image: ProductImage }>("/products/images", {
    method: "POST",
    body: formData,
    accessToken,
    retry: false,
  });
}

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export function listProductMasters(accessToken: string) {
  return apiRequest<{
    hsnSacCodes: HsnSacCode[];
    uqcCodes: UqcCode[];
    categories: ProductMasterOption[];
    brands: ProductMasterOption[];
  }>("/products/masters", {
    method: "GET",
    accessToken,
  });
}

export function createProductCategory(name: string, accessToken: string) {
  return apiRequest<{
    category: ProductMasterOption;
    categories: ProductMasterOption[];
  }>("/products/categories", {
    method: "POST",
    body: { name },
    accessToken,
  });
}

export function createProductBrand(name: string, accessToken: string) {
  return apiRequest<{
    brand: ProductMasterOption;
    brands: ProductMasterOption[];
  }>("/products/brands", {
    method: "POST",
    body: { name },
    accessToken,
  });
}

export function searchHsnCodes(
  accessToken: string,
  filters: {
    q: string;
    limit?: number;
  },
) {
  const params = new URLSearchParams();
  params.set("q", filters.q);

  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }

  return apiRequest<{ codes: HsnCodeSearchResult[] }>(
    `/products/hsn-search?${params.toString()}`,
    {
      method: "GET",
      accessToken,
    },
  );
}

export function listProducts(
  accessToken: string,
  filters: {
    search?: string;
    itemType?: ProductItemType;
    status?: ProductStatus;
    page?: number;
    limit?: number;
  } = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const query = params.size > 0 ? `?${params.toString()}` : "";
  return apiRequest<{
    products: ProductListItem[];
    pagination: PaginationMeta;
  }>(`/products${query}`, {
    method: "GET",
    accessToken,
  });
}

export function getProduct(productId: string, accessToken: string) {
  return apiRequest<{ product: ProductDetail }>(`/products/${productId}`, {
    method: "GET",
    accessToken,
  });
}

export function createProduct(
  payload: CreateProductPayload,
  accessToken: string,
) {
  return apiRequest<{ product: ProductDetail }>("/products", {
    method: "POST",
    body: payload,
    accessToken,
  });
}

export function updateProduct(
  productId: string,
  payload: UpdateProductPayload,
  accessToken: string,
) {
  return apiRequest<{ product: ProductDetail }>(`/products/${productId}`, {
    method: "PATCH",
    body: payload,
    accessToken,
  });
}

export function createProductTaxProfile(
  productId: string,
  payload: ProductTaxProfilePayload,
  accessToken: string,
) {
  return apiRequest<{ product: ProductDetail; taxProfile: ProductTaxProfile }>(
    `/products/${productId}/tax-profiles`,
    {
      method: "POST",
      body: payload,
      accessToken,
    },
  );
}

export function updateProductTaxProfile(
  productId: string,
  taxProfileId: string,
  payload: Partial<ProductTaxProfilePayload>,
  accessToken: string,
) {
  return apiRequest<{ product: ProductDetail; taxProfile: ProductTaxProfile }>(
    `/products/${productId}/tax-profiles/${taxProfileId}`,
    {
      method: "PATCH",
      body: payload,
      accessToken,
    },
  );
}

export function createProductUnitProfile(
  productId: string,
  payload: ProductUnitProfilePayload,
  accessToken: string,
) {
  return apiRequest<{ product: ProductDetail; unit: ProductUnitProfile }>(
    `/products/${productId}/units`,
    {
      method: "POST",
      body: payload,
      accessToken,
    },
  );
}

export function updateProductUnitProfile(
  productId: string,
  unitId: string,
  payload: Partial<ProductUnitProfilePayload>,
  accessToken: string,
) {
  return apiRequest<{ product: ProductDetail; unit: ProductUnitProfile }>(
    `/products/${productId}/units/${unitId}`,
    {
      method: "PATCH",
      body: payload,
      accessToken,
    },
  );
}

export function createProductPriceProfile(
  productId: string,
  payload: ProductPricePayload,
  accessToken: string,
) {
  return apiRequest<{ product: ProductDetail; price: ProductPrice }>(
    `/products/${productId}/prices`,
    {
      method: "POST",
      body: payload,
      accessToken,
    },
  );
}

export function updateProductPriceProfile(
  productId: string,
  priceId: string,
  payload: Partial<ProductPricePayload>,
  accessToken: string,
) {
  return apiRequest<{ product: ProductDetail; price: ProductPrice }>(
    `/products/${productId}/prices/${priceId}`,
    {
      method: "PATCH",
      body: payload,
      accessToken,
    },
  );
}

export function updateProductInventoryProfile(
  productId: string,
  payload: ProductInventoryProfilePayload,
  accessToken: string,
) {
  return apiRequest<{
    product: ProductDetail;
    inventoryProfile: ProductInventoryProfile;
  }>(`/products/${productId}/inventory-profile`, {
    method: "PATCH",
    body: payload,
    accessToken,
  });
}

export function createProductBarcode(
  productId: string,
  payload: ProductBarcodePayload,
  accessToken: string,
) {
  return apiRequest<{ product: ProductDetail; barcode: ProductBarcode }>(
    `/products/${productId}/barcodes`,
    {
      method: "POST",
      body: payload,
      accessToken,
    },
  );
}

export function updateProductBarcode(
  productId: string,
  barcodeId: string,
  payload: Partial<ProductBarcodePayload>,
  accessToken: string,
) {
  return apiRequest<{ product: ProductDetail; barcode: ProductBarcode }>(
    `/products/${productId}/barcodes/${barcodeId}`,
    {
      method: "PATCH",
      body: payload,
      accessToken,
    },
  );
}

export function deleteProductBarcode(
  productId: string,
  barcodeId: string,
  accessToken: string,
) {
  return apiRequest<{ product: ProductDetail }>(
    `/products/${productId}/barcodes/${barcodeId}`,
    {
      method: "DELETE",
      accessToken,
    },
  );
}

export function archiveProduct(productId: string, accessToken: string) {
  return apiRequest<{ product: ProductDetail }>(`/products/${productId}`, {
    method: "DELETE",
    accessToken,
  });
}
