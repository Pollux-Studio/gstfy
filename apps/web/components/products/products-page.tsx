"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArchiveIcon,
  BarcodeIcon,
  BoxesIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PackageIcon,
  PencilLineIcon,
  PlusIcon,
  ReceiptTextIcon,
  SearchIcon,
  SparklesIcon,
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  archiveProduct,
  createProduct,
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
  type TaxMode,
  type UpdateProductPayload,
} from "@/lib/products/api"
import { cn } from "@/lib/utils"

type FilterState = {
  search: string
  itemType: ProductItemType | "all"
  status: ProductStatus | "all"
}

type SheetMode = "create" | "edit"

type ProductFormState = {
  name: string
  itemType: ProductItemType
  sku: string
  description: string
  manufacturer: string
  modelNumber: string
  status: ProductStatus
  taxability: Taxability
  hsnSac: string
  gstRate: string
  effectiveFrom: string
  baseUnit: string
  gstUqc: string
  conversionFactor: string
  price: string
  taxMode: TaxMode
  barcode: string
  trackInventory: boolean
  reorderLevel: string
  minimumStock: string
  maximumStock: string
  batchTracking: boolean
  serialTracking: boolean
}

type ProductFormErrors = Partial<Record<keyof ProductFormState, string>>

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
const taxabilities: Taxability[] = [
  "TAXABLE",
  "EXEMPT",
  "NIL_RATED",
  "NON_GST",
  "ZERO_RATED",
]

const emptyForm: ProductFormState = {
  name: "",
  itemType: "GOODS",
  sku: "",
  description: "",
  manufacturer: "",
  modelNumber: "",
  status: "ACTIVE",
  taxability: "TAXABLE",
  hsnSac: "210690",
  gstRate: "18",
  effectiveFrom: "2026-04-01",
  baseUnit: "PCS",
  gstUqc: "PCS",
  conversionFactor: "1",
  price: "0",
  taxMode: "EXCLUSIVE",
  barcode: "",
  trackInventory: true,
  reorderLevel: "0",
  minimumStock: "0",
  maximumStock: "0",
  batchTracking: false,
  serialTracking: false,
}

