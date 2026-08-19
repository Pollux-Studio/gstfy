import { and, desc, eq, ilike, inArray, or, sql as drizzleSql, type SQL } from "drizzle-orm"
import type { FastifyInstance, FastifyRequest } from "fastify"

import { db } from "../../db/client.js"
import {
  auditLogs,
  businessMemberPermissions,
  hsnSacCodes,
  itemAccountingProfiles,
  itemBarcodes,
  itemImages,
  itemInventoryProfiles,
  itemPrices,
  items,
  itemSuppliers,
  itemTaxProfiles,
  itemUnits,
  ledgerAccounts,
  parties,
  partySupplierProfiles,
  productBrands,
  productCategories,
  uqcCodes,
  warehouses,
  type ItemPriceRecord,
  type ItemRecord,
  type ItemTaxProfileRecord,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import {
  productImageMaxSizeLabel,
  uploadProductImageObject,
} from "../../utils/r2-storage.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"
import {
  childParamsSchema,
  createProductSchema,
  hsnSearchQuerySchema,
  idParamsSchema,
  listProductsQuerySchema,
  productAccountingProfileSchema,
  productBarcodeSchema,
  productInventoryProfileSchema,
  productMasterNameSchema,
  productPriceSchema,
  productSupplierSchema,
  productTaxProfileSchema,
  productUnitSchema,
  resolveProductQuerySchema,
  updateProductAccountingProfileSchema,
  updateProductBarcodeSchema,
  updateProductInventoryProfileSchema,
  updateProductPriceSchema,
  updateProductSchema,
  updateProductSupplierSchema,
  updateProductTaxProfileSchema,
  updateProductUnitSchema,
  type CreateProductInput,
} from "./products.schemas.js"

type BusinessAccess = Awaited<ReturnType<typeof requirePrimaryBusinessAccess>>
type ProductAction = "view" | "create" | "edit" | "delete"
type ProductImageMultipartFile = NonNullable<
  Awaited<ReturnType<FastifyRequest["file"]>>
>
type HsnSearchResult = {
  code: string
  description: string
  gstRate: string | null
  source: "master" | "hsnlookup"
}

const hsnLookupDatasetUrl = "https://hsnlookup.in/api/hsn.json"
const hsnCacheTtlMs = 1000 * 60 * 60 * 12
let publicHsnCache: { loadedAt: number; codes: HsnSearchResult[] } | null = null

export async function registerProductsRoutes(app: FastifyInstance) {
  app.get("/products/masters", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "view")

    return {
      hsnSacCodes: await db
        .select()
        .from(hsnSacCodes)
        .where(eq(hsnSacCodes.status, "active"))
        .orderBy(hsnSacCodes.code),
      uqcCodes: await db
        .select()
        .from(uqcCodes)
        .where(eq(uqcCodes.status, "active"))
        .orderBy(uqcCodes.code),
      categories: await listProductCategories(access.business.id),
      brands: await listProductBrands(access.business.id),
    }
  })

  app.post("/products/categories", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "create")
    const body = productMasterNameSchema.parse(request.body)

    return {
      category: await ensureProductCategory(access.business.id, body.name, access.userId),
      categories: await listProductCategories(access.business.id),
    }
  })

  app.post("/products/brands", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "create")
    const body = productMasterNameSchema.parse(request.body)

    return {
      brand: await ensureProductBrand(access.business.id, body.name, access.userId),
      brands: await listProductBrands(access.business.id),
    }
  })

  app.post("/products/images", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUploadProductImages(access)

    if (!request.isMultipart()) {
      throw new HttpError(
        400,
        "Upload product images as multipart/form-data with a file field named \"file\"."
      )
    }

    const file = await readProductImageFile(request)

    if (!file) {
      throw new HttpError(400, "Upload a product image file.")
    }

    const body = await readProductImageBuffer(file)

    const uploadedObject = await uploadProductImageObject({
      businessId: access.business.id,
      body,
      contentType: file.mimetype,
      fileName: file.filename,
    })

    const [image] = await db
      .insert(itemImages)
      .values({
        businessId: access.business.id,
        itemId: null,
        objectKey: uploadedObject.objectKey,
        publicUrl: uploadedObject.publicUrl,
        fileName: file.filename,
        contentType: uploadedObject.contentType,
        fileSizeBytes: uploadedObject.fileSizeBytes,
        isPrimary: true,
        sortOrder: 0,
        status: "ACTIVE",
        createdBy: access.userId,
        updatedBy: access.userId,
      })
      .returning()

    if (!image) {
      throw new HttpError(500, "Unable to save uploaded product image.")
    }

    return { image }
  })

  app.get("/products", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "view")
    const query = listProductsQuerySchema.parse(request.query)
    const conditions: SQL[] = [eq(items.businessId, access.business.id)]

    if (query.status) {
      conditions.push(eq(items.status, query.status))
    }

    if (query.itemType) {
      conditions.push(eq(items.itemType, query.itemType))
    }

    if (query.search) {
      const term = `%${escapeLikeTerm(query.search)}%`
      const matchedIds = await findProductIdsBySearch(access.business.id, query.search)
      const searchConditions: SQL[] = [
        ilike(items.name, term),
        ilike(items.sku, term),
        ilike(items.description, term),
        ilike(items.manufacturer, term),
        ilike(items.modelNumber, term),
      ]

      if (matchedIds.length > 0) {
        searchConditions.push(inArray(items.id, matchedIds))
      }

      const searchCondition = or(...searchConditions)
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }

    const offset = (query.page - 1) * query.limit
    const [countRow] = await db
      .select({ total: drizzleSql<number>`count(*)::int` })
      .from(items)
      .where(and(...conditions))
    const total = countRow?.total ?? 0
    const rows = await db
      .select()
      .from(items)
      .where(and(...conditions))
      .orderBy(desc(items.createdAt))
      .limit(query.limit)
      .offset(offset)

    return {
      products: await buildProductSummaries(access.business.id, rows),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        hasMore: query.page * query.limit < total,
      },
    }
  })

  app.get("/products/hsn-search", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "view")
    const query = hsnSearchQuerySchema.parse(request.query)

    return {
      codes: await searchHsnCodes(query.q, query.limit),
    }
  })

  app.post("/products", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "create")
    const body = createProductSchema.parse(request.body)

    await assertSkuAvailable(access.business.id, body.sku)
    await validateNestedProductReferences(access.business.id, body)
    const categoryName =
      body.categoryId ? (await ensureProductCategory(access.business.id, body.categoryId, access.userId)).name
      : null
    const brandName =
      body.brandId ? (await ensureProductBrand(access.business.id, body.brandId, access.userId)).name
      : null

    const product = await db.transaction(async (tx) => {
      const [insertedProduct] = await tx
        .insert(items)
        .values({
          businessId: access.business.id,
          name: body.name,
          itemType: body.itemType,
          sku: body.sku,
          description: body.description ?? null,
          categoryId: categoryName,
          brandId: brandName,
          manufacturer: body.manufacturer ?? null,
          modelNumber: body.modelNumber ?? null,
          status: body.status,
          createdBy: access.userId,
          updatedBy: access.userId,
        })
        .returning()

      if (!insertedProduct) {
        throw new HttpError(500, "Unable to create product.")
      }

      if (body.taxProfile) {
        await tx.insert(itemTaxProfiles).values({
          businessId: access.business.id,
          itemId: insertedProduct.id,
          taxability: body.taxProfile.taxability,
          hsnSac: body.taxProfile.hsnSac ?? null,
          gstRate: body.taxProfile.gstRate,
          cessRuleId: body.taxProfile.cessRuleId ?? null,
          effectiveFrom: body.taxProfile.effectiveFrom,
          effectiveTo: body.taxProfile.effectiveTo ?? null,
          status: body.taxProfile.status,
        })
      }

      const unitProfile = body.unitProfile ?? {
        baseUnit: "PCS",
        secondaryUnit: null,
        conversionFactor: "1",
        gstUqc: body.itemType === "GOODS" ? "PCS" : null,
      }

      await tx.insert(itemUnits).values({
        businessId: access.business.id,
        itemId: insertedProduct.id,
        baseUnit: unitProfile.baseUnit,
        secondaryUnit: unitProfile.secondaryUnit ?? null,
        conversionFactor: unitProfile.conversionFactor,
        gstUqc: unitProfile.gstUqc ?? null,
      })

      if (body.price) {
        await tx.insert(itemPrices).values({
          businessId: access.business.id,
          itemId: insertedProduct.id,
          priceType: body.price.priceType,
          price: body.price.price,
          marginPercent: body.price.marginPercent,
          taxMode: body.price.taxMode,
          currency: body.price.currency,
          minimumQuantity: body.price.minimumQuantity,
          customerGroupId: body.price.customerGroupId ?? null,
          effectiveFrom: body.price.effectiveFrom,
          effectiveTo: body.price.effectiveTo ?? null,
          status: body.price.status,
        })
      }

      if (body.supplier) {
        await tx.insert(itemSuppliers).values({
          businessId: access.business.id,
          itemId: insertedProduct.id,
          supplierId: body.supplier.supplierId,
          supplierItemCode: body.supplier.supplierItemCode ?? null,
          purchasePrice: body.supplier.purchasePrice ?? null,
          minimumOrderQuantity: body.supplier.minimumOrderQuantity,
          leadTimeDays: body.supplier.leadTimeDays,
          isPreferred: body.supplier.isPreferred,
          effectiveFrom: body.supplier.effectiveFrom ?? null,
          effectiveTo: body.supplier.effectiveTo ?? null,
          status: body.supplier.status,
        })
      }

      if (body.barcodes.length > 0) {
        await tx.insert(itemBarcodes).values(
          body.barcodes.map((barcode, index) => ({
            businessId: access.business.id,
            itemId: insertedProduct.id,
            barcode: barcode.barcode,
            barcodeType: barcode.barcodeType ?? null,
            isPrimary: barcode.isPrimary || index === 0,
            status: barcode.status,
          }))
        )
      }

      const inventoryProfile = body.inventoryProfile ?? {
        trackInventory: body.itemType === "GOODS",
        defaultWarehouseId: null,
        reorderLevel: "0",
        minimumStock: "0",
        maximumStock: "0",
        batchTracking: false,
        serialTracking: false,
      }

      await tx.insert(itemInventoryProfiles).values({
        businessId: access.business.id,
        itemId: insertedProduct.id,
        trackInventory: inventoryProfile.trackInventory,
        defaultWarehouseId: inventoryProfile.defaultWarehouseId ?? null,
        reorderLevel: inventoryProfile.reorderLevel,
        minimumStock: inventoryProfile.minimumStock,
        maximumStock: inventoryProfile.maximumStock,
        batchTracking: inventoryProfile.batchTracking,
        serialTracking: inventoryProfile.serialTracking,
      })

      if (body.accountingProfile) {
        await tx.insert(itemAccountingProfiles).values({
          businessId: access.business.id,
          itemId: insertedProduct.id,
          salesAccountId: body.accountingProfile.salesAccountId ?? null,
          purchaseAccountId: body.accountingProfile.purchaseAccountId ?? null,
          inventoryAccountId: body.accountingProfile.inventoryAccountId ?? null,
          salesReturnAccountId: body.accountingProfile.salesReturnAccountId ?? null,
          purchaseReturnAccountId: body.accountingProfile.purchaseReturnAccountId ?? null,
        })
      }

      await tx.insert(auditLogs).values({
        businessId: access.business.id,
        entityType: "product",
        entityId: insertedProduct.id,
        action: "PRODUCT_CREATED",
        userId: access.userId,
        before: null,
        after: insertedProduct,
      })

      return insertedProduct
    })

    await syncProductImages(access.business.id, product.id, body.imageIds, access.userId)

    return {
      product: await getProductDetail(access.business.id, product.id),
    }
  })

  app.get("/products/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "view")
    const { id } = idParamsSchema.parse(request.params)

    return {
      product: await getProductDetail(access.business.id, id),
    }
  })

  app.patch("/products/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    const before = await requireProduct(access.business.id, id)
    const parsedBody = compactObject(updateProductSchema.parse(request.body))
    const { imageIds, ...body } = parsedBody

    if (body.sku && body.sku !== before.sku) {
      await assertSkuAvailable(access.business.id, body.sku, id)
    }

    if (body.categoryId) {
      body.categoryId = (await ensureProductCategory(access.business.id, body.categoryId, access.userId)).name
    }

    if (body.brandId) {
      body.brandId = (await ensureProductBrand(access.business.id, body.brandId, access.userId)).name
    }

    const [product] = await db
      .update(items)
      .set({
        ...body,
        updatedBy: access.userId,
        updatedAt: new Date(),
      })
      .where(and(eq(items.businessId, access.business.id), eq(items.id, id)))
      .returning()

    await syncProductImages(access.business.id, id, imageIds, access.userId)
    await writeAudit(access, "PRODUCT_UPDATED", id, before, product)

    return {
      product: await getProductDetail(access.business.id, id),
    }
  })

  app.delete("/products/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "delete")
    const { id } = idParamsSchema.parse(request.params)
    const before = await requireProduct(access.business.id, id)

    const [product] = await db
      .update(items)
      .set({
        status: "ARCHIVED",
        updatedBy: access.userId,
        updatedAt: new Date(),
      })
      .where(and(eq(items.businessId, access.business.id), eq(items.id, id)))
      .returning()

    await writeAudit(access, "PRODUCT_DEACTIVATED", id, before, product)

    return {
      product: await getProductDetail(access.business.id, id),
    }
  })

  app.get("/products/:id/resolve", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "view")
    const { id } = idParamsSchema.parse(request.params)
    const query = resolveProductQuerySchema.parse(request.query)
    const product = await getProductDetail(access.business.id, id)

    return {
      resolution: {
        item: product,
        taxProfile: resolveTaxProfile(product.taxProfiles, query.transactionDate),
        unitProfile: product.units[0] ?? null,
        price: resolvePrice(product.prices, query.transactionDate, query.priceType),
        inventoryProfile: product.inventoryProfile,
        accountingProfile: product.accountingProfile,
        snapshot: buildProductSnapshot(product, query.transactionDate, query.priceType),
        context: query,
      },
    }
  })

  app.get("/products/:id/tax-profiles", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "view")
    const { id } = idParamsSchema.parse(request.params)
    await requireProduct(access.business.id, id)

    return {
      taxProfiles: await listTaxProfiles(access.business.id, id),
    }
  })

  app.post("/products/:id/tax-profiles", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    const product = await requireProduct(access.business.id, id)
    const body = productTaxProfileSchema.parse(request.body)

    await validateTaxProfileForProduct(product.itemType, body)
    await assertNoOverlappingTaxProfile(access.business.id, id, body)

    const [taxProfile] = await db
      .insert(itemTaxProfiles)
      .values({
        businessId: access.business.id,
        itemId: id,
        taxability: body.taxability,
        hsnSac: body.hsnSac ?? null,
        gstRate: body.gstRate,
        cessRuleId: body.cessRuleId ?? null,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo ?? null,
        status: body.status,
      })
      .returning()

    await writeAudit(access, "TAX_PROFILE_CREATED", id, null, taxProfile)

    return {
      taxProfile,
      product: await getProductDetail(access.business.id, id),
    }
  })

  app.patch("/products/:id/tax-profiles/:childId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "edit")
    const { id, childId } = childParamsSchema.parse(request.params)
    const product = await requireProduct(access.business.id, id)
    const before = await requireTaxProfile(access.business.id, id, childId)
    const body = compactObject(updateProductTaxProfileSchema.parse(request.body))
    const candidate = {
      taxability: body.taxability ?? before.taxability,
      hsnSac: body.hsnSac ?? before.hsnSac,
      gstRate: body.gstRate ?? before.gstRate,
      cessRuleId: body.cessRuleId ?? before.cessRuleId,
      effectiveFrom: body.effectiveFrom ?? before.effectiveFrom,
      effectiveTo: body.effectiveTo ?? before.effectiveTo,
      status: body.status ?? before.status,
    }

    await validateTaxProfileForProduct(product.itemType, candidate)
    await assertNoOverlappingTaxProfile(access.business.id, id, candidate, childId)

    const [taxProfile] = await db
      .update(itemTaxProfiles)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(
          eq(itemTaxProfiles.businessId, access.business.id),
          eq(itemTaxProfiles.itemId, id),
          eq(itemTaxProfiles.id, childId)
        )
      )
      .returning()

    await writeAudit(access, "TAX_PROFILE_UPDATED", id, before, taxProfile)

    return {
      taxProfile,
      product: await getProductDetail(access.business.id, id),
    }
  })

  app.get("/products/:id/prices", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "view")
    const { id } = idParamsSchema.parse(request.params)
    await requireProduct(access.business.id, id)

    return {
      prices: await listPrices(access.business.id, id),
    }
  })

  app.post("/products/:id/prices", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    await requireProduct(access.business.id, id)
    const body = productPriceSchema.parse(request.body)
    await assertNoOverlappingPrice(access.business.id, id, body)

    const [price] = await db
      .insert(itemPrices)
      .values({
        businessId: access.business.id,
        itemId: id,
        priceType: body.priceType,
        price: body.price,
        marginPercent: body.marginPercent,
        taxMode: body.taxMode,
        currency: body.currency,
        minimumQuantity: body.minimumQuantity,
        customerGroupId: body.customerGroupId ?? null,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo ?? null,
        status: body.status,
      })
      .returning()

    await writeAudit(access, "PRICE_CREATED", id, null, price)

    return {
      price,
      product: await getProductDetail(access.business.id, id),
    }
  })

  app.patch("/products/:id/prices/:childId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "edit")
    const { id, childId } = childParamsSchema.parse(request.params)
    await requireProduct(access.business.id, id)
    const before = await requirePrice(access.business.id, id, childId)
    const body = compactObject(updateProductPriceSchema.parse(request.body))
    const candidate = {
      priceType: body.priceType ?? before.priceType,
      price: body.price ?? before.price,
      marginPercent: body.marginPercent ?? before.marginPercent,
      taxMode: body.taxMode ?? before.taxMode,
      currency: body.currency ?? before.currency,
      minimumQuantity: body.minimumQuantity ?? before.minimumQuantity,
      customerGroupId: body.customerGroupId ?? before.customerGroupId,
      effectiveFrom: body.effectiveFrom ?? before.effectiveFrom,
      effectiveTo: body.effectiveTo ?? before.effectiveTo,
      status: body.status ?? before.status,
    }

    await assertNoOverlappingPrice(access.business.id, id, candidate, childId)

    const [price] = await db
      .update(itemPrices)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(
          eq(itemPrices.businessId, access.business.id),
          eq(itemPrices.itemId, id),
          eq(itemPrices.id, childId)
        )
      )
      .returning()

    await writeAudit(access, "PRICE_UPDATED", id, before, price)

    return {
      price,
      product: await getProductDetail(access.business.id, id),
    }
  })

  app.get("/products/:id/suppliers", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "view")
    const { id } = idParamsSchema.parse(request.params)
    await requireProduct(access.business.id, id)

    return {
      suppliers: await listSuppliers(access.business.id, id),
    }
  })

  app.post("/products/:id/suppliers", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    await requireProduct(access.business.id, id)
    const body = productSupplierSchema.parse(request.body)
    await requireSupplier(access.business.id, body.supplierId)

    const [supplier] = await db
      .insert(itemSuppliers)
      .values({
        businessId: access.business.id,
        itemId: id,
        supplierId: body.supplierId,
        supplierItemCode: body.supplierItemCode ?? null,
        purchasePrice: body.purchasePrice ?? null,
        minimumOrderQuantity: body.minimumOrderQuantity,
        leadTimeDays: body.leadTimeDays,
        isPreferred: body.isPreferred,
        effectiveFrom: body.effectiveFrom ?? null,
        effectiveTo: body.effectiveTo ?? null,
        status: body.status,
      })
      .returning()

    await writeAudit(access, "SUPPLIER_LINKED", id, null, supplier)

    return {
      supplier,
      product: await getProductDetail(access.business.id, id),
    }
  })

  app.patch("/products/:id/suppliers/:childId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "edit")
    const { id, childId } = childParamsSchema.parse(request.params)
    await requireProduct(access.business.id, id)
    const before = await requireItemSupplier(access.business.id, id, childId)
    const body = compactObject(updateProductSupplierSchema.parse(request.body))

    if (body.supplierId) {
      await requireSupplier(access.business.id, body.supplierId)
    }

    const [supplier] = await db
      .update(itemSuppliers)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(
          eq(itemSuppliers.businessId, access.business.id),
          eq(itemSuppliers.itemId, id),
          eq(itemSuppliers.id, childId)
        )
      )
      .returning()

    await writeAudit(access, "SUPPLIER_LINKED", id, before, supplier)

    return {
      supplier,
      product: await getProductDetail(access.business.id, id),
    }
  })

  app.delete("/products/:id/suppliers/:childId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "edit")
    const { id, childId } = childParamsSchema.parse(request.params)
    const before = await requireItemSupplier(access.business.id, id, childId)

    await db
      .delete(itemSuppliers)
      .where(
        and(
          eq(itemSuppliers.businessId, access.business.id),
          eq(itemSuppliers.itemId, id),
          eq(itemSuppliers.id, childId)
        )
      )

    await writeAudit(access, "SUPPLIER_UNLINKED", id, before, null)

    return {
      product: await getProductDetail(access.business.id, id),
    }
  })

  app.get("/products/:id/barcodes", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "view")
    const { id } = idParamsSchema.parse(request.params)
    await requireProduct(access.business.id, id)

    return {
      barcodes: await listBarcodes(access.business.id, id),
    }
  })

  app.post("/products/:id/barcodes", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    await requireProduct(access.business.id, id)
    const body = productBarcodeSchema.parse(request.body)
    await assertBarcodeAvailable(access.business.id, body.barcode)

    const [barcode] = await db
      .insert(itemBarcodes)
      .values({
        businessId: access.business.id,
        itemId: id,
        barcode: body.barcode,
        barcodeType: body.barcodeType ?? null,
        isPrimary: body.isPrimary,
        status: body.status,
      })
      .returning()

    await writeAudit(access, "BARCODE_ADDED", id, null, barcode)

    return {
      barcode,
      product: await getProductDetail(access.business.id, id),
    }
  })

  app.patch("/products/:id/barcodes/:childId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "edit")
    const { id, childId } = childParamsSchema.parse(request.params)
    const before = await requireBarcode(access.business.id, id, childId)
    const body = compactObject(updateProductBarcodeSchema.parse(request.body))

    if (body.barcode && body.barcode !== before.barcode) {
      await assertBarcodeAvailable(access.business.id, body.barcode, childId)
    }

    const [barcode] = await db
      .update(itemBarcodes)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(
          eq(itemBarcodes.businessId, access.business.id),
          eq(itemBarcodes.itemId, id),
          eq(itemBarcodes.id, childId)
        )
      )
      .returning()

    await writeAudit(access, "BARCODE_ADDED", id, before, barcode)

    return {
      barcode,
      product: await getProductDetail(access.business.id, id),
    }
  })

  app.delete("/products/:id/barcodes/:childId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "edit")
    const { id, childId } = childParamsSchema.parse(request.params)
    const before = await requireBarcode(access.business.id, id, childId)

    await db
      .delete(itemBarcodes)
      .where(
        and(
          eq(itemBarcodes.businessId, access.business.id),
          eq(itemBarcodes.itemId, id),
          eq(itemBarcodes.id, childId)
        )
      )

    await writeAudit(access, "BARCODE_REMOVED", id, before, null)

    return {
      product: await getProductDetail(access.business.id, id),
    }
  })

  app.get("/products/:id/units", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "view")
    const { id } = idParamsSchema.parse(request.params)
    await requireProduct(access.business.id, id)

    return {
      units: await listUnits(access.business.id, id),
    }
  })

  app.post("/products/:id/units", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    await requireProduct(access.business.id, id)
    const body = productUnitSchema.parse(request.body)
    await validateUqcCode(body.gstUqc)

    const [unit] = await db
      .insert(itemUnits)
      .values({
        businessId: access.business.id,
        itemId: id,
        baseUnit: body.baseUnit,
        secondaryUnit: body.secondaryUnit ?? null,
        conversionFactor: body.conversionFactor,
        gstUqc: body.gstUqc ?? null,
      })
      .returning()

    return {
      unit,
      product: await getProductDetail(access.business.id, id),
    }
  })

  app.patch("/products/:id/units/:childId", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "edit")
    const { id, childId } = childParamsSchema.parse(request.params)
    await requireUnit(access.business.id, id, childId)
    const body = compactObject(updateProductUnitSchema.parse(request.body))

    if (body.gstUqc) {
      await validateUqcCode(body.gstUqc)
    }

    const [unit] = await db
      .update(itemUnits)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(
          eq(itemUnits.businessId, access.business.id),
          eq(itemUnits.itemId, id),
          eq(itemUnits.id, childId)
        )
      )
      .returning()

    return {
      unit,
      product: await getProductDetail(access.business.id, id),
    }
  })

  app.patch("/products/:id/inventory-profile", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    await requireProduct(access.business.id, id)
    const body = compactObject(updateProductInventoryProfileSchema.parse(request.body))

    if (body.defaultWarehouseId) {
      await requireWarehouse(access.business.id, body.defaultWarehouseId)
    }

    const [profile] = await db
      .insert(itemInventoryProfiles)
      .values({
        businessId: access.business.id,
        itemId: id,
        ...productInventoryProfileSchema.parse(body),
      })
      .onConflictDoUpdate({
        target: itemInventoryProfiles.itemId,
        set: { ...body, updatedAt: new Date() },
      })
      .returning()

    return {
      inventoryProfile: profile,
      product: await getProductDetail(access.business.id, id),
    }
  })

  app.patch("/products/:id/accounting-profile", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseProducts(access, "edit")
    const { id } = idParamsSchema.parse(request.params)
    await requireProduct(access.business.id, id)
    const body = compactObject(updateProductAccountingProfileSchema.parse(request.body))
    await validateAccountingAccounts(access.business.id, body)

    const [profile] = await db
      .insert(itemAccountingProfiles)
      .values({
        businessId: access.business.id,
        itemId: id,
        ...productAccountingProfileSchema.parse(body),
      })
      .onConflictDoUpdate({
        target: itemAccountingProfiles.itemId,
        set: { ...body, updatedAt: new Date() },
      })
      .returning()

    await writeAudit(access, "ACCOUNTING_MAPPING_UPDATED", id, null, profile)

    return {
      accountingProfile: profile,
      product: await getProductDetail(access.business.id, id),
    }
  })
}

