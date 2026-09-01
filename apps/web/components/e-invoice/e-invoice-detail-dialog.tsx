"use client"

import Image from "next/image"
import * as React from "react"
import {
  ArrowDownIcon,
  ArrowDownUpIcon,
  ArrowUpIcon,
  BadgeCheckIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleDotIcon,
  CircleXIcon,
  CopyIcon,
  FileSignatureIcon,
  HistoryIcon,
  QrCodeIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"
import {
  type EInvoiceDetailResponse,
  type EInvoiceRecord,
  type EInvoiceStatusEvent,
  type EInvoiceSubmissionStatus,
  type EInvoiceValidationResult,
} from "@/lib/e-invoice/api"
import { createSignedQrDataUrl } from "@/lib/invoices/signed-qr"
import { cn } from "@/lib/utils"

type EInvoiceDetailDialogProps = {
  detail: EInvoiceDetailResponse | null
  loading: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

const detailTabs = [
  { value: "overview", label: "Overview", icon: ReceiptTextIcon },
  { value: "verification", label: "Verification", icon: QrCodeIcon },
  { value: "history", label: "History", icon: HistoryIcon },
]

type EInvoiceHistorySortKey = "event" | "status" | "createdAt" | "reference"
type EInvoiceHistorySortDirection = "asc" | "desc"

export function EInvoiceDetailDialog({
  detail,
  loading,
  open,
  onOpenChange,
}: EInvoiceDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-5xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-3 pr-12">
          <DialogTitle>E-invoice details</DialogTitle>
          <DialogDescription>
            IRN status, acknowledgement, validation checks and response details.
          </DialogDescription>
        </DialogHeader>
        <EInvoiceDetailView detail={detail} loading={loading} />
      </DialogContent>
    </Dialog>
  )
}

function EInvoiceDetailView({
  detail,
  loading,
}: {
  detail: EInvoiceDetailResponse | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-3 px-5 py-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    )
  }

  if (!detail?.eInvoice) {
    return null
  }

  const record = detail.eInvoice
  const effectiveStatus = getEffectiveEInvoiceStatus(record)
  const validation = record.validationResult as Partial<EInvoiceValidationResult>
  const canonicalPayload = detail.payloads.find(
    (payload) => payload.payloadType === "canonical"
  )
  const responsePayload = detail.payloads.find(
    (payload) => payload.payloadType === "response"
  )

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300">
            <FileSignatureIcon className="size-5" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold">
                {record.sourceDocumentNumber}
              </h2>
              <EInvoiceStatusBadge status={effectiveStatus} />
              <Badge variant="outline" className="bg-background">
                {eInvoiceSourceTypeLabel(record.sourceDocumentType)}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{formatEInvoiceDate(record.documentDate)}</span>
              {record.partyGstin ? (
                <>
                  <span>·</span>
                  <span className="font-mono tracking-[0.1em]">
                    {record.partyGstin}
                  </span>
                </>
              ) : null}
            </div>
            <p className="line-clamp-2 max-w-3xl text-xs leading-5 text-muted-foreground">
              E-invoice record created from this document.
              {record.ackNumber ? ` Acknowledgement ${record.ackNumber}.` : ""}
              {record.payloadHash ? " Invoice snapshot is saved for audit." : ""}
            </p>
          </div>
        </div>
        <div className="grid min-w-72 grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/20 p-3">
          <TinyDetail label="Ack no" value={record.ackNumber ?? "-"} mono />
          <TinyDetail label="Generated" value={formatDateTime(record.generatedAt)} />
          <TinyDetail label="Submitted" value={formatDateTime(record.submittedAt)} />
          <TinyDetail label="Updated" value={formatDateTime(record.updatedAt)} />
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-3">
        <TabsList className="app-scrollbar flex h-auto max-w-full justify-start gap-1 overflow-x-auto rounded-none border-0 bg-transparent p-0">
          {detailTabs.map(({ icon: Icon, label, value }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="min-w-fit gap-1.5 rounded-full border border-transparent bg-transparent px-3 py-1.5 text-xs shadow-none data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              <Icon className="size-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <EInvoiceDetailTabContent value="overview">
          <EInvoiceStatePanel record={record} status={effectiveStatus} />
          <EInvoiceDetailDataTable
            emptyIcon={<ReceiptTextIcon className="size-4" />}
            emptyText="E-invoice metadata will appear after a record is prepared."
            columns={["Field", "Value"]}
            rows={[
              ["Status", <EInvoiceStatusBadge key="status" status={effectiveStatus} />],
              ["Document date", formatEInvoiceDate(record.documentDate)],
              ["Source", eInvoiceSourceTypeLabel(record.sourceDocumentType)],
              ["Recipient GSTIN", record.partyGstin ?? "-"],
              ["Acknowledgement no", record.ackNumber ?? "-"],
              ["Acknowledgement date", formatDateTime(record.ackDate)],
            ]}
          />
          <EInvoiceDetailDataTable
            emptyIcon={<ShieldCheckIcon className="size-4" />}
            emptyTitle="No stored identifiers"
            emptyText="IRN and payload hash are stored after validation or generation."
            columns={["Identifier", "Value"]}
            rows={[
              [
                "IRN",
                <CopyableInput
                  key="irn"
                  value={record.irn}
                  fallback="Pending generation"
                  mono
                />,
              ],
              [
                "Payload hash",
                <CopyableInput
                  key="payload"
                  value={record.payloadHash ?? canonicalPayload?.contentHash}
                  fallback="Not generated"
                  mono
                />,
              ],
            ]}
          />
        </EInvoiceDetailTabContent>

        <EInvoiceDetailTabContent value="verification">
          <ValidationPanel validation={validation} />
          <SignedQrVerificationCard record={record} payload={responsePayload?.payload} />
          <ProviderResponseTable
            record={record}
            payload={responsePayload?.payload}
          />
        </EInvoiceDetailTabContent>

        <EInvoiceDetailTabContent value="history">
          <EInvoiceHistoryTable events={detail.events} />
        </EInvoiceDetailTabContent>
      </Tabs>
    </div>
  )
}

function EInvoiceStatePanel({
  record,
  status,
}: {
  record: EInvoiceRecord
  status: EInvoiceSubmissionStatus
}) {
  if (status === "IRN_GENERATED") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
          <BadgeCheckIcon className="size-4" />
          Generated successfully
        </div>
        <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
          <ResponseValue label="IRN" value={record.irn} mono />
          <ResponseValue label="Acknowledgement" value={record.ackNumber} mono />
          <ResponseValue label="Generated" value={formatDateTime(record.ackDate)} />
        </div>
      </div>
    )
  }

  if (status === "CANCELLED") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <XCircleIcon className="size-4" />
          E-invoice cancelled
        </div>
        <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
          <ResponseValue label="IRN" value={record.irn} mono />
          <ResponseValue label="Reason" value={record.cancelReason ?? "Not specified"} />
          <ResponseValue label="Cancelled" value={formatDateTime(record.cancelledAt)} />
        </div>
      </div>
    )
  }

  if (record.errorMessage) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
        <p className="font-medium">{record.errorCode ?? "E-invoice error"}</p>
        <p className="mt-1 text-xs leading-5">{record.errorMessage}</p>
      </div>
    )
  }

  return null
}

