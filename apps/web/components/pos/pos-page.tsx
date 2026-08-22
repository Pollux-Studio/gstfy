"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BanknoteIcon,
  BoxesIcon,
  CircleDollarSignIcon,
  IndianRupeeIcon,
  MinusIcon,
  PackageSearchIcon,
  PlusIcon,
  ReceiptTextIcon,
  SearchIcon,
  ShoppingCartIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
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
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { getStoredAuthSession } from "@/lib/auth/session"
import { getWarehouses } from "@/lib/organization/api"
import { listParties } from "@/lib/parties/api"
import {
  checkoutPosSale,
  listPosSales,
  type PosCheckoutLinePayload,
  type PosPaymentPayload,
  type PosSale,
} from "@/lib/pos/api"
import { listProducts, type ProductListItem } from "@/lib/products/api"
import type { PaymentMode } from "@/lib/sales/api"
import { getSettings } from "@/lib/settings/api"
import { cn } from "@/lib/utils"

type CartLine = PosCheckoutLinePayload & {
  key: string
  imageUrl: string | null
  sku: string | null
  taxMode: "EXCLUSIVE" | "INCLUSIVE"
}

const today = new Date().toISOString().slice(0, 10)
const paymentModeOptions: Array<{ value: PaymentMode; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank" },
  { value: "cheque", label: "Cheque" },
]

