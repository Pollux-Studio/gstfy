"use client"

import * as React from "react"
import Link from "next/link"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BanIcon,
  DownloadIcon,
  FileMinus2Icon,
  FilePlus2Icon,
  PackageCheckIcon,
  PlusIcon,
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
import {
  createAdjustment,
  deleteAdjustment,
  exportAdjustments,
  getPurchaseBillReturnable,
  getSalesInvoiceReturnable,
  listAdjustments,
  postAdjustment,
  reverseAdjustment,
  type AdjustmentListRow,
  type AdjustmentMode,
  type AdjustmentStatus,
  type ReturnableSource,
} from "@/lib/adjustments/api"
import { getStoredAuthSession } from "@/lib/auth/session"
import { listPurchaseBills } from "@/lib/purchases/api"
import { listSalesInvoices } from "@/lib/sales/api"

type AdjustmentPageConfig = {
  mode: AdjustmentMode
  title: string
  description: string
  noun: string
  icon: React.ComponentType<{ className?: string }>
  sourceLabel: string
  sourceSearchPlaceholder: string
  sourceDocumentKind: "sales" | "purchase"
  valueInput: "quantity" | "amount"
  defaultContext: "goods_related" | "value_only" | "tax_adjustment"
}

const pageConfigs: Record<AdjustmentMode, AdjustmentPageConfig> = {
  "sales-return": {
    mode: "sales-return",
    title: "Sales Returns",
    description: "Record customer returns against posted sales invoices without editing the original invoice.",
    noun: "sales returns",
    icon: ArrowDownLeftIcon,
    sourceLabel: "Posted sales invoice",
    sourceSearchPlaceholder: "Search invoice or customer",
    sourceDocumentKind: "sales",
    valueInput: "quantity",
    defaultContext: "goods_related",
  },
  "purchase-return": {
    mode: "purchase-return",
    title: "Purchase Returns",
    description: "Record goods returned to suppliers and post the inventory, GST, and payable adjustment.",
    noun: "purchase returns",
    icon: ArrowUpRightIcon,
    sourceLabel: "Posted purchase bill",
    sourceSearchPlaceholder: "Search bill or supplier",
    sourceDocumentKind: "purchase",
    valueInput: "quantity",
    defaultContext: "goods_related",
  },
  "credit-note": {
    mode: "credit-note",
    title: "Credit Notes",
    description: "Reduce invoice value, tax, or receivable using a separate immutable credit note.",
    noun: "credit notes",
    icon: FileMinus2Icon,
    sourceLabel: "Original sales invoice",
    sourceSearchPlaceholder: "Search invoice or customer",
    sourceDocumentKind: "sales",
    valueInput: "amount",
    defaultContext: "value_only",
  },
  "debit-note": {
    mode: "debit-note",
    title: "Debit Notes",
    description: "Increase payable or receivable value with explicit source-document context.",
    noun: "debit notes",
    icon: FilePlus2Icon,
    sourceLabel: "Original purchase bill",
    sourceSearchPlaceholder: "Search bill or supplier",
    sourceDocumentKind: "purchase",
    valueInput: "amount",
    defaultContext: "tax_adjustment",
  },
}

const tablePageSize = 15
const defaultDate = () => new Date().toISOString().slice(0, 10)

const statusOptions = [
  { value: "all", label: "All status" },
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "reversed", label: "Reversed" },
] as const

