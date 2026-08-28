"use client";

import * as React from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  BarcodeIcon,
  CalculatorIcon,
  CalendarIcon,
  CheckIcon,
  ImageIcon,
  InfoIcon,
  ReceiptTextIcon,
  TagsIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectDisplayValue,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CessRule } from "@/lib/tax/api";
import type { WarehouseRecord } from "@/lib/organization/api";
import type {
  HsnCodeSearchResult,
  HsnSacCode,
  ProductItemType,
  Taxability,
  TaxMode,
  UqcCode,
} from "@/lib/products/api";
import { searchHsnCodes } from "@/lib/products/api";
import { cn } from "@/lib/utils";
import type {
  ProductFormErrors,
  ProductFormState,
  SheetMode,
} from "./product-form-types";

type ProductUpsertDialogProps = {
  accessToken: string;
  brandOptions: string[];
  categoryOptions: string[];
  cessRuleOptions: CessRule[];
  creatingBrand: boolean;
  creatingCategory: boolean;
  formErrors: ProductFormErrors;
  formState: ProductFormState;
  gstRateOptions: Array<{ value: string; label: string }>;
  hsnSacOptions: HsnSacCode[];
  mode: SheetMode | null;
  open: boolean;
  pending: boolean;
  uploadingImage: boolean;
  uqcOptions: UqcCode[];
  warehouseOptions: WarehouseRecord[];
  onBarcodeKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onClose: () => void;
  onCreateBrand: (name: string) => void;
  onCreateCategory: (name: string) => void;
  onGenerateBarcode: () => void;
  onImageUpload: (file: File) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K],
  ) => void;
};

const itemTypeLabels: Record<ProductItemType, string> = {
  GOODS: "Goods",
  SERVICE: "Service",
};

const taxabilityLabels: Record<Taxability, string> = {
  TAXABLE: "Taxable",
  EXEMPT: "Exempt",
  NIL_RATED: "Nil rated",
  NON_GST: "Non-GST",
  ZERO_RATED: "Zero rated",
};

const itemTypes: ProductItemType[] = ["GOODS", "SERVICE"];
const taxabilities: Taxability[] = [
  "TAXABLE",
  "EXEMPT",
  "NIL_RATED",
  "NON_GST",
  "ZERO_RATED",
];

const productTypeOptions = itemTypes.map((itemType) => ({
  value: itemType,
  label: itemTypeLabels[itemType],
}));

const taxabilityOptions = taxabilities.map((taxability) => ({
  value: taxability,
  label: taxabilityLabels[taxability],
}));

const taxModeOptions: Array<{ value: TaxMode; label: string }> = [
  { value: "EXCLUSIVE", label: "Tax exclusive" },
  { value: "INCLUSIVE", label: "Tax inclusive" },
];

type ProductFormTab = "basics" | "tax" | "pricing" | "inventory";