async function getProductDetail(businessId: string, productId: string) {
  const product = await requireProduct(businessId, productId)
  const [
    taxProfiles,
    units,
    prices,
    suppliers,
    barcodes,
    images,
    inventoryProfile,
    accountingProfile,
  ] = await Promise.all([
    listTaxProfiles(businessId, productId),
    listUnits(businessId, productId),
    listPrices(businessId, productId),
    listSuppliers(businessId, productId),
    listBarcodes(businessId, productId),
    listImages(businessId, productId),
    db.query.itemInventoryProfiles.findFirst({
      where: and(
        eq(itemInventoryProfiles.businessId, businessId),
        eq(itemInventoryProfiles.itemId, productId)
      ),
    }),
    db.query.itemAccountingProfiles.findFirst({
      where: and(
        eq(itemAccountingProfiles.businessId, businessId),
        eq(itemAccountingProfiles.itemId, productId)
      ),
    }),
  ])

  return {
    ...product,
    taxProfiles,
    units,
    prices,
    suppliers,
    barcodes,
    images,
    inventoryProfile: inventoryProfile ?? null,
    accountingProfile: accountingProfile ?? null,
    activeTaxProfile: resolveTaxProfile(taxProfiles, todayIso()),
    activePrice: resolvePrice(prices, todayIso(), "RETAIL"),
    primaryBarcode: barcodes.find((barcode) => barcode.isPrimary) ?? barcodes[0] ?? null,
    primaryImage: images.find((image) => image.isPrimary) ?? images[0] ?? null,
  }
}

