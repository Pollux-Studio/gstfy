"use client"

import * as React from "react"
import Image from "next/image"
import {
  BarcodeIcon,
  BoxesIcon,
  PackageIcon,
  ReceiptTextIcon,
  TagsIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  PriceType,
  ProductDetail,
  ProductImage,
  ProductItemType,
  ProductStatus,
  Taxability,
  TaxMode,
} from "@/lib/products/api"
import { cn } from "@/lib/utils"

type ProductDetailDialogProps = {
  loading: boolean
  open: boolean
  product: ProductDetail | null | undefined
  warehouses: Array<{ id: string; name: string; warehouseCode: string }>
  onOpenChange: (open: boolean) => void
}

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

const priceTypeLabels: Record<PriceType, string> = {
  RETAIL: "Retail",
  WHOLESALE: "Wholesale",
  DEALER: "Dealer",
  ONLINE: "Online",
  SPECIAL: "Special",
  PURCHASE: "Purchase",
}

const taxModeLabels: Record<TaxMode, string> = {
  EXCLUSIVE: "Tax exclusive",
  INCLUSIVE: "Tax inclusive",
}

const defaultBarcodeType = "EAN-13"

export function ProductDetailDialog({
  loading,
  open,
  product,
  warehouses,
  onOpenChange,
}: ProductDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-5xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-3 pr-12">
          <DialogTitle>Product details</DialogTitle>
          <DialogDescription>
            Product defaults resolved for sales, purchase, tax and stock flows.
          </DialogDescription>
        </DialogHeader>
        {loading || !product ?
          <ProductDetailLoading />
          : <ProductDetailView product={product} warehouses={warehouses} />}
      </DialogContent>
    </Dialog>
  )
}

