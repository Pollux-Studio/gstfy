"use client"

import * as React from "react"
import Link from "next/link"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowDownIcon,
  ArrowDownLeftIcon,
  ArrowDownUpIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  BadgeIndianRupeeIcon,
  BanIcon,
  CalendarIcon,
  CreditCardIcon,
  DownloadIcon,
  EyeIcon,
  LandmarkIcon,
  MoreHorizontalIcon,
  PlusIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { listLedgerAccounts } from "@/lib/accounting/api"
import { getStoredAuthSession } from "@/lib/auth/session"
import { listParties, type PartyRole } from "@/lib/parties/api"
import {
  createPayment,
  createReceipt,
  deletePayment,
  deleteReceipt,
  exportPayables,
  exportPayments,
  exportReceipts,
  exportReceivables,
  listPayables,
  listPayments,
  listReceipts,
  listReceivables,
  postPayment,
  postReceipt,
  reversePayment,
  reverseReceipt,
  type MoneyAllocationPayload,
  type CsvExportResponse,
  type MoneyDocument,
  type PaymentMethod,
  type ReceivablePayableEntry,
  type UnallocatedTreatment,
} from "@/lib/payment-receipt/api"
import { cn } from "@/lib/utils"

type MoneyMode = "receipt" | "payment"
type OutstandingMode = "receivable" | "payable"
type MoneyDocumentSortKey =
  | "number"
  | "party"
  | "date"
  | "method"
  | "amount"
  | "unallocated"
  | "status"
type OutstandingSortKey =
  | "party"
  | "voucher"
  | "date"
  | "original"
  | "settled"
  | "outstanding"
  | "status"
type SortDirection = "asc" | "desc"

type MoneyFormState = {
  partyId: string
  cashBankAccountId: string
  documentDate: string
  paymentMethod: PaymentMethod
  amount: string
  unallocatedTreatment: UnallocatedTreatment
  referenceNumber: string
  notes: string
  allocations: Record<string, string>
}

const tablePageSize = 15
const defaultDate = () => new Date().toISOString().slice(0, 10)

const paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank transfer" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
]

const unallocatedTreatmentOptions: Array<{
  value: UnallocatedTreatment
  label: string
  description: string
}> = [
    {
      value: "advance",
      label: "Record as advance",
      description: "Use when this is known advance money from the party.",
    },
    {
      value: "unallocated",
      label: "Keep unapplied",
      description: "Use when the remittance is not yet identified or confirmed.",
    },
  ]

const statusOptions = [
  { value: "all", label: "All status" },
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "reversed", label: "Reversed" },
] as const

const outstandingStatusOptions = [
  { value: "all", label: "All status" },
  { value: "open", label: "Open" },
  { value: "partially_settled", label: "Part settled" },
  { value: "settled", label: "Settled" },
] as const
const moneyDocumentTableClass =
  "w-full table-fixed text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-2"
const outstandingTableClass =
  "w-full table-fixed text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-2"
const stickyTableHeadClass =
  "sticky top-0 z-20 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80"