async function buildProductSummaries(businessId: string, rows: ItemRecord[]) {
  return Promise.all(
    rows.map(async (product) => {
      const [taxProfiles, units, prices, barcodes, images, inventoryProfile] = await Promise.all([
        listTaxProfiles(businessId, product.id),
        listUnits(businessId, product.id),
        listPrices(businessId, product.id),
        listBarcodes(businessId, product.id),
        listImages(businessId, product.id),
        db.query.itemInventoryProfiles.findFirst({
          where: and(
            eq(itemInventoryProfiles.businessId, businessId),
            eq(itemInventoryProfiles.itemId, product.id)
          ),
        }),
      ])

      return {
        ...product,
        activeTaxProfile: resolveTaxProfile(taxProfiles, todayIso()),
        unitProfile: units[0] ?? null,
        activePrice: resolvePrice(prices, todayIso(), "RETAIL"),
        primaryBarcode: barcodes.find((barcode) => barcode.isPrimary) ?? barcodes[0] ?? null,
        images,
        primaryImage: images.find((image) => image.isPrimary) ?? images[0] ?? null,
        inventoryProfile: inventoryProfile ?? null,
      }
    })
  )
}

async function listTaxProfiles(businessId: string, productId: string) {
  return db
    .select()
    .from(itemTaxProfiles)
    .where(
      and(eq(itemTaxProfiles.businessId, businessId), eq(itemTaxProfiles.itemId, productId))
    )
    .orderBy(desc(itemTaxProfiles.effectiveFrom))
}

