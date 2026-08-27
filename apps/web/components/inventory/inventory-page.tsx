"use client"

import * as React from "react"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowDownIcon,
  ArrowDownUpIcon,
  ArrowUpIcon,
  ArrowRightLeftIcon,
  BoxesIcon,
  CalendarIcon,
  ClipboardListIcon,
  EyeIcon,
  PackagePlusIcon,
  RefreshCcwIcon,
  Settings2Icon,
  WarehouseIcon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "@/components/ui/toast"
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  cancelInventoryTransfer,
  createInventoryTransfer,
  dispatchInventoryTransfer,
  getInventorySettings,
  getInventorySummary,
  getItemLedger,
  getWarehouseStock,
  listInventoryTransfers,
  postInventoryAdjustment,
  postOpeningStock,
  receiveInventoryTransfer,
  type CreateInventoryTransferPayload,
  type InventoryAdjustmentPayload,
  type InventoryTransfer,
  type OpeningStockPayload,
} from "@/lib/inventory/api"
import { getBranches, getWarehouses, type WarehouseRecord } from "@/lib/organization/api"
import { listProducts, type ProductListItem } from "@/lib/products/api"
import { cn } from "@/lib/utils"

type StockFormState = {
  itemId: string
  warehouseId: string
  branchId: string
  quantity: string
  unitCost: string
  transactionDate: string
  batchNumber: string
  serialNumbers: string
  reason: string
}

type AdjustmentFormState = StockFormState & {
  direction: "in" | "out"
  adjustmentType: "ADJUSTMENT" | "DAMAGE" | "EXPIRY"
}

type TransferFormState = {
  itemId: string
  sourceWarehouseId: string
  destinationWarehouseId: string
  branchId: string
  quantity: string
  unitCost: string
  transferDate: string
  referenceNumber: string
  notes: string
}

type InventoryTab = "stock" | "movements" | "transfers"
type InventorySettingsPolicy = "ALLOW" | "WARN" | "BLOCK"
type WarehouseStockSortKey = "item" | "quantityOnHand" | "averageCost" | "inventoryValue"
type InventoryLedgerSortKey =
  | "date"
  | "movement"
  | "quantityIn"
  | "quantityOut"
  | "value"
type SortDirection = "asc" | "desc"
type ValueTone = "default" | "positive" | "danger" | "warning" | "muted"
type BranchOption = {
  id: string
  name: string
  branchCode?: string
  status?: string
}

const today = new Date().toISOString().slice(0, 10)
const inventoryTablePageSize = 15
const inventoryPolicyLabels: Record<InventorySettingsPolicy, string> = {
  ALLOW: "Allow",
  WARN: "Warn first",
  BLOCK: "Block",
}
const adjustmentDirectionOptions = [
  { value: "in", label: "Stock in" },
  { value: "out", label: "Stock out" },
]
const stockCorrectionTypeOptions = [
  { value: "ADJUSTMENT", label: "Correction" },
  { value: "DAMAGE", label: "Damage" },
  { value: "EXPIRY", label: "Expiry" },
]
const inventoryTabTriggerClass =
  "relative h-7 min-w-0 rounded-none px-0 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none dark:data-[state=active]:text-blue-400 after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:scale-x-0 after:rounded-full after:bg-blue-600 after:transition-transform data-[state=active]:after:scale-x-100 dark:after:bg-blue-400"
const inventoryTableClass =
  "w-full table-fixed text-[11px] sm:text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-2"
const inventoryStaticTableHeaderClass = "bg-card shadow-[0_1px_0_0_var(--border)]"
const inventoryStaticTableHeadClass = "bg-card"
const inventoryTabCopy: Record<InventoryTab, { title: string; description: string }> = {
  stock: {
    title: "Warehouse stock",
    description: "Review current item balances by warehouse and set the starting stock when a product starts tracking.",
  },
  movements: {
    title: "Item ledger",
    description: "Inspect product-level stock movement history with sortable inward, outward, and value columns.",
  },
  transfers: {
    title: "Stock transfers",
    description: "Move goods between warehouses and track draft, dispatched, received, or cancelled transfers.",
  },
}

const initialStockForm: StockFormState = {
  itemId: "",
  warehouseId: "",
  branchId: "",
  quantity: "1",
  unitCost: "0.00",
  transactionDate: today,
  batchNumber: "",
  serialNumbers: "",
  reason: "",
}

const initialAdjustmentForm: AdjustmentFormState = {
  ...initialStockForm,
  direction: "out",
  adjustmentType: "ADJUSTMENT",
  reason: "Stock correction",
}

const initialTransferForm: TransferFormState = {
  itemId: "",
  sourceWarehouseId: "",
  destinationWarehouseId: "",
  branchId: "",
  quantity: "1",
  unitCost: "0.00",
  transferDate: today,
  referenceNumber: "",
  notes: "",
}

