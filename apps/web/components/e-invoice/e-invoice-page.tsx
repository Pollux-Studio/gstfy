"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  ArrowDownIcon,
  ArrowDownUpIcon,
  ArrowUpIcon,
  BadgeCheckIcon,
  ClipboardCheckIcon,
  EyeIcon,
  FileSignatureIcon,
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
import {
  EInvoiceDetailDialog,
  EInvoiceStatusBadge,
  eInvoiceSourceTypeLabel,
  formatEInvoiceDate,
  getEffectiveEInvoiceStatus,
} from "@/components/e-invoice/e-invoice-detail-dialog"
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

type EInvoiceSortKey = "document" | "date" | "gstin" | "status" | "irn" | "ack"
type EInvoiceSortDirection = "asc" | "desc"
type EInvoiceEligibility = Awaited<ReturnType<typeof getEInvoiceEligibility>>["eligibility"]

export function EInvoicePage() {
  const queryClient = useQueryClient()
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<EInvoiceSubmissionStatus | "all">("all")
  const [sourceType, setSourceType] = React.useState<(typeof sourceTypeOptions)[number]["value"]>("all")
  const [sourceDialogOpen, setSourceDialogOpen] = React.useState(false)
  const [selectedSource, setSelectedSource] = React.useState<SalesInvoice | null>(null)
  const [sourceSearch, setSourceSearch] = React.useState("")
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false)
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [cancelRecord, setCancelRecord] = React.useState<EInvoiceRecord | null>(null)
  const [cancelReason, setCancelReason] = React.useState("")
  const [sort, setSort] = React.useState<{
    key: EInvoiceSortKey
    direction: EInvoiceSortDirection
  }>({ key: "date", direction: "desc" })
  const sourceCloseTimerRef = React.useRef<number | null>(null)
  const detailCloseTimerRef = React.useRef<number | null>(null)

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
  const sortedRecords = React.useMemo(
    () => sortEInvoiceRecords(records, sort.key, sort.direction),
    [records, sort]
  )

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

  React.useEffect(() => {
    return () => {
      if (sourceCloseTimerRef.current) {
        window.clearTimeout(sourceCloseTimerRef.current)
      }

      if (detailCloseTimerRef.current) {
        window.clearTimeout(detailCloseTimerRef.current)
      }
    }
  }, [])

  const createMutation = useMutation({
    mutationFn: async (invoice: SalesInvoice) =>
      createEInvoiceRecord(accessToken, {
        sourceDocumentType: "sales_invoice",
        sourceDocumentId: invoice.id,
      }),
    onSuccess: async (response) => {
      closeSourceDialog({ reset: true })
      openDetailDialog(response.eInvoice.id)
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
    onSuccess: async (response) => {
      toast.success(response.queued ? "IRN request submitted for processing." : "IRN generated.")
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
    onSuccess: async (response) => {
      toast.success(response.queued ? "E-invoice retry queued." : "E-invoice retry is ready.")
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

  function openDetailDialog(recordId: string) {
    if (detailCloseTimerRef.current) {
      window.clearTimeout(detailCloseTimerRef.current)
      detailCloseTimerRef.current = null
    }

    setDetailId(recordId)
    setDetailDialogOpen(true)
  }

  function openSourceDialog() {
    if (sourceCloseTimerRef.current) {
      window.clearTimeout(sourceCloseTimerRef.current)
      sourceCloseTimerRef.current = null
      setSelectedSource(null)
      setSourceSearch("")
    }

    setSourceDialogOpen(true)
  }

  function closeSourceDialog(options?: { reset?: boolean }) {
    setSourceDialogOpen(false)

    if (sourceCloseTimerRef.current) {
      window.clearTimeout(sourceCloseTimerRef.current)
    }

    if (options?.reset ?? true) {
      sourceCloseTimerRef.current = window.setTimeout(() => {
        setSelectedSource(null)
        setSourceSearch("")
        sourceCloseTimerRef.current = null
      }, 220)
    } else {
      sourceCloseTimerRef.current = null
    }
  }

  function closeDetailDialog() {
    setDetailDialogOpen(false)

    if (detailCloseTimerRef.current) {
      window.clearTimeout(detailCloseTimerRef.current)
    }

    detailCloseTimerRef.current = window.setTimeout(() => {
      setDetailId(null)
      detailCloseTimerRef.current = null
    }, 220)
  }

  function toggleSort(key: EInvoiceSortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }))
  }

  return (
    <main className="min-w-0 space-y-4 p-3 sm:p-4 lg:p-5">
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
          <div className="min-w-0 space-y-1.5">
            <Badge variant="outline" className="h-6 w-fit gap-1.5 bg-background px-2 text-[11px]">
              <FileSignatureIcon className="size-3.5" />
              E-Invoice
            </Badge>
            <div>
              <h1 className="text-base font-semibold tracking-tight sm:text-lg">
                E-invoice register
              </h1>
              <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
                Validate eligible posted documents, generate IRN, and keep the audit trail.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-2 bg-blue-600 text-white hover:bg-blue-700"
            onClick={openSourceDialog}
          >
            <FileSignatureIcon className="size-4" />
            Prepare e-invoice
          </Button>
        </div>

        <div className="grid gap-2 bg-muted/10 p-2.5 sm:grid-cols-2 lg:grid-cols-5">
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
        <div className="flex flex-col gap-3 border-b px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">E-invoice history</h2>
            <p className="line-clamp-1 text-xs text-muted-foreground">
              IRN status, acknowledgement, and payload response trail.
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
          <Empty className="min-h-64 justify-center">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileSignatureIcon className="size-5" />
              </EmptyMedia>
              <EmptyTitle>No e-invoice records yet</EmptyTitle>
              <EmptyDescription>
                Prepare a posted B2B sales invoice, run checks, and send it to IRP for IRN generation.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                type="button"
                size="sm"
                className="h-8 bg-blue-600 text-white hover:bg-blue-700"
                onClick={openSourceDialog}
              >
                Prepare e-invoice
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="app-scrollbar max-h-[26rem] overflow-auto">
            <Table className={tableClass}>
              <TableHeader className="sticky top-0 z-20 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                <TableRow>
                  <SortableEInvoiceTableHead
                    label="Document"
                    sortKey="document"
                    activeKey={sort.key}
                    direction={sort.direction}
                    className="w-[16%]"
                    onSort={toggleSort}
                  />
                  <SortableEInvoiceTableHead
                    label="Date"
                    sortKey="date"
                    activeKey={sort.key}
                    direction={sort.direction}
                    className="w-[12%]"
                    onSort={toggleSort}
                  />
                  <SortableEInvoiceTableHead
                    label="GSTIN"
                    sortKey="gstin"
                    activeKey={sort.key}
                    direction={sort.direction}
                    className="w-[17%]"
                    onSort={toggleSort}
                  />
                  <SortableEInvoiceTableHead
                    label="Status"
                    sortKey="status"
                    activeKey={sort.key}
                    direction={sort.direction}
                    className="w-[14%]"
                    onSort={toggleSort}
                  />
                  <SortableEInvoiceTableHead
                    label="IRN"
                    sortKey="irn"
                    activeKey={sort.key}
                    direction={sort.direction}
                    className="w-[18%]"
                    onSort={toggleSort}
                  />
                  <SortableEInvoiceTableHead
                    label="Ack"
                    sortKey="ack"
                    activeKey={sort.key}
                    direction={sort.direction}
                    className="w-[14%]"
                    onSort={toggleSort}
                  />
                  <TableHead className="w-[9%] pr-3 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRecords.map((record) => {
                  const status = getEffectiveEInvoiceStatus(record)

                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="min-w-0 space-y-0.5">
                          <p className="truncate font-medium">{record.sourceDocumentNumber}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {eInvoiceSourceTypeLabel(record.sourceDocumentType)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatEInvoiceDate(record.documentDate)}
                      </TableCell>
                      <TableCell className="truncate font-mono text-[11px]">
                        {record.partyGstin ?? "Not available"}
                      </TableCell>
                      <TableCell>
                        <EInvoiceStatusBadge status={getEffectiveEInvoiceStatus(record)} />
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
                            onClick={() => openDetailDialog(record.id)}
                          >
                            <EyeIcon className="size-4" />
                          </Button>
                          {status === "ELIGIBLE" ||
                            status === "VALIDATION_FAILED" ? (
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
                          {status === "READY" ? (
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
                          {status === "PROCESSING" ||
                          status === "SUBMITTING" ? (
                            canRetryGeneration(record) ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7 text-red-600"
                                title="Retry generation"
                                disabled={retryMutation.isPending}
                                onClick={() => retryMutation.mutate(record.id)}
                              >
                                <RotateCcwIcon className="size-4" />
                              </Button>
                            ) : (
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
                            )
                          ) : null}
                          {status === "FAILED" ||
                            status === "CANCELLATION_FAILED" ? (
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
                          {status === "IRN_GENERATED" ? (
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
                  )
                })}
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
        onOpenChange={(open) => (open ? openSourceDialog() : closeSourceDialog())}
        onSearchChange={setSourceSearch}
        onSelect={setSelectedSource}
        onClearSelection={() => setSelectedSource(null)}
        onCreate={() => selectedSource && createMutation.mutate(selectedSource)}
      />

      <EInvoiceDetailDialog
        open={detailDialogOpen}
        loading={detailQuery.isLoading}
        detail={detailQuery.data ?? null}
        onOpenChange={(open) => !open && closeDetailDialog()}
      />

      <Dialog open={Boolean(cancelRecord)} onOpenChange={(open) => !open && setCancelRecord(null)}>
        <DialogContent className="w-[calc(100%-1rem)] overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-base">Cancel IRN</DialogTitle>
            <DialogDescription>
              Cancels only the e-invoice IRN. The sales invoice and accounting voucher remain unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4">
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
          </div>
          <DialogFooter className="border-t px-5 py-3">
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
  onClearSelection,
  onCreate,
}: {
  open: boolean
  search: string
  invoices: SalesInvoice[]
  loading: boolean
  selectedSource: SalesInvoice | null
  eligibility: EInvoiceEligibility | null
  eligibilityLoading: boolean
  creating: boolean
  onOpenChange: (open: boolean) => void
  onSearchChange: (value: string) => void
  onSelect: (invoice: SalesInvoice) => void
  onClearSelection: () => void
  onCreate: () => void
}) {
  const canCreate = selectedSource && eligibility?.status === "ELIGIBLE"
  const eligibilityCopy = eligibility ? getEInvoiceEligibilityCopy(eligibility) : null
  const checkStatus = eligibility ? getEInvoiceEligibilityBadgeStatus(eligibility.status) : null
  const checkIssueCount =
    eligibility ?
      (eligibility.status === "ELIGIBLE" ? 0 : 1) + eligibility.warnings.length
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-3 pr-12">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex size-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
              <FileSignatureIcon className="size-4" />
            </span>
            Prepare e-invoice
          </DialogTitle>
          <DialogDescription className="text-xs leading-5">
            Select a posted B2B sales invoice. GSTfy validates it and locks the
            invoice payload before IRN generation.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b bg-muted/10 px-5 py-2.5">
          <div className="grid gap-2 sm:grid-cols-2">
            <StepPill active={!selectedSource} done={Boolean(selectedSource)} label="Select invoice" step="1" />
            <StepPill active={Boolean(selectedSource)} label="Readiness check" step="2" />
          </div>
        </div>

        {!selectedSource ? (
          <section className="min-w-0">
            <div className="border-b bg-muted/20 px-5 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Posted B2B invoices</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Pick the invoice that needs IRN.
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 bg-background text-[11px]">
                  {invoices.length} found
                </Badge>
              </div>
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
            <div className="app-scrollbar max-h-[24rem] overflow-auto p-2.5">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-[3.25rem] rounded-xl" />
                  ))}
                </div>
              ) : invoices.length === 0 ? (
                <Empty className="min-h-52 justify-center">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileSignatureIcon className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle>No posted sales invoices</EmptyTitle>
                    <EmptyDescription className="max-w-sm text-xs leading-5">
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
                        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left text-sm transition-colors hover:border-border hover:bg-muted/50"
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
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {formatEInvoiceDate(invoice.invoiceDate)}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-lg bg-background px-2 py-1 font-mono text-xs">
                        {formatCurrency(invoice.totalAmount)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="space-y-3 px-5 py-4">
            <div className="flex flex-col gap-3 rounded-2xl border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {selectedSource.invoiceNumber}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {selectedSource.customerName} · {formatEInvoiceDate(selectedSource.invoiceDate)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-xl bg-background px-3 py-2 font-mono text-sm font-semibold">
                  {formatCurrency(selectedSource.totalAmount)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={onClearSelection}
                >
                  <ArrowLeftIcon className="size-4" />
                  Change
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border bg-background p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                    <ShieldCheckIcon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">Readiness check</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      GSTfy checks whether this invoice can be prepared for IRN.
                    </p>
                  </div>
                </div>
                {checkStatus ? <EInvoiceStatusBadge status={checkStatus} /> : null}
              </div>

              {eligibilityLoading ? (
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ) : eligibility && eligibilityCopy ? (
                <div className="mt-4 space-y-3">
                  <div
                    className={cn(
                      "rounded-2xl border p-3",
                      eligibilityCopy.tone === "green" &&
                        "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
                      eligibilityCopy.tone === "amber" &&
                        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
                      eligibilityCopy.tone === "red" &&
                        "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300",
                      eligibilityCopy.tone === "blue" &&
                        "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{eligibilityCopy.title}</p>
                        <p className="mt-1 text-xs leading-5">
                          {eligibilityCopy.description}
                        </p>
                      </div>
                      {checkIssueCount > 0 ? (
                        <Badge variant="outline" className="shrink-0 bg-background text-[11px]">
                          {checkIssueCount} issue{checkIssueCount === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-muted/20 p-3 text-xs leading-5">
                    <p className="font-medium">What to do next</p>
                    <p className="mt-1 text-muted-foreground">{eligibilityCopy.action}</p>
                  </div>

                  {eligibility.warnings.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Warnings
                      </p>
                      {eligibility.warnings.map((warning) => (
                        <EligibilityWarningCard
                          key={`${warning.code}-${warning.message}`}
                          code={warning.code}
                          message={warning.message}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        )}

        <DialogFooter className="border-t px-5 py-3">
          {!selectedSource ? (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClearSelection}>
                Back to invoices
              </Button>
              <Button
                type="button"
                className="bg-blue-600 text-white hover:bg-blue-700"
                disabled={!canCreate || creating}
                onClick={onCreate}
              >
                {creating ?
                  <Spinner className="size-4" />
                : <FileSignatureIcon className="size-4" />}
                Prepare record
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StepPill({
  active,
  done = false,
  label,
  step,
}: {
  active: boolean
  done?: boolean
  label: string
  step: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
        active && "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300",
        !active && !done && "border-border bg-background text-muted-foreground",
        done && "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
          active && "bg-blue-600 text-white",
          done && "bg-emerald-600 text-white",
          !active && !done && "bg-muted text-muted-foreground"
        )}
      >
        {step}
      </span>
      <span className="truncate font-medium">{label}</span>
    </div>
  )
}

function EligibilityWarningCard({
  code,
  message,
}: {
  code: string
  message: string
}) {
  const copy = getEInvoiceWarningCopy(code, message)

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
      <p className="font-semibold">{copy.title}</p>
      <p className="mt-1">{copy.description}</p>
      <p className="mt-2">
        <span className="font-medium">Fix: </span>
        {copy.action}
      </p>
    </div>
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
    <div className={cn("rounded-xl p-2.5", toneClass)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">{label}</p>
        {icon}
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
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

function SortableEInvoiceTableHead({
  activeKey,
  className,
  direction,
  label,
  onSort,
  sortKey,
}: {
  activeKey: EInvoiceSortKey
  className?: string
  direction: EInvoiceSortDirection
  label: string
  onSort: (key: EInvoiceSortKey) => void
  sortKey: EInvoiceSortKey
}) {
  const active = activeKey === sortKey
  const Icon = !active ? ArrowDownUpIcon : direction === "asc" ? ArrowUpIcon : ArrowDownIcon

  return (
    <TableHead className={className}>
      <button
        type="button"
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-md text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-primary" : "text-foreground"
        )}
        onClick={() => onSort(sortKey)}
      >
        <span className="truncate">{label}</span>
        <Icon
          className={cn(
            "size-3 shrink-0",
            !active && "text-muted-foreground/70"
          )}
        />
      </button>
    </TableHead>
  )
}

function sortEInvoiceRecords(
  records: EInvoiceRecord[],
  key: EInvoiceSortKey,
  direction: EInvoiceSortDirection
) {
  return [...records].sort((first, second) => {
    const firstValue = getEInvoiceSortValue(first, key)
    const secondValue = getEInvoiceSortValue(second, key)

    if (typeof firstValue === "number" && typeof secondValue === "number") {
      return direction === "asc" ? firstValue - secondValue : secondValue - firstValue
    }

    const result = String(firstValue).localeCompare(String(secondValue), "en-IN", {
      numeric: true,
      sensitivity: "base",
    })

    return direction === "asc" ? result : -result
  })
}

function getEInvoiceSortValue(record: EInvoiceRecord, key: EInvoiceSortKey) {
  if (key === "date") {
    return new Date(record.documentDate).getTime()
  }

  if (key === "gstin") {
    return record.partyGstin ?? ""
  }

  if (key === "status") {
    return getEffectiveEInvoiceStatus(record)
  }

  if (key === "irn") {
    return record.irn ?? ""
  }

  if (key === "ack") {
    return record.ackNumber ?? ""
  }

  return `${record.sourceDocumentNumber} ${eInvoiceSourceTypeLabel(record.sourceDocumentType)}`
}

function getEInvoiceEligibilityBadgeStatus(
  status: EInvoiceEligibility["status"]
): EInvoiceSubmissionStatus {
  if (status === "ELIGIBLE") {
    return "READY"
  }

  if (status === "ALREADY_GENERATED") {
    return "IRN_GENERATED"
  }

  if (status === "NOT_ELIGIBLE") {
    return "NOT_REQUIRED"
  }

  return "VALIDATION_FAILED"
}

function getEInvoiceEligibilityCopy(eligibility: EInvoiceEligibility): {
  action: string
  description: string
  title: string
  tone: "green" | "amber" | "red" | "blue"
} {
  const fallback = {
    action: "Fix the invoice details shown here, then check readiness again.",
    description: eligibility.reason,
    title: toReadableCode(eligibility.reasonCode),
    tone: eligibility.status === "ELIGIBLE" ? "green" : "amber",
  } satisfies ReturnType<typeof getEInvoiceEligibilityCopy>

  const copies: Partial<
    Record<EInvoiceEligibility["reasonCode"], ReturnType<typeof getEInvoiceEligibilityCopy>>
  > = {
    IRN_ALREADY_GENERATED: {
      action:
        "Do not prepare this invoice again. Open it from E-invoice history to view the IRN. If the IRN was created by mistake, cancel that IRN first.",
      description:
        "This sales invoice already has an IRN. GST allows only one IRN for the same invoice number, date, GSTIN, and financial year.",
      title: "IRN already generated",
      tone: "green",
    },
    SOURCE_NOT_POSTED: {
      action: "Post the invoice first, then come back and prepare the e-invoice.",
      description: "Draft invoices cannot be sent for IRN generation.",
      title: "Invoice is still a draft",
      tone: "amber",
    },
    SUPPLIER_GST_REQUIRED: {
      action: "Add your business GST registration in Settings, then try again.",
      description: "GSTfy needs your GSTIN before it can prepare the IRN payload.",
      title: "Business GSTIN missing",
      tone: "red",
    },
    DOCUMENT_DATE_INVALID: {
      action: "Edit the invoice date and use a valid date.",
      description: "The invoice date is missing or invalid.",
      title: "Invoice date needs correction",
      tone: "red",
    },
    LINES_REQUIRED: {
      action: "Add at least one item or service line to the invoice.",
      description: "E-invoice generation needs item details, HSN/SAC, quantity, and tax values.",
      title: "Invoice has no line items",
      tone: "red",
    },
    REGISTERED_RECIPIENT_REQUIRED: {
      action: "Select a registered customer with a valid GSTIN, or keep this as a normal B2C invoice without e-invoice.",
      description: "E-invoice applies only when the buyer is GST registered.",
      title: "Customer GSTIN missing",
      tone: "amber",
    },
    B2B_SUPPLY_REQUIRED: {
      action: "Use e-invoice only for B2B sales. B2C invoices do not need IRN.",
      description: "This invoice is not marked as a B2B supply.",
      title: "Not a B2B invoice",
      tone: "amber",
    },
    TAX_INVOICE_REQUIRED: {
      action: "Use a tax invoice for e-invoice. Bill of supply documents are not submitted for IRN.",
      description: "This document type is not eligible for e-invoice generation.",
      title: "Tax invoice required",
      tone: "amber",
    },
    ELIGIBLE_REGISTERED_RECIPIENT: {
      action: "Prepare the record, validate it, then generate the IRN.",
      description: "This invoice has the required posted status, GSTIN details, and taxable lines.",
      title: "Ready for e-invoice",
      tone: "blue",
    },
  }

  return copies[eligibility.reasonCode] ?? fallback
}

function getEInvoiceWarningCopy(
  code: string,
  message: string
): {
  action: string
  description: string
  title: string
} {
  const copies: Record<string, { action: string; description: string; title: string }> = {
    TURNOVER_RULE_CONFIGURABLE: {
      action:
        "Open Settings and confirm whether your business needs e-invoice. After that, retry IRN preparation.",
      description:
        "GSTfy has not confirmed the e-invoice turnover setting for this business, so live IRN generation should not be used blindly.",
      title: "E-invoice requirement not confirmed",
    },
  }

  return (
    copies[code] ?? {
      action: "Review the invoice details and business settings, then try again.",
      description: message,
      title: toReadableCode(code),
    }
  )
}

function toReadableCode(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
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

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}

function canRetryGeneration(record: EInvoiceRecord) {
  return (
    record.providerName === "irp5" &&
    !record.irn &&
    !record.providerReference
  )
}
