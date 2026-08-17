"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BanknoteIcon,
  BarcodeIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { toast } from "@/components/ui/toast"
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  checkoutPosSale,
  listPosSales,
  type PosCheckoutLinePayload,
  type PosPaymentPayload,
} from "@/lib/pos/api"
import { listProducts } from "@/lib/products/api"
import type { PaymentMode } from "@/lib/sales/api"

type CartLine = PosCheckoutLinePayload & {
  key: string
}

type QuickItemState = {
  itemName: string
  hsnSacCode: string
  quantity: string
  rate: string
  gstRate: string
}

const today = new Date().toISOString().slice(0, 10)

export function PosPage() {
  const queryClient = useQueryClient()
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const [productSearch, setProductSearch] = React.useState("")
  const [receiptSearch, setReceiptSearch] = React.useState("")
  const [placeOfSupplyStateCode, setPlaceOfSupplyStateCode] = React.useState("33")
  const [customerName, setCustomerName] = React.useState("")
  const [cart, setCart] = React.useState<CartLine[]>([])
  const [paymentMode, setPaymentMode] = React.useState<PaymentMode>("upi")
  const [paymentAmount, setPaymentAmount] = React.useState("")
  const [quickItem, setQuickItem] = React.useState<QuickItemState>({
    itemName: "",
    hsnSacCode: "210690",
    quantity: "1",
    rate: "",
    gstRate: "18",
  })

  const productsQuery = useQuery({
    queryKey: ["pos", "products", productSearch],
    queryFn: () =>
      listProducts(accessToken, {
        search: productSearch,
        status: "ACTIVE",
        limit: 8,
      }),
    enabled: accessToken.length > 0 && productSearch.trim().length >= 2,
  })
  const salesQuery = useQuery({
    queryKey: ["pos", "sales", receiptSearch],
    queryFn: () =>
      listPosSales(accessToken, {
        search: receiptSearch,
        page: 1,
        limit: 15,
      }),
    enabled: accessToken.length > 0,
  })
  const checkoutMutation = useMutation({
    mutationFn: (payments: PosPaymentPayload[]) =>
      checkoutPosSale(accessToken, {
        customerName: customerName || null,
        receiptDate: today,
        placeOfSupplyStateCode,
        lines: cart,
        payments,
      }),
    onSuccess: async ({ sale }) => {
      toast.success(`Receipt ${sale.receiptNumber} posted.`)
      setCart([])
      setPaymentAmount("")
      setCustomerName("")
      await queryClient.invalidateQueries({ queryKey: ["pos"] })
      await queryClient.invalidateQueries({ queryKey: ["accounting"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to checkout."),
  })

  const totals = estimateTotals(cart, placeOfSupplyStateCode === "33")
  const products = productsQuery.data?.products ?? []
  const recentSales = salesQuery.data?.sales ?? []

  function addQuickItem() {
    if (!quickItem.itemName.trim() || !quickItem.rate.trim()) {
      toast.error("Enter quick item name and rate.")
      return
    }

    setCart((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        itemName: quickItem.itemName.trim(),
        hsnSacCode: quickItem.hsnSacCode || null,
        quantity: quickItem.quantity || "1",
        unit: "PCS",
        rate: quickItem.rate,
        gstRate: quickItem.gstRate || "0",
      },
    ])
    setQuickItem((current) => ({ ...current, itemName: "", rate: "" }))
  }

  function checkout() {
    if (cart.length === 0) {
      toast.error("Add at least one item to checkout.")
      return
    }

    const amount = paymentAmount || totals.total.toFixed(2)

    checkoutMutation.mutate([
      {
        paymentMode,
        amount,
      },
    ])
  }

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6">
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="gap-1.5">
              <ReceiptIcon className="size-3.5" />
              Counter billing
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">POS Checkout</h1>
              <p className="text-sm text-muted-foreground">
                Fast counter sales with immediate accounting journal posting.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Customer name optional"
            />
            <Input
              value={placeOfSupplyStateCode}
              onChange={(event) =>
                setPlaceOfSupplyStateCode(event.target.value.replace(/\D/g, "").slice(0, 2))
              }
              maxLength={2}
              placeholder="State code"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-5">
          <div className="rounded-2xl border bg-card p-4">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Search product by name or SKU"
                className="pl-8"
              />
            </div>
            {productSearch.trim().length >= 2 ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {productsQuery.isFetching ? (
                  <Skeleton className="h-20 rounded-xl" />
                ) : products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No matching products.</p>
                ) : (
                  products.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="rounded-xl border p-3 text-left transition-colors hover:bg-muted/40"
                      onClick={() =>
                        setCart((current) => [
                          ...current,
                          {
                            key: crypto.randomUUID(),
                            itemId: product.id,
                            itemName: product.name,
                            hsnSacCode: product.activeTaxProfile?.hsnSac ?? null,
                            quantity: "1",
                            unit: product.unitProfile?.baseUnit ?? "PCS",
                            rate: product.activePrice?.price ?? "0",
                            gstRate: product.activeTaxProfile?.gstRate ?? "0",
                          },
                        ])
                      }
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.sku}</p>
                        </div>
                        <span className="font-mono text-sm">
                          {formatCurrency(product.activePrice?.price ?? "0")}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <BarcodeIcon className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Quick item</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-[1.2fr_0.7fr_0.5fr_0.7fr_0.5fr_auto]">
              <Input
                value={quickItem.itemName}
                onChange={(event) =>
                  setQuickItem((current) => ({ ...current, itemName: event.target.value }))
                }
                placeholder="Item name"
              />
              <Input
                value={quickItem.hsnSacCode}
                onChange={(event) =>
                  setQuickItem((current) => ({ ...current, hsnSacCode: event.target.value }))
                }
                placeholder="HSN"
              />
              <Input
                value={quickItem.quantity}
                onChange={(event) =>
                  setQuickItem((current) => ({ ...current, quantity: event.target.value }))
                }
                placeholder="Qty"
              />
              <Input
                value={quickItem.rate}
                onChange={(event) =>
                  setQuickItem((current) => ({ ...current, rate: event.target.value }))
                }
                placeholder="Rate"
              />
              <Input
                value={quickItem.gstRate}
                onChange={(event) =>
                  setQuickItem((current) => ({ ...current, gstRate: event.target.value }))
                }
                placeholder="GST"
              />
              <Button type="button" onClick={addQuickItem}>
                <PlusIcon />
                Add
              </Button>
            </div>
          </div>

          <CartTable cart={cart} setCart={setCart} />
        </section>

        <aside className="h-fit space-y-4">
          <section className="rounded-2xl border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <BanknoteIcon className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Checkout</h2>
            </div>
            <div className="space-y-3 text-sm">
              <SummaryRow label="Taxable" value={formatCurrency(totals.taxable)} />
              <SummaryRow label="GST" value={formatCurrency(totals.total - totals.taxable)} />
              <div className="border-t pt-3">
                <SummaryRow label="Total" value={formatCurrency(totals.total)} strong />
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <Select
                value={paymentMode}
                onValueChange={(value) => setPaymentMode(value as PaymentMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                placeholder={totals.total.toFixed(2)}
              />
              <Button
                disabled={checkoutMutation.isPending || cart.length === 0}
                onClick={checkout}
              >
                {checkoutMutation.isPending ? <Spinner /> : <ReceiptIcon />}
                Complete checkout
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Recent receipts</h2>
              <Input
                value={receiptSearch}
                onChange={(event) => setReceiptSearch(event.target.value)}
                placeholder="Search"
                className="h-7 w-28"
              />
            </div>
            <div className="space-y-2">
              {recentSales.slice(0, 5).map((sale) => (
                <div key={sale.id} className="rounded-xl border bg-background p-3">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs">{sale.receiptNumber}</p>
                      <p className="text-sm text-muted-foreground">{sale.customerName}</p>
                    </div>
                    <p className="font-mono text-sm">{formatCurrency(sale.totalAmount)}</p>
                  </div>
                </div>
              ))}
              {salesQuery.isLoading ? <Skeleton className="h-12 rounded-xl" /> : null}
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}

function CartTable({
  cart,
  setCart,
}: {
  cart: CartLine[]
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>
}) {
  return (
    <section className="rounded-2xl border bg-card">
      <div className="border-b p-4">
        <h2 className="text-sm font-semibold">Cart</h2>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">GST</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cart.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                  Add products or a quick item to start billing.
                </TableCell>
              </TableRow>
            ) : (
              cart.map((line) => {
                const taxable = Number(line.quantity) * Number(line.rate)
                const total = taxable + taxable * (Number(line.gstRate) / 100)

                return (
                  <TableRow key={line.key}>
                    <TableCell className="font-medium">{line.itemName}</TableCell>
                    <TableCell className="text-right font-mono">
                      {line.quantity} {line.unit}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(line.rate)}
                    </TableCell>
                    <TableCell className="text-right font-mono">{line.gstRate}%</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(total)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setCart((current) =>
                            current.filter((cartLine) => cartLine.key !== line.key)
                          )
                        }
                      >
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-mono font-semibold" : "font-mono"}>{value}</span>
    </div>
  )
}

function estimateTotals(lines: CartLine[], isIntraState: boolean) {
  void isIntraState
  return lines.reduce(
    (total, line) => {
      const taxable = Number(line.quantity || 0) * Number(line.rate || 0)
      const tax = taxable * (Number(line.gstRate || 0) / 100)
      return {
        taxable: total.taxable + taxable,
        total: total.total + taxable + tax,
      }
    },
    { taxable: 0, total: 0 }
  )
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value))
}