export function InventoryPage() {
  const storedSession = getStoredAuthSession()
  const accessToken = storedSession?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState("")
  const [selectedItemId, setSelectedItemId] = React.useState("")
  const [openingForm, setOpeningForm] = React.useState<StockFormState>(initialStockForm)
  const [adjustmentForm, setAdjustmentForm] =
    React.useState<AdjustmentFormState>(initialAdjustmentForm)
  const [transferForm, setTransferForm] =
    React.useState<TransferFormState>(initialTransferForm)
  const [movementDialog, setMovementDialog] =
    React.useState<"opening" | "adjustment" | null>(null)
  const [isTransferDialogOpen, setTransferDialogOpen] = React.useState(false)
  const [activeInventoryTab, setActiveInventoryTab] =
    React.useState<InventoryTab>("stock")

  const summaryQuery = useQuery({
    queryKey: ["inventory", "summary"],
    queryFn: () => getInventorySummary(accessToken),
    enabled: accessToken.length > 0,
  })
  const settingsQuery = useQuery({
    queryKey: ["inventory", "settings"],
    queryFn: () => getInventorySettings(accessToken),
    enabled: accessToken.length > 0,
  })
  const warehousesQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => getWarehouses(accessToken),
    enabled: accessToken.length > 0,
  })
  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => getBranches(accessToken),
    enabled: accessToken.length > 0,
  })
  const productsQuery = useQuery({
    queryKey: ["products", "inventory-select"],
    queryFn: () =>
      listProducts(accessToken, {
        itemType: "GOODS",
        status: "ACTIVE",
        limit: 100,
    }),
    enabled: accessToken.length > 0,
  })
  const warehouses = React.useMemo(
    () => warehousesQuery.data?.warehouses ?? [],
    [warehousesQuery.data?.warehouses]
  )
  const branches = branchesQuery.data?.branches ?? []
  const defaultBranchId = getDefaultBranchId(branches)
  const products = productsQuery.data?.products ?? []
  const summary = summaryQuery.data?.summary
  const settings = settingsQuery.data?.settings
  const defaultWarehouseId = warehouses[0]?.id ?? ""
  const defaultProductId = products[0]?.id ?? ""
  const activeWarehouseId = selectedWarehouseId || defaultWarehouseId
  const activeItemId = selectedItemId || defaultProductId
  const activeWarehouseName =
    warehouses.find((warehouse) => warehouse.id === activeWarehouseId)?.name ??
    "No warehouse"
  const warehouseDisplayOptions = React.useMemo(
    () => warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name })),
    [warehouses]
  )
  const negativeStockPolicyLabel = settings?.negativeStockPolicy
    ? inventoryPolicyLabels[settings.negativeStockPolicy]
    : "-"
  const activeInventoryTabCopy = inventoryTabCopy[activeInventoryTab]
  const stockQuery = useQuery({
    queryKey: ["inventory", "warehouse-stock", activeWarehouseId],
    queryFn: () => getWarehouseStock(activeWarehouseId, accessToken),
    enabled: accessToken.length > 0 && activeWarehouseId.length > 0,
  })
  const ledgerQuery = useQuery({
    queryKey: ["inventory", "ledger", activeItemId, activeWarehouseId],
    queryFn: () =>
      getItemLedger(activeItemId, accessToken, {
        warehouse: activeWarehouseId || undefined,
    }),
    enabled: accessToken.length > 0 && activeItemId.length > 0,
  })
  const transfersQuery = useInfiniteQuery({
    queryKey: ["inventory", "transfers"],
    queryFn: ({ pageParam }) =>
      listInventoryTransfers(accessToken, {
        page: pageParam,
        limit: inventoryTablePageSize,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: accessToken.length > 0,
  })
  const transfers = React.useMemo(
    () => transfersQuery.data?.pages.flatMap((page) => page.transfers) ?? [],
    [transfersQuery.data?.pages]
  )
  const totalTransfersCount =
    transfersQuery.data?.pages[0]?.pagination.total ?? transfers.length

  const refreshInventory = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
    ])
  }, [queryClient])

  const openingMutation = useMutation({
    mutationFn: (payload: OpeningStockPayload) => postOpeningStock(payload, accessToken),
    onSuccess: async () => {
      setMovementDialog(null)
      toast.success("Starting stock saved")
      await refreshInventory()
    },
    onError: showToastError("Starting stock failed"),
  })

  const adjustmentMutation = useMutation({
    mutationFn: (payload: InventoryAdjustmentPayload) =>
      postInventoryAdjustment(payload, accessToken),
    onSuccess: async () => {
      setMovementDialog(null)
      toast.success("Stock correction saved")
      await refreshInventory()
    },
    onError: showToastError("Adjustment failed"),
  })

  const transferMutation = useMutation({
    mutationFn: (payload: CreateInventoryTransferPayload) =>
      createInventoryTransfer(payload, accessToken),
    onSuccess: async () => {
      setTransferDialogOpen(false)
      setTransferForm(initialTransferForm)
      toast.success("Stock transfer created")
      await refreshInventory()
    },
    onError: showToastError("Transfer creation failed"),
  })

  const transferActionMutation = useMutation({
    mutationFn: (payload: { id: string; action: "dispatch" | "receive" | "cancel" }) => {
      if (payload.action === "dispatch") {
        return dispatchInventoryTransfer(payload.id, accessToken)
      }
      if (payload.action === "receive") {
        return receiveInventoryTransfer(payload.id, accessToken)
      }
      return cancelInventoryTransfer(payload.id, accessToken)
    },
    onSuccess: async () => {
      toast.success("Transfer updated")
      await refreshInventory()
    },
    onError: showToastError("Transfer update failed"),
  })

  function submitOpeningStock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    openingMutation.mutate({
      itemId: openingForm.itemId || defaultProductId,
      warehouseId: openingForm.warehouseId || defaultWarehouseId,
      branchId: openingForm.branchId || defaultBranchId || null,
      quantity: openingForm.quantity,
      sourceUnit: "PCS",
      unitCost: openingForm.unitCost,
      transactionDate: openingForm.transactionDate,
      batchNumber: openingForm.batchNumber || null,
      serialNumbers: splitSerials(openingForm.serialNumbers),
      reason: openingForm.reason || null,
    })
  }

  function submitAdjustment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    adjustmentMutation.mutate({
      itemId: adjustmentForm.itemId || defaultProductId,
      warehouseId: adjustmentForm.warehouseId || defaultWarehouseId,
      branchId: adjustmentForm.branchId || defaultBranchId || null,
      quantity: adjustmentForm.quantity,
      direction: adjustmentForm.direction,
      adjustmentType: adjustmentForm.adjustmentType,
      sourceUnit: "PCS",
      unitCost: adjustmentForm.unitCost || undefined,
      transactionDate: adjustmentForm.transactionDate,
      reason: adjustmentForm.reason,
    })
  }

  function submitTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const sourceWarehouseId = transferForm.sourceWarehouseId || defaultWarehouseId
    const destinationWarehouseId =
      transferForm.destinationWarehouseId ||
      warehouses.find((warehouse) => warehouse.id !== sourceWarehouseId)?.id ||
      ""

    transferMutation.mutate({
      sourceWarehouseId,
      destinationWarehouseId,
      branchId: transferForm.branchId || defaultBranchId || null,
      transferDate: transferForm.transferDate,
      referenceNumber: transferForm.referenceNumber || null,
      notes: transferForm.notes || null,
      lines: [
        {
          itemId: transferForm.itemId || defaultProductId,
          quantity: transferForm.quantity,
          unit: "PCS",
          unitCost: transferForm.unitCost,
        },
      ],
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="p-3.5 sm:p-4 lg:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 bg-background">
                <WarehouseIcon className="size-3.5" />
                Inventory
              </Badge>
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <span className="size-1.5 rounded-full bg-current" />
                Ledger based
              </Badge>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      className="bg-background"
                      aria-label="Refresh inventory"
                      onClick={() => void refreshInventory()}
                    />
                  }
                >
                  <RefreshCcwIcon className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent side="right" align="center">
                  Refresh inventory
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="mt-3 max-w-2xl space-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Stock control
              </h1>
              <p className="max-w-xl text-sm leading-5 text-muted-foreground">
                Track stock by warehouse, post opening balances, correct stock,
                and move items between locations.
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <PackagePlusIcon className="size-3.5" />
                  Start with counted stock
                </span>
                <span className="hidden text-border sm:inline">/</span>
                <span className="inline-flex items-center gap-1.5">
                  <ArrowRightLeftIcon className="size-3.5" />
                  Then transfers or corrections
                </span>
              </div>
            </div>
          </div>
          <div className="border-t border-border bg-muted/10 p-3.5 sm:p-4 lg:border-l lg:border-t-0 lg:p-5">
            <div className="grid grid-cols-2 gap-2">
              <InventoryMetric
                icon={<BoxesIcon className="size-4" />}
                label="SKUs"
                value={summary?.skuCount.toString() ?? "-"}
                loading={summaryQuery.isLoading}
                tone={toNumber(summary?.skuCount.toString() ?? "0") > 0 ? "positive" : "muted"}
              />
              <InventoryMetric
                icon={<WarehouseIcon className="size-4" />}
                label="Warehouse"
                value={activeWarehouseName}
                loading={warehousesQuery.isLoading}
              />
              <InventoryMetric
                icon={<ClipboardListIcon className="size-4" />}
                label="Value"
                value={formatCurrency(summary?.inventoryValue ?? "0", {
                  trimZeroFraction: true,
                })}
                loading={summaryQuery.isLoading}
                tone={valueTone(summary?.inventoryValue ?? "0")}
              />
              <InventoryMetric
                icon={<Settings2Icon className="size-4" />}
                label="Negative stock"
                value={negativeStockPolicyLabel}
                loading={settingsQuery.isLoading}
                tone={negativeStockPolicyTone(settings?.negativeStockPolicy)}
              />
            </div>
          </div>
        </div>
      </section>

      <Tabs
        value={activeInventoryTab}
        defaultValue="stock"
        onValueChange={(value) => setActiveInventoryTab(value as InventoryTab)}
        className="min-w-0"
      >
        <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
          <div className="border-b border-border px-4 py-3 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 space-y-1">
                <h2 className="text-base font-semibold">
                  {activeInventoryTabCopy.title}
                </h2>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  {activeInventoryTabCopy.description}
                </p>
              </div>
              <TabsList className="h-auto flex-wrap justify-start gap-4 rounded-none border-0 bg-transparent p-0 xl:justify-end">
                <TabsTrigger value="stock" className={inventoryTabTriggerClass}>
                  Stock
                </TabsTrigger>
                <TabsTrigger value="movements" className={inventoryTabTriggerClass}>
                  Movements
                </TabsTrigger>
                <TabsTrigger value="transfers" className={inventoryTabTriggerClass}>
                  Transfers
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="stock" className="m-0">
            <div className="flex flex-col gap-2 border-b border-border px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  Warehouse:
                </span>
                <Select
                  value={activeWarehouseId}
                  onValueChange={(value) => setSelectedWarehouseId(value ?? "")}
                >
                  <SelectTrigger className="h-8 w-64 max-w-[calc(100vw-9rem)]">
                    <SelectDisplayValue
                      value={activeWarehouseId}
                      options={warehouseDisplayOptions}
                      placeholder="Choose warehouse"
                    />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                className="h-8 gap-2 bg-blue-600 text-white hover:bg-blue-700 sm:shrink-0"
                onClick={() => setMovementDialog("opening")}
              >
                <PackagePlusIcon className="size-4" />
                Set starting stock
              </Button>
            </div>
            <StockTable
              isLoading={stockQuery.isLoading}
              rows={stockQuery.data?.stock ?? []}
              onSelectLedger={(itemId) => {
                setSelectedItemId(itemId)
                setActiveInventoryTab("movements")
              }}
            />
          </TabsContent>

          <TabsContent value="movements" className="m-0">
            <LedgerPanel
              products={products}
              selectedItemId={activeItemId}
              onItemChange={setSelectedItemId}
              ledger={ledgerQuery.data}
              isLoading={ledgerQuery.isLoading}
              onPostAdjustment={() => setMovementDialog("adjustment")}
            />
          </TabsContent>

          <TabsContent
            value="transfers"
            className="m-0"
          >
            <TransfersPanel
              transfers={transfers}
              warehouses={warehouses}
              isLoading={transfersQuery.isLoading}
              isFetchingNextPage={transfersQuery.isFetchingNextPage}
              hasNextPage={transfersQuery.hasNextPage}
              totalTransfersCount={totalTransfersCount}
              onLoadMore={() => void transfersQuery.fetchNextPage()}
              onCreateTransfer={() => setTransferDialogOpen(true)}
              isActionPending={transferActionMutation.isPending}
              onAction={(id, action) => transferActionMutation.mutate({ id, action })}
            />
          </TabsContent>
        </section>
      </Tabs>

      <Dialog
        open={movementDialog === "opening"}
        onOpenChange={(open) => !open && setMovementDialog(null)}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4 pr-12">
            <DialogTitle>Set starting stock balance</DialogTitle>
            <DialogDescription>
              Enter the first counted quantity and cost before you start tracking
              this product in inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-5">
            <StockMovementForm
              form={openingForm}
              products={products}
              warehouses={warehouses}
              branches={branches}
              isPending={openingMutation.isPending}
              onChange={setOpeningForm}
              onSubmit={submitOpeningStock}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={movementDialog === "adjustment"}
        onOpenChange={(open) => !open && setMovementDialog(null)}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4 pr-12">
            <DialogTitle>Record stock correction</DialogTitle>
            <DialogDescription>
              Correct damaged, expired, missing, or counted stock without changing
              historical movements.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-5">
            <AdjustmentForm
              form={adjustmentForm}
              products={products}
              warehouses={warehouses}
              branches={branches}
              isPending={adjustmentMutation.isPending}
              onChange={setAdjustmentForm}
              onSubmit={submitAdjustment}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isTransferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4 pr-12">
            <DialogTitle>Move stock between warehouses</DialogTitle>
            <DialogDescription>
              Move tracked stock from one warehouse to another without changing
              sales or purchase records.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-5">
            <TransferForm
              form={transferForm}
              products={products}
              warehouses={warehouses}
              branches={branches}
              isPending={transferMutation.isPending}
              onChange={setTransferForm}
              onSubmit={submitTransfer}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InventoryMetric({
  icon,
  label,
  value,
  loading,
  tone = "default",
}: {
  icon: React.ReactNode
  label: string
  value: string
  loading: boolean
  tone?: ValueTone
}) {
  return (
    <div className="min-h-[4.75rem] min-w-0 rounded-xl border border-border bg-background px-3 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      {loading ?
        <Skeleton className="mt-2 h-5 w-20" />
      : <p className={cn("mt-1 truncate text-sm font-semibold", toneTextClass(tone))}>
          {value}
        </p>}
    </div>
  )
}