function EInvoiceDetailTabContent({
  children,
  value,
}: {
  children: React.ReactNode
  value: string
}) {
  return (
    <TabsContent value={value} className="mt-0">
      <div className="app-scrollbar max-h-[calc(100vh-21rem)] overflow-y-auto pr-1">
        <div className="space-y-3">{children}</div>
      </div>
    </TabsContent>
  )
}

function EInvoiceDetailDataTable({
  columns,
  emptyIcon,
  emptyText,
  emptyTitle = "No records",
  rows,
}: {
  columns: string[]
  emptyIcon?: React.ReactNode
  emptyText: string
  emptyTitle?: string
  rows: Array<Array<React.ReactNode>>
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      {rows.length === 0 ? (
        <Empty className="min-h-36 border-0 p-4">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="text-muted-foreground">
              {emptyIcon ?? <FileSignatureIcon className="size-4" />}
            </EmptyMedia>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription className="max-w-sm text-xs leading-5">
              {emptyText}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="app-scrollbar max-h-[18rem] overflow-auto">
          <table className="w-full table-fixed caption-bottom text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-3">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-transparent">
                {columns.map((column) => (
                  <th
                    key={column}
                    className="sticky top-0 z-20 bg-background text-left align-middle font-medium whitespace-nowrap text-foreground shadow-[0_1px_0_0_var(--border)]"
                  >
                    <span className="block truncate">{column}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        "max-w-56 truncate align-middle whitespace-nowrap",
                        cellIndex === 0 && "font-medium text-muted-foreground",
                        cellIndex === 1 && "font-medium"
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ValidationPanel({
  validation,
}: {
  validation: Partial<EInvoiceValidationResult>
}) {
  const blockingIssues = validation.blockingIssues ?? []
  const warnings = validation.warnings ?? []
  const issues = [...blockingIssues, ...warnings]

  if (!issues.length) {
    return (
      <Empty className="min-h-24 rounded-2xl border border-dashed p-3">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="text-emerald-600">
            <ShieldCheckIcon className="size-4" />
          </EmptyMedia>
          <EmptyTitle>All checks passed</EmptyTitle>
          <EmptyDescription className="max-w-sm text-xs leading-5">
            No blocking errors or warnings are recorded for this e-invoice.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Validation checks</h3>
      </div>
      <div className="grid gap-2">
        {issues.map((issue) => {
          const blocking = issue.severity === "blocking"

          return (
            <div
              key={`${issue.severity}-${issue.code}-${issue.message}`}
              className={cn(
                "rounded-xl border px-3 py-2 text-xs",
                blocking ?
                  "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
              )}
            >
              <p className="font-medium">{blocking ? "Fix required" : "Warning"}</p>
              <p className="mt-1 leading-5">{issue.message}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EInvoiceHistoryTable({ events }: { events: EInvoiceStatusEvent[] }) {
  const [sort, setSort] = React.useState<{
    key: EInvoiceHistorySortKey
    direction: EInvoiceHistorySortDirection
  }>({ key: "createdAt", direction: "desc" })

  if (!events.length) {
    return (
      <Empty className="min-h-36 rounded-2xl border border-dashed p-4">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon className="size-4" />
          </EmptyMedia>
          <EmptyTitle>No lifecycle events yet</EmptyTitle>
          <EmptyDescription className="max-w-sm text-xs leading-5">
            Validation, generation, retry, and cancellation events will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const sortedEvents = sortEInvoiceHistoryEvents(events, sort.key, sort.direction)

  function toggleSort(key: EInvoiceHistorySortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }))
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="app-scrollbar max-h-[18rem] overflow-auto">
        <table className="w-full table-fixed caption-bottom text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-3">
          <colgroup>
            <col className="w-[38%]" />
            <col className="w-[22%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead className="[&_tr]:border-b">
            <tr className="border-b transition-colors hover:bg-transparent">
              <th className="sticky top-0 z-20 bg-background text-left align-middle font-medium whitespace-nowrap text-foreground shadow-[0_1px_0_0_var(--border)]">
                <SortableHistoryTableHead
                  label="Event"
                  sortKey="event"
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={toggleSort}
                />
              </th>
              <th className="sticky top-0 z-20 bg-background text-left align-middle font-medium whitespace-nowrap text-foreground shadow-[0_1px_0_0_var(--border)]">
                <SortableHistoryTableHead
                  label="Status"
                  sortKey="status"
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={toggleSort}
                />
              </th>
              <th className="sticky top-0 z-20 bg-background text-left align-middle font-medium whitespace-nowrap text-foreground shadow-[0_1px_0_0_var(--border)]">
                <SortableHistoryTableHead
                  label="When"
                  sortKey="createdAt"
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={toggleSort}
                />
              </th>
              <th className="sticky top-0 z-20 bg-background text-left align-middle font-medium whitespace-nowrap text-foreground shadow-[0_1px_0_0_var(--border)]">
                <SortableHistoryTableHead
                  label="Reference"
                  sortKey="reference"
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={toggleSort}
                />
              </th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {sortedEvents.map((event) => (
              <tr
                key={event.id}
                className="border-b transition-colors hover:bg-muted/50"
              >
                <td className="align-middle whitespace-nowrap">
                  <div className="flex min-w-0 items-center gap-2">
                    <StatusDot status={event.status} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {event.message ?? event.eventType}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {event.eventType}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="align-middle whitespace-nowrap">
                  <div className="min-w-0 space-y-0.5">
                    <EInvoiceStatusBadge status={event.status} />
                    {event.previousStatus ? (
                      <p className="truncate text-[11px] text-muted-foreground">
                        from {eInvoiceStatusLabel(event.previousStatus)}
                      </p>
                    ) : null}
                  </div>
                </td>
                <td className="truncate align-middle whitespace-nowrap text-muted-foreground">
                  {formatDateTime(event.createdAt)}
                </td>
                <td className="truncate align-middle whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                  {event.providerReference ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SortableHistoryTableHead({
  activeKey,
  direction,
  label,
  onSort,
  sortKey,
}: {
  activeKey: EInvoiceHistorySortKey
  direction: EInvoiceHistorySortDirection
  label: string
  onSort: (key: EInvoiceHistorySortKey) => void
  sortKey: EInvoiceHistorySortKey
}) {
  const active = activeKey === sortKey
  const Icon = !active ? ArrowDownUpIcon : direction === "asc" ? ArrowUpIcon : ArrowDownIcon

  return (
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
  )
}

function sortEInvoiceHistoryEvents(
  events: EInvoiceStatusEvent[],
  key: EInvoiceHistorySortKey,
  direction: EInvoiceHistorySortDirection
) {
  return [...events].sort((first, second) => {
    const firstValue = getEInvoiceHistorySortValue(first, key)
    const secondValue = getEInvoiceHistorySortValue(second, key)

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

function getEInvoiceHistorySortValue(
  event: EInvoiceStatusEvent,
  key: EInvoiceHistorySortKey
) {
  if (key === "createdAt") {
    return new Date(event.createdAt).getTime()
  }

  if (key === "status") {
    return eInvoiceStatusLabel(event.status)
  }

  if (key === "reference") {
    return event.providerReference ?? ""
  }

  return event.message ?? event.eventType
}

function getSignedQrCode(record: EInvoiceRecord, payload: unknown) {
  if (record.signedQrCode) {
    return record.signedQrCode
  }

  const response =
    payload && typeof payload === "object" && !Array.isArray(payload) ?
      (payload as Record<string, unknown>)
    : null
  const responseData =
    response?.Data && typeof response.Data === "object" && !Array.isArray(response.Data) ?
      (response.Data as Record<string, unknown>)
    : response

  return responseData ? getResponseString(responseData, "SignedQRCode") : null
}

function ProviderResponseTable({
  record,
  payload,
}: {
  record: EInvoiceRecord
  payload: unknown
}) {
  const response =
    payload && typeof payload === "object" && !Array.isArray(payload) ?
      (payload as Record<string, unknown>)
    : {}
  const responseData =
    response.Data && typeof response.Data === "object" && !Array.isArray(response.Data) ?
      (response.Data as Record<string, unknown>)
    : response
  const providerStatus = getProviderStatusDisplay(
    getResponseString(responseData, "Status") ?? record.submissionStatus
  )

  return (
    <EInvoiceDetailDataTable
      emptyIcon={<QrCodeIcon className="size-4" />}
      emptyTitle="No response details"
      emptyText="Response details are stored after IRN generation or cancellation."
      columns={["Field", "Value"]}
      rows={[
        ["IRN", record.irn ?? getResponseString(responseData, "Irn") ?? "-"],
        [
          "Ack number",
          record.ackNumber ?? getResponseString(responseData, "AckNo") ?? "-",
        ],
        [
          "Status",
          <InlineStatusValue
            key="status"
            tone={providerStatus.tone}
            value={providerStatus.label}
          />,
        ],
        ["E-way bill", getResponseString(responseData, "EwbNo") ?? "Not generated"],
      ]}
    />
  )
}

function SignedQrVerificationCard({
  record,
  payload,
}: {
  record: EInvoiceRecord
  payload: unknown
}) {
  const signedQrCode = getSignedQrCode(record, payload)
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null)
  const [qrError, setQrError] = React.useState(false)
  const [previewOpen, setPreviewOpen] = React.useState(false)

  React.useEffect(() => {
    let active = true

    setQrDataUrl(null)
    setQrError(false)

    if (!signedQrCode) {
      return () => {
        active = false
      }
    }

    createSignedQrDataUrl(signedQrCode)
      .then((dataUrl) => {
        if (active) {
          setQrDataUrl(dataUrl)
        }
      })
      .catch(() => {
        if (active) {
          setQrError(true)
        }
      })

    return () => {
      active = false
    }
  }, [signedQrCode])

  if (!signedQrCode) {
    return (
      <Empty className="min-h-36 rounded-2xl border border-dashed p-4">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="text-muted-foreground">
            <QrCodeIcon className="size-4" />
          </EmptyMedia>
          <EmptyTitle>Signed QR not received</EmptyTitle>
          <EmptyDescription className="max-w-sm text-xs leading-5">
            The IRP signed QR will appear here after IRN generation succeeds.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        <div className="grid gap-0 md:grid-cols-[8.5rem_minmax(0,1fr)]">
          <div className="flex min-h-36 items-center justify-center border-b border-border bg-muted/20 p-2 md:border-b-0 md:border-r">
            {qrError ? (
              <div className="max-w-28 text-center text-xs leading-5 text-muted-foreground">
                Unable to render QR.
              </div>
            ) : qrDataUrl ? (
              <button
                type="button"
                className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setPreviewOpen(true)}
              >
                <Image
                  alt="IRP signed e-invoice QR code"
                  src={qrDataUrl}
                  width={320}
                  height={320}
                  className="aspect-square h-full max-h-28 w-full max-w-28 object-contain transition-transform group-hover:scale-[1.03]"
                  unoptimized
                />
                <span className="sr-only">Open QR code preview</span>
              </button>
            ) : (
              <Skeleton className="aspect-square h-full max-h-28 w-full max-w-28 rounded-xl" />
            )}
          </div>
          <div className="min-w-0 space-y-2.5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <QrCodeIcon className="size-4 text-emerald-600" />
                  <h3 className="text-sm font-medium">IRP signed QR</h3>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Click the QR to open a larger scan view.
                </p>
              </div>
            </div>
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <ResponseValue label="IRN" value={record.irn} mono />
              <ResponseValue label="Ack number" value={record.ackNumber} mono />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none gap-0 overflow-hidden border-border bg-background/98 p-0">
          <DialogHeader className="border-b border-border px-5 py-3 pr-12">
            <DialogTitle>IRP signed QR</DialogTitle>
            <DialogDescription>
              Large QR preview for scanning from the e-invoice verification record.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            {qrDataUrl ? (
              <Image
                alt="IRP signed e-invoice QR code large preview"
                src={qrDataUrl}
                width={720}
                height={720}
                className="aspect-square max-h-[min(72vh,42rem)] w-auto max-w-[min(82vw,42rem)] object-contain"
                unoptimized
              />
            ) : (
              <Skeleton className="aspect-square h-[min(72vh,42rem)] max-h-[42rem] w-[min(82vw,42rem)] max-w-[42rem] rounded-2xl" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TinyDetail({
  label,
  mono = false,
  value,
}: {
  label: string
  mono?: boolean
  value: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-0.5 truncate text-xs font-medium", mono && "font-mono")}>
        {value}
      </p>
    </div>
  )
}

function ResponseValue({
  label,
  mono = false,
  value,
}: {
  label: string
  mono?: boolean
  value: string | null | undefined
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate text-xs font-medium", mono && "font-mono")}>
        {value ?? "Not available"}
      </p>
    </div>
  )
}

function InlineStatusValue({
  tone,
  value,
}: {
  tone: "green" | "red" | "amber" | "zinc"
  value: string
}) {
  const dotClassName = {
    green: "bg-emerald-500",
    red: "bg-red-500",
    amber: "bg-amber-500",
    zinc: "bg-muted-foreground",
  }[tone]

  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span className={cn("size-2 rounded-full", dotClassName)} />
      <span className="truncate">{value}</span>
    </span>
  )
}

function CopyableInput({
  fallback = "Not available",
  mono = false,
  value,
}: {
  fallback?: string
  mono?: boolean
  value: string | null | undefined
}) {
  const [copied, setCopied] = React.useState(false)
  const displayValue = value ?? fallback

  async function copyValue() {
    if (!value) {
      return
    }

    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
    toast.success("Value copied.")
  }

  return (
    <div className="group relative min-w-0">
      <div className="relative">
        <input
          readOnly
          value={displayValue}
          className={cn(
            "h-8 w-full min-w-0 rounded-md border border-input bg-background px-2.5 pr-9 text-xs outline-none",
            mono && "font-mono",
            !value && "text-muted-foreground"
          )}
          title={displayValue}
        />
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 size-6 rounded-md bg-background opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="Copy value"
            onClick={copyValue}
          >
            {copied ?
              <CheckIcon className="size-3.5 text-emerald-600" />
            : <CopyIcon className="size-3.5 text-zinc-400" />}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: EInvoiceSubmissionStatus }) {
  const failed = status === "FAILED" || status === "CANCELLATION_FAILED"
  const cancelled = status === "CANCELLED"
  const Icon = failed ? CircleXIcon : cancelled ? CircleDotIcon : CircleCheckIcon

  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full border bg-background",
        failed && "border-red-200 text-red-600 dark:border-red-900 dark:text-red-400",
        cancelled &&
          "border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-300",
        !failed &&
          !cancelled &&
          "border-emerald-200 text-emerald-600 dark:border-emerald-900 dark:text-emerald-400"
      )}
    >
      <Icon className="size-3" />
    </span>
  )
}

export function EInvoiceStatusBadge({
  status,
}: {
  status: EInvoiceSubmissionStatus
}) {
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
      {eInvoiceStatusLabel(status)}
    </Badge>
  )
}

export function getEffectiveEInvoiceStatus(
  record: EInvoiceRecord
): EInvoiceSubmissionStatus {
  if (record.submissionStatus === "CANCELLED") {
    return "CANCELLED"
  }

  if (record.providerName === "irp5" && record.irn) {
    const response =
      record.rawExternalResponse &&
      typeof record.rawExternalResponse === "object" &&
      !Array.isArray(record.rawExternalResponse) ?
        (record.rawExternalResponse as Record<string, unknown>)
      : null
    const responseData =
      response?.Data && typeof response.Data === "object" && !Array.isArray(response.Data) ?
        (response.Data as Record<string, unknown>)
      : null
    const providerStatus = response?.Status ?? response?.status

    if (
      providerStatus === 1 ||
      providerStatus === "1" ||
      responseData?.Irn === record.irn ||
      responseData?.IRN === record.irn
    ) {
      return "IRN_GENERATED"
    }
  }

  return record.submissionStatus
}

export function eInvoiceStatusLabel(status: string) {
  if (status === "IRN_GENERATED") {
    return "Generated"
  }

  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
}

function getProviderStatusDisplay(value: string): {
  label: string
  tone: "green" | "red" | "amber" | "zinc"
} {
  if (value === "ACT" || value === "1" || value === "IRN_GENERATED") {
    return { label: "Active", tone: "green" }
  }

  if (
    value === "FAILED" ||
    value === "VALIDATION_FAILED" ||
    value === "CANCELLATION_FAILED"
  ) {
    return { label: eInvoiceStatusLabel(value), tone: "red" }
  }

  if (
    value === "PROCESSING" ||
    value === "SUBMITTING" ||
    value === "CANCELLATION_REQUESTED"
  ) {
    return { label: eInvoiceStatusLabel(value), tone: "amber" }
  }

  if (value === "CANCELLED" || value === "CNL") {
    return { label: "Cancelled", tone: "zinc" }
  }

  return { label: eInvoiceStatusLabel(value), tone: "zinc" }
}

export function eInvoiceSourceTypeLabel(sourceType: string) {
  const labels: Record<string, string> = {
    sales_invoice: "Sales invoice",
    credit_note: "Credit note",
    debit_note: "Debit note",
  }

  return labels[sourceType] ?? sourceType
}

export function formatEInvoiceDate(value: string | null | undefined) {
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

function getResponseString(response: Record<string, unknown>, key: string) {
  const value = response[key]
  return typeof value === "string" || typeof value === "number" ? String(value) : null
}
