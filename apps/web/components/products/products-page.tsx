"use client"

import * as React from "react"
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  ArchiveIcon,
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  BarcodeIcon,
  BoxesIcon,
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  MinusIcon,
  MoreHorizontalIcon,
  PackageIcon,
  PencilLineIcon,
  PlusIcon,
  ReceiptTextIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  TagsIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectDisplayValue,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import type {
  ProductFormErrors,
  ProductFormState,
  SheetMode,
} from "@/components/products/product-form-types"
import { ProductUpsertDialog } from "@/components/products/product-upsert-dialog"
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  getBarcodeSubmitKeyFromKeyboardEventKey,
  readBarcodeScannerSettings,
} from "@/lib/barcode-scanner/settings"
import {
  archiveProduct,
  createProduct,
  createProductBrand,
  createProductCategory,
  getProduct,
  listProductMasters,
  listProducts,
  updateProduct,
  type CreateProductPayload,
  type ProductDetail,
  type ProductItemType,
  type ProductListItem,
  type ProductStatus,
  type Taxability,
  type UpdateProductPayload,
} from "@/lib/products/api"
import {
  getWarehouses,
} from "@/lib/organization/api"
import { getSettings } from "@/lib/settings/api"
import { listTaxRules } from "@/lib/tax/api"
import { cn } from "@/lib/utils"

type FilterState = {
  search: string
  itemType: ProductItemType | "all"
  status: ProductStatus | "all"
}

type ProductExportFormat = "csv" | "excel" | "pdf"
type ProductSortBy =
  | "name"
  | "sku"
  | "itemType"
  | "tax"
  | "gst"
  | "unit"
  | "price"
  | "inventory"
  | "status"
type ProductSortDir = "asc" | "desc"
type ProductColumnKey =
  | "product"
  | "hsn"
  | "gst"
  | "unit"
  | "price"
  | "inventory"
  | "status"

const itemTypeLabels: Record<ProductItemType, string> = {
  GOODS: "Goods",
  SERVICE: "Service",
}

const statusLabels: Record<ProductStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
}

const taxabilityLabels: Record<Taxability, string> = {
  TAXABLE: "Taxable",
  EXEMPT: "Exempt",
  NIL_RATED: "Nil rated",
  NON_GST: "Non-GST",
  ZERO_RATED: "Zero rated",
}

const itemTypes: ProductItemType[] = ["GOODS", "SERVICE"]
const statuses: ProductStatus[] = ["ACTIVE", "INACTIVE", "ARCHIVED"]
const itemTypeFilterOptions: ReadonlyArray<{
  value: FilterState["itemType"]
  label: string
}> = [
  { value: "all", label: "All types" },
  ...itemTypes.map((itemType) => ({
    value: itemType,
    label: itemTypeLabels[itemType],
  })),
]
const statusFilterOptions: ReadonlyArray<{
  value: FilterState["status"]
  label: string
}> = [
  { value: "all", label: "All statuses" },
  ...statuses.map((status) => ({
    value: status,
    label: statusLabels[status],
  })),
]
const productTableColumns: ReadonlyArray<{
  key: ProductColumnKey
  label: string
  widthClass: string
}> = [
  { key: "product", label: "Product", widthClass: "w-[27%]" },
  { key: "hsn", label: "HSN", widthClass: "w-[13%]" },
  { key: "gst", label: "GST", widthClass: "w-[9%]" },
  { key: "unit", label: "Unit", widthClass: "w-[9%]" },
  { key: "price", label: "Retail price", widthClass: "w-[13%]" },
  { key: "inventory", label: "Inventory", widthClass: "w-[14%]" },
  { key: "status", label: "Status", widthClass: "w-[8%]" },
]
const tablePageSize = 15

const emptyForm: ProductFormState = {
  name: "",
  itemType: "GOODS",
  sku: "",
  description: "",
  categoryId: "",
  brandId: "",
  manufacturer: "",
  modelNumber: "",
  status: "ACTIVE",
  taxability: "TAXABLE",
  hsnSac: "",
  gstRate: "18",
  cessRuleId: "",
  effectiveFrom: "2026-04-01",
  effectiveTo: "",
  baseUnit: "PCS",
  gstUqc: "PCS",
  conversionFactor: "1",
  price: "0",
  marginPercent: "0",
  taxMode: "EXCLUSIVE",
  barcode: "",
  trackInventory: true,
  defaultWarehouseId: "",
  reorderLevel: "0",
  minimumStock: "0",
  maximumStock: "0",
  batchTracking: false,
  serialTracking: false,
}

type ProductPriceWithOptionalMargin = {
  marginPercent?: string | number | null
}

function getProductMarginPercent(
  price: ProductListItem["activePrice"] | ProductDetail["activePrice"]
) {
  if (!price) {
    return "0"
  }

  const marginPercent = (price as ProductPriceWithOptionalMargin).marginPercent
  return marginPercent === undefined || marginPercent === null || marginPercent === ""
    ? "0"
    : String(marginPercent)
}

function createFormFromProduct(product: ProductListItem): ProductFormState {
  return {
    ...emptyForm,
    name: product.name,
    itemType: product.itemType,
    sku: product.sku,
    description: product.description ?? "",
    categoryId: product.categoryId ?? "",
    brandId: product.brandId ?? "",
    manufacturer: product.manufacturer ?? "",
    modelNumber: product.modelNumber ?? "",
    status: product.status,
    taxability: product.activeTaxProfile?.taxability ?? "TAXABLE",
    hsnSac: product.activeTaxProfile?.hsnSac ?? "",
    gstRate: product.activeTaxProfile?.gstRate ?? "0",
    cessRuleId: product.activeTaxProfile?.cessRuleId ?? "",
    effectiveFrom: product.activeTaxProfile?.effectiveFrom ?? "2026-04-01",
    effectiveTo: product.activeTaxProfile?.effectiveTo ?? "",
    baseUnit: product.unitProfile?.baseUnit ?? "PCS",
    gstUqc: product.unitProfile?.gstUqc ?? "",
    conversionFactor: product.unitProfile?.conversionFactor ?? "1",
    price: product.activePrice?.price ?? "0",
    marginPercent: getProductMarginPercent(product.activePrice),
    taxMode: product.activePrice?.taxMode ?? "EXCLUSIVE",
    barcode: product.primaryBarcode?.barcode ?? "",
    trackInventory: product.inventoryProfile?.trackInventory ?? product.itemType === "GOODS",
    defaultWarehouseId: product.inventoryProfile?.defaultWarehouseId ?? "",
    reorderLevel: product.inventoryProfile?.reorderLevel ?? "0",
    minimumStock: product.inventoryProfile?.minimumStock ?? "0",
    maximumStock: product.inventoryProfile?.maximumStock ?? "0",
    batchTracking: product.inventoryProfile?.batchTracking ?? false,
    serialTracking: product.inventoryProfile?.serialTracking ?? false,
  }
}

