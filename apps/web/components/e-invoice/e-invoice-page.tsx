"use client"

import * as React from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BadgeCheckIcon,
  ClipboardCheckIcon,
  EyeIcon,
  FileSignatureIcon,
  HistoryIcon,
  QrCodeIcon,
  RefreshCcwIcon,
  RotateCcwIcon,
  SearchIcon,
  SendIcon,
  ShieldCheckIcon,
  XCircleIcon,
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
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
import {
  cancelEInvoice,
  createEInvoiceRecord,
  generateEInvoice,
  getEInvoice,
  getEInvoiceEligibility,
  listEInvoices,
  pollEInvoiceStatus,
  retryEInvoice,
  validateEInvoice,
  type EInvoiceRecord,
  type EInvoiceSubmissionStatus,
} from "@/lib/e-invoice/api"
import { listSalesInvoices, type SalesInvoice } from "@/lib/sales/api"
import { cn } from "@/lib/utils"

const statusOptions: Array<{ value: EInvoiceSubmissionStatus | "all"; label: string }> = [
  { value: "all", label: "All status" },
  { value: "ELIGIBLE", label: "Eligible" },
  { value: "READY", label: "Ready" },
  { value: "IRN_GENERATED", label: "IRN generated" },
  { value: "PROCESSING", label: "Processing" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
]

const sourceTypeOptions = [
  { value: "all", label: "All documents" },
  { value: "sales_invoice", label: "Sales invoices" },
  { value: "credit_note", label: "Credit notes" },
  { value: "debit_note", label: "Debit notes" },
] as const

const tableClass =
  "w-full table-fixed text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-2"

export function EInvoicePage() {
  const queryClient = useQueryClient()
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<EInvoiceSubmissionStatus | "all">("all")
  const [sourceType, setSourceType] = React.useState<(typeof sourceTypeOptions)[number]["value"]>("all")
  const [sourceDialogOpen, setSourceDialogOpen] = React.useState(false)
  const [selectedSource, setSelectedSource] = React.useState<SalesInvoice | null>(null)
  const [sourceSearch, setSourceSearch] = React.useState("")
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [cancelRecord, setCancelRecord] = React.useState<EInvoiceRecord | null>(null)
  const [cancelReason, setCancelReason] = React.useState("")

  const recordsQuery = useQuery({
    queryKey: ["e-invoice", "records", search, status, sourceType],
    queryFn: () =>
      listEInvoices(accessToken, {
        search,
        status,
        sourceDocumentType: sourceType,
        page: 1,
        limit: 30,
      }),
    enabled: accessToken.length > 0,
  })
  const records = React.useMemo(
    () => recordsQuery.data?.eInvoices ?? [],
    [recordsQuery.data?.eInvoices]
  )
  const totals = React.useMemo(() => summarizeRecords(records), [records])

  const sourceInvoicesQuery = useQuery({
    queryKey: ["e-invoice", "sources", sourceSearch],
    queryFn: () =>
      listSalesInvoices(accessToken, {
        status: "posted",
        search: sourceSearch,
        page: 1,
        limit: 15,
      }),
    enabled: accessToken.length > 0 && sourceDialogOpen,
  })
  const sourceInvoices = sourceInvoicesQuery.data?.invoices ?? []
  const eligibilityQuery = useQuery({
    queryKey: ["e-invoice", "eligibility", selectedSource?.id],
    queryFn: () =>
      getEInvoiceEligibility(accessToken, "sales_invoice", selectedSource?.id ?? ""),
    enabled: accessToken.length > 0 && Boolean(selectedSource?.id),
  })
  const detailQuery = useQuery({
    queryKey: ["e-invoice", "detail", detailId],
    queryFn: () => getEInvoice(accessToken, detailId ?? ""),
    enabled: accessToken.length > 0 && Boolean(detailId),
  })

  const createMutation = useMutation({
    mutationFn: async (invoice: SalesInvoice) =>
      createEInvoiceRecord(accessToken, {
        sourceDocumentType: "sales_invoice",
        sourceDocumentId: invoice.id,
        idempotencyKey: `einv-create-${invoice.id}-${Date.now().toString(36)}`,
      }),
    onSuccess: async (response) => {
      setSourceDialogOpen(false)
      setSelectedSource(null)
      setDetailId(response.eInvoice.id)
      toast.success("E-invoice record prepared.")
      await invalidateEInvoiceQueries(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const validateMutation = useMutation({
    mutationFn: (recordId: string) => validateEInvoice(accessToken, recordId),
    onSuccess: async (response) => {
      toast.success(
        response.validation.canSubmit ? "E-invoice is ready." : "Validation needs fixes."
      )
      await invalidateEInvoiceQueries(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const generateMutation = useMutation({
    mutationFn: (recordId: string) => generateEInvoice(accessToken, recordId),
    onSuccess: async () => {
      toast.success("Mock IRN generated.")
      await invalidateEInvoiceQueries(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const statusMutation = useMutation({
    mutationFn: (recordId: string) => pollEInvoiceStatus(accessToken, recordId),
    onSuccess: async () => {
      toast.success("E-invoice status refreshed.")
      await invalidateEInvoiceQueries(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const retryMutation = useMutation({
    mutationFn: (recordId: string) => retryEInvoice(accessToken, recordId, "Retried from E-Invoice workspace"),
    onSuccess: async () => {
      toast.success("E-invoice retry is ready.")
      await invalidateEInvoiceQueries(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!cancelRecord) {
        throw new Error("Select an e-invoice record.")
      }

      return cancelEInvoice(accessToken, cancelRecord.id, cancelReason)
    },
    onSuccess: async () => {
      setCancelRecord(null)
      setCancelReason("")
      toast.success("E-invoice cancelled.")
      await invalidateEInvoiceQueries(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <main className="min-w-0 space-y-5 p-4 sm:p-6">
      <Button
        nativeButton={false}
        render={<Link href="/dashboard" />}
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 w-fit gap-1.5 text-muted-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Back to overview
      </Button>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col gap-4 border-b px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-5">
          <div className="min-w-0 space-y-2">
            <Badge variant="outline" className="w-fit gap-1.5 bg-background">
              <FileSignatureIcon className="size-3.5" />
              E-Invoice
            </Badge>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">IRN control room</h1>
              <p className="max-w-2xl text-xs text-muted-foreground">
                Prepare eligible posted documents, validate the payload, generate IRN, and track acknowledgement without changing the original invoice.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-2 bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => setSourceDialogOpen(true)}
          >
            <FileSignatureIcon className="size-4" />
            Prepare e-invoice
          </Button>
        </div>

        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricTile
            label="Ready"
            value={totals.ready}
            tone="blue"
            icon={<ClipboardCheckIcon className="size-4" />}
          />
          <MetricTile
            label="IRN generated"
            value={totals.generated}
            tone="green"
            icon={<BadgeCheckIcon className="size-4" />}
          />
          <MetricTile
            label="Failed"
            value={totals.failed}
            tone="red"
            icon={<XCircleIcon className="size-4" />}
          />
          <MetricTile
            label="Processing"
            value={totals.processing}
            tone="amber"
            icon={<RefreshCcwIcon className="size-4" />}
          />
          <MetricTile
            label="Cancelled"
            value={totals.cancelled}
            tone="zinc"
            icon={<RotateCcwIcon className="size-4" />}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">E-invoice history</h2>
            <p className="text-xs text-muted-foreground">
              Provider status, IRN, acknowledgement, and payload response trail.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <SearchIcon className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="h-8 w-full pl-8 sm:w-72"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search document, GSTIN, IRN"
              />
            </div>
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectTrigger className="h-8 w-full sm:w-40">
                <SelectDisplayValue
                  value={status}
                  options={statusOptions}
                  placeholder="Status"
                />
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
              value={sourceType}
              onValueChange={(value) => setSourceType(value as typeof sourceType)}
            >
              <SelectTrigger className="h-8 w-full sm:w-40">
                <SelectDisplayValue
                  value={sourceType}
                  options={sourceTypeOptions}
                  placeholder="Document"
                />
              </SelectTrigger>
              <SelectContent align="start">
                {sourceTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {recordsQuery.isLoading ? (
          <EInvoiceTableSkeleton />
        ) : records.length === 0 ? (
          <Empty className="min-h-72 justify-center">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileSignatureIcon className="size-5" />
              </EmptyMedia>
              <EmptyTitle>No e-invoice records yet</EmptyTitle>
              <EmptyDescription>
                Prepare a posted B2B sales invoice to validate and generate a mock IRN.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                type="button"
                size="sm"
                className="h-8 bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => setSourceDialogOpen(true)}
              >
                Prepare e-invoice
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="app-scrollbar max-h-[30rem] overflow-auto">
            <Table className={tableClass}>
              <TableHeader className="sticky top-0 z-20 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                <TableRow>
                  <TableHead className="w-[16%]">Document</TableHead>
                  <TableHead className="w-[12%]">Date</TableHead>
                  <TableHead className="w-[17%]">GSTIN</TableHead>
                  <TableHead className="w-[14%]">Status</TableHead>
                  <TableHead className="w-[18%]">IRN</TableHead>
                  <TableHead className="w-[14%]">Ack</TableHead>
                  <TableHead className="w-[9%] pr-3 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate font-medium">{record.sourceDocumentNumber}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {sourceTypeLabel(record.sourceDocumentType)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(record.documentDate)}
                    </TableCell>
                    <TableCell className="truncate font-mono text-[11px]">
                      {record.partyGstin ?? "Not available"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={record.submissionStatus} />
                    </TableCell>
                    <TableCell className="truncate font-mono text-[11px] text-muted-foreground">
                      {record.irn ?? "Pending"}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      {record.ackNumber ?? "Not issued"}
                    </TableCell>
                    <TableCell className="pr-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="View details"
                          onClick={() => setDetailId(record.id)}
                        >
                          <EyeIcon className="size-4" />
                        </Button>
                        {record.submissionStatus === "ELIGIBLE" ||
                        record.submissionStatus === "VALIDATION_FAILED" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Validate"
                            disabled={validateMutation.isPending}
                            onClick={() => validateMutation.mutate(record.id)}
                          >
                            <ShieldCheckIcon className="size-4" />
                          </Button>
                        ) : null}
                        {record.submissionStatus === "READY" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-blue-600"
                            title="Generate IRN"
                            disabled={generateMutation.isPending}
                            onClick={() => generateMutation.mutate(record.id)}
                          >
                            <SendIcon className="size-4" />
                          </Button>
                        ) : null}
                        {record.submissionStatus === "PROCESSING" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Refresh status"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate(record.id)}
                          >
                            <RefreshCcwIcon className="size-4" />
                          </Button>
                        ) : null}
                        {record.submissionStatus === "FAILED" ||
                        record.submissionStatus === "CANCELLATION_FAILED" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Retry"
                            disabled={retryMutation.isPending}
                            onClick={() => retryMutation.mutate(record.id)}
                          >
                            <RotateCcwIcon className="size-4" />
                          </Button>
                        ) : null}
                        {record.submissionStatus === "IRN_GENERATED" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-red-600"
                            title="Cancel IRN"
                            onClick={() => setCancelRecord(record)}
                          >
                            <XCircleIcon className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <SourceInvoiceDialog
        open={sourceDialogOpen}
        search={sourceSearch}
        invoices={sourceInvoices}
        loading={sourceInvoicesQuery.isLoading}
        selectedSource={selectedSource}
        eligibility={eligibilityQuery.data?.eligibility ?? null}
        eligibilityLoading={eligibilityQuery.isFetching}
        creating={createMutation.isPending}
        onOpenChange={setSourceDialogOpen}
        onSearchChange={setSourceSearch}
        onSelect={setSelectedSource}
        onCreate={() => selectedSource && createMutation.mutate(selectedSource)}
      />

      <EInvoiceDetailDialog
        open={Boolean(detailId)}
        loading={detailQuery.isLoading}
        detail={detailQuery.data ?? null}
        onOpenChange={(open) => !open && setDetailId(null)}
      />

      <Dialog open={Boolean(cancelRecord)} onOpenChange={(open) => !open && setCancelRecord(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancel IRN</DialogTitle>
            <DialogDescription>
              This only cancels the e-invoice IRN record. It does not cancel the sales invoice or accounting voucher.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/20 p-3 text-sm">
            <p className="font-medium">{cancelRecord?.sourceDocumentNumber}</p>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
              {cancelRecord?.irn}
            </p>
          </div>
          <Textarea
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Reason for cancelling this IRN"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelRecord(null)}>
              Keep IRN
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelReason.trim().length < 3 || cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              {cancelMutation.isPending ? <Spinner className="size-4" /> : null}
              Cancel IRN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function SourceInvoiceDialog({
  open,
  search,
  invoices,
  loading,
  selectedSource,
  eligibility,
  eligibilityLoading,
  creating,
  onOpenChange,
  onSearchChange,
  onSelect,
  onCreate,
}: {
  open: boolean
  search: string
  invoices: SalesInvoice[]
  loading: boolean
  selectedSource: SalesInvoice | null
  eligibility: Awaited<ReturnType<typeof getEInvoiceEligibility>>["eligibility"] | null
  eligibilityLoading: boolean
  creating: boolean
  onOpenChange: (open: boolean) => void
  onSearchChange: (value: string) => void
  onSelect: (invoice: SalesInvoice) => void
  onCreate: () => void
}) {
  const canCreate = selectedSource && eligibility?.status === "ELIGIBLE"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Prepare e-invoice from sales invoice</DialogTitle>
          <DialogDescription>
            Select a posted B2B invoice. GSTfy will create a frozen e-invoice payload snapshot before IRN generation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <div className="overflow-hidden rounded-2xl border">
            <div className="border-b p-3">
              <div className="relative">
                <SearchIcon className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
                <Input
                  className="h-8 pl-8"
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search posted invoice or customer"
                />
              </div>
            </div>
            <div className="app-scrollbar max-h-80 overflow-auto p-2">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 rounded-xl" />
                  ))}
                </div>
              ) : invoices.length === 0 ? (
                <Empty className="min-h-52 justify-center">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileSignatureIcon className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle>No posted sales invoices</EmptyTitle>
                    <EmptyDescription>
                      Post a B2B sales invoice first, then prepare its e-invoice.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="space-y-1">
                  {invoices.map((invoice) => (
                    <button
                      key={invoice.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                        selectedSource?.id === invoice.id && "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                      )}
                      onClick={() => onSelect(invoice)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {invoice.invoiceNumber}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {invoice.customerName}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs">
                        {formatCurrency(invoice.totalAmount)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="size-4 text-blue-600" />
              <h3 className="text-sm font-semibold">Eligibility</h3>
            </div>
            {!selectedSource ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Choose an invoice to check posted status, B2B supply, recipient GSTIN, and payload readiness.
              </p>
            ) : eligibilityLoading ? (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : eligibility ? (
              <div className="mt-3 space-y-3">
                <StatusBadge status={eligibility.status === "ELIGIBLE" ? "READY" : "VALIDATION_FAILED"} />
                <div>
                  <p className="text-sm font-medium">{eligibility.reasonCode}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{eligibility.reason}</p>
                </div>
                {eligibility.warnings.length > 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                    {eligibility.warnings[0]?.message}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={!canCreate || creating}
            onClick={onCreate}
          >
            {creating ? <Spinner className="size-4" /> : <FileSignatureIcon className="size-4" />}
            Prepare record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EInvoiceDetailDialog({
  open,
  loading,
  detail,
  onOpenChange,
}: {
  open: boolean
  loading: boolean
  detail: Awaited<ReturnType<typeof getEInvoice>> | null
  onOpenChange: (open: boolean) => void
}) {
  const record = detail?.eInvoice ?? null
  const validation = record?.validationResult as
    | { blockingIssues?: Array<{ code: string; message: string }>; warnings?: Array<{ code: string; message: string }> }
    | undefined
  const canonicalPayload = detail?.payloads.find((payload) => payload.payloadType === "canonical")
  const responsePayload = detail?.payloads.find((payload) => payload.payloadType === "response")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        {loading || !record ? (
          <>
            <DialogHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-80" />
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCodeIcon className="size-4 text-blue-600" />
                {record.sourceDocumentNumber}
              </DialogTitle>
              <DialogDescription>
                IRN lifecycle, payload hash, acknowledgement, response and status trail.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-3">
              <DetailTile label="Status" value={<StatusBadge status={record.submissionStatus} />} />
              <DetailTile label="Ack number" value={record.ackNumber ?? "Not issued"} />
              <DetailTile label="Provider" value={`${record.providerName} · attempt ${record.attemptNumber}`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-3">
                <div className="rounded-2xl border p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    IRN
                  </p>
                  <p className="mt-2 break-all font-mono text-xs">
                    {record.irn ?? "Pending generation"}
                  </p>
                </div>
                <div className="rounded-2xl border p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Payload hash
                  </p>
                  <p className="mt-2 break-all font-mono text-xs">
                    {record.payloadHash ?? canonicalPayload?.contentHash ?? "Not generated"}
                  </p>
                </div>
                {record.errorMessage ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                    <p className="font-medium">{record.errorCode ?? "Provider error"}</p>
                    <p className="mt-1">{record.errorMessage}</p>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border p-3">
                <div className="flex items-center gap-2">
                  <HistoryIcon className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">History</h3>
                </div>
                <div className="mt-3 space-y-2">
                  {(detail?.events ?? []).slice(0, 5).map((event) => (
                    <div key={event.id} className="rounded-xl bg-muted/40 p-2 text-xs">
                      <p className="font-medium">{event.message ?? event.eventType}</p>
                      <p className="mt-0.5 text-muted-foreground">
                        {formatDateTime(event.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <PayloadBox title="Validation issues" payload={validation ?? {}} />
              <PayloadBox title="Latest provider response" payload={responsePayload?.payload ?? {}} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MetricTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: number
  tone: "blue" | "green" | "red" | "amber" | "zinc"
  icon: React.ReactNode
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
    zinc: "bg-muted text-muted-foreground",
  }[tone]

  return (
    <div className={cn("rounded-2xl p-3", toneClass)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function DetailTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  )
}

function PayloadBox({ title, payload }: { title: string; payload: unknown }) {
  return (
    <div className="overflow-hidden rounded-2xl border">
      <div className="border-b bg-muted/40 px-3 py-2">
        <p className="text-xs font-medium">{title}</p>
      </div>
      <pre className="app-scrollbar max-h-44 overflow-auto p-3 text-[11px] text-muted-foreground">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  )
}

function StatusBadge({ status }: { status: EInvoiceSubmissionStatus }) {
  const styles: Record<EInvoiceSubmissionStatus, string> = {
    NOT_REQUIRED: "bg-muted text-muted-foreground",
    ELIGIBLE: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    READY: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    VALIDATION_FAILED: "bg-red-500/10 text-red-700 dark:text-red-300",
    SUBMITTING: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    PROCESSING: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    IRN_GENERATED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    FAILED: "bg-red-500/10 text-red-700 dark:text-red-300",
    CANCELLATION_REQUESTED: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    CANCELLED: "bg-muted text-muted-foreground",
    CANCELLATION_FAILED: "bg-red-500/10 text-red-700 dark:text-red-300",
  }

  return (
    <Badge variant="secondary" className={cn("border-transparent", styles[status])}>
      {statusLabel(status)}
    </Badge>
  )
}

function EInvoiceTableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-10 rounded-xl" />
      ))}
    </div>
  )
}

function summarizeRecords(records: EInvoiceRecord[]) {
  return records.reduce(
    (summary, record) => {
      if (record.submissionStatus === "READY" || record.submissionStatus === "ELIGIBLE") {
        summary.ready += 1
      }

      if (record.submissionStatus === "IRN_GENERATED") {
        summary.generated += 1
      }

      if (record.submissionStatus === "FAILED" || record.submissionStatus === "VALIDATION_FAILED") {
        summary.failed += 1
      }

      if (record.submissionStatus === "PROCESSING" || record.submissionStatus === "SUBMITTING") {
        summary.processing += 1
      }

      if (record.submissionStatus === "CANCELLED") {
        summary.cancelled += 1
      }

      return summary
    },
    { ready: 0, generated: 0, failed: 0, processing: 0, cancelled: 0 }
  )
}

async function invalidateEInvoiceQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: ["e-invoice"] })
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
}

function sourceTypeLabel(sourceType: string) {
  const labels: Record<string, string> = {
    sales_invoice: "Sales invoice",
    credit_note: "Credit note",
    debit_note: "Debit note",
  }

  return labels[sourceType] ?? sourceType
}

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}