function StockTable({
  isLoading,
  rows,
  onSelectLedger,
}: {
  isLoading: boolean
  rows: Array<{
    itemId: string
    itemName: string
    sku: string
    quantityOnHand: string
    averageCost: string
    inventoryValue: string
  }>
  onSelectLedger: (itemId: string) => void
}) {
  const [sortKey, setSortKey] = React.useState<WarehouseStockSortKey>("item")
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc")

  const sortedRows = React.useMemo(() => {
    return [...rows].sort((first, second) => {
      const direction = sortDirection === "asc" ? 1 : -1

      if (sortKey === "item") {
        return (
          first.itemName.localeCompare(second.itemName, undefined, {
            sensitivity: "base",
          }) * direction
        )
      }

      return (
        (toNumber(first[sortKey]) - toNumber(second[sortKey])) * direction
      )
    })
  }, [rows, sortDirection, sortKey])

  function toggleSort(nextKey: WarehouseStockSortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setSortKey(nextKey)
    setSortDirection(nextKey === "item" ? "asc" : "desc")
  }

  return (
    <>
      <Table className={inventoryTableClass}>
        <TableHeader className={inventoryStaticTableHeaderClass}>
          <TableRow>
            <SortableStockHead
              label="Item"
              sortKey="item"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              className="w-[42%]"
              onSort={toggleSort}
            />
            <SortableStockHead
              label="On hand"
              sortKey="quantityOnHand"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              className="w-[16%] text-right"
              align="right"
              onSort={toggleSort}
            />
            <SortableStockHead
              label="Avg cost"
              sortKey="averageCost"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              className="w-[17%] text-right"
              align="right"
              onSort={toggleSort}
            />
            <SortableStockHead
              label="Value"
              sortKey="inventoryValue"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              className="w-[17%] text-right"
              align="right"
              onSort={toggleSort}
            />
            <TableHead className={cn(inventoryStaticTableHeadClass, "w-[8%] pr-3 text-right")}>View</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
      <div className="app-scrollbar max-h-[28rem] overflow-y-auto overflow-x-hidden">
      <Table className={inventoryTableClass}>
        <TableBody>
          {isLoading ?
            Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell colSpan={5}>
                  <Skeleton className="h-9 w-full" />
                </TableCell>
              </TableRow>
            ))
          : rows.length === 0 ?
            <TableRow>
              <TableCell colSpan={5} className="h-64 py-8">
                <Empty className="mx-auto min-h-52 max-w-sm border-0 p-6">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <BoxesIcon className="size-4" />
                    </EmptyMedia>
                    <EmptyTitle>No stock in this warehouse</EmptyTitle>
                    <EmptyDescription>
                      Set starting stock, add purchases, or move stock to build item balances.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </TableCell>
            </TableRow>
          : sortedRows.map((row) => (
              <TableRow key={`${row.itemId}-${row.sku}`}>
                <TableCell className="min-w-0 w-[42%]">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate font-medium">{row.itemName}</p>
                    </div>
                    <p className="truncate font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
                      {row.sku}
                    </p>
                  </div>
                </TableCell>
                <TableCell
                  className={cn("w-[16%] text-right font-mono", toneTextClass(valueTone(row.quantityOnHand)))}
                >
                  {row.quantityOnHand}
                </TableCell>
                <TableCell
                  className={cn("w-[17%] text-right font-mono", toneTextClass(valueTone(row.averageCost)))}
                >
                  {formatCurrency(row.averageCost)}
                </TableCell>
                <TableCell
                  className={cn("w-[17%] text-right font-mono", toneTextClass(valueTone(row.inventoryValue)))}
                >
                  {formatCurrency(row.inventoryValue)}
                </TableCell>
                <TableCell className="w-[8%] pr-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="size-7 p-0"
                    aria-label={`View ledger for ${row.itemName}`}
                    onClick={() => onSelectLedger(row.itemId)}
                  >
                    <EyeIcon className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          }
        </TableBody>
      </Table>
      </div>
      {!isLoading && rows.length > 0 ? (
        <div className="flex items-center justify-center border-t px-4 py-3 text-xs text-muted-foreground">
          Showing {sortedRows.length} of {rows.length} stock rows
        </div>
      ) : null}
    </>
  )
}