export function ProductsPage() {
  const storedSession = getStoredAuthSession()
  const accessToken = storedSession?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const [filters, setFilters] = React.useState<FilterState>({
    search: "",
    itemType: "all",
    status: "ACTIVE",
  })
  const [sortBy, setSortBy] = React.useState<ProductSortBy>("name")
  const [sortDir, setSortDir] = React.useState<ProductSortDir>("asc")
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([])
  const [visibleProductColumns, setVisibleProductColumns] = React.useState<
    ProductColumnKey[]
  >(() => productTableColumns.map((column) => column.key))
  const [sheetMode, setSheetMode] = React.useState<SheetMode | null>(null)
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null)
  const [detailProductId, setDetailProductId] = React.useState<string | null>(null)
  const [pendingArchive, setPendingArchive] = React.useState<ProductListItem | null>(null)
  const [formState, setFormState] = React.useState<ProductFormState>(emptyForm)
  const [formErrors, setFormErrors] = React.useState<ProductFormErrors>({})

  const productsQuery = useInfiniteQuery({
    queryKey: ["products", filters],
    queryFn: ({ pageParam }) =>
      listProducts(accessToken, {
        search: filters.search.trim() || undefined,
        itemType: filters.itemType === "all" ? undefined : filters.itemType,
        status: filters.status === "all" ? undefined : filters.status,
        page: pageParam,
        limit: tablePageSize,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: accessToken.length > 0,
    staleTime: 1000 * 60 * 3,
  })

  const mastersQuery = useQuery({
    queryKey: ["products", "masters"],
    queryFn: () => listProductMasters(accessToken),
    enabled: accessToken.length > 0,
    staleTime: 1000 * 60 * 10,
  })

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(accessToken),
    enabled: accessToken.length > 0,
    staleTime: 1000 * 60 * 5,
  })

  const warehousesQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => getWarehouses(accessToken),
    enabled: accessToken.length > 0,
    staleTime: 1000 * 60 * 5,
  })

  const taxRulesQuery = useQuery({
    queryKey: ["tax", "rules"],
    queryFn: () => listTaxRules(accessToken),
    enabled: accessToken.length > 0,
    staleTime: 1000 * 60 * 10,
  })

  const detailQuery = useQuery({
    queryKey: ["products", "detail", detailProductId],
    queryFn: () => getProduct(detailProductId ?? "", accessToken),
    enabled: accessToken.length > 0 && Boolean(detailProductId),
    staleTime: 1000 * 60 * 3,
  })

  const products = React.useMemo(
    () => productsQuery.data?.pages.flatMap((page) => page.products) ?? [],
    [productsQuery.data?.pages]
  )
  const sortedProducts = React.useMemo(
    () => sortProducts(products, sortBy, sortDir),
    [products, sortBy, sortDir]
  )
  const totalProductsCount =
    productsQuery.data?.pages[0]?.pagination.total ?? products.length
  const goodsProductsCount = products.filter(
    (product) => product.itemType === "GOODS"
  ).length
  const trackedStockProductsCount = products.filter(
    (product) => product.inventoryProfile?.trackInventory
  ).length
  const taxMappedProductsCount = products.filter(
    (product) => product.activeTaxProfile?.hsnSac
  ).length
  const detailProduct = detailQuery.data?.product ?? null
  const categoryOptions = mastersQuery.data?.categories.map((category) => category.name) ?? []
  const brandOptions = mastersQuery.data?.brands.map((brand) => brand.name) ?? []
  const hsnSacOptions =
    mastersQuery.data?.hsnSacCodes.filter((code) =>
      formState.itemType === "SERVICE" ? code.codeType === "SAC" : code.codeType === "HSN"
    ) ?? []
  const uqcOptions = mastersQuery.data?.uqcCodes ?? []
  const cessRuleOptions = taxRulesQuery.data?.cessRules ?? []
  const warehouseOptions = warehousesQuery.data?.warehouses ?? []
  const defaultWarehouse =
    warehouseOptions.find(
      (warehouse) =>
        warehouse.status.toLowerCase() === "active" && warehouse.warehouseCode === "MAIN"
    ) ??
    warehouseOptions.find((warehouse) => warehouse.status.toLowerCase() === "active") ??
    null
  const gstRateOptions = Array.from(
    new Set([
      ...(settingsQuery.data?.gstRateSettings.enabledGstSlabs ?? [5, 12, 18, 28]).map(
        String
      ),
      formState.gstRate,
    ].filter(Boolean))
  ).map((slab) => ({
    value: slab,
    label: `${slab}% GST`,
  }))
  const selectedProductIdsSet = React.useMemo(
    () => new Set(selectedProductIds),
    [selectedProductIds]
  )
  const selectedProducts = React.useMemo(
    () => products.filter((product) => selectedProductIdsSet.has(product.id)),
    [products, selectedProductIdsSet]
  )
  const selectedArchivableProducts = selectedProducts.filter(
    (product) => product.status !== "ARCHIVED"
  )
  const canBulkMarkActive = selectedProducts.some((product) => product.status !== "ACTIVE")
  const canBulkMarkInactive = selectedProducts.some(
    (product) => product.status !== "INACTIVE"
  )
  const visibleProductIds = sortedProducts.map((product) => product.id)
  const visibleProductColumnSet = React.useMemo(
    () => new Set(visibleProductColumns),
    [visibleProductColumns]
  )
  const productTableColumnCount = visibleProductColumns.length + 2
  const allVisibleProductsSelected =
    visibleProductIds.length > 0 &&
    visibleProductIds.every((productId) => selectedProductIdsSet.has(productId))
  const someVisibleProductsSelected =
    visibleProductIds.some((productId) => selectedProductIdsSet.has(productId)) &&
    !allVisibleProductsSelected

  const upsertMutation = useMutation({
    mutationFn: (payload: {
      mode: SheetMode
      productId?: string
      form: ProductFormState
    }) => {
      if (payload.mode === "edit" && payload.productId) {
        return updateProduct(payload.productId, buildUpdatePayload(payload.form), accessToken)
      }

      return createProduct(buildCreatePayload(payload.form), accessToken)
    },
    onSuccess: async (response) => {
      toast.success(
        sheetMode === "edit" ? "Product updated" : "Product created",
        { description: `${response.product.name} is ready for transaction resolution.` }
      )
      await queryClient.invalidateQueries({ queryKey: ["products"] })
      closeSheet()
    },
    onError: (error) => {
      toast.error(
        "Product save failed",
        {
          description:
            error instanceof Error ?
              error.message
            : "Check the product details and try again.",
        }
      )
    },
  })

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => createProductCategory(name, accessToken),
    onSuccess: async (response) => {
      setFormState((current) => ({ ...current, categoryId: response.category.name }))
      await queryClient.invalidateQueries({ queryKey: ["products", "masters"] })
    },
    onError: (error) => {
      toast.error("Category save failed", {
        description:
          error instanceof Error ? error.message : "Unable to create product category.",
      })
    },
  })

  const createBrandMutation = useMutation({
    mutationFn: (name: string) => createProductBrand(name, accessToken),
    onSuccess: async (response) => {
      setFormState((current) => ({ ...current, brandId: response.brand.name }))
      await queryClient.invalidateQueries({ queryKey: ["products", "masters"] })
    },
    onError: (error) => {
      toast.error("Brand save failed", {
        description:
          error instanceof Error ? error.message : "Unable to create product brand.",
      })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (productId: string) => archiveProduct(productId, accessToken),
    onSuccess: async () => {
      toast.success("Product archived", {
        description: "The product is hidden from normal selection.",
      })
      await queryClient.invalidateQueries({ queryKey: ["products"] })
      setPendingArchive(null)
    },
    onError: (error) => {
      toast.error(
        "Archive failed",
        {
          description:
            error instanceof Error ? error.message : "Unable to archive this product.",
        }
      )
    },
  })

  const bulkStatusMutation = useMutation({
    mutationFn: async (status: ProductStatus) => {
      await Promise.all(
        selectedProducts.map((product) =>
          updateProduct(product.id, { status }, accessToken)
        )
      )
    },
    onSuccess: async (_, status) => {
      toast.success("Products updated", {
        description: `${selectedProducts.length} product${selectedProducts.length === 1 ? "" : "s"} marked ${statusLabels[status].toLowerCase()}.`,
      })
      await queryClient.invalidateQueries({ queryKey: ["products"] })
      setSelectedProductIds([])
    },
    onError: (error) => {
      toast.error("Bulk update failed", {
        description:
          error instanceof Error ? error.message : "Unable to update selected products.",
      })
    },
  })

  const bulkArchiveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        selectedArchivableProducts.map((product) =>
          archiveProduct(product.id, accessToken)
        )
      )
    },
    onSuccess: async () => {
      toast.success("Products archived", {
        description: `${selectedArchivableProducts.length} product${selectedArchivableProducts.length === 1 ? "" : "s"} moved out of normal selection.`,
      })
      await queryClient.invalidateQueries({ queryKey: ["products"] })
      setSelectedProductIds([])
    },
    onError: (error) => {
      toast.error("Bulk archive failed", {
        description:
          error instanceof Error ? error.message : "Unable to archive selected products.",
      })
    },
  })

  function openCreateSheet() {
    setSheetMode("create")
    setSelectedProductId(null)
    setFormState({
      ...emptyForm,
      sku: generateProductSku(emptyForm.itemType),
      defaultWarehouseId: defaultWarehouse?.id ?? "",
    })
    setFormErrors({})
  }

  function openEditSheet(product: ProductListItem) {
    setSheetMode("edit")
    setSelectedProductId(product.id)
    setFormState(createFormFromProduct(product))
    setFormErrors({})
  }

  function closeSheet() {
    setSheetMode(null)
    setSelectedProductId(null)
    setFormState(emptyForm)
    setFormErrors({})
  }

  function updateForm<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setFormState((current) => {
      const next = { ...current, [key]: value }

      if (key === "itemType") {
        next.hsnSac = ""
        next.trackInventory = value === "GOODS"
        next.baseUnit = value === "SERVICE" ? "NOS" : "PCS"
        next.gstUqc = value === "SERVICE" ? "NOS" : "PCS"
        next.defaultWarehouseId = value === "GOODS" ? current.defaultWarehouseId || defaultWarehouse?.id || "" : ""

        if (sheetMode === "create") {
          next.sku = generateProductSku(value as ProductItemType)
        }
      }

      if (key === "trackInventory") {
        next.defaultWarehouseId = value ? current.defaultWarehouseId || defaultWarehouse?.id || "" : ""
      }

      return next
    })

    setFormErrors((current) => ({ ...current, [key]: undefined }))
  }

  function generateBarcodeForProduct() {
    updateForm("barcode", generateEan13Barcode())
    toast.success("Barcode generated", {
      description: "A valid EAN-13 barcode value was added to this product.",
    })
  }

  function handlePrimaryBarcodeKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const submitKey = getBarcodeSubmitKeyFromKeyboardEventKey(event.key)

    if (!submitKey) {
      return
    }

    const scannerSettings = readBarcodeScannerSettings()

    if (
      !scannerSettings.enabled ||
      scannerSettings.submitKey === "none" ||
      scannerSettings.submitKey !== submitKey
    ) {
      return
    }

    const barcode = event.currentTarget.value.trim()

    if (barcode.length < scannerSettings.minLength) {
      return
    }

    event.preventDefault()
    updateForm("barcode", barcode)
    toast.success("Barcode captured", {
      description: "Scanner input was accepted for this product.",
    })
  }

  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = validateProductForm(formState, sheetMode ?? "create")

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    upsertMutation.mutate({
      mode: sheetMode ?? "create",
      productId: selectedProductId ?? undefined,
      form: formState,
    })
  }

  function handleProductsTableScroll(event: React.UIEvent<HTMLDivElement>) {
    const target = event.currentTarget
    const remainingScroll =
      target.scrollHeight - target.scrollTop - target.clientHeight

    if (
      remainingScroll < 160 &&
      productsQuery.hasNextPage &&
      !productsQuery.isFetchingNextPage
    ) {
      void productsQuery.fetchNextPage()
    }
  }

  function handleSortChange(nextSortBy: ProductSortBy) {
    setSortDir((currentSortDir) =>
      sortBy === nextSortBy && currentSortDir === "asc" ? "desc" : "asc"
    )
    setSortBy(nextSortBy)
  }

  function toggleProductSelection(product: ProductListItem) {
    setSelectedProductIds((current) =>
      current.includes(product.id) ?
        current.filter((productId) => productId !== product.id)
      : [...current, product.id]
    )
  }

  function toggleAllVisibleProducts() {
    setSelectedProductIds((current) => {
      if (allVisibleProductsSelected) {
        return current.filter((productId) => !visibleProductIds.includes(productId))
      }

      return Array.from(new Set([...current, ...visibleProductIds]))
    })
  }

  function toggleProductColumn(columnKey: ProductColumnKey) {
    setVisibleProductColumns((current) => {
      if (current.includes(columnKey)) {
        return current.length === 1 ?
            current
          : current.filter((key) => key !== columnKey)
      }

      const next = [...current, columnKey]
      return productTableColumns
        .map((column) => column.key)
        .filter((key) => next.includes(key))
    })
  }

  function handleProductExport(format: ProductExportFormat) {
    if (sortedProducts.length === 0) {
      toast.error("No products to export", {
        description: "Adjust the filters or add products before exporting.",
      })
      return
    }

    if (format === "pdf") {
      const didOpen = printProductsPdf(sortedProducts)

      if (!didOpen) {
        toast.error("Allow pop-ups to export the product PDF.")
      }

      return
    }

    const fileDate = new Date().toISOString().slice(0, 10)
    const extension = format === "excel" ? "xls" : "csv"
    const contentType =
      format === "excel" ? "application/vnd.ms-excel;charset=utf-8" : "text/csv;charset=utf-8"

    downloadTextFile(
      `products-${fileDate}.${extension}`,
      buildProductsCsv(sortedProducts),
      contentType
    )
    toast.success("Product export ready", {
      description: `${sortedProducts.length} loaded product${sortedProducts.length === 1 ? "" : "s"} exported.`,
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="p-3.5 sm:p-4 lg:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 bg-background">
                <PackageIcon className="size-3.5" />
                Product Master
              </Badge>
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <span className="size-1.5 rounded-full bg-current" />
                GST mapped
              </Badge>
            </div>
            <div className="mt-3 max-w-2xl space-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Products
              </h1>
              <p className="max-w-xl text-sm leading-5 text-muted-foreground">
                Add goods and services with SKU, HSN/SAC, GST rate, price, unit,
                barcode, and stock defaults.
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="button" className="h-8 rounded-lg" onClick={openCreateSheet}>
                <PlusIcon className="size-4" />
                Add Product
              </Button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <PackageIcon className="size-3.5" />
                Product defaults flow into sales, purchases, tax, and stock.
              </div>
            </div>
          </div>
          <div className="border-t border-border bg-muted/10 p-3.5 sm:p-4 lg:border-l lg:border-t-0 lg:p-5">
            <div className="grid grid-cols-2 gap-2">
              <ProductTopMetric
                icon={<PackageIcon className="size-4" />}
                label="Visible"
                value={products.length.toString()}
              />
              <ProductTopMetric
                icon={<BoxesIcon className="size-4" />}
                label="Goods"
                value={goodsProductsCount.toString()}
                tone="success"
              />
              <ProductTopMetric
                icon={<ReceiptTextIcon className="size-4" />}
                label="GST"
                value={taxMappedProductsCount.toString()}
              />
              <ProductTopMetric
                icon={<TagsIcon className="size-4" />}
                label="Stock"
                value={trackedStockProductsCount.toString()}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
        <div className="border-b border-border px-4 py-3 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:max-w-5xl">
              <div className="relative sm:w-72 lg:w-[28rem] xl:w-[34rem]">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, search: event.target.value }))
                  }
                  placeholder="Search product, SKU, barcode, HSN/SAC, supplier code..."
                  className="h-7 rounded-md pl-7 text-xs"
                />
              </div>
              <Select
                value={filters.itemType}
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    itemType: value as FilterState["itemType"],
                  }))
                }
              >
                <SelectTrigger size="sm" className="w-full justify-between sm:w-32">
                  <SelectDisplayValue
                    value={filters.itemType}
                    options={itemTypeFilterOptions}
                    placeholder="Type"
                  />
                </SelectTrigger>
                <SelectContent align="start" sideOffset={6} className="min-w-32">
                  {itemTypeFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    status: value as FilterState["status"],
                  }))
                }
              >
                <SelectTrigger size="sm" className="w-full justify-between sm:w-32">
                  <SelectDisplayValue
                    value={filters.status}
                    options={statusFilterOptions}
                    placeholder="Status"
                  />
                </SelectTrigger>
                <SelectContent align="start" sideOffset={6} className="min-w-32">
                  {statusFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 justify-center gap-1.5 rounded-md text-xs sm:w-auto"
                    />
                  }
                >
                  <SlidersHorizontalIcon className="size-3.5" />
                  Columns
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {productTableColumns.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.key}
                        checked={visibleProductColumnSet.has(column.key)}
                        disabled={
                          visibleProductColumns.length === 1 &&
                          visibleProductColumnSet.has(column.key)
                        }
                        onCheckedChange={() => toggleProductColumn(column.key)}
                      >
                        {column.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 justify-center gap-1.5 rounded-md text-xs sm:w-auto"
                    />
                  }
                >
                  <DownloadIcon className="size-3.5" />
                  Export
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Export loaded rows</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleProductExport("csv")}>
                      <FileSpreadsheetIcon />
                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleProductExport("excel")}>
                      <FileSpreadsheetIcon />
                      Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleProductExport("pdf")}>
                      <FileTextIcon />
                      PDF
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div
          onScroll={handleProductsTableScroll}
          className="app-scrollbar max-h-[35rem] overflow-auto"
        >
          {selectedProducts.length > 0 ? (
            <div className="flex flex-col gap-2 border-b border-border bg-muted/20 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
              <div className="text-sm">
                <span className="font-medium">{selectedProducts.length}</span> selected
                <span className="ml-2 text-muted-foreground">
                  {selectedArchivableProducts.length} archivable
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canBulkMarkActive || bulkStatusMutation.isPending}
                  onClick={() => bulkStatusMutation.mutate("ACTIVE")}
                >
                  Mark active
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canBulkMarkInactive || bulkStatusMutation.isPending}
                  onClick={() => bulkStatusMutation.mutate("INACTIVE")}
                >
                  Mark inactive
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={
                    selectedArchivableProducts.length === 0 ||
                    bulkArchiveMutation.isPending
                  }
                  onClick={() => bulkArchiveMutation.mutate()}
                >
                  Archive selected
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProductIds([])}
                >
                  Clear
                </Button>
              </div>
            </div>
          ) : null}
          <Table className="w-full table-fixed text-[11px] sm:text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-2">
            <colgroup>
              <col className="w-[4%]" />
              {productTableColumns
                .filter((column) => visibleProductColumnSet.has(column.key))
                .map((column) => (
                  <col key={column.key} className={column.widthClass} />
                ))}
              <col className="w-[7%]" />
            </colgroup>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-3">
                  <SelectionCheckbox
                    checked={allVisibleProductsSelected}
                    indeterminate={someVisibleProductsSelected}
                    disabled={visibleProductIds.length === 0}
                    label="Select all products"
                    onCheckedChange={toggleAllVisibleProducts}
                  />
                </TableHead>
                {visibleProductColumnSet.has("product") ? (
                  <SortableProductsTableHead
                    sortKey="name"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSortChange}
                  >
                    Product
                  </SortableProductsTableHead>
                ) : null}
                {visibleProductColumnSet.has("hsn") ? (
                  <SortableProductsTableHead
                    sortKey="tax"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSortChange}
                  >
                    HSN
                  </SortableProductsTableHead>
                ) : null}
                {visibleProductColumnSet.has("gst") ? (
                  <SortableProductsTableHead
                    sortKey="gst"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSortChange}
                  >
                    GST
                  </SortableProductsTableHead>
                ) : null}
                {visibleProductColumnSet.has("unit") ? (
                  <SortableProductsTableHead
                    sortKey="unit"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSortChange}
                  >
                    Unit
                  </SortableProductsTableHead>
                ) : null}
                {visibleProductColumnSet.has("price") ? (
                  <SortableProductsTableHead
                    sortKey="price"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSortChange}
                    className="text-right"
                  >
                    Retail price
                  </SortableProductsTableHead>
                ) : null}
                {visibleProductColumnSet.has("inventory") ? (
                  <SortableProductsTableHead
                    sortKey="inventory"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSortChange}
                  >
                    Inventory
                  </SortableProductsTableHead>
                ) : null}
                {visibleProductColumnSet.has("status") ? (
                  <SortableProductsTableHead
                    sortKey="status"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSortChange}
                  >
                    Status
                  </SortableProductsTableHead>
                ) : null}
                <TableHead className="pr-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsQuery.isLoading ?
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={productTableColumnCount}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : sortedProducts.length === 0 ?
                <TableRow>
                  <TableCell colSpan={productTableColumnCount} className="py-12 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                      <PackageIcon className="size-8 text-muted-foreground" />
                      <p className="font-medium">No products found</p>
                      <p className="text-sm text-muted-foreground">
                        Add products with GST and price defaults before creating sales or
                        purchase documents.
                      </p>
                      <Button onClick={openCreateSheet} size="sm" className="mt-2">
                        Add first product
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              : sortedProducts.map((product) => {
                  const isSelected = selectedProductIdsSet.has(product.id)

                  return (
                  <TableRow key={product.id} data-state={isSelected ? "selected" : undefined}>
                    <TableCell className="pl-3">
                      <SelectionCheckbox
                        checked={isSelected}
                        label={`Select ${product.name}`}
                        onCheckedChange={() => toggleProductSelection(product)}
                      />
                    </TableCell>
                    {visibleProductColumnSet.has("product") ? (
                      <TableCell>
                        <div className="min-w-0 space-y-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium">{product.name}</span>
                            <Badge variant="outline" className="shrink-0">
                              {itemTypeLabels[product.itemType]}
                            </Badge>
                          </div>
                          <p className="truncate font-mono text-xs tracking-[0.14em] text-muted-foreground">
                            {product.sku}
                          </p>
                        </div>
                      </TableCell>
                    ) : null}
                    {visibleProductColumnSet.has("hsn") ? (
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <p className="truncate font-mono">
                            {product.activeTaxProfile?.hsnSac ?? "Not mapped"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {product.activeTaxProfile ?
                              taxabilityLabels[product.activeTaxProfile.taxability]
                            : "Tax profile missing"}
                          </p>
                        </div>
                      </TableCell>
                    ) : null}
                    {visibleProductColumnSet.has("gst") ? (
                      <TableCell>
                        <span className="font-mono text-sm">
                          {product.activeTaxProfile ? `${product.activeTaxProfile.gstRate}%` : "-"}
                        </span>
                      </TableCell>
                    ) : null}
                    {visibleProductColumnSet.has("unit") ? (
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <p>{product.unitProfile?.baseUnit ?? "PCS"}</p>
                          <p className="text-xs text-muted-foreground">
                            UQC {product.unitProfile?.gstUqc ?? "-"}
                          </p>
                        </div>
                      </TableCell>
                    ) : null}
                    {visibleProductColumnSet.has("price") ? (
                      <TableCell className="text-right font-mono">
                        {formatCurrency(product.activePrice?.price ?? "0")}
                      </TableCell>
                    ) : null}
                    {visibleProductColumnSet.has("inventory") ? (
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1.5",
                            product.inventoryProfile?.trackInventory &&
                              "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                          )}
                        >
                          <BoxesIcon className="size-3.5" />
                          {product.inventoryProfile?.trackInventory ? "Tracked" : "Not tracked"}
                        </Badge>
                      </TableCell>
                    ) : null}
                    {visibleProductColumnSet.has("status") ? (
                      <TableCell>
                        <StatusBadge status={product.status} />
                      </TableCell>
                    ) : null}
                    <TableCell className="pr-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                          <MoreHorizontalIcon className="size-4" />
                          <span className="sr-only">Open product actions</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailProductId(product.id)}>
                            <EyeIcon />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditSheet(product)}>
                            <PencilLineIcon />
                            Edit product
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setPendingArchive(product)}
                          >
                            <ArchiveIcon />
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  )
                })
              }
            </TableBody>
          </Table>
          {productsQuery.isFetchingNextPage ? (
            <div className="flex items-center justify-center gap-2 border-t border-border px-3 py-3 text-xs text-muted-foreground">
              <Spinner />
              Loading more products
            </div>
          ) : productsQuery.hasNextPage ? (
            <div className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
              Scroll to load more · {products.length} of {totalProductsCount}
            </div>
          ) : products.length > tablePageSize ? (
            <div className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
              All {totalProductsCount} products loaded
            </div>
          ) : null}
        </div>
      </section>

      <ProductUpsertDialog
        accessToken={accessToken}
        open={Boolean(sheetMode)}
        mode={sheetMode}
        formState={formState}
        formErrors={formErrors}
        brandOptions={brandOptions}
        categoryOptions={categoryOptions}
        hsnSacOptions={hsnSacOptions}
        uqcOptions={uqcOptions}
        cessRuleOptions={cessRuleOptions}
        warehouseOptions={warehouseOptions}
        gstRateOptions={gstRateOptions}
        pending={upsertMutation.isPending}
        creatingBrand={createBrandMutation.isPending}
        creatingCategory={createCategoryMutation.isPending}
        onClose={closeSheet}
        onSubmit={submitForm}
        onUpdate={updateForm}
        onCreateBrand={(name) => createBrandMutation.mutate(name)}
        onCreateCategory={(name) => createCategoryMutation.mutate(name)}
        onGenerateBarcode={generateBarcodeForProduct}
        onBarcodeKeyDown={handlePrimaryBarcodeKeyDown}
      />

      <Dialog
        open={Boolean(detailProductId)}
        onOpenChange={(open) => !open && setDetailProductId(null)}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-5xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-3 pr-12">
            <DialogTitle>Product details</DialogTitle>
            <DialogDescription>
              Full product defaults resolved for sales, purchase, tax and stock flows.
            </DialogDescription>
          </DialogHeader>
          <div className="app-scrollbar max-h-[calc(100vh-8.5rem)] overflow-y-auto px-5 py-4">
            {detailQuery.isLoading || !detailProduct ?
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          : <ProductDetailView product={detailProduct} warehouses={warehouseOptions} />}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingArchive)} onOpenChange={(open) => !open && setPendingArchive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive product?</DialogTitle>
            <DialogDescription>
              Used products are never hard-deleted. This will hide{" "}
              <span className="font-medium text-foreground">{pendingArchive?.name}</span>{" "}
              from normal product selection.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingArchive(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={archiveMutation.isPending}
              onClick={() => pendingArchive && archiveMutation.mutate(pendingArchive.id)}
            >
              {archiveMutation.isPending ? <Spinner /> : null}
              {archiveMutation.isPending ? "" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ProductDetailView({
  product,
  warehouses,
}: {
  product: ProductDetail
  warehouses: Array<{ id: string; name: string; warehouseCode: string }>
}) {
  const taxProfile = product.activeTaxProfile
  const unit = product.units[0] ?? null
  const price = product.activePrice
  const inventory = product.inventoryProfile
  const defaultWarehouse =
    inventory?.defaultWarehouseId ?
      warehouses.find((warehouse) => warehouse.id === inventory.defaultWarehouseId)
    : null
  const taxPreview = getProductTaxPreview(price?.price ?? "0", getProductMarginPercent(price), taxProfile?.gstRate ?? "0", price?.taxMode ?? "EXCLUSIVE")

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-muted/20 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{product.name}</h2>
              <StatusBadge status={product.status} />
              <Badge variant="outline" className="bg-background">
                {itemTypeLabels[product.itemType]}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono tracking-[0.14em]">{product.sku}</span>
              {product.primaryBarcode?.barcode ?
                <>
                  <span>·</span>
                  <span className="font-mono">{product.primaryBarcode.barcode}</span>
                </>
              : null}
            </div>
            {product.description ?
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {product.description}
              </p>
            : null}
          </div>
          <div className="grid min-w-56 gap-2 rounded-xl border border-border bg-background p-3 text-sm">
            <CompactRow label="Manufacturer" value={product.manufacturer ?? "-"} />
            <CompactRow label="Model" value={product.modelNumber ?? "-"} />
            <CompactRow label="Category" value={product.categoryId ?? "-"} />
            <CompactRow label="Brand" value={product.brandId ?? "-"} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ProductDetailSection
          icon={<ReceiptTextIcon className="size-4" />}
          title="Tax defaults"
          rows={[
            ["HSN/SAC", taxProfile?.hsnSac ?? "-"],
            ["Taxability", taxProfile ? taxabilityLabels[taxProfile.taxability] : "-"],
            ["GST rate", taxProfile ? `${taxProfile.gstRate}%` : "-"],
            ["Cess rule", taxProfile?.cessRuleId ?? "-"],
            ["Effective from", taxProfile?.effectiveFrom ?? "-"],
            ["Effective to", taxProfile?.effectiveTo ?? "-"],
            ["Tax status", taxProfile ? statusLabels[taxProfile.status] : "-"],
          ]}
        />
        <ProductDetailSection
          icon={<TagsIcon className="size-4" />}
          title="Retail price"
          rows={[
            ["Price type", price?.priceType ?? "-"],
            ["Retail price", formatCurrency(price?.price ?? "0")],
            ["Margin", `${getProductMarginPercent(price)}%`],
            ["Tax mode", price?.taxMode ?? "-"],
            ["Currency", price?.currency ?? "INR"],
            ["Minimum quantity", price?.minimumQuantity ?? "-"],
            ["Effective from", price?.effectiveFrom ?? "-"],
            ["Effective to", price?.effectiveTo ?? "-"],
            ["Price status", price ? statusLabels[price.status] : "-"],
          ]}
        />
        <ProductDetailSection
          icon={<BoxesIcon className="size-4" />}
          title="Unit and inventory"
          rows={[
            ["Base unit", unit?.baseUnit ?? "-"],
            ["Secondary unit", unit?.secondaryUnit ?? "-"],
            ["Conversion factor", unit?.conversionFactor ?? "-"],
            ["GST UQC", unit?.gstUqc ?? "-"],
            ["Track inventory", inventory?.trackInventory ? "Yes" : "No"],
            [
              "Default warehouse",
              defaultWarehouse ?
                `${defaultWarehouse.name} (${defaultWarehouse.warehouseCode})`
              : inventory?.defaultWarehouseId ?? "-",
            ],
            ["Reorder level", inventory?.reorderLevel ?? "0"],
            ["Minimum stock", inventory?.minimumStock ?? "0"],
            ["Maximum stock", inventory?.maximumStock ?? "0"],
            ["Batch tracking", inventory?.batchTracking ? "Yes" : "No"],
            ["Serial tracking", inventory?.serialTracking ? "Yes" : "No"],
          ]}
        />
        <ProductDetailSection
          icon={<BarcodeIcon className="size-4" />}
          title="Barcodes and links"
          rows={[
            ["Primary barcode", product.primaryBarcode?.barcode ?? "-"],
            ["Barcode count", product.barcodes.length.toString()],
            ["Supplier links", product.suppliers.length.toString()],
            ["Tax profiles", product.taxProfiles.length.toString()],
            ["Price profiles", product.prices.length.toString()],
          ]}
        />
      </div>

      <div className="rounded-2xl border border-border p-4">
        <div className="mb-3 flex items-center gap-2">
          <ReceiptTextIcon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">GST calculation preview</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-5">
          <ProductPreviewMetric
            label="Margin"
            value={formatCurrency(taxPreview.marginAmount)}
          />
          <ProductPreviewMetric
            label="Rate after margin"
            value={formatCurrency(taxPreview.rateAfterMargin)}
          />
          <ProductPreviewMetric
            label="CGST + SGST"
            value={`${formatCurrency(taxPreview.cgst)} + ${formatCurrency(taxPreview.sgst)}`}
          />
          <ProductPreviewMetric label="IGST" value={formatCurrency(taxPreview.igst)} />
          <ProductPreviewMetric
            label="Final rate"
            value={formatCurrency(taxPreview.finalRate)}
            highlight
          />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <ProductCollectionCard
          title="Tax profile history"
          emptyText="No tax profiles added."
          rows={product.taxProfiles.map((profile) => ({
            title: `${profile.hsnSac ?? "-"} · ${profile.gstRate}%`,
            description: `${taxabilityLabels[profile.taxability]} · ${profile.effectiveFrom}${profile.effectiveTo ? ` to ${profile.effectiveTo}` : ""}`,
            status: statusLabels[profile.status],
          }))}
        />
        <ProductCollectionCard
          title="Price history"
          emptyText="No price profiles added."
          rows={product.prices.map((profile) => ({
            title: `${profile.priceType} · ${formatCurrency(profile.price)}`,
            description: `${getProductMarginPercent(profile)}% margin · ${profile.taxMode} · min ${profile.minimumQuantity}`,
            status: statusLabels[profile.status],
          }))}
        />
        <ProductCollectionCard
          title="Barcodes and suppliers"
          emptyText="No barcode or supplier mappings."
          rows={[
            ...product.barcodes.map((barcode) => ({
              title: barcode.barcode,
              description: `${barcode.barcodeType ?? "Barcode"}${barcode.isPrimary ? " · Primary" : ""}`,
              status: statusLabels[barcode.status],
            })),
            ...product.suppliers.map((supplier) => ({
              title: supplier.supplierName,
              description: `Code ${supplier.supplierItemCode ?? "-"} · price ${supplier.purchasePrice ? formatCurrency(supplier.purchasePrice) : "-"}`,
              status: supplier.isPreferred ? "Preferred" : statusLabels[supplier.status],
            })),
          ]}
        />
      </div>
    </div>
  )
}

function ProductDetailSection({
  icon,
  rows,
  title,
}: {
  icon: React.ReactNode
  rows: Array<[string, string]>
  title: string
}) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <div className="grid gap-2">
        {rows.map(([label, value]) => (
          <CompactRow key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  )
}

function ProductCollectionCard({
  emptyText,
  rows,
  title,
}: {
  emptyText: string
  rows: Array<{ description: string; status: string; title: string }>
  title: string
}) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {rows.length === 0 ?
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      : <div className="space-y-2">
          {rows.map((row, index) => (
            <div
              key={`${row.title}-${index}`}
              className="rounded-xl border border-border bg-muted/20 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {row.description}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                  {row.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  )
}

function CompactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-3 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-medium">{value}</span>
    </div>
  )
}

function ProductPreviewMetric({
  highlight,
  label,
  value,
}: {
  highlight?: boolean
  label: string
  value: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background px-3 py-2",
        highlight && "border-emerald-200 bg-emerald-50 text-emerald-800"
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-sm font-medium">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: ProductStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "ACTIVE" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
        status === "ARCHIVED" &&
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
      )}
    >
      {statusLabels[status]}
    </Badge>
  )
}

function SortableProductsTableHead({
  children,
  className,
  onSort,
  sortBy,
  sortDir,
  sortKey,
}: {
  children: React.ReactNode
  className?: string
  onSort: (sortBy: ProductSortBy) => void
  sortBy: ProductSortBy
  sortDir: ProductSortDir
  sortKey: ProductSortBy
}) {
  const isActive = sortBy === sortKey
  const SortIcon =
    !isActive ? ArrowUpDownIcon
    : sortDir === "asc" ? ArrowUpIcon
    : ArrowDownIcon

  return (
    <TableHead className={className}>
      <button
        type="button"
        className={cn(
          "flex max-w-full items-center gap-1 rounded-md text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className?.includes("text-right") && "ml-auto text-right",
          isActive ? "text-primary" : "text-foreground"
        )}
        onClick={() => onSort(sortKey)}
      >
        <span className="truncate">{children}</span>
        <SortIcon
          className={cn(
            "size-3 shrink-0",
            !isActive && "text-muted-foreground/70"
          )}
        />
      </button>
    </TableHead>
  )
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  label,
  onCheckedChange,
}: {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  label: string
  onCheckedChange: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      disabled={disabled}
      onClick={onCheckedChange}
      className={cn(
        "flex size-4 items-center justify-center rounded-sm border border-input bg-background text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40",
        (checked || indeterminate) && "border-primary bg-primary text-primary-foreground"
      )}
    >
      {checked ? (
        <CheckIcon className="size-3" />
      ) : indeterminate ? (
        <MinusIcon className="size-3" />
      ) : null}
    </button>
  )
}

function ProductTopMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: "success"
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground",
            tone === "success" &&
              "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function sortProducts(
  products: ProductListItem[],
  sortBy: ProductSortBy,
  sortDir: ProductSortDir
) {
  return [...products].sort((first, second) => {
    const firstValue = getProductSortValue(first, sortBy)
    const secondValue = getProductSortValue(second, sortBy)

    if (typeof firstValue === "number" && typeof secondValue === "number") {
      return sortDir === "asc" ? firstValue - secondValue : secondValue - firstValue
    }

    const result = String(firstValue).localeCompare(String(secondValue), "en-IN", {
      numeric: true,
      sensitivity: "base",
    })

    return sortDir === "asc" ? result : -result
  })
}