async function listUnits(businessId: string, productId: string) {
  return db
    .select()
    .from(itemUnits)
    .where(and(eq(itemUnits.businessId, businessId), eq(itemUnits.itemId, productId)))
    .orderBy(desc(itemUnits.createdAt))
}

async function listPrices(businessId: string, productId: string) {
  return db
    .select()
    .from(itemPrices)
    .where(and(eq(itemPrices.businessId, businessId), eq(itemPrices.itemId, productId)))
    .orderBy(desc(itemPrices.effectiveFrom))
}

async function listSuppliers(businessId: string, productId: string) {
  const rows = await db
    .select({
      id: itemSuppliers.id,
      businessId: itemSuppliers.businessId,
      itemId: itemSuppliers.itemId,
      supplierId: itemSuppliers.supplierId,
      supplierName: parties.displayName,
      supplierItemCode: itemSuppliers.supplierItemCode,
      purchasePrice: itemSuppliers.purchasePrice,
      minimumOrderQuantity: itemSuppliers.minimumOrderQuantity,
      leadTimeDays: itemSuppliers.leadTimeDays,
      isPreferred: itemSuppliers.isPreferred,
      effectiveFrom: itemSuppliers.effectiveFrom,
      effectiveTo: itemSuppliers.effectiveTo,
      status: itemSuppliers.status,
      createdAt: itemSuppliers.createdAt,
      updatedAt: itemSuppliers.updatedAt,
    })
    .from(itemSuppliers)
    .innerJoin(parties, eq(parties.id, itemSuppliers.supplierId))
    .where(
      and(eq(itemSuppliers.businessId, businessId), eq(itemSuppliers.itemId, productId))
    )
    .orderBy(desc(itemSuppliers.isPreferred), desc(itemSuppliers.createdAt))

  return rows
}