export function AdjustmentDocumentsPage({ mode }: { mode: AdjustmentMode }) {
  const config = pageConfigs[mode]
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<"all" | AdjustmentStatus>("all")
  const [createOpen, setCreateOpen] = React.useState(false)
  const [deletingDocument, setDeletingDocument] = React.useState<AdjustmentListRow | null>(null)
  const [reversingDocument, setReversingDocument] = React.useState<AdjustmentListRow | null>(null)
  const [reverseReason, setReverseReason] = React.useState("")

  const documentsQuery = useInfiniteQuery({
    queryKey: ["adjustments", mode, search, status],
    queryFn: async ({ pageParam }) =>
      listAdjustments(accessToken, mode, {
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
  const documents = React.useMemo(
    () => documentsQuery.data?.pages.flatMap((page) => page.adjustments) ?? [],
    [documentsQuery.data?.pages]
  )
  const totalCount = documentsQuery.data?.pages[0]?.pagination.total ?? documents.length
  const totals = React.useMemo(() => summarizeDocuments(documents), [documents])

  const postMutation = useMutation({
    mutationFn: (documentId: string) => postAdjustment(accessToken, mode, documentId),
    onSuccess: async () => {
      toast.success("Adjustment posted.")
      await invalidateAdjustmentQueries(queryClient, mode)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => deleteAdjustment(accessToken, mode, documentId),
    onSuccess: async () => {
      toast.success("Draft adjustment deleted.")
      setDeletingDocument(null)
      await invalidateAdjustmentQueries(queryClient, mode)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const reverseMutation = useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      reverseAdjustment(accessToken, mode, input.id, input.reason),
    onSuccess: async () => {
      toast.success("Adjustment reversed.")
      setReversingDocument(null)
      setReverseReason("")
      await invalidateAdjustmentQueries(queryClient, mode)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const exportMutation = useMutation({
    mutationFn: () => exportAdjustments(accessToken, mode, { search, status }),
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
      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
              <config.icon className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">{config.title}</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                {config.description}
              </p>
            </div>
          </div>
          <Button className="h-8" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            New {config.title.slice(0, -1)}
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Total adjusted" value={formatCurrency(totals.total)} />
        <MetricCard label="Posted" value={String(totals.posted)} />
        <MetricCard label="Drafts" value={String(totals.draft)} />
      </section>

      <section className="rounded-2xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-medium">{config.title} register</h2>
            <p className="text-sm text-muted-foreground">
              Posted adjustments are immutable. Reverse them instead of editing.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <SearchIcon className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="h-8 w-full pl-8 sm:w-64"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search number or reason"
              />
            </div>
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
            >
              {exportMutation.isPending ? <Spinner className="size-4" /> : <DownloadIcon className="size-4" />}
              Export
            </Button>
          </div>
        </div>

        {documentsQuery.isLoading ? (
          <TableSkeleton />
        ) : documents.length === 0 ? (
          <EmptyState config={config} onCreate={() => setCreateOpen(true)} />
        ) : (
          <>
            <div className="app-scrollbar max-h-[35rem] overflow-auto" onScroll={handleScroll}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Taxable</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>
                        <Link
                          className="font-mono text-xs underline-offset-4 hover:underline"
                          href={`/${modePath(mode)}/${document.id}`}
                        >
                          {document.adjustmentNumber}
                        </Link>
                        <p className="mt-1 max-w-[180px] truncate text-xs text-muted-foreground">
                          {document.reason || "No reason added"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">
                          {labelize(document.sourceDocumentType)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {document.sourceDocumentId?.slice(0, 8) ?? "No source"}
                        </p>
                      </TableCell>
                      <TableCell>{formatDate(document.adjustmentDate)}</TableCell>
                      <AmountCell value={document.taxableTotal} />
                      <AmountCell value={document.grandTotal} />
                      <TableCell>
                        <StatusBadge status={document.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            className="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted"
                            href={`/${modePath(mode)}/${document.id}`}
                          >
                            View
                          </Link>
                          {document.status === "draft" ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={postMutation.isPending}
                                onClick={() => postMutation.mutate(document.id)}
                              >
                                Post
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeletingDocument(document)}
                              >
                                <Trash2Icon className="size-4" />
                              </Button>
                            </>
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
              noun={config.noun}
            />
          </>
        )}
      </section>

      {createOpen ? (
        <AdjustmentCreateDialog
          config={config}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      ) : null}

      <Dialog open={Boolean(deletingDocument)} onOpenChange={(open) => !open && setDeletingDocument(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete draft adjustment?</DialogTitle>
            <DialogDescription>
              This only deletes the draft. Posted adjustments must be reversed.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Document</span>
              <span className="font-mono">{deletingDocument?.adjustmentNumber}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Total</span>
              <span className="font-mono">{formatCurrency(deletingDocument?.grandTotal ?? "0")}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingDocument(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!deletingDocument || deleteMutation.isPending}
              onClick={() => deletingDocument && deleteMutation.mutate(deletingDocument.id)}
            >
              {deleteMutation.isPending ? <Spinner className="size-4" /> : <Trash2Icon className="size-4" />}
              Delete draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reversingDocument)} onOpenChange={(open) => !open && setReversingDocument(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse adjustment?</DialogTitle>
            <DialogDescription>
              Reversal creates an opposite journal and marks this adjustment as reversed.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Document</span>
              <span className="font-mono">{reversingDocument?.adjustmentNumber}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Total</span>
              <span className="font-mono">{formatCurrency(reversingDocument?.grandTotal ?? "0")}</span>
            </div>
          </div>
          <Field>
            <FieldLabel>Reason</FieldLabel>
            <Textarea
              value={reverseReason}
              onChange={(event) => setReverseReason(event.target.value)}
              placeholder="Wrong source document, duplicate note, or incorrect amount"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReversingDocument(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reversingDocument || reverseReason.trim().length < 3 || reverseMutation.isPending}
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
    </main>
  )
}

function AdjustmentCreateDialog({
  config,
  open,
  onOpenChange,
}: {
  config: AdjustmentPageConfig
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const [sourceSearch, setSourceSearch] = React.useState("")
  const [sourceDocumentId, setSourceDocumentId] = React.useState("")
  const [adjustmentDate, setAdjustmentDate] = React.useState(defaultDate)
  const [reason, setReason] = React.useState("")
  const [lineValues, setLineValues] = React.useState<Record<string, string>>({})

  const sourceQuery = useQuery({
    queryKey: ["adjustments", config.mode, "sources", sourceSearch],
    queryFn: async () => {
      if (config.sourceDocumentKind === "sales") {
        const response = await listSalesInvoices(accessToken, {
          search: sourceSearch,
          limit: 50,
        })
        return response.invoices
          .filter((invoice) => invoice.status === "posted")
          .map((invoice) => ({
            id: invoice.id,
            number: invoice.invoiceNumber,
            date: invoice.invoiceDate,
            partyName: invoice.customerName,
            totalAmount: invoice.totalAmount,
          }))
      }

      const response = await listPurchaseBills(accessToken, {
        search: sourceSearch,
        limit: 50,
      })
      return response.bills
        .filter((bill) => bill.status === "posted")
        .map((bill) => ({
          id: bill.id,
          number: bill.billNumber,
          date: bill.billDate,
          partyName: bill.supplierName,
          totalAmount: bill.totalAmount,
        }))
    },
    enabled: open && accessToken.length > 0,
  })
  const returnableQuery = useQuery({
    queryKey: ["adjustments", config.mode, "returnable", sourceDocumentId],
    queryFn: () =>
      config.sourceDocumentKind === "sales" ?
        getSalesInvoiceReturnable(accessToken, sourceDocumentId)
      : getPurchaseBillReturnable(accessToken, sourceDocumentId),
    enabled: sourceDocumentId.length > 0 && accessToken.length > 0,
  })
  const createMutation = useMutation({
    mutationFn: async () => {
      const source = returnableQuery.data

      if (!source) {
        throw new Error("Choose a posted source document first.")
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
            config.mode === "sales-return" ? "STOCK_IN" as const
            : config.mode === "purchase-return" ? "STOCK_OUT" as const
            : "NONE" as const,
        }))

      if (lines.length === 0) {
        throw new Error(
          config.valueInput === "quantity" ?
            "Enter return quantity for at least one line."
          : "Enter adjustment value for at least one line."
        )
      }

      return createAdjustment(accessToken, config.mode, {
        idempotencyKey: crypto.randomUUID(),
        sourceDocumentId,
        adjustmentDate,
        reason: reason.trim() || null,
        adjustmentContext: config.defaultContext,
        lines,
      })
    },
    onSuccess: async () => {
      toast.success("Draft adjustment created.")
      onOpenChange(false)
      await invalidateAdjustmentQueries(queryClient, config.mode)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>New {config.title.slice(0, -1)}</DialogTitle>
          <DialogDescription>
            Select a posted source document and enter the lines to adjust. Backend
            validation is authoritative at posting.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <Field>
              <FieldLabel>{config.sourceLabel}</FieldLabel>
              <Input
                className="h-8"
                value={sourceSearch}
                onChange={(event) => setSourceSearch(event.target.value)}
                placeholder={config.sourceSearchPlaceholder}
              />
            </Field>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border p-2">
              {sourceQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 rounded-lg" />
                ))
              ) : sourceQuery.data?.length ? (
                sourceQuery.data.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    className={
                      "w-full rounded-lg border p-3 text-left text-sm transition-colors " +
                      (sourceDocumentId === source.id ?
                        "border-blue-500 bg-blue-500/5"
                      : "hover:bg-muted/50")
                    }
                    onClick={() => {
                      setSourceDocumentId(source.id)
                      setLineValues({})
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs">{source.number}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatCurrency(source.totalAmount)}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-medium">{source.partyName}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(source.date)}</p>
                  </button>
                ))
              ) : (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  No posted source documents found.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Adjustment date</FieldLabel>
                <Input
                  className="h-8"
                  type="date"
                  value={adjustmentDate}
                  onChange={(event) => setAdjustmentDate(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Reason</FieldLabel>
                <Input
                  className="h-8"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Returned goods, rate correction, discount"
                />
              </Field>
            </div>

            <ReturnableLinesEditor
              config={config}
              source={returnableQuery.data}
              loading={returnableQuery.isLoading}
              values={lineValues}
              onChange={(lineId, value) =>
                setLineValues((current) => ({ ...current, [lineId]: value }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!sourceDocumentId || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? <Spinner className="size-4" /> : <PackageCheckIcon className="size-4" />}
            Save draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReturnableLinesEditor({
  config,
  source,
  loading,
  values,
  onChange,
}: {
  config: AdjustmentPageConfig
  source: ReturnableSource | undefined
  loading: boolean
  values: Record<string, string>
  onChange: (lineId: string, value: string) => void
}) {
  if (loading) {
    return <Skeleton className="h-72 rounded-2xl" />
  }

  if (!source) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Choose a source document to load returnable lines.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border">
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
      <div className="max-h-80 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Original</TableHead>
              <TableHead className="text-right">Returned</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="w-32 text-right">
                {config.valueInput === "quantity" ? "Return now" : "Adjust value"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {source.lines.map((line) => {
              const remaining = Number(line.remainingQuantity)
              return (
                <TableRow key={line.id}>
                  <TableCell>
                    <p className="max-w-[220px] truncate font-medium">{line.itemName}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.hsnSacCode || "No HSN"} · {line.unit} · GST {line.gstRate}%
                    </p>
                  </TableCell>
                  <TableCell className="text-right font-mono">{line.originalQuantity}</TableCell>
                  <TableCell className="text-right font-mono">{line.previouslyReturnedQuantity}</TableCell>
                  <TableCell className="text-right font-mono">{line.remainingQuantity}</TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-right font-mono"
                      inputMode="decimal"
                      disabled={config.valueInput === "quantity" && remaining <= 0}
                      value={values[line.id] ?? ""}
                      onChange={(event) => onChange(line.id, event.target.value)}
                      placeholder={config.valueInput === "quantity" ? "0" : "0.00"}
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-xl font-semibold">{value}</p>
    </section>
  )
}

function AmountCell({ value }: { value: string }) {
  return <TableCell className="text-right font-mono">{formatCurrency(value)}</TableCell>
}

function StatusBadge({ status }: { status: AdjustmentStatus }) {
  const className =
    status === "posted" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : status === "reversed" ? "bg-red-500/10 text-red-700 dark:text-red-300"
    : "bg-amber-500/10 text-amber-700 dark:text-amber-300"

  return (
    <Badge variant="outline" className={className}>
      {labelize(status)}
    </Badge>
  )
}

function EmptyState({
  config,
  onCreate,
}: {
  config: AdjustmentPageConfig
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
        <config.icon className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">No {config.noun} yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create one from a posted source document when an adjustment is required.
        </p>
      </div>
      <Button size="sm" onClick={onCreate}>
        <PlusIcon className="size-4" />
        Create {config.title.slice(0, -1)}
      </Button>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 8 }).map((_, index) => (
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
    <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
      <span>
        Showing {loaded} of {total} {noun}
      </span>
      <span>{loading ? "Loading more..." : hasMore ? "Scroll for more" : "End of list"}</span>
    </div>
  )
}

function summarizeDocuments(documents: AdjustmentListRow[]) {
  return documents.reduce(
    (summary, document) => ({
      total: summary.total + Number(document.grandTotal),
      posted: summary.posted + (document.status === "posted" ? 1 : 0),
      draft: summary.draft + (document.status === "draft" ? 1 : 0),
    }),
    { total: 0, posted: 0, draft: 0 }
  )
}

function modePath(mode: AdjustmentMode) {
  const paths: Record<AdjustmentMode, string> = {
    "sales-return": "sales-returns",
    "purchase-return": "purchase-returns",
    "credit-note": "credit-notes",
    "debit-note": "debit-notes",
  }

  return paths[mode]
}

async function invalidateAdjustmentQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  mode: AdjustmentMode
) {
  await queryClient.invalidateQueries({ queryKey: ["adjustments", mode] })
}

function downloadCsv(response: { fileName: string; content: string }) {
  const blob = new Blob([response.content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = response.fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDate(value: string) {
  if (!value) {
    return "Not set"
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function labelize(value: string) {
  return value
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}