function getProductSortValue(product: ProductListItem, sortBy: ProductSortBy) {
  switch (sortBy) {
    case "name":
      return product.name
    case "sku":
      return product.sku
    case "itemType":
      return itemTypeLabels[product.itemType]
    case "tax":
      return product.activeTaxProfile?.hsnSac ?? ""
    case "gst":
      return Number(product.activeTaxProfile?.gstRate ?? 0)
    case "unit":
      return product.unitProfile?.baseUnit ?? "PCS"
    case "price":
      return Number(product.activePrice?.price ?? 0)
    case "inventory":
      return product.inventoryProfile?.trackInventory ? 1 : 0
    case "status":
      return statusLabels[product.status]
    default:
      return product.name
  }
}

function generateProductSku(itemType: ProductItemType) {
  const prefix = itemType === "SERVICE" ? "SRV" : "PRD"
  const datePart = new Date()
    .toISOString()
    .slice(2, 10)
    .replaceAll("-", "")
  const randomPart = Math.floor(Math.random() * 9000 + 1000)

  return `${prefix}-${datePart}-${randomPart}`
}

function generateEan13Barcode() {
  const body = `890${Math.floor(Math.random() * 1_000_000_000)
    .toString()
    .padStart(9, "0")}`

  return `${body}${getEan13CheckDigit(body)}`
}