function SortableStockHead({
  label,
  sortKey,
  activeSortKey,
  sortDirection,
  align = "left",
  className,
  onSort,
}: {
  label: string
  sortKey: WarehouseStockSortKey
  activeSortKey: WarehouseStockSortKey
  sortDirection: SortDirection
  align?: "left" | "right"
  className?: string
  onSort: (sortKey: WarehouseStockSortKey) => void
}) {
  const isActive = sortKey === activeSortKey
  const Icon = isActive
    ? sortDirection === "asc"
      ? ArrowUpIcon
      : ArrowDownIcon
    : ArrowDownUpIcon

  return (
    <TableHead className={cn(inventoryStaticTableHeadClass, className)}>
      <button
        type="button"
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-md transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          align === "right" && "ml-auto justify-end text-right",
          isActive ? "text-primary" : "text-foreground"
        )}
        onClick={() => onSort(sortKey)}
      >
        <span className="truncate">{label}</span>
        <Icon
          className={cn(
            "size-3 shrink-0",
            !isActive && "text-muted-foreground/70"
          )}
        />
      </button>
    </TableHead>
  )
}

function SortableLedgerHead({
  label,
  sortKey,
  activeSortKey,
  sortDirection,
  align = "left",
  className,
  onSort,
}: {
  label: string
  sortKey: InventoryLedgerSortKey
  activeSortKey: InventoryLedgerSortKey
  sortDirection: SortDirection
  align?: "left" | "right"
  className?: string
  onSort: (sortKey: InventoryLedgerSortKey) => void
}) {
  const isActive = sortKey === activeSortKey
  const Icon = isActive
    ? sortDirection === "asc"
      ? ArrowUpIcon
      : ArrowDownIcon
    : ArrowDownUpIcon

  return (
    <TableHead className={cn(inventoryStaticTableHeadClass, className)}>
      <button
        type="button"
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-md transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          align === "right" && "ml-auto justify-end text-right",
          isActive ? "text-primary" : "text-foreground"
        )}
        onClick={() => onSort(sortKey)}
      >
        <span className="truncate">{label}</span>
        <Icon
          className={cn(
            "size-3 shrink-0",
            !isActive && "text-muted-foreground/70"
          )}
        />
      </button>
    </TableHead>
  )
}

