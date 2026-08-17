"use client"

import * as React from "react"
import Link from "next/link"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BadgeIndianRupeeIcon,
  BanIcon,
  CalendarIcon,
  CreditCardIcon,
  DownloadIcon,
  LandmarkIcon,
  PlusIcon,
  ReceiptTextIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

type MoneyMode = "receipt" | "payment"
type OutstandingMode = "receivable" | "payable"

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

export function MoneyDocumentsPage({ mode }: { mode: MoneyMode }) {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<(typeof statusOptions)[number]["value"]>("all")
  const [paymentMethod, setPaymentMethod] = React.useState<"all" | PaymentMethod>("all")
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
  const totals = React.useMemo(() => getDocumentTotals(documents), [documents])

  const reverseMutation = useMutation({
    mutationFn: async (input: { id: string; reason: string }) => {
      if (mode === "receipt") {
        await reverseReceipt(accessToken, input.id, input.reason)
        return
      }

      await reversePayment(accessToken, input.id, input.reason)
    },
    onSuccess: async () => {
      toast.success(`${capitalize(mode)} reversed.`)
      setReversingDocument(null)
      setReverseReason("")
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
      toast.success(`Draft ${mode} deleted.`)
      setDeletingDocument(null)
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

  return (
    <main className="min-w-0 space-y-5 p-4 sm:p-6">
      <MoneyHeader mode={mode} onCreate={() => setCreateOpen(true)} />

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label={mode === "receipt" ? "Received" : "Paid"}
          value={formatCurrency(totals.amount)}
          icon={<BadgeIndianRupeeIcon className="size-4" />}
        />
        <MetricCard
          label="Allocated"
          value={formatCurrency(totals.allocated)}
          icon={<ReceiptTextIcon className="size-4" />}
        />
        <MetricCard
          label="Unallocated"
          value={formatCurrency(totals.unallocated)}
          icon={<LandmarkIcon className="size-4" />}
        />
      </section>

      <section className="rounded-2xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-medium">
              {mode === "receipt" ? "Receipt register" : "Payment register"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Drafts can be edited. Posted entries affect accounting and allocations.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <SearchIcon className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="h-8 w-full pl-8 sm:w-64"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search number or party"
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
        ) : documents.length === 0 ? (
          <EmptyMoneyState mode={mode} onCreate={() => setCreateOpen(true)} />
        ) : (
          <>
            <div className="app-scrollbar max-h-[35rem] overflow-auto" onScroll={handleScroll}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Unallocated</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell className="font-mono text-xs">
                        <Link
                          className="underline-offset-4 hover:underline"
                          href={`/${mode === "receipt" ? "receipts" : "payments"}/${document.id}`}
                        >
                          {getDocumentNumber(mode, document)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[220px] truncate font-medium">
                          {document.partyNameSnapshot}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {document.referenceNumber || "No reference"}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(getDocumentDate(mode, document))}</TableCell>
                      <TableCell>{paymentMethodLabel(document.paymentMethod)}</TableCell>
                      <AmountCell value={document.amount} />
                      <AmountCell value={document.unallocatedAmount} />
                      <TableCell>
                        <MoneyStatusBadge status={document.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            className="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted"
                            href={`/${mode === "receipt" ? "receipts" : "payments"}/${document.id}`}
                          >
                            View
                          </Link>
                          {document.status === "draft" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeletingDocument(document)}
                            >
                              Delete
                            </Button>
                          ) : document.status === "posted" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setReversingDocument(document)}
                            >
                              Reverse
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ListFooter
              loading={documentsQuery.isFetchingNextPage}
              hasMore={Boolean(documentsQuery.hasNextPage)}
              loaded={documents.length}
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

  const entries = entriesQuery.data?.pages.flatMap((page) => page.entries) ?? []
  const firstPage = entriesQuery.data?.pages[0]
  const totalCount = firstPage?.pagination.total ?? entries.length
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

  return (
    <main className="min-w-0 space-y-5 p-4 sm:p-6">
      <OutstandingHeader mode={mode} />

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Original"
          value={formatCurrency(firstPage?.totals.original ?? "0")}
          icon={<ReceiptTextIcon className="size-4" />}
        />
        <MetricCard
          label="Settled"
          value={formatCurrency(firstPage?.totals.settled ?? "0")}
          icon={<BadgeIndianRupeeIcon className="size-4" />}
        />
        <MetricCard
          label="Outstanding"
          value={formatCurrency(firstPage?.totals.outstanding ?? "0")}
          icon={<LandmarkIcon className="size-4" />}
        />
      </section>

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
          <div className="p-10 text-center text-sm text-muted-foreground">
            No {mode === "receivable" ? "receivables" : "payables"} found.
          </div>
        ) : (
          <>
            <div className="app-scrollbar max-h-[35rem] overflow-auto" onScroll={handleScroll}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Party</TableHead>
                    <TableHead>Voucher</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Original</TableHead>
                    <TableHead className="text-right">Settled</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="max-w-[240px] truncate font-medium">
                          {entry.partyNameSnapshot}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs">{entry.voucherNumber}</div>
                        <div className="text-xs text-muted-foreground">{entry.voucherType}</div>
                      </TableCell>
                      <TableCell>{formatDate(entry.voucherDate)}</TableCell>
                      <AmountCell value={entry.originalAmount} />
                      <AmountCell value={entry.settledAmount} />
                      <AmountCell value={entry.outstandingAmount} />
                      <TableCell>
                        <OutstandingStatusBadge status={entry.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={!entry.partyId || Number(entry.outstandingAmount) <= 0}
                          onClick={() =>
                            entry.partyId && setPrefill({ partyId: entry.partyId, entry })
                          }
                        >
                          {mode === "receivable" ? "Receive" : "Pay"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
      toast.success(`${capitalize(mode)} posted.`)
      onOpenChange(false)
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

          <Field>
            <FieldLabel>Date</FieldLabel>
            <Input
              type="date"
              value={form.documentDate}
              onChange={(event) => updateForm("documentDate", event.target.value)}
            />
          </Field>

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
            Create & post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MoneyHeader({ mode, onCreate }: { mode: MoneyMode; onCreate: () => void }) {
  const isReceipt = mode === "receipt"

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="gap-1.5">
            {isReceipt ? <ArrowDownLeftIcon className="size-3.5" /> : <ArrowUpRightIcon className="size-3.5" />}
            {isReceipt ? "Customer money in" : "Supplier money out"}
          </Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isReceipt ? "Receipts" : "Payments"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isReceipt ?
                "Record money received and settle customer invoices."
              : "Record money paid and settle supplier bills."}
            </p>
          </div>
        </div>
        <Button onClick={onCreate}>
          <PlusIcon className="size-4" />
          {isReceipt ? "New receipt" : "New payment"}
        </Button>
      </div>
    </section>
  )
}

function OutstandingHeader({ mode }: { mode: OutstandingMode }) {
  const isReceivable = mode === "receivable"

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="space-y-2">
        <Badge variant="outline" className="gap-1.5">
          <CalendarIcon className="size-3.5" />
          {isReceivable ? "Customer collection queue" : "Supplier payment queue"}
        </Badge>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isReceivable ? "Receivables" : "Payables"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isReceivable ?
              "Track open customer balances created by posted sales."
            : "Track open supplier balances created by posted purchases."}
          </p>
        </div>
      </div>
    </section>
  )
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="rounded-full bg-muted p-2 text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold">{value}</p>
    </div>
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
  const isOpen = status === "open" || status === "partially_settled"

  return (
    <Badge variant={isOpen ? "outline" : "default"} className="capitalize">
      {status.replaceAll("_", " ")}
    </Badge>
  )
}

function EmptyMoneyState({ mode, onCreate }: { mode: MoneyMode; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <CreditCardIcon className="size-5" />
      </div>
      <div>
        <p className="font-medium">No {mode === "receipt" ? "receipts" : "payments"} yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create one when money actually moves. Allocation can happen during posting.
        </p>
      </div>
      <Button onClick={onCreate}>
        <PlusIcon className="size-4" />
        Create {mode}
      </Button>
    </div>
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

function AmountCell({ value }: { value: string }) {
  return <TableCell className="text-right font-mono tabular-nums">{formatCurrency(value)}</TableCell>
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