function getEan13CheckDigit(firstTwelveDigits: string) {
  const total = firstTwelveDigits
    .split("")
    .map((digit) => Number(digit))
    .reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 1 : 3), 0)

  return String((10 - (total % 10)) % 10)
}

function validateProductForm(form: ProductFormState, mode: SheetMode) {
  const errors: ProductFormErrors = {}

  if (!form.name.trim()) {
    errors.name = "Product name is required."
  }

  if (!form.sku.trim()) {
    errors.sku = "SKU is required."
  }

  if (mode === "create") {
    if (form.taxability === "TAXABLE" && !form.hsnSac.trim()) {
      errors.hsnSac = "HSN/SAC is required for taxable products."
    }

    if (!/^\d+(\.\d{1,2})?$/.test(form.gstRate.trim())) {
      errors.gstRate = "Enter a valid GST rate."
    }

  if (!form.effectiveFrom) {
    errors.effectiveFrom = "Effective date is required."
  } else if (form.effectiveTo && form.effectiveTo < form.effectiveFrom) {
    errors.effectiveTo = "Effective-to cannot be before effective-from."
  }

    if (!form.baseUnit.trim()) {
      errors.baseUnit = "Base unit is required."
    }

    if (!/^\d+(\.\d{1,2})?$/.test(form.price.trim())) {
      errors.price = "Enter a valid price."
    }

    if (!/^\d+(\.\d{1,2})?$/.test(form.marginPercent.trim())) {
      errors.marginPercent = "Enter a valid margin."
    }

    if (form.trackInventory && !form.defaultWarehouseId.trim()) {
      errors.defaultWarehouseId = "Choose the default warehouse."
    }
  }

  return errors
}