function StockMovementForm({
  form,
  products,
  warehouses,
  branches,
  isPending,
  onChange,
  onSubmit,
}: {
  form: StockFormState
  products: ProductListItem[]
  warehouses: WarehouseRecord[]
  branches: BranchOption[]
  isPending: boolean
  onChange: React.Dispatch<React.SetStateAction<StockFormState>>
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const effectiveItemId = form.itemId || products[0]?.id || ""
  const effectiveWarehouseId = form.warehouseId || warehouses[0]?.id || ""

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup className="gap-4">
        <InventorySelects
          form={form}
          products={products}
          warehouses={warehouses}
          branches={branches}
          onChange={onChange}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Quantity" value={form.quantity} onChange={(quantity) => onChange((current) => ({ ...current, quantity }))} />
          <TextField label="Cost per unit" value={form.unitCost} onChange={(unitCost) => onChange((current) => ({ ...current, unitCost }))} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InventoryDatePicker
            label="Counted on"
            value={form.transactionDate}
            onChange={(transactionDate) =>
              onChange((current) => ({ ...current, transactionDate }))
            }
          />
          <TextField label="Batch number" value={form.batchNumber} onChange={(batchNumber) => onChange((current) => ({ ...current, batchNumber }))} />
        </div>
        <SerialNumberField
          value={form.serialNumbers}
          onChange={(serialNumbers) =>
            onChange((current) => ({ ...current, serialNumbers }))
          }
        />
        <TextField label="Reason" value={form.reason} onChange={(reason) => onChange((current) => ({ ...current, reason }))} />
        <Button
          type="submit"
          disabled={isPending || !effectiveItemId || !effectiveWarehouseId}
          className="w-full"
        >
          {isPending ? <Spinner /> : "Save starting stock"}
        </Button>
      </FieldGroup>
    </form>
  )
}

function AdjustmentForm({
  form,
  products,
  warehouses,
  branches,
  isPending,
  onChange,
  onSubmit,
}: {
  form: AdjustmentFormState
  products: ProductListItem[]
  warehouses: WarehouseRecord[]
  branches: BranchOption[]
  isPending: boolean
  onChange: React.Dispatch<React.SetStateAction<AdjustmentFormState>>
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const effectiveItemId = form.itemId || products[0]?.id || ""
  const effectiveWarehouseId = form.warehouseId || warehouses[0]?.id || ""

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <InventorySelects
          form={form}
          products={products}
          warehouses={warehouses}
          branches={branches}
          onChange={onChange}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Direction</FieldLabel>
            <Select value={form.direction} onValueChange={(direction) => onChange((current) => ({ ...current, direction: direction as "in" | "out" }))}>
              <SelectTrigger>
                <SelectDisplayValue
                  value={form.direction}
                  options={adjustmentDirectionOptions}
                  placeholder="Direction"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Stock in</SelectItem>
                <SelectItem value="out">Stock out</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Type</FieldLabel>
            <Select value={form.adjustmentType} onValueChange={(adjustmentType) => onChange((current) => ({ ...current, adjustmentType: adjustmentType as AdjustmentFormState["adjustmentType"] }))}>
              <SelectTrigger>
                <SelectDisplayValue
                  value={form.adjustmentType}
                  options={stockCorrectionTypeOptions}
                  placeholder="Correction type"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADJUSTMENT">Correction</SelectItem>
                <SelectItem value="DAMAGE">Damage</SelectItem>
                <SelectItem value="EXPIRY">Expiry</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Quantity" value={form.quantity} onChange={(quantity) => onChange((current) => ({ ...current, quantity }))} />
          <TextField label="Cost per unit" value={form.unitCost} onChange={(unitCost) => onChange((current) => ({ ...current, unitCost }))} />
        </div>
        <InventoryDatePicker
          label="Transaction date"
          value={form.transactionDate}
          onChange={(transactionDate) =>
            onChange((current) => ({ ...current, transactionDate }))
          }
        />
        <TextField label="Reason" value={form.reason} onChange={(reason) => onChange((current) => ({ ...current, reason }))} />
        <Button
          type="submit"
          disabled={isPending || !effectiveItemId || !effectiveWarehouseId}
          className="w-full"
        >
          {isPending ? <Spinner /> : "Save stock correction"}
        </Button>
      </FieldGroup>
    </form>
  )
}

function SerialNumberField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const serials = React.useMemo(() => splitSerials(value), [value])

  function removeSerial(indexToRemove: number) {
    onChange(serials.filter((_, index) => index !== indexToRemove).join(", "))
  }

  return (
    <Field>
      <FieldLabel>Serial numbers</FieldLabel>
      <Input
        value={value}
        placeholder="Example: 12, 13, 14"
        onChange={(event) => onChange(event.target.value)}
      />
      {serials.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {serials.map((serial, index) => (
            <kbd
              key={`${serial}-${index}`}
              data-slot="kbd"
              className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-muted px-2 font-mono text-[11px] font-medium text-foreground"
            >
              {serial}
              <button
                type="button"
                aria-label={`Remove serial number ${serial}`}
                className="-mr-1 inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                onClick={() => removeSerial(index)}
              >
                <XIcon className="size-3" />
              </button>
            </kbd>
          ))}
        </div>
      ) : null}
      <FieldDescription className="text-xs">
        Separate serial numbers with commas. Remove a chip if a serial was added by mistake.
      </FieldDescription>
    </Field>
  )
}