function ProductDetailLoading() {
  return (
    <div className="space-y-3 px-5 py-4">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-32 w-full" />
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
  const taxPreview = getStoredProductPricePreview(
    price?.price ?? "0",
    taxProfile?.gstRate ?? "0",
    price?.taxMode ?? "EXCLUSIVE"
  )
  const hasCessRule = Boolean(taxProfile?.cessRuleId)
  const taxProfileColumns =
    hasCessRule ?
      ["HSN/SAC", "Taxability", "GST", "Cess rule", "Effective from", "Effective to", "Status"]
      : ["HSN/SAC", "Taxability", "GST", "Effective from", "Effective to", "Status"]
  const taxProfileRows =
    taxProfile ?
      [
        hasCessRule ?
          [
            taxProfile.hsnSac ?? "-",
            taxabilityLabels[taxProfile.taxability],
            formatPercent(taxProfile.gstRate),
            taxProfile.cessRuleId ?? "-",
            taxProfile.effectiveFrom,
            taxProfile.effectiveTo ?? "-",
            <StatusBadge key="status" status={taxProfile.status} />,
          ]
          : [
            taxProfile.hsnSac ?? "-",
            taxabilityLabels[taxProfile.taxability],
            formatPercent(taxProfile.gstRate),
            taxProfile.effectiveFrom,
            taxProfile.effectiveTo ?? "-",
            <StatusBadge key="status" status={taxProfile.status} />,
          ],
      ]
      : []
  const detailTabs = [
    { value: "tax-profile", label: "Tax profile", icon: ReceiptTextIcon },
    { value: "price-profile", label: "Price profile", icon: TagsIcon },
    { value: "unit", label: "Unit", icon: PackageIcon },
    { value: "warehouse", label: "Warehouse", icon: BoxesIcon },
    { value: "stock-control", label: "Stock control", icon: BarcodeIcon },
    { value: "tax-history", label: "Tax history", icon: ReceiptTextIcon },
    { value: "price-history", label: "Price history", icon: TagsIcon },
    { value: "barcodes", label: "Barcodes", icon: BarcodeIcon },
    { value: "suppliers", label: "Suppliers", icon: PackageIcon },
  ]

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <ProductImageThumb image={product.primaryImage} label={product.name} size="lg" />
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold">{product.name}</h2>
              <StatusBadge status={product.status} />
              <Badge variant="outline" className="bg-background">
                {itemTypeLabels[product.itemType]}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono tracking-[0.14em]">{product.sku}</span>
              {product.primaryBarcode?.barcode ? (
                <>
                  <span>·</span>
                  <span className="font-mono">{product.primaryBarcode.barcode}</span>
                </>
              ) : null}
            </div>
            {product.description ? (
              <p className="line-clamp-2 max-w-3xl text-xs leading-5 text-muted-foreground">
                {product.description}
              </p>
            ) : null}
          </div>
        </div>
        <div className="grid min-w-72 grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/20 p-3">
          <TinyDetail label="Manufacturer" value={product.manufacturer ?? "-"} />
          <TinyDetail label="Model" value={product.modelNumber ?? "-"} />
          <TinyDetail label="Category" value={product.categoryId ?? "-"} />
          <TinyDetail label="Brand" value={product.brandId ?? "-"} />
        </div>
      </div>

      <Tabs defaultValue="tax-profile" className="space-y-3">
        <TabsList className="app-scrollbar flex h-auto max-w-full justify-start gap-1 overflow-x-auto rounded-none border-0 bg-transparent p-0">
          {detailTabs.map(({ icon: Icon, label, value }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="min-w-fit gap-1.5 rounded-full border border-transparent bg-transparent px-3 py-1.5 text-xs shadow-none data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              <Icon className="size-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <ProductDetailTabContent value="tax-profile">
          <ProductDetailDataTable
            emptyIcon={<ReceiptTextIcon className="size-4" />}
            emptyTitle="No active tax profile"
            emptyText="Add an HSN/SAC, GST rate and effective date so invoices can resolve taxes automatically."
            columns={taxProfileColumns}
            rows={taxProfileRows}
          />
        </ProductDetailTabContent>

        <ProductDetailTabContent value="price-profile">
          <ProductDetailDataTable
            emptyIcon={<TagsIcon className="size-4" />}
            emptyTitle="No active price profile"
            emptyText="Create a retail price to let sales and POS use this product without manual pricing."
            columns={["Type", "Final price", "Margin", "Tax mode", "Currency", "Minimum qty", "Effective", "Status"]}
            rows={
              price ?
                [[
                  priceTypeLabels[price.priceType],
                  formatCurrency(price.price),
                  formatPercent(getProductMarginPercent(price)),
                  taxModeLabels[price.taxMode],
                  price.currency,
                  formatCompactDecimal(price.minimumQuantity, 3),
                  formatDateRange(price.effectiveFrom, price.effectiveTo),
                  <StatusBadge key="status" status={price.status} />,
                ]]
                : []
            }
          />
          <ProductTaxPreviewPanel taxPreview={taxPreview} taxMode={price?.taxMode ?? "EXCLUSIVE"} />
        </ProductDetailTabContent>

        <ProductDetailTabContent value="unit">
          <ProductDetailDataTable
            emptyIcon={<PackageIcon className="size-4" />}
            emptyTitle="No unit profile"
            emptyText="Set a base unit and GST UQC so quantity, billing and return reports stay consistent."
            columns={["Base unit", "Secondary unit", "Conversion factor", "GST UQC"]}
            rows={
              unit ?
                [[
                  unit.baseUnit,
                  unit.secondaryUnit ?? "-",
                  formatCompactDecimal(unit.conversionFactor, 6),
                  unit.gstUqc ?? "-",
                ]]
                : []
            }
          />
        </ProductDetailTabContent>

        <ProductDetailTabContent value="warehouse">
          <ProductDetailDataTable
            emptyIcon={<BoxesIcon className="size-4" />}
            emptyTitle="No warehouse mapped"
            emptyText="Choose a default warehouse when this product should participate in stock tracking."
            columns={["Default warehouse", "Warehouse code", "Warehouse id", "Inventory tracking"]}
            rows={
              defaultWarehouse || inventory?.defaultWarehouseId ?
                [[
                  defaultWarehouse?.name ?? "Mapped warehouse",
                  defaultWarehouse?.warehouseCode ?? "-",
                  inventory?.defaultWarehouseId ?? "-",
                  inventory?.trackInventory ? "Tracked" : "Not tracked",
                ]]
                : []
            }
          />
        </ProductDetailTabContent>

        <ProductDetailTabContent value="stock-control">
          <ProductDetailDataTable
            emptyIcon={<BarcodeIcon className="size-4" />}
            emptyTitle="No stock-control profile"
            emptyText="Enable inventory tracking to configure reorder levels, stock limits, batches and serials."
            columns={["Track inventory", "Reorder level", "Minimum stock", "Maximum stock", "Batch tracking", "Serial tracking"]}
            rows={
              inventory ?
                [[
                  inventory.trackInventory ? "Yes" : "No",
                  formatCompactDecimal(inventory.reorderLevel, 3),
                  formatCompactDecimal(inventory.minimumStock, 3),
                  formatCompactDecimal(inventory.maximumStock, 3),
                  inventory.batchTracking ? "Yes" : "No",
                  inventory.serialTracking ? "Yes" : "No",
                ]]
                : []
            }
          />
        </ProductDetailTabContent>

        <ProductDetailTabContent value="tax-history">
          <ProductDetailDataTable
            emptyIcon={<ReceiptTextIcon className="size-4" />}
            emptyTitle="No tax history"
            emptyText="Tax history appears when GST rates, HSN/SAC codes, cess rules or effective dates change."
            columns={["HSN/SAC", "GST", "Taxability", "Effective", "Status"]}
            rows={product.taxProfiles.map((profile) => [
              profile.hsnSac ?? "-",
              formatPercent(profile.gstRate),
              taxabilityLabels[profile.taxability],
              formatDateRange(profile.effectiveFrom, profile.effectiveTo),
              <StatusBadge key={profile.id} status={profile.status} />,
            ])}
          />
        </ProductDetailTabContent>

        <ProductDetailTabContent value="price-history">
          <ProductDetailDataTable
            emptyIcon={<TagsIcon className="size-4" />}
            emptyTitle="No price history"
            emptyText="Price history appears when retail, wholesale or purchase prices are revised."
            columns={["Type", "Final price", "Margin", "Tax mode", "Min qty", "Effective", "Status"]}
            rows={product.prices.map((profile) => [
              priceTypeLabels[profile.priceType],
              formatCurrency(profile.price),
              formatPercent(getProductMarginPercent(profile)),
              taxModeLabels[profile.taxMode],
              formatCompactDecimal(profile.minimumQuantity, 3),
              formatDateRange(profile.effectiveFrom, profile.effectiveTo),
              <StatusBadge key={profile.id} status={profile.status} />,
            ])}
          />
        </ProductDetailTabContent>

        <ProductDetailTabContent value="barcodes">
          <ProductDetailDataTable
            emptyIcon={<BarcodeIcon className="size-4" />}
            emptyTitle="No barcode mappings"
            emptyText="Add a primary EAN-13 barcode to speed up POS and stock entry."
            columns={["Barcode", "Type", "Primary", "Status"]}
            rows={product.barcodes.map((barcode) => [
              barcode.barcode,
              barcode.barcodeType ?? defaultBarcodeType,
              barcode.isPrimary ? "Yes" : "No",
              <StatusBadge key={barcode.id} status={barcode.status} />,
            ])}
          />
        </ProductDetailTabContent>

        <ProductDetailTabContent value="suppliers">
          <ProductDetailDataTable
            emptyIcon={<PackageIcon className="size-4" />}
            emptyTitle="No supplier mappings"
            emptyText="Supplier mappings will show purchase price, supplier item code and preferred vendor status."
            columns={["Supplier", "Code", "Purchase", "Lead", "Preferred", "Status"]}
            rows={product.suppliers.map((supplier) => [
              supplier.supplierName,
              supplier.supplierItemCode ?? "-",
              supplier.purchasePrice ? formatCurrency(supplier.purchasePrice) : "-",
              `${supplier.leadTimeDays}d`,
              supplier.isPreferred ? "Yes" : "No",
              <StatusBadge key={supplier.id} status={supplier.status} />,
            ])}
          />
        </ProductDetailTabContent>
      </Tabs>
    </div>
  )
}

function ProductDetailTabContent({
  children,
  value,
}: {
  children: React.ReactNode
  value: string
}) {
  return (
    <TabsContent value={value} className="mt-0">
      <div className="app-scrollbar max-h-[calc(100vh-21rem)] overflow-y-auto pr-1">
        <div className="space-y-3">{children}</div>
      </div>
    </TabsContent>
  )
}

function TinyDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-xs font-medium">{value}</p>
    </div>
  )
}

function ProductTaxPreviewPanel({
  taxMode,
  taxPreview,
}: {
  taxMode: string
  taxPreview: ReturnType<typeof getStoredProductPricePreview>
}) {
  return (
    <div className="rounded-2xl border border-border p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ReceiptTextIcon className="size-4 shrink-0 text-muted-foreground" />
          <h3 className="truncate text-sm font-medium">GST calculation preview</h3>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {taxMode === "INCLUSIVE" ? "Tax inclusive" : "Tax exclusive"}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        <ProductPreviewMetric
          label="Taxable value"
          value={formatCurrency(taxPreview.taxableValue)}
        />
        <ProductPreviewMetric
          label="Saved price"
          value={formatCurrency(taxPreview.savedPrice)}
        />
        <ProductPreviewMetric
          label="CGST + SGST"
          value={`${formatCurrency(taxPreview.cgst)} + ${formatCurrency(taxPreview.sgst)}`}
        />
        <ProductPreviewMetric label="IGST" value={formatCurrency(taxPreview.igst)} />
        <ProductPreviewMetric
          label="Final retail price"
          value={formatCurrency(taxPreview.finalRate)}
          highlight
        />
      </div>
    </div>
  )
}

function ProductDetailDataTable({
  columns,
  emptyIcon,
  emptyText,
  emptyTitle = "No records",
  rows,
}: {
  columns: string[]
  emptyIcon?: React.ReactNode
  emptyText: string
  emptyTitle?: string
  rows: Array<Array<React.ReactNode>>
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      {rows.length === 0 ? (
        <Empty className="min-h-36 border-0 p-4">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="text-muted-foreground">
              {emptyIcon ?? <PackageIcon className="size-4" />}
            </EmptyMedia>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription className="max-w-sm text-xs leading-5">
              {emptyText}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="app-scrollbar max-h-[18rem] overflow-auto">
          <Table className="w-full table-fixed text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-3">
            <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_var(--border)]">
              <TableRow className="hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead key={column} className="text-xs">
                    <span className="block truncate">{column}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <TableCell
                      key={cellIndex}
                      className={cn(
                        "max-w-52 truncate align-middle",
                        cellIndex === 0 && "font-medium",
                        cellIndex === 1 && "font-mono"
                      )}
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function formatDateRange(from: string | null, to: string | null) {
  if (!from && !to) {
    return "-"
  }

  return `${from ?? "-"}${to ? ` to ${to}` : ""}`
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

function ProductImageThumb({
  image,
  label,
  size = "sm",
}: {
  image: ProductImage | null
  label: string
  size?: "sm" | "lg"
}) {
  return (
    <div
      aria-label={image ? `${label} image` : `${label} image placeholder`}
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 text-muted-foreground",
        size === "lg" ? "size-20 rounded-2xl" : "size-9"
      )}
      role="img"
    >
      {image ? (
        <Image
          src={image.publicUrl}
          alt={label}
          width={size === "lg" ? 80 : 36}
          height={size === "lg" ? 80 : 36}
          unoptimized
          className="size-full object-cover"
        />
      ) : (
        <PackageIcon className={size === "lg" ? "size-8" : "size-4"} />
      )}
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

type ProductPriceWithOptionalMargin = {
  marginPercent?: string | number | null
}

function getProductMarginPercent(price: ProductDetail["activePrice"]) {
  if (!price) {
    return "0"
  }

  const marginPercent = (price as ProductPriceWithOptionalMargin).marginPercent
  return marginPercent === undefined || marginPercent === null || marginPercent === ""
    ? "0"
    : String(marginPercent)
}

function getStoredProductPricePreview(
  price: string,
  gstRate: string,
  taxMode: "EXCLUSIVE" | "INCLUSIVE"
) {
  const parsedPrice = Number(price || 0)
  const parsedGstRate = Number(gstRate || 0)

  if (!Number.isFinite(parsedPrice) || !Number.isFinite(parsedGstRate)) {
    return {
      savedPrice: 0,
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      finalRate: 0,
    }
  }

  const taxableValue =
    taxMode === "INCLUSIVE" && parsedGstRate > 0 ?
      parsedPrice / (1 + parsedGstRate / 100)
      : parsedPrice
  const igst =
    taxMode === "INCLUSIVE" ? parsedPrice - taxableValue : taxableValue * (parsedGstRate / 100)
  const finalRate = taxMode === "INCLUSIVE" ? parsedPrice : taxableValue + igst

  return {
    savedPrice: parsedPrice,
    taxableValue,
    cgst: igst / 2,
    sgst: igst / 2,
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

function formatCompactDecimal(value: string | number | null | undefined, maximumFractionDigits = 6) {
  if (value === null || value === undefined || value === "") {
    return "-"
  }

  const number = Number(value ?? 0)

  if (!Number.isFinite(number)) {
    return "-"
  }

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits,
  }).format(number)
}

function formatPercent(value: string | number | null | undefined) {
  const number = Number(value ?? 0)

  if (!Number.isFinite(number)) {
    return "-"
  }

  return `${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(number)}%`
}