export function PosPage() {
  const queryClient = useQueryClient()
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const [partySearch, setPartySearch] = React.useState("")
  const [productSearch, setProductSearch] = React.useState("")
  const [receiptSearch, setReceiptSearch] = React.useState("")
  const [selectedPartyId, setSelectedPartyId] = React.useState("")
  const [customerName, setCustomerName] = React.useState("")
  const [placeOfSupplyStateCode, setPlaceOfSupplyStateCode] = React.useState("")
  const [warehouseId, setWarehouseId] = React.useState("")
  const [cart, setCart] = React.useState<CartLine[]>([])
  const [paymentMode, setPaymentMode] = React.useState<PaymentMode>("upi")
  const [paymentAmount, setPaymentAmount] = React.useState("")
  const [notes, setNotes] = React.useState("")

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(accessToken),
    enabled: accessToken.length > 0,
  })
  const sellerStateCode = settingsQuery.data?.registration.stateCode ?? "33"
  const resolvedPlaceOfSupply = placeOfSupplyStateCode || sellerStateCode
  const partiesQuery = useQuery({
    queryKey: ["pos", "customer-search", partySearch],
    queryFn: () =>
      listParties(accessToken, {
        search: partySearch,
        role: "customer",
        status: "active",
        page: 1,
        limit: 10,
      }),
    enabled: accessToken.length > 0,
  })
  const productsQuery = useQuery({
    queryKey: ["pos", "products", productSearch],
    queryFn: () =>
      listProducts(accessToken, {
        search: productSearch,
        status: "ACTIVE",
        page: 1,
        limit: 30,
      }),
    enabled: accessToken.length > 0,
  })
  const warehousesQuery = useQuery({
    queryKey: ["organization", "warehouses"],
    queryFn: () => getWarehouses(accessToken),
    enabled: accessToken.length > 0,
  })
  const salesQuery = useQuery({
    queryKey: ["pos", "sales", receiptSearch],
    queryFn: () =>
      listPosSales(accessToken, {
        search: receiptSearch,
        page: 1,
        limit: 8,
      }),
    enabled: accessToken.length > 0,
  })

  const activeWarehouses =
    warehousesQuery.data?.warehouses.filter((warehouse) => warehouse.status === "active") ?? []
  const warehouseOptions = activeWarehouses.map((warehouse) => ({
    value: warehouse.id,
    label: warehouse.name,
  }))
  const selectedWarehouseId = warehouseId || warehouseOptions[0]?.value || ""
  const partyOptions = React.useMemo<ComboboxOption[]>(
    () =>
      partiesQuery.data?.parties.map((party) => ({
        value: party.id,
        searchValue: [
          party.displayName,
          party.legalName,
          party.tradeName,
          party.primaryGstRegistration?.gstin,
          party.primaryContact?.mobile,
        ]
          .filter(Boolean)
          .join(" "),
        label: (
          <div className="min-w-0">
            <p className="truncate font-medium">{party.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {party.primaryGstRegistration?.gstin ?? party.primaryContact?.mobile ?? "Customer"}
            </p>
          </div>
        ),
      })) ?? [],
    [partiesQuery.data?.parties]
  )
  const products = productsQuery.data?.products ?? []
  const recentSales = salesQuery.data?.sales ?? []
  const totals = estimateTotals(cart, sellerStateCode === resolvedPlaceOfSupply)
  const paidAmount = Number(paymentAmount || totals.total)
  const balanceDue = Math.max(totals.total - paidAmount, 0)

  const checkoutMutation = useMutation({
    mutationFn: (payments: PosPaymentPayload[]) =>
      checkoutPosSale(accessToken, {
        partyId: selectedPartyId || null,
        customerName: customerName.trim() || null,
        receiptDate: today,
        warehouseId: selectedWarehouseId || null,
        placeOfSupplyStateCode: resolvedPlaceOfSupply,
        notes: notes.trim() || null,
        lines: cart.map((line) => ({
          itemId: line.itemId,
          itemName: line.itemName,
          hsnSacCode: line.hsnSacCode,
          quantity: line.quantity,
          unit: line.unit,
          rate: line.rate,
          gstRate: line.gstRate,
        })),
        payments,
      }),
    onSuccess: async ({ sale }) => {
      toast.success(`POS bill ${sale.receiptNumber} posted.`)
      setCart([])
      setPaymentAmount("")
      setSelectedPartyId("")
      setCustomerName("")
      setPartySearch("")
      setNotes("")
      await queryClient.invalidateQueries({ queryKey: ["pos"] })
      await queryClient.invalidateQueries({ queryKey: ["sales"] })
      await queryClient.invalidateQueries({ queryKey: ["accounting"] })
      await queryClient.invalidateQueries({ queryKey: ["inventory"] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function selectParty(partyId: string) {
    const party = partiesQuery.data?.parties.find((entry) => entry.id === partyId)

    setSelectedPartyId(partyId)
    setCustomerName(party?.displayName ?? "")
    setPlaceOfSupplyStateCode(party?.primaryGstRegistration?.stateCode ?? sellerStateCode)
  }

  function addProduct(product: ProductListItem) {
    const activePrice = product.activePrice
    const activeTaxProfile = product.activeTaxProfile

    setCart((current) => {
      const existingLine = current.find((line) => line.itemId === product.id)

      if (existingLine) {
        return current.map((line) =>
          line.key === existingLine.key ?
            { ...line, quantity: String(Number(line.quantity || 0) + 1) }
          : line
        )
      }

      return [
        ...current,
        {
          key: crypto.randomUUID(),
          itemId: product.id,
          itemName: product.name,
          hsnSacCode: activeTaxProfile?.hsnSac ?? null,
          quantity: "1",
          unit: product.unitProfile?.baseUnit ?? "PCS",
          rate: activePrice?.price ?? "0",
          gstRate: activeTaxProfile?.gstRate ?? "0",
          imageUrl: product.primaryImage?.publicUrl ?? null,
          sku: product.sku,
          taxMode: activePrice?.taxMode ?? "EXCLUSIVE",
        },
      ]
    })
  }

  function updateCartLine(lineKey: string, changes: Partial<CartLine>) {
    setCart((current) =>
      current.map((line) => (line.key === lineKey ? { ...line, ...changes } : line))
    )
  }

  function checkout() {
    if (cart.length === 0) {
      toast.error("Add at least one product to bill.")
      return
    }

    if (!selectedWarehouseId) {
      toast.error("Choose a warehouse before checkout.")
      return
    }

    checkoutMutation.mutate([
      {
        paymentMode,
        amount: String(paymentAmount || totals.total.toFixed(2)),
      },
    ])
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-1 flex-col gap-3 p-3 sm:p-4 lg:p-5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        render={<Link href="/sales" />}
      >
        <ArrowLeftIcon className="size-3.5" />
        Back to sales
      </Button>

      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
        <div className="grid gap-0 lg:grid-cols-[minmax(25rem,0.95fr)_minmax(0,1.4fr)]">
          <section className="flex min-h-[calc(100vh-8.5rem)] min-w-0 flex-col border-border lg:border-r">
            <div className="border-b border-border bg-muted/10 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="gap-1.5 bg-background">
                      <ReceiptTextIcon className="size-3.5" />
                      POS billing
                    </Badge>
                    <Badge
                      variant="outline"
                      className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      Counter ready
                    </Badge>
                  </div>
                  <h1 className="mt-2 text-xl font-semibold tracking-tight">New counter bill</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pick customer, add products, collect payment and post instantly.
                  </p>
                </div>
                <div className="rounded-2xl border bg-background px-4 py-3 text-right">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Payable
                  </p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-blue-700 dark:text-blue-300">
                    {formatCurrency(totals.total)}
                  </p>
                </div>
              </div>
            </div>

            <div className="app-scrollbar flex-1 space-y-3 overflow-auto p-3 sm:p-4">
              <section className="rounded-2xl border bg-background p-3">
                <div className="mb-3 flex items-center gap-2">
                  <UserRoundIcon className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Customer</h2>
                </div>
                <div className="grid gap-3">
                  <Combobox
                    value={selectedPartyId}
                    options={partyOptions}
                    searchValue={partySearch}
                    loading={partiesQuery.isFetching}
                    placeholder="Search saved customer"
                    searchPlaceholder="Name, phone or GSTIN"
                    emptyMessage="No customer found. Type a walk-in name below."
                    onSearchValueChange={setPartySearch}
                    onValueChange={selectParty}
                    contentClassName="w-[22rem]"
                  />
                  <Input
                    value={customerName}
                    onChange={(event) => {
                      setCustomerName(event.target.value)
                      if (selectedPartyId) {
                        setSelectedPartyId("")
                      }
                    }}
                    placeholder="Walk-in customer name"
                    className="h-8"
                  />
                </div>
              </section>

              <section className="rounded-2xl border bg-background p-3">
                <div className="mb-3 flex items-center gap-2">
                  <BoxesIcon className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Billing setup</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Warehouse</FieldLabel>
                    <Select
                      value={selectedWarehouseId || undefined}
                      onValueChange={(value) => {
                        if (value) {
                          setWarehouseId(value)
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-full bg-background">
                        <SelectDisplayValue
                          value={selectedWarehouseId}
                          options={warehouseOptions}
                          placeholder="Choose warehouse"
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouseOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Place of supply</FieldLabel>
                    <Input
                      value={resolvedPlaceOfSupply}
                      onChange={(event) =>
                        setPlaceOfSupplyStateCode(
                          event.target.value.replace(/\D/g, "").slice(0, 2)
                        )
                      }
                      placeholder="State code"
                      className="h-8 font-mono"
                    />
                  </Field>
                </div>
              </section>

              <CartTable
                cart={cart}
                totals={totals}
                onChange={updateCartLine}
                onRemove={(lineKey) =>
                  setCart((current) => current.filter((line) => line.key !== lineKey))
                }
              />

              <section className="rounded-2xl border bg-background p-3">
                <div className="mb-3 flex items-center gap-2">
                  <BanknoteIcon className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Payment</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <Field>
                    <FieldLabel>Mode</FieldLabel>
                    <Select
                      value={paymentMode}
                      onValueChange={(value) => {
                        if (value) {
                          setPaymentMode(value as PaymentMode)
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-full bg-background">
                        <SelectDisplayValue
                          value={paymentMode}
                          options={paymentModeOptions}
                          placeholder="Mode"
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentModeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Amount received</FieldLabel>
                    <AmountInput
                      value={paymentAmount}
                      placeholder={formatPlainAmount(totals.total)}
                      onChange={setPaymentAmount}
                    />
                  </Field>
                </div>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional bill note"
                  className="mt-3 min-h-16"
                />
              </section>
            </div>

            <div className="border-t border-border bg-card px-4 py-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <CheckoutStat label="Items" value={String(cart.length)} />
                  <CheckoutStat label="GST" value={formatCurrency(totals.tax)} tone="blue" />
                  <CheckoutStat
                    label="Balance"
                    value={formatCurrency(balanceDue)}
                    tone={balanceDue > 0 ? "warning" : "positive"}
                  />
                </div>
                <Button
                  type="button"
                  className="h-10 gap-2 bg-blue-600 text-white hover:bg-blue-700"
                  disabled={checkoutMutation.isPending || cart.length === 0}
                  onClick={checkout}
                >
                  {checkoutMutation.isPending ? (
                    <Spinner className="size-4" />
                  ) : (
                    <CircleDollarSignIcon className="size-4" />
                  )}
                  Complete bill
                </Button>
              </div>
            </div>
          </section>

          <section className="flex min-h-[calc(100vh-8.5rem)] min-w-0 flex-col bg-muted/10">
            <div className="border-b border-border bg-card px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">Product grid</h2>
                  <p className="text-sm text-muted-foreground">
                    Search by product, SKU, barcode or HSN and tap to add.
                  </p>
                </div>
                <div className="relative w-full lg:max-w-sm">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Search products, SKU, barcode"
                    className="h-8 bg-background pl-8"
                  />
                </div>
              </div>
            </div>

            <div className="app-scrollbar flex-1 overflow-auto p-3 sm:p-4">
              {productsQuery.isLoading ? (
                <ProductGridSkeleton />
              ) : products.length === 0 ? (
                <div className="flex h-full min-h-80 items-center justify-center rounded-2xl border bg-card">
                  <Empty className="border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <PackageSearchIcon className="size-4" />
                      </EmptyMedia>
                      <EmptyTitle>No products found</EmptyTitle>
                      <EmptyDescription>
                        Add products in Product Master or change the search term.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {products.map((product) => (
                    <ProductTile key={product.id} product={product} onAdd={addProduct} />
                  ))}
                </div>
              )}
            </div>

            <RecentReceipts
              receipts={recentSales}
              search={receiptSearch}
              loading={salesQuery.isLoading}
              onSearchChange={setReceiptSearch}
            />
          </section>
        </div>
      </section>
    </main>
  )
}

function ProductTile({
  product,
  onAdd,
}: {
  product: ProductListItem
  onAdd: (product: ProductListItem) => void
}) {
  const price = product.activePrice?.price ?? "0"
  const gstRate = product.activeTaxProfile?.gstRate ?? "0"

  return (
    <button
      type="button"
      className="group flex min-h-44 flex-col overflow-hidden rounded-2xl border bg-card text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:hover:border-blue-900 dark:hover:bg-blue-950/20"
      onClick={() => onAdd(product)}
    >
      <div className="relative h-24 bg-muted">
        {product.primaryImage?.publicUrl ? (
          <Image
            src={product.primaryImage.publicUrl}
            alt={product.name}
            fill
            sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 22vw, (min-width: 640px) 40vw, 90vw"
            className="object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <PackageSearchIcon className="size-8" />
          </div>
        )}
        <Badge className="absolute right-2 top-2 border-border bg-background text-foreground">
          GST {formatPercent(gstRate)}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
          {product.sku} · HSN {product.activeTaxProfile?.hsnSac ?? "-"}
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div>
            <p className="text-[11px] text-muted-foreground">
              {product.activePrice?.taxMode === "INCLUSIVE" ? "Tax inclusive" : "Tax exclusive"}
            </p>
            <p className="font-mono text-base font-semibold text-blue-700 dark:text-blue-300">
              {formatCurrency(price)}
            </p>
          </div>
          <span className="flex size-8 items-center justify-center rounded-full bg-blue-600 text-white transition-transform group-hover:scale-105">
            <PlusIcon className="size-4" />
          </span>
        </div>
      </div>
    </button>
  )
}

function CartTable({
  cart,
  totals,
  onChange,
  onRemove,
}: {
  cart: CartLine[]
  totals: ReturnType<typeof estimateTotals>
  onChange: (lineKey: string, changes: Partial<CartLine>) => void
  onRemove: (lineKey: string) => void
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-background">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <ShoppingCartIcon className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Bill items</h2>
        </div>
        <Badge variant="outline" className="bg-background">
          {cart.length} lines
        </Badge>
      </div>
      <div className="app-scrollbar max-h-72 overflow-auto">
        <Table className="w-full table-fixed text-xs [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:px-2">
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
            <TableRow>
              <TableHead className="w-[34%]">Item</TableHead>
              <TableHead className="w-[17%] text-right">Qty</TableHead>
              <TableHead className="w-[17%] text-right">Rate</TableHead>
              <TableHead className="w-[13%] text-right">GST</TableHead>
              <TableHead className="w-[15%] text-right">Total</TableHead>
              <TableHead className="w-[4%] pr-3 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cart.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40">
                  <Empty className="border-0 py-4">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <ShoppingCartIcon className="size-4" />
                      </EmptyMedia>
                      <EmptyTitle>No items in bill</EmptyTitle>
                      <EmptyDescription>
                        Tap products from the grid to build this sale.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              cart.map((line) => {
                const lineTotal = estimateLine(line).total

                return (
                  <TableRow key={line.key}>
                    <TableCell>
                      <p className="truncate font-medium">{line.itemName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {line.sku ?? "Manual"} · {line.unit ?? "PCS"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <QuantityStepper
                        value={line.quantity}
                        onChange={(value) => onChange(line.key, { quantity: value })}
                      />
                    </TableCell>
                    <TableCell>
                      <AmountInput
                        value={line.rate}
                        onChange={(value) => onChange(line.key, { rate: value })}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatPercent(line.gstRate)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(lineTotal)}
                    </TableCell>
                    <TableCell className="pr-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onRemove(line.key)}
                      >
                        <Trash2Icon className="size-3.5" />
                        <span className="sr-only">Remove item</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t px-3 py-2 text-xs">
        <SummaryChip label="Taxable" value={formatCurrency(totals.taxable)} />
        <SummaryChip label="GST" value={formatCurrency(totals.tax)} tone="blue" />
        <SummaryChip label="Total" value={formatCurrency(totals.total)} tone="positive" />
      </div>
    </section>
  )
}

function QuantityStepper({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const numericValue = Number(value || 0)

  return (
    <div className="ml-auto flex h-8 max-w-28 items-center justify-end rounded-lg border bg-background">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="rounded-r-none"
        onClick={() => onChange(String(Math.max(numericValue - 1, 1)))}
      >
        <MinusIcon className="size-3" />
      </Button>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 border-0 px-1 text-center font-mono shadow-none focus-visible:ring-0"
        inputMode="decimal"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="rounded-l-none"
        onClick={() => onChange(String(numericValue + 1 || 1))}
      >
        <PlusIcon className="size-3" />
      </Button>
    </div>
  )
}

function AmountInput({
  value,
  placeholder,
  onChange,
}: {
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative">
      <IndianRupeeIcon className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "0.00"}
        inputMode="decimal"
        className="h-8 pl-6 text-right font-mono"
      />
    </div>
  )
}

function RecentReceipts({
  receipts,
  search,
  loading,
  onSearchChange,
}: {
  receipts: PosSale[]
  search: string
  loading: boolean
  onSearchChange: (value: string) => void
}) {
  return (
    <div className="border-t border-border bg-card px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Recent POS bills</h3>
          <p className="text-xs text-muted-foreground">Latest counter receipts for quick check.</p>
        </div>
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search receipt"
          className="h-8 bg-background sm:w-44"
        />
      </div>
      <div className="app-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-48 shrink-0 rounded-2xl" />
          ))
        ) : receipts.length === 0 ? (
          <div className="rounded-2xl border bg-background px-4 py-3 text-sm text-muted-foreground">
            No recent POS bills.
          </div>
        ) : (
          receipts.map((receipt) => (
            <div key={receipt.id} className="w-52 shrink-0 rounded-2xl border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs">{receipt.receiptNumber}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {receipt.customerName || "Walk-in customer"}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[10px] text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  Posted
                </Badge>
              </div>
              <p className="mt-2 font-mono text-sm font-semibold">
                {formatCurrency(receipt.totalAmount)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function CheckoutStat({
  label,
  value,
  tone = "muted",
}: {
  label: string
  value: string
  tone?: "muted" | "blue" | "positive" | "warning"
}) {
  return (
    <div className="rounded-xl border bg-background p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate font-mono font-semibold",
          tone === "blue" && "text-blue-700 dark:text-blue-300",
          tone === "positive" && "text-emerald-700 dark:text-emerald-300",
          tone === "warning" && "text-amber-700 dark:text-amber-300"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function SummaryChip({
  label,
  value,
  tone = "muted",
}: {
  label: string
  value: string
  tone?: "muted" | "blue" | "positive"
}) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/30 p-2">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-right font-mono font-semibold",
          tone === "blue" && "text-blue-700 dark:text-blue-300",
          tone === "positive" && "text-emerald-700 dark:text-emerald-300"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function ProductGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-44 rounded-2xl" />
      ))}
    </div>
  )
}

function estimateTotals(lines: CartLine[], isIntraState: boolean) {
  return lines.reduce(
    (total, line) => {
      const estimated = estimateLine(line)

      return {
        taxable: total.taxable + estimated.taxable,
        cgst: total.cgst + (isIntraState ? estimated.tax / 2 : 0),
        sgst: total.sgst + (isIntraState ? estimated.tax / 2 : 0),
        igst: total.igst + (isIntraState ? 0 : estimated.tax),
        tax: total.tax + estimated.tax,
        total: total.total + estimated.total,
      }
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, total: 0 }
  )
}

function estimateLine(line: CartLine) {
  const quantity = Number(line.quantity || 0)
  const rate = Number(line.rate || 0)
  const gstRate = Number(line.gstRate || 0)
  const gross = Math.max(quantity * rate, 0)
  const taxable =
    line.taxMode === "INCLUSIVE" && gstRate > 0 ? gross / (1 + gstRate / 100) : gross
  const tax = line.taxMode === "INCLUSIVE" ? gross - taxable : taxable * (gstRate / 100)
  const total = line.taxMode === "INCLUSIVE" ? gross : taxable + tax

  return { taxable, tax, total }
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatPlainAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: string | number) {
  return `${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}%`
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}