function InventorySelects<T extends StockFormState>({
  form,
  products,
  warehouses,
  branches,
  onChange,
}: {
  form: T
  products: ProductListItem[]
  warehouses: WarehouseRecord[]
  branches: BranchOption[]
  onChange: React.Dispatch<React.SetStateAction<T>>
}) {
  const productDisplayOptions = React.useMemo(
    () => products.map((product) => ({ value: product.id, label: product.name })),
    [products]
  )
  const productValue = form.itemId || products[0]?.id || ""
  const warehouseDisplayOptions = React.useMemo(
    () => warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name })),
    [warehouses]
  )
  const warehouseValue = form.warehouseId || warehouses[0]?.id || ""
  const branchDisplayOptions = React.useMemo(
    () => [
      { value: "none", label: "No branch" },
      ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
    ],
    [branches]
  )
  const branchValue = form.branchId || getDefaultBranchId(branches) || "none"

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>Product</FieldLabel>
          <Select
            value={productValue}
            onValueChange={(itemId) =>
              onChange((current) => ({ ...current, itemId: itemId ?? "" }))
            }
          >
            <SelectTrigger>
              <SelectDisplayValue
                value={productValue}
                options={productDisplayOptions}
                placeholder="Choose product"
              />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Warehouse</FieldLabel>
          <Select
            value={warehouseValue}
            onValueChange={(warehouseId) =>
              onChange((current) => ({ ...current, warehouseId: warehouseId ?? "" }))
            }
          >
            <SelectTrigger>
              <SelectDisplayValue
                value={warehouseValue}
                options={warehouseDisplayOptions}
                placeholder="Choose warehouse"
              />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field>
        <FieldLabel>Branch</FieldLabel>
        <Select
          value={branchValue}
          onValueChange={(branchId) =>
            onChange((current) => ({
              ...current,
              branchId: !branchId || branchId === "none" ? "" : branchId,
            }))
          }
        >
          <SelectTrigger>
            <SelectDisplayValue
              value={branchValue}
              options={branchDisplayOptions}
              placeholder="Optional branch"
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No branch</SelectItem>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </>
  )
}