const productFormTabs: Array<{
  value: ProductFormTab;
  label: string;
  description: string;
}> = [
    {
      value: "basics",
      label: "Basics",
      description: "Name, type, category and product identity.",
    },
    {
      value: "tax",
      label: "Tax & unit",
      description: "HSN/SAC, GST rate, UQC and effective dates.",
    },
    {
      value: "pricing",
      label: "Pricing",
      description: "Base price, margin, barcode and final selling price.",
    },
    {
      value: "inventory",
      label: "Inventory",
      description: "Warehouse, reorder points and stock tracking.",
    },
  ];

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
  uploadingImage,
  uqcOptions,
  warehouseOptions,
  onBarcodeKeyDown,
  onClose,
  onCreateBrand,
  onCreateCategory,
  onGenerateBarcode,
  onImageUpload,
  onSubmit,
  onUpdate,
}: ProductUpsertDialogProps) {
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = React.useState<ProductFormTab>("basics");
  const resolvedMode = mode ?? "create";
  const isEditing = resolvedMode === "edit";
  const primaryImage = formState.images[0] ?? null;
  const showCessRule =
    formState.taxability === "TAXABLE" && cessRuleOptions.length > 0;
  const activeWarehouseOptions = warehouseOptions.filter(
    (warehouse) => warehouse.status.toLowerCase() === "active",
  );
  const showDefaultWarehouse = formState.trackInventory;
  const taxPreview = getTaxPreview(
    formState.price,
    formState.marginPercent,
    formState.gstRate,
    formState.taxMode,
  );
  const activeTabIndex = productFormTabs.findIndex(
    (tab) => tab.value === activeTab,
  );
  const isFirstTab = activeTabIndex <= 0;
  const isLastTab = activeTabIndex === productFormTabs.length - 1;
  const activeTabConfig =
    productFormTabs[Math.max(activeTabIndex, 0)] ?? productFormTabs[0];

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      setActiveTab("basics");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, resolvedMode]);

  function moveTab(direction: "next" | "previous") {
    const nextIndex =
      direction === "next"
        ? Math.min(activeTabIndex + 1, productFormTabs.length - 1)
        : Math.max(activeTabIndex - 1, 0);
    const nextTab = productFormTabs[nextIndex];

    if (nextTab) {
      setActiveTab(nextTab.value);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-5xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-3 pr-12">
          <DialogTitle>
            {isEditing ? "Edit product" : "Add product"}
          </DialogTitle>
          <DialogDescription>
            Set the product defaults used by sales, purchase, tax and stock
            flows.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            if (!isLastTab) {
              event.preventDefault();
              moveTab("next");
              return;
            }

            onSubmit(event);
          }}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                onImageUpload(file);
              }

              event.currentTarget.value = "";
            }}
          />
          <Tabs
            value={activeTab}
            defaultValue="basics"
            onValueChange={(value) => setActiveTab(value as ProductFormTab)}
            className="min-h-0 flex-1 gap-0 overflow-hidden"
          >
            <div className="border-b border-border px-5 py-3">
              <TabsList className="app-scrollbar flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-0 bg-transparent p-0">
                {productFormTabs.map((tab, index) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="min-w-fit gap-2 rounded-full border border-transparent bg-transparent px-3 py-1.5 text-xs shadow-none data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <span className="flex size-5 items-center justify-center rounded-full border border-border text-[10px]">
                      {index + 1}
                    </span>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <p className="mt-2 text-xs text-muted-foreground">
                {activeTabConfig.description}
              </p>
            </div>
            <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-3">
              <TabsContent value="basics" className="m-0">
                <FieldGroup className="gap-4">
                  <ProductImagePicker
                    imageUrl={primaryImage?.publicUrl ?? null}
                    uploading={uploadingImage}
                    onClear={() => onUpdate("images", [])}
                    onPick={() => imageInputRef.current?.click()}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <ProductField label="Product name" error={formErrors.name}>
                      <Input
                        value={formState.name}
                        onChange={(event) =>
                          onUpdate("name", event.target.value)
                        }
                        placeholder="Premium Tea Pack 250g"
                      />
                    </ProductField>
                    <ProductField
                      label="SKU"
                      description="Generated by the system and used as the stable internal product code."
                      error={formErrors.sku}
                    >
                      <Input
                        value={formState.sku}
                        readOnly
                        placeholder="Auto-generated"
                        className="bg-muted/30 font-mono uppercase tracking-[0.14em] text-muted-foreground"
                      />
                    </ProductField>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <ProductField
                      label="Type"
                      description="Goods can affect stock; services use SAC and normally do not need warehouse stock."
                    >
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
                    <ProductField
                      label="Category"
                      description="Group products for filtering, reports and faster billing."
                    >
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
                    <ProductField
                      label="Brand"
                      description="Optional tenant-level brand master. New values can be created here."
                    >
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
                        onChange={(event) =>
                          onUpdate("manufacturer", event.target.value)
                        }
                        placeholder="Brand or maker"
                      />
                    </ProductField>
                    <ProductField label="Model number">
                      <Input
                        value={formState.modelNumber}
                        onChange={(event) =>
                          onUpdate("modelNumber", event.target.value)
                        }
                        placeholder="Optional"
                      />
                    </ProductField>
                  </div>

                  <ProductField label="Description">
                    <Textarea
                      value={formState.description}
                      onChange={(event) =>
                        onUpdate("description", event.target.value)
                      }
                      placeholder="Short invoice description"
                      rows={3}
                    />
                  </ProductField>
                </FieldGroup>
              </TabsContent>

              <TabsContent value="tax" className="m-0">
                <FieldGroup className="gap-4">
                  <div className="rounded-2xl border p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <ReceiptTextIcon className="size-4 text-muted-foreground" />
                      <h2 className="text-sm font-medium">
                        Tax and unit defaults
                      </h2>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-12">
                      <ProductField
                        label="Taxability"
                        description="Controls whether GST applies to this product in invoices and returns."
                        error={formErrors.taxability}
                        className="lg:col-span-3"
                      >
                        <Select
                          value={formState.taxability}
                          onValueChange={(value) =>
                            onUpdate("taxability", value as Taxability)
                          }
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
                        description="Required for GST reporting and used to resolve tax defaults on invoices."
                        error={formErrors.hsnSac}
                        className={showCessRule ? "lg:col-span-4" : "lg:col-span-6"}
                      >
                        {formState.itemType === "GOODS" ? (
                          <HsnSearchField
                            key={`${open}-${resolvedMode}-${formState.itemType}`}
                            accessToken={accessToken}
                            localOptions={hsnSacOptions}
                            selectedCode={formState.hsnSac}
                            onSelect={(code) => {
                              onUpdate("hsnSac", code.code);

                              if (code.gstRate) {
                                onUpdate("gstRate", code.gstRate);
                              }
                            }}
                          />
                        ) : (
                          <Select
                            value={formState.hsnSac}
                            onValueChange={(value) =>
                              onUpdate("hsnSac", value ?? "")
                            }
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
                        )}
                      </ProductField>
                      <ProductField
                        label="GST rate"
                        description="Loaded from enabled GST slabs in Settings."
                        error={formErrors.gstRate}
                        className="lg:col-span-3"
                      >
                        <Select
                          value={formState.gstRate}
                          onValueChange={(value) =>
                            onUpdate("gstRate", value ?? "")
                          }
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
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </ProductField>
                      {showCessRule ? (
                        <ProductField
                          label="Cess rule"
                          description="Only use this for products covered by enabled compensation cess rules."
                          className="lg:col-span-2"
                        >
                          <Select
                            value={formState.cessRuleId || "none"}
                            onValueChange={(value) =>
                              onUpdate(
                                "cessRuleId",
                                !value || value === "none" ? "" : value,
                              )
                            }
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
                      ) : null}
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <ProductField
                        label="Effective from"
                        description="The date from which this tax profile is valid."
                        error={formErrors.effectiveFrom}
                      >
                        <ProductDatePicker
                          value={formState.effectiveFrom}
                          placeholder="Select start date"
                          onChange={(value) => onUpdate("effectiveFrom", value)}
                        />
                      </ProductField>
                      <ProductField
                        label="Effective to"
                        description="Leave empty when the current tax profile has no planned end date."
                      >
                        <ProductDatePicker
                          value={formState.effectiveTo}
                          placeholder="No end date"
                          clearable
                          onChange={(value) => onUpdate("effectiveTo", value)}
                        />
                      </ProductField>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <ProductField
                        label="Base unit"
                        description="The unit used for stock quantity and invoice line quantity."
                        error={formErrors.baseUnit}
                      >
                        <Input
                          value={formState.baseUnit}
                          onChange={(event) =>
                            onUpdate(
                              "baseUnit",
                              event.target.value.toUpperCase(),
                            )
                          }
                          placeholder="PCS"
                        />
                      </ProductField>
                      <ProductField
                        label="GST UQC"
                        description="GST Unit Quantity Code used in statutory reports."
                      >
                        <Select
                          value={formState.gstUqc}
                          onValueChange={(value) =>
                            onUpdate("gstUqc", value ?? "")
                          }
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
                      <ProductField
                        label="Conversion factor"
                        description="Keep 1 when the GST UQC and base stock unit are the same."
                      >
                        <Input
                          value={formState.conversionFactor}
                          onChange={(event) =>
                            onUpdate("conversionFactor", event.target.value)
                          }
                          inputMode="decimal"
                        />
                      </ProductField>
                    </div>
                  </div>
                </FieldGroup>
              </TabsContent>

              <TabsContent value="pricing" className="m-0">
                <FieldGroup className="gap-4">
                  <div className="rounded-2xl border p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <TagsIcon className="size-4 text-muted-foreground" />
                      <h2 className="text-sm font-medium">
                        Price and inventory defaults
                      </h2>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-4">
                      <ProductField
                        label="Cost / base price"
                        description="Enter the product base amount. Margin and GST calculate the final selling rate."
                        error={formErrors.price}
                      >
                        <InputGroup>
                          <InputGroupAddon>
                            <InputGroupText>₹</InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            value={formState.price}
                            onChange={(event) =>
                              onUpdate("price", event.target.value)
                            }
                            inputMode="decimal"
                            placeholder="0.00"
                          />
                        </InputGroup>
                      </ProductField>
                      <ProductField
                        label="Margin"
                        description="Target profit percentage added over the base amount before billing."
                        error={formErrors.marginPercent}
                      >
                        <InputGroup>
                          <InputGroupInput
                            value={formState.marginPercent}
                            onChange={(event) =>
                              onUpdate("marginPercent", event.target.value)
                            }
                            inputMode="decimal"
                            placeholder="0.00"
                          />
                          <InputGroupAddon>
                            <InputGroupText>%</InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                      </ProductField>
                      <ProductField
                        label="GST calculation mode"
                        description="Exclusive adds GST on top. Inclusive treats the final rate as GST-included."
                      >
                        <Select
                          value={formState.taxMode}
                          onValueChange={(value) =>
                            onUpdate("taxMode", value as TaxMode)
                          }
                        >
                          <SelectTrigger>
                            <SelectDisplayValue
                              value={formState.taxMode}
                              options={taxModeOptions}
                              placeholder="Tax mode"
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EXCLUSIVE">
                              Tax exclusive
                            </SelectItem>
                            <SelectItem value="INCLUSIVE">
                              Tax inclusive
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </ProductField>
                      <ProductField
                        label="Primary barcode"
                        description="Enter an existing barcode, scan with a keyboard-mode scanner, or generate one."
                      >
                        <div className="grid gap-2">
                          <Input
                            value={formState.barcode}
                            onChange={(event) =>
                              onUpdate("barcode", event.target.value)
                            }
                            onKeyDown={onBarcodeKeyDown}
                            placeholder="Enter, scan, or generate barcode"
                            className="font-mono"
                          />
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
                        </div>
                      </ProductField>
                    </div>
                    <div className="mt-3 rounded-2xl border border-border bg-muted/20 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <CalculatorIcon className="size-4 shrink-0 text-muted-foreground" />
                          <p className="truncate text-sm font-medium">
                            Final price preview
                          </p>
                        </div>
                        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                          {formState.taxMode === "INCLUSIVE"
                            ? "Tax inclusive"
                            : "Tax exclusive"}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-5">
                        <PreviewMetric
                          label="Margin"
                          value={formatCurrency(taxPreview.marginAmount)}
                        />
                        <PreviewMetric
                          label="After margin"
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
                          label="Final retail price"
                          value={formatCurrency(taxPreview.finalRate)}
                          highlight
                        />
                      </div>
                    </div>
                  </div>
                </FieldGroup>
              </TabsContent>

              <TabsContent value="inventory" className="m-0">
                <FieldGroup className="gap-4">
                  <div className="rounded-2xl border p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <BarcodeIcon className="size-4 text-muted-foreground" />
                      <h2 className="text-sm font-medium">Inventory control</h2>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                      <TogglePill
                        active={formState.trackInventory}
                        label="Track inventory"
                        description="Keeps quantity on hand and stock value for this item."
                        onClick={() =>
                          onUpdate("trackInventory", !formState.trackInventory)
                        }
                      />
                      <TogglePill
                        active={formState.batchTracking}
                        label="Batch tracking"
                        description="Use for expiry, manufacturing lots or batch-number controlled goods."
                        onClick={() =>
                          onUpdate("batchTracking", !formState.batchTracking)
                        }
                      />
                      <TogglePill
                        active={formState.serialTracking}
                        label="Serial tracking"
                        description="Use when each unit has a unique serial number, like electronics."
                        onClick={() =>
                          onUpdate("serialTracking", !formState.serialTracking)
                        }
                      />
                    </div>

                    {showDefaultWarehouse ? (
                      <ProductField
                        label="Default warehouse"
                        description="Stock entries use this warehouse first unless a transaction chooses another one."
                        error={formErrors.defaultWarehouseId}
                      >
                        <Select
                          value={formState.defaultWarehouseId || "none"}
                          onValueChange={(value) => {
                            if (!value) {
                              return;
                            }

                            onUpdate(
                              "defaultWarehouseId",
                              value === "none" ? "" : value,
                            );
                          }}
                          disabled={activeWarehouseOptions.length === 0}
                        >
                          <SelectTrigger>
                            <SelectDisplayValue
                              value={formState.defaultWarehouseId || "none"}
                              options={[
                                { value: "none", label: "Choose warehouse" },
                                ...activeWarehouseOptions.map((warehouse) => ({
                                  value: warehouse.id,
                                  label: `${warehouse.name} (${warehouse.warehouseCode ?? "-"})${warehouse.warehouseCode === "MAIN"
                                      ? " · Default"
                                      : ""
                                    }`,
                                })),
                              ]}
                              placeholder="Default warehouse"
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              Choose warehouse
                            </SelectItem>
                            {activeWarehouseOptions.map((warehouse) => (
                              <SelectItem
                                key={warehouse.id}
                                value={warehouse.id}
                              >
                                {warehouse.name} ({warehouse.warehouseCode})
                                {warehouse.warehouseCode === "MAIN"
                                  ? " · Default"
                                  : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {activeWarehouseOptions.length === 0 ? (
                          <FieldDescription>
                            No active warehouse is available yet. Restart the
                            backend so the default-warehouse migration can run,
                            or create a warehouse from Branches.
                          </FieldDescription>
                        ) : null}
                      </ProductField>
                    ) : null}

                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <ProductField
                        label="Reorder level"
                        description="When stock reaches this quantity, the low-stock watch asks you to buy again."
                      >
                        <Input
                          value={formState.reorderLevel}
                          onChange={(event) =>
                            onUpdate("reorderLevel", event.target.value)
                          }
                          inputMode="decimal"
                        />
                      </ProductField>
                      <ProductField
                        label="Minimum stock"
                        description="The safety floor. Falling below this means the item is critically low."
                      >
                        <Input
                          value={formState.minimumStock}
                          onChange={(event) =>
                            onUpdate("minimumStock", event.target.value)
                          }
                          inputMode="decimal"
                        />
                      </ProductField>
                      <ProductField
                        label="Maximum stock"
                        description="The upper comfort limit to avoid overstocking slow-moving products."
                      >
                        <Input
                          value={formState.maximumStock}
                          onChange={(event) =>
                            onUpdate("maximumStock", event.target.value)
                          }
                          inputMode="decimal"
                        />
                      </ProductField>
                    </div>
                  </div>
                </FieldGroup>
              </TabsContent>
            </div>
          </Tabs>
          <DialogFooter className="items-center border-t border-border px-5 py-3">
            <div className="mr-auto text-xs text-muted-foreground">
              Step {Math.max(activeTabIndex, 0) + 1} of {productFormTabs.length}
            </div>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isFirstTab || pending}
              onClick={() => moveTab("previous")}
            >
              Back
            </Button>
            <Button type="submit" disabled={pending}>
              {isLastTab ? pending ? <Spinner /> : null : null}
              {!isLastTab
                ? "Continue"
                : pending
                  ? ""
                  : isEditing
                    ? "Save"
                    : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductImagePicker({
  imageUrl,
  onClear,
  onPick,
  uploading,
}: {
  imageUrl: string | null;
  onClear: () => void;
  onPick: () => void;
  uploading: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-muted/15 p-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center">
      <div
        className={cn(
          "flex aspect-square w-28 items-center justify-center overflow-hidden rounded-xl border border-border bg-background text-muted-foreground",
          imageUrl && "border-transparent",
        )}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt="Product preview"
            width={112}
            height={112}
            unoptimized
            className="size-full object-cover"
          />
        ) : (
          <ImageIcon className="size-8" />
        )}
      </div>
      <div className="min-w-0 space-y-2">
        <div className="space-y-1">
          <p className="text-sm font-medium">Product image</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Upload one clear product photo. JPG, PNG and WebP are supported up
            to 15 MB.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={uploading}
            onClick={onPick}
          >
            {uploading ? <Spinner /> : <UploadCloudIcon className="size-3.5" />}
            {uploading ? "" : imageUrl ? "Change image" : "Upload image"}
          </Button>
          {imageUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
              disabled={uploading}
              onClick={onClear}
            >
              <XIcon className="size-3.5" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HsnSearchField({
  accessToken,
  disabled,
  localOptions,
  selectedCode,
  onSelect,
}: {
  accessToken: string;
  disabled?: boolean;
  localOptions: HsnSacCode[];
  selectedCode: string;
  onSelect: (code: HsnCodeSearchResult) => void;
}) {
  const selectedLocalCode = localOptions.find(
    (option) => option.code === selectedCode,
  );
  const selectedLabel = selectedLocalCode
    ? `${selectedLocalCode.code} · ${selectedLocalCode.description}`
    : selectedCode;
  const [search, setSearch] = React.useState(() =>
    selectedLabel,
  );
  const [selectedDisplay, setSelectedDisplay] = React.useState(selectedLabel);
  const debouncedSearch = useDebouncedValue(search, 250);
  const searchTerm = debouncedSearch.trim();
  const shouldSearch =
    !disabled && accessToken.length > 0 && searchTerm.length >= 2;
  const hsnQuery = useQuery({
    queryKey: ["products", "hsn-search", searchTerm],
    queryFn: () => searchHsnCodes(accessToken, { q: searchTerm, limit: 10 }),
    enabled: shouldSearch,
    staleTime: 1000 * 60 * 30,
  });
  const localMatches = React.useMemo(() => {
    if (searchTerm.length < 2) {
      return [];
    }

    const normalized = searchTerm.toLowerCase();
    return localOptions
      .filter(
        (option) =>
          option.code.includes(searchTerm) ||
          option.description.toLowerCase().includes(normalized),
      )
      .slice(0, 6)
      .map((option) => ({
        code: option.code,
        description: option.description,
        gstRate: null,
        source: "master" as const,
      }));
  }, [localOptions, searchTerm]);
  const results = React.useMemo(() => {
    const merged = new Map<string, HsnCodeSearchResult>();

    for (const option of localMatches) {
      merged.set(option.code, option);
    }

    for (const option of hsnQuery.data?.codes ?? []) {
      merged.set(option.code, option);
    }

    return Array.from(merged.values()).slice(0, 10);
  }, [hsnQuery.data?.codes, localMatches]);
  const comboboxOptions = React.useMemo<ComboboxOption[]>(
    () =>
      results.map((option) => ({
        value: option.code,
        searchValue: `${option.code} ${option.description}`,
        label: (
          <HsnResultOption
            option={option}
            selected={selectedCode === option.code}
          />
        ),
      })),
    [results, selectedCode],
  );
  const visibleSelectedLabel =
    selectedCode &&
      (selectedDisplay === selectedCode ||
        selectedDisplay.startsWith(`${selectedCode} ·`))
      ? selectedDisplay
      : selectedLabel;

  return (
    <Combobox
      disabled={disabled}
      value={selectedCode}
      displayValue={
        visibleSelectedLabel ? (
          <span className="font-mono text-xs tracking-[0.14em]">
            {visibleSelectedLabel}
          </span>
        ) : null
      }
      placeholder="Search HSN code"
      searchPlaceholder="Search product, HSN code, textile, rice..."
      searchValue={search}
      onSearchValueChange={setSearch}
      options={comboboxOptions}
      loading={hsnQuery.isFetching}
      loadingMessage="Searching HSN codes"
      emptyMessage={
        searchTerm.length < 2
          ? "Type at least 2 characters to search HSN codes."
          : "No HSN code found for this search."
      }
      onValueChange={(value) => {
        const selected =
          results.find((option) => option.code === value) ??
          localOptions
            .filter((option) => option.code === value)
            .map((option) => ({
              code: option.code,
              description: option.description,
              gstRate: null,
              source: "master" as const,
            }))[0];

        if (!selected) {
          return;
        }

        onSelect(selected);
        const nextLabel = `${selected.code} · ${selected.description}`;
        setSelectedDisplay(nextLabel);
        setSearch(nextLabel);
      }}
    />
  );
}

function HsnResultOption({
  option,
  selected,
}: {
  option: HsnCodeSearchResult;
  selected: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-start gap-3">
      <span className="mt-0.5 font-mono text-xs font-medium tracking-[0.14em]">
        {option.code}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-xs leading-5">
          {option.description}
        </span>
        <span className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>
            {option.source === "hsnlookup"
              ? "HSNLookup public dataset"
              : "Local master"}
          </span>
          {option.gstRate ? <span>{option.gstRate}% GST</span> : null}
        </span>
      </span>
      {selected ? <CheckIcon className="mt-0.5 size-4 text-primary" /> : null}
    </span>
  );
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
  createLabel: string;
  creating: boolean;
  options: string[];
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onCreate: (name: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const normalizedValue = normalizeMasterInput(value);
  const matchingOptions = React.useMemo(() => {
    const search = normalizedValue.toLowerCase();

    if (!search) {
      return options.slice(0, 8);
    }

    return options
      .filter((option) => option.toLowerCase().includes(search))
      .slice(0, 8);
  }, [normalizedValue, options]);
  const exactMatch = options.some(
    (option) => option.toLowerCase() === normalizedValue.toLowerCase(),
  );
  const canCreate = normalizedValue.length > 0 && !exactMatch;

  return (
    <div className="relative">
      <Input
        value={value}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open ? (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {matchingOptions.map((option) => (
            <button
              key={option}
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              <span className="truncate">{option}</span>
              {option.toLowerCase() === normalizedValue.toLowerCase() ? (
                <CheckIcon className="size-4" />
              ) : null}
            </button>
          ))}
          {matchingOptions.length === 0 && !canCreate ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No saved values yet.
            </div>
          ) : null}
          {canCreate ? (
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              disabled={creating}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onCreate(normalizedValue);
                setOpen(false);
              }}
            >
              <span className="truncate">
                {createLabel} <span aria-hidden="true">&quot;</span>
                {normalizedValue}
                <span aria-hidden="true">&quot;</span>
              </span>
              {creating ? (
                <Spinner className="size-4" />
              ) : (
                <CheckIcon className="size-4" />
              )}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ProductField({
  label,
  error,
  description,
  className,
  children,
}: {
  label: string;
  error?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Field data-invalid={Boolean(error)} className={className}>
      <FieldLabel className="gap-1.5">
        {label}
        {description ? <InfoTooltip description={description} /> : null}
        {error ? <span className="text-destructive">*</span> : null}
      </FieldLabel>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

function ProductDatePicker({
  clearable,
  placeholder,
  value,
  onChange,
}: {
  clearable?: boolean;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedDate = parseDateValue(value);

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className={cn(
          "flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
          !value && "text-muted-foreground",
        )}
      >
        <span className="truncate">
          {value ? formatDateForDisplay(value) : placeholder}
        </span>
        <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          captionLayout="dropdown"
          onSelect={(date) => {
            if (date) {
              onChange(formatDateForInput(date));
            }
          }}
        />
        {clearable && value ? (
          <div className="border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-center text-muted-foreground"
              onClick={() => onChange("")}
            >
              Clear date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function parseDateValue(value: string) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return undefined;
  }

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(value: string) {
  const date = parseDateValue(value);
  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function normalizeMasterInput(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function PreviewMetric({
  highlight,
  label,
  value,
}: {
  highlight?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background px-3 py-2",
        highlight && "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-sm font-medium">{value}</p>
    </div>
  );
}

function TogglePill({
  active,
  disabled,
  description,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  description?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      disabled={disabled}
      className="gap-1.5"
      onClick={onClick}
    >
      {label}
      {description ? (
        <InfoTooltip
          description={description}
          className={active ? "text-primary-foreground/80" : undefined}
        />
      ) : null}
    </Button>
  );
}

function InfoTooltip({
  className,
  description,
}: {
  className?: string;
  description: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            aria-label={description}
            className={cn(
              "inline-flex cursor-help items-center text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground",
              className,
            )}
            role="button"
            tabIndex={0}
          />
        }
      >
        <InfoIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        className="max-w-64 text-pretty"
      >
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

function getTaxPreview(
  price: string,
  marginPercent: string,
  gstRate: string,
  taxMode: TaxMode,
) {
  const parsedPrice = Number(price || 0);
  const parsedMargin = Number(marginPercent || 0);
  const parsedGstRate = Number(gstRate || 0);

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
    };
  }

  const marginAmount = (parsedPrice * parsedMargin) / 100;
  const rateAfterMargin = parsedPrice + marginAmount;
  const taxableValue =
    taxMode === "INCLUSIVE" && parsedGstRate > 0
      ? rateAfterMargin / (1 + parsedGstRate / 100)
      : rateAfterMargin;
  const igst =
    taxMode === "INCLUSIVE"
      ? rateAfterMargin - taxableValue
      : taxableValue * (parsedGstRate / 100);
  const halfTax = igst / 2;
  const finalRate =
    taxMode === "INCLUSIVE" ? rateAfterMargin : taxableValue + igst;

  return {
    marginAmount,
    rateAfterMargin,
    taxableValue,
    cgst: halfTax,
    sgst: halfTax,
    igst,
    finalRate,
  };
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);

    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}