async function listBarcodes(businessId: string, productId: string) {
  return db
    .select()
    .from(itemBarcodes)
    .where(and(eq(itemBarcodes.businessId, businessId), eq(itemBarcodes.itemId, productId)))
    .orderBy(desc(itemBarcodes.isPrimary), desc(itemBarcodes.createdAt))
}

async function listImages(businessId: string, productId: string) {
  return db
    .select()
    .from(itemImages)
    .where(
      and(
        eq(itemImages.businessId, businessId),
        eq(itemImages.itemId, productId),
        eq(itemImages.status, "ACTIVE")
      )
    )
    .orderBy(desc(itemImages.isPrimary), itemImages.sortOrder, desc(itemImages.createdAt))
}

async function requireProduct(businessId: string, productId: string) {
  const product = await db.query.items.findFirst({
    where: and(eq(items.businessId, businessId), eq(items.id, productId)),
  })

  if (!product) {
    throw new HttpError(404, "Product not found.")
  }

  return product
}

async function requireTaxProfile(businessId: string, productId: string, profileId: string) {
  const profile = await db.query.itemTaxProfiles.findFirst({
    where: and(
      eq(itemTaxProfiles.businessId, businessId),
      eq(itemTaxProfiles.itemId, productId),
      eq(itemTaxProfiles.id, profileId)
    ),
  })

  if (!profile) {
    throw new HttpError(404, "Tax profile not found.")
  }

  return profile
}

async function requirePrice(businessId: string, productId: string, priceId: string) {
  const price = await db.query.itemPrices.findFirst({
    where: and(
      eq(itemPrices.businessId, businessId),
      eq(itemPrices.itemId, productId),
      eq(itemPrices.id, priceId)
    ),
  })

  if (!price) {
    throw new HttpError(404, "Price profile not found.")
  }

  return price
}

async function requireItemSupplier(
  businessId: string,
  productId: string,
  supplierLinkId: string
) {
  const supplier = await db.query.itemSuppliers.findFirst({
    where: and(
      eq(itemSuppliers.businessId, businessId),
      eq(itemSuppliers.itemId, productId),
      eq(itemSuppliers.id, supplierLinkId)
    ),
  })

  if (!supplier) {
    throw new HttpError(404, "Supplier mapping not found.")
  }

  return supplier
}

