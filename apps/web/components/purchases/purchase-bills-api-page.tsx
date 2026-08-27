"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowDownIcon,
  ArrowDownUpIcon,
  ArrowUpIcon,
  CalendarIcon,
  DownloadIcon,
  EyeIcon,
  FileInputIcon,
  FilePlus2Icon,
  IndianRupeeIcon,
  MoreHorizontalIcon,
  PlusIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
  SearchIcon,
  ShoppingCartIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectDisplayValue,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  createAdjustment,
  getPurchaseBillReturnable,
  listAdjustments,
  postAdjustment,
  type AdjustmentListRow,
  type AdjustmentMode,
  type AdjustmentStatus,
  type ReturnableSource,
} from "@/lib/adjustments/api"
import { getStoredAuthSession } from "@/lib/auth/session"
import { getAllGstStates } from "@/lib/gst-state"
import { getWarehouses } from "@/lib/organization/api"
import { listParties, type PartyListItem } from "@/lib/parties/api"
import { listProducts, type ProductListItem } from "@/lib/products/api"
import {
  createPurchaseBill,
  listPurchaseBills,
  postPurchaseBill,
  type CreatePurchaseBillPayload,
  type PurchaseBill,
  type PurchaseBillStatus,
} from "@/lib/purchases/api"
import {
  downloadBlob,
  fetchPurchaseInvoicePdf,
} from "@/lib/purchases/purchase-invoice-client"
import type { PaymentMode } from "@/lib/sales/api"
import { getSettings } from "@/lib/settings/api"
import { cn } from "@/lib/utils"

type PurchaseWorkspaceTab = "bills" | "returns" | "debit-notes"
type PurchaseDialogMode = "purchase" | "purchase-return" | "debit-note" | null
type PurchaseSortKey =
  | "billNumber"
  | "supplierName"
  | "billDate"
  | "taxableValue"
  | "cgstAmount"
  | "sgstAmount"
  | "igstAmount"
  | "itcEligibleAmount"
  | "amountDue"
  | "totalAmount"
  | "status"
type AdjustmentSortKey =
  | "adjustmentNumber"
  | "adjustmentDate"
  | "taxableTotal"
  | "grandTotal"
  | "status"
type SortDirection = "asc" | "desc"

type PurchaseFormState = {
  supplierId: string
  warehouseId: string
  supplierName: string
  supplierInvoiceNumber: string
  invoiceDate: string
  billDate: string
  deliveryNoteNumber: string
  buyerOrderNumber: string
  buyerOrderDate: string
  dispatchDocumentNumber: string
  deliveryNoteDate: string
  dispatchedThrough: string
  destination: string
  termsOfDelivery: string
  placeOfSupplyStateCode: string
  purchaseType: CreatePurchaseBillPayload["purchaseType"]
  itemId: string
  itemName: string
  hsnSacCode: string
  quantity: string
  unit: string
  rate: string
  gstRate: string
  amountPaid: string
  paymentMode: PaymentMode
  notes: string
}

const today = new Date().toISOString().slice(0, 10)
const tablePageSize = 15
const purchaseTableClass =
  "w-full table-fixed text-[11px] sm:text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-2"
const purchaseTabTriggerClass =
  "relative h-7 min-w-0 rounded-none px-0 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none dark:data-[state=active]:text-blue-400 after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:scale-x-0 after:rounded-full after:bg-blue-600 after:transition-transform data-[state=active]:after:scale-x-100 dark:after:bg-blue-400"

const initialForm: PurchaseFormState = {
  supplierId: "",
  warehouseId: "",
  supplierName: "",
  supplierInvoiceNumber: "",
  invoiceDate: today,
  billDate: today,
  deliveryNoteNumber: "",
  buyerOrderNumber: "",
  buyerOrderDate: "",
  dispatchDocumentNumber: "",
  deliveryNoteDate: "",
  dispatchedThrough: "",
  destination: "",
  termsOfDelivery: "",
  placeOfSupplyStateCode: "33",
  purchaseType: "goods",
  itemId: "",
  itemName: "",
  hsnSacCode: "",
  quantity: "1",
  unit: "PCS",
  rate: "",
  gstRate: "18",
  amountPaid: "",
  paymentMode: "bank",
  notes: "",
}

const statusOptions = [
  { value: "all", label: "All status" },
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "reconciled", label: "Reconciled" },
  { value: "cancelled", label: "Cancelled" },
] as const

const adjustmentStatusOptions = [
  { value: "all", label: "All status" },
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "reversed", label: "Reversed" },
] as const

const purchaseTypeOptions = [
  { value: "goods", label: "Goods" },
  { value: "services", label: "Services" },
  { value: "expense", label: "Expense" },
] as const

const paymentModeOptions = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank" },
  { value: "cheque", label: "Cheque" },
] as const

const gstStateOptions = getAllGstStates()
  .slice()
  .sort((first, second) => first.name.localeCompare(second.name))
  .map((state) => ({ value: state.code, label: state.name }))

const tabCopy: Record<PurchaseWorkspaceTab, { title: string; description: string }> = {
  bills: {
    title: "Purchase bills",
    description: "Supplier bills, input GST, payments and payable status in one register.",
  },
  returns: {
    title: "Purchase returns",
    description: "Goods returned to suppliers against posted purchase bills.",
  },
  "debit-notes": {
    title: "Debit notes",
    description: "Supplier-side corrections for additional value or tax adjustments.",
  },
}

