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
  CheckCircle2Icon,
  DownloadIcon,
  EyeIcon,
  FileMinus2Icon,
  FilePlus2Icon,
  IndianRupeeIcon,
  MoreHorizontalIcon,
  PlusIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
  SearchIcon,
  SendIcon,
  Trash2Icon,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  getSalesInvoiceReturnable,
  listAdjustments,
  postAdjustment,
  type AdjustmentListRow,
  type AdjustmentStatus,
  type ReturnableSource,
} from "@/lib/adjustments/api"
import { getStoredAuthSession } from "@/lib/auth/session"
import { getAllGstStates } from "@/lib/gst-state"
import { getWarehouses } from "@/lib/organization/api"
import { listParties } from "@/lib/parties/api"
import { listProducts } from "@/lib/products/api"
import {
  createSalesInvoice,
  listSalesInvoices,
  postSalesInvoice,
  type CreateSalesInvoicePayload,
  type PaymentMode,
  type SalesInvoice,
  type SalesInvoiceLinePayload,
  type SalesInvoiceStatus,
} from "@/lib/sales/api"
import { getSettings } from "@/lib/settings/api"
import {
  downloadBlob,
  fetchSalesInvoicePdf,
} from "@/lib/sales/sales-invoice-client"
import { cn } from "@/lib/utils"

type SalesWorkspaceTab = "bills" | "returns" | "credit-notes"
type SalesDialogMode = "sales-bill" | "sales-return" | "credit-note" | null
type SalesSortKey =
  | "invoiceNumber"
  | "customerName"
  | "invoiceDate"
  | "taxableValue"
  | "cgstAmount"
  | "sgstAmount"
  | "igstAmount"
  | "amountDue"
  | "totalAmount"
  | "status"
type AdjustmentSortKey =
  | "adjustmentNumber"
  | "adjustmentDate"
  | "taxableTotal"
  | "cgstTotal"
  | "sgstTotal"
  | "igstTotal"
  | "grandTotal"
  | "status"
type SortDirection = "asc" | "desc"

type SalesBillFormState = {
  partyId: string
  customerName: string
  customerSearch: string
  invoiceDate: string
  dueDate: string
  warehouseId: string
  placeOfSupplyStateCode: string
  supplyType: "b2b" | "b2c"
  notes: string
  paymentMode: PaymentMode
  amountPaid: string
  lines: SalesFormLine[]
}

type SalesFormLine = SalesInvoiceLinePayload & {
  localId: string
  productSearch: string
  pricingMode: "tax_exclusive" | "tax_inclusive"
  taxability: "TAXABLE" | "EXEMPT" | "NIL_RATED" | "NON_GST" | "ZERO_RATED"
  discountAmount: string
}

const tablePageSize = 15
const today = new Date().toISOString().slice(0, 10)
const defaultGstSlabs = [5, 12, 18, 28]
const salesTableClass =
  "w-full table-fixed text-[11px] sm:text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-2"
const salesTabTriggerClass =
  "relative h-7 min-w-0 rounded-none px-0 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none dark:data-[state=active]:text-blue-400 after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:scale-x-0 after:rounded-full after:bg-blue-600 after:transition-transform data-[state=active]:after:scale-x-100 dark:after:bg-blue-400"

const statusOptions = [
  { value: "all", label: "All status" },
  { value: "quotation", label: "Quotation" },
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "cancelled", label: "Cancelled" },
] as const

const adjustmentStatusOptions = [
  { value: "all", label: "All status" },
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "reversed", label: "Reversed" },
] as const

