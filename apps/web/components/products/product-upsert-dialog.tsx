"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  BarcodeIcon,
  CalculatorIcon,
  CheckIcon,
  ReceiptTextIcon,
  SearchIcon,
  TagsIcon,
} from "lucide-react"

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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectDisplayValue,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type {
  CessRule,
} from "@/lib/tax/api"
import type { WarehouseRecord } from "@/lib/organization/api"
import type {
  HsnCodeSearchResult,
  HsnSacCode,
  ProductItemType,
  ProductStatus,
  Taxability,
  TaxMode,
  UqcCode,
} from "@/lib/products/api"
import { searchHsnCodes } from "@/lib/products/api"
import { cn } from "@/lib/utils"
import type {
  ProductFormErrors,
  ProductFormState,
  SheetMode,
} from "./product-form-types"

type ProductUpsertDialogProps = {
  accessToken: string
  brandOptions: string[]
  categoryOptions: string[]
  cessRuleOptions: CessRule[]
  creatingBrand: boolean
  creatingCategory: boolean
  formErrors: ProductFormErrors
  formState: ProductFormState
  gstRateOptions: Array<{ value: string; label: string }>
  hsnSacOptions: HsnSacCode[]
  mode: SheetMode | null
  open: boolean
  pending: boolean
  uqcOptions: UqcCode[]
  warehouseOptions: WarehouseRecord[]
  onBarcodeKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  onClose: () => void
  onCreateBrand: (name: string) => void
  onCreateCategory: (name: string) => void
  onGenerateBarcode: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onUpdate: <K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K]
  ) => void
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

const itemTypes: ProductItemType[] = ["GOODS", "SERVICE"]
const statuses: ProductStatus[] = ["ACTIVE", "INACTIVE", "ARCHIVED"]
const taxabilities: Taxability[] = [
  "TAXABLE",
  "EXEMPT",
  "NIL_RATED",
  "NON_GST",
  "ZERO_RATED",
]

const productTypeOptions = itemTypes.map((itemType) => ({
  value: itemType,
  label: itemTypeLabels[itemType],
}))

const taxabilityOptions = taxabilities.map((taxability) => ({
  value: taxability,
  label: taxabilityLabels[taxability],
}))

const taxModeOptions: Array<{ value: TaxMode; label: string }> = [
  { value: "EXCLUSIVE", label: "Tax exclusive" },
  { value: "INCLUSIVE", label: "Tax inclusive" },
]

const productStatusOptions = statuses.map((status) => ({
  value: status,
  label: statusLabels[status],
}))

