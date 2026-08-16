"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowDownUpIcon,
  ArrowRightLeftIcon,
  BoxesIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  PackagePlusIcon,
  RefreshCcwIcon,
  Settings2Icon,
  WarehouseIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { toast } from "@/components/ui/toast"
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  cancelInventoryTransfer,
  createInventoryTransfer,
  dispatchInventoryTransfer,
  getInventorySettings,
  getInventorySummary,
  getItemLedger,
  getLowStock,
  getWarehouseStock,
  listInventoryTransfers,
  postInventoryAdjustment,
  postOpeningStock,
  receiveInventoryTransfer,
  updateInventorySettings,
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

const today = new Date().toISOString().slice(0, 10)

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
  const lowStockQuery = useQuery({
    queryKey: ["inventory", "low-stock"],
    queryFn: () => getLowStock(accessToken),
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
  const warehouses = warehousesQuery.data?.warehouses ?? []
  const branches = branchesQuery.data?.branches ?? []
  const products = productsQuery.data?.products ?? []
  const summary = summaryQuery.data?.summary
  const settings = settingsQuery.data?.settings
  const defaultWarehouseId = warehouses[0]?.id ?? ""
  const defaultProductId = products[0]?.id ?? ""
  const activeWarehouseId = selectedWarehouseId || defaultWarehouseId
  const activeItemId = selectedItemId || defaultProductId
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
  const transfersQuery = useQuery({
    queryKey: ["inventory", "transfers"],
    queryFn: () => listInventoryTransfers(accessToken),
    enabled: accessToken.length > 0,
  })

  const refreshInventory = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
    ])
  }, [queryClient])

  const openingMutation = useMutation({
    mutationFn: (payload: OpeningStockPayload) => postOpeningStock(payload, accessToken),
    onSuccess: async () => {
      toast.success("Opening stock posted")
      await refreshInventory()
    },
    onError: showToastError("Opening stock failed"),
  })

  const adjustmentMutation = useMutation({
    mutationFn: (payload: InventoryAdjustmentPayload) =>
      postInventoryAdjustment(payload, accessToken),
    onSuccess: async () => {
      toast.success("Stock adjustment posted")
      await refreshInventory()
    },
    onError: showToastError("Adjustment failed"),
  })

  const transferMutation = useMutation({
    mutationFn: (payload: CreateInventoryTransferPayload) =>
      createInventoryTransfer(payload, accessToken),
    onSuccess: async () => {
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

  const settingsMutation = useMutation({
    mutationFn: (payload: {
      negativeStockPolicy?: InventorySettingsPolicy
      valuationMethod?: "WEIGHTED_AVERAGE" | "FIFO"
    }) => updateInventorySettings(payload, accessToken),
    onSuccess: async () => {
      toast.success("Inventory settings saved")
      await queryClient.invalidateQueries({ queryKey: ["inventory", "settings"] })
    },
    onError: showToastError("Settings save failed"),
  })

  function submitOpeningStock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    openingMutation.mutate({
      itemId: openingForm.itemId || defaultProductId,
      warehouseId: openingForm.warehouseId || defaultWarehouseId,
      branchId: openingForm.branchId || null,
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
      branchId: adjustmentForm.branchId || null,
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
      branchId: transferForm.branchId || null,
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
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <section className="rounded-2xl border bg-card p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <Badge variant="outline" className="w-fit gap-1.5">
              <WarehouseIcon className="size-3.5" />
              Inventory Engine
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Warehouse-level stock ledger for sales, purchases, transfers and corrections.
            </h1>
            <p className="text-sm text-muted-foreground">
              Inventory transactions are the source of truth. Balances are projections
              rebuilt from the ledger when needed.
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => void refreshInventory()}>
            <RefreshCcwIcon className="size-4" />
            Refresh
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <InventoryMetric
          icon={<BoxesIcon className="size-4" />}
          label="Tracked SKUs"
          value={summary?.skuCount.toString() ?? "-"}
          loading={summaryQuery.isLoading}
        />
        <InventoryMetric
          icon={<WarehouseIcon className="size-4" />}
          label="Quantity on hand"
          value={summary?.quantityOnHand ?? "-"}
          loading={summaryQuery.isLoading}
        />
        <InventoryMetric
          icon={<ClipboardListIcon className="size-4" />}
          label="Stock value"
          value={formatCurrency(summary?.inventoryValue ?? "0")}
          loading={summaryQuery.isLoading}
        />
        <InventoryMetric
          icon={<Settings2Icon className="size-4" />}
          label="Negative stock"
          value={settings?.negativeStockPolicy ?? "-"}
          loading={settingsQuery.isLoading}
        />
      </div>

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start rounded-xl border bg-card p-1">
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <section className="rounded-2xl border bg-card">
              <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-medium">Warehouse stock</h2>
                  <p className="text-sm text-muted-foreground">
                    Current projected balance by item.
                  </p>
                </div>
                <Select
                  value={activeWarehouseId}
                  onValueChange={(value) => setSelectedWarehouseId(value ?? "")}
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Choose warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <StockTable
                isLoading={stockQuery.isLoading}
                rows={stockQuery.data?.stock ?? []}
                onSelectLedger={(itemId) => setSelectedItemId(itemId)}
              />
            </section>

            <section className="rounded-2xl border bg-card">
              <div className="border-b p-4">
                <h2 className="font-medium">Low-stock watch</h2>
                <p className="text-sm text-muted-foreground">
                  Products below reorder level or out of stock.
                </p>
              </div>
              <div className="max-h-[360px] overflow-y-auto p-4">
                {lowStockQuery.isLoading ?
                  <div className="space-y-3">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                : (lowStockQuery.data?.items ?? []).length === 0 ?
                  <EmptyState
                    icon={<CheckCircle2Icon className="size-8" />}
                    title="No low-stock items"
                    description="Tracked products are currently above reorder levels."
                  />
                : <div className="space-y-3">
                    {(lowStockQuery.data?.items ?? []).map((item) => (
                      <div key={item.itemId} className="rounded-xl border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground">
                              {item.sku}
                            </p>
                          </div>
                          <LowStockBadge status={item.status} />
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          On hand {item.quantityOnHand} · reorder {item.reorderLevel}
                        </p>
                      </div>
                    ))}
                  </div>
                }
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="movements" className="grid gap-4 xl:grid-cols-[420px_420px_1fr]">
          <StockMovementForm
            title="Opening stock"
            icon={<PackagePlusIcon className="size-4" />}
            form={openingForm}
            products={products}
            warehouses={warehouses}
            branches={branches}
            isPending={openingMutation.isPending}
            onChange={setOpeningForm}
            onSubmit={submitOpeningStock}
          />
          <AdjustmentForm
            form={adjustmentForm}
            products={products}
            warehouses={warehouses}
            branches={branches}
            isPending={adjustmentMutation.isPending}
            onChange={setAdjustmentForm}
            onSubmit={submitAdjustment}
          />
          <LedgerPanel
            products={products}
            selectedItemId={activeItemId}
            onItemChange={setSelectedItemId}
            ledger={ledgerQuery.data}
            isLoading={ledgerQuery.isLoading}
          />
        </TabsContent>

        <TabsContent value="transfers" className="grid gap-4 xl:grid-cols-[430px_1fr]">
          <TransferForm
            form={transferForm}
            products={products}
            warehouses={warehouses}
            branches={branches}
            isPending={transferMutation.isPending}
            onChange={setTransferForm}
            onSubmit={submitTransfer}
          />
          <TransfersPanel
            transfers={transfersQuery.data?.transfers ?? []}
            warehouses={warehouses}
            isLoading={transfersQuery.isLoading}
            isActionPending={transferActionMutation.isPending}
            onAction={(id, action) => transferActionMutation.mutate({ id, action })}
          />
        </TabsContent>

        <TabsContent value="settings">
          <section className="max-w-3xl rounded-2xl border bg-card p-4">
            <div className="mb-4">
              <h2 className="font-medium">Inventory policy</h2>
              <p className="text-sm text-muted-foreground">
                Keep FIFO available in configuration; weighted average is the active
                valuation path implemented for posting.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Negative stock policy</FieldLabel>
                <Select
                  value={settings?.negativeStockPolicy ?? "WARN"}
                  onValueChange={(value) =>
                    settingsMutation.mutate({
                      negativeStockPolicy: value as InventorySettingsPolicy,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BLOCK">Block transactions</SelectItem>
                    <SelectItem value="WARN">Warn and allow</SelectItem>
                    <SelectItem value="ALLOW">Allow silently</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Valuation method</FieldLabel>
                <Select
                  value={settings?.valuationMethod ?? "WEIGHTED_AVERAGE"}
                  onValueChange={(value) =>
                    settingsMutation.mutate({
                      valuationMethod: value as "WEIGHTED_AVERAGE" | "FIFO",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEIGHTED_AVERAGE">Weighted average</SelectItem>
                    <SelectItem value="FIFO">FIFO foundation</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}

type InventorySettingsPolicy = "ALLOW" | "WARN" | "BLOCK"

function InventoryMetric({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode
  label: string
  value: string
  loading: boolean
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      {loading ?
        <Skeleton className="mt-3 h-8 w-24" />
      : <p className="mt-3 text-2xl font-semibold">{value}</p>}
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
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">On hand</TableHead>
            <TableHead className="text-right">Avg cost</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
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
              <TableCell colSpan={5} className="py-12">
                <EmptyState
                  icon={<BoxesIcon className="size-8" />}
                  title="No stock in this warehouse"
                  description="Post opening stock, purchases, or transfers to build balances."
                />
              </TableCell>
            </TableRow>
          : rows.map((row) => (
              <TableRow key={`${row.itemId}-${row.sku}`}>
                <TableCell>
                  <div>
                    <p className="font-medium">{row.itemName}</p>
                    <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground">
                      {row.sku}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">{row.quantityOnHand}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(row.averageCost)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(row.inventoryValue)}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => onSelectLedger(row.itemId)}>
                    Ledger
                  </Button>
                </TableCell>
              </TableRow>
            ))
          }
        </TableBody>
      </Table>
    </div>
  )
}

function StockMovementForm({
  title,
  icon,
  form,
  products,
  warehouses,
  branches,
  isPending,
  onChange,
  onSubmit,
}: {
  title: string
  icon: React.ReactNode
  form: StockFormState
  products: ProductListItem[]
  warehouses: WarehouseRecord[]
  branches: Array<{ id: string; name: string }>
  isPending: boolean
  onChange: React.Dispatch<React.SetStateAction<StockFormState>>
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="font-medium">{title}</h2>
      </div>
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
            <TextField label="Quantity" value={form.quantity} onChange={(quantity) => onChange((current) => ({ ...current, quantity }))} />
            <TextField label="Unit cost" value={form.unitCost} onChange={(unitCost) => onChange((current) => ({ ...current, unitCost }))} />
          </div>
          <TextField label="Transaction date" type="date" value={form.transactionDate} onChange={(transactionDate) => onChange((current) => ({ ...current, transactionDate }))} />
          <TextField label="Batch number" value={form.batchNumber} onChange={(batchNumber) => onChange((current) => ({ ...current, batchNumber }))} />
          <TextField label="Serial numbers" value={form.serialNumbers} placeholder="Comma separated" onChange={(serialNumbers) => onChange((current) => ({ ...current, serialNumbers }))} />
          <TextField label="Reason" value={form.reason} onChange={(reason) => onChange((current) => ({ ...current, reason }))} />
          <Button type="submit" disabled={isPending || !form.itemId || !form.warehouseId} className="w-full">
            {isPending ? <Spinner /> : "Post opening stock"}
          </Button>
        </FieldGroup>
      </form>
    </section>
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
  branches: Array<{ id: string; name: string }>
  isPending: boolean
  onChange: React.Dispatch<React.SetStateAction<AdjustmentFormState>>
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <ArrowDownUpIcon className="size-4" />
        <h2 className="font-medium">Stock adjustment</h2>
      </div>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Stock in</SelectItem>
                  <SelectItem value="out">Stock out</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Type</FieldLabel>
              <Select value={form.adjustmentType} onValueChange={(adjustmentType) => onChange((current) => ({ ...current, adjustmentType: adjustmentType as AdjustmentFormState["adjustmentType"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
            <TextField label="Unit cost" value={form.unitCost} onChange={(unitCost) => onChange((current) => ({ ...current, unitCost }))} />
          </div>
          <TextField label="Transaction date" type="date" value={form.transactionDate} onChange={(transactionDate) => onChange((current) => ({ ...current, transactionDate }))} />
          <TextField label="Reason" value={form.reason} onChange={(reason) => onChange((current) => ({ ...current, reason }))} />
          <Button type="submit" disabled={isPending || !form.itemId || !form.warehouseId} className="w-full">
            {isPending ? <Spinner /> : "Post adjustment"}
          </Button>
        </FieldGroup>
      </form>
    </section>
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
  branches: Array<{ id: string; name: string }>
  onChange: React.Dispatch<React.SetStateAction<T>>
}) {
  return (
    <>
      <Field>
        <FieldLabel>Product</FieldLabel>
        <Select
          value={form.itemId || products[0]?.id || ""}
          onValueChange={(itemId) =>
            onChange((current) => ({ ...current, itemId: itemId ?? "" }))
          }
        >
          <SelectTrigger><SelectValue placeholder="Choose product" /></SelectTrigger>
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
          value={form.warehouseId || warehouses[0]?.id || ""}
          onValueChange={(warehouseId) =>
            onChange((current) => ({ ...current, warehouseId: warehouseId ?? "" }))
          }
        >
          <SelectTrigger><SelectValue placeholder="Choose warehouse" /></SelectTrigger>
          <SelectContent>
            {warehouses.map((warehouse) => (
              <SelectItem key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Branch</FieldLabel>
        <Select value={form.branchId || "none"} onValueChange={(branchId) => onChange((current) => ({ ...current, branchId: branchId === "none" ? "" : branchId }))}>
          <SelectTrigger><SelectValue placeholder="Optional branch" /></SelectTrigger>
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
  branches: Array<{ id: string; name: string }>
  isPending: boolean
  onChange: React.Dispatch<React.SetStateAction<TransferFormState>>
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <ArrowRightLeftIcon className="size-4" />
        <h2 className="font-medium">Create transfer</h2>
      </div>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel>Product</FieldLabel>
            <Select
              value={form.itemId || products[0]?.id || ""}
              onValueChange={(itemId) =>
                onChange((current) => ({ ...current, itemId: itemId ?? "" }))
              }
            >
              <SelectTrigger><SelectValue placeholder="Choose product" /></SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <WarehouseSelect
              label="From"
              value={form.sourceWarehouseId || warehouses[0]?.id || ""}
              warehouses={warehouses}
              onChange={(sourceWarehouseId) =>
                onChange((current) => ({ ...current, sourceWarehouseId }))
              }
            />
            <WarehouseSelect
              label="To"
              value={
                form.destinationWarehouseId ||
                warehouses.find(
                  (warehouse) =>
                    warehouse.id !== (form.sourceWarehouseId || warehouses[0]?.id)
                )?.id ||
                ""
              }
              warehouses={warehouses.filter(
                (warehouse) => warehouse.id !== (form.sourceWarehouseId || warehouses[0]?.id)
              )}
              onChange={(destinationWarehouseId) =>
                onChange((current) => ({ ...current, destinationWarehouseId }))
              }
            />
          </div>
          <Field>
            <FieldLabel>Branch</FieldLabel>
            <Select
              value={form.branchId || "none"}
              onValueChange={(branchId) =>
                onChange((current) => ({
                  ...current,
                  branchId: !branchId || branchId === "none" ? "" : branchId,
                }))
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No branch</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Quantity" value={form.quantity} onChange={(quantity) => onChange((current) => ({ ...current, quantity }))} />
            <TextField label="Unit cost" value={form.unitCost} onChange={(unitCost) => onChange((current) => ({ ...current, unitCost }))} />
          </div>
          <TextField label="Transfer date" type="date" value={form.transferDate} onChange={(transferDate) => onChange((current) => ({ ...current, transferDate }))} />
          <TextField label="Reference" value={form.referenceNumber} onChange={(referenceNumber) => onChange((current) => ({ ...current, referenceNumber }))} />
          <Field>
            <FieldLabel>Notes</FieldLabel>
            <Textarea value={form.notes} onChange={(event) => onChange((current) => ({ ...current, notes: event.target.value }))} />
          </Field>
          <Button type="submit" disabled={isPending || !form.itemId || !form.sourceWarehouseId || !form.destinationWarehouseId} className="w-full">
            {isPending ? <Spinner /> : "Create transfer"}
          </Button>
        </FieldGroup>
      </form>
    </section>
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
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={(nextValue) => onChange(nextValue ?? "")}>
        <SelectTrigger><SelectValue placeholder="Warehouse" /></SelectTrigger>
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
}: {
  products: ProductListItem[]
  selectedItemId: string
  onItemChange: (value: string) => void
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
  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-medium">Item ledger</h2>
          <p className="text-sm text-muted-foreground">
            Source-of-truth movements for selected item.
          </p>
        </div>
        <Select
          value={selectedItemId}
          onValueChange={(value) => onItemChange(value ?? "")}
        >
          <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="border-b px-4 py-3 text-sm text-muted-foreground">
        Balance {ledger?.balance.quantityOnHand ?? "0.000"} · {formatCurrency(ledger?.balance.inventoryValue ?? "0")}
      </div>
      <div className="max-h-[430px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Movement</TableHead>
              <TableHead className="text-right">In</TableHead>
              <TableHead className="text-right">Out</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ?
              <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            : (ledger?.transactions ?? []).length === 0 ?
              <TableRow><TableCell colSpan={5} className="py-10"><EmptyState icon={<ClipboardListIcon className="size-8" />} title="No movements" description="Post stock or transactions to build this ledger." /></TableCell></TableRow>
            : ledger?.transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{formatDate(transaction.transactionDate)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{movementLabel(transaction.movementType)}</p>
                      <p className="text-xs text-muted-foreground">{transaction.sourceType}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{transaction.quantityIn}</TableCell>
                  <TableCell className="text-right font-mono">{transaction.quantityOut}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(transaction.inventoryValue)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function TransfersPanel({
  transfers,
  warehouses,
  isLoading,
  isActionPending,
  onAction,
}: {
  transfers: InventoryTransfer[]
  warehouses: WarehouseRecord[]
  isLoading: boolean
  isActionPending: boolean
  onAction: (id: string, action: "dispatch" | "receive" | "cancel") => void
}) {
  const warehouseName = React.useCallback(
    (id: string) => warehouses.find((warehouse) => warehouse.id === id)?.name ?? id,
    [warehouses]
  )

  return (
    <section className="rounded-2xl border bg-card">
      <div className="border-b p-4">
        <h2 className="font-medium">Stock transfers</h2>
        <p className="text-sm text-muted-foreground">
          Draft, dispatch, receive or cancel internal warehouse transfers.
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transfer</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ?
              <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            : transfers.length === 0 ?
              <TableRow><TableCell colSpan={5} className="py-10"><EmptyState icon={<ArrowRightLeftIcon className="size-8" />} title="No transfers" description="Create a transfer to move stock between warehouses." /></TableCell></TableRow>
            : transfers.map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{transfer.referenceNumber ?? transfer.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(transfer.transferDate)}</p>
                    </div>
                  </TableCell>
                  <TableCell>{warehouseName(transfer.sourceWarehouseId)} to {warehouseName(transfer.destinationWarehouseId)}</TableCell>
                  <TableCell>{transfer.lines.length}</TableCell>
                  <TableCell><TransferStatusBadge status={transfer.status} /></TableCell>
                  <TableCell className="space-x-2 text-right">
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
    </section>
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
    <div className="flex flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      {icon}
      <p className="font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-sm">{description}</p>
    </div>
  )
}

function LowStockBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "OUT_OF_STOCK" &&
          "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
        status === "LOW_STOCK" &&
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
      )}
    >
      {status === "OUT_OF_STOCK" ? "Out" : "Low"}
    </Badge>
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

function formatCurrency(value: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function movementLabel(value: string) {
  return value.toLowerCase().replace(/_/g, " ")
}