function buildCreatePayload(form: ProductFormState): CreateProductPayload {
  return {
    name: form.name.trim(),
    itemType: form.itemType,
    sku: form.sku.trim().toUpperCase(),
    description: form.description.trim() || null,
    categoryId: form.categoryId.trim() || null,
    brandId: form.brandId.trim() || null,
    manufacturer: form.manufacturer.trim() || null,
    modelNumber: form.modelNumber.trim() || null,
    status: form.status,
    taxProfile: {
      taxability: form.taxability,
      hsnSac: form.hsnSac.trim() || null,
      gstRate: form.gstRate,
      cessRuleId: form.taxability === "TAXABLE" ? form.cessRuleId.trim() || null : null,
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
      status: "ACTIVE",
    },
    unitProfile: {
      baseUnit: form.baseUnit.trim().toUpperCase(),
      gstUqc: form.gstUqc.trim().toUpperCase() || null,
      conversionFactor: form.conversionFactor || "1",
    },
    price: {
      priceType: "RETAIL",
      price: form.price,
      marginPercent: form.marginPercent || "0",
      taxMode: form.taxMode,
      currency: "INR",
      minimumQuantity: "1",
      effectiveFrom: form.effectiveFrom,
      status: "ACTIVE",
    },
    inventoryProfile: {
      trackInventory: form.trackInventory,
      defaultWarehouseId: form.trackInventory ? form.defaultWarehouseId || null : null,
      reorderLevel: form.reorderLevel || "0",
      minimumStock: form.minimumStock || "0",
      maximumStock: form.maximumStock || "0",
      batchTracking: form.batchTracking,
      serialTracking: form.serialTracking,
    },
    barcodes:
      form.barcode.trim() ?
        [{ barcode: form.barcode.trim(), isPrimary: true, status: "ACTIVE" }]
      : [],
  }
}