const supplyTypeOptions = [
  { value: "b2c", label: "B2C" },
  { value: "b2b", label: "B2B" },
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

const tabCopy: Record<SalesWorkspaceTab, { title: string; description: string }> = {
  bills: {
    title: "Sales bills",
    description: "Customer bills, output GST, payments and receivable status in one register.",
  },
  returns: {
    title: "Sales returns",
    description: "Goods returned by customers against posted sales bills.",
  },
  "credit-notes": {
    title: "Credit notes",
    description: "Customer-side value or tax reductions without editing the original bill.",
  },
}

function createEmptyLine(): SalesFormLine {
  return {
    localId: crypto.randomUUID(),
    itemId: null,
    itemName: "",
    hsnSacCode: "",
    quantity: "1",
    unit: "PCS",
    rate: "",
    gstRate: "18",
    pricingMode: "tax_exclusive",
    taxability: "TAXABLE",
    cessRuleId: null,
    discountAmount: "",
    productSearch: "",
  }
}

function createInitialForm(stateCode = "33"): SalesBillFormState {
  return {
    partyId: "",
    customerName: "",
    customerSearch: "",
    invoiceDate: today,
    dueDate: "",
    warehouseId: "",
    placeOfSupplyStateCode: stateCode,
    supplyType: "b2c",
    notes: "",
    paymentMode: "upi",
    amountPaid: "",
    lines: [createEmptyLine()],
  }
}

export function SalesWorkspacePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const [activeTab, setActiveTab] = React.useState<SalesWorkspaceTab>("bills")
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<(typeof statusOptions)[number]["value"]>("all")
  const [adjustmentStatus, setAdjustmentStatus] =
    React.useState<(typeof adjustmentStatusOptions)[number]["value"]>("all")
  const [salesSortKey, setSalesSortKey] = React.useState<SalesSortKey>("invoiceDate")
  const [salesSortDirection, setSalesSortDirection] = React.useState<SortDirection>("desc")
  const [adjustmentSortKey, setAdjustmentSortKey] =
    React.useState<AdjustmentSortKey>("adjustmentDate")
  const [adjustmentSortDirection, setAdjustmentSortDirection] =
    React.useState<SortDirection>("desc")
  const [dialogMode, setDialogMode] = React.useState<SalesDialogMode>(null)

  const invoicesQuery = useInfiniteQuery({
    queryKey: ["sales", "bills", search, status],
    queryFn: ({ pageParam }) =>
      listSalesInvoices(accessToken, {
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
  const salesReturnQuery = useSalesAdjustmentList({
    accessToken,
    enabled: activeTab === "returns",
    mode: "sales-return",
    search,
    status: adjustmentStatus,
  })
  const creditNoteQuery = useSalesAdjustmentList({
    accessToken,
    enabled: activeTab === "credit-notes",
    mode: "credit-note",
    search,
    status: adjustmentStatus,
  })

  const postInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => postSalesInvoice(accessToken, invoiceId),
    onSuccess: async () => {
      toast.success("Sales bill posted.")
      await invalidateSalesWorkspace(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const downloadInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      fetchSalesInvoicePdf(accessToken, invoiceId, { force: true }),
    onSuccess: ({ blob, fileName }) => downloadBlob(fileName, blob),
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const postAdjustmentMutation = useMutation({
    mutationFn: (input: { mode: "sales-return" | "credit-note"; id: string }) =>
      postAdjustment(accessToken, input.mode, input.id),
    onSuccess: async () => {
      toast.success("Adjustment posted.")
      await invalidateSalesWorkspace(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const invoices = React.useMemo(
    () => invoicesQuery.data?.pages.flatMap((page) => page.invoices) ?? [],
    [invoicesQuery.data?.pages]
  )
  const totalInvoicesCount = invoicesQuery.data?.pages[0]?.pagination.total ?? invoices.length
  const salesReturns = salesReturnQuery.documents
  const creditNotes = creditNoteQuery.documents
  const activeTabCopy = tabCopy[activeTab]
  const summary = React.useMemo(() => summarizeSales(invoices), [invoices])
  const sortedInvoices = React.useMemo(
    () => sortSalesInvoices(invoices, salesSortKey, salesSortDirection),
    [invoices, salesSortDirection, salesSortKey]
  )
  const sortedSalesReturns = React.useMemo(
    () => sortAdjustments(salesReturns, adjustmentSortKey, adjustmentSortDirection),
    [adjustmentSortDirection, adjustmentSortKey, salesReturns]
  )
  const sortedCreditNotes = React.useMemo(
    () => sortAdjustments(creditNotes, adjustmentSortKey, adjustmentSortDirection),
    [adjustmentSortDirection, adjustmentSortKey, creditNotes]
  )

  function handleSalesTableScroll(event: React.UIEvent<HTMLDivElement>) {
    if (!invoicesQuery.hasNextPage || invoicesQuery.isFetchingNextPage) {
      return
    }

    const target = event.currentTarget
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 160) {
      void invoicesQuery.fetchNextPage()
    }
  }

  function toggleSalesSort(nextKey: SalesSortKey) {
    if (salesSortKey === nextKey) {
      setSalesSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setSalesSortKey(nextKey)
    setSalesSortDirection(nextKey === "invoiceDate" ? "desc" : "asc")
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
                <ReceiptTextIcon className="size-3.5" />
                Sales
              </Badge>
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <span className="size-1.5 rounded-full bg-current" />
                GST + receivable ready
              </Badge>
            </div>
            <div className="mt-3 max-w-2xl space-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Sales workspace
              </h1>
              <p className="max-w-xl text-sm leading-5 text-muted-foreground">
                Create sales bills, returns and credit notes from one place.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                className="h-8 gap-2 bg-blue-600 text-white hover:bg-blue-700"
                nativeButton={false}
                render={<Link href="/pos" />}
              >
                <PlusIcon className="size-4" />
                Add sales bill
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 gap-2 bg-background"
                onClick={() => setDialogMode("sales-return")}
              >
                <RotateCcwIcon className="size-4" />
                Sales return
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 gap-2 bg-background"
                onClick={() => setDialogMode("credit-note")}
              >
                <FileMinus2Icon className="size-4" />
                Credit note
              </Button>
            </div>
          </div>
          <div className="border-t border-border bg-muted/10 p-3.5 sm:p-4 lg:border-l lg:border-t-0 lg:p-5">
            <div className="grid grid-cols-2 gap-2">
              <SalesMetric
                label="Posted sales"
                value={formatTableCurrency(summary.postedValue)}
                loading={invoicesQuery.isLoading}
                tone="positive"
              />
              <SalesMetric
                label="Output GST"
                value={formatTableCurrency(summary.outputGst)}
                loading={invoicesQuery.isLoading}
                tone="blue"
              />
              <SalesMetric
                label="Customer due"
                value={formatTableCurrency(summary.due)}
                loading={invoicesQuery.isLoading}
                tone={summary.due > 0 ? "warning" : "muted"}
              />
              <SalesMetric
                label="Draft/quotes"
                value={String(summary.drafts)}
                loading={invoicesQuery.isLoading}
                tone={summary.drafts > 0 ? "warning" : "muted"}
              />
            </div>
          </div>
        </div>
      </section>

      <Tabs
        value={activeTab}
        defaultValue="bills"
        onValueChange={(value) => setActiveTab(value as SalesWorkspaceTab)}
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
                <TabsTrigger value="bills" className={salesTabTriggerClass}>
                  Bills
                </TabsTrigger>
                <TabsTrigger value="returns" className={salesTabTriggerClass}>
                  Returns
                </TabsTrigger>
                <TabsTrigger value="credit-notes" className={salesTabTriggerClass}>
                  Credit notes
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
                  activeTab === "bills" ? "Search bill, customer or invoice"
                  : "Search note, bill or reason"
                }
                className="h-8 pl-8"
              />
            </div>
            <Select
              value={activeTab === "bills" ? status : adjustmentStatus}
              onValueChange={(value) => {
                if (!value) {
                  return
                }

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
            <SalesBillsTable
              invoices={sortedInvoices}
              isLoading={invoicesQuery.isLoading}
              isPosting={postInvoiceMutation.isPending}
              isFetchingNextPage={invoicesQuery.isFetchingNextPage}
              hasNextPage={Boolean(invoicesQuery.hasNextPage)}
              total={totalInvoicesCount}
              sortKey={salesSortKey}
              sortDirection={salesSortDirection}
              onSort={toggleSalesSort}
              onScroll={handleSalesTableScroll}
              onPost={(invoiceId) => postInvoiceMutation.mutate(invoiceId)}
              downloadingInvoiceId={
                downloadInvoiceMutation.isPending ?
                  downloadInvoiceMutation.variables
                : null
              }
              onDownload={(invoiceId) => downloadInvoiceMutation.mutate(invoiceId)}
              onCreate={() => router.push("/pos")}
            />
          </TabsContent>

          <TabsContent value="returns" className="m-0">
            <SalesAdjustmentTable
              mode="sales-return"
              documents={sortedSalesReturns}
              isLoading={salesReturnQuery.query.isLoading}
              isPosting={postAdjustmentMutation.isPending}
              isFetchingNextPage={salesReturnQuery.query.isFetchingNextPage}
              hasNextPage={Boolean(salesReturnQuery.query.hasNextPage)}
              total={salesReturnQuery.total}
              sortKey={adjustmentSortKey}
              sortDirection={adjustmentSortDirection}
              emptyTitle="No sales returns yet"
              emptyDescription="Create one when a customer returns goods against a posted bill."
              onSort={toggleAdjustmentSort}
              onScroll={salesReturnQuery.handleScroll}
              onCreate={() => setDialogMode("sales-return")}
              onPost={(id) => postAdjustmentMutation.mutate({ mode: "sales-return", id })}
            />
          </TabsContent>

          <TabsContent value="credit-notes" className="m-0">
            <SalesAdjustmentTable
              mode="credit-note"
              documents={sortedCreditNotes}
              isLoading={creditNoteQuery.query.isLoading}
              isPosting={postAdjustmentMutation.isPending}
              isFetchingNextPage={creditNoteQuery.query.isFetchingNextPage}
              hasNextPage={Boolean(creditNoteQuery.query.hasNextPage)}
              total={creditNoteQuery.total}
              sortKey={adjustmentSortKey}
              sortDirection={adjustmentSortDirection}
              emptyTitle="No credit notes yet"
              emptyDescription="Create one when a customer bill needs a value or tax reduction."
              onSort={toggleAdjustmentSort}
              onScroll={creditNoteQuery.handleScroll}
              onCreate={() => setDialogMode("credit-note")}
              onPost={(id) => postAdjustmentMutation.mutate({ mode: "credit-note", id })}
            />
          </TabsContent>
        </section>
      </Tabs>

      {dialogMode === "sales-bill" ? (
        <SalesBillDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setDialogMode(null)
            }
          }}
        />
      ) : null}
      {dialogMode === "sales-return" ? (
        <SalesAdjustmentDialog
          mode="sales-return"
          open
          onOpenChange={(open) => {
            if (!open) {
              setDialogMode(null)
            }
          }}
        />
      ) : null}
      {dialogMode === "credit-note" ? (
        <SalesAdjustmentDialog
          mode="credit-note"
          open
          onOpenChange={(open) => {
            if (!open) {
              setDialogMode(null)
            }
          }}
        />
      ) : null}
    </main>
  )
}

function SalesBillsTable({
  invoices,
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
  downloadingInvoiceId,
  onDownload,
  onCreate,
}: {
  invoices: SalesInvoice[]
  isLoading: boolean
  isPosting: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  total: number
  sortKey: SalesSortKey
  sortDirection: SortDirection
  onSort: (key: SalesSortKey) => void
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void
  onPost: (invoiceId: string) => void
  downloadingInvoiceId: string | null
  onDownload: (invoiceId: string) => void
  onCreate: () => void
}) {
  return (
    <>
      <div className="app-scrollbar max-h-[30rem] overflow-auto" onScroll={onScroll}>
        <Table className={salesTableClass}>
          <colgroup>
            <col className="w-[12%]" />
            <col className="w-[17%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[8%]" />
            <col className="w-[7%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
            <TableRow className="hover:bg-transparent">
              <SortableSalesHead
                sortKey="invoiceNumber"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              >
                Bill
              </SortableSalesHead>
              <SortableSalesHead
                sortKey="customerName"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              >
                Customer
              </SortableSalesHead>
              <SortableSalesHead
                sortKey="invoiceDate"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              >
                Date
              </SortableSalesHead>
              <SortableSalesHead
                sortKey="taxableValue"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
                align="right"
              >
                Taxable
              </SortableSalesHead>
              <SortableSalesHead
                sortKey="cgstAmount"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
                align="right"
              >
                CGST
              </SortableSalesHead>
              <SortableSalesHead
                sortKey="sgstAmount"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
                align="right"
              >
                SGST
              </SortableSalesHead>
              <SortableSalesHead
                sortKey="igstAmount"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
                align="right"
              >
                IGST
              </SortableSalesHead>
              <SortableSalesHead
                sortKey="totalAmount"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
                align="right"
              >
                Total
              </SortableSalesHead>
              <SortableSalesHead
                sortKey="status"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              >
                Status
              </SortableSalesHead>
              <TableHead className="pr-3 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 7 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={10}>
                    <Skeleton className="h-8 w-full rounded-lg" />
                  </TableCell>
                </TableRow>
              ))
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-72 py-8">
                  <SalesEmptyState
                    icon={<ReceiptTextIcon className="size-5" />}
                    title="No sales bills found"
                    description="Create the first sales bill to start output GST, receivable and filing records."
                    actionLabel="Add sales bill"
                    onAction={onCreate}
                  />
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <Link
                      className="font-mono text-[11px] underline-offset-4 hover:underline"
                      href={`/invoices/${invoice.id}`}
                    >
                      {invoice.invoiceNumber}
                    </Link>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      Due {formatTableCurrency(invoice.amountDue)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="truncate font-medium">{invoice.customerName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {invoice.status === "posted" ? "Ready for GST"
                      : invoice.status === "quotation" ? "Quotation not posted"
                      : "Draft not posted"}
                    </p>
                  </TableCell>
                  <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                  <MoneyTableCell value={invoice.taxableValue} />
                  <MoneyTableCell value={invoice.cgstAmount} />
                  <MoneyTableCell value={invoice.sgstAmount} />
                  <MoneyTableCell value={invoice.igstAmount} />
                  <MoneyTableCell value={invoice.totalAmount} />
                  <TableCell>
                    <SalesStatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell className="pr-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8"
                          />
                        }
                      >
                        <MoreHorizontalIcon className="size-4" />
                        <span className="sr-only">Open sales bill actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem render={<Link href={`/invoices/${invoice.id}`} />}>
                          <EyeIcon className="size-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem render={<Link href={`/invoices/invoice/${invoice.id}`} />}>
                          <ReceiptTextIcon className="size-4" />
                          View invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={downloadingInvoiceId === invoice.id}
                          onClick={() => onDownload(invoice.id)}
                        >
                          {downloadingInvoiceId === invoice.id ? (
                            <Spinner className="size-4" />
                          ) : (
                            <DownloadIcon className="size-4" />
                          )}
                          Download invoice
                        </DropdownMenuItem>
                        {invoice.status === "draft" || invoice.status === "quotation" ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={isPosting}
                              onClick={() => onPost(invoice.id)}
                            >
                              <CheckCircle2Icon className="size-4" />
                              Post bill
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <ListFooter
        loading={isFetchingNextPage}
        hasMore={hasNextPage}
        loaded={invoices.length}
        total={total}
        noun="sales bills"
      />
    </>
  )
}

function SalesAdjustmentTable({
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
  mode: "sales-return" | "credit-note"
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
  const modePath = mode === "sales-return" ? "sales-returns" : "credit-notes"
  const actionLabel = mode === "sales-return" ? "Sales return" : "Credit note"

  return (
    <>
      <div className="app-scrollbar max-h-[30rem] overflow-auto" onScroll={onScroll}>
        <Table className={salesTableClass}>
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[6%]" />
            <col className="w-[4%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
            <TableRow className="hover:bg-transparent">
              <SortableAdjustmentHead
                sortKey="adjustmentNumber"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              >
                Note
              </SortableAdjustmentHead>
              <TableHead>Customer</TableHead>
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
                onSort={onSort}
                align="right"
              >
                Taxable
              </SortableAdjustmentHead>
              <SortableAdjustmentHead
                sortKey="cgstTotal"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
                align="right"
              >
                CGST
              </SortableAdjustmentHead>
              <SortableAdjustmentHead
                sortKey="sgstTotal"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
                align="right"
              >
                SGST
              </SortableAdjustmentHead>
              <SortableAdjustmentHead
                sortKey="igstTotal"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
                align="right"
              >
                IGST
              </SortableAdjustmentHead>
              <SortableAdjustmentHead
                sortKey="grandTotal"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
                align="right"
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
            {isLoading ? (
              Array.from({ length: 7 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={10}>
                    <Skeleton className="h-8 w-full rounded-lg" />
                  </TableCell>
                </TableRow>
              ))
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-72 py-8">
                  <SalesEmptyState
                    icon={
                      mode === "sales-return" ?
                        <RotateCcwIcon className="size-5" />
                      : <FileMinus2Icon className="size-5" />
                    }
                    title={emptyTitle}
                    description={emptyDescription}
                    actionLabel={`Create ${actionLabel.toLowerCase()}`}
                    onAction={onCreate}
                  />
                </TableCell>
              </TableRow>
            ) : (
              documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell>
                    <Link
                      className="font-mono text-[11px] underline-offset-4 hover:underline"
                      href={`/${modePath}/${document.id}`}
                    >
                      {document.adjustmentNumber}
                    </Link>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {document.reason || "No reason added"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="truncate font-medium">{getPartyName(document.partySnapshot)}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      Source {document.sourceDocumentId?.slice(0, 8) ?? "-"}
                    </p>
                  </TableCell>
                  <TableCell>{formatDate(document.adjustmentDate)}</TableCell>
                  <MoneyTableCell value={document.taxableTotal} />
                  <MoneyTableCell value={document.cgstTotal} />
                  <MoneyTableCell value={document.sgstTotal} />
                  <MoneyTableCell value={document.igstTotal} />
                  <MoneyTableCell value={document.grandTotal} />
                  <TableCell>
                    <AdjustmentStatusBadge status={document.status} />
                  </TableCell>
                  <TableCell className="pr-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8"
                          />
                        }
                      >
                        <MoreHorizontalIcon className="size-4" />
                        <span className="sr-only">Open adjustment actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem render={<Link href={`/${modePath}/${document.id}`} />}>
                          <EyeIcon className="size-4" />
                          View
                        </DropdownMenuItem>
                        {document.status === "draft" ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={isPosting}
                              onClick={() => onPost(document.id)}
                            >
                              <CheckCircle2Icon className="size-4" />
                              Post note
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <ListFooter
        loading={isFetchingNextPage}
        hasMore={hasNextPage}
        loaded={documents.length}
        total={total}
        noun={mode === "sales-return" ? "sales returns" : "credit notes"}
      />
    </>
  )
}

function SalesBillDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(accessToken),
    enabled: open && accessToken.length > 0,
  })
  const sellerStateCode = settingsQuery.data?.registration.stateCode ?? "33"
  const enabledGstSlabs =
    settingsQuery.data?.gstRateSettings.enabledGstSlabs ?? defaultGstSlabs
  const gstRateOptions = React.useMemo(
    () => enabledGstSlabs.map((rate) => ({ value: String(rate), label: `${rate}%` })),
    [enabledGstSlabs]
  )
  const [form, setForm] = React.useState(() => createInitialForm(sellerStateCode))
  const [partySearch, setPartySearch] = React.useState("")
  const [productSearch, setProductSearch] = React.useState("")

  const partiesQuery = useQuery({
    queryKey: ["sales", "customer-search", partySearch],
    queryFn: () =>
      listParties(accessToken, {
        search: partySearch,
        role: "customer",
        status: "active",
        page: 1,
        limit: 12,
      }),
    enabled: open && accessToken.length > 0,
  })
  const productsQuery = useQuery({
    queryKey: ["sales", "product-search", productSearch],
    queryFn: () =>
      listProducts(accessToken, {
        search: productSearch,
        status: "ACTIVE",
        page: 1,
        limit: 12,
      }),
    enabled: open && accessToken.length > 0,
  })
  const warehousesQuery = useQuery({
    queryKey: ["organization", "warehouses"],
    queryFn: () => getWarehouses(accessToken),
    enabled: open && accessToken.length > 0,
  })

  const partyOptions = React.useMemo<ComboboxOption[]>(
    () =>
      partiesQuery.data?.parties.map((party) => ({
        value: party.id,
        searchValue: [party.displayName, party.tradeName, party.legalName, party.primaryGstRegistration?.gstin]
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
  const productOptions = React.useMemo<ComboboxOption[]>(
    () =>
      productsQuery.data?.products.map((product) => ({
        value: product.id,
        searchValue: [product.name, product.sku, product.activeTaxProfile?.hsnSac]
          .filter(Boolean)
          .join(" "),
        label: (
          <div className="min-w-0">
            <p className="truncate font-medium">{product.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {product.sku} · HSN {product.activeTaxProfile?.hsnSac ?? "-"} · GST{" "}
              {formatPercent(product.activeTaxProfile?.gstRate ?? "0")}
            </p>
          </div>
        ),
      })) ?? [],
    [productsQuery.data?.products]
  )
  const warehouseOptions =
    warehousesQuery.data?.warehouses
      .filter((warehouse) => warehouse.status === "active")
      .map((warehouse) => ({ value: warehouse.id, label: warehouse.name })) ?? []
  const selectedWarehouseId = form.warehouseId || warehouseOptions[0]?.value || ""
  const estimated = estimateSalesTotal(form.lines, sellerStateCode === form.placeOfSupplyStateCode)
  const amountPaid = Number(form.amountPaid || 0)

  const createMutation = useMutation({
    mutationFn: (payload: CreateSalesInvoicePayload) =>
      createSalesInvoice(accessToken, payload),
    onSuccess: async ({ invoice }) => {
      onOpenChange(false)
      toast.success(invoice.status === "posted" ? "Sales bill posted." : "Sales draft saved.")
      await invalidateSalesWorkspace(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function submit(status: "draft" | "posted") {
    const lines = form.lines
      .map((line) => ({
        itemId: line.itemId,
        itemName: line.itemName.trim(),
        hsnSacCode: line.hsnSacCode?.trim() || null,
        quantity: line.quantity,
        unit: line.unit,
        rate: line.rate,
        gstRate: line.gstRate,
        taxability: line.taxability,
        pricingMode: line.pricingMode,
        cessRuleId: line.cessRuleId || null,
        discountAmount: line.discountAmount || null,
      }))
      .filter((line) => line.itemName.length > 0 && Number(line.quantity) > 0)

    if (lines.length === 0) {
      toast.error("Add at least one item.")
      return
    }

    createMutation.mutate({
      status,
      partyId: form.partyId || null,
      customerName: form.customerName.trim() || null,
      invoiceDate: form.invoiceDate,
      dueDate: form.dueDate || null,
      warehouseId: selectedWarehouseId || null,
      placeOfSupplyStateCode: form.placeOfSupplyStateCode,
      supplyType: form.supplyType,
      invoiceType: "tax_invoice",
      notes: form.notes.trim() || null,
      lines,
      payments:
        amountPaid > 0 ?
          [
            {
              paymentMode: form.paymentMode,
              amount: form.amountPaid,
            },
          ]
        : [],
    })
  }

  function selectParty(partyId: string) {
    const party = partiesQuery.data?.parties.find((entry) => entry.id === partyId)

    setForm((current) => ({
      ...current,
      partyId,
      customerName: party?.displayName ?? current.customerName,
      placeOfSupplyStateCode:
        party?.primaryGstRegistration?.stateCode ?? current.placeOfSupplyStateCode,
      supplyType: party?.primaryGstRegistration ? "b2b" : current.supplyType,
    }))
  }

  function selectProduct(lineId: string, productId: string) {
    const product = productsQuery.data?.products.find((entry) => entry.id === productId)

    if (!product) {
      return
    }

    setForm((current) => ({
      ...current,
      warehouseId:
        current.warehouseId || product.inventoryProfile?.defaultWarehouseId || "",
      lines: current.lines.map((line) =>
        line.localId === lineId ?
          {
            ...line,
            itemId: product.id,
            itemName: product.name,
            hsnSacCode: product.activeTaxProfile?.hsnSac ?? "",
            unit: product.unitProfile?.baseUnit ?? "PCS",
            rate: product.activePrice?.price ?? line.rate,
            gstRate: product.activeTaxProfile?.gstRate ?? line.gstRate,
            taxability: product.activeTaxProfile?.taxability ?? "TAXABLE",
            cessRuleId: product.activeTaxProfile?.cessRuleId ?? null,
            pricingMode:
              product.activePrice?.taxMode === "INCLUSIVE" ?
                "tax_inclusive"
              : "tax_exclusive",
            productSearch: product.name,
          }
        : line
      ),
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Add sales bill</DialogTitle>
          <DialogDescription>
            Select the customer, add products, collect payment if any, then save draft
            or post directly.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="space-y-4">
            <div className="grid gap-3 rounded-2xl border bg-muted/10 p-3 md:grid-cols-2 xl:grid-cols-4">
              <Field className="xl:col-span-2">
                <FieldLabel>Customer</FieldLabel>
                <Combobox
                  value={form.partyId}
                  options={partyOptions}
                  searchValue={partySearch}
                  loading={partiesQuery.isLoading}
                  placeholder="Walk-in or saved customer"
                  searchPlaceholder="Search customer"
                  emptyMessage="No customer found. Type a walk-in name below."
                  onSearchValueChange={setPartySearch}
                  onValueChange={selectParty}
                  contentClassName="w-[22rem]"
                />
              </Field>
              <TextField
                label="Customer name"
                value={form.customerName}
                placeholder="Walk-in customer"
                onChange={(value) => setFormValue("customerName", value, setForm)}
              />
              <Field>
                <FieldLabel>Supply type</FieldLabel>
                <Select
                  value={form.supplyType}
                  onValueChange={(value) => {
                    if (!value) {
                      return
                    }

                    setFormValue(
                      "supplyType",
                      value as SalesBillFormState["supplyType"],
                      setForm
                    )
                  }}
                >
                  <SelectTrigger className="h-8 bg-background">
                    <SelectDisplayValue
                      value={form.supplyType}
                      options={supplyTypeOptions}
                      placeholder="Supply type"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {supplyTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <SalesDatePicker
                label="Bill date"
                value={form.invoiceDate}
                onChange={(value) => setFormValue("invoiceDate", value, setForm)}
              />
              <SalesDatePicker
                label="Due date"
                value={form.dueDate}
                onChange={(value) => setFormValue("dueDate", value, setForm)}
              />
              <Field>
                <FieldLabel>Place of supply</FieldLabel>
                <Select
                  value={form.placeOfSupplyStateCode}
                  onValueChange={(value) => {
                    if (!value) {
                      return
                    }

                    setFormValue("placeOfSupplyStateCode", value, setForm)
                  }}
                >
                  <SelectTrigger className="h-8 bg-background">
                    <SelectDisplayValue
                      value={form.placeOfSupplyStateCode}
                      options={gstStateOptions}
                      placeholder="State"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {gstStateOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Warehouse</FieldLabel>
                <Select
                  value={selectedWarehouseId}
                  onValueChange={(value) => {
                    if (!value) {
                      return
                    }

                    setFormValue("warehouseId", value, setForm)
                  }}
                >
                  <SelectTrigger className="h-8 bg-background">
                    <SelectDisplayValue
                      value={selectedWarehouseId}
                      options={warehouseOptions}
                      placeholder="Default warehouse"
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
            </div>

            <section className="overflow-hidden rounded-2xl border">
              <div className="flex items-center justify-between gap-3 border-b bg-background px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Items</p>
                  <p className="text-xs text-muted-foreground">
                    Product defaults fill HSN, GST, unit and price automatically.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      lines: [...current.lines, createEmptyLine()],
                    }))
                  }
                >
                  <PlusIcon className="size-4" />
                  Add item
                </Button>
              </div>
              <div className="app-scrollbar max-h-80 overflow-auto">
                <Table className={salesTableClass}>
                  <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
                    <TableRow>
                      <TableHead className="w-[28%]">Product</TableHead>
                      <TableHead className="w-[12%]">HSN</TableHead>
                      <TableHead className="w-[10%] text-right">Qty</TableHead>
                      <TableHead className="w-[12%] text-right">Rate</TableHead>
                      <TableHead className="w-[10%] text-right">GST</TableHead>
                      <TableHead className="w-[11%] text-right">Discount</TableHead>
                      <TableHead className="w-[12%] text-right">Line total</TableHead>
                      <TableHead className="w-[5%] pr-3 text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.lines.map((line) => {
                      const lineTotal = estimateLine(line, sellerStateCode === form.placeOfSupplyStateCode).total

                      return (
                        <TableRow key={line.localId}>
                          <TableCell>
                            <Combobox
                              value={line.itemId ?? ""}
                              options={productOptions}
                              searchValue={productSearch}
                              loading={productsQuery.isLoading}
                              placeholder={line.itemName || "Select product"}
                              searchPlaceholder="Search product, SKU or HSN"
                              emptyMessage="No product found."
                              onSearchValueChange={setProductSearch}
                              onValueChange={(value) => selectProduct(line.localId, value)}
                              contentClassName="w-[24rem]"
                              displayValue={line.itemName || undefined}
                            />
                            <Input
                              className="mt-1 h-8"
                              value={line.itemName}
                              placeholder="Or enter item name"
                              onChange={(event) =>
                                updateLine(line.localId, "itemName", event.target.value, setForm)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 font-mono"
                              value={line.hsnSacCode ?? ""}
                              onChange={(event) =>
                                updateLine(line.localId, "hsnSacCode", event.target.value, setForm)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 text-right font-mono"
                              inputMode="decimal"
                              value={line.quantity}
                              onChange={(event) =>
                                updateLine(line.localId, "quantity", event.target.value, setForm)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <AmountInput
                              value={line.rate}
                              onChange={(value) => updateLine(line.localId, "rate", value, setForm)}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={line.gstRate}
                              onValueChange={(value) => {
                                if (!value) {
                                  return
                                }

                                updateLine(line.localId, "gstRate", value, setForm)
                              }}
                            >
                              <SelectTrigger className="h-8 bg-background">
                                <SelectDisplayValue
                                  value={line.gstRate}
                                  options={gstRateOptions}
                                  placeholder="GST"
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {enabledGstSlabs.map((rate) => (
                                  <SelectItem key={rate} value={String(rate)}>
                                    {rate}%
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <AmountInput
                              value={line.discountAmount}
                              onChange={(value) =>
                                updateLine(line.localId, "discountAmount", value, setForm)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatTableCurrency(lineTotal)}
                          </TableCell>
                          <TableCell className="pr-3 text-right">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              disabled={form.lines.length === 1}
                              onClick={() =>
                                setForm((current) => ({
                                  ...current,
                                  lines: current.lines.filter((entry) => entry.localId !== line.localId),
                                }))
                              }
                            >
                              <Trash2Icon className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>

            <div className="grid gap-3 rounded-2xl border bg-muted/10 p-3 md:grid-cols-[minmax(0,1fr)_11rem_11rem]">
              <Field>
                <FieldLabel>Notes</FieldLabel>
                <Textarea
                  value={form.notes}
                  onChange={(event) => setFormValue("notes", event.target.value, setForm)}
                  placeholder="Optional bill note"
                />
              </Field>
              <Field>
                <FieldLabel>Payment mode</FieldLabel>
                <Select
                  value={form.paymentMode}
                  onValueChange={(value) => {
                    if (!value) {
                      return
                    }

                    setFormValue("paymentMode", value as PaymentMode, setForm)
                  }}
                >
                  <SelectTrigger className="h-8 bg-background">
                    <SelectDisplayValue
                      value={form.paymentMode}
                      options={paymentModeOptions}
                      placeholder="Payment mode"
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
                  value={form.amountPaid}
                  onChange={(value) => setFormValue("amountPaid", value, setForm)}
                />
              </Field>
            </div>
          </section>

          <SalesBillPreview
            estimated={estimated}
            amountPaid={amountPaid}
            warehouseName={
              warehouseOptions.find((option) => option.value === selectedWarehouseId)?.label ??
              null
            }
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
            {createMutation.isPending ? <Spinner className="size-4" /> : <SendIcon className="size-4" />}
            Post sales bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SalesAdjustmentDialog({
  mode,
  open,
  onOpenChange,
}: {
  mode: "sales-return" | "credit-note"
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const [sourceSearch, setSourceSearch] = React.useState("")
  const [sourceDocumentId, setSourceDocumentId] = React.useState("")
  const [adjustmentDate, setAdjustmentDate] = React.useState(today)
  const [warehouseId, setWarehouseId] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [lineValues, setLineValues] = React.useState<Record<string, string>>({})
  const config =
    mode === "sales-return" ?
      {
        title: "Sales return",
        description: "Select a posted sales bill and enter returned quantities.",
        valueLabel: "Return qty",
        valueInput: "quantity" as const,
        adjustmentContext: "goods_related" as const,
        icon: RotateCcwIcon,
      }
    : {
        title: "Credit note",
        description: "Select a posted sales bill and enter the credit value.",
        valueLabel: "Credit value",
        valueInput: "amount" as const,
        adjustmentContext: "value_only" as const,
        icon: FileMinus2Icon,
      }
  const AdjustmentIcon = config.icon

  const sourceQuery = useQuery({
    queryKey: ["sales-adjustments", mode, "sources", sourceSearch],
    queryFn: async () => {
      const response = await listSalesInvoices(accessToken, {
        search: sourceSearch,
        status: "posted",
        limit: 50,
      })

      return response.invoices
    },
    enabled: open && accessToken.length > 0,
  })
  const returnableQuery = useQuery({
    queryKey: ["sales-adjustments", mode, "returnable", sourceDocumentId],
    queryFn: () => getSalesInvoiceReturnable(accessToken, sourceDocumentId),
    enabled: open && sourceDocumentId.length > 0 && accessToken.length > 0,
  })
  const warehousesQuery = useQuery({
    queryKey: ["organization", "warehouses"],
    queryFn: () => getWarehouses(accessToken),
    enabled: open && mode === "sales-return" && accessToken.length > 0,
  })
  const warehouseOptions =
    warehousesQuery.data?.warehouses
      .filter((warehouse) => warehouse.status === "active")
      .map((warehouse) => ({ value: warehouse.id, label: warehouse.name })) ?? []
  const selectedReturnWarehouseId =
    mode === "sales-return" ? warehouseId || warehouseOptions[0]?.value || "" : ""

  const createMutation = useMutation({
    mutationFn: async () => {
      const source = returnableQuery.data

      if (!source) {
        throw new Error("Choose a posted sales bill first.")
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
          inventoryEffect: mode === "sales-return" ? ("STOCK_IN" as const) : ("NONE" as const),
          inventoryWarehouseId:
            mode === "sales-return" ? selectedReturnWarehouseId || null : null,
        }))

      if (lines.length === 0) {
        throw new Error(
          config.valueInput === "quantity" ?
            "Enter return quantity for at least one line."
          : "Enter credit value for at least one line."
        )
      }

      return createAdjustment(accessToken, mode, {
        idempotencyKey: crypto.randomUUID(),
        sourceDocumentId,
        adjustmentDate,
        reason: reason.trim() || null,
        adjustmentContext: config.adjustmentContext,
        issuerType: "GSTFY_BUSINESS",
        documentDirection: "outgoing",
        sourcePartyRole: "customer",
        lines,
      })
    },
    onSuccess: async () => {
      onOpenChange(false)
      toast.success("Draft adjustment created.")
      await invalidateSalesWorkspace(queryClient)
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
                Pick the posted sales bill that this {mode === "sales-return" ? "return" : "credit note"} belongs to.
              </p>
            </div>
            <div className="space-y-3 p-3">
              <Field>
                <FieldLabel>Posted sales bill</FieldLabel>
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 pl-8"
                    value={sourceSearch}
                    onChange={(event) => setSourceSearch(event.target.value)}
                    placeholder="Search bill or customer"
                  />
                </div>
              </Field>
              <div className="app-scrollbar max-h-[22rem] space-y-2 overflow-y-auto rounded-xl">
                {sourceQuery.isLoading ?
                  Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 rounded-xl" />
                  ))
                : sourceQuery.data?.length ?
                  sourceQuery.data.map((invoice) => (
                    <button
                      key={invoice.id}
                      type="button"
                      className={cn(
                        "w-full rounded-xl border bg-background p-3 text-left text-sm transition-colors",
                        sourceDocumentId === invoice.id ?
                          "border-blue-500 bg-blue-500/5"
                        : "hover:bg-muted/50"
                      )}
                      onClick={() => {
                        setSourceDocumentId(invoice.id)
                        setLineValues({})
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-xs">{invoice.invoiceNumber}</span>
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            sourceDocumentId === invoice.id ? "bg-blue-600" : "bg-muted-foreground/30"
                          )}
                        />
                      </div>
                      <p className="mt-1 truncate font-medium">{invoice.customerName}</p>
                      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>{formatDate(invoice.invoiceDate)}</span>
                        <span className="font-mono">{formatCurrency(invoice.totalAmount)}</span>
                      </div>
                    </button>
                  ))
                : <div className="rounded-xl border border-dashed bg-background p-5">
                    <SalesEmptyState
                      icon={<ReceiptTextIcon className="size-5" />}
                      title="No posted sales bills"
                      description="Only posted sales bills can be returned or adjusted."
                    />
                  </div>
                }
              </div>
            </div>
          </section>
          <section className="overflow-hidden rounded-2xl border">
            <div className="border-b bg-background px-3 py-2.5">
              <Badge variant="outline" className="gap-1.5 bg-background">
                <FilePlus2Icon className="size-3.5" />
                Adjustment details
              </Badge>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Add the date, reason and exact line quantities or values to create a draft.
              </p>
            </div>
            <div className="space-y-4 p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <SalesDatePicker
                  label={mode === "sales-return" ? "Return date" : "Credit note date"}
                  value={adjustmentDate}
                  onChange={setAdjustmentDate}
                />
                {mode === "sales-return" ? (
                  <Field>
                    <FieldLabel>Return warehouse</FieldLabel>
                    <Select
                      value={selectedReturnWarehouseId || undefined}
                      onValueChange={(value) => {
                        if (!value) {
                          return
                        }

                        setWarehouseId(value)
                      }}
                    >
                      <SelectTrigger className="h-8 bg-background">
                        <SelectDisplayValue
                          value={selectedReturnWarehouseId}
                          options={warehouseOptions}
                          placeholder="Warehouse"
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
                ) : null}
                <TextField
                  label="Reason"
                  value={reason}
                  placeholder="Returned goods, discount, rate correction"
                  onChange={setReason}
                />
              </div>
              <SalesReturnableLinesEditor
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

function SalesReturnableLinesEditor({
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
        <SalesEmptyState
          icon={<FilePlus2Icon className="size-5" />}
          title="Choose a sales bill"
          description="Lines available for return or credit will appear here."
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
        <Table className={salesTableClass}>
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
                      {line.hsnSacCode || "No HSN"} · GST {formatPercent(line.gstRate)} · {line.unit}
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

function useSalesAdjustmentList({
  accessToken,
  enabled,
  mode,
  search,
  status,
}: {
  accessToken: string
  enabled: boolean
  mode: "sales-return" | "credit-note"
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

function SalesMetric({
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
    <div
      className={cn(
        "min-h-20 rounded-2xl border bg-background p-3",
        tone === "positive" && "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20",
        tone === "blue" && "border-blue-200/70 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/20",
        tone === "warning" && "border-amber-200/70 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-3 h-6 w-24 rounded-md" />
      ) : (
        <p
          className={cn(
            "mt-2 truncate font-mono text-lg font-semibold",
            tone === "positive" && "text-emerald-700 dark:text-emerald-300",
            tone === "blue" && "text-blue-700 dark:text-blue-300",
            tone === "warning" && "text-amber-700 dark:text-amber-300"
          )}
        >
          {value}
        </p>
      )}
    </div>
  )
}

function SalesStatusBadge({ status }: { status: SalesInvoiceStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full truncate px-1.5 py-0 text-[10px]",
        status === "posted" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
        status === "quotation" && "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
        status === "draft" && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
        status === "cancelled" && "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
      )}
    >
      {status === "posted" ? "Posted"
      : status === "quotation" ? "Quotation"
      : status === "draft" ? "Draft"
      : "Cancelled"}
    </Badge>
  )
}

function AdjustmentStatusBadge({ status }: { status: AdjustmentStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full truncate px-1.5 py-0 text-[10px]",
        status === "posted" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
        status === "draft" && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
        status === "reversed" && "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
      )}
    >
      {status === "posted" ? "Posted" : status === "draft" ? "Draft" : "Reversed"}
    </Badge>
  )
}

function SortableSalesHead({
  children,
  sortKey,
  activeSortKey,
  sortDirection,
  align = "left",
  onSort,
}: {
  children: React.ReactNode
  sortKey: SalesSortKey
  activeSortKey: SalesSortKey
  sortDirection: SortDirection
  align?: "left" | "right"
  onSort: (key: SalesSortKey) => void
}) {
  const active = sortKey === activeSortKey
  const Icon = !active ? ArrowDownUpIcon : sortDirection === "asc" ? ArrowUpIcon : ArrowDownIcon

  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-md transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-primary" : "text-foreground",
          align === "right" && "ml-auto justify-end text-right"
        )}
        onClick={() => onSort(sortKey)}
      >
        <span className="truncate">{children}</span>
        <Icon className={cn("size-3 shrink-0", !active && "text-muted-foreground/70")} />
      </button>
    </TableHead>
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
  const active = sortKey === activeSortKey
  const Icon = !active ? ArrowDownUpIcon : sortDirection === "asc" ? ArrowUpIcon : ArrowDownIcon

  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-md transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-primary" : "text-foreground",
          align === "right" && "ml-auto justify-end text-right"
        )}
        onClick={() => onSort(sortKey)}
      >
        <span className="truncate">{children}</span>
        <Icon className={cn("size-3 shrink-0", !active && "text-muted-foreground/70")} />
      </button>
    </TableHead>
  )
}

function SalesEmptyState({
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
    <Empty className="mx-auto max-w-md">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {actionLabel && onAction ? (
        <EmptyContent>
          <Button type="button" className="h-8 bg-blue-600 text-white hover:bg-blue-700" onClick={onAction}>
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
    <div className="flex min-h-10 items-center justify-center border-t border-border px-3 py-2 text-xs text-muted-foreground">
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Spinner className="size-4" />
          Loading more
        </span>
      ) : hasMore ? (
        <span>
          Scroll to load more · Showing {loaded} of {total} {noun}
        </span>
      ) : (
        <span>
          Showing {loaded} of {total} {noun}
        </span>
      )}
    </div>
  )
}

function SalesBillPreview({
  estimated,
  amountPaid,
  warehouseName,
}: {
  estimated: ReturnType<typeof estimateSalesTotal>
  amountPaid: number
  warehouseName: string | null
}) {
  const due = Math.max(estimated.total - amountPaid, 0)

  return (
    <aside className="space-y-3 rounded-2xl border border-blue-200/70 bg-blue-50/50 p-3 text-sm dark:border-blue-900/50 dark:bg-blue-950/20">
      <div className="rounded-xl bg-background p-3 ring-1 ring-border">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Receivable total
        </p>
        <p className="mt-2 truncate font-mono text-2xl font-semibold text-blue-700 dark:text-blue-300">
          {formatTableCurrency(estimated.total)}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Tax, receivable and stock entries are prepared when this bill is posted.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PreviewStat label="Taxable" value={formatTableCurrency(estimated.taxable)} />
        <PreviewStat label="Output GST" value={formatTableCurrency(estimated.tax)} />
        <PreviewStat label="Received" value={formatTableCurrency(amountPaid)} tone="positive" />
        <PreviewStat label="Due" value={formatTableCurrency(due)} tone={due > 0 ? "warning" : "positive"} />
      </div>
      <div className="rounded-xl bg-background p-3 text-xs text-muted-foreground ring-1 ring-border">
        <p className="font-medium text-foreground">Stock source</p>
        <p className="mt-1">{warehouseName ?? "Default warehouse will be resolved by backend."}</p>
      </div>
    </aside>
  )
}

function PreviewStat({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "positive" | "warning"
}) {
  return (
    <div className="rounded-xl bg-background p-3 ring-1 ring-border">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate font-mono font-semibold",
          tone === "positive" && "text-emerald-700 dark:text-emerald-300",
          tone === "warning" && "text-amber-700 dark:text-amber-300"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function TextField({
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
      <Input
        className="h-8"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

function AmountInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative">
      <IndianRupeeIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-8 pl-8 text-right font-mono"
        inputMode="decimal"
        value={value}
        placeholder="0.00"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function SalesDatePicker({
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
          <span className="truncate">{value ? formatDate(value) : "Choose date"}</span>
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

function MoneyTableCell({ value }: { value: string | number }) {
  return <TableCell className="text-right font-mono">{formatTableCurrency(value)}</TableCell>
}

function updateLine<K extends keyof SalesFormLine>(
  lineId: string,
  key: K,
  value: SalesFormLine[K],
  setForm: React.Dispatch<React.SetStateAction<SalesBillFormState>>
) {
  setForm((current) => ({
    ...current,
    lines: current.lines.map((line) =>
      line.localId === lineId ? { ...line, [key]: value } : line
    ),
  }))
}

function setFormValue<K extends keyof SalesBillFormState>(
  key: K,
  value: SalesBillFormState[K],
  setForm: React.Dispatch<React.SetStateAction<SalesBillFormState>>
) {
  setForm((current) => ({ ...current, [key]: value }))
}

function estimateSalesTotal(lines: SalesFormLine[], isIntraState: boolean) {
  return lines.reduce(
    (total, line) => {
      const estimated = estimateLine(line, isIntraState)

      return {
        taxable: total.taxable + estimated.taxable,
        cgst: total.cgst + estimated.cgst,
        sgst: total.sgst + estimated.sgst,
        igst: total.igst + estimated.igst,
        tax: total.tax + estimated.tax,
        total: total.total + estimated.total,
      }
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, total: 0 }
  )
}

function estimateLine(line: SalesFormLine, isIntraState: boolean) {
  const quantity = Number(line.quantity || 0)
  const rate = Number(line.rate || 0)
  const discount = Number(line.discountAmount || 0)
  const gstRate = Number(line.gstRate || 0)
  const gross = Math.max(quantity * rate - discount, 0)
  const taxable =
    line.pricingMode === "tax_inclusive" && gstRate > 0 ?
      gross / (1 + gstRate / 100)
    : gross
  const tax = line.taxability === "TAXABLE" ? Math.max(gross - taxable, taxable * gstRate / 100) : 0
  const total = line.pricingMode === "tax_inclusive" ? gross : taxable + tax

  return {
    taxable,
    tax,
    cgst: isIntraState ? tax / 2 : 0,
    sgst: isIntraState ? tax / 2 : 0,
    igst: isIntraState ? 0 : tax,
    total,
  }
}

function summarizeSales(invoices: SalesInvoice[]) {
  return invoices.reduce(
    (summary, invoice) => {
      if (invoice.status === "draft" || invoice.status === "quotation") {
        summary.drafts += 1
      }

      if (invoice.status === "posted") {
        summary.postedValue += Number(invoice.totalAmount || 0)
        summary.outputGst +=
          Number(invoice.cgstAmount || 0) +
          Number(invoice.sgstAmount || 0) +
          Number(invoice.igstAmount || 0)
        summary.due += Number(invoice.amountDue || 0)
      }

      return summary
    },
    { postedValue: 0, outputGst: 0, due: 0, drafts: 0 }
  )
}

function sortSalesInvoices(
  invoices: SalesInvoice[],
  sortKey: SalesSortKey,
  sortDirection: SortDirection
) {
  return invoices.slice().sort((first, second) => {
    const multiplier = sortDirection === "asc" ? 1 : -1
    const firstValue = getSalesSortValue(first, sortKey)
    const secondValue = getSalesSortValue(second, sortKey)

    if (typeof firstValue === "number" && typeof secondValue === "number") {
      return (firstValue - secondValue) * multiplier
    }

    return String(firstValue).localeCompare(String(secondValue)) * multiplier
  })
}

function getSalesSortValue(invoice: SalesInvoice, sortKey: SalesSortKey) {
  if (
    sortKey === "taxableValue" ||
    sortKey === "cgstAmount" ||
    sortKey === "sgstAmount" ||
    sortKey === "igstAmount" ||
    sortKey === "amountDue" ||
    sortKey === "totalAmount"
  ) {
    return Number(invoice[sortKey] || 0)
  }

  return invoice[sortKey]
}

function sortAdjustments(
  documents: AdjustmentListRow[],
  sortKey: AdjustmentSortKey,
  sortDirection: SortDirection
) {
  return documents.slice().sort((first, second) => {
    const multiplier = sortDirection === "asc" ? 1 : -1
    const firstValue = getAdjustmentSortValue(first, sortKey)
    const secondValue = getAdjustmentSortValue(second, sortKey)

    if (typeof firstValue === "number" && typeof secondValue === "number") {
      return (firstValue - secondValue) * multiplier
    }

    return String(firstValue).localeCompare(String(secondValue)) * multiplier
  })
}

function getAdjustmentSortValue(document: AdjustmentListRow, sortKey: AdjustmentSortKey) {
  if (
    sortKey === "taxableTotal" ||
    sortKey === "cgstTotal" ||
    sortKey === "sgstTotal" ||
    sortKey === "igstTotal" ||
    sortKey === "grandTotal"
  ) {
    return Number(document[sortKey] || 0)
  }

  return document[sortKey]
}

async function invalidateSalesWorkspace(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["sales"] }),
    queryClient.invalidateQueries({ queryKey: ["adjustments"] }),
    queryClient.invalidateQueries({ queryKey: ["accounting"] }),
    queryClient.invalidateQueries({ queryKey: ["inventory"] }),
    queryClient.invalidateQueries({ queryKey: ["e-invoice"] }),
  ])
}

function getPartyName(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object") {
    return "Customer"
  }

  const record = snapshot as Record<string, unknown>
  const value =
    record.displayName ?? record.tradeName ?? record.legalName ?? record.name ?? record.partyName

  return typeof value === "string" && value.trim() ? value : "Customer"
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

function formatPercent(value: string | number) {
  return `${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}%`
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}
