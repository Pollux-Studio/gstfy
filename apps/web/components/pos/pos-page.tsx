"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BoxesIcon,
  CalculatorIcon,
  CircleDollarSignIcon,
  Clock3Icon,
  IndianRupeeIcon,
  InfoIcon,
  Maximize2Icon,
  Minimize2Icon,
  MinusIcon,
  PackageSearchIcon,
  PlusIcon,
  ReceiptTextIcon,
  SearchIcon,
  ShoppingCartIcon,
  StoreIcon,
  Trash2Icon,
  UserRoundIcon,
  XCircleIcon,
} from "lucide-react"

import { ForcePasswordChangeDialog } from "@/components/account/force-password-change-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { getCurrentUser, type CurrentUserResponse } from "@/lib/auth/api"
import {
  canAccessBusinessPath,
  canManageWorkspace,
  getActiveBusinessMembership,
} from "@/lib/auth/permissions"
import {
  AUTH_SESSION_CHANGE_EVENT,
  clearStoredAuthSession,
  getAuthRefreshDelayMs,
  getStoredAuthSession,
  refreshStoredAuthSession,
  type StoredAuthSession,
} from "@/lib/auth/session"
import { getBranches, getWarehouses, type BusinessBranchRecord } from "@/lib/organization/api"
import { listParties } from "@/lib/parties/api"
import { listProducts, type ProductListItem, type Taxability } from "@/lib/products/api"
import {
  createSalesInvoice,
  listSalesInvoices,
  type CreateSalesInvoicePayload,
  type PaymentMode,
  type SalesInvoice,
  type SalesInvoiceLinePayload,
} from "@/lib/sales/api"
import { getSettings } from "@/lib/settings/api"
import { getUsers } from "@/lib/users/api"
import { cn } from "@/lib/utils"

type CartLine = SalesInvoiceLinePayload & {
  key: string
  imageUrl: string | null
  sku: string | null
  taxMode: "EXCLUSIVE" | "INCLUSIVE"
  taxability: Taxability
  cessRuleId: string | null
}

type RegisterState = "open" | "closed"
type PosBillStatus = "posted" | "draft" | "quotation"

const today = new Date().toISOString().slice(0, 10)
const paymentModeOptions: Array<{ value: PaymentMode; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank" },
  { value: "cheque", label: "Cheque" },
]
const billStatusOptions: Array<{ value: PosBillStatus; label: string }> = [
  { value: "posted", label: "Final sale" },
  { value: "draft", label: "Draft" },
  { value: "quotation", label: "Quotation" },
]