function createFormFromProduct(product: ProductListItem): ProductFormState {
  return {
    ...emptyForm,
    name: product.name,
    itemType: product.itemType,
    sku: product.sku,
    description: product.description ?? "",
    manufacturer: product.manufacturer ?? "",
    modelNumber: product.modelNumber ?? "",
    status: product.status,
    taxability: product.activeTaxProfile?.taxability ?? "TAXABLE",
    hsnSac: product.activeTaxProfile?.hsnSac ?? "",
    gstRate: product.activeTaxProfile?.gstRate ?? "0",
    effectiveFrom: product.activeTaxProfile?.effectiveFrom ?? "2026-04-01",
    baseUnit: product.unitProfile?.baseUnit ?? "PCS",
    gstUqc: product.unitProfile?.gstUqc ?? "",
    conversionFactor: product.unitProfile?.conversionFactor ?? "1",
    price: product.activePrice?.price ?? "0",
    taxMode: product.activePrice?.taxMode ?? "EXCLUSIVE",
    barcode: product.primaryBarcode?.barcode ?? "",
    trackInventory: product.inventoryProfile?.trackInventory ?? product.itemType === "GOODS",
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
  const [sheetMode, setSheetMode] = React.useState<SheetMode | null>(null)
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null)
  const [detailProductId, setDetailProductId] = React.useState<string | null>(null)
  const [pendingArchive, setPendingArchive] = React.useState<ProductListItem | null>(null)
  const [formState, setFormState] = React.useState<ProductFormState>(emptyForm)
  const [formErrors, setFormErrors] = React.useState<ProductFormErrors>({})

  const productsQuery = useQuery({
    queryKey: ["products", filters],
    queryFn: () =>
      listProducts(accessToken, {
        search: filters.search.trim() || undefined,
        itemType: filters.itemType === "all" ? undefined : filters.itemType,
        status: filters.status === "all" ? undefined : filters.status,
        limit: 100,
      }),
    enabled: accessToken.length > 0,
    staleTime: 1000 * 60 * 3,
  })

  const mastersQuery = useQuery({
    queryKey: ["products", "masters"],
    queryFn: () => listProductMasters(accessToken),
    enabled: accessToken.length > 0,
    staleTime: 1000 * 60 * 10,
  })

  const detailQuery = useQuery({
    queryKey: ["products", "detail", detailProductId],
    queryFn: () => getProduct(detailProductId ?? "", accessToken),
    enabled: accessToken.length > 0 && Boolean(detailProductId),
    staleTime: 1000 * 60 * 3,
  })

  const products = productsQuery.data?.products ?? []
  const detailProduct = detailQuery.data?.product ?? null
  const hsnSacOptions =
    mastersQuery.data?.hsnSacCodes.filter((code) =>
      formState.itemType === "SERVICE" ? code.codeType === "SAC" : code.codeType === "HSN"
    ) ?? []
  const uqcOptions = mastersQuery.data?.uqcCodes ?? []

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

  function openCreateSheet() {
    setSheetMode("create")
    setSelectedProductId(null)
    setFormState(emptyForm)
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
        next.hsnSac = value === "SERVICE" ? "998313" : "210690"
        next.trackInventory = value === "GOODS"
        next.baseUnit = value === "SERVICE" ? "NOS" : "PCS"
        next.gstUqc = value === "SERVICE" ? "NOS" : "PCS"
      }

      return next
    })

    setFormErrors((current) => ({ ...current, [key]: undefined }))
  }

  function fillDummyProduct() {
    setFormState({
      ...emptyForm,
      name: "Premium Tea Pack 250g",
      itemType: "GOODS",
      sku: `TEA-${Math.floor(Math.random() * 9000 + 1000)}`,
      description: "Retail tea pack used for sales, purchase and GST testing.",
      manufacturer: "GSTFY Demo Foods",
      modelNumber: "TP-250",
      hsnSac: "090240",
      gstRate: "5",
      price: "180",
      barcode: `890${Math.floor(Math.random() * 1000000000)
        .toString()
        .padStart(9, "0")}`,
      reorderLevel: "12",
      minimumStock: "6",
      maximumStock: "120",
    })
    setFormErrors({})
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

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_320px] lg:p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5">
                <SparklesIcon className="size-3.5" />
                Product Engine
              </Badge>
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                Snapshot ready
              </Badge>
            </div>
            <div className="max-w-3xl space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Products that resolve cleanly into sales, purchase, tax and stock flows.
              </h1>
              <p className="text-sm text-muted-foreground">
                Maintain SKU, HSN/SAC, UQC, GST rate, price and inventory defaults here.
                Transactions will snapshot the resolved state instead of depending on
                mutable product master data.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Active products" value={products.length.toString()} />
            <StatCard
              label="Tracked stock"
              value={products
                .filter((product) => product.inventoryProfile?.trackInventory)
                .length.toString()}
            />
            <StatCard
              label="Tax mapped"
              value={products
                .filter((product) => product.activeTaxProfile?.hsnSac)
                .length.toString()}
            />
            <StatCard
              label="Priced"
              value={products
                .filter((product) => Number(product.activePrice?.price ?? 0) > 0)
                .length.toString()}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card">
        <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, search: event.target.value }))
                }
                placeholder="Search name, SKU, barcode, HSN/SAC, supplier code"
                className="pl-9"
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
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {itemTypes.map((itemType) => (
                  <SelectItem key={itemType} value={itemType}>
                    {itemTypeLabels[itemType]}
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
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openCreateSheet} className="gap-2">
            <PlusIcon className="size-4" />
            Add product
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Retail price</TableHead>
                <TableHead>Inventory</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsQuery.isLoading ?
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : products.length === 0 ?
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
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
              : products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="min-w-56 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{product.name}</span>
                          <Badge variant="outline">{itemTypeLabels[product.itemType]}</Badge>
                        </div>
                        <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground">
                          {product.sku}
                        </p>
                        {product.primaryBarcode ?
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <BarcodeIcon className="size-3.5" />
                            {product.primaryBarcode.barcode}
                          </p>
                        : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <p className="font-mono">
                          {product.activeTaxProfile?.hsnSac ?? "Not mapped"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.activeTaxProfile ?
                            `${taxabilityLabels[product.activeTaxProfile.taxability]} · ${product.activeTaxProfile.gstRate}% GST`
                          : "Tax profile missing"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <p>{product.unitProfile?.baseUnit ?? "PCS"}</p>
                        <p className="text-xs text-muted-foreground">
                          UQC {product.unitProfile?.gstUqc ?? "-"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(product.activePrice?.price ?? "0")}
                    </TableCell>
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
                    <TableCell>
                      <StatusBadge status={product.status} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                          <MoreHorizontalIcon className="size-4" />
                          <span className="sr-only">Open product actions</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailProductId(product.id)}>
                            <EyeIcon />
                            View resolved defaults
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
                ))
              }
            </TableBody>
          </Table>
        </div>
      </section>

      <Sheet open={Boolean(sheetMode)} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className="flex w-full flex-col sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>
              {sheetMode === "edit" ? "Edit product" : "Add product"}
            </SheetTitle>
            <SheetDescription>
              Product Master stores defaults only. Sales, purchase and tax engines resolve
              these values at transaction time.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={submitForm} className="flex min-h-0 flex-1 flex-col">
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-1 py-4">
              <FieldGroup className="gap-5">
                {sheetMode === "create" ?
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit gap-2"
                    onClick={fillDummyProduct}
                  >
                    <SparklesIcon className="size-4" />
                    Fill dummy product
                  </Button>
                : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <ProductField label="Product name" error={formErrors.name}>
                    <Input
                      value={formState.name}
                      onChange={(event) => updateForm("name", event.target.value)}
                      placeholder="Premium Tea Pack 250g"
                    />
                  </ProductField>
                  <ProductField label="SKU" error={formErrors.sku}>
                    <Input
                      value={formState.sku}
                      onChange={(event) =>
                        updateForm("sku", event.target.value.toUpperCase())
                      }
                      placeholder="TEA-250"
                      className="font-mono uppercase tracking-[0.14em]"
                    />
                  </ProductField>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <ProductField label="Type">
                    <Select
                      value={formState.itemType}
                      onValueChange={(value) =>
                        updateForm("itemType", value as ProductItemType)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {itemTypes.map((itemType) => (
                          <SelectItem key={itemType} value={itemType}>
                            {itemTypeLabels[itemType]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </ProductField>
                  <ProductField label="Manufacturer">
                    <Input
                      value={formState.manufacturer}
                      onChange={(event) => updateForm("manufacturer", event.target.value)}
                      placeholder="Brand or maker"
                    />
                  </ProductField>
                  <ProductField label="Model number">
                    <Input
                      value={formState.modelNumber}
                      onChange={(event) => updateForm("modelNumber", event.target.value)}
                      placeholder="Optional"
                    />
                  </ProductField>
                </div>

                <ProductField label="Description">
                  <Textarea
                    value={formState.description}
                    onChange={(event) => updateForm("description", event.target.value)}
                    placeholder="Short invoice description"
                    rows={3}
                  />
                </ProductField>

                <div className="rounded-2xl border p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <ReceiptTextIcon className="size-4 text-muted-foreground" />
                    <h2 className="text-sm font-medium">Tax and unit defaults</h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-4">
                    <ProductField label="Taxability" error={formErrors.taxability}>
                      <Select
                        value={formState.taxability}
                        onValueChange={(value) =>
                          updateForm("taxability", value as Taxability)
                        }
                        disabled={sheetMode === "edit"}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {taxabilities.map((taxability) => (
                            <SelectItem key={taxability} value={taxability}>
                              {taxabilityLabels[taxability]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ProductField>
                    <ProductField
                      label={formState.itemType === "SERVICE" ? "SAC" : "HSN"}
                      error={formErrors.hsnSac}
                    >
                      <Select
                        value={formState.hsnSac}
                        onValueChange={(value) => updateForm("hsnSac", value ?? "")}
                        disabled={sheetMode === "edit"}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose code" />
                        </SelectTrigger>
                        <SelectContent>
                          {hsnSacOptions.map((code) => (
                            <SelectItem key={code.code} value={code.code}>
                              {code.code} · {code.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ProductField>
                    <ProductField label="GST rate" error={formErrors.gstRate}>
                      <Input
                        value={formState.gstRate}
                        onChange={(event) => updateForm("gstRate", event.target.value)}
                        inputMode="decimal"
                        placeholder="18"
                        disabled={sheetMode === "edit"}
                      />
                    </ProductField>
                    <ProductField label="Effective from" error={formErrors.effectiveFrom}>
                      <Input
                        type="date"
                        value={formState.effectiveFrom}
                        onChange={(event) =>
                          updateForm("effectiveFrom", event.target.value)
                        }
                        disabled={sheetMode === "edit"}
                      />
                    </ProductField>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <ProductField label="Base unit" error={formErrors.baseUnit}>
                      <Input
                        value={formState.baseUnit}
                        onChange={(event) =>
                          updateForm("baseUnit", event.target.value.toUpperCase())
                        }
                        placeholder="PCS"
                        disabled={sheetMode === "edit"}
                      />
                    </ProductField>
                    <ProductField label="GST UQC">
                      <Select
                        value={formState.gstUqc}
                        onValueChange={(value) => updateForm("gstUqc", value ?? "")}
                        disabled={sheetMode === "edit"}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose UQC" />
                        </SelectTrigger>
                        <SelectContent>
                          {uqcOptions.map((uqc) => (
                            <SelectItem key={uqc.code} value={uqc.code}>
                              {uqc.code} · {uqc.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ProductField>
                    <ProductField label="Conversion factor">
                      <Input
                        value={formState.conversionFactor}
                        onChange={(event) =>
                          updateForm("conversionFactor", event.target.value)
                        }
                        inputMode="decimal"
                        disabled={sheetMode === "edit"}
                      />
                    </ProductField>
                  </div>
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <TagsIcon className="size-4 text-muted-foreground" />
                    <h2 className="text-sm font-medium">Price and inventory defaults</h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <ProductField label="Retail price" error={formErrors.price}>
                      <Input
                        value={formState.price}
                        onChange={(event) => updateForm("price", event.target.value)}
                        inputMode="decimal"
                        placeholder="0.00"
                        disabled={sheetMode === "edit"}
                      />
                    </ProductField>
                    <ProductField label="Tax mode">
                      <Select
                        value={formState.taxMode}
                        onValueChange={(value) => updateForm("taxMode", value as TaxMode)}
                        disabled={sheetMode === "edit"}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EXCLUSIVE">Tax exclusive</SelectItem>
                          <SelectItem value="INCLUSIVE">Tax inclusive</SelectItem>
                        </SelectContent>
                      </Select>
                    </ProductField>
                    <ProductField label="Primary barcode">
                      <Input
                        value={formState.barcode}
                        onChange={(event) => updateForm("barcode", event.target.value)}
                        placeholder="890..."
                        disabled={sheetMode === "edit"}
                      />
                    </ProductField>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <ProductField label="Reorder level">
                      <Input
                        value={formState.reorderLevel}
                        onChange={(event) =>
                          updateForm("reorderLevel", event.target.value)
                        }
                        inputMode="decimal"
                        disabled={sheetMode === "edit"}
                      />
                    </ProductField>
                    <ProductField label="Minimum stock">
                      <Input
                        value={formState.minimumStock}
                        onChange={(event) =>
                          updateForm("minimumStock", event.target.value)
                        }
                        inputMode="decimal"
                        disabled={sheetMode === "edit"}
                      />
                    </ProductField>
                    <ProductField label="Maximum stock">
                      <Input
                        value={formState.maximumStock}
                        onChange={(event) =>
                          updateForm("maximumStock", event.target.value)
                        }
                        inputMode="decimal"
                        disabled={sheetMode === "edit"}
                      />
                    </ProductField>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <TogglePill
                      active={formState.trackInventory}
                      label="Track inventory"
                      disabled={sheetMode === "edit"}
                      onClick={() => updateForm("trackInventory", !formState.trackInventory)}
                    />
                    <TogglePill
                      active={formState.batchTracking}
                      label="Batch tracking"
                      disabled={sheetMode === "edit"}
                      onClick={() => updateForm("batchTracking", !formState.batchTracking)}
                    />
                    <TogglePill
                      active={formState.serialTracking}
                      label="Serial tracking"
                      disabled={sheetMode === "edit"}
                      onClick={() => updateForm("serialTracking", !formState.serialTracking)}
                    />
                  </div>
                </div>

                <ProductField label="Status">
                  <Select
                    value={formState.status}
                    onValueChange={(value) => updateForm("status", value as ProductStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {statusLabels[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ProductField>
              </FieldGroup>
            </div>
            <SheetFooter className="border-t pt-3">
              <Button type="button" variant="ghost" onClick={closeSheet}>
                Cancel
              </Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? <Spinner /> : null}
                {upsertMutation.isPending ? "" : sheetMode === "edit" ? "Save" : "Create"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(detailProductId)} onOpenChange={(open) => !open && setDetailProductId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Resolved product defaults</DialogTitle>
            <DialogDescription>
              Snapshot-ready configuration for the current date. Tax and accounting engines
              still perform final transaction calculations.
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading || !detailProduct ?
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          : <ProductDetailView product={detailProduct} />}
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

function ProductField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel>
        {label}
        {error ? <span className="text-destructive">*</span> : null}
      </FieldLabel>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}

function TogglePill({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  )
}

function ProductDetailView({ product }: { product: ProductDetail }) {
  const taxProfile = product.activeTaxProfile
  const unit = product.units[0] ?? null
  const price = product.activePrice

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{product.name}</h2>
            <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground">
              {product.sku}
            </p>
          </div>
          <StatusBadge status={product.status} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailCard
          icon={<ReceiptTextIcon className="size-4" />}
          title="Tax profile"
          rows={[
            ["HSN/SAC", taxProfile?.hsnSac ?? "-"],
            ["Taxability", taxProfile ? taxabilityLabels[taxProfile.taxability] : "-"],
            ["GST rate", taxProfile ? `${taxProfile.gstRate}%` : "-"],
            ["Effective", taxProfile?.effectiveFrom ?? "-"],
          ]}
        />
        <DetailCard
          icon={<TagsIcon className="size-4" />}
          title="Price"
          rows={[
            ["Retail", formatCurrency(price?.price ?? "0")],
            ["Tax mode", price?.taxMode ?? "-"],
            ["Currency", price?.currency ?? "INR"],
            ["Minimum qty", price?.minimumQuantity ?? "1"],
          ]}
        />
        <DetailCard
          icon={<BoxesIcon className="size-4" />}
          title="Unit and inventory"
          rows={[
            ["Base unit", unit?.baseUnit ?? "-"],
            ["GST UQC", unit?.gstUqc ?? "-"],
            ["Track stock", product.inventoryProfile?.trackInventory ? "Yes" : "No"],
            ["Reorder level", product.inventoryProfile?.reorderLevel ?? "0"],
          ]}
        />
        <DetailCard
          icon={<BarcodeIcon className="size-4" />}
          title="Mappings"
          rows={[
            ["Barcodes", product.barcodes.length.toString()],
            ["Suppliers", product.suppliers.length.toString()],
            ["Tax profiles", product.taxProfiles.length.toString()],
            ["Price profiles", product.prices.length.toString()],
          ]}
        />
      </div>
    </div>
  )
}

function DetailCard({
  icon,
  title,
  rows,
}: {
  icon: React.ReactNode
  title: string
  rows: Array<[string, string]>
}) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium">{value}</span>
          </div>
        ))}
      </div>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
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
    }

    if (!form.baseUnit.trim()) {
      errors.baseUnit = "Base unit is required."
    }

    if (!/^\d+(\.\d{1,2})?$/.test(form.price.trim())) {
      errors.price = "Enter a valid price."
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
    manufacturer: form.manufacturer.trim() || null,
    modelNumber: form.modelNumber.trim() || null,
    status: form.status,
    taxProfile: {
      taxability: form.taxability,
      hsnSac: form.hsnSac.trim() || null,
      gstRate: form.gstRate,
      effectiveFrom: form.effectiveFrom,
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
      taxMode: form.taxMode,
      currency: "INR",
      minimumQuantity: "1",
      effectiveFrom: form.effectiveFrom,
      status: "ACTIVE",
    },
    inventoryProfile: {
      trackInventory: form.trackInventory,
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
    manufacturer: form.manufacturer.trim() || null,
    modelNumber: form.modelNumber.trim() || null,
    status: form.status,
  }
}

function formatCurrency(value: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}