function TransferForm({
  form,
  products,
  warehouses,
  branches,
  isPending,
  onChange,
  onSubmit,
}: {
  form: TransferFormState
  products: ProductListItem[]
  warehouses: WarehouseRecord[]
  branches: BranchOption[]
  isPending: boolean
  onChange: React.Dispatch<React.SetStateAction<TransferFormState>>
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const productDisplayOptions = React.useMemo(
    () => products.map((product) => ({ value: product.id, label: product.name })),
    [products]
  )
  const branchDisplayOptions = React.useMemo(
    () => [
      { value: "none", label: "No branch" },
      ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
    ],
    [branches]
  )
  const branchValue = form.branchId || getDefaultBranchId(branches) || "none"
  const productValue = form.itemId || products[0]?.id || ""

  const sourceWarehouseId = form.sourceWarehouseId || warehouses[0]?.id || ""
  const destinationWarehouseId =
    form.destinationWarehouseId ||
    warehouses.find((warehouse) => warehouse.id !== sourceWarehouseId)?.id ||
    ""

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup className="gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>Product</FieldLabel>
            <Select
              value={productValue}
              onValueChange={(itemId) =>
                onChange((current) => ({ ...current, itemId: itemId ?? "" }))
              }
            >
              <SelectTrigger>
                <SelectDisplayValue
                  value={productValue}
                  options={productDisplayOptions}
                  placeholder="Choose product"
                />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Branch</FieldLabel>
            <Select
              value={branchValue}
              onValueChange={(branchId) =>
                onChange((current) => ({
                  ...current,
                  branchId: !branchId || branchId === "none" ? "" : branchId,
                }))
              }
            >
              <SelectTrigger>
                <SelectDisplayValue
                  value={branchValue}
                  options={branchDisplayOptions}
                  placeholder="Optional branch"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No branch</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <WarehouseSelect
            label="From warehouse"
            value={sourceWarehouseId}
            warehouses={warehouses}
            onChange={(nextSourceWarehouseId) =>
              onChange((current) => ({
                ...current,
                sourceWarehouseId: nextSourceWarehouseId,
                destinationWarehouseId:
                  current.destinationWarehouseId === nextSourceWarehouseId
                    ? ""
                    : current.destinationWarehouseId,
              }))
            }
          />
          <WarehouseSelect
            label="To warehouse"
            value={destinationWarehouseId}
            warehouses={warehouses.filter(
              (warehouse) => warehouse.id !== sourceWarehouseId
            )}
            onChange={(nextDestinationWarehouseId) =>
              onChange((current) => ({
                ...current,
                destinationWarehouseId: nextDestinationWarehouseId,
              }))
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Quantity" value={form.quantity} onChange={(quantity) => onChange((current) => ({ ...current, quantity }))} />
          <TextField label="Cost per unit" value={form.unitCost} onChange={(unitCost) => onChange((current) => ({ ...current, unitCost }))} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InventoryDatePicker
            label="Moved on"
            value={form.transferDate}
            onChange={(transferDate) =>
              onChange((current) => ({ ...current, transferDate }))
            }
          />
          <TextField label="Reference" value={form.referenceNumber} onChange={(referenceNumber) => onChange((current) => ({ ...current, referenceNumber }))} />
        </div>
        <Field>
          <FieldLabel>Notes</FieldLabel>
          <Textarea value={form.notes} onChange={(event) => onChange((current) => ({ ...current, notes: event.target.value }))} />
        </Field>
        <Button
          type="submit"
          disabled={
            isPending ||
            !productValue ||
            !sourceWarehouseId ||
            !destinationWarehouseId ||
            sourceWarehouseId === destinationWarehouseId
          }
          className="w-full bg-blue-600 text-white hover:bg-blue-700"
        >
          {isPending ? <Spinner /> : "Move stock"}
        </Button>
      </FieldGroup>
    </form>
  )
}

function WarehouseSelect({
  label,
  value,
  warehouses,
  onChange,
}: {
  label: string
  value: string
  warehouses: WarehouseRecord[]
  onChange: (value: string) => void
}) {
  const warehouseDisplayOptions = React.useMemo(
    () => warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name })),
    [warehouses]
  )

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={(nextValue) => onChange(nextValue ?? "")}>
        <SelectTrigger>
          <SelectDisplayValue
            value={value}
            options={warehouseDisplayOptions}
            placeholder="Warehouse"
          />
        </SelectTrigger>
        <SelectContent>
          {warehouses.map((warehouse) => (
            <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function LedgerPanel({
  products,
  selectedItemId,
  onItemChange,
  ledger,
  isLoading,
  onPostAdjustment,
}: {
  products: ProductListItem[]
  selectedItemId: string
  onItemChange: (value: string) => void
  onPostAdjustment: () => void
  ledger?: {
    transactions: Array<{
      id: string
      movementType: string
      transactionDate: string
      quantityIn: string
      quantityOut: string
      inventoryValue: string
      sourceType: string
      reason: string | null
    }>
    balance: { quantityOnHand: string; inventoryValue: string }
  }
  isLoading: boolean
}) {
  const [sortKey, setSortKey] = React.useState<InventoryLedgerSortKey>("date")
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc")
  const productDisplayOptions = React.useMemo(
    () => products.map((product) => ({ value: product.id, label: product.name })),
    [products]
  )
  const transactions = React.useMemo(
    () => ledger?.transactions ?? [],
    [ledger?.transactions]
  )
  const sortedTransactions = React.useMemo(() => {
    return [...transactions].sort((first, second) => {
      const direction = sortDirection === "asc" ? 1 : -1

      if (sortKey === "date") {
        return (
          first.transactionDate.localeCompare(second.transactionDate) * direction
        )
      }

      if (sortKey === "movement") {
        return (
          movementLabel(first.movementType).localeCompare(
            movementLabel(second.movementType),
            undefined,
            { sensitivity: "base" }
          ) * direction
        )
      }

      const firstValue =
        sortKey === "quantityIn" ? first.quantityIn
        : sortKey === "quantityOut" ? first.quantityOut
        : first.inventoryValue
      const secondValue =
        sortKey === "quantityIn" ? second.quantityIn
        : sortKey === "quantityOut" ? second.quantityOut
        : second.inventoryValue

      return (toNumber(firstValue) - toNumber(secondValue)) * direction
    })
  }, [sortDirection, sortKey, transactions])

  function toggleSort(nextKey: InventoryLedgerSortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setSortKey(nextKey)
    setSortDirection(nextKey === "date" ? "desc" : "asc")
  }

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-border px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
        <div className="flex w-full min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            Product:
          </span>
          <Select
            value={selectedItemId}
            onValueChange={(value) => onItemChange(value ?? "")}
          >
            <SelectTrigger className="h-8 w-72 max-w-[calc(100vw-8rem)]">
              <SelectDisplayValue
                value={selectedItemId}
                options={productDisplayOptions}
                placeholder="Choose product"
              />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex w-fit flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
            <span>On hand:</span>
            <span
              className={cn(
                "font-mono font-medium",
                toneTextClass(valueTone(ledger?.balance.quantityOnHand ?? "0"))
              )}
            >
              {ledger?.balance.quantityOnHand ?? "0.000"}
            </span>
            <span className="text-border">/</span>
            <span>Stock value:</span>
            <span
              className={cn(
                "font-mono font-medium",
                toneTextClass(valueTone(ledger?.balance.inventoryValue ?? "0"))
              )}
            >
              {formatCurrency(ledger?.balance.inventoryValue ?? "0")}
            </span>
          </div>
        </div>
        <Button
          type="button"
          className="h-8 gap-2 bg-blue-600 text-white hover:bg-blue-700 sm:shrink-0"
          onClick={onPostAdjustment}
        >
          <ArrowDownUpIcon className="size-4" />
          Record correction
        </Button>
      </div>
      <Table className={inventoryTableClass}>
          <TableHeader className={inventoryStaticTableHeaderClass}>
            <TableRow>
              <SortableLedgerHead
                label="Date"
                sortKey="date"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                className="w-[16%]"
                onSort={toggleSort}
              />
              <SortableLedgerHead
                label="Movement"
                sortKey="movement"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                className="w-[38%]"
                onSort={toggleSort}
              />
              <SortableLedgerHead
                label="In"
                sortKey="quantityIn"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                className="w-[14%] text-right"
                align="right"
                onSort={toggleSort}
              />
              <SortableLedgerHead
                label="Out"
                sortKey="quantityOut"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                className="w-[14%] text-right"
                align="right"
                onSort={toggleSort}
              />
              <SortableLedgerHead
                label="Value"
                sortKey="value"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                className="w-[18%] pr-3 text-right"
                align="right"
                onSort={toggleSort}
              />
            </TableRow>
          </TableHeader>
      </Table>
      <div className="app-scrollbar max-h-[28rem] overflow-y-auto overflow-x-hidden">
        <Table className={inventoryTableClass}>
          <TableBody>
            {isLoading ?
              <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            : transactions.length === 0 ?
              <TableRow><TableCell colSpan={5} className="h-64 py-8"><EmptyState icon={<ClipboardListIcon className="size-5" />} title="No movements" description="Set starting stock, add purchases, sales, transfers, or corrections to build this product ledger." /></TableCell></TableRow>
            : sortedTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="w-[16%]">{formatDate(transaction.transactionDate)}</TableCell>
                  <TableCell className="min-w-0 w-[38%]">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {movementLabel(transaction.movementType)}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {transaction.sourceType}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="w-[14%] text-right font-mono text-emerald-700 dark:text-emerald-300">{transaction.quantityIn}</TableCell>
                  <TableCell className="w-[14%] text-right font-mono text-red-700 dark:text-red-300">{transaction.quantityOut}</TableCell>
                  <TableCell
                    className={cn(
                      "w-[18%] pr-3 text-right font-mono",
                      movementValueClass(transaction.quantityIn, transaction.quantityOut, transaction.inventoryValue)
                    )}
                  >
                    {formatCurrency(transaction.inventoryValue)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      {!isLoading && transactions.length > 0 ? (
        <div className="flex items-center justify-center border-t px-4 py-3 text-xs text-muted-foreground">
          Showing {sortedTransactions.length} of {transactions.length} movements
        </div>
      ) : null}
    </>
  )
}

function TransfersPanel({
  transfers,
  warehouses,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  totalTransfersCount,
  onLoadMore,
  onCreateTransfer,
  isActionPending,
  onAction,
}: {
  transfers: InventoryTransfer[]
  warehouses: WarehouseRecord[]
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  totalTransfersCount: number
  onLoadMore: () => void
  onCreateTransfer: () => void
  isActionPending: boolean
  onAction: (id: string, action: "dispatch" | "receive" | "cancel") => void
}) {
  const warehouseName = React.useCallback(
    (id: string) => warehouses.find((warehouse) => warehouse.id === id)?.name ?? id,
    [warehouses]
  )
  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!hasNextPage || isFetchingNextPage) {
        return
      }

      const target = event.currentTarget
      const remaining = target.scrollHeight - target.scrollTop - target.clientHeight

      if (remaining < 160) {
        onLoadMore()
      }
    },
    [hasNextPage, isFetchingNextPage, onLoadMore]
  )

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-border px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0 font-medium">Transfer status:</span>
          <span className="truncate">Draft, dispatch, receive or cancel warehouse movements.</span>
        </div>
        <Button
          type="button"
          className="h-8 gap-2 bg-blue-600 text-white hover:bg-blue-700 sm:shrink-0"
          onClick={onCreateTransfer}
        >
          <ArrowRightLeftIcon className="size-4" />
          Move stock
        </Button>
      </div>
      <Table className={inventoryTableClass}>
          <TableHeader className={inventoryStaticTableHeaderClass}>
            <TableRow>
              <TableHead className={cn(inventoryStaticTableHeadClass, "w-[22%]")}>Transfer</TableHead>
              <TableHead className={cn(inventoryStaticTableHeadClass, "w-[38%]")}>Route</TableHead>
              <TableHead className={cn(inventoryStaticTableHeadClass, "w-[12%]")}>Lines</TableHead>
              <TableHead className={cn(inventoryStaticTableHeadClass, "w-[14%]")}>Status</TableHead>
              <TableHead className={cn(inventoryStaticTableHeadClass, "w-[14%] pr-3 text-right")}>Actions</TableHead>
            </TableRow>
          </TableHeader>
      </Table>
      <div className="app-scrollbar max-h-[28rem] overflow-y-auto overflow-x-hidden" onScroll={handleScroll}>
        <Table className={inventoryTableClass}>
          <TableBody>
            {isLoading ?
              <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            : transfers.length === 0 ?
              <TableRow><TableCell colSpan={5} className="h-64 py-8"><EmptyState icon={<ArrowRightLeftIcon className="size-5" />} title="No transfers" description="Create a transfer when stock needs to move from one warehouse to another." /></TableCell></TableRow>
            : transfers.map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell className="w-[22%]">
                    <div>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="truncate font-medium">{transfer.referenceNumber ?? transfer.id.slice(0, 8)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(transfer.transferDate)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="w-[38%] truncate">{warehouseName(transfer.sourceWarehouseId)} to {warehouseName(transfer.destinationWarehouseId)}</TableCell>
                  <TableCell
                    className={cn(
                      "w-[12%] font-mono",
                      toneTextClass(transfer.lines.length > 0 ? "positive" : "muted")
                    )}
                  >
                    {transfer.lines.length}
                  </TableCell>
                  <TableCell className="w-[14%]"><TransferStatusBadge status={transfer.status} /></TableCell>
                  <TableCell className="w-[14%] space-x-1 pr-3 text-right">
                    {transfer.status === "DRAFT" ? (
                      <>
                        <Button size="sm" disabled={isActionPending} onClick={() => onAction(transfer.id, "dispatch")}>Dispatch</Button>
                        <Button size="sm" variant="ghost" disabled={isActionPending} onClick={() => onAction(transfer.id, "cancel")}>Cancel</Button>
                      </>
                    ) : null}
                    {transfer.status === "DISPATCHED" || transfer.status === "IN_TRANSIT" ? (
                      <Button size="sm" disabled={isActionPending} onClick={() => onAction(transfer.id, "receive")}>Receive</Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      {!isLoading && transfers.length > 0 ? (
        <div className="flex items-center justify-center border-t px-4 py-3 text-xs text-muted-foreground">
          {isFetchingNextPage ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-3.5" />
              Loading more transfers
            </span>
          ) : hasNextPage ? (
            <span>Scroll to load more transfers</span>
          ) : (
            <span>
              Showing {transfers.length} of {totalTransfersCount} transfers
            </span>
          )}
        </div>
      ) : null}
    </>
  )
}

function TextField({
  label,
  value,
  type = "text",
  placeholder,
  onChange,
}: {
  label: string
  value: string
  type?: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

function InventoryDatePicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selectedDate = parseDateValue(value)

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          type="button"
          className={cn(
            "flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {value ? formatDate(value) : "Choose date"}
          </span>
          <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            captionLayout="dropdown"
            onSelect={(date) => {
              if (!date) {
                return
              }

              onChange(formatDateForInput(date))
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </Field>
  )
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Empty className="mx-auto min-h-52 max-w-sm border-0 p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function TransferStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "RECEIVED" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
        status === "CANCELLED" &&
          "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
        status === "DISPATCHED" &&
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
      )}
    >
      {status.toLowerCase().replace(/_/g, " ")}
    </Badge>
  )
}

function showToastError(title: string) {
  return (error: unknown) => {
    toast.error(title, {
      description:
        error instanceof Error ? error.message : "Check the input and try again.",
    })
  }
}

function splitSerials(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatCurrency(
  value: string,
  options: { trimZeroFraction?: boolean } = {}
) {
  const parsedValue = Number(value || 0)
  const shouldTrimFraction =
    options.trimZeroFraction && Number.isInteger(parsedValue)

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: shouldTrimFraction ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(parsedValue)
}

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getDefaultBranchId(branches: BranchOption[]) {
  return (
    branches.find((branch) => branch.branchCode?.toUpperCase() === "MAIN") ??
    branches.find((branch) => branch.status?.toLowerCase() === "active") ??
    branches[0]
  )?.id ?? ""
}

function valueTone(value: string): ValueTone {
  const parsed = toNumber(value)

  if (parsed > 0) {
    return "positive"
  }

  if (parsed < 0) {
    return "danger"
  }

  return "muted"
}

function negativeStockPolicyTone(policy?: InventorySettingsPolicy): ValueTone {
  if (policy === "ALLOW") {
    return "positive"
  }

  if (policy === "WARN") {
    return "warning"
  }

  if (policy === "BLOCK") {
    return "danger"
  }

  return "muted"
}

function toneTextClass(tone: ValueTone) {
  if (tone === "positive") {
    return "text-emerald-700 dark:text-emerald-300"
  }

  if (tone === "danger") {
    return "text-red-700 dark:text-red-300"
  }

  if (tone === "warning") {
    return "text-amber-700 dark:text-amber-300"
  }

  if (tone === "muted") {
    return "text-muted-foreground"
  }

  return "text-foreground"
}

function movementValueClass(quantityIn: string, quantityOut: string, value: string) {
  if (toNumber(quantityIn) > 0) {
    return toneTextClass("positive")
  }

  if (toNumber(quantityOut) > 0) {
    return toneTextClass("danger")
  }

  return toneTextClass(valueTone(value))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function parseDateValue(value: string) {
  if (!value) {
    return undefined
  }

  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) {
    return undefined
  }

  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function formatDateForInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function movementLabel(value: string) {
  return value.toLowerCase().replace(/_/g, " ")
}