export function PosPage() {
  const router = useRouter()
  const [storedSession, setStoredSession] = React.useState<StoredAuthSession | null>(null)
  const [hasCheckedSession, setHasCheckedSession] = React.useState(false)

  React.useEffect(() => {
    function syncStoredSession() {
      setStoredSession(getStoredAuthSession())
      setHasCheckedSession(true)
    }

    const timeoutId = window.setTimeout(syncStoredSession, 0)
    window.addEventListener(AUTH_SESSION_CHANGE_EVENT, syncStoredSession)
    window.addEventListener("storage", syncStoredSession)

    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener(AUTH_SESSION_CHANGE_EVENT, syncStoredSession)
      window.removeEventListener("storage", syncStoredSession)
    }
  }, [])

  React.useEffect(() => {
    if (!hasCheckedSession || storedSession) {
      return
    }

    let disposed = false

    async function bootstrapSession() {
      const refreshedSession = await refreshStoredAuthSession()

      if (disposed) {
        return
      }

      if (refreshedSession?.accountType === "business") {
        setStoredSession(refreshedSession)
        return
      }

      clearStoredAuthSession()
      router.replace(`/auth/login?next=${encodeURIComponent("/pos")}`)
    }

    void bootstrapSession()

    return () => {
      disposed = true
    }
  }, [hasCheckedSession, router, storedSession])

  React.useEffect(() => {
    if (!storedSession) {
      return
    }

    if (storedSession.accountType !== "business") {
      clearStoredAuthSession()
      router.replace(`/auth/login?next=${encodeURIComponent("/pos")}`)
    }
  }, [router, storedSession])

  React.useEffect(() => {
    if (!storedSession) {
      return
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let disposed = false

    async function refreshAndScheduleNext() {
      const refreshedSession = await refreshStoredAuthSession()

      if (disposed) {
        return
      }

      if (!refreshedSession) {
        clearStoredAuthSession()
        router.replace(`/auth/login?next=${encodeURIComponent("/pos")}`)
        return
      }

      setStoredSession(refreshedSession)
      scheduleRefresh()
    }

    function scheduleRefresh() {
      const delayMs = getAuthRefreshDelayMs(getStoredAuthSession()?.session)

      if (delayMs === null) {
        return
      }

      timeoutId = setTimeout(
        () => {
          void refreshAndScheduleNext()
        },
        Math.max(delayMs, 1000)
      )
    }

    scheduleRefresh()

    return () => {
      disposed = true

      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [router, storedSession])

  if (!hasCheckedSession || !storedSession || storedSession.accountType !== "business") {
    return <PosLoadingScreen />
  }

  return (
    <ProtectedPosPage
      session={storedSession}
      onSessionChange={setStoredSession}
    />
  )
}

function ProtectedPosPage({
  session,
  onSessionChange,
}: {
  session: StoredAuthSession
  onSessionChange: (session: StoredAuthSession) => void
}) {
  const router = useRouter()
  const accessToken = session.session.accessToken
  const currentUserQuery = useQuery({
    queryKey: ["auth", "current-user", session.accountType, session.user.id],
    queryFn: () => getCurrentUser(accessToken),
    enabled: accessToken.length > 0,
    refetchOnMount: "always",
    staleTime: 1000 * 60 * 5,
  })
  const canAccessPos =
    currentUserQuery.data ?
      canAccessBusinessPath("/pos", currentUserQuery.data, session.tenant?.id)
    : false

  React.useEffect(() => {
    if (!currentUserQuery.data || canAccessPos) {
      return
    }

    router.replace("/sales")
  }, [canAccessPos, currentUserQuery.data, router])

  if (currentUserQuery.isLoading || !currentUserQuery.data || !canAccessPos) {
    return <PosLoadingScreen />
  }

  return (
    <>
      <PosCounterPage session={session} currentUser={currentUserQuery.data} />
      {session.user.mustChangePassword ? (
        <ForcePasswordChangeDialog
          session={session}
          onComplete={onSessionChange}
        />
      ) : null}
    </>
  )
}

function PosCounterPage({
  session,
  currentUser,
}: {
  session: StoredAuthSession
  currentUser: CurrentUserResponse
}) {
  const queryClient = useQueryClient()
  const accessToken = session.session.accessToken
  const activeMembership = getActiveBusinessMembership(currentUser, session.tenant?.id)
  const canSwitchAllBranches = canManageWorkspace(activeMembership)
  const [partySearch, setPartySearch] = React.useState("")
  const [productSearch, setProductSearch] = React.useState("")
  const [receiptSearch, setReceiptSearch] = React.useState("")
  const [selectedPartyId, setSelectedPartyId] = React.useState("")
  const [customerName, setCustomerName] = React.useState("")
  const [placeOfSupplyStateCode, setPlaceOfSupplyStateCode] = React.useState("")
  const [branchId, setBranchId] = React.useState("")
  const [warehouseId, setWarehouseId] = React.useState("")
  const [cart, setCart] = React.useState<CartLine[]>([])
  const [billStatus, setBillStatus] = React.useState<PosBillStatus>("posted")
  const [paymentMode, setPaymentMode] = React.useState<PaymentMode>("upi")
  const [paymentAmount, setPaymentAmount] = React.useState("")
  const [hasEditedPaymentAmount, setHasEditedPaymentAmount] = React.useState(false)
  const [notes, setNotes] = React.useState("")
  const [registerState, setRegisterState] = React.useState<RegisterState>("open")
  const [registerOpenedAt, setRegisterOpenedAt] = React.useState(() => new Date())
  const [calculatorOpen, setCalculatorOpen] = React.useState(false)
  const [registerDetailsOpen, setRegisterDetailsOpen] = React.useState(false)
  const [closeRegisterOpen, setCloseRegisterOpen] = React.useState(false)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const clock = useClock()

  React.useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(accessToken),
    enabled: accessToken.length > 0,
  })
  const usersQuery = useQuery({
    queryKey: ["users", "pos-branch-scope", session.user.id],
    queryFn: () => getUsers(accessToken, { page: 1, limit: 200 }),
    enabled: accessToken.length > 0,
  })
  const branchesQuery = useQuery({
    queryKey: ["organization", "branches"],
    queryFn: () => getBranches(accessToken),
    enabled: accessToken.length > 0,
  })
  const warehousesQuery = useQuery({
    queryKey: ["organization", "warehouses"],
    queryFn: () => getWarehouses(accessToken),
    enabled: accessToken.length > 0,
  })
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
  const salesQuery = useQuery({
    queryKey: ["sales", "pos-counter", receiptSearch],
    queryFn: () =>
      listSalesInvoices(accessToken, {
        search: receiptSearch,
        page: 1,
        limit: 8,
      }),
    enabled: accessToken.length > 0,
  })

  const sellerStateCode = settingsQuery.data?.registration.stateCode ?? "33"
  const resolvedPlaceOfSupply = placeOfSupplyStateCode || sellerStateCode
  const userRecord = usersQuery.data?.users.find(
    (user) => user.authUserId === session.user.id
  )
  const branchRecords = branchesQuery.data?.branches ?? []
  const fallbackBranches =
    usersQuery.data?.branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      branchCode: branch.code,
      status: branch.status,
      warehouses: [],
    })) ?? []
  const allBranches = branchRecords.length > 0 ? branchRecords : fallbackBranches
  const accessibleBranches =
    canSwitchAllBranches ? allBranches
    : userRecord ?
      allBranches.filter((branch) => userRecord.branchIds.includes(branch.id))
    : []
  const selectedBranchId =
    branchId ||
    userRecord?.primaryBranchId ||
    accessibleBranches[0]?.id ||
    ""
  const selectedBranch = allBranches.find((branch) => branch.id === selectedBranchId) ?? null
  const allWarehouses =
    warehousesQuery.data?.warehouses.filter((warehouse) => warehouse.status === "active") ?? []
  const branchWarehouseIds =
    "warehouses" in (selectedBranch ?? {}) ?
      selectedBranch?.warehouses?.map((warehouse) => warehouse.warehouseId) ?? []
    : []
  const branchWarehouses =
    branchWarehouseIds.length > 0 ?
      allWarehouses.filter((warehouse) => branchWarehouseIds.includes(warehouse.id))
    : allWarehouses
  const defaultBranchWarehouseId =
    "warehouses" in (selectedBranch ?? {}) ?
      selectedBranch?.warehouses?.find((warehouse) => warehouse.isDefault)?.warehouseId ?? ""
    : ""
  const selectedWarehouseId =
    warehouseId ||
    defaultBranchWarehouseId ||
    branchWarehouses[0]?.id ||
    ""
  const branchOptions = accessibleBranches.map((branch) => ({
    value: branch.id,
    label: `${branch.name}${branch.branchCode ? ` (${branch.branchCode})` : ""}`,
  }))
  const warehouseOptions = branchWarehouses.map((warehouse) => ({
    value: warehouse.id,
    label: warehouse.name,
  }))
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
  const recentSales = salesQuery.data?.invoices ?? []
  const selectedParty = partiesQuery.data?.parties.find((party) => party.id === selectedPartyId)
  const supplyType = selectedParty?.primaryGstRegistration ? "b2b" : "b2c"
  const totals = estimateTotals(cart, sellerStateCode === resolvedPlaceOfSupply)
  const paymentAmountValue =
    hasEditedPaymentAmount ? paymentAmount : totals.total > 0 ? totals.total.toFixed(2) : ""

  const checkoutMutation = useMutation({
    mutationFn: (payload: CreateSalesInvoicePayload) =>
      createSalesInvoice(accessToken, payload),
    onSuccess: async ({ invoice }) => {
      toast.success(
        invoice.status === "posted" ?
          `Sales bill ${invoice.invoiceNumber} posted.`
        : invoice.status === "quotation" ?
          `Quotation ${invoice.invoiceNumber} saved.`
        : `Draft ${invoice.invoiceNumber} saved.`
      )
      setCart([])
      setPaymentAmount("")
      setHasEditedPaymentAmount(false)
      setSelectedPartyId("")
      setCustomerName("")
      setPartySearch("")
      setNotes("")
      await queryClient.invalidateQueries({ queryKey: ["sales"] })
      await queryClient.invalidateQueries({ queryKey: ["accounting"] })
      await queryClient.invalidateQueries({ queryKey: ["inventory"] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function buildSalesInvoicePayload(): CreateSalesInvoicePayload {
    return {
      status: billStatus,
      partyId: selectedPartyId || null,
      customerName: customerName.trim() || null,
      invoiceDate: today,
      dueDate: null,
      branchId: selectedBranchId || null,
      warehouseId: selectedWarehouseId || null,
      placeOfSupplyStateCode: resolvedPlaceOfSupply,
      supplyType,
      invoiceType: "tax_invoice",
      notes: notes.trim() || null,
      lines: cart.map((line) => ({
        itemId: line.itemId,
        itemName: line.itemName,
        hsnSacCode: line.hsnSacCode,
        quantity: line.quantity,
        unit: line.unit,
        rate: line.rate,
        gstRate: line.gstRate,
        taxability: line.taxability,
        cessRuleId: line.cessRuleId,
        pricingMode: line.taxMode === "INCLUSIVE" ? "tax_inclusive" : "tax_exclusive",
      })),
      payments:
        billStatus === "posted" ?
          [
            {
              paymentMode,
              amount: String(paymentAmountValue || totals.total.toFixed(2)),
              referenceNumber: null,
            },
          ]
        : [],
    }
  }

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
          taxability: activeTaxProfile?.taxability ?? "TAXABLE",
          cessRuleId: activeTaxProfile?.cessRuleId ?? null,
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
    if (registerState === "closed") {
      toast.error("Open the register before billing.")
      return
    }

    if (cart.length === 0) {
      toast.error("Add at least one product to bill.")
      return
    }

    if (!selectedBranchId) {
      toast.error("Choose a branch before checkout.")
      return
    }

    if (!selectedWarehouseId) {
      toast.error("Choose a warehouse before checkout.")
      return
    }

    checkoutMutation.mutate(buildSalesInvoicePayload())
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    await document.documentElement.requestFullscreen()
  }

  function closeRegister() {
    setRegisterState("closed")
    setCloseRegisterOpen(false)
    toast.success("Register closed for this counter.")
  }

  function openRegister() {
    setRegisterState("open")
    setRegisterOpenedAt(new Date())
    toast.success("Register opened.")
  }

  const checkoutActionLabel =
    billStatus === "posted" ? "Complete bill"
    : billStatus === "quotation" ? "Save quotation"
    : "Save draft"

  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-card px-3 py-2">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/sales" />}
            >
              <ArrowLeftIcon className="size-3.5" />
              Sales
            </Button>
            <Badge variant="outline" className="gap-1.5 bg-background">
              <ReceiptTextIcon className="size-3.5" />
              Full screen POS
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5",
                registerState === "open" ?
                  "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              )}
            >
              <span className="size-1.5 rounded-full bg-current" />
              Register {registerState}
            </Badge>
            <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-sm">
              <Clock3Icon className="size-4 text-muted-foreground" />
              <span className="font-mono">{formatClock(clock)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Branch</span>
              <Select
                value={selectedBranchId}
                onValueChange={(value) => {
                  if (!value) {
                    return
                  }

                  setBranchId(value)
                  setWarehouseId("")
                }}
                disabled={!canSwitchAllBranches && branchOptions.length <= 1}
              >
                <SelectTrigger className="h-8 w-64 max-w-[calc(100vw-7rem)] bg-background">
                  <SelectDisplayValue
                    value={selectedBranchId}
                    options={branchOptions}
                    placeholder="Choose branch"
                  />
                </SelectTrigger>
                <SelectContent>
                  {branchOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRegisterDetailsOpen(true)}
              >
                <InfoIcon className="size-3.5" />
                Register details
              </Button>
              {registerState === "open" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCloseRegisterOpen(true)}
                >
                  <XCircleIcon className="size-3.5" />
                  Close register
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  onClick={openRegister}
                >
                  <StoreIcon className="size-3.5" />
                  Open register
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                title="Calculator"
                onClick={() => setCalculatorOpen(true)}
              >
                <CalculatorIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                title={isFullscreen ? "Exit full screen" : "Full screen"}
                onClick={() => void toggleFullscreen()}
              >
                {isFullscreen ? <Minimize2Icon className="size-4" /> : <Maximize2Icon className="size-4" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(22rem,0.82fr)_minmax(0,1.45fr)]">
        <section className="flex min-h-0 min-w-0 flex-col border-border bg-card lg:border-r">
          <div className="shrink-0 border-b border-border px-3 py-2.5">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight">New counter bill</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Customer, stock source, cart and payment.
              </p>
            </div>
          </div>

          <div className="app-scrollbar flex-1 space-y-2 overflow-auto p-2.5">
            <section className="rounded-xl border bg-background p-2.5">
              <div className="mb-2 flex items-center gap-2">
                <UserRoundIcon className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Customer</h2>
              </div>
              <div className="grid gap-2">
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

            <section className="rounded-xl border bg-background p-2.5">
              <div className="mb-2 flex items-center gap-2">
                <BoxesIcon className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Bill details</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Warehouse</FieldLabel>
                  <Select
                    value={selectedWarehouseId}
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
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional bill note"
                className="mt-2 min-h-12"
              />
            </section>

            <CartTable
              cart={cart}
              totals={totals}
              onChange={updateCartLine}
              onRemove={(lineKey) =>
                setCart((current) => current.filter((line) => line.key !== lineKey))
              }
            />
          </div>

          <div className="shrink-0 border-t border-border bg-card px-3 py-2.5">
            <div
              className={cn(
                "grid gap-2 sm:items-end",
                billStatus === "posted" ?
                  "sm:grid-cols-[8rem_9rem_minmax(0,1fr)_auto]"
                : "sm:grid-cols-[8rem_minmax(0,1fr)_auto]"
              )}
            >
              <Field>
                <FieldLabel>Bill type</FieldLabel>
                <Select
                  value={billStatus}
                  onValueChange={(value) => {
                    if (value) {
                      setBillStatus(value as PosBillStatus)
                    }
                  }}
                >
                  <SelectTrigger className="h-8 w-full bg-background">
                    <SelectDisplayValue
                      value={billStatus}
                      options={billStatusOptions}
                      placeholder="Bill type"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {billStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {billStatus === "posted" ? (
                <Field>
                <FieldLabel>Payment mode</FieldLabel>
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
              ) : null}
              {billStatus === "posted" ? (
                <Field>
                  <FieldLabel>Amount received</FieldLabel>
                  <AmountInput
                    value={paymentAmountValue}
                    placeholder={formatPlainAmount(totals.total)}
                    onChange={(value) => {
                      setHasEditedPaymentAmount(true)
                      setPaymentAmount(value)
                    }}
                  />
                </Field>
              ) : (
                <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  No cash/bank entry is posted until this bill becomes final.
                </div>
              )}
              <Button
                type="button"
                className="h-9 gap-2 bg-blue-600 px-4 text-white hover:bg-blue-700"
                disabled={checkoutMutation.isPending || cart.length === 0 || registerState === "closed"}
                onClick={checkout}
              >
                {checkoutMutation.isPending ? (
                  <Spinner className="size-4" />
                ) : (
                  <CircleDollarSignIcon className="size-4" />
                )}
                {checkoutActionLabel}
              </Button>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col bg-muted/10">
          <div className="shrink-0 border-b border-border bg-card px-3 py-2.5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold">Products</h2>
                <p className="truncate text-xs text-muted-foreground">
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

          <div className="app-scrollbar flex-1 overflow-auto p-2.5">
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
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
      </section>

      <CalculatorDialog open={calculatorOpen} onOpenChange={setCalculatorOpen} />
      <RegisterDetailsDialog
        open={registerDetailsOpen}
        onOpenChange={setRegisterDetailsOpen}
        branch={selectedBranch}
        warehouseName={
          warehouseOptions.find((option) => option.value === selectedWarehouseId)?.label ?? "-"
        }
        cashierName={currentUser.profile?.display_name ?? session.user.email ?? "Cashier"}
        openedAt={registerOpenedAt}
        state={registerState}
        visibleReceipts={recentSales}
        cartTotal={totals.total}
      />
      <CloseRegisterDialog
        open={closeRegisterOpen}
        onOpenChange={setCloseRegisterOpen}
        visibleReceipts={recentSales}
        onCloseRegister={closeRegister}
      />
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
      className="group flex min-h-36 flex-col overflow-hidden rounded-xl border bg-card text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:hover:border-blue-900 dark:hover:bg-blue-950/20"
      onClick={() => onAdd(product)}
    >
      <div className="relative h-16 bg-muted">
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
        <Badge className="absolute right-1.5 top-1.5 border-border bg-background px-1.5 py-0 text-[10px] text-foreground">
          GST {formatPercent(gstRate)}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
          {product.sku} · HSN {product.activeTaxProfile?.hsnSac ?? "-"}
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <p className="text-[11px] text-muted-foreground">
              {product.activePrice?.taxMode === "INCLUSIVE" ? "Tax inclusive" : "Tax exclusive"}
            </p>
            <p className="font-mono text-sm font-semibold text-blue-700 dark:text-blue-300">
              {formatCurrency(price)}
            </p>
          </div>
          <span className="flex size-7 items-center justify-center rounded-full bg-blue-600 text-white transition-transform group-hover:scale-105">
            <PlusIcon className="size-3.5" />
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
    <section className="overflow-hidden rounded-xl border bg-background">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <ShoppingCartIcon className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Bill items</h2>
        </div>
        <Badge variant="outline" className="bg-background">
          {cart.length} lines
        </Badge>
      </div>
      <div className="app-scrollbar max-h-56 overflow-auto">
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
                    <TableCell className="text-right font-mono">
                      {formatPercent(line.gstRate)}
                    </TableCell>
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
  receipts: SalesInvoice[]
  search: string
  loading: boolean
  onSearchChange: (value: string) => void
}) {
  return (
    <div className="border-t border-border bg-card px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Recent sales bills</h3>
          <p className="text-xs text-muted-foreground">Latest invoices created from this counter.</p>
        </div>
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search bill"
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
            No recent sales bills.
          </div>
        ) : (
          receipts.map((receipt) => (
            <div key={receipt.id} className="w-52 shrink-0 rounded-2xl border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs">{receipt.invoiceNumber}</p>
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

function CalculatorDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [display, setDisplay] = React.useState("0")
  const keys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+"]

  function pressKey(key: string) {
    if (key === "%") {
      setDisplay((current) => {
        const numericValue = Number(current)

        return Number.isFinite(numericValue) ? String(numericValue / 100) : "Error"
      })
      return
    }

    if (key === "=") {
      try {
        if (!/^[\d+\-*/. ()]+$/.test(display)) {
          throw new Error("Invalid expression")
        }

        const result = Function(`"use strict"; return (${display})`)() as unknown
        setDisplay(String(Number(result)))
      } catch {
        setDisplay("Error")
      }
      return
    }

    setDisplay((current) => (current === "0" || current === "Error" ? key : `${current}${key}`))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Calculator</DialogTitle>
          <DialogDescription>Quick counter calculation without leaving POS.</DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border bg-muted/30 p-4 text-right font-mono text-2xl font-semibold">
          {display}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Button variant="outline" className="col-span-2" onClick={() => setDisplay("0")}>
            Clear
          </Button>
          <Button
            variant="outline"
            onClick={() => setDisplay((current) => current.slice(0, -1) || "0")}
          >
            Back
          </Button>
          <Button variant="outline" onClick={() => pressKey("%")}>%</Button>
          {keys.map((key) => (
            <Button
              key={key}
              type="button"
              variant={key === "=" ? "default" : "outline"}
              className={key === "=" ? "bg-blue-600 text-white hover:bg-blue-700" : undefined}
              onClick={() => pressKey(key)}
            >
              {key}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RegisterDetailsDialog({
  open,
  onOpenChange,
  branch,
  warehouseName,
  cashierName,
  openedAt,
  state,
  visibleReceipts,
  cartTotal,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  branch: BusinessBranchRecord | { id: string; name: string; branchCode?: string; status: string } | null
  warehouseName: string
  cashierName: string
  openedAt: Date
  state: RegisterState
  visibleReceipts: SalesInvoice[]
  cartTotal: number
}) {
  const visibleTotal = visibleReceipts.reduce(
    (sum, receipt) => sum + Number(receipt.totalAmount || 0),
    0
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Register details</DialogTitle>
          <DialogDescription>
            Current local counter state. Server-backed cash register closing can be added later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <RegisterInfoRow label="Status" value={state === "open" ? "Open" : "Closed"} />
          <RegisterInfoRow label="Branch" value={branch?.name ?? "-"} />
          <RegisterInfoRow label="Warehouse" value={warehouseName} />
          <RegisterInfoRow label="Cashier" value={cashierName} />
          <RegisterInfoRow label="Opened at" value={formatDateTime(openedAt)} />
          <RegisterInfoRow label="Visible bills" value={String(visibleReceipts.length)} />
          <RegisterInfoRow label="Visible bill value" value={formatCurrency(visibleTotal)} />
          <RegisterInfoRow label="Current cart" value={formatCurrency(cartTotal)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CloseRegisterDialog({
  open,
  onOpenChange,
  visibleReceipts,
  onCloseRegister,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  visibleReceipts: SalesInvoice[]
  onCloseRegister: () => void
}) {
  const visibleTotal = visibleReceipts.reduce(
    (sum, receipt) => sum + Number(receipt.totalAmount || 0),
    0
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Close register?</DialogTitle>
          <DialogDescription>
            This closes the current local counter session and stops checkout until reopened.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border bg-muted/20 p-4 text-sm">
          <RegisterInfoRow label="Visible bills" value={String(visibleReceipts.length)} />
          <RegisterInfoRow label="Visible value" value={formatCurrency(visibleTotal)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onCloseRegister}>
            Close register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RegisterInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-background px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
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

function PosLoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md space-y-3">
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </main>
  )
}

function useClock() {
  const [clock, setClock] = React.useState(() => new Date())

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClock(new Date())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  return clock
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
  const isTaxable = line.taxability === "TAXABLE"
  const taxable =
    isTaxable && line.taxMode === "INCLUSIVE" && gstRate > 0 ?
      gross / (1 + gstRate / 100)
    : gross
  const tax =
    !isTaxable ? 0
    : line.taxMode === "INCLUSIVE" ? gross - taxable
    : taxable * (gstRate / 100)
  const total = line.taxMode === "INCLUSIVE" || !isTaxable ? gross : taxable + tax

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

function formatClock(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value)
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}