function buildUpdatePayload(form: ProductFormState): UpdateProductPayload {
  return {
    name: form.name.trim(),
    itemType: form.itemType,
    sku: form.sku.trim().toUpperCase(),
    description: form.description.trim() || null,
    categoryId: form.categoryId.trim() || null,
    brandId: form.brandId.trim() || null,
    manufacturer: form.manufacturer.trim() || null,
    modelNumber: form.modelNumber.trim() || null,
    status: form.status,
  }
}

function getProductTaxPreview(
  price: string,
  marginPercent: string,
  gstRate: string,
  taxMode: "EXCLUSIVE" | "INCLUSIVE"
) {
  const parsedPrice = Number(price || 0)
  const parsedMargin = Number(marginPercent || 0)
  const parsedGstRate = Number(gstRate || 0)

  if (
    !Number.isFinite(parsedPrice) ||
    !Number.isFinite(parsedMargin) ||
    !Number.isFinite(parsedGstRate)
  ) {
    return {
      marginAmount: 0,
      rateAfterMargin: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      finalRate: 0,
    }
  }

  const marginAmount = (parsedPrice * parsedMargin) / 100
  const rateAfterMargin = parsedPrice + marginAmount
  const taxableValue =
    taxMode === "INCLUSIVE" && parsedGstRate > 0 ?
      rateAfterMargin / (1 + parsedGstRate / 100)
    : rateAfterMargin
  const igst =
    taxMode === "INCLUSIVE" ?
      rateAfterMargin - taxableValue
    : taxableValue * (parsedGstRate / 100)
  const halfTax = igst / 2
  const finalRate = taxMode === "INCLUSIVE" ? rateAfterMargin : taxableValue + igst

  return {
    marginAmount,
    rateAfterMargin,
    cgst: halfTax,
    sgst: halfTax,
    igst,
    finalRate,
  }
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function buildProductsCsv(products: ProductListItem[]) {
  const rows = [
    [
      "Name",
      "SKU",
      "Type",
      "Status",
      "HSN/SAC",
      "GST Rate",
      "Unit",
      "Retail Price",
      "Margin %",
      "Barcode",
      "Inventory",
    ],
    ...products.map((product) => [
      product.name,
      product.sku,
      itemTypeLabels[product.itemType],
      statusLabels[product.status],
      product.activeTaxProfile?.hsnSac ?? "",
      product.activeTaxProfile?.gstRate ? `${product.activeTaxProfile.gstRate}%` : "",
      product.unitProfile?.baseUnit ?? "PCS",
      product.activePrice?.price ?? "0",
      getProductMarginPercent(product.activePrice),
      product.primaryBarcode?.barcode ?? "",
      product.inventoryProfile?.trackInventory ? "Tracked" : "Not tracked",
    ]),
  ]

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")
}

function escapeCsvCell(value: string) {
  const escaped = value.replaceAll('"', '""')
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped
}

function downloadTextFile(fileName: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function printProductsPdf(products: ProductListItem[]) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer")

  if (!printWindow) {
    return false
  }

  const rows = products
    .map(
      (product) => `
        <tr>
          <td>${escapeHtml(product.name)}</td>
          <td>${escapeHtml(product.sku)}</td>
          <td>${escapeHtml(itemTypeLabels[product.itemType])}</td>
          <td>${escapeHtml(product.activeTaxProfile?.hsnSac ?? "-")}</td>
          <td>${escapeHtml(product.activeTaxProfile?.gstRate ? `${product.activeTaxProfile.gstRate}%` : "-")}</td>
          <td>${escapeHtml(product.activePrice?.price ?? "0")}</td>
          <td>${escapeHtml(getProductMarginPercent(product.activePrice))}%</td>
          <td>${escapeHtml(statusLabels[product.status])}</td>
        </tr>
      `
    )
    .join("")

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Product Register</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
          h1 { margin: 0 0 4px; font-size: 20px; }
          p { margin: 0 0 18px; color: #6b7280; font-size: 12px; }
          table { border-collapse: collapse; width: 100%; font-size: 11px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
          th { background: #f9fafb; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
        </style>
      </head>
      <body>
        <h1>Product Register</h1>
        <p>${products.length} loaded product${products.length === 1 ? "" : "s"} exported on ${new Date().toLocaleDateString("en-IN")}</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>SKU</th>
              <th>Type</th>
              <th>HSN/SAC</th>
              <th>GST</th>
              <th>Retail price</th>
              <th>Margin</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  return true
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}