export function MoneyDocumentsPage({ mode }: { mode: MoneyMode }) {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<(typeof statusOptions)[number]["value"]>("all")
  const [paymentMethod, setPaymentMethod] = React.useState<"all" | PaymentMethod>("all")
  const [sortKey, setSortKey] = React.useState<MoneyDocumentSortKey>("date")
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc")
  const [createOpen, setCreateOpen] = React.useState(false)
  const [reversingDocument, setReversingDocument] = React.useState<MoneyDocument | null>(null)
  const [deletingDocument, setDeletingDocument] = React.useState<MoneyDocument | null>(null)
  const [reverseReason, setReverseReason] = React.useState("")

  const documentsQuery = useInfiniteQuery({
    queryKey: ["money", mode, search, status, paymentMethod],
    queryFn: async ({ pageParam }) => {
      if (mode === "receipt") {
        const response = await listReceipts(accessToken, {
          search,
          status,
          paymentMethod,
          page: pageParam,
          limit: tablePageSize,
        })
        return { documents: response.receipts, pagination: response.pagination }
      }

      const response = await listPayments(accessToken, {
        search,
        status,
        paymentMethod,
        page: pageParam,
        limit: tablePageSize,
      })
      return { documents: response.payments, pagination: response.pagination }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: accessToken.length > 0,
  })

  const documents = React.useMemo(
    () =>
      documentsQuery.data?.pages.flatMap((page) => page.documents) ?? [],
    [documentsQuery.data?.pages]
  )
  const totalCount = documentsQuery.data?.pages[0]?.pagination.total ?? documents.length
  const tableDocuments = documents
  const totals = React.useMemo(() => getDocumentTotals(documents), [documents])
  const sortedDocuments = React.useMemo(() => {
    return [...tableDocuments].sort((first, second) => {
      const direction = sortDirection === "asc" ? 1 : -1

      if (sortKey === "number") {
        return (
          getDocumentNumber(mode, first).localeCompare(
            getDocumentNumber(mode, second),
            undefined,
            { sensitivity: "base" }
          ) * direction
        )
      }

      if (sortKey === "party") {
        return (
          first.partyNameSnapshot.localeCompare(second.partyNameSnapshot, undefined, {
            sensitivity: "base",
          }) * direction
        )
      }

      if (sortKey === "date") {
        return (
          getDocumentDate(mode, first).localeCompare(getDocumentDate(mode, second)) *
          direction
        )
      }

      if (sortKey === "method") {
        return (
          paymentMethodLabel(first.paymentMethod).localeCompare(
            paymentMethodLabel(second.paymentMethod),
            undefined,
            { sensitivity: "base" }
          ) * direction
        )
      }

      if (sortKey === "status") {
        return first.status.localeCompare(second.status) * direction
      }

      const firstValue =
        sortKey === "amount" ? first.amount : first.unallocatedAmount
      const secondValue =
        sortKey === "amount" ? second.amount : second.unallocatedAmount

      return (Number(firstValue) - Number(secondValue)) * direction
    })
  }, [mode, sortDirection, sortKey, tableDocuments])

  const reverseMutation = useMutation({
    mutationFn: async (input: { id: string; reason: string }) => {
      if (mode === "receipt") {
        await reverseReceipt(accessToken, input.id, input.reason)
        return
      }

      await reversePayment(accessToken, input.id, input.reason)
    },
    onSuccess: async () => {
      setReversingDocument(null)
      setReverseReason("")
      toast.success(`${capitalize(mode)} reversed.`)
      await invalidateMoneyQueries(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (mode === "receipt") {
        await deleteReceipt(accessToken, documentId)
        return
      }

      await deletePayment(accessToken, documentId)
    },
    onSuccess: async () => {
      setDeletingDocument(null)
      toast.success(`Draft ${mode} deleted.`)
      await invalidateMoneyQueries(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const exportMutation = useMutation({
    mutationFn: () =>
      mode === "receipt" ?
        exportReceipts(accessToken, { search, status, paymentMethod })
        : exportPayments(accessToken, { search, status, paymentMethod }),
    onSuccess: downloadCsv,
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    if (!documentsQuery.hasNextPage || documentsQuery.isFetchingNextPage) {
      return
    }

    const target = event.currentTarget
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 180) {
      void documentsQuery.fetchNextPage()
    }
  }

  function toggleSort(nextKey: MoneyDocumentSortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setSortKey(nextKey)
    setSortDirection(nextKey === "date" ? "desc" : "asc")
  }

  return (
    <main className="min-w-0 space-y-5 p-4 sm:p-6">
      <Button
        nativeButton={false}
        render={<Link href="/money" />}
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 w-fit gap-1.5 text-muted-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Back to Money overview
      </Button>

      <MoneyHeader
        mode={mode}
        totals={totals}
        loading={documentsQuery.isLoading}
        onCreate={() => setCreateOpen(true)}
      />

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">
              {mode === "receipt" ? "Money in history" : "Money out history"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {mode === "receipt" ?
                "Customer collections, allocations, and pending unapplied amounts."
                : "Supplier payments, allocations, and pending unapplied amounts."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <SearchIcon className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="h-8 w-full pl-8 sm:w-72"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  mode === "receipt" ?
                    "Search receipt or customer"
                    : "Search payment or supplier"
                }
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as typeof status)}
            >
              <SelectTrigger className="h-8 w-full sm:w-36">
                <SelectDisplayValue value={status} options={statusOptions} placeholder="Status" />
              </SelectTrigger>
              <SelectContent align="start">
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as typeof paymentMethod)}
            >
              <SelectTrigger className="h-8 w-full sm:w-40">
                <SelectDisplayValue
                  value={paymentMethod}
                  options={[{ value: "all", label: "All methods" }, ...paymentMethodOptions]}
                  placeholder="Method"
                />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="all">All methods</SelectItem>
                {paymentMethodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
            >
              {exportMutation.isPending ? (
                <Spinner className="size-4" />
              ) : (
                <DownloadIcon className="size-4" />
              )}
              Export
            </Button>
          </div>
        </div>

        {documentsQuery.isLoading ? (
          <MoneyTableSkeleton />
        ) : tableDocuments.length === 0 ? (
          <EmptyMoneyState mode={mode} onCreate={() => setCreateOpen(true)} />
        ) : (
          <>
            <div className="app-scrollbar max-h-[28rem] overflow-auto" onScroll={handleScroll}>
              <table data-slot="table" className={cn("caption-bottom", moneyDocumentTableClass)}>
                <TableHeader>
                  <TableRow>
                    <SortableMoneyHead
                      label="Number"
                      sortKey="number"
                      activeSortKey={sortKey}
                      sortDirection={sortDirection}
                      className="w-[13%]"
                      onSort={toggleSort}
                    />
                    <SortableMoneyHead
                      label={mode === "receipt" ? "Customer" : "Supplier"}
                      sortKey="party"
                      activeSortKey={sortKey}
                      sortDirection={sortDirection}
                      className="w-[22%]"
                      onSort={toggleSort}
                    />
                    <SortableMoneyHead
                      label="Date"
                      sortKey="date"
                      activeSortKey={sortKey}
                      sortDirection={sortDirection}
                      className="w-[11%]"
                      onSort={toggleSort}
                    />
                    <SortableMoneyHead
                      label="Method"
                      sortKey="method"
                      activeSortKey={sortKey}
                      sortDirection={sortDirection}
                      className="w-[12%]"
                      onSort={toggleSort}
                    />
                    <SortableMoneyHead
                      label={mode === "receipt" ? "Received" : "Paid"}
                      sortKey="amount"
                      activeSortKey={sortKey}
                      sortDirection={sortDirection}
                      className="w-[12%] text-right"
                      align="right"
                      onSort={toggleSort}
                    />
                    <SortableMoneyHead
                      label="Unallocated"
                      sortKey="unallocated"
                      activeSortKey={sortKey}
                      sortDirection={sortDirection}
                      className="w-[12%] text-right"
                      align="right"
                      onSort={toggleSort}
                    />
                    <SortableMoneyHead
                      label="Status"
                      sortKey="status"
                      activeSortKey={sortKey}
                      sortDirection={sortDirection}
                      className="w-[9%]"
                      onSort={toggleSort}
                    />
                    <TableHead className={cn(stickyTableHeadClass, "w-[9%] pr-3 text-right")}>
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDocuments.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell className="w-[13%] font-mono text-[11px]">
                        <Link
                          className="underline-offset-4 hover:underline"
                          href={`/${mode === "receipt" ? "receipts" : "payments"}/${document.id}`}
                        >
                          {getDocumentNumber(mode, document)}
                        </Link>
                      </TableCell>
                      <TableCell className="w-[22%]">
                        <div className="truncate font-medium">
                          {document.partyNameSnapshot}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {document.referenceNumber || "No reference"}
                        </div>
                      </TableCell>
                      <TableCell className="w-[11%]">{formatDate(getDocumentDate(mode, document))}</TableCell>
                      <TableCell className="w-[12%]">{paymentMethodLabel(document.paymentMethod)}</TableCell>
                      <AmountCell
                        value={document.amount}
                        className={mode === "receipt" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}
                      />
                      <AmountCell
                        value={document.unallocatedAmount}
                        className={
                          Number(document.unallocatedAmount) > 0 ?
                            "text-amber-700 dark:text-amber-300"
                            : "text-muted-foreground"
                        }
                      />
                      <TableCell className="w-[9%]">
                        <MoneyStatusBadge status={document.status} />
                      </TableCell>
                      <TableCell className="w-[9%] pr-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="ml-auto aria-expanded:bg-muted"
                              />
                            }
                          >
                            <MoreHorizontalIcon className="size-4" />
                            <span className="sr-only">
                              Open {mode} actions for {getDocumentNumber(mode, document)}
                            </span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={8} className="w-40">
                            <DropdownMenuItem
                              render={
                                <Link
                                  href={`/${mode === "receipt" ? "receipts" : "payments"}/${document.id}`}
                                />
                              }
                            >
                              <EyeIcon className="text-muted-foreground" />
                              <span>View</span>
                            </DropdownMenuItem>
                            {document.status === "draft" ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeletingDocument(document)}
                                >
                                  <Trash2Icon className="text-muted-foreground" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </>
                            ) : null}
                            {document.status === "posted" ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setReversingDocument(document)}
                                >
                                  <RotateCcwIcon className="text-muted-foreground" />
                                  <span>Reverse</span>
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
            <ListFooter
              loading={documentsQuery.isFetchingNextPage}
              hasMore={Boolean(documentsQuery.hasNextPage)}
              loaded={tableDocuments.length}
              total={totalCount}
              noun={mode === "receipt" ? "receipts" : "payments"}
            />
          </>
        )}
      </section>

      {createOpen ? (
        <MoneyCreateDialog
          mode={mode}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      ) : null}

      <Dialog open={Boolean(reversingDocument)} onOpenChange={(open) => !open && setReversingDocument(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse {mode}</DialogTitle>
            <DialogDescription>
              This creates a reversing journal and releases active allocations. Use this
              only for correction, not normal edits.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Document</span>
              <span className="font-mono">{reversingDocument ? getDocumentNumber(mode, reversingDocument) : ""}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-mono">{formatCurrency(reversingDocument?.amount ?? "0")}</span>
            </div>
          </div>
          <Field>
            <FieldLabel>Reason</FieldLabel>
            <Textarea
              value={reverseReason}
              onChange={(event) => setReverseReason(event.target.value)}
              placeholder="Wrong amount, duplicate entry, or incorrect party"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReversingDocument(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reverseReason.trim().length < 3 || reverseMutation.isPending || !reversingDocument}
              onClick={() =>
                reversingDocument &&
                reverseMutation.mutate({
                  id: reversingDocument.id,
                  reason: reverseReason.trim(),
                })
              }
            >
              {reverseMutation.isPending ? <Spinner className="size-4" /> : <BanIcon className="size-4" />}
              Reverse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingDocument)} onOpenChange={(open) => !open && setDeletingDocument(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete draft {mode}</DialogTitle>
            <DialogDescription>
              Drafts have not affected accounting yet, so deleting this will only remove
              the draft record. Posted documents must be reversed instead.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Draft</span>
              <span className="font-mono">
                {deletingDocument ? getDocumentNumber(mode, deletingDocument) : ""}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-mono">
                {formatCurrency(deletingDocument?.amount ?? "0")}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingDocument(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending || !deletingDocument}
              onClick={() => deletingDocument && deleteMutation.mutate(deletingDocument.id)}
            >
              {deleteMutation.isPending ? (
                <Spinner className="size-4" />
              ) : (
                <Trash2Icon className="size-4" />
              )}
              Delete draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

export function OutstandingPage({ mode }: { mode: OutstandingMode }) {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const [search, setSearch] = React.useState("")
  const [status, setStatus] =
    React.useState<(typeof outstandingStatusOptions)[number]["value"]>("all")
  const [sortKey, setSortKey] = React.useState<OutstandingSortKey>("date")
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc")
  const [prefill, setPrefill] =
    React.useState<{ partyId: string; entry: ReceivablePayableEntry } | null>(null)

  const entriesQuery = useInfiniteQuery({
    queryKey: ["money", mode, search, status],
    queryFn: ({ pageParam }) =>
      mode === "receivable" ?
        listReceivables(accessToken, {
          search,
          status,
          page: pageParam,
          limit: tablePageSize,
        })
        : listPayables(accessToken, {
          search,
          status,
          page: pageParam,
          limit: tablePageSize,
        }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: accessToken.length > 0,
  })

  const entries = React.useMemo(
    () => entriesQuery.data?.pages.flatMap((page) => page.entries) ?? [],
    [entriesQuery.data?.pages]
  )
  const firstPage = entriesQuery.data?.pages[0]
  const totalCount = firstPage?.pagination.total ?? entries.length
  const sortedEntries = React.useMemo(() => {
    return [...entries].sort((first, second) => {
      const direction = sortDirection === "asc" ? 1 : -1

      if (sortKey === "party") {
        return (
          first.partyNameSnapshot.localeCompare(second.partyNameSnapshot, undefined, {
            sensitivity: "base",
          }) * direction
        )
      }

      if (sortKey === "voucher") {
        return (
          first.voucherNumber.localeCompare(second.voucherNumber, undefined, {
            sensitivity: "base",
          }) * direction
        )
      }

      if (sortKey === "date") {
        return first.voucherDate.localeCompare(second.voucherDate) * direction
      }

      if (sortKey === "status") {
        return first.status.localeCompare(second.status) * direction
      }

      const firstValue =
        sortKey === "original" ? first.originalAmount
          : sortKey === "settled" ? first.settledAmount
            : first.outstandingAmount
      const secondValue =
        sortKey === "original" ? second.originalAmount
          : sortKey === "settled" ? second.settledAmount
            : second.outstandingAmount

      return (Number(firstValue) - Number(secondValue)) * direction
    })
  }, [entries, sortDirection, sortKey])
  const exportMutation = useMutation({
    mutationFn: () =>
      mode === "receivable" ?
        exportReceivables(accessToken, { search, status })
        : exportPayables(accessToken, { search, status }),
    onSuccess: downloadCsv,
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    if (!entriesQuery.hasNextPage || entriesQuery.isFetchingNextPage) {
      return
    }

    const target = event.currentTarget
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 180) {
      void entriesQuery.fetchNextPage()
    }
  }

  function toggleSort(nextKey: OutstandingSortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setSortKey(nextKey)
    setSortDirection(nextKey === "date" || nextKey === "outstanding" ? "desc" : "asc")
  }

  return (
    <main className="min-w-0 space-y-5 p-4 sm:p-6">
      <Button
        nativeButton={false}
        render={<Link href="/money" />}
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 w-fit gap-1.5 text-muted-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Back to Money overview
      </Button>

      <OutstandingHeader
        mode={mode}
        totals={{
          original: firstPage?.totals.original ?? "0",
          settled: firstPage?.totals.settled ?? "0",
          outstanding: firstPage?.totals.outstanding ?? "0",
        }}
        loading={entriesQuery.isLoading}
      />

      <section className="rounded-2xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-medium">
              {mode === "receivable" ? "Receivable entries" : "Payable entries"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Balances are derived from posted vouchers and active allocations.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <SearchIcon className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="h-8 w-full pl-8 sm:w-64"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search party or voucher"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as typeof status)}
            >
              <SelectTrigger className="h-8 w-full sm:w-40">
                <SelectDisplayValue value={status} options={outstandingStatusOptions} placeholder="Status" />
              </SelectTrigger>
              <SelectContent align="start">
                {outstandingStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
            >
              {exportMutation.isPending ? (
                <Spinner className="size-4" />
              ) : (
                <DownloadIcon className="size-4" />
              )}
              Export
            </Button>
          </div>
        </div>

        {entriesQuery.isLoading ? (
          <MoneyTableSkeleton />
        ) : entries.length === 0 ? (
          <EmptyOutstandingState mode={mode} />
        ) : (
          <>
            <div className="app-scrollbar max-h-[28rem] overflow-auto" onScroll={handleScroll}>
              <table data-slot="table" className={cn("caption-bottom", outstandingTableClass)}>
                <TableHeader>
                  <TableRow>
                    <SortableOutstandingHead
                      label="Party"
                      sortKey="party"
                      activeSortKey={sortKey}
                      sortDirection={sortDirection}
                      className="w-[24%]"
                      onSort={toggleSort}
                    />
                    <SortableOutstandingHead
                      label="Voucher"
                      sortKey="voucher"
                      activeSortKey={sortKey}
                      sortDirection={sortDirection}
                      className="w-[15%]"
                      onSort={toggleSort}
                    />
                    <SortableOutstandingHead
                      label="Date"
                      sortKey="date"
                      activeSortKey={sortKey}
                      sortDirection={sortDirection}
                      className="w-[11%]"
                      onSort={toggleSort}
                    />
                    <SortableOutstandingHead
                      label="Original"
                      sortKey="original"
                      activeSortKey={sortKey}
                      sortDirection={sortDirection}
                      className="w-[12%] text-right"
                      align="right"
                      onSort={toggleSort}
                    />
                    <SortableOutstandingHead
                      label="Settled"
                      sortKey="settled"
                      activeSortKey={sortKey}
                      sortDirection={sortDirection}
                      className="w-[12%] text-right"
                      align="right"
                      onSort={toggleSort}
                    />
                    <SortableOutstandingHead
                      label="Outstanding"
                      sortKey="outstanding"
                      activeSortKey={sortKey}
                      sortDirection={sortDirection}
                      className="w-[13%] text-right"
                      align="right"
                      onSort={toggleSort}
                    />
                    <SortableOutstandingHead
                      label="Status"
                      sortKey="status"
                      activeSortKey={sortKey}
                      sortDirection={sortDirection}
                      className="w-[8%]"
                      onSort={toggleSort}
                    />
                    <TableHead className={cn(stickyTableHeadClass, "w-[5%] pr-3 text-right")}>
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="w-[24%]">
                        <div className="truncate font-medium">
                          {entry.partyNameSnapshot}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {mode === "receivable" ? "Customer due" : "Supplier due"}
                        </div>
                      </TableCell>
                      <TableCell className="w-[15%]">
                        <div className="truncate font-mono text-[11px]">{entry.voucherNumber}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{entry.voucherType}</div>
                      </TableCell>
                      <TableCell className="w-[11%]">{formatDate(entry.voucherDate)}</TableCell>
                      <OutstandingAmountCell
                        value={entry.originalAmount}
                        className="w-[12%] text-muted-foreground"
                      />
                      <OutstandingAmountCell
                        value={entry.settledAmount}
                        className={
                          mode === "receivable" ?
                            "w-[12%] text-emerald-700 dark:text-emerald-300"
                            : "w-[12%] text-red-700 dark:text-red-300"
                        }
                      />
                      <OutstandingAmountCell
                        value={entry.outstandingAmount}
                        className={
                          Number(entry.outstandingAmount) > 0 ?
                            "w-[13%] text-amber-700 dark:text-amber-300"
                            : "w-[13%] text-muted-foreground"
                        }
                      />
                      <TableCell className="w-[8%]">
                        <OutstandingStatusBadge status={entry.status} />
                      </TableCell>
                      <TableCell className="w-[5%] pr-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="ml-auto aria-expanded:bg-muted"
                              />
                            }
                          >
                            <MoreHorizontalIcon className="size-4" />
                            <span className="sr-only">
                              Open {mode} action for {entry.voucherNumber}
                            </span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={8} className="w-44">
                            <DropdownMenuItem
                              disabled={!entry.partyId || Number(entry.outstandingAmount) <= 0}
                              onClick={() =>
                                entry.partyId && setPrefill({ partyId: entry.partyId, entry })
                              }
                            >
                              {mode === "receivable" ?
                                <ArrowDownLeftIcon className="text-muted-foreground" />
                                : <ArrowUpRightIcon className="text-muted-foreground" />}
                              <span>{mode === "receivable" ? "Record receipt" : "Record payment"}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
            <ListFooter
              loading={entriesQuery.isFetchingNextPage}
              hasMore={Boolean(entriesQuery.hasNextPage)}
              loaded={entries.length}
              total={totalCount}
              noun={mode === "receivable" ? "receivables" : "payables"}
            />
          </>
        )}
      </section>

      {prefill ? (
        <MoneyCreateDialog
          mode={mode === "receivable" ? "receipt" : "payment"}
          open={Boolean(prefill)}
          onOpenChange={(open) => !open && setPrefill(null)}
          prefill={{
            partyId: prefill.partyId,
            allocationEntryId: prefill.entry.id,
            amount: prefill.entry.outstandingAmount,
          }}
        />
      ) : null}
    </main>
  )
}

function MoneyCreateDialog({
  mode,
  open,
  onOpenChange,
  prefill,
}: {
  mode: MoneyMode
  open: boolean
  onOpenChange: (open: boolean) => void
  prefill?: { partyId: string; allocationEntryId: string; amount: string }
}) {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const [form, setForm] = React.useState<MoneyFormState>(() =>
    createInitialForm(prefill)
  )
  const role: PartyRole = mode === "receipt" ? "customer" : "supplier"

  const partiesQuery = useQuery({
    queryKey: ["money", mode, "parties"],
    queryFn: () =>
      listParties(accessToken, {
        role,
        status: "active",
        limit: 100,
      }),
    enabled: open && accessToken.length > 0,
  })
  const accountsQuery = useQuery({
    queryKey: ["money", "cash-bank-accounts"],
    queryFn: () => listLedgerAccounts(accessToken, "", { limit: 100 }),
    enabled: open && accessToken.length > 0,
  })
  const outstandingQuery = useQuery({
    queryKey: ["money", mode, "outstanding", form.partyId],
    queryFn: () =>
      mode === "receipt" ?
        listReceivables(accessToken, {
          partyId: form.partyId,
          status: "all",
          limit: 50,
        })
        : listPayables(accessToken, {
          partyId: form.partyId,
          status: "all",
          limit: 50,
        }),
    enabled: open && accessToken.length > 0 && form.partyId.length > 0,
  })

  const parties = partiesQuery.data?.parties ?? []
  const cashBankAccounts =
    accountsQuery.data?.accounts.filter(
      (account) =>
        account.status === "active" &&
        account.allowPosting &&
        ["CASH", "BANK"].includes(account.accountGroup)
    ) ?? []
  const outstandingEntries =
    outstandingQuery.data?.entries.filter((entry) => Number(entry.outstandingAmount) > 0) ?? []
  const selectedAllocations = buildAllocations(form.allocations)
  const allocatedAmount = selectedAllocations.reduce(
    (total, allocation) => total + Number(allocation.allocatedAmount || 0),
    0
  )
  const canSubmit =
    form.partyId &&
    form.cashBankAccountId &&
    form.documentDate &&
    Number(form.amount) > 0 &&
    allocatedAmount <= Number(form.amount)

  const createAndPostMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        partyId: form.partyId,
        cashBankAccountId: form.cashBankAccountId,
        documentDate: form.documentDate,
        paymentMethod: form.paymentMethod,
        amount: form.amount,
        unallocatedTreatment: form.unallocatedTreatment,
        referenceNumber: form.referenceNumber || null,
        notes: form.notes || null,
      }
      const created =
        mode === "receipt" ?
          await createReceipt(accessToken, payload)
          : await createPayment(accessToken, payload)
      const documentId =
        "receipt" in created ? created.receipt.id : created.payment.id

      if (mode === "receipt") {
        await postReceipt(accessToken, documentId, selectedAllocations)
        return
      }

      await postPayment(accessToken, documentId, selectedAllocations)
    },
    onSuccess: async () => {
      onOpenChange(false)
      toast.success(`${capitalize(mode)} posted.`)
      await invalidateMoneyQueries(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function updateForm<K extends keyof MoneyFormState>(
    key: K,
    value: MoneyFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateAllocation(entryId: string, value: string) {
    setForm((current) => ({
      ...current,
      allocations: {
        ...current.allocations,
        [entryId]: value,
      },
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "receipt" ? "Record receipt" : "Record payment"}</DialogTitle>
          <DialogDescription>
            Create the money document, post the accounting voucher, and optionally
            settle open {mode === "receipt" ? "receivables" : "payables"} in one step.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel>{mode === "receipt" ? "Customer" : "Supplier"}</FieldLabel>
            <Select
              value={form.partyId}
              onValueChange={(value) => updateForm("partyId", value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectDisplayValue
                  value={form.partyId}
                  options={parties.map((party) => ({ value: party.id, label: party.displayName }))}
                  placeholder={`Choose ${mode === "receipt" ? "customer" : "supplier"}`}
                />
              </SelectTrigger>
              <SelectContent align="start">
                {parties.map((party) => (
                  <SelectItem key={party.id} value={party.id}>
                    {party.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Cash / bank account</FieldLabel>
            <Select
              value={form.cashBankAccountId}
              onValueChange={(value) => updateForm("cashBankAccountId", value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectDisplayValue
                  value={form.cashBankAccountId}
                  options={cashBankAccounts.map((account) => ({
                    value: account.id,
                    label: `${account.accountCode} · ${account.accountName}`,
                  }))}
                  placeholder="Choose cash or bank"
                />
              </SelectTrigger>
              <SelectContent align="start">
                {cashBankAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.accountCode} · {account.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <MoneyDatePicker
            label={mode === "receipt" ? "Receipt date" : "Payment date"}
            value={form.documentDate}
            onChange={(value) => updateForm("documentDate", value)}
          />

          <Field>
            <FieldLabel>Method</FieldLabel>
            <Select
              value={form.paymentMethod}
              onValueChange={(value) => updateForm("paymentMethod", value as PaymentMethod)}
            >
              <SelectTrigger className="w-full">
                <SelectDisplayValue value={form.paymentMethod} options={paymentMethodOptions} placeholder="Method" />
              </SelectTrigger>
              <SelectContent align="start">
                {paymentMethodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Amount</FieldLabel>
            <Input
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => updateForm("amount", sanitizeMoney(event.target.value))}
              placeholder="0.00"
            />
          </Field>

          <Field>
            <FieldLabel>Unallocated money</FieldLabel>
            <Select
              value={form.unallocatedTreatment}
              onValueChange={(value) =>
                updateForm("unallocatedTreatment", value as UnallocatedTreatment)
              }
            >
              <SelectTrigger className="w-full">
                <SelectDisplayValue
                  value={form.unallocatedTreatment}
                  options={unallocatedTreatmentOptions}
                  placeholder="Choose treatment"
                />
              </SelectTrigger>
              <SelectContent align="start">
                {unallocatedTreatmentOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Reference</FieldLabel>
            <Input
              value={form.referenceNumber}
              onChange={(event) => updateForm("referenceNumber", event.target.value)}
              placeholder="UPI ref / cheque no."
            />
          </Field>
        </div>

        <Field>
          <FieldLabel>Notes</FieldLabel>
          <Textarea
            value={form.notes}
            onChange={(event) => updateForm("notes", event.target.value)}
            placeholder="Internal remarks"
          />
        </Field>

        <div className="rounded-2xl border">
          <div className="flex items-center justify-between gap-3 border-b p-3">
            <div>
              <p className="text-sm font-medium">Allocation</p>
              <p className="text-xs text-muted-foreground">
                Remaining amount follows the selected unallocated-money treatment.
              </p>
            </div>
            <Badge variant="outline">{formatCurrency(allocatedAmount)} allocated</Badge>
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {!form.partyId ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Choose a party to see open entries.
              </div>
            ) : outstandingQuery.isLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
              </div>
            ) : outstandingEntries.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No open entries for this party.
              </div>
            ) : (
              <div className="space-y-2">
                {outstandingEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid gap-2 rounded-xl border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_8rem]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.voucherNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        Outstanding {formatCurrency(entry.outstandingAmount)} · {formatDate(entry.voucherDate)}
                      </p>
                    </div>
                    <Input
                      inputMode="decimal"
                      value={form.allocations[entry.id] ?? ""}
                      onChange={(event) =>
                        updateAllocation(entry.id, sanitizeMoney(event.target.value))
                      }
                      placeholder="0.00"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit || createAndPostMutation.isPending}
            onClick={() => createAndPostMutation.mutate()}
          >
            {createAndPostMutation.isPending ? <Spinner className="size-4" /> : null}
            {mode === "receipt" ? "Record receipt" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MoneyDatePicker({
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

function MoneyHeader({
  mode,
  totals,
  loading,
  onCreate,
}: {
  mode: MoneyMode
  totals: { amount: number; allocated: number; unallocated: number }
  loading: boolean
  onCreate: () => void
}) {
  const isReceipt = mode === "receipt"

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 bg-background">
              {isReceipt ?
                <ArrowDownLeftIcon className="size-3.5" />
                : <ArrowUpRightIcon className="size-3.5" />}
              {isReceipt ? "Money in" : "Money out"}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5",
                isReceipt ?
                  "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              )}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {isReceipt ? "Customer collections" : "Supplier payments"}
            </Badge>
          </div>
          <div className="mt-3 max-w-2xl space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {isReceipt ? "Money in" : "Money out"}
            </h1>
            <p className="max-w-xl text-sm leading-5 text-muted-foreground">
              {isReceipt ?
                "Track customer payments received against sales invoices and keep unapplied money visible."
                : "Track supplier payments made against purchase bills and keep unapplied money visible."}
            </p>
            <Button
              onClick={onCreate}
              className={cn(
                "mt-3 h-8 w-fit gap-2",
                isReceipt && "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              <PlusIcon className="size-4" />
              {isReceipt ? "New receipt" : "New payment"}
            </Button>
          </div>
        </div>
        <div className="border-t border-border bg-muted/10 p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="grid gap-2">
            <MoneyOverviewMetric
              label={isReceipt ? "Received" : "Paid"}
              value={formatCurrency(totals.amount)}
              loading={loading}
              tone={isReceipt ? "positive" : "danger"}
              icon={<BadgeIndianRupeeIcon className="size-4" />}
            />
            <div className="grid grid-cols-2 gap-2">
              <MoneyOverviewMetric
                label="Allocated"
                value={formatCurrency(totals.allocated)}
                loading={loading}
                tone="info"
                icon={<ReceiptTextIcon className="size-4" />}
                compact
              />
              <MoneyOverviewMetric
                label="Unallocated"
                value={formatCurrency(totals.unallocated)}
                loading={loading}
                tone="warning"
                icon={<LandmarkIcon className="size-4" />}
                compact
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function MoneyOverviewMetric({
  label,
  value,
  loading,
  tone,
  icon,
  compact = false,
}: {
  label: string
  value: string
  loading: boolean
  tone: "positive" | "danger" | "warning" | "info"
  icon: React.ReactNode
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-background p-3",
        tone === "positive" && "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20",
        tone === "danger" && "border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20",
        tone === "warning" && "border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20",
        tone === "info" && "border-blue-200 bg-blue-50/60 dark:border-blue-900/60 dark:bg-blue-950/20"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            "rounded-full border bg-background p-1.5",
            tone === "positive" && "text-emerald-700 dark:text-emerald-300",
            tone === "danger" && "text-red-700 dark:text-red-300",
            tone === "warning" && "text-amber-700 dark:text-amber-300",
            tone === "info" && "text-blue-700 dark:text-blue-300"
          )}
        >
          {icon}
        </span>
      </div>
      {loading ?
        <Skeleton className={cn("mt-2 h-5", compact ? "w-20" : "w-28")} />
        : <p
          className={cn(
            "mt-2 truncate font-mono font-semibold",
            compact ? "text-sm" : "text-lg",
            tone === "positive" && "text-emerald-700 dark:text-emerald-300",
            tone === "danger" && "text-red-700 dark:text-red-300",
            tone === "warning" && "text-amber-700 dark:text-amber-300",
            tone === "info" && "text-blue-700 dark:text-blue-300"
          )}
        >
          {value}
        </p>}
    </div>
  )
}

function OutstandingHeader({
  mode,
  totals,
  loading,
}: {
  mode: OutstandingMode
  totals: { original: string; settled: string; outstanding: string }
  loading: boolean
}) {
  const isReceivable = mode === "receivable"

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 bg-background">
              {isReceivable ?
                <ArrowDownLeftIcon className="size-3.5" />
                : <ArrowUpRightIcon className="size-3.5" />}
              {isReceivable ? "Receivables" : "Payables"}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5",
                isReceivable ?
                  "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              )}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {isReceivable ? "Customer dues" : "Supplier dues"}
            </Badge>
          </div>
          <div className="mt-3 max-w-2xl space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {isReceivable ? "Receivables" : "Payables"}
            </h1>
            <p className="max-w-xl text-sm leading-5 text-muted-foreground">
              {isReceivable ?
                "Track unpaid customer invoices, part payments, and pending collection work."
                : "Track unpaid supplier bills, part payments, and pending payout work."}
            </p>
          </div>
        </div>
        <div className="border-t border-border bg-muted/10 p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="grid gap-2">
            <MoneyOverviewMetric
              label="Original"
              value={formatCurrency(totals.original)}
              loading={loading}
              tone="info"
              icon={<ReceiptTextIcon className="size-4" />}
            />
            <div className="grid grid-cols-2 gap-2">
              <MoneyOverviewMetric
                label="Settled"
                value={formatCurrency(totals.settled)}
                loading={loading}
                tone={isReceivable ? "positive" : "danger"}
                icon={<BadgeIndianRupeeIcon className="size-4" />}
                compact
              />
              <MoneyOverviewMetric
                label="Outstanding"
                value={formatCurrency(totals.outstanding)}
                loading={loading}
                tone="warning"
                icon={<LandmarkIcon className="size-4" />}
                compact
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function MoneyStatusBadge({ status }: { status: MoneyDocument["status"] }) {
  return (
    <Badge
      variant={status === "posted" ? "default" : status === "reversed" ? "destructive" : "outline"}
      className="capitalize"
    >
      {status}
    </Badge>
  )
}

function OutstandingStatusBadge({ status }: { status: string }) {
  const statusClassName =
    status === "open" ?
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
      : status === "partially_settled" ?
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
        : status === "settled" ?
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
          : status === "cancelled" ?
            "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            : "border-border bg-muted/40 text-muted-foreground"

  return (
    <Badge variant="outline" className={cn("capitalize", statusClassName)}>
      {status.replaceAll("_", " ")}
    </Badge>
  )
}

function EmptyMoneyState({ mode, onCreate }: { mode: MoneyMode; onCreate: () => void }) {
  const isReceipt = mode === "receipt"

  return (
    <Empty className="min-h-[22rem] border-0 p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="text-muted-foreground">
          <CreditCardIcon className="size-4" />
        </EmptyMedia>
        <EmptyTitle>No {isReceipt ? "receipts" : "payments"} yet</EmptyTitle>
        <EmptyDescription>
          {isReceipt ?
            "Record customer money received and allocate it to open invoices, advances, or unapplied receipts."
            : "Record supplier money paid and allocate it to open bills, advances, or unapplied payments."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onCreate} className={isReceipt ? "bg-blue-600 text-white hover:bg-blue-700" : undefined}>
          <PlusIcon className="size-4" />
          {isReceipt ? "Record receipt" : "Record payment"}
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function EmptyOutstandingState({ mode }: { mode: OutstandingMode }) {
  const isReceivable = mode === "receivable"

  return (
    <Empty className="min-h-[22rem] border-0 p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="text-muted-foreground">
          <LandmarkIcon className="size-4" />
        </EmptyMedia>
        <EmptyTitle>No {isReceivable ? "receivables" : "payables"} found</EmptyTitle>
        <EmptyDescription>
          {isReceivable ?
            "Receivables appear automatically when posted sales invoices still have customer dues."
            : "Payables appear automatically when posted purchase bills still have supplier dues."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function MoneyTableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 7 }).map((_, index) => (
        <Skeleton key={index} className="h-10 rounded-lg" />
      ))}
    </div>
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
    <div className="flex justify-center border-t px-4 py-3 text-xs text-muted-foreground">
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Spinner className="size-3.5" />
          Loading more
        </span>
      ) : hasMore ? (
        <span>Scroll to load more</span>
      ) : (
        <span>
          Showing {loaded} of {total} {noun}
        </span>
      )}
    </div>
  )
}

function SortableOutstandingHead({
  label,
  sortKey,
  activeSortKey,
  sortDirection,
  align = "left",
  className,
  onSort,
}: {
  label: string
  sortKey: OutstandingSortKey
  activeSortKey: OutstandingSortKey
  sortDirection: SortDirection
  align?: "left" | "right"
  className?: string
  onSort: (sortKey: OutstandingSortKey) => void
}) {
  const isActive = sortKey === activeSortKey
  const Icon =
    isActive ? (sortDirection === "asc" ? ArrowUpIcon : ArrowDownIcon) : ArrowDownUpIcon

  return (
    <TableHead className={cn(stickyTableHeadClass, className)}>
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

function SortableMoneyHead({
  label,
  sortKey,
  activeSortKey,
  sortDirection,
  align = "left",
  className,
  onSort,
}: {
  label: string
  sortKey: MoneyDocumentSortKey
  activeSortKey: MoneyDocumentSortKey
  sortDirection: SortDirection
  align?: "left" | "right"
  className?: string
  onSort: (sortKey: MoneyDocumentSortKey) => void
}) {
  const isActive = sortKey === activeSortKey
  const Icon =
    isActive ? (sortDirection === "asc" ? ArrowUpIcon : ArrowDownIcon) : ArrowDownUpIcon

  return (
    <TableHead className={cn(stickyTableHeadClass, className)}>
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

function AmountCell({ value, className }: { value: string; className?: string }) {
  return (
    <TableCell className={cn("w-[12%] text-right font-mono tabular-nums", className)}>
      {formatCurrency(value)}
    </TableCell>
  )
}

function OutstandingAmountCell({ value, className }: { value: string; className?: string }) {
  return (
    <TableCell className={cn("text-right font-mono tabular-nums", className)}>
      {formatCurrency(value)}
    </TableCell>
  )
}

function createEmptyForm(): MoneyFormState {
  return {
    partyId: "",
    cashBankAccountId: "",
    documentDate: defaultDate(),
    paymentMethod: "cash",
    amount: "",
    unallocatedTreatment: "advance",
    referenceNumber: "",
    notes: "",
    allocations: {},
  }
}

function createInitialForm(
  prefill?: { partyId: string; allocationEntryId: string; amount: string }
): MoneyFormState {
  const form = createEmptyForm()

  if (!prefill) {
    return form
  }

  return {
    ...form,
    partyId: prefill.partyId,
    amount: prefill.amount,
    allocations: {
      [prefill.allocationEntryId]: prefill.amount,
    },
  }
}

function buildAllocations(values: Record<string, string>): MoneyAllocationPayload[] {
  return Object.entries(values)
    .map(([receivablePayableEntryId, allocatedAmount]) => ({
      receivablePayableEntryId,
      allocatedAmount,
    }))
    .filter((allocation) => Number(allocation.allocatedAmount) > 0)
}

function getDocumentTotals(documents: MoneyDocument[]) {
  return documents.reduce(
    (current, document) => ({
      amount: current.amount + Number(document.amount),
      allocated: current.allocated + Number(document.allocatedAmount),
      unallocated: current.unallocated + Number(document.unallocatedAmount),
    }),
    { amount: 0, allocated: 0, unallocated: 0 }
  )
}

function getDocumentNumber(mode: MoneyMode, document: MoneyDocument) {
  return mode === "receipt" ? document.receiptNumber ?? "" : document.paymentNumber ?? ""
}

function getDocumentDate(mode: MoneyMode, document: MoneyDocument) {
  return mode === "receipt" ? document.receiptDate ?? "" : document.paymentDate ?? ""
}

function paymentMethodLabel(method: PaymentMethod) {
  return paymentMethodOptions.find((option) => option.value === method)?.label ?? method
}

async function invalidateMoneyQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["money"] }),
    queryClient.invalidateQueries({ queryKey: ["parties"] }),
    queryClient.invalidateQueries({ queryKey: ["accounting"] }),
  ])
}

function sanitizeMoney(value: string) {
  return value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
}

function formatCurrency(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value || 0)

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-")

  if (!year || !month || !day) {
    return value
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1, Number(day)))
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

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong. Please try again."
}

function downloadCsv(file: CsvExportResponse) {
  const blob = new Blob([file.content], { type: file.contentType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = url
  anchor.download = file.fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