export function ProductUpsertDialog({
  accessToken,
  brandOptions,
  categoryOptions,
  cessRuleOptions,
  creatingBrand,
  creatingCategory,
  formErrors,
  formState,
  gstRateOptions,
  hsnSacOptions,
  mode,
  open,
  pending,
  uqcOptions,
  warehouseOptions,
  onBarcodeKeyDown,
  onClose,
  onCreateBrand,
  onCreateCategory,
  onGenerateBarcode,
  onSubmit,
  onUpdate,
}: ProductUpsertDialogProps) {
  const resolvedMode = mode ?? "create"
  const isEditing = resolvedMode === "edit"
  const showCessRule = formState.taxability === "TAXABLE" && cessRuleOptions.length > 0
  const activeWarehouseOptions = warehouseOptions.filter(
    (warehouse) => warehouse.status.toLowerCase() === "active"
  )
  const showDefaultWarehouse = formState.trackInventory
  const taxPreview = getTaxPreview(
    formState.price,
    formState.marginPercent,
    formState.gstRate,
    formState.taxMode
  )

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-5xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-3 pr-12">
          <DialogTitle>{isEditing ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            Set the product defaults used by sales, purchase, tax and stock flows.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-3">
            <FieldGroup className="gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <ProductField label="Product name" error={formErrors.name}>
                  <Input
                    value={formState.name}
                    onChange={(event) => onUpdate("name", event.target.value)}
                    placeholder="Premium Tea Pack 250g"
                  />
                </ProductField>
                <ProductField label="SKU" error={formErrors.sku}>
                  <Input
                    value={formState.sku}
                    readOnly
                    placeholder="Auto-generated"
                    className="bg-muted/30 font-mono uppercase tracking-[0.14em] text-muted-foreground"
                  />
                </ProductField>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <ProductField label="Type">
                  <Select
                    value={formState.itemType}
                    onValueChange={(value) =>
                      onUpdate("itemType", value as ProductItemType)
                    }
                  >
                    <SelectTrigger>
                      <SelectDisplayValue
                        value={formState.itemType}
                        options={productTypeOptions}
                        placeholder="Type"
                      />
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
                <ProductField label="Category">
                  <CreatableMasterField
                    createLabel="Create category"
                    creating={creatingCategory}
                    options={categoryOptions}
                    placeholder="Select or create category"
                    value={formState.categoryId}
                    onChange={(value) => onUpdate("categoryId", value)}
                    onCreate={onCreateCategory}
                  />
                </ProductField>
                <ProductField label="Brand">
                  <CreatableMasterField
                    createLabel="Create brand"
                    creating={creatingBrand}
                    options={brandOptions}
                    placeholder="Select or create brand"
                    value={formState.brandId}
                    onChange={(value) => onUpdate("brandId", value)}
                    onCreate={onCreateBrand}
                  />
                </ProductField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <ProductField label="Manufacturer">
                  <Input
                    value={formState.manufacturer}
                    onChange={(event) => onUpdate("manufacturer", event.target.value)}
                    placeholder="Brand or maker"
                  />
                </ProductField>
                <ProductField label="Model number">
                  <Input
                    value={formState.modelNumber}
                    onChange={(event) => onUpdate("modelNumber", event.target.value)}
                    placeholder="Optional"
                  />
                </ProductField>
              </div>

              <ProductField label="Description">
                <Textarea
                  value={formState.description}
                  onChange={(event) => onUpdate("description", event.target.value)}
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
                        onUpdate("taxability", value as Taxability)
                      }
                      disabled={isEditing}
                    >
                      <SelectTrigger>
                        <SelectDisplayValue
                          value={formState.taxability}
                          options={taxabilityOptions}
                          placeholder="Taxability"
                        />
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
                    {formState.itemType === "GOODS" ?
                      <HsnSearchField
                        key={`${open}-${resolvedMode}-${formState.itemType}-${formState.hsnSac || "empty"}`}
                        accessToken={accessToken}
                        disabled={isEditing}
                        localOptions={hsnSacOptions}
                        selectedCode={formState.hsnSac}
                        onSelect={(code) => {
                          onUpdate("hsnSac", code.code)

                          if (code.gstRate) {
                            onUpdate("gstRate", code.gstRate)
                          }
                        }}
                      />
                    : <Select
                        value={formState.hsnSac}
                        onValueChange={(value) => onUpdate("hsnSac", value ?? "")}
                        disabled={isEditing}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose SAC" />
                        </SelectTrigger>
                        <SelectContent>
                          {hsnSacOptions.map((code) => (
                            <SelectItem key={code.code} value={code.code}>
                              {code.code} · {code.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    }
                  </ProductField>
                  <ProductField label="GST rate" error={formErrors.gstRate}>
                    <Select
                      value={formState.gstRate}
                      onValueChange={(value) => onUpdate("gstRate", value ?? "")}
                      disabled={isEditing}
                    >
                      <SelectTrigger>
                        <SelectDisplayValue
                          value={formState.gstRate}
                          options={gstRateOptions}
                          placeholder="GST rate"
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {gstRateOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </ProductField>
                  {showCessRule ?
                    <ProductField label="Cess rule">
                      <Select
                        value={formState.cessRuleId || "none"}
                        onValueChange={(value) =>
                          onUpdate("cessRuleId", !value || value === "none" ? "" : value)
                        }
                        disabled={isEditing}
                      >
                        <SelectTrigger>
                          <SelectDisplayValue
                            value={formState.cessRuleId || "none"}
                            options={[
                              { value: "none", label: "No cess" },
                              ...cessRuleOptions.map((rule) => ({
                                value: rule.id,
                                label: `${rule.ruleCode} · ${rule.description}`,
                              })),
                            ]}
                            placeholder="Cess rule"
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No cess</SelectItem>
                          {cessRuleOptions.map((rule) => (
                            <SelectItem key={rule.id} value={rule.id}>
                              {rule.ruleCode} · {rule.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ProductField>
                  : null}
                  <ProductField label="Effective from" error={formErrors.effectiveFrom}>
                    <Input
                      type="date"
                      value={formState.effectiveFrom}
                      onChange={(event) => onUpdate("effectiveFrom", event.target.value)}
                      disabled={isEditing}
                    />
                  </ProductField>
                  <ProductField label="Effective to">
                    <Input
                      type="date"
                      value={formState.effectiveTo}
                      onChange={(event) => onUpdate("effectiveTo", event.target.value)}
                      disabled={isEditing}
                    />
                  </ProductField>
                </div>
                {showDefaultWarehouse ? (
                  <div className="mt-4">
                    <ProductField label="Default warehouse" error={formErrors.defaultWarehouseId}>
                      <Select
                        value={formState.defaultWarehouseId || "none"}
                        onValueChange={(value) => {
                          if (!value) {
                            return
                          }

                          onUpdate("defaultWarehouseId", value === "none" ? "" : value)
                        }}
                        disabled={isEditing || activeWarehouseOptions.length === 0}
                      >
                        <SelectTrigger>
                          <SelectDisplayValue
                            value={formState.defaultWarehouseId || "none"}
                            options={[
                              { value: "none", label: "Choose warehouse" },
                              ...activeWarehouseOptions.map((warehouse) => ({
                                value: warehouse.id,
                                label: `${warehouse.name} (${warehouse.warehouseCode ?? "-"})${
                                  warehouse.warehouseCode === "MAIN" ? " · Default" : ""
                                }`,
                              })),
                            ]}
                            placeholder="Default warehouse"
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Choose warehouse</SelectItem>
                          {activeWarehouseOptions.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>
                              {warehouse.name} ({warehouse.warehouseCode})
                              {warehouse.warehouseCode === "MAIN" ? " · Default" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {activeWarehouseOptions.length === 0 ? (
                        <FieldDescription>
                          No active warehouse is available yet. Restart the backend so the
                          default-warehouse migration can run, or create a warehouse from Branches.
                        </FieldDescription>
                      ) : null}
                    </ProductField>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <ProductField label="Base unit" error={formErrors.baseUnit}>
                    <Input
                      value={formState.baseUnit}
                      onChange={(event) =>
                        onUpdate("baseUnit", event.target.value.toUpperCase())
                      }
                      placeholder="PCS"
                      disabled={isEditing}
                    />
                  </ProductField>
                  <ProductField label="GST UQC">
                    <Select
                      value={formState.gstUqc}
                      onValueChange={(value) => onUpdate("gstUqc", value ?? "")}
                      disabled={isEditing}
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
                        onUpdate("conversionFactor", event.target.value)
                      }
                      inputMode="decimal"
                      disabled={isEditing}
                    />
                  </ProductField>
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="mb-4 flex items-center gap-2">
                  <TagsIcon className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium">Price and inventory defaults</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-4">
                  <ProductField label="Retail price" error={formErrors.price}>
                    <InputGroup>
                      <InputGroupAddon>
                        <InputGroupText>₹</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        value={formState.price}
                        onChange={(event) => onUpdate("price", event.target.value)}
                        inputMode="decimal"
                        placeholder="0.00"
                        disabled={isEditing}
                      />
                    </InputGroup>
                  </ProductField>
                  <ProductField label="Margin" error={formErrors.marginPercent}>
                    <InputGroup>
                      <InputGroupInput
                        value={formState.marginPercent}
                        onChange={(event) => onUpdate("marginPercent", event.target.value)}
                        inputMode="decimal"
                        placeholder="0.00"
                        disabled={isEditing}
                      />
                      <InputGroupAddon>
                        <InputGroupText>%</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldDescription>
                      {taxPreview.marginAmount > 0 ?
                        `Estimated margin amount ${formatCurrency(taxPreview.marginAmount)}.`
                      : "Optional target margin for reports and pricing review."}
                    </FieldDescription>
                  </ProductField>
                  <ProductField label="Tax mode">
                    <Select
                      value={formState.taxMode}
                      onValueChange={(value) => onUpdate("taxMode", value as TaxMode)}
                      disabled={isEditing}
                    >
                      <SelectTrigger>
                        <SelectDisplayValue
                          value={formState.taxMode}
                          options={taxModeOptions}
                          placeholder="Tax mode"
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EXCLUSIVE">Tax exclusive</SelectItem>
                        <SelectItem value="INCLUSIVE">Tax inclusive</SelectItem>
                      </SelectContent>
                    </Select>
                  </ProductField>
                  <ProductField label="Primary barcode">
                    <div className="grid gap-2">
                      <Input
                        value={formState.barcode}
                        onChange={(event) => onUpdate("barcode", event.target.value)}
                        onKeyDown={onBarcodeKeyDown}
                        placeholder="Enter, scan, or generate barcode"
                        disabled={isEditing}
                        className="font-mono"
                      />
                      {resolvedMode === "create" ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-xs"
                            onClick={onGenerateBarcode}
                          >
                            <BarcodeIcon className="size-3.5" />
                            Generate
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </ProductField>
                </div>
                <div className="mt-3 rounded-2xl border border-border bg-muted/20 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <CalculatorIcon className="size-4 shrink-0 text-muted-foreground" />
                      <p className="truncate text-sm font-medium">Rate and GST preview</p>
                    </div>
                    <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                      {formState.taxMode === "INCLUSIVE" ? "Tax inclusive" : "Tax exclusive"}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-5">
                    <PreviewMetric
                      label="Margin"
                      value={formatCurrency(taxPreview.marginAmount)}
                    />
                    <PreviewMetric
                      label="Rate after margin"
                      value={formatCurrency(taxPreview.rateAfterMargin)}
                    />
                    <PreviewMetric
                      label="CGST + SGST"
                      value={`${formatCurrency(taxPreview.cgst)} + ${formatCurrency(taxPreview.sgst)}`}
                    />
                    <PreviewMetric
                      label="IGST"
                      value={formatCurrency(taxPreview.igst)}
                    />
                    <PreviewMetric
                      label="Final rate"
                      value={formatCurrency(taxPreview.finalRate)}
                      highlight
                    />
                  </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <ProductField label="Reorder level">
                    <Input
                      value={formState.reorderLevel}
                      onChange={(event) => onUpdate("reorderLevel", event.target.value)}
                      inputMode="decimal"
                      disabled={isEditing}
                    />
                  </ProductField>
                  <ProductField label="Minimum stock">
                    <Input
                      value={formState.minimumStock}
                      onChange={(event) => onUpdate("minimumStock", event.target.value)}
                      inputMode="decimal"
                      disabled={isEditing}
                    />
                  </ProductField>
                  <ProductField label="Maximum stock">
                    <Input
                      value={formState.maximumStock}
                      onChange={(event) => onUpdate("maximumStock", event.target.value)}
                      inputMode="decimal"
                      disabled={isEditing}
                    />
                  </ProductField>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <TogglePill
                    active={formState.trackInventory}
                    label="Track inventory"
                    disabled={isEditing}
                    onClick={() => onUpdate("trackInventory", !formState.trackInventory)}
                  />
                  <TogglePill
                    active={formState.batchTracking}
                    label="Batch tracking"
                    disabled={isEditing}
                    onClick={() => onUpdate("batchTracking", !formState.batchTracking)}
                  />
                  <TogglePill
                    active={formState.serialTracking}
                    label="Serial tracking"
                    disabled={isEditing}
                    onClick={() => onUpdate("serialTracking", !formState.serialTracking)}
                  />
                </div>
              </div>

              <ProductField label="Status">
                <Select
                  value={formState.status}
                  onValueChange={(value) => onUpdate("status", value as ProductStatus)}
                >
                  <SelectTrigger>
                    <SelectDisplayValue
                      value={formState.status}
                      options={productStatusOptions}
                      placeholder="Status"
                    />
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
          <DialogFooter className="border-t border-border px-5 py-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner /> : null}
              {pending ? "" : isEditing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function HsnSearchField({
  accessToken,
  disabled,
  localOptions,
  selectedCode,
  onSelect,
}: {
  accessToken: string
  disabled?: boolean
  localOptions: HsnSacCode[]
  selectedCode: string
  onSelect: (code: HsnCodeSearchResult) => void
}) {
  const selectedLocalCode = localOptions.find((option) => option.code === selectedCode)
  const [search, setSearch] = React.useState(() =>
    selectedLocalCode ? `${selectedLocalCode.code} · ${selectedLocalCode.description}` : selectedCode
  )
  const [open, setOpen] = React.useState(false)
  const debouncedSearch = useDebouncedValue(search, 250)
  const searchTerm = debouncedSearch.trim()
  const shouldSearch = !disabled && accessToken.length > 0 && searchTerm.length >= 2
  const hsnQuery = useQuery({
    queryKey: ["products", "hsn-search", searchTerm],
    queryFn: () => searchHsnCodes(accessToken, { q: searchTerm, limit: 10 }),
    enabled: shouldSearch,
    staleTime: 1000 * 60 * 30,
  })
  const localMatches = React.useMemo(() => {
    if (searchTerm.length < 2) {
      return []
    }

    const normalized = searchTerm.toLowerCase()
    return localOptions
      .filter(
        (option) =>
          option.code.includes(searchTerm) ||
          option.description.toLowerCase().includes(normalized)
      )
      .slice(0, 6)
      .map((option) => ({
        code: option.code,
        description: option.description,
        gstRate: null,
        source: "master" as const,
      }))
  }, [localOptions, searchTerm])
  const results = React.useMemo(() => {
    const merged = new Map<string, HsnCodeSearchResult>()

    for (const option of localMatches) {
      merged.set(option.code, option)
    }

    for (const option of hsnQuery.data?.codes ?? []) {
      merged.set(option.code, option)
    }

    return Array.from(merged.values()).slice(0, 10)
  }, [hsnQuery.data?.codes, localMatches])

  return (
    <div className="relative">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon className="size-4 text-muted-foreground" />
        </InputGroupAddon>
        <InputGroupInput
          value={search}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setSearch(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search rice, textile or 1006"
          disabled={disabled}
        />
      </InputGroup>
      {open && !disabled ?
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {hsnQuery.isFetching ?
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Searching HSN codes
            </div>
          : null}
          {!hsnQuery.isFetching && searchTerm.length < 2 ?
            <div className="px-3 py-3 text-sm text-muted-foreground">
              Type at least 2 characters to search HSN codes.
            </div>
          : null}
          {!hsnQuery.isFetching && searchTerm.length >= 2 && results.length === 0 ?
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No HSN code found for this search.
            </div>
          : null}
          {results.map((option) => (
            <button
              key={`${option.source}-${option.code}`}
              type="button"
              className={cn(
                "flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                selectedCode === option.code && "bg-accent/70"
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(option)
                setSearch(`${option.code} · ${option.description}`)
                setOpen(false)
              }}
            >
              <span className="mt-0.5 font-mono text-xs font-medium tracking-[0.14em]">
                {option.code}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-xs leading-5">{option.description}</span>
                <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {option.source === "tally" ? "Tally HSN dataset" : "Local master"}
                </span>
              </span>
              {selectedCode === option.code ? <CheckIcon className="mt-0.5 size-4" /> : null}
            </button>
          ))}
        </div>
      : null}
    </div>
  )
}

function CreatableMasterField({
  createLabel,
  creating,
  options,
  placeholder,
  value,
  onChange,
  onCreate,
}: {
  createLabel: string
  creating: boolean
  options: string[]
  placeholder: string
  value: string
  onChange: (value: string) => void
  onCreate: (name: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const normalizedValue = normalizeMasterInput(value)
  const matchingOptions = React.useMemo(() => {
    const search = normalizedValue.toLowerCase()

    if (!search) {
      return options.slice(0, 8)
    }

    return options
      .filter((option) => option.toLowerCase().includes(search))
      .slice(0, 8)
  }, [normalizedValue, options])
  const exactMatch = options.some(
    (option) => option.toLowerCase() === normalizedValue.toLowerCase()
  )
  const canCreate = normalizedValue.length > 0 && !exactMatch

  return (
    <div className="relative">
      <Input
        value={value}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open ?
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {matchingOptions.map((option) => (
            <button
              key={option}
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option)
                setOpen(false)
              }}
            >
              <span className="truncate">{option}</span>
              {option.toLowerCase() === normalizedValue.toLowerCase() ?
                <CheckIcon className="size-4" />
              : null}
            </button>
          ))}
          {matchingOptions.length === 0 && !canCreate ?
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No saved values yet.
            </div>
          : null}
          {canCreate ?
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              disabled={creating}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onCreate(normalizedValue)
                setOpen(false)
              }}
            >
              <span className="truncate">
                {createLabel} <span aria-hidden="true">&quot;</span>
                {normalizedValue}
                <span aria-hidden="true">&quot;</span>
              </span>
              {creating ? <Spinner className="size-4" /> : <CheckIcon className="size-4" />}
            </button>
          : null}
        </div>
      : null}
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

function normalizeMasterInput(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function PreviewMetric({
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

function getTaxPreview(
  price: string,
  marginPercent: string,
  gstRate: string,
  taxMode: TaxMode
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
      taxableValue: 0,
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
    taxMode === "INCLUSIVE" ? rateAfterMargin - taxableValue : taxableValue * (parsedGstRate / 100)
  const halfTax = igst / 2
  const finalRate = taxMode === "INCLUSIVE" ? rateAfterMargin : taxableValue + igst

  return {
    marginAmount,
    rateAfterMargin,
    taxableValue,
    cgst: halfTax,
    sgst: halfTax,
    igst,
    finalRate,
  }
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = React.useState(value)

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs)

    return () => window.clearTimeout(timer)
  }, [delayMs, value])

  return debouncedValue
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value)
}