async function requireBarcode(businessId: string, productId: string, barcodeId: string) {
  const barcode = await db.query.itemBarcodes.findFirst({
    where: and(
      eq(itemBarcodes.businessId, businessId),
      eq(itemBarcodes.itemId, productId),
      eq(itemBarcodes.id, barcodeId)
    ),
  })

  if (!barcode) {
    throw new HttpError(404, "Barcode not found.")
  }

  return barcode
}

async function requireUnit(businessId: string, productId: string, unitId: string) {
  const unit = await db.query.itemUnits.findFirst({
    where: and(
      eq(itemUnits.businessId, businessId),
      eq(itemUnits.itemId, productId),
      eq(itemUnits.id, unitId)
    ),
  })

  if (!unit) {
    throw new HttpError(404, "Unit profile not found.")
  }

  return unit
}

async function requireSupplier(businessId: string, supplierId: string) {
  const supplier = await db
    .select({ id: parties.id })
    .from(parties)
    .innerJoin(partySupplierProfiles, eq(partySupplierProfiles.partyId, parties.id))
    .where(
      and(
        eq(parties.businessId, businessId),
        eq(parties.id, supplierId),
        eq(partySupplierProfiles.businessId, businessId)
      )
    )
    .limit(1)

  if (!supplier[0]) {
    throw new HttpError(400, "Supplier must be an active supplier party.")
  }
}

async function requireWarehouse(businessId: string, warehouseId: string) {
  const warehouse = await db.query.warehouses.findFirst({
    where: and(eq(warehouses.businessId, businessId), eq(warehouses.id, warehouseId)),
  })

  if (!warehouse) {
    throw new HttpError(400, "Default warehouse does not belong to this business.")
  }
}

async function assertSkuAvailable(
  businessId: string,
  sku: string,
  excludeProductId?: string
) {
  const product = await db.query.items.findFirst({
    where: and(eq(items.businessId, businessId), eq(items.sku, sku)),
  })

  if (product && product.id !== excludeProductId) {
    throw new HttpError(409, "Product SKU already exists.")
  }
}

async function assertBarcodeAvailable(
  businessId: string,
  barcode: string,
  excludeBarcodeId?: string
) {
  const row = await db.query.itemBarcodes.findFirst({
    where: and(eq(itemBarcodes.businessId, businessId), eq(itemBarcodes.barcode, barcode)),
  })

  if (row && row.id !== excludeBarcodeId) {
    throw new HttpError(409, "Barcode already exists for this business.")
  }
}

async function validateNestedProductReferences(
  businessId: string,
  input: CreateProductInput
) {
  if (input.taxProfile) {
    await validateTaxProfileForProduct(input.itemType, input.taxProfile)
  }

  if (input.unitProfile?.gstUqc) {
    await validateUqcCode(input.unitProfile.gstUqc)
  }

  if (input.inventoryProfile?.defaultWarehouseId) {
    await requireWarehouse(businessId, input.inventoryProfile.defaultWarehouseId)
  }

  if (input.accountingProfile) {
    await validateAccountingAccounts(businessId, input.accountingProfile)
  }

  if (input.supplier) {
    await requireSupplier(businessId, input.supplier.supplierId)
  }

  for (const barcode of input.barcodes) {
    await assertBarcodeAvailable(businessId, barcode.barcode)
  }
}

async function listProductCategories(businessId: string) {
  return db
    .select()
    .from(productCategories)
    .where(
      and(eq(productCategories.businessId, businessId), eq(productCategories.status, "active"))
    )
    .orderBy(productCategories.name)
}

async function listProductBrands(businessId: string) {
  return db
    .select()
    .from(productBrands)
    .where(and(eq(productBrands.businessId, businessId), eq(productBrands.status, "active")))
    .orderBy(productBrands.name)
}

async function ensureProductCategory(
  businessId: string,
  rawName: string,
  userId: string
) {
  const name = normalizeProductMasterName(rawName)
  const existing = await db.query.productCategories.findFirst({
    where: and(
      eq(productCategories.businessId, businessId),
      drizzleSql`lower(${productCategories.name}) = ${name.toLowerCase()}`
    ),
  })

  if (existing) {
    if (existing.status === "active" && existing.name === name) {
      return existing
    }

    const [updated] = await db
      .update(productCategories)
      .set({ name, status: "active", updatedBy: userId, updatedAt: new Date() })
      .where(eq(productCategories.id, existing.id))
      .returning()

    return updated ?? existing
  }

  const [inserted] = await db
    .insert(productCategories)
    .values({
      businessId,
      name,
      status: "active",
      createdBy: userId,
      updatedBy: userId,
    })
    .returning()

  if (!inserted) {
    throw new HttpError(500, "Unable to create product category.")
  }

  return inserted
}

async function ensureProductBrand(businessId: string, rawName: string, userId: string) {
  const name = normalizeProductMasterName(rawName)
  const existing = await db.query.productBrands.findFirst({
    where: and(
      eq(productBrands.businessId, businessId),
      drizzleSql`lower(${productBrands.name}) = ${name.toLowerCase()}`
    ),
  })

  if (existing) {
    if (existing.status === "active" && existing.name === name) {
      return existing
    }

    const [updated] = await db
      .update(productBrands)
      .set({ name, status: "active", updatedBy: userId, updatedAt: new Date() })
      .where(eq(productBrands.id, existing.id))
      .returning()

    return updated ?? existing
  }

  const [inserted] = await db
    .insert(productBrands)
    .values({
      businessId,
      name,
      status: "active",
      createdBy: userId,
      updatedBy: userId,
    })
    .returning()

  if (!inserted) {
    throw new HttpError(500, "Unable to create product brand.")
  }

  return inserted
}