export function PurchaseBillsApiPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const [activeTab, setActiveTab] = React.useState<PurchaseWorkspaceTab>("bills")
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<(typeof statusOptions)[number]["value"]>("all")
  const [adjustmentStatus, setAdjustmentStatus] =
    React.useState<(typeof adjustmentStatusOptions)[number]["value"]>("all")
  const [purchaseSortKey, setPurchaseSortKey] = React.useState<PurchaseSortKey>("billDate")
  const [purchaseSortDirection, setPurchaseSortDirection] =
    React.useState<SortDirection>("desc")
  const [adjustmentSortKey, setAdjustmentSortKey] =
    React.useState<AdjustmentSortKey>("adjustmentDate")
  const [adjustmentSortDirection, setAdjustmentSortDirection] =
    React.useState<SortDirection>("desc")
  const [dialogMode, setDialogMode] = React.useState<PurchaseDialogMode>(null)

  const billsQuery = useInfiniteQuery({
    queryKey: ["purchase-bills", search, status],
    queryFn: ({ pageParam }) =>
      listPurchaseBills(accessToken, {
        search,
        status: status === "all" ? undefined : status,
        page: pageParam,
        limit: tablePageSize,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: accessToken.length > 0 && activeTab === "bills",
  })
  const purchaseReturnQuery = useAdjustmentList({
    accessToken,
    enabled: activeTab === "returns",
    mode: "purchase-return",
    search,
    status: adjustmentStatus,
  })
  const debitNoteQuery = useAdjustmentList({
    accessToken,
    enabled: activeTab === "debit-notes",
    mode: "debit-note",
    search,
    status: adjustmentStatus,
  })

  const postPurchaseMutation = useMutation({
    mutationFn: (billId: string) => postPurchaseBill(accessToken, billId),
    onSuccess: async () => {
      toast.success("Purchase bill posted.")
      await invalidatePurchaseWorkspace(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const postAdjustmentMutation = useMutation({
    mutationFn: (input: { mode: AdjustmentMode; id: string }) =>
      postAdjustment(accessToken, input.mode, input.id),
    onSuccess: async () => {
      toast.success("Adjustment posted.")
      await invalidatePurchaseWorkspace(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const downloadInvoiceMutation = useMutation({
    mutationFn: async (billId: string) => {
      const file = await fetchPurchaseInvoicePdf(accessToken, billId, { force: true })
      downloadBlob(file.fileName, file.blob)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const bills = React.useMemo(
    () => billsQuery.data?.pages.flatMap((page) => page.bills) ?? [],
    [billsQuery.data?.pages]
  )
  const totalBillsCount = billsQuery.data?.pages[0]?.pagination.total ?? bills.length
  const purchaseReturns = purchaseReturnQuery.documents
  const debitNotes = debitNoteQuery.documents
  const activeTabCopy = tabCopy[activeTab]
  const summary = React.useMemo(() => summarizePurchases(bills), [bills])
  const sortedBills = React.useMemo(
    () => sortPurchaseBills(bills, purchaseSortKey, purchaseSortDirection),
    [bills, purchaseSortDirection, purchaseSortKey]
  )
  const sortedPurchaseReturns = React.useMemo(
    () => sortAdjustments(purchaseReturns, adjustmentSortKey, adjustmentSortDirection),
    [adjustmentSortDirection, adjustmentSortKey, purchaseReturns]
  )
  const sortedDebitNotes = React.useMemo(
    () => sortAdjustments(debitNotes, adjustmentSortKey, adjustmentSortDirection),
    [adjustmentSortDirection, adjustmentSortKey, debitNotes]
  )

  function handlePurchaseTableScroll(event: React.UIEvent<HTMLDivElement>) {
    if (!billsQuery.hasNextPage || billsQuery.isFetchingNextPage) {
      return
    }

    const target = event.currentTarget
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 160) {
      void billsQuery.fetchNextPage()
    }
  }

  function togglePurchaseSort(nextKey: PurchaseSortKey) {
    if (purchaseSortKey === nextKey) {
      setPurchaseSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setPurchaseSortKey(nextKey)
    setPurchaseSortDirection(nextKey === "billDate" ? "desc" : "asc")
  }

  function toggleAdjustmentSort(nextKey: AdjustmentSortKey) {
    if (adjustmentSortKey === nextKey) {
      setAdjustmentSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setAdjustmentSortKey(nextKey)
    setAdjustmentSortDirection(nextKey === "adjustmentDate" ? "desc" : "asc")
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="p-3.5 sm:p-4 lg:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 bg-background">
                <ShoppingCartIcon className="size-3.5" />
                Purchases
              </Badge>
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <span className="size-1.5 rounded-full bg-current" />
                GST + stock ready
              </Badge>
            </div>
            <div className="mt-3 max-w-2xl space-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Purchase workspace
              </h1>
              <p className="max-w-xl text-sm leading-5 text-muted-foreground">
                Record supplier bills, returns and debit notes from one place.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                className="h-8 gap-2 bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => setDialogMode("purchase")}
              >
                <PlusIcon className="size-4" />
                Add purchase
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 gap-2 bg-background"
                onClick={() => setDialogMode("purchase-return")}
              >
                <RotateCcwIcon className="size-4" />
                Purchase return
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 gap-2 bg-background"
                onClick={() => setDialogMode("debit-note")}
              >
                <FilePlus2Icon className="size-4" />
                Debit note
              </Button>
            </div>
          </div>
          <div className="border-t border-border bg-muted/10 p-3.5 sm:p-4 lg:border-l lg:border-t-0 lg:p-5">
            <div className="grid grid-cols-2 gap-2">
              <PurchaseMetric
                label="Posted value"
                value={formatTableCurrency(summary.postedValue)}
                loading={billsQuery.isLoading}
                tone="positive"
              />
              <PurchaseMetric
                label="Input GST"
                value={formatTableCurrency(summary.inputGst)}
                loading={billsQuery.isLoading}
                tone="blue"
              />
              <PurchaseMetric
                label="Supplier due"
                value={formatTableCurrency(summary.due)}
                loading={billsQuery.isLoading}
                tone={summary.due > 0 ? "warning" : "muted"}
              />
              <PurchaseMetric
                label="Draft bills"
                value={String(summary.drafts)}
                loading={billsQuery.isLoading}
                tone={summary.drafts > 0 ? "warning" : "muted"}
              />
            </div>
          </div>
        </div>
      </section>

      <Tabs
        value={activeTab}
        defaultValue="bills"
        onValueChange={(value) => setActiveTab(value as PurchaseWorkspaceTab)}
        className="min-w-0"
      >
        <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
          <div className="border-b border-border px-4 py-3 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 space-y-1">
                <h2 className="text-base font-semibold">{activeTabCopy.title}</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  {activeTabCopy.description}
                </p>
              </div>
              <TabsList className="h-auto flex-wrap justify-start gap-4 rounded-none border-0 bg-transparent p-0 xl:justify-end">
                <TabsTrigger value="bills" className={purchaseTabTriggerClass}>
                  Bills
                </TabsTrigger>
                <TabsTrigger value="returns" className={purchaseTabTriggerClass}>
                  Returns
                </TabsTrigger>
                <TabsTrigger value="debit-notes" className={purchaseTabTriggerClass}>
                  Debit notes
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-b border-border px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
            <div className="relative w-full sm:max-w-md">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  activeTab === "bills" ? "Search bill, supplier or invoice"
                  : "Search note, bill or reason"
                }
                className="h-8 pl-8"
              />
            </div>
            <Select
              value={activeTab === "bills" ? status : adjustmentStatus}
              onValueChange={(value) => {
                if (activeTab === "bills") {
                  setStatus(value as typeof status)
                  return
                }
                setAdjustmentStatus(value as typeof adjustmentStatus)
              }}
            >
              <SelectTrigger className="h-8 w-full bg-background sm:w-40">
                {activeTab === "bills" ?
                  <SelectDisplayValue
                    value={status}
                    options={statusOptions}
                    placeholder="Status"
                  />
                : <SelectDisplayValue
                    value={adjustmentStatus}
                    options={adjustmentStatusOptions}
                    placeholder="Status"
                  />
                }
              </SelectTrigger>
              <SelectContent align="start">
                {(activeTab === "bills" ? statusOptions : adjustmentStatusOptions).map(
                  (option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="bills" className="m-0">
            <PurchaseBillsTable
              bills={sortedBills}
              isLoading={billsQuery.isLoading}
              isPosting={postPurchaseMutation.isPending}
              isFetchingNextPage={billsQuery.isFetchingNextPage}
              hasNextPage={Boolean(billsQuery.hasNextPage)}
              total={totalBillsCount}
              sortKey={purchaseSortKey}
              sortDirection={purchaseSortDirection}
              onSort={togglePurchaseSort}
              onScroll={handlePurchaseTableScroll}
              onPost={(billId) => postPurchaseMutation.mutate(billId)}
              onView={(billId) => router.push(`/purchases/view/${billId}`)}
              onPreviewInvoice={(billId) => router.push(`/purchases/invoice/${billId}`)}
              onDownloadInvoice={(billId) => downloadInvoiceMutation.mutate(billId)}
              onCreate={() => setDialogMode("purchase")}
            />
          </TabsContent>

          <TabsContent value="returns" className="m-0">
            <AdjustmentTable
              mode="purchase-return"
              documents={sortedPurchaseReturns}
              isLoading={purchaseReturnQuery.query.isLoading}
              isPosting={postAdjustmentMutation.isPending}
              isFetchingNextPage={purchaseReturnQuery.query.isFetchingNextPage}
              hasNextPage={Boolean(purchaseReturnQuery.query.hasNextPage)}
              total={purchaseReturnQuery.total}
              sortKey={adjustmentSortKey}
              sortDirection={adjustmentSortDirection}
              emptyTitle="No purchase returns yet"
              emptyDescription="Create one when goods are sent back to a supplier against a posted bill."
              onSort={toggleAdjustmentSort}
              onScroll={purchaseReturnQuery.handleScroll}
              onCreate={() => setDialogMode("purchase-return")}
              onPost={(id) =>
                postAdjustmentMutation.mutate({ mode: "purchase-return", id })
              }
            />
          </TabsContent>

          <TabsContent value="debit-notes" className="m-0">
            <AdjustmentTable
              mode="debit-note"
              documents={sortedDebitNotes}
              isLoading={debitNoteQuery.query.isLoading}
              isPosting={postAdjustmentMutation.isPending}
              isFetchingNextPage={debitNoteQuery.query.isFetchingNextPage}
              hasNextPage={Boolean(debitNoteQuery.query.hasNextPage)}
              total={debitNoteQuery.total}
              sortKey={adjustmentSortKey}
              sortDirection={adjustmentSortDirection}
              emptyTitle="No debit notes yet"
              emptyDescription="Create one when a supplier-side value or tax correction is required."
              onSort={toggleAdjustmentSort}
              onScroll={debitNoteQuery.handleScroll}
              onCreate={() => setDialogMode("debit-note")}
              onPost={(id) => postAdjustmentMutation.mutate({ mode: "debit-note", id })}
            />
          </TabsContent>
        </section>
      </Tabs>

      <PurchaseBillDialog
        open={dialogMode === "purchase"}
        onOpenChange={(open) => !open && setDialogMode(null)}
      />
      <PurchaseAdjustmentDialog
        mode="purchase-return"
        open={dialogMode === "purchase-return"}
        onOpenChange={(open) => !open && setDialogMode(null)}
      />
      <PurchaseAdjustmentDialog
        mode="debit-note"
        open={dialogMode === "debit-note"}
        onOpenChange={(open) => !open && setDialogMode(null)}
      />
    </main>
  )
}

function PurchaseBillsTable({
  bills,
  isLoading,
  isPosting,
  isFetchingNextPage,
  hasNextPage,
  total,
  sortKey,
  sortDirection,
  onSort,
  onScroll,
  onPost,
  onView,
  onPreviewInvoice,
  onDownloadInvoice,
  onCreate,
}: {
  bills: PurchaseBill[]
  isLoading: boolean
  isPosting: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  total: number
  sortKey: PurchaseSortKey
  sortDirection: SortDirection
  onSort: (key: PurchaseSortKey) => void
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void
  onPost: (billId: string) => void
  onView: (billId: string) => void
  onPreviewInvoice: (billId: string) => void
  onDownloadInvoice: (billId: string) => void
  onCreate: () => void
}) {
  return (
    <>
      <div className="app-scrollbar max-h-[30rem] overflow-auto" onScroll={onScroll}>
        <Table className={purchaseTableClass}>
          <colgroup>
            <col className="w-[12%]" />
            <col className="w-[16%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
            <TableRow className="hover:bg-transparent">
              <SortablePurchaseHead
                sortKey="billNumber"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              >
                Bill
              </SortablePurchaseHead>
              <SortablePurchaseHead
                sortKey="supplierName"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              >
                Supplier
              </SortablePurchaseHead>
              <SortablePurchaseHead
                sortKey="billDate"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              >
                Date
              </SortablePurchaseHead>
              <SortablePurchaseHead
                sortKey="taxableValue"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                align="right"
                onSort={onSort}
              >
                Taxable
              </SortablePurchaseHead>
              <SortablePurchaseHead
                sortKey="cgstAmount"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                align="right"
                onSort={onSort}
              >
                CGST
              </SortablePurchaseHead>
              <SortablePurchaseHead
                sortKey="sgstAmount"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                align="right"
                onSort={onSort}
              >
                SGST
              </SortablePurchaseHead>
              <SortablePurchaseHead
                sortKey="igstAmount"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                align="right"
                onSort={onSort}
              >
                IGST
              </SortablePurchaseHead>
              <SortablePurchaseHead
                sortKey="itcEligibleAmount"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                align="right"
                onSort={onSort}
              >
                ITC
              </SortablePurchaseHead>
              <SortablePurchaseHead
                sortKey="status"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              >
                Status
              </SortablePurchaseHead>
              <TableHead className="pr-3 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ?
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={10}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            : bills.length === 0 ?
              <TableRow>
                <TableCell colSpan={10} className="h-72 py-8">
                  <PurchaseEmptyState
                    icon={<ShoppingCartIcon className="size-5" />}
                    title="No purchase bills found"
                    description="Add a supplier bill to post input GST, inventory and payable entries."
                    actionLabel="Add purchase"
                    onAction={onCreate}
                  />
                </TableCell>
              </TableRow>
            : bills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell>
                    <Link
                      href={`/purchases/view/${bill.id}`}
                      className="font-mono text-xs font-medium underline-offset-4 hover:underline"
                    >
                      {bill.billNumber}
                    </Link>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {bill.supplierInvoiceNumber || "No supplier invoice"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="truncate font-medium">{bill.supplierName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      Due {formatTableCurrency(bill.amountDue)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p>{formatDate(bill.billDate)}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Inv {formatDate(bill.invoiceDate)}
                    </p>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatTableCurrency(bill.taxableValue)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-emerald-700 dark:text-emerald-300">
                    {formatTableCurrency(bill.cgstAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-emerald-700 dark:text-emerald-300">
                    {formatTableCurrency(bill.sgstAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-emerald-700 dark:text-emerald-300">
                    {formatTableCurrency(bill.igstAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <p className="font-mono text-blue-700 dark:text-blue-300">
                      {formatTableCurrency(bill.itcEligibleAmount)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Paid {formatTableCurrency(bill.amountPaid)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <PurchaseStatusBadge status={bill.status} />
                  </TableCell>
                  <TableCell className="pr-3 text-right">
                    <PurchaseBillActionsMenu
                      bill={bill}
                      isPosting={isPosting}
                      onPost={onPost}
                      onView={onView}
                      onPreviewInvoice={onPreviewInvoice}
                      onDownloadInvoice={onDownloadInvoice}
                    />
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>
      {!isLoading && bills.length > 0 ? (
        <ListFooter
          loading={isFetchingNextPage}
          hasMore={hasNextPage}
          loaded={bills.length}
          total={total}
          noun="purchase bills"
        />
      ) : null}
    </>
  )
}

function PurchaseBillActionsMenu({
  bill,
  isPosting,
  onPost,
  onView,
  onPreviewInvoice,
  onDownloadInvoice,
}: {
  bill: PurchaseBill
  isPosting: boolean
  onPost: (billId: string) => void
  onView: (billId: string) => void
  onPreviewInvoice: (billId: string) => void
  onDownloadInvoice: (billId: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto size-8"
          />
        }
      >
        <MoreHorizontalIcon className="size-4" />
        <span className="sr-only">Open purchase actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-48">
        <DropdownMenuItem onClick={() => onView(bill.id)}>
          <EyeIcon className="text-muted-foreground" />
          <span>View</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPreviewInvoice(bill.id)}>
          <ReceiptTextIcon className="text-muted-foreground" />
          <span>View invoice</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDownloadInvoice(bill.id)}>
          <DownloadIcon className="text-muted-foreground" />
          <span>Download invoice</span>
        </DropdownMenuItem>
        {bill.status === "draft" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isPosting}
              onClick={() => onPost(bill.id)}
            >
              {isPosting ?
                <Spinner className="size-3.5" />
              : <FilePlus2Icon className="text-muted-foreground" />
              }
              <span>Post bill</span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AdjustmentTable({
  mode,
  documents,
  isLoading,
  isPosting,
  isFetchingNextPage,
  hasNextPage,
  total,
  sortKey,
  sortDirection,
  emptyTitle,
  emptyDescription,
  onSort,
  onScroll,
  onCreate,
  onPost,
}: {
  mode: "purchase-return" | "debit-note"
  documents: AdjustmentListRow[]
  isLoading: boolean
  isPosting: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  total: number
  sortKey: AdjustmentSortKey
  sortDirection: SortDirection
  emptyTitle: string
  emptyDescription: string
  onSort: (key: AdjustmentSortKey) => void
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void
  onCreate: () => void
  onPost: (id: string) => void
}) {
  const actionLabel = mode === "purchase-return" ? "Purchase return" : "Debit note"

  return (
    <>
      <div className="app-scrollbar max-h-[30rem] overflow-auto" onScroll={onScroll}>
        <Table className={purchaseTableClass}>
          <colgroup>
            <col className="w-[15%]" />
            <col className="w-[22%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[10%]" />
            <col className="w-[13%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
            <TableRow className="hover:bg-transparent">
              <SortableAdjustmentHead
                sortKey="adjustmentNumber"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              >
                Number
              </SortableAdjustmentHead>
              <TableHead>Source bill</TableHead>
              <SortableAdjustmentHead
                sortKey="adjustmentDate"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              >
                Date
              </SortableAdjustmentHead>
              <SortableAdjustmentHead
                sortKey="taxableTotal"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                align="right"
                onSort={onSort}
              >
                Taxable
              </SortableAdjustmentHead>
              <SortableAdjustmentHead
                sortKey="grandTotal"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                align="right"
                onSort={onSort}
              >
                Total
              </SortableAdjustmentHead>
              <SortableAdjustmentHead
                sortKey="status"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              >
                Status
              </SortableAdjustmentHead>
              <TableHead className="pr-3 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ?
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            : documents.length === 0 ?
              <TableRow>
                <TableCell colSpan={7} className="h-72 py-8">
                  <PurchaseEmptyState
                    icon={
                      mode === "purchase-return" ?
                        <RotateCcwIcon className="size-5" />
                      : <FilePlus2Icon className="size-5" />
                    }
                    title={emptyTitle}
                    description={emptyDescription}
                    actionLabel={actionLabel}
                    onAction={onCreate}
                  />
                </TableCell>
              </TableRow>
            : documents.map((document) => {
                const source = getAdjustmentSourceSummary(document)

                return (
                <TableRow key={document.id}>
                  <TableCell>
                    <Link
                      href={`/${mode === "purchase-return" ? "purchase-returns" : "debit-notes"}/${document.id}`}
                      className="font-mono text-xs font-medium underline-offset-4 hover:underline"
                    >
                      {document.adjustmentNumber}
                    </Link>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {document.reason || "No reason"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="truncate font-medium">{source.documentNumber}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {source.partyName}
                    </p>
                  </TableCell>
                  <TableCell>{formatDate(document.adjustmentDate)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatTableCurrency(document.taxableTotal)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatTableCurrency(document.grandTotal)}
                  </TableCell>
                  <TableCell>
                    <AdjustmentStatusBadge status={document.status} />
                  </TableCell>
                  <TableCell className="pr-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/${mode === "purchase-return" ? "purchase-returns" : "debit-notes"}/${document.id}`}
                        className="inline-flex h-8 items-center rounded-md px-2 text-xs hover:bg-muted"
                      >
                        View
                      </Link>
                      {document.status === "draft" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isPosting}
                          onClick={() => onPost(document.id)}
                        >
                          {isPosting ? <Spinner className="size-3.5" /> : "Post"}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
                )
              })
            }
          </TableBody>
        </Table>
      </div>
      {!isLoading && documents.length > 0 ? (
        <ListFooter
          loading={isFetchingNextPage}
          hasMore={hasNextPage}
          loaded={documents.length}
          total={total}
          noun={mode === "purchase-return" ? "purchase returns" : "debit notes"}
        />
      ) : null}
    </>
  )
}

function PurchaseBillDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const [form, setForm] = React.useState<PurchaseFormState>(initialForm)
  const [supplierSearch, setSupplierSearch] = React.useState("")
  const [productSearch, setProductSearch] = React.useState("")
  const suppliersQuery = useQuery({
    queryKey: ["purchase-bills", "supplier-search", supplierSearch],
    queryFn: () =>
      listParties(accessToken, {
        role: "supplier",
        status: "active",
        search: supplierSearch,
        limit: 20,
      }),
    enabled: open && accessToken.length > 0,
  })
  const productsQuery = useQuery({
    queryKey: ["purchase-bills", "product-search", productSearch],
    queryFn: () =>
      listProducts(accessToken, {
        status: "ACTIVE",
        search: productSearch,
        limit: 20,
      }),
    enabled: open && accessToken.length > 0,
  })
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(accessToken),
    enabled: open && accessToken.length > 0,
  })
  const warehousesQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => getWarehouses(accessToken),
    enabled: open && accessToken.length > 0,
  })
  const suppliers = React.useMemo(
    () => suppliersQuery.data?.parties ?? [],
    [suppliersQuery.data?.parties]
  )
  const products = React.useMemo(
    () => productsQuery.data?.products ?? [],
    [productsQuery.data?.products]
  )
  const supplierOptions = React.useMemo(
    () => suppliers.map(toSupplierOption),
    [suppliers]
  )
  const productOptions = React.useMemo(
    () => products.map(toProductOption),
    [products]
  )
  const warehouses = React.useMemo(
    () =>
      warehousesQuery.data?.warehouses.filter(
        (warehouse) => warehouse.status.toLowerCase() === "active"
      ) ?? [],
    [warehousesQuery.data?.warehouses]
  )
  const warehouseOptions = React.useMemo(
    () =>
      warehouses.map((warehouse) => ({
        value: warehouse.id,
        label: warehouse.name,
      })),
    [warehouses]
  )
  const gstRateOptions = React.useMemo(() => {
    const configured = settingsQuery.data?.gstRateSettings.enabledGstSlabs ?? [5, 12, 18, 28]
    const current = Number(form.gstRate)
    const values = new Set<number>(configured)

    if (Number.isFinite(current) && current >= 0) {
      values.add(current)
    }

    return [...values]
      .sort((first, second) => first - second)
      .map((rate) => ({ value: String(rate), label: `${rate}%` }))
  }, [form.gstRate, settingsQuery.data?.gstRateSettings.enabledGstSlabs])
  const selectedProduct = React.useMemo(
    () => products.find((product) => product.id === form.itemId),
    [form.itemId, products]
  )
  const defaultWarehouseId = warehouses[0]?.id ?? ""
  const selectedWarehouseId = form.warehouseId || defaultWarehouseId
  const selectedWarehouseName =
    warehouseOptions.find((option) => option.value === selectedWarehouseId)?.label ?? null
  const sellerStateCode = settingsQuery.data?.registration.stateCode ?? ""
  const estimated = estimateTotal(form, sellerStateCode)
  const createMutation = useMutation({
    mutationFn: (payload: CreatePurchaseBillPayload) =>
      createPurchaseBill(accessToken, payload),
    onSuccess: async ({ bill }) => {
      setForm(initialForm)
      onOpenChange(false)
      toast.success(bill.status === "posted" ? "Purchase bill posted." : "Purchase draft saved.")
      await invalidatePurchaseWorkspace(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function submit(status: "draft" | "posted") {
    if (!form.itemName.trim()) {
      toast.error("Add at least one item name.")
      return
    }

    if (
      status === "posted" &&
      selectedProduct?.inventoryProfile?.trackInventory &&
      !selectedWarehouseId
    ) {
      toast.error("Choose a warehouse before posting tracked goods.")
      return
    }

    createMutation.mutate({
      status,
      supplierId: form.supplierId || null,
      supplierName: form.supplierName || null,
      supplierInvoiceNumber: form.supplierInvoiceNumber || null,
      invoiceDate: form.invoiceDate,
      billDate: form.billDate,
      deliveryNoteNumber: form.deliveryNoteNumber || null,
      buyerOrderNumber: form.buyerOrderNumber || null,
      buyerOrderDate: form.buyerOrderDate || null,
      dispatchDocumentNumber: form.dispatchDocumentNumber || null,
      deliveryNoteDate: form.deliveryNoteDate || null,
      dispatchedThrough: form.dispatchedThrough || null,
      destination: form.destination || null,
      termsOfDelivery: form.termsOfDelivery || null,
      warehouseId: selectedWarehouseId || null,
      placeOfSupplyStateCode: form.placeOfSupplyStateCode || null,
      purchaseType: form.purchaseType,
      notes: form.notes || null,
      lines: [
        {
          itemId: form.itemId || null,
          itemName: form.itemName,
          hsnSacCode: form.hsnSacCode || null,
          quantity: form.quantity,
          unit: form.unit || "PCS",
          rate: form.rate,
          gstRate: form.gstRate,
          itcEligible: true,
        },
      ],
      payments:
        form.amountPaid && Number(form.amountPaid) > 0 ?
          [{ paymentMode: form.paymentMode, amount: form.amountPaid }]
        : [],
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add purchase bill</DialogTitle>
          <DialogDescription>
            Capture the supplier invoice. Posting creates payable, ITC and stock/accounting entries.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel>Supplier</FieldLabel>
              <Combobox
                value={form.supplierId}
                displayValue={form.supplierName || undefined}
                searchValue={supplierSearch}
                onSearchValueChange={setSupplierSearch}
                onValueChange={(supplierId) => {
                  const supplier = suppliers.find((item) => item.id === supplierId)
                  if (!supplier) {
                    return
                  }

                  setForm((current) => ({
                    ...current,
                    supplierId: supplier.id,
                    supplierName: getSupplierInvoiceName(supplier),
                    placeOfSupplyStateCode:
                      supplier.primaryGstRegistration?.stateCode ||
                      current.placeOfSupplyStateCode,
                  }))
                }}
                options={supplierOptions}
                placeholder="Select supplier"
                searchPlaceholder="Search supplier, GSTIN or phone"
                loading={suppliersQuery.isLoading}
                emptyMessage="No supplier found. Add the supplier in Parties first."
                renderOption={(option, state) => (
                  <SearchOption
                    selected={state.selected}
                    title={String(option.label)}
                    description={option.searchValue}
                  />
                )}
              />
            </Field>
            <TextField
              label="Supplier invoice"
              value={form.supplierInvoiceNumber}
              placeholder="Number printed on supplier bill"
              onChange={(value) => setFormValue("supplierInvoiceNumber", value, setForm)}
            />
            <PurchaseDatePicker
              label="Invoice date"
              value={form.invoiceDate}
              onChange={(value) => setFormValue("invoiceDate", value, setForm)}
            />
            <PurchaseDatePicker
              label="Bill date"
              value={form.billDate}
              onChange={(value) => setFormValue("billDate", value, setForm)}
            />
            <Field>
              <FieldLabel>Purchase type</FieldLabel>
              <Select
                value={form.purchaseType}
                onValueChange={(value) =>
                  setFormValue("purchaseType", value as PurchaseFormState["purchaseType"], setForm)
                }
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectDisplayValue
                    value={form.purchaseType}
                    options={purchaseTypeOptions}
                    placeholder="Purchase type"
                  />
                </SelectTrigger>
                <SelectContent align="start">
                  {purchaseTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Place of supply</FieldLabel>
              <Select
                value={form.placeOfSupplyStateCode}
                onValueChange={(value) =>
                  setFormValue("placeOfSupplyStateCode", value ?? "", setForm)
                }
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectDisplayValue
                    value={form.placeOfSupplyStateCode}
                    options={gstStateOptions}
                    placeholder="Select state"
                  />
                </SelectTrigger>
                <SelectContent align="start">
                  {gstStateOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field>
                <FieldLabel>Item</FieldLabel>
                <Combobox
                  value={form.itemId}
                  displayValue={form.itemName || undefined}
                  searchValue={productSearch}
                  onSearchValueChange={setProductSearch}
                  onValueChange={(productId) => {
                    const product = products.find((item) => item.id === productId)
                    if (!product) {
                      return
                    }

                    setForm((current) => ({
                      ...current,
                      itemId: product.id,
                      itemName: product.name,
                      hsnSacCode: product.activeTaxProfile?.hsnSac ?? current.hsnSacCode,
                      gstRate: product.activeTaxProfile?.gstRate ?? current.gstRate,
                      rate: product.activePrice?.price ?? current.rate,
                      unit: product.unitProfile?.baseUnit ?? current.unit,
                      warehouseId:
                        product.inventoryProfile?.defaultWarehouseId ||
                        current.warehouseId ||
                        defaultWarehouseId,
                      purchaseType: product.itemType === "SERVICE" ? "services" : "goods",
                    }))
                  }}
                  options={productOptions}
                  placeholder="Select product"
                  searchPlaceholder="Search product, SKU, HSN or barcode"
                  loading={productsQuery.isLoading}
                  emptyMessage="No product found. Add products before creating purchase bills."
                  renderOption={(option, state) => (
                    <SearchOption
                      selected={state.selected}
                      title={String(option.label)}
                      description={option.searchValue}
                    />
                  )}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Warehouse</FieldLabel>
              <Select
                value={selectedWarehouseId}
                disabled={warehousesQuery.isLoading || warehouseOptions.length === 0}
                onValueChange={(value) => setFormValue("warehouseId", value ?? "", setForm)}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectDisplayValue
                    value={selectedWarehouseId}
                    options={warehouseOptions}
                    placeholder={
                      warehousesQuery.isLoading ? "Loading warehouses" : "Select warehouse"
                    }
                  />
                </SelectTrigger>
                <SelectContent align="start">
                  {warehouseOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <TextField
              label="HSN/SAC"
              value={form.hsnSacCode}
              placeholder="Auto-filled from product"
              onChange={(value) => setFormValue("hsnSacCode", value, setForm)}
            />
            <TextField
              label="Quantity"
              value={form.quantity}
              placeholder="1"
              onChange={(value) => setFormValue("quantity", value, setForm)}
            />
            <RupeeField
              label="Rate"
              value={form.rate}
              placeholder="0.00"
              onChange={(value) => setFormValue("rate", value, setForm)}
            />
            <Field>
              <FieldLabel>GST rate</FieldLabel>
              <Select
                value={form.gstRate}
                onValueChange={(value) => setFormValue("gstRate", value ?? "0", setForm)}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectDisplayValue
                    value={form.gstRate}
                    options={gstRateOptions}
                    placeholder="Select GST"
                  />
                </SelectTrigger>
                <SelectContent align="start">
                  {gstRateOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <TextField
              label="Unit"
              value={form.unit}
              placeholder="PCS"
              onChange={(value) => setFormValue("unit", value, setForm)}
            />
            <Field>
              <FieldLabel>Payment mode</FieldLabel>
              <Select
                value={form.paymentMode}
                onValueChange={(value) =>
                  setFormValue("paymentMode", value as PaymentMode, setForm)
                }
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectDisplayValue
                    value={form.paymentMode}
                    options={paymentModeOptions}
                    placeholder="Payment mode"
                  />
                </SelectTrigger>
                <SelectContent align="start">
                  {paymentModeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <TextField
              label="Amount paid"
              value={form.amountPaid}
              placeholder="Leave empty if unpaid"
              onChange={(value) => setFormValue("amountPaid", value, setForm)}
            />
            <div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:col-span-2 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-foreground">Invoice delivery details</p>
                <p className="text-xs text-muted-foreground">
                  Optional fields printed on the purchase invoice. E-way bill details can be entered here until e-way integration fills them automatically.
                </p>
              </div>
              <TextField
                label="Delivery note no."
                value={form.deliveryNoteNumber}
                placeholder="Delivery challan / note no."
                onChange={(value) => setFormValue("deliveryNoteNumber", value, setForm)}
              />
              <TextField
                label="Buyer order no."
                value={form.buyerOrderNumber}
                placeholder="Your PO / order reference"
                onChange={(value) => setFormValue("buyerOrderNumber", value, setForm)}
              />
              <PurchaseDatePicker
                label="Buyer order date"
                value={form.buyerOrderDate}
                onChange={(value) => setFormValue("buyerOrderDate", value, setForm)}
              />
              <TextField
                label="Dispatch doc no."
                value={form.dispatchDocumentNumber}
                placeholder="E-way bill / LR / transport doc"
                onChange={(value) => setFormValue("dispatchDocumentNumber", value, setForm)}
              />
              <PurchaseDatePicker
                label="Delivery note date"
                value={form.deliveryNoteDate}
                onChange={(value) => setFormValue("deliveryNoteDate", value, setForm)}
              />
              <TextField
                label="Dispatched through"
                value={form.dispatchedThrough}
                placeholder="Transporter / courier"
                onChange={(value) => setFormValue("dispatchedThrough", value, setForm)}
              />
              <TextField
                label="Destination"
                value={form.destination}
                placeholder="Delivery city or location"
                onChange={(value) => setFormValue("destination", value, setForm)}
              />
              <Field className="sm:col-span-2">
                <FieldLabel>Terms of delivery</FieldLabel>
                <Textarea
                  className="min-h-16"
                  value={form.termsOfDelivery}
                  onChange={(event) =>
                    setFormValue("termsOfDelivery", event.target.value, setForm)
                  }
                  placeholder="Freight terms, handover note, delivery instruction"
                />
              </Field>
            </div>
            <Field className="sm:col-span-2">
              <FieldLabel>Notes</FieldLabel>
              <Textarea
                value={form.notes}
                onChange={(event) => setFormValue("notes", event.target.value, setForm)}
                placeholder="Optional internal note"
              />
            </Field>
          </div>
          <PurchaseBillPreview
            estimated={estimated}
            amountPaid={Number(form.amountPaid || 0)}
            warehouseName={selectedWarehouseName}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            disabled={createMutation.isPending}
            onClick={() => submit("draft")}
          >
            {createMutation.isPending ? <Spinner className="size-4" /> : "Save draft"}
          </Button>
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={createMutation.isPending}
            onClick={() => submit("posted")}
          >
            {createMutation.isPending ? <Spinner className="size-4" /> : "Post purchase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PurchaseAdjustmentDialog({
  mode,
  open,
  onOpenChange,
}: {
  mode: "purchase-return" | "debit-note"
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const [sourceSearch, setSourceSearch] = React.useState("")
  const [sourceDocumentId, setSourceDocumentId] = React.useState("")
  const [adjustmentDate, setAdjustmentDate] = React.useState(today)
  const [reason, setReason] = React.useState("")
  const [lineValues, setLineValues] = React.useState<Record<string, string>>({})
  const config =
    mode === "purchase-return" ?
      {
        title: "Purchase return",
        description: "Select a posted supplier bill and enter the returned quantities.",
        valueLabel: "Return qty",
        valueInput: "quantity" as const,
        icon: RotateCcwIcon,
      }
    : {
        title: "Debit note",
        description: "Select a posted supplier bill and enter the additional taxable value.",
        valueLabel: "Adjust value",
        valueInput: "amount" as const,
        icon: FilePlus2Icon,
      }
  const AdjustmentIcon = config.icon

  const sourceQuery = useQuery({
    queryKey: ["purchase-adjustments", mode, "sources", sourceSearch],
    queryFn: async () => {
      const response = await listPurchaseBills(accessToken, {
        search: sourceSearch,
        status: "posted",
        limit: 50,
      })

      return response.bills
    },
    enabled: open && accessToken.length > 0,
  })
  const returnableQuery = useQuery({
    queryKey: ["purchase-adjustments", mode, "returnable", sourceDocumentId],
    queryFn: () => getPurchaseBillReturnable(accessToken, sourceDocumentId),
    enabled: open && sourceDocumentId.length > 0 && accessToken.length > 0,
  })
  const createMutation = useMutation({
    mutationFn: async () => {
      const source = returnableQuery.data

      if (!source) {
        throw new Error("Choose a posted purchase bill first.")
      }

      const lines = source.lines
        .map((line) => ({
          line,
          value: lineValues[line.id]?.trim() ?? "",
        }))
        .filter(({ value }) => Number(value) > 0)
        .map(({ line, value }) => ({
          originalLineId: line.id,
          ...(config.valueInput === "quantity" ? { quantity: value } : { taxableValue: value }),
          inventoryEffect:
            mode === "purchase-return" ? ("STOCK_OUT" as const) : ("NONE" as const),
        }))

      if (lines.length === 0) {
        throw new Error(
          config.valueInput === "quantity" ?
            "Enter return quantity for at least one line."
          : "Enter adjustment value for at least one line."
        )
      }

      return createAdjustment(accessToken, mode, {
        idempotencyKey: crypto.randomUUID(),
        sourceDocumentId,
        adjustmentDate,
        reason: reason.trim() || null,
        adjustmentContext:
          mode === "purchase-return" ? "goods_related" : "tax_adjustment",
        lines,
      })
    },
    onSuccess: async () => {
      setSourceDocumentId("")
      setLineValues({})
      setReason("")
      onOpenChange(false)
      toast.success("Draft adjustment created.")
      await invalidatePurchaseWorkspace(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-2xl border bg-muted/10">
            <div className="border-b bg-background px-3 py-2.5">
              <Badge variant="outline" className="gap-1.5 bg-background">
                <AdjustmentIcon className="size-3.5" />
                Source bill
              </Badge>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Pick the posted purchase bill that this {mode === "purchase-return" ? "return" : "debit note"} belongs to.
              </p>
            </div>
            <div className="space-y-3 p-3">
              <Field>
                <FieldLabel>Posted purchase bill</FieldLabel>
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 pl-8"
                    value={sourceSearch}
                    onChange={(event) => setSourceSearch(event.target.value)}
                    placeholder="Search bill or supplier"
                  />
                </div>
              </Field>
              <div className="app-scrollbar max-h-[22rem] space-y-2 overflow-y-auto rounded-xl">
                {sourceQuery.isLoading ?
                  Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 rounded-xl" />
                  ))
                : sourceQuery.data?.length ?
                  sourceQuery.data.map((bill) => (
                    <button
                      key={bill.id}
                      type="button"
                      className={cn(
                        "w-full rounded-xl border bg-background p-3 text-left text-sm transition-colors",
                        sourceDocumentId === bill.id ?
                          "border-blue-500 bg-blue-500/5"
                        : "hover:bg-muted/50"
                      )}
                      onClick={() => {
                        setSourceDocumentId(bill.id)
                        setLineValues({})
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-xs">{bill.billNumber}</span>
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            sourceDocumentId === bill.id ? "bg-blue-600" : "bg-muted-foreground/30"
                          )}
                        />
                      </div>
                      <p className="mt-1 truncate font-medium">{bill.supplierName}</p>
                      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>{formatDate(bill.billDate)}</span>
                        <span className="font-mono">{formatCurrency(bill.totalAmount)}</span>
                      </div>
                    </button>
                  ))
                : <div className="rounded-xl border border-dashed bg-background p-5">
                    <PurchaseEmptyState
                      icon={<ShoppingCartIcon className="size-5" />}
                      title="No posted purchase bills"
                      description="Only posted purchase bills can be returned or adjusted."
                    />
                  </div>
                }
              </div>
            </div>
          </section>
          <section className="overflow-hidden rounded-2xl border">
            <div className="border-b bg-background px-3 py-2.5">
              <Badge variant="outline" className="gap-1.5 bg-background">
                <FileInputIcon className="size-3.5" />
                Adjustment details
              </Badge>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Add the date, reason and exact line quantities or values to create a draft.
              </p>
            </div>
            <div className="space-y-4 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <PurchaseDatePicker
                  label={mode === "purchase-return" ? "Return date" : "Debit note date"}
                  value={adjustmentDate}
                  onChange={setAdjustmentDate}
                />
                <TextField
                  label="Reason"
                  value={reason}
                  placeholder="Returned goods, rate correction, tax correction"
                  onChange={setReason}
                />
              </div>
              <ReturnableLinesEditor
                source={returnableQuery.data}
                loading={returnableQuery.isLoading}
                valueLabel={config.valueLabel}
                valueInput={config.valueInput}
                values={lineValues}
                onChange={(lineId, value) =>
                  setLineValues((current) => ({ ...current, [lineId]: value }))
                }
              />
            </div>
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={!sourceDocumentId || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? <Spinner className="size-4" /> : "Save draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReturnableLinesEditor({
  source,
  loading,
  valueLabel,
  valueInput,
  values,
  onChange,
}: {
  source: ReturnableSource | undefined
  loading: boolean
  valueLabel: string
  valueInput: "quantity" | "amount"
  values: Record<string, string>
  onChange: (lineId: string, value: string) => void
}) {
  if (loading) {
    return <Skeleton className="h-72 rounded-2xl" />
  }

  if (!source) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed">
        <PurchaseEmptyState
          icon={<FileInputIcon className="size-5" />}
          title="Choose a purchase bill"
          description="Lines available for return or adjustment will appear here."
        />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border">
      <div className="border-b p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-sm">{source.sourceDocument.documentNumber}</p>
            <p className="text-xs text-muted-foreground">
              {source.sourceDocument.partyName} · {formatDate(source.sourceDocument.documentDate)}
            </p>
          </div>
          <Badge variant="outline">{formatCurrency(source.sourceDocument.totalAmount)}</Badge>
        </div>
      </div>
      <div className="app-scrollbar max-h-80 overflow-auto">
        <Table className={purchaseTableClass}>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
            <TableRow>
              <TableHead className="w-[34%]">Item</TableHead>
              <TableHead className="w-[13%] text-right">Original</TableHead>
              <TableHead className="w-[13%] text-right">Returned</TableHead>
              <TableHead className="w-[13%] text-right">Remaining</TableHead>
              <TableHead className="w-[14%] text-right">Rate</TableHead>
              <TableHead className="w-[13%] pr-3 text-right">{valueLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {source.lines.map((line) => {
              const remaining = Number(line.remainingQuantity)
              return (
                <TableRow key={line.id}>
                  <TableCell>
                    <p className="truncate font-medium">{line.itemName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {line.hsnSacCode || "No HSN"} · GST {line.gstRate}% · {line.unit}
                    </p>
                  </TableCell>
                  <TableCell className="text-right font-mono">{line.originalQuantity}</TableCell>
                  <TableCell className="text-right font-mono">{line.previouslyReturnedQuantity}</TableCell>
                  <TableCell className="text-right font-mono">{line.remainingQuantity}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(line.rate)}</TableCell>
                  <TableCell className="pr-3">
                    <Input
                      className="h-8 text-right font-mono"
                      inputMode="decimal"
                      disabled={valueInput === "quantity" && remaining <= 0}
                      value={values[line.id] ?? ""}
                      onChange={(event) => onChange(line.id, event.target.value)}
                      placeholder={valueInput === "quantity" ? "0" : "0.00"}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function useAdjustmentList({
  accessToken,
  enabled,
  mode,
  search,
  status,
}: {
  accessToken: string
  enabled: boolean
  mode: "purchase-return" | "debit-note"
  search: string
  status: "all" | AdjustmentStatus
}) {
  const query = useInfiniteQuery({
    queryKey: ["adjustments", mode, search, status],
    queryFn: ({ pageParam }) =>
      listAdjustments(accessToken, mode, {
        search,
        status,
        page: pageParam,
        limit: tablePageSize,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: enabled && accessToken.length > 0,
  })
  const documents = React.useMemo(
    () => query.data?.pages.flatMap((page) => page.adjustments) ?? [],
    [query.data?.pages]
  )
  const total = query.data?.pages[0]?.pagination.total ?? documents.length
  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!query.hasNextPage || query.isFetchingNextPage) {
        return
      }

      const target = event.currentTarget
      if (target.scrollHeight - target.scrollTop - target.clientHeight < 160) {
        void query.fetchNextPage()
      }
    },
    [query]
  )

  return { query, documents, total, handleScroll }
}

function PurchaseMetric({
  label,
  value,
  loading,
  tone,
}: {
  label: string
  value: string
  loading: boolean
  tone: "positive" | "blue" | "warning" | "muted"
}) {
  return (
    <div className="min-h-20 rounded-2xl border border-border bg-background p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      {loading ?
        <Skeleton className="mt-3 h-5 w-24" />
      : <p
          className={cn(
            "mt-2 truncate font-mono text-base font-semibold",
            tone === "positive" && "text-emerald-700 dark:text-emerald-300",
            tone === "blue" && "text-blue-700 dark:text-blue-300",
            tone === "warning" && "text-amber-700 dark:text-amber-300",
            tone === "muted" && "text-muted-foreground"
          )}
        >
          {value}
        </p>
      }
    </div>
  )
}

function PurchaseStatusBadge({ status }: { status: PurchaseBillStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize",
        status === "posted" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
        status === "draft" &&
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
        status === "cancelled" &&
          "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
        status === "reconciled" &&
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
      )}
    >
      {status}
    </Badge>
  )
}

function AdjustmentStatusBadge({ status }: { status: AdjustmentStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize",
        status === "posted" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
        status === "draft" &&
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
        status === "reversed" &&
          "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
      )}
    >
      {status}
    </Badge>
  )
}

function SortablePurchaseHead({
  children,
  sortKey,
  activeSortKey,
  sortDirection,
  align = "left",
  onSort,
}: {
  children: React.ReactNode
  sortKey: PurchaseSortKey
  activeSortKey: PurchaseSortKey
  sortDirection: SortDirection
  align?: "left" | "right"
  onSort: (key: PurchaseSortKey) => void
}) {
  return (
    <SortableHead
      active={activeSortKey === sortKey}
      direction={sortDirection}
      align={align}
      onClick={() => onSort(sortKey)}
    >
      {children}
    </SortableHead>
  )
}

function SortableAdjustmentHead({
  children,
  sortKey,
  activeSortKey,
  sortDirection,
  align = "left",
  onSort,
}: {
  children: React.ReactNode
  sortKey: AdjustmentSortKey
  activeSortKey: AdjustmentSortKey
  sortDirection: SortDirection
  align?: "left" | "right"
  onSort: (key: AdjustmentSortKey) => void
}) {
  return (
    <SortableHead
      active={activeSortKey === sortKey}
      direction={sortDirection}
      align={align}
      onClick={() => onSort(sortKey)}
    >
      {children}
    </SortableHead>
  )
}

function SortableHead({
  children,
  active,
  direction,
  align,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  direction: SortDirection
  align: "left" | "right"
  onClick: () => void
}) {
  const SortIcon = !active ? ArrowDownUpIcon : direction === "asc" ? ArrowUpIcon : ArrowDownIcon

  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-md transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          align === "right" && "ml-auto justify-end text-right",
          active ? "text-primary" : "text-foreground"
        )}
        onClick={onClick}
      >
        <span className="truncate">{children}</span>
        <SortIcon
          className={cn("size-3 shrink-0", !active && "text-muted-foreground/70")}
        />
      </button>
    </TableHead>
  )
}

function PurchaseEmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <Empty className="mx-auto min-h-52 max-w-sm border-0 p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {actionLabel && onAction ? (
        <EmptyContent>
          <Button size="sm" onClick={onAction}>
            <PlusIcon className="size-4" />
            {actionLabel}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}

function ListFooter({
  loading,
  hasMore,
  loaded,
  total,
  noun,
}: {
  loading: boolean
  hasMore: boolean
  loaded: number
  total: number
  noun: string
}) {
  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
      <span>
        Showing {loaded} of {total} {noun}
      </span>
      <span>
        {loading ?
          <span className="inline-flex items-center gap-2">
            <Spinner className="size-3.5" />
            Loading more
          </span>
        : hasMore ? "Scroll for more"
        : "End of list"}
      </span>
    </div>
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
        className="h-8"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

function RupeeField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <IndianRupeeIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 pl-8 font-mono"
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </Field>
  )
}

function PurchaseDatePicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const selectedDate = parseDateValue(value)

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Popover>
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
            }}
          />
        </PopoverContent>
      </Popover>
    </Field>
  )
}

function PurchaseBillPreview({
  estimated,
  amountPaid,
  warehouseName,
}: {
  estimated: ReturnType<typeof estimateTotal>
  amountPaid: number
  warehouseName: string | null
}) {
  const due = Math.max(estimated.total - amountPaid, 0)

  return (
    <aside className="space-y-3 rounded-2xl border border-blue-200/70 bg-blue-50/50 p-3 text-sm dark:border-blue-900/50 dark:bg-blue-950/20">
      <div className="rounded-xl bg-background p-3 ring-1 ring-border">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Payable total
        </p>
        <p className="mt-2 truncate font-mono text-2xl font-semibold text-blue-700 dark:text-blue-300">
          {formatCurrency(estimated.total)}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Tax and stock entries are prepared from this preview when the bill is posted.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PreviewTile label="Taxable" value={formatCurrency(estimated.taxable)} />
        <PreviewTile label="GST" value={formatCurrency(estimated.gst)} tone="green" />
        <PreviewTile label="Paid" value={formatCurrency(amountPaid)} tone="blue" />
        <PreviewTile
          label="Due"
          value={formatCurrency(due)}
          tone={due > 0 ? "amber" : "green"}
        />
      </div>
      <div className="space-y-2 rounded-xl border bg-background p-3 text-xs">
        <SummaryRow label="CGST" value={formatCurrency(estimated.cgst)} />
        <SummaryRow label="SGST" value={formatCurrency(estimated.sgst)} />
        <SummaryRow label="IGST" value={formatCurrency(estimated.igst)} />
        {warehouseName ? (
          <p className="border-t pt-2 text-muted-foreground">
            Stock will enter <span className="font-medium text-foreground">{warehouseName}</span>.
          </p>
        ) : (
          <p className="border-t pt-2 text-muted-foreground">
            Choose a warehouse before posting tracked goods.
          </p>
        )}
      </div>
    </aside>
  )
}

function PreviewTile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "green" | "blue" | "amber"
}) {
  return (
    <div className="rounded-xl border bg-background px-2.5 py-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate font-mono text-xs font-semibold",
          tone === "green" && "text-emerald-700 dark:text-emerald-300",
          tone === "blue" && "text-blue-700 dark:text-blue-300",
          tone === "amber" && "text-amber-700 dark:text-amber-300"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function SearchOption({
  selected,
  title,
  description,
}: {
  selected: boolean
  title: string
  description?: string
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        {description ? (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {selected ? (
        <span className="size-2 shrink-0 rounded-full bg-blue-600" />
      ) : null}
    </div>
  )
}

function SummaryRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string
  value: string
  strong?: boolean
  tone?: "warning"
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono",
          strong && "font-semibold",
          tone === "warning" && "text-amber-700 dark:text-amber-300"
        )}
      >
        {value}
      </span>
    </div>
  )
}

function setFormValue<K extends keyof PurchaseFormState>(
  key: K,
  value: PurchaseFormState[K],
  setForm: React.Dispatch<React.SetStateAction<PurchaseFormState>>
) {
  setForm((current) => ({ ...current, [key]: value }))
}

function estimateTotal(form: PurchaseFormState, sellerStateCode: string) {
  const taxable = Number(form.quantity || 0) * Number(form.rate || 0)
  const gst = taxable * (Number(form.gstRate || 0) / 100)
  const isIntraState =
    Boolean(sellerStateCode) && form.placeOfSupplyStateCode === sellerStateCode
  const cgst = isIntraState ? gst / 2 : 0
  const sgst = isIntraState ? gst / 2 : 0
  const igst = isIntraState ? 0 : gst

  return {
    taxable,
    gst,
    cgst,
    sgst,
    igst,
    total: taxable + gst,
  }
}

function summarizePurchases(bills: PurchaseBill[]) {
  return bills.reduce(
    (summary, bill) => ({
      postedValue:
        summary.postedValue + (bill.status === "posted" ? Number(bill.totalAmount) : 0),
      inputGst: summary.inputGst + Number(bill.itcEligibleAmount),
      due: summary.due + Number(bill.amountDue),
      drafts: summary.drafts + (bill.status === "draft" ? 1 : 0),
    }),
    { postedValue: 0, inputGst: 0, due: 0, drafts: 0 }
  )
}

function sortPurchaseBills(
  bills: PurchaseBill[],
  sortKey: PurchaseSortKey,
  direction: SortDirection
) {
  return [...bills].sort((first, second) => {
    const multiplier = direction === "asc" ? 1 : -1

    if (sortKey === "billNumber") {
      return first.billNumber.localeCompare(second.billNumber) * multiplier
    }

    if (sortKey === "supplierName") {
      return first.supplierName.localeCompare(second.supplierName) * multiplier
    }

    if (sortKey === "billDate") {
      return first.billDate.localeCompare(second.billDate) * multiplier
    }

    if (sortKey === "status") {
      return first.status.localeCompare(second.status) * multiplier
    }

    const firstValue =
      sortKey === "taxableValue" ? first.taxableValue
      : sortKey === "cgstAmount" ? first.cgstAmount
      : sortKey === "sgstAmount" ? first.sgstAmount
      : sortKey === "igstAmount" ? first.igstAmount
      : sortKey === "itcEligibleAmount" ? first.itcEligibleAmount
      : sortKey === "amountDue" ? first.amountDue
      : first.totalAmount
    const secondValue =
      sortKey === "taxableValue" ? second.taxableValue
      : sortKey === "cgstAmount" ? second.cgstAmount
      : sortKey === "sgstAmount" ? second.sgstAmount
      : sortKey === "igstAmount" ? second.igstAmount
      : sortKey === "itcEligibleAmount" ? second.itcEligibleAmount
      : sortKey === "amountDue" ? second.amountDue
      : second.totalAmount

    return (Number(firstValue) - Number(secondValue)) * multiplier
  })
}

function sortAdjustments(
  documents: AdjustmentListRow[],
  sortKey: AdjustmentSortKey,
  direction: SortDirection
) {
  return [...documents].sort((first, second) => {
    const multiplier = direction === "asc" ? 1 : -1

    if (sortKey === "adjustmentNumber") {
      return first.adjustmentNumber.localeCompare(second.adjustmentNumber) * multiplier
    }

    if (sortKey === "adjustmentDate") {
      return first.adjustmentDate.localeCompare(second.adjustmentDate) * multiplier
    }

    if (sortKey === "status") {
      return first.status.localeCompare(second.status) * multiplier
    }

    const firstValue =
      sortKey === "taxableTotal" ? first.taxableTotal : first.grandTotal
    const secondValue =
      sortKey === "taxableTotal" ? second.taxableTotal : second.grandTotal

    return (Number(firstValue) - Number(secondValue)) * multiplier
  })
}

function toSupplierOption(supplier: PartyListItem): ComboboxOption {
  const gstin = supplier.primaryGstRegistration?.gstin ?? ""
  const contact =
    supplier.primaryContact?.mobile ||
    supplier.primaryContact?.phone ||
    supplier.primaryContact?.email ||
    ""

  return {
    value: supplier.id,
    label: getSupplierInvoiceName(supplier),
    searchValue: [
      supplier.displayName,
      getSupplierInvoiceName(supplier),
      supplier.legalName,
      supplier.tradeName,
      gstin,
      contact,
      supplier.supplierCode,
    ]
      .filter(Boolean)
      .join(" · "),
  }
}

function getSupplierInvoiceName(supplier: PartyListItem) {
  return (
    supplier.primaryGstRegistration?.tradeName ||
    supplier.primaryGstRegistration?.legalName ||
    supplier.tradeName ||
    supplier.legalName ||
    supplier.displayName
  )
}

function toProductOption(product: ProductListItem): ComboboxOption {
  return {
    value: product.id,
    label: product.name,
    searchValue: [
      product.name,
      product.sku,
      product.activeTaxProfile?.hsnSac,
      product.primaryBarcode?.barcode,
      product.activePrice?.price ? `Rate ${formatCurrency(product.activePrice.price)}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  }
}

function getAdjustmentSourceSummary(document: AdjustmentListRow) {
  const snapshot = document.sourceSnapshot

  if (snapshot && typeof snapshot === "object") {
    const record = snapshot as Record<string, unknown>
    const documentNumber = String(record.documentNumber ?? "").trim()
    const partyName = String(record.partyName ?? "").trim()

    return {
      documentNumber: documentNumber || "Purchase bill",
      partyName: partyName || "Supplier not available",
    }
  }

  return {
    documentNumber: "Purchase bill",
    partyName: "Source snapshot unavailable",
  }
}

async function invalidatePurchaseWorkspace(
  queryClient: ReturnType<typeof useQueryClient>
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["purchase-bills"] }),
    queryClient.invalidateQueries({ queryKey: ["adjustments"] }),
    queryClient.invalidateQueries({ queryKey: ["accounting"] }),
    queryClient.invalidateQueries({ queryKey: ["inventory"] }),
  ])
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatTableCurrency(value: string | number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
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

function formatDate(value: string) {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}