function normalizeProductMasterName(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

async function searchHsnCodes(search: string, limit: number) {
  const term = search.trim()
  const escapedTerm = `%${escapeLikeTerm(term)}%`
  const localRows = await db
    .select({
      code: hsnSacCodes.code,
      description: hsnSacCodes.description,
    })
    .from(hsnSacCodes)
    .where(
      and(
        eq(hsnSacCodes.codeType, "HSN"),
        eq(hsnSacCodes.status, "active"),
        or(ilike(hsnSacCodes.code, escapedTerm), ilike(hsnSacCodes.description, escapedTerm))
      )
    )
    .orderBy(hsnSacCodes.code)
    .limit(limit)

  const merged = new Map<string, HsnSearchResult>()

  for (const row of localRows) {
    merged.set(row.code, {
      code: row.code,
      description: row.description,
      gstRate: null,
      source: "master",
    })
  }

  try {
    const publicCodes = await loadPublicHsnCodes()
    const normalizedTerm = term.toLowerCase()

    for (const code of publicCodes) {
      if (merged.size >= limit) {
        break
      }

      if (
        code.code.includes(term) ||
        code.description.toLowerCase().includes(normalizedTerm)
      ) {
        merged.set(code.code, code)
      }
    }
  } catch {
    // Local HSN master results still keep the product form usable if the public dataset is unavailable.
  }

  return Array.from(merged.values()).slice(0, limit)
}

async function loadPublicHsnCodes() {
  const now = Date.now()
  if (publicHsnCache && now - publicHsnCache.loadedAt < hsnCacheTtlMs) {
    return publicHsnCache.codes
  }

  const response = await fetch(hsnLookupDatasetUrl, {
    headers: {
      accept: "application/json",
      "user-agent": "GSTFY-HSN-Search/1.0",
    },
  })

  if (!response.ok) {
    throw new Error(`Public HSN search failed with status ${response.status}`)
  }

  const payload = (await response.json()) as unknown
  const codes = extractHsnRecords(payload)
    .map(normalizeHsnRecord)
    .filter((record): record is HsnSearchResult => Boolean(record))

  publicHsnCache = {
    loadedAt: now,
    codes,
  }

  return codes
}

function extractHsnRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.flatMap(extractHsnRecords)
  }

  if (!isRecord(payload)) {
    return []
  }

  if (findStringValue(payload, ["code", "hsn", "hsnCode", "hsn_code", "HSN"])) {
    return [payload]
  }

  const collectionKeys = ["data", "items", "records", "results", "hsn", "hsnCodes"]
  const collections = collectionKeys.flatMap((key) => extractHsnRecords(payload[key]))

  if (collections.length > 0) {
    return collections
  }

  return Object.values(payload).flatMap(extractHsnRecords)
}

function normalizeHsnRecord(record: Record<string, unknown>): HsnSearchResult | null {
  const code = findStringValue(record, [
    "code",
    "hsn",
    "hsnCode",
    "hsn_code",
    "HSN",
    "HSNCode",
  ])?.replace(/\D/g, "")
  const description = findStringValue(record, [
    "description",
    "hsnDescription",
    "hsn_description",
    "Description",
    "name",
    "commodity",
  ])
  const gstRate = findStringValue(record, [
    "gstRate",
    "gst_rate",
    "igst",
    "IGST",
    "rate",
    "taxRate",
    "tax_rate",
  ])?.replace(/[^\d.]/g, "")

  if (!code || !/^\d{4,8}$/.test(code) || !description) {
    return null
  }

  return {
    code,
    description,
    gstRate: gstRate || null,
    source: "hsnlookup",
  }
}

function findStringValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

async function validateTaxProfileForProduct(
  itemType: string,
  profile: {
    taxability: string
    hsnSac?: string | null
    gstRate: string
    effectiveFrom: string
    effectiveTo?: string | null
    status: string
  }
) {
  if (profile.status !== "ACTIVE" || !profile.hsnSac) {
    return
  }

  const expectedCodeType = itemType === "SERVICE" ? "SAC" : "HSN"
  const code = await db.query.hsnSacCodes.findFirst({
    where: and(
      eq(hsnSacCodes.code, profile.hsnSac),
      eq(hsnSacCodes.codeType, expectedCodeType),
      eq(hsnSacCodes.status, "active")
    ),
  })

  if (!code) {
    if (expectedCodeType === "HSN") {
      const externalMatches = await searchHsnCodes(profile.hsnSac, 10)
      const hasExternalMatch = externalMatches.some((match) => match.code === profile.hsnSac)

      if (hasExternalMatch) {
        return
      }
    }

    throw new HttpError(
      400,
      `${expectedCodeType} code is not available in the configured product master.`
    )
  }
}

async function validateUqcCode(code: string | null | undefined) {
  if (!code) {
    return
  }

  const uqc = await db.query.uqcCodes.findFirst({
    where: and(eq(uqcCodes.code, code), eq(uqcCodes.status, "active")),
  })

  if (!uqc) {
    throw new HttpError(400, "GST UQC is not available in the configured master.")
  }
}

async function validateAccountingAccounts(
  businessId: string,
  profile: Record<string, unknown>
) {
  const accountIds = Object.values(profile).filter(
    (value): value is string => typeof value === "string" && value.length > 0
  )

  if (accountIds.length === 0) {
    return
  }

  const rows = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(
      and(eq(ledgerAccounts.businessId, businessId), inArray(ledgerAccounts.id, accountIds))
    )

  if (rows.length !== new Set(accountIds).size) {
    throw new HttpError(400, "One or more ledger account mappings are invalid.")
  }
}

async function assertNoOverlappingTaxProfile(
  businessId: string,
  productId: string,
  profile: { effectiveFrom: string; effectiveTo?: string | null; status: string },
  excludeProfileId?: string
) {
  if (profile.status !== "ACTIVE") {
    return
  }

  const rows = await listTaxProfiles(businessId, productId)
  const overlaps = rows.some(
    (row) =>
      row.id !== excludeProfileId &&
      row.status === "ACTIVE" &&
      periodsOverlap(profile.effectiveFrom, profile.effectiveTo ?? null, row.effectiveFrom, row.effectiveTo)
  )

  if (overlaps) {
    throw new HttpError(409, "Tax profile effective dates overlap an active profile.")
  }
}

async function assertNoOverlappingPrice(
  businessId: string,
  productId: string,
  price: {
    priceType: string
    customerGroupId?: string | null
    minimumQuantity: string
    effectiveFrom: string
    effectiveTo?: string | null
    status: string
  },
  excludePriceId?: string
) {
  if (price.status !== "ACTIVE") {
    return
  }

  const rows = await listPrices(businessId, productId)
  const overlaps = rows.some(
    (row) =>
      row.id !== excludePriceId &&
      row.status === "ACTIVE" &&
      row.priceType === price.priceType &&
      (row.customerGroupId ?? null) === (price.customerGroupId ?? null) &&
      Number(row.minimumQuantity) === Number(price.minimumQuantity) &&
      periodsOverlap(price.effectiveFrom, price.effectiveTo ?? null, row.effectiveFrom, row.effectiveTo)
  )

  if (overlaps) {
    throw new HttpError(409, "Price profile effective dates overlap an active price.")
  }
}

function resolveTaxProfile(
  taxProfiles: ItemTaxProfileRecord[],
  transactionDate: string
) {
  return (
    taxProfiles.find(
      (profile) =>
        profile.status === "ACTIVE" &&
        profile.effectiveFrom <= transactionDate &&
        (!profile.effectiveTo || profile.effectiveTo >= transactionDate)
    ) ?? null
  )
}

function resolvePrice(
  prices: ItemPriceRecord[],
  transactionDate: string,
  priceType: string
) {
  return (
    prices.find(
      (price) =>
        price.status === "ACTIVE" &&
        price.priceType === priceType &&
        price.effectiveFrom <= transactionDate &&
        (!price.effectiveTo || price.effectiveTo >= transactionDate)
    ) ?? null
  )
}

function buildProductSnapshot(
  product: Awaited<ReturnType<typeof getProductDetail>>,
  transactionDate: string,
  priceType: string
) {
  const taxProfile = resolveTaxProfile(product.taxProfiles, transactionDate)
  const price = resolvePrice(product.prices, transactionDate, priceType)
  const unit = product.units[0] ?? null

  return {
    itemId: product.id,
    descriptionSnapshot: product.description ?? product.name,
    skuSnapshot: product.sku,
    hsnSacSnapshot: taxProfile?.hsnSac ?? null,
    uqcSnapshot: unit?.gstUqc ?? unit?.baseUnit ?? null,
    taxabilitySnapshot: taxProfile?.taxability ?? null,
    gstRateSnapshot: taxProfile?.gstRate ?? null,
    cessRuleSnapshot: taxProfile?.cessRuleId ?? null,
    sourceUnit: unit?.baseUnit ?? null,
    conversionFactor: unit?.conversionFactor ?? "1",
    rate: price?.price ?? null,
    rateTaxMode: price?.taxMode ?? null,
  }
}

async function findProductIdsBySearch(businessId: string, search: string) {
  const term = `%${escapeLikeTerm(search)}%`
  const [barcodeMatches, taxMatches, supplierMatches] = await Promise.all([
    db
      .select({ id: itemBarcodes.itemId })
      .from(itemBarcodes)
      .where(
        and(eq(itemBarcodes.businessId, businessId), ilike(itemBarcodes.barcode, term))
      ),
    db
      .select({ id: itemTaxProfiles.itemId })
      .from(itemTaxProfiles)
      .where(
        and(eq(itemTaxProfiles.businessId, businessId), ilike(itemTaxProfiles.hsnSac, term))
      ),
    db
      .select({ id: itemSuppliers.itemId })
      .from(itemSuppliers)
      .where(
        and(
          eq(itemSuppliers.businessId, businessId),
          ilike(itemSuppliers.supplierItemCode, term)
        )
      ),
  ])

  return Array.from(
    new Set([
      ...barcodeMatches.map((row) => row.id),
      ...taxMatches.map((row) => row.id),
      ...supplierMatches.map((row) => row.id),
    ])
  )
}

async function assertCanUseProducts(access: BusinessAccess, action: ProductAction) {
  if (access.membership.role === "owner" || access.membership.role === "admin") {
    return
  }

  const permission = await db.query.businessMemberPermissions.findFirst({
    where: and(
      eq(businessMemberPermissions.businessMemberId, access.membership.id),
      eq(businessMemberPermissions.module, "inventory")
    ),
  })

  const allowed =
    action === "view" ? permission?.canView
    : action === "create" ? permission?.canCreate
    : action === "edit" ? permission?.canEdit
    : permission?.canDelete

  if (!allowed) {
    throw new HttpError(403, "You do not have permission to manage products.")
  }
}

async function assertCanUploadProductImages(access: BusinessAccess) {
  try {
    await assertCanUseProducts(access, "create")
  } catch (error) {
    if (!(error instanceof HttpError) || error.statusCode !== 403) {
      throw error
    }

    await assertCanUseProducts(access, "edit")
  }
}

async function readProductImageFile(request: FastifyRequest) {
  try {
    const file = await request.file()

    if (file && file.fieldname !== "file") {
      throw new HttpError(
        400,
        "Upload product images using a multipart file field named \"file\"."
      )
    }

    return file
  } catch (error) {
    if (error instanceof HttpError) {
      throw error
    }

    throw getMultipartUploadError(error)
  }
}

async function readProductImageBuffer(file: ProductImageMultipartFile) {
  try {
    return await file.toBuffer()
  } catch (error) {
    throw getMultipartUploadError(error)
  }
}

function getMultipartUploadError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string" ?
      error.code
    : ""

  if (code === "FST_REQ_FILE_TOO_LARGE") {
    return new HttpError(
      400,
      `Product image must be ${productImageMaxSizeLabel} or smaller.`
    )
  }

  if (code === "FST_INVALID_MULTIPART_CONTENT_TYPE") {
    return new HttpError(
      400,
      "Upload product images as multipart/form-data with a file field named \"file\"."
    )
  }

  return new HttpError(
    400,
    "Unable to read product image upload. Use multipart/form-data with one file field named \"file\"."
  )
}

async function syncProductImages(
  businessId: string,
  productId: string,
  imageIds: string[] | undefined,
  userId: string
) {
  if (imageIds === undefined) {
    return
  }

  const uniqueImageIds = Array.from(new Set(imageIds))
  const now = new Date()

  if (uniqueImageIds.length > 0) {
    const imageRows = await db
      .select()
      .from(itemImages)
      .where(
        and(
          eq(itemImages.businessId, businessId),
          eq(itemImages.status, "ACTIVE"),
          inArray(itemImages.id, uniqueImageIds)
        )
      )

    if (imageRows.length !== uniqueImageIds.length) {
      throw new HttpError(400, "One or more product images are invalid.")
    }

    const alreadyAttachedToAnotherProduct = imageRows.find(
      (image) => image.itemId && image.itemId !== productId
    )

    if (alreadyAttachedToAnotherProduct) {
      throw new HttpError(400, "One or more images already belong to another product.")
    }
  }

  await db
    .update(itemImages)
    .set({
      itemId: null,
      isPrimary: false,
      sortOrder: 0,
      updatedBy: userId,
      updatedAt: now,
    })
    .where(and(eq(itemImages.businessId, businessId), eq(itemImages.itemId, productId)))

  await Promise.all(
    uniqueImageIds.map((imageId, index) =>
      db
        .update(itemImages)
        .set({
          itemId: productId,
          isPrimary: index === 0,
          sortOrder: index,
          updatedBy: userId,
          updatedAt: now,
        })
        .where(and(eq(itemImages.businessId, businessId), eq(itemImages.id, imageId)))
    )
  )
}

async function writeAudit(
  access: BusinessAccess,
  action: string,
  productId: string,
  before: unknown,
  after: unknown
) {
  await db.insert(auditLogs).values({
    businessId: access.business.id,
    entityType: "product",
    entityId: productId,
    action,
    userId: access.userId,
    before,
    after,
  })
}

function periodsOverlap(
  leftStart: string,
  leftEnd: string | null,
  rightStart: string,
  rightEnd: string | null
) {
  return leftStart <= (rightEnd ?? "9999-12-31") && rightStart <= (leftEnd ?? "9999-12-31")
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as Partial<T>
}

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}
