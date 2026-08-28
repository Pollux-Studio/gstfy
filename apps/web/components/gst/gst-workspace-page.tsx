"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangleIcon,
  BadgeCheckIcon,
  ClipboardCheckIcon,
  DownloadIcon,
  FileBarChartIcon,
  FileSearchIcon,
  FileUpIcon,
  HistoryIcon,
  LandmarkIcon,
  ListChecksIcon,
  LockIcon,
  MoreHorizontalIcon,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { getStoredAuthSession } from "@/lib/auth/session"
import {
  cancelGstFilingRun,
  createGstFilingRun,
  getGstFilingAcknowledgement,
  getGstFilingRun,
  listGstFilingRuns,
  pollGstFilingRunStatus,
  retryGstFilingRun,
  submitGstFilingRun,
  validateGstFilingRun,
  type GstFilingMockMode,
  type GstFilingReturnType,
  type GstFilingRun,
  type GstFilingRunDetail,
  type GstFilingStatus,
} from "@/lib/gst-filing/api"
import {
  approveGstReportingRun,
  createGstReportingRun,
  downloadGstReportExport,
  exportGstr1,
  exportGstr3b,
  getGstFilingReview,
  getGstr1Dataset,
  getGstr3bDataset,
  listGstReportingRuns,
  lockGstReportingRun,
  markGstReportingReady,
  refreshGstReportingRun,
  type GstFilingReview,
  type GstReportMoneyRow,
  type GstReportingExportFormat,
  type GstReportingRun,
  type Gstr1Dataset,
  type Gstr3bDataset,
} from "@/lib/gst-reporting/api"
import {
  claimItc,
  deferItc,
  downloadCsvExport,
  exportGstReconciliation,
  exportItc,
  listGstExceptions,
  listGstReconciliation,
  listItc,
  markItcEligible,
  rejectItc,
  resolveGstException,
  reverseItc,
  unmatchGstRecord,
  type ItcStatus,
  type ReconciliationRow,
  type ReconciliationStatus,
} from "@/lib/gst-reconciliation/api"
import { getGstRegistrations } from "@/lib/organization/api"
import { cn } from "@/lib/utils"

type GstTab = "reconciliation" | "itc" | "filing" | "gstr1" | "gstr3b" | "filing-history" | "exceptions"
type ActionState =
  | { type: "eligible"; row: ReconciliationRow }
  | { type: "defer"; row: ReconciliationRow }
  | { type: "reject"; row: ReconciliationRow }
  | { type: "claim"; row: ReconciliationRow }
  | { type: "reverse"; row: ReconciliationRow }
  | { type: "unmatch"; row: ReconciliationRow }
  | { type: "resolve"; row: ReconciliationRow }

const matchStatusOptions: Array<{ value: ReconciliationStatus | "all"; label: string }> = [
  { value: "all", label: "All matches" },
  { value: "MATCHED", label: "Matched" },
  { value: "VALUE_MISMATCH", label: "Value mismatch" },
  { value: "TAX_MISMATCH", label: "Tax mismatch" },
  { value: "DATE_MISMATCH", label: "Date mismatch" },
  { value: "BOOKS_ONLY", label: "Books only" },
  { value: "EXTERNAL_ONLY", label: "External only" },
  { value: "MANUAL_REVIEW", label: "Manual review" },
]

const itcStatusOptions: Array<{ value: ItcStatus | "all"; label: string }> = [
  { value: "all", label: "All ITC" },
  { value: "NOT_REVIEWED", label: "Not reviewed" },
  { value: "ELIGIBLE", label: "Eligible" },
  { value: "PARTIALLY_ELIGIBLE", label: "Partially eligible" },
  { value: "DEFERRED", label: "Deferred" },
  { value: "INELIGIBLE", label: "Ineligible" },
  { value: "CLAIMED", label: "Claimed" },
  { value: "REVERSED", label: "Reversed" },
  { value: "REJECTED", label: "Rejected" },
]

const filingReturnOptions: Array<{ value: GstFilingReturnType; label: string }> = [
  { value: "GSTR1", label: "GSTR-1" },
  { value: "GSTR3B", label: "GSTR-3B" },
]

const filingMockModeOptions: Array<{ value: GstFilingMockMode; label: string }> = [
  { value: "MOCK_ACCEPT", label: "Mock accept" },
  { value: "MOCK_PROCESSING", label: "Mock processing" },
  { value: "MOCK_REJECT", label: "Mock reject" },
  { value: "MOCK_TIMEOUT", label: "Mock timeout" },
]

export function GstWorkspacePage() {
  const queryClient = useQueryClient()
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const [tab, setTab] = React.useState<GstTab>("reconciliation")
  const [period, setPeriod] = React.useState(defaultPeriod())
  const [search, setSearch] = React.useState("")
  const [matchStatus, setMatchStatus] = React.useState<ReconciliationStatus | "all">("all")
  const [itcStatus, setItcStatus] = React.useState<ItcStatus | "all">("all")
  const [gstRegistrationId, setGstRegistrationId] = React.useState("")
  const [actionState, setActionState] = React.useState<ActionState | null>(null)
  const [actionReason, setActionReason] = React.useState("")
  const [claimPeriod, setClaimPeriod] = React.useState(defaultPeriod())
  const [filingMockMode, setFilingMockMode] = React.useState<GstFilingMockMode>("MOCK_ACCEPT")
  const [filingDetailId, setFilingDetailId] = React.useState<string | null>(null)

  const gstRegistrationsQuery = useQuery({
    queryKey: ["gst", "registrations"],
    queryFn: () => getGstRegistrations(accessToken),
    enabled: accessToken.length > 0,
  })
  const gstRegistrations = gstRegistrationsQuery.data?.gstRegistrations ?? []
  const selectedGstRegistrationId = gstRegistrationId || gstRegistrations[0]?.id || ""

  const commonQuery = {
    period,
    search,
    matchStatus,
    itcStatus,
    gstRegistrationId: selectedGstRegistrationId || undefined,
    page: 1,
    limit: 15,
  }
  const reconciliationQuery = useQuery({
    queryKey: ["gst", "reconciliation", commonQuery],
    queryFn: () => listGstReconciliation(accessToken, commonQuery),
    enabled: accessToken.length > 0,
  })
  const itcQuery = useQuery({
    queryKey: ["gst", "itc", commonQuery],
    queryFn: () => listItc(accessToken, commonQuery),
    enabled: accessToken.length > 0,
  })
  const exceptionsQuery = useQuery({
    queryKey: ["gst", "exceptions", period],
    queryFn: () => listGstExceptions(accessToken, { period, status: "all", limit: 15 }),
    enabled: accessToken.length > 0,
  })
  const reportingRunsQuery = useQuery({
    queryKey: ["gst", "reporting", "runs", period, selectedGstRegistrationId],
    queryFn: () =>
      listGstReportingRuns(accessToken, {
        period,
        gstRegistrationId: selectedGstRegistrationId,
        page: 1,
        limit: 1,
      }),
    enabled: accessToken.length > 0 && selectedGstRegistrationId.length > 0,
  })
  const currentRun = reportingRunsQuery.data?.runs[0] ?? null
  const reportQuery = currentRun
    ? { runId: currentRun.id }
    : { period, gstRegistrationId: selectedGstRegistrationId }
  const filingReviewQuery = useQuery({
    queryKey: ["gst", "reporting", "review", currentRun?.id],
    queryFn: () => getGstFilingReview(accessToken, reportQuery),
    enabled: accessToken.length > 0 && Boolean(currentRun),
  })
  const gstr1Query = useQuery({
    queryKey: ["gst", "reporting", "gstr1", currentRun?.id],
    queryFn: () => getGstr1Dataset(accessToken, reportQuery),
    enabled: accessToken.length > 0 && Boolean(currentRun),
  })
  const gstr3bQuery = useQuery({
    queryKey: ["gst", "reporting", "gstr3b", currentRun?.id],
    queryFn: () => getGstr3bDataset(accessToken, reportQuery),
    enabled: accessToken.length > 0 && Boolean(currentRun),
  })
  const filingRunsQuery = useQuery({
    queryKey: ["gst", "filing", "runs", period, selectedGstRegistrationId],
    queryFn: () =>
      listGstFilingRuns(accessToken, {
        period,
        gstRegistrationId: selectedGstRegistrationId,
        page: 1,
        limit: 15,
      }),
    enabled: accessToken.length > 0 && selectedGstRegistrationId.length > 0,
  })
  const filingDetailQuery = useQuery({
    queryKey: ["gst", "filing", "detail", filingDetailId],
    queryFn: () => getGstFilingRun(accessToken, filingDetailId ?? ""),
    enabled: accessToken.length > 0 && Boolean(filingDetailId),
  })

  const exportReconciliationMutation = useMutation({
    mutationFn: () => exportGstReconciliation(accessToken, commonQuery),
    onSuccess: downloadCsvExport,
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const exportItcMutation = useMutation({
    mutationFn: () => exportItc(accessToken, commonQuery),
    onSuccess: downloadCsvExport,
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const createRunMutation = useMutation({
    mutationFn: () =>
      createGstReportingRun(accessToken, {
        period,
        gstRegistrationId: selectedGstRegistrationId,
      }),
    onSuccess: async () => {
      await invalidateGstQueries(queryClient)
      toast.success("GST report generated.")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const refreshRunMutation = useMutation({
    mutationFn: () => {
      if (!currentRun) {
        throw new Error("Generate a GST report first.")
      }

      return refreshGstReportingRun(accessToken, currentRun.id)
    },
    onSuccess: async () => {
      await invalidateGstQueries(queryClient)
      toast.success("GST report refreshed.")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const readyRunMutation = useMutation({
    mutationFn: () => {
      if (!currentRun) {
        throw new Error("Generate a GST report first.")
      }

      return markGstReportingReady(accessToken, currentRun.id)
    },
    onSuccess: async () => {
      await invalidateGstQueries(queryClient)
      toast.success("GST filing review marked ready.")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const approveRunMutation = useMutation({
    mutationFn: () => {
      if (!currentRun) {
        throw new Error("Generate a GST report first.")
      }

      return approveGstReportingRun(
        accessToken,
        currentRun.id,
        "Approved from GST filing review"
      )
    },
    onSuccess: async () => {
      await invalidateGstQueries(queryClient)
      toast.success("GST filing review approved.")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const lockRunMutation = useMutation({
    mutationFn: () => {
      if (!currentRun) {
        throw new Error("Generate a GST report first.")
      }

      return lockGstReportingRun(accessToken, currentRun.id)
    },
    onSuccess: async () => {
      await invalidateGstQueries(queryClient)
      toast.success("GST report locked.")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const exportGstr1Mutation = useMutation({
    mutationFn: (format: GstReportingExportFormat) => exportGstr1(accessToken, { ...reportQuery, format }),
    onSuccess: downloadGstReportExport,
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const exportGstr3bMutation = useMutation({
    mutationFn: (format: GstReportingExportFormat) => exportGstr3b(accessToken, { ...reportQuery, format }),
    onSuccess: downloadGstReportExport,
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const createFilingRunMutation = useMutation({
    mutationFn: (returnType: GstFilingReturnType) => {
      if (!currentRun) {
        throw new Error("Generate and approve a GST report before creating a filing run.")
      }

      return createGstFilingRun(accessToken, {
        reportingRunId: currentRun.id,
        returnType,
      })
    },
    onSuccess: async (result) => {
      await invalidateGstQueries(queryClient)
      toast.success(`${formatReturnType(result.filingRun.returnType)} filing run is ready.`)
      setTab("filing-history")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const validateFilingRunMutation = useMutation({
    mutationFn: (runId: string) => validateGstFilingRun(accessToken, runId),
    onSuccess: async (result) => {
      await invalidateGstQueries(queryClient)
      const blockers = result.validation.blockingIssues.length
      toast.success(blockers > 0 ? "Filing validation completed with blockers." : "Filing validation passed.")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const submitFilingRunMutation = useMutation({
    mutationFn: ({ runId, mockMode }: { runId: string; mockMode: GstFilingMockMode }) =>
      submitGstFilingRun(accessToken, runId, mockMode),
    onSuccess: async (result) => {
      await invalidateGstQueries(queryClient)
      toast.success(`Filing status: ${formatEnum(result.filingRun.status)}`)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const pollFilingRunMutation = useMutation({
    mutationFn: (runId: string) => pollGstFilingRunStatus(accessToken, runId),
    onSuccess: async (result) => {
      await invalidateGstQueries(queryClient)
      toast.success(`Filing status: ${formatEnum(result.filingRun.status)}`)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const retryFilingRunMutation = useMutation({
    mutationFn: (runId: string) => retryGstFilingRun(accessToken, runId, "Retry after correction"),
    onSuccess: async () => {
      await invalidateGstQueries(queryClient)
      toast.success("Retry filing run created.")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const cancelFilingRunMutation = useMutation({
    mutationFn: (runId: string) => cancelGstFilingRun(accessToken, runId, "Cancelled from filing history"),
    onSuccess: async () => {
      await invalidateGstQueries(queryClient)
      toast.success("Filing run cancelled.")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const acknowledgementMutation = useMutation({
    mutationFn: (runId: string) => getGstFilingAcknowledgement(accessToken, runId),
    onSuccess: (result) => {
      toast.success("Acknowledgement available", {
        description: result.acknowledgement.acknowledgementNumber,
      })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const actionMutation = useMutation({
    mutationFn: async () => {
      if (!actionState) {
        return null
      }

      const row = actionState.row

      if (actionState.type === "eligible") {
        return markItcEligible(accessToken, row.record.id, { reason: actionReason })
      }

      if (actionState.type === "defer") {
        return deferItc(accessToken, row.record.id, { reason: actionReason })
      }

      if (actionState.type === "reject") {
        return rejectItc(accessToken, row.record.id, { reason: actionReason })
      }

      if (actionState.type === "claim") {
        return claimItc(accessToken, row.record.id, {
          claimPeriod,
          reason: actionReason || null,
        })
      }

      if (actionState.type === "reverse") {
        return reverseItc(accessToken, row.record.id, { reason: actionReason })
      }

      if (actionState.type === "unmatch") {
        return unmatchGstRecord(accessToken, row.record.id, { reason: actionReason })
      }

      return resolveGstException(accessToken, row.record.id, {
        exceptionId: row.exception?.id,
        status: "RESOLVED",
        resolution: actionReason,
      })
    },
    onSuccess: async () => {
      await invalidateGstQueries(queryClient)
      setActionState(null)
      setActionReason("")
      toast.success("GST record updated")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const visibleRows = tab === "itc" ? itcQuery.data?.items : reconciliationQuery.data?.items
  const loadingRows = tab === "itc" ? itcQuery.isLoading : reconciliationQuery.isLoading
  const summary = reconciliationQuery.data?.summary ?? itcQuery.data?.summary

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 bg-background">
                <LandmarkIcon className="size-3.5" />
                GST
              </Badge>
              <Badge className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                <span className="size-1.5 rounded-full bg-current" />
                ITC review
              </Badge>
            </div>
            <div className="mt-3 max-w-2xl space-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                GST reconciliation
              </h1>
              <p className="max-w-xl text-sm leading-5 text-muted-foreground">
                Review purchase GST, resolve exceptions, and control ITC claims.
              </p>
            </div>
          </div>
          <div className="border-t border-border bg-muted/10 p-4 sm:p-5 lg:border-l lg:border-t-0">
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  <ClipboardCheckIcon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Month-end flow</p>
                  <p className="text-xs text-muted-foreground">
                    Review generated GST data, fix mismatches, then claim only reviewed ITC.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <GstMetric label="Books ITC" value={formatCurrency(summary?.booksItc ?? "0")} tone="blue" />
        <GstMetric label="External ITC" value={formatCurrency(summary?.externalItc ?? "0")} tone="emerald" />
        <GstMetric label="Matched" value={String(summary?.matched ?? 0)} tone="emerald" />
        <GstMetric label="Mismatch" value={String(summary?.mismatch ?? 0)} tone="amber" />
        <GstMetric label="Claimed" value={String(summary?.claimed ?? 0)} tone="blue" />
      </section>

      <Tabs value={tab} defaultValue="reconciliation" onValueChange={(value) => setTab(value as GstTab)} className="gap-0 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <TabsList className="flex h-auto flex-wrap justify-start rounded-none border-0 bg-transparent p-0">
            <TabsTrigger value="reconciliation" className="min-w-0 rounded-none bg-transparent px-2 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
              Reconciliation
            </TabsTrigger>
            <TabsTrigger value="itc" className="min-w-0 rounded-none bg-transparent px-2 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
              ITC
            </TabsTrigger>
            <TabsTrigger value="filing" className="min-w-0 rounded-none bg-transparent px-2 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
              Filing Review
            </TabsTrigger>
            <TabsTrigger value="gstr1" className="min-w-0 rounded-none bg-transparent px-2 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
              GSTR-1
            </TabsTrigger>
            <TabsTrigger value="gstr3b" className="min-w-0 rounded-none bg-transparent px-2 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
              GSTR-3B
            </TabsTrigger>
            <TabsTrigger value="filing-history" className="min-w-0 rounded-none bg-transparent px-2 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
              Filing History
            </TabsTrigger>
            <TabsTrigger value="exceptions" className="min-w-0 rounded-none bg-transparent px-2 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none">
              Exceptions
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selectedGstRegistrationId}
              onValueChange={(value) => {
                if (value) {
                  setGstRegistrationId(value)
                }
              }}
            >
              <SelectTrigger className="h-8 w-56">
                <SelectDisplayValue
                  value={selectedGstRegistrationId}
                  options={gstRegistrations.map((registration) => ({
                    value: registration.id,
                    label: registration.gstin,
                  }))}
                  placeholder="GSTIN"
                />
              </SelectTrigger>
              <SelectContent>
                {gstRegistrations.map((registration) => (
                  <SelectItem key={registration.id} value={registration.id}>
                    {registration.gstin}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value || defaultPeriod())}
              className="h-8 w-36"
            />
            {tab === "filing" || tab === "gstr1" || tab === "gstr3b" ? (
              <>
                <Button
                  size="sm"
                  className="h-8 gap-2 bg-blue-600 text-white hover:bg-blue-700"
                  disabled={!selectedGstRegistrationId || createRunMutation.isPending}
                  onClick={() => createRunMutation.mutate()}
                >
                  {createRunMutation.isPending ? <Spinner className="size-4" /> : <FileBarChartIcon className="size-4" />}
                  Generate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-2"
                  disabled={!currentRun || refreshRunMutation.isPending}
                  onClick={() => refreshRunMutation.mutate()}
                >
                  {refreshRunMutation.isPending ? <Spinner className="size-4" /> : <RefreshCcwIcon className="size-4" />}
                  Refresh
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <TabsContent value="reconciliation" className="m-0">
          <DataToolbar
            search={search}
            onSearchChange={setSearch}
            matchStatus={matchStatus}
            onMatchStatusChange={setMatchStatus}
            itcStatus={itcStatus}
            onItcStatusChange={setItcStatus}
            onExport={() => exportReconciliationMutation.mutate()}
            exporting={exportReconciliationMutation.isPending}
          />
          <ReconciliationTable
            rows={visibleRows ?? []}
            loading={loadingRows}
            mode="reconciliation"
            onAction={setActionState}
          />
        </TabsContent>

        <TabsContent value="itc" className="m-0">
          <DataToolbar
            search={search}
            onSearchChange={setSearch}
            matchStatus={matchStatus}
            onMatchStatusChange={setMatchStatus}
            itcStatus={itcStatus}
            onItcStatusChange={setItcStatus}
            onExport={() => exportItcMutation.mutate()}
            exporting={exportItcMutation.isPending}
          />
          <ReconciliationTable
            rows={visibleRows ?? []}
            loading={loadingRows}
            mode="itc"
            onAction={setActionState}
          />
        </TabsContent>

        <TabsContent value="filing" className="m-0">
          <FilingReviewPanel
            run={currentRun}
            review={filingReviewQuery.data}
            loading={filingReviewQuery.isLoading || reportingRunsQuery.isLoading}
            onMarkReady={() => readyRunMutation.mutate()}
            onApprove={() => approveRunMutation.mutate()}
            onLock={() => lockRunMutation.mutate()}
            markingReady={readyRunMutation.isPending}
            approving={approveRunMutation.isPending}
            locking={lockRunMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="gstr1" className="m-0">
          <Gstr1Panel
            dataset={gstr1Query.data}
            loading={gstr1Query.isLoading || reportingRunsQuery.isLoading}
            onExport={(format) => exportGstr1Mutation.mutate(format)}
            exporting={exportGstr1Mutation.isPending}
          />
        </TabsContent>

        <TabsContent value="gstr3b" className="m-0">
          <Gstr3bPanel
            dataset={gstr3bQuery.data}
            loading={gstr3bQuery.isLoading || reportingRunsQuery.isLoading}
            onExport={(format) => exportGstr3bMutation.mutate(format)}
            exporting={exportGstr3bMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="filing-history" className="m-0">
          <FilingHistoryPanel
            run={currentRun}
            filingRuns={filingRunsQuery.data?.filingRuns ?? []}
            loading={filingRunsQuery.isLoading || reportingRunsQuery.isLoading}
            mockMode={filingMockMode}
            onMockModeChange={setFilingMockMode}
            onCreate={(returnType) => createFilingRunMutation.mutate(returnType)}
            onValidate={(runId) => validateFilingRunMutation.mutate(runId)}
            onSubmit={(runId) => submitFilingRunMutation.mutate({ runId, mockMode: filingMockMode })}
            onPoll={(runId) => pollFilingRunMutation.mutate(runId)}
            onRetry={(runId) => retryFilingRunMutation.mutate(runId)}
            onCancel={(runId) => cancelFilingRunMutation.mutate(runId)}
            onView={setFilingDetailId}
            onAcknowledgement={(runId) => acknowledgementMutation.mutate(runId)}
            creating={createFilingRunMutation.isPending}
            validating={validateFilingRunMutation.isPending}
            submitting={submitFilingRunMutation.isPending}
            polling={pollFilingRunMutation.isPending}
            retrying={retryFilingRunMutation.isPending}
            cancelling={cancelFilingRunMutation.isPending}
            checkingAcknowledgement={acknowledgementMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="exceptions" className="m-0">
          <ExceptionList
            loading={exceptionsQuery.isLoading}
            exceptions={exceptionsQuery.data?.exceptions ?? []}
          />
        </TabsContent>

      </Tabs>

      <FilingDetailDialog
        open={Boolean(filingDetailId)}
        loading={filingDetailQuery.isLoading}
        detail={filingDetailQuery.data}
        onOpenChange={(open) => {
          if (!open) {
            setFilingDetailId(null)
          }
        }}
      />

      <ActionDialog
        state={actionState}
        reason={actionReason}
        claimPeriod={claimPeriod}
        loading={actionMutation.isPending}
        onReasonChange={setActionReason}
        onClaimPeriodChange={setClaimPeriod}
        onOpenChange={(open) => {
          if (!open) {
            setActionState(null)
            setActionReason("")
          }
        }}
        onConfirm={() => actionMutation.mutate()}
      />
    </main>
  )
}

function FilingHistoryPanel({
  run,
  filingRuns,
  loading,
  mockMode,
  onMockModeChange,
  onCreate,
  onValidate,
  onSubmit,
  onPoll,
  onRetry,
  onCancel,
  onView,
  onAcknowledgement,
  creating,
  validating,
  submitting,
  polling,
  retrying,
  cancelling,
  checkingAcknowledgement,
}: {
  run: GstReportingRun | null
  filingRuns: GstFilingRun[]
  loading: boolean
  mockMode: GstFilingMockMode
  onMockModeChange: (value: GstFilingMockMode) => void
  onCreate: (returnType: GstFilingReturnType) => void
  onValidate: (runId: string) => void
  onSubmit: (runId: string) => void
  onPoll: (runId: string) => void
  onRetry: (runId: string) => void
  onCancel: (runId: string) => void
  onView: (runId: string) => void
  onAcknowledgement: (runId: string) => void
  creating: boolean
  validating: boolean
  submitting: boolean
  polling: boolean
  retrying: boolean
  cancelling: boolean
  checkingAcknowledgement: boolean
}) {
  const canCreate = run?.status === "READY_FOR_SUBMISSION"

  if (loading) {
    return <TableSkeleton />
  }

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 bg-background">
              <HistoryIcon className="size-3.5" />
              Filing attempts
            </Badge>
            {run ? <RunStatusBadge status={run.status} /> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Submit only from approved reporting snapshots. Mock adapter is used until GSTN credentials are configured.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={mockMode} onValueChange={(value) => onMockModeChange(value as GstFilingMockMode)}>
            <SelectTrigger className="h-8 w-44">
              <SelectDisplayValue value={mockMode} options={filingMockModeOptions} placeholder="Mock mode" />
            </SelectTrigger>
            <SelectContent align="end">
              {filingMockModeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filingReturnOptions.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={option.value === "GSTR1" ? "default" : "outline"}
              className={cn(
                "h-8 gap-2",
                option.value === "GSTR1" && "bg-blue-600 text-white hover:bg-blue-700"
              )}
              disabled={!canCreate || creating}
              onClick={() => onCreate(option.value)}
            >
              {creating ? <Spinner className="size-4" /> : <FileUpIcon className="size-4" />}
              Create {option.label}
            </Button>
          ))}
        </div>
      </div>

      {!run ? (
        <ReportEmpty
          title="No approved GST report yet"
          description="Generate, review, approve, and mark the GST report ready before creating a filing attempt."
        />
      ) : filingRuns.length === 0 ? (
        <Empty className="mx-4 my-6 min-h-72 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HistoryIcon className="size-4" />
            </EmptyMedia>
            <EmptyTitle>No filing attempts yet</EmptyTitle>
            <EmptyDescription>
              Once the GST report is ready for submission, create GSTR-1 and GSTR-3B filing runs here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <p className="text-xs text-muted-foreground">
              Current report status: {formatEnum(run.status)}
            </p>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="max-h-[30rem] overflow-auto">
          <Table className="table-fixed text-xs">
            <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[12%]">Return</TableHead>
                <TableHead className="w-[10%]">Period</TableHead>
                <TableHead className="w-[12%]">Attempt</TableHead>
                <TableHead className="w-[16%]">Status</TableHead>
                <TableHead className="w-[14%]">Version</TableHead>
                <TableHead className="w-[18%]">Acknowledgement</TableHead>
                <TableHead className="w-[18%] pr-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filingRuns.map((filingRun) => (
                <TableRow key={filingRun.id}>
                  <TableCell className="font-medium">{formatReturnType(filingRun.returnType)}</TableCell>
                  <TableCell className="font-mono">{filingRun.period}</TableCell>
                  <TableCell>Attempt {filingRun.attemptNumber}</TableCell>
                  <TableCell>
                    <FilingStatusBadge status={filingRun.status} />
                    {filingRun.errorMessage ? (
                      <p className="mt-1 truncate text-[11px] text-destructive" title={filingRun.errorMessage}>
                        {filingRun.errorMessage}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <p className="truncate font-mono">{filingRun.schemaVersion ?? "-"}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {filingRun.payloadHash ? filingRun.payloadHash.slice(0, 10) : "No payload"}
                    </p>
                  </TableCell>
                  <TableCell>
                    {filingRun.acknowledgementNumber ? (
                      <button
                        type="button"
                        className="max-w-full truncate font-mono text-blue-600 hover:underline"
                        disabled={checkingAcknowledgement}
                        onClick={() => onAcknowledgement(filingRun.id)}
                      >
                        {filingRun.acknowledgementNumber}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                    <p className="truncate text-[11px] text-muted-foreground">
                      {filingRun.submittedAt ? `Submitted ${formatDate(filingRun.submittedAt)}` : "Not submitted"}
                    </p>
                  </TableCell>
                  <TableCell className="pr-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onView(filingRun.id)}>
                        View
                      </Button>
                      {canValidateFilingRun(filingRun.status) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          disabled={validating}
                          onClick={() => onValidate(filingRun.id)}
                        >
                          {validating ? <Spinner className="size-3.5" /> : <BadgeCheckIcon className="size-3.5" />}
                          Validate
                        </Button>
                      ) : null}
                      {filingRun.status === "READY_FOR_SUBMISSION" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-blue-600"
                          disabled={submitting}
                          onClick={() => onSubmit(filingRun.id)}
                        >
                          {submitting ? <Spinner className="size-3.5" /> : <SendIcon className="size-3.5" />}
                          Submit
                        </Button>
                      ) : null}
                      {canPollFilingRun(filingRun.status) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          disabled={polling}
                          onClick={() => onPoll(filingRun.id)}
                        >
                          {polling ? <Spinner className="size-3.5" /> : <RefreshCcwIcon className="size-3.5" />}
                          Status
                        </Button>
                      ) : null}
                      {canRetryFilingRun(filingRun.status) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          disabled={retrying}
                          onClick={() => onRetry(filingRun.id)}
                        >
                          {retrying ? <Spinner className="size-3.5" /> : <RotateCcwIcon className="size-3.5" />}
                          Retry
                        </Button>
                      ) : null}
                      {filingRun.status === "REJECTED" ? (
                        <span className="self-center text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          Correction required
                        </span>
                      ) : null}
                      {canCancelFilingRun(filingRun.status) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive"
                          disabled={cancelling}
                          onClick={() => onCancel(filingRun.id)}
                        >
                          {cancelling ? <Spinner className="size-3.5" /> : <XCircleIcon className="size-3.5" />}
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            Showing {filingRuns.length} filing attempts
          </div>
        </div>
      )}
    </div>
  )
}

function FilingDetailDialog({
  open,
  loading,
  detail,
  onOpenChange,
}: {
  open: boolean
  loading: boolean
  detail: GstFilingRunDetail | undefined
  onOpenChange: (open: boolean) => void
}) {
  const run = detail?.filingRun
  const validation = run?.validationResult

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>GST filing attempt</DialogTitle>
          <DialogDescription>
            Payload version, validation result, external status, and audit trail for this filing run.
          </DialogDescription>
        </DialogHeader>
        {loading || !detail || !run ? (
          <div className="grid gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid max-h-[70vh] gap-4 overflow-auto pr-1">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FilingDetailMetric label="Return" value={formatReturnType(run.returnType)} />
              <FilingDetailMetric label="Status" value={formatEnum(run.status)} />
              <FilingDetailMetric label="Attempt" value={String(run.attemptNumber)} />
              <FilingDetailMetric label="Schema" value={run.schemaVersion ?? "-"} />
              <FilingDetailMetric label="Submitted" value={run.submittedAt ? formatDate(run.submittedAt) : "Not submitted"} />
              <FilingDetailMetric label="External ref" value={run.externalReference ?? "-"} />
              <FilingDetailMetric label="Acknowledgement" value={run.acknowledgementNumber ?? "-"} />
              <FilingDetailMetric label="Payload hash" value={run.payloadHash ? run.payloadHash.slice(0, 16) : "-"} />
              <FilingDetailMetric label="Response received" value={run.externalResponseReceivedAt ? formatDate(run.externalResponseReceivedAt) : "-"} />
              <FilingDetailMetric label="Artifact" value={run.acknowledgementArtifactId ?? "Not stored"} />
              <FilingDetailMetric label="Correction" value={run.correctionRequiredAt ? "Required" : "Not required"} />
              <FilingDetailMetric label="Correction reason" value={run.correctionReason ?? "-"} />
            </section>

            <section className="rounded-2xl border border-border">
              <div className="border-b border-border px-4 py-2">
                <h3 className="text-sm font-medium">Validation</h3>
                <p className="text-xs text-muted-foreground">
                  Blocking issues stop submission; warnings are retained for audit.
                </p>
              </div>
              <div className="grid gap-2 p-3">
                {!validation ? (
                  <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Validate this run to generate payload checks.
                  </p>
                ) : [...validation.blockingIssues, ...validation.warnings].length === 0 ? (
                  <p className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                    No validation issues found.
                  </p>
                ) : (
                  [...validation.blockingIssues, ...validation.warnings].map((issue) => (
                    <div key={`${issue.severity}-${issue.code}`} className="flex gap-3 rounded-xl border border-border p-3">
                      <AlertTriangleIcon className={cn("mt-0.5 size-4 shrink-0", issue.severity === "blocking" ? "text-destructive" : "text-amber-600")} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{issue.code}</p>
                        <p className="text-sm text-muted-foreground">{issue.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border">
              <div className="border-b border-border px-4 py-2">
                <h3 className="text-sm font-medium">Generated payloads</h3>
              </div>
              <Table className="table-fixed text-xs">
                <TableHeader className="bg-muted/60">
                  <TableRow>
                    <TableHead className="w-[18%]">Type</TableHead>
                    <TableHead className="w-[18%]">Schema</TableHead>
                    <TableHead>Content hash</TableHead>
                    <TableHead className="w-[18%]">Generated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.payloads.map((payload) => (
                    <TableRow key={payload.id}>
                      <TableCell className="font-medium">{formatEnum(payload.payloadType)}</TableCell>
                      <TableCell className="font-mono">{payload.schemaVersion}</TableCell>
                      <TableCell className="truncate font-mono">{payload.contentHash}</TableCell>
                      <TableCell>{formatDate(payload.generatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>

            <section className="rounded-2xl border border-border">
              <div className="border-b border-border px-4 py-2">
                <h3 className="text-sm font-medium">Status trail</h3>
              </div>
              <Table className="table-fixed text-xs">
                <TableHeader className="bg-muted/60">
                  <TableRow>
                    <TableHead className="w-[20%]">Event</TableHead>
                    <TableHead className="w-[18%]">From</TableHead>
                    <TableHead className="w-[18%]">To</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-[18%]">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{formatEnum(event.eventType)}</TableCell>
                      <TableCell>{event.previousStatus ? formatEnum(event.previousStatus) : "-"}</TableCell>
                      <TableCell><FilingStatusBadge status={event.status} /></TableCell>
                      <TableCell className="truncate text-muted-foreground">{event.message ?? "-"}</TableCell>
                      <TableCell>{formatDate(event.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FilingDetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-muted/20 p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  )
}

function FilingReviewPanel({
  run,
  review,
  loading,
  onMarkReady,
  onApprove,
  onLock,
  markingReady,
  approving,
  locking,
}: {
  run: GstReportingRun | null
  review: GstFilingReview | undefined
  loading: boolean
  onMarkReady: () => void
  onApprove: () => void
  onLock: () => void
  markingReady: boolean
  approving: boolean
  locking: boolean
}) {
  if (loading) {
    return <TableSkeleton />
  }

  if (!run || !review) {
    return (
      <ReportEmpty
        title="Generate this month's GST report"
        description="Choose a GSTIN and period, then generate the filing review dataset."
      />
    )
  }

  return (
    <div className="space-y-0">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <RunStatusBadge status={run.status} />
            <Badge variant="outline" className="gap-1.5 bg-background">
              {run.period}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Review blocking issues before marking this GST period ready.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-2"
            disabled={!review.status.canMarkReady || markingReady || run.status !== "REVIEW"}
            onClick={onMarkReady}
          >
            {markingReady ? <Spinner className="size-4" /> : <ShieldCheckIcon className="size-4" />}
            Ready for CA review
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-2"
            disabled={run.status !== "READY_FOR_CA_REVIEW" || approving}
            onClick={onApprove}
          >
            {approving ? <Spinner className="size-4" /> : <ClipboardCheckIcon className="size-4" />}
            CA approve
          </Button>
          <Button
            size="sm"
            className="h-8 gap-2 bg-blue-600 text-white hover:bg-blue-700"
            disabled={run.status !== "CA_APPROVED" || locking}
            onClick={onLock}
          >
            {locking ? <Spinner className="size-4" /> : <LockIcon className="size-4" />}
            Ready to submit
          </Button>
        </div>
      </div>
      <section className="grid gap-3 border-b border-border p-4 md:grid-cols-3 xl:grid-cols-6">
        <GstMetric label="Output GST" value={formatCurrency(review.summary.outputGst)} tone="amber" />
        <GstMetric label="Claimed ITC" value={formatCurrency(review.summary.inputGst)} tone="emerald" />
        <GstMetric label="Net GST" value={formatCurrency(review.summary.netGst)} tone="blue" />
        <GstMetric label="RCM" value={formatCurrency(review.summary.rcm)} tone="amber" />
        <GstMetric label="Eligible ITC" value={formatCurrency(review.summary.eligibleItc)} tone="emerald" />
        <GstMetric label="Blockers" value={review.summary.unresolvedExceptions} tone={review.status.blockingCount > 0 ? "amber" : "emerald"} />
      </section>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ReportMoneyTable title="Sales reporting sections" rows={review.sections.sales} />
        <div className="border-t border-border p-4 lg:border-l lg:border-t-0">
          <div className="mb-3 flex items-center gap-2">
            <FileSearchIcon className="size-4 text-blue-600" />
            <h3 className="text-sm font-medium">Exceptions</h3>
          </div>
          {review.sections.exceptions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No filing exceptions found for this run.
            </p>
          ) : (
            <div className="space-y-2">
              {review.sections.exceptions.slice(0, 6).map((exception) => (
                <div key={exception.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={cn("border-transparent", exception.isBlocking ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300")}>
                      {formatEnum(exception.severity)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatEnum(exception.status)}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{exception.message}</p>
                  {exception.recommendation ? (
                    <p className="mt-1 text-xs text-muted-foreground">{exception.recommendation}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Gstr1Panel({
  dataset,
  loading,
  onExport,
  exporting,
}: {
  dataset: Gstr1Dataset | undefined
  loading: boolean
  onExport: (format: GstReportingExportFormat) => void
  exporting: boolean
}) {
  if (loading) {
    return <TableSkeleton />
  }

  if (!dataset) {
    return (
      <ReportEmpty
        title="No GSTR-1 dataset yet"
        description="Generate a GST reporting run to see outward supplies, notes, HSN, and document summary."
      />
    )
  }

  return (
    <div>
      <ReportHeader
        title="GSTR-1 dataset"
        description="Outward supplies, notes, HSN/SAC, and document summary from posted source documents."
        onExport={onExport}
        exporting={exporting}
      />
      <section className="grid gap-3 border-b border-border p-4 md:grid-cols-3 xl:grid-cols-6">
        <GstMetric label="Taxable" value={formatCurrency(dataset.totals.taxableValue)} tone="blue" />
        <GstMetric label="CGST" value={formatCurrency(dataset.totals.cgst)} tone="emerald" />
        <GstMetric label="SGST" value={formatCurrency(dataset.totals.sgst)} tone="emerald" />
        <GstMetric label="IGST" value={formatCurrency(dataset.totals.igst)} tone="amber" />
        <GstMetric label="Cess" value={formatCurrency(dataset.totals.cess)} tone="amber" />
        <GstMetric label="Tax" value={formatCurrency(dataset.totals.totalTax)} tone="blue" />
      </section>
      <ReportMoneyTable title="Sections" rows={dataset.sections} />
      <HsnSummaryTable rows={dataset.hsn} />
      <DocumentSummaryTable rows={dataset.documents} />
    </div>
  )
}

function Gstr3bPanel({
  dataset,
  loading,
  onExport,
  exporting,
}: {
  dataset: Gstr3bDataset | undefined
  loading: boolean
  onExport: (format: GstReportingExportFormat) => void
  exporting: boolean
}) {
  if (loading) {
    return <TableSkeleton />
  }

  if (!dataset) {
    return (
      <ReportEmpty
        title="No GSTR-3B dataset yet"
        description="Generate a GST reporting run to see tax liability, ITC, RCM, and net GST."
      />
    )
  }

  return (
    <div>
      <ReportHeader
        title="GSTR-3B dataset"
        description="Tax liability and ITC summary prepared from posted GST and ITC records."
        onExport={onExport}
        exporting={exporting}
      />
      <section className="grid gap-3 border-b border-border p-4 md:grid-cols-3">
        <GstMetric label="Output GST" value={formatCurrency(dataset.totals.outputTax)} tone="amber" />
        <GstMetric label="Claimed ITC" value={formatCurrency(dataset.totals.claimedItc)} tone="emerald" />
        <GstMetric label="Net GST" value={formatCurrency(dataset.totals.netGst)} tone="blue" />
      </section>
      <ReportMoneyTable title="Outward supplies" rows={dataset.outward} />
      <div className="border-t border-border">
        <Table>
          <TableHeader className="bg-muted/60">
            <TableRow>
              <TableHead>ITC bucket</TableHead>
              <TableHead className="text-right">CGST</TableHead>
              <TableHead className="text-right">SGST</TableHead>
              <TableHead className="text-right">IGST</TableHead>
              <TableHead className="text-right">Cess</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              ["Available", dataset.itc?.availableCgst, dataset.itc?.availableSgst, dataset.itc?.availableIgst, dataset.itc?.availableCess],
              ["Claimed", dataset.itc?.claimedCgst, dataset.itc?.claimedSgst, dataset.itc?.claimedIgst, dataset.itc?.claimedCess],
              ["Deferred", dataset.itc?.deferredCgst, dataset.itc?.deferredSgst, dataset.itc?.deferredIgst, dataset.itc?.deferredCess],
              ["Ineligible", dataset.itc?.ineligibleCgst, dataset.itc?.ineligibleSgst, dataset.itc?.ineligibleIgst, dataset.itc?.ineligibleCess],
            ].map(([label, cgst, sgst, igst, cess]) => (
              <TableRow key={String(label)}>
                <TableCell className="font-medium">{label}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(String(cgst ?? "0"))}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(String(sgst ?? "0"))}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(String(igst ?? "0"))}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(String(cess ?? "0"))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function ReportHeader({
  title,
  description,
  onExport,
  exporting,
}: {
  title: string
  description: string
  onExport: (format: GstReportingExportFormat) => void
  exporting: boolean
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(["csv", "json", "xlsx"] as const).map((format) => (
          <Button
            key={format}
            size="sm"
            variant="outline"
            className="h-8 gap-2"
            disabled={exporting}
            onClick={() => onExport(format)}
          >
            {exporting ? <Spinner className="size-4" /> : <DownloadIcon className="size-4" />}
            {format.toUpperCase()}
          </Button>
        ))}
      </div>
    </div>
  )
}

function ReportMoneyTable({ title, rows }: { title: string; rows: GstReportMoneyRow[] }) {
  return (
    <div className="border-t border-border first:border-t-0">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <ListChecksIcon className="size-4 text-blue-600" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <Table>
        <TableHeader className="bg-muted/60">
          <TableRow>
            <TableHead>Section</TableHead>
            <TableHead className="text-right">Records</TableHead>
            <TableHead className="text-right">Taxable</TableHead>
            <TableHead className="text-right">CGST</TableHead>
            <TableHead className="text-right">SGST</TableHead>
            <TableHead className="text-right">IGST</TableHead>
            <TableHead className="text-right">Cess</TableHead>
            <TableHead className="text-right">Tax</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8}>
                <p className="py-6 text-center text-sm text-muted-foreground">No records in this section.</p>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.classification}>
                <TableCell className="font-medium">{formatEnum(row.classification)}</TableCell>
                <TableCell className="text-right">{row.count}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(row.taxableValue)}</TableCell>
                <TableCell className="text-right font-mono text-emerald-700 dark:text-emerald-300">{formatCurrency(row.cgst)}</TableCell>
                <TableCell className="text-right font-mono text-emerald-700 dark:text-emerald-300">{formatCurrency(row.sgst)}</TableCell>
                <TableCell className="text-right font-mono text-amber-700 dark:text-amber-300">{formatCurrency(row.igst)}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(row.cess)}</TableCell>
                <TableCell className="text-right font-mono font-medium">{formatCurrency(row.totalTax)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function HsnSummaryTable({ rows }: { rows: Gstr1Dataset["hsn"] }) {
  return (
    <div className="border-t border-border">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <FileBarChartIcon className="size-4 text-blue-600" />
        <h3 className="text-sm font-medium">HSN/SAC summary</h3>
      </div>
      <Table>
        <TableHeader className="bg-muted/60">
          <TableRow>
            <TableHead>HSN/SAC</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>UQC</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Taxable</TableHead>
            <TableHead className="text-right">Tax</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.hsnSac}-${row.uqc}`}>
              <TableCell className="font-mono">{row.hsnSac}</TableCell>
              <TableCell className="max-w-[18rem] truncate">{row.description}</TableCell>
              <TableCell>{row.uqc}</TableCell>
              <TableCell className="text-right font-mono">{row.quantity}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(row.taxableValue)}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(row.totalTax)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function DocumentSummaryTable({ rows }: { rows: Gstr1Dataset["documents"] }) {
  return (
    <div className="border-t border-border">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <ClipboardCheckIcon className="size-4 text-blue-600" />
        <h3 className="text-sm font-medium">Document summary</h3>
      </div>
      <Table>
        <TableHeader className="bg-muted/60">
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>First no.</TableHead>
            <TableHead>Last no.</TableHead>
            <TableHead className="text-right">Issued</TableHead>
            <TableHead className="text-right">Taxable</TableHead>
            <TableHead className="text-right">Tax</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.sourceDocumentType}>
              <TableCell className="font-medium">{formatEnum(row.sourceDocumentType)}</TableCell>
              <TableCell className="font-mono">{row.firstNumber}</TableCell>
              <TableCell className="font-mono">{row.lastNumber}</TableCell>
              <TableCell className="text-right">{row.issuedCount}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(row.taxableValue)}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(row.totalTax)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ReportEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="min-h-72 border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileBarChartIcon className="size-6" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <p className="text-xs text-muted-foreground">
          Reports are generated from posted GST facts and reviewed ITC decisions only.
        </p>
      </EmptyContent>
    </Empty>
  )
}

function RunStatusBadge({ status }: { status: GstReportingRun["status"] }) {
  const tone =
    status === "FILED" || status === "SUBMITTED" || status === "READY_FOR_SUBMISSION" || status === "LOCKED" ? "bg-blue-600 text-white"
      : status === "CA_APPROVED" || status === "READY_FOR_CA_REVIEW" ? "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-300"

  return <Badge className={tone}>{formatEnum(status)}</Badge>
}

function DataToolbar({
  search,
  onSearchChange,
  matchStatus,
  onMatchStatusChange,
  itcStatus,
  onItcStatusChange,
  onExport,
  exporting,
}: {
  search: string
  onSearchChange: (value: string) => void
  matchStatus: ReconciliationStatus | "all"
  onMatchStatusChange: (value: ReconciliationStatus | "all") => void
  itcStatus: ItcStatus | "all"
  onItcStatusChange: (value: ItcStatus | "all") => void
  onExport: () => void
  exporting: boolean
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search supplier, GSTIN, invoice"
            className="h-8 pl-8"
          />
        </div>
        <Select value={matchStatus} onValueChange={(value) => onMatchStatusChange((value as ReconciliationStatus | "all") ?? "all")}>
          <SelectTrigger className="h-8 w-44">
            <SelectDisplayValue value={matchStatus} options={matchStatusOptions} placeholder="Match status" />
          </SelectTrigger>
          <SelectContent align="start">
            {matchStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={itcStatus} onValueChange={(value) => onItcStatusChange((value as ItcStatus | "all") ?? "all")}>
          <SelectTrigger className="h-8 w-44">
            <SelectDisplayValue value={itcStatus} options={itcStatusOptions} placeholder="ITC status" />
          </SelectTrigger>
          <SelectContent align="start">
            {itcStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button variant="outline" size="sm" className="h-8 gap-2" onClick={onExport} disabled={exporting}>
        {exporting ? <Spinner /> : <DownloadIcon className="size-4" />}
        Export CSV
      </Button>
    </div>
  )
}

function ReconciliationTable({
  rows,
  loading,
  mode,
  onAction,
}: {
  rows: ReconciliationRow[]
  loading: boolean
  mode: "reconciliation" | "itc"
  onAction: (state: ActionState) => void
}) {
  if (loading) {
    return <TableSkeleton />
  }

  if (rows.length === 0) {
    return (
      <Empty className="mx-4 my-6 min-h-72 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileSearchIcon className="size-4" />
          </EmptyMedia>
          <EmptyTitle>No GST records found</EmptyTitle>
          <EmptyDescription>
            Posted purchase bills and generated GST data will appear here for matching.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="max-h-[30rem] overflow-auto">
      <Table className="table-fixed text-xs">
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[22%]">Supplier</TableHead>
            <TableHead className="w-[15%]">Invoice</TableHead>
            <TableHead className="w-[10%]">Date</TableHead>
            <TableHead className="w-[12%] text-right">Books</TableHead>
            <TableHead className="w-[12%] text-right">External</TableHead>
            <TableHead className="w-[11%]">Match</TableHead>
            <TableHead className="w-[10%]">ITC</TableHead>
            <TableHead className="w-[8%] pr-3 text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.record.id}>
              <TableCell>
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-medium">{row.record.supplierName}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {row.record.supplierGstin ?? "Unregistered"}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <p className="truncate font-mono text-xs">{row.record.invoiceNumber}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {row.record.inputType === "rcm" ? "RCM" : row.record.sourceType.replace(/_/g, " ")}
                </p>
              </TableCell>
              <TableCell>{formatDate(row.record.invoiceDate)}</TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(row.record.totalTax)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {row.externalRecord ? formatCurrency(row.externalRecord.totalTax) : "-"}
              </TableCell>
              <TableCell>
                <MatchBadge status={row.record.reconciliationStatus} />
              </TableCell>
              <TableCell>
                <ItcBadge status={row.record.itcStatus} />
              </TableCell>
              <TableCell className="pr-3 text-right">
                <div className="flex justify-end gap-1">
                  {mode === "itc" ? (
                    <ItcActionButtons row={row} onAction={onAction} />
                  ) : (
                    <>
                      {row.match && row.record.itcStatus !== "CLAIMED" ? (
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onAction({ type: "unmatch", row })}>
                          Unmatch
                        </Button>
                      ) : null}
                      {row.exception ? (
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onAction({ type: "resolve", row })}>
                          Resolve
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        Showing {rows.length} records
      </div>
    </div>
  )
}

function ItcActionButtons({
  row,
  onAction,
}: {
  row: ReconciliationRow
  onAction: (state: ActionState) => void
}) {
  const status = row.record.itcStatus

  const menuTrigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="ml-auto aria-expanded:bg-muted"
      aria-label={`Open ITC actions for ${row.record.invoiceNumber}`}
    />
  )

  if (status === "NOT_REVIEWED" || status === "DEFERRED") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={menuTrigger}>
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6}>
          <DropdownMenuItem onClick={() => onAction({ type: "eligible", row })}>Mark eligible</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction({ type: "defer", row })}>Defer ITC</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => onAction({ type: "reject", row })}>Reject ITC</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (status === "ELIGIBLE" || status === "PARTIALLY_ELIGIBLE") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={menuTrigger}>
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6}>
          <DropdownMenuItem onClick={() => onAction({ type: "claim", row })}>Claim ITC</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (status === "CLAIMED") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={menuTrigger}>
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6}>
          <DropdownMenuItem variant="destructive" onClick={() => onAction({ type: "reverse", row })}>Reverse claim</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return <span className="text-[11px] text-muted-foreground">Locked</span>
}

function ExceptionList({
  exceptions,
  loading,
}: {
  exceptions: Array<{
    id: string
    exceptionType: string
    severity: string
    status: string
    reason: string | null
  }>
  loading: boolean
}) {
  if (loading) {
    return <TableSkeleton />
  }

  if (exceptions.length === 0) {
    return (
      <Empty className="mx-4 my-6 min-h-72 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListChecksIcon className="size-4" />
          </EmptyMedia>
          <EmptyTitle>No open GST exceptions</EmptyTitle>
          <EmptyDescription>
            Mismatches, missing purchases, and duplicate GSTR-2B records will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="max-h-[30rem] overflow-auto">
      <Table className="table-fixed text-xs">
        <TableHeader className="sticky top-0 z-10 bg-muted/95">
          <TableRow>
            <TableHead className="w-[25%]">Type</TableHead>
            <TableHead className="w-[15%]">Severity</TableHead>
            <TableHead className="w-[15%]">Status</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exceptions.map((exception) => (
            <TableRow key={exception.id}>
              <TableCell className="font-medium">{formatEnum(exception.exceptionType)}</TableCell>
              <TableCell>
                <SeverityBadge severity={exception.severity} />
              </TableCell>
              <TableCell>{formatEnum(exception.status)}</TableCell>
              <TableCell className="truncate text-muted-foreground">{exception.reason}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ActionDialog({
  state,
  reason,
  claimPeriod,
  loading,
  onReasonChange,
  onClaimPeriodChange,
  onOpenChange,
  onConfirm,
}: {
  state: ActionState | null
  reason: string
  claimPeriod: string
  loading: boolean
  onReasonChange: (value: string) => void
  onClaimPeriodChange: (value: string) => void
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const copy = getActionCopy(state)

  return (
    <Dialog open={Boolean(state)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {state ? <DecisionSafetyPanel row={state.row} /> : null}
          {state?.type === "claim" ? (
            <Input type="month" value={claimPeriod} onChange={(event) => onClaimPeriodChange(event.target.value)} />
          ) : null}
          <Textarea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Enter reason for audit"
            className="min-h-24"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={loading || reason.trim().length < 3} onClick={onConfirm}>
            {loading ? <Spinner /> : copy.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DecisionSafetyPanel({ row }: { row: ReconciliationRow }) {
  const bookTax = toNumber(row.record.totalTax)
  const externalTax = row.externalRecord ? toNumber(row.externalRecord.totalTax) : 0
  const eligible = sumAmounts(
    row.record.eligibleCgst,
    row.record.eligibleSgst,
    row.record.eligibleIgst,
    row.record.eligibleCess
  )
  const alreadyClaimed = row.record.itcStatus === "CLAIMED" ? eligible : 0
  const remainingClaimable =
    row.record.itcStatus === "ELIGIBLE" || row.record.itcStatus === "PARTIALLY_ELIGIBLE" ?
      eligible
      : 0

  return (
    <div className="grid gap-2 rounded-2xl border border-border bg-muted/20 p-3 text-sm">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <SafetyMetric label="Book tax" value={formatCurrency(bookTax)} />
        <SafetyMetric label="External tax" value={row.externalRecord ? formatCurrency(externalTax) : "Not matched"} />
        <SafetyMetric
          label="Difference"
          value={row.externalRecord ? formatCurrency(bookTax - externalTax) : "-"}
          tone={row.externalRecord && Math.abs(bookTax - externalTax) > 0 ? "warning" : "default"}
        />
        <SafetyMetric label="Current ITC" value={formatEnum(row.record.itcStatus)} />
        <SafetyMetric label="Eligible" value={formatCurrency(eligible)} tone="success" />
        <SafetyMetric label="Already claimed" value={formatCurrency(alreadyClaimed)} />
        <SafetyMetric label="Remaining claimable" value={formatCurrency(remainingClaimable)} tone="success" />
      </div>
    </div>
  )
}

function SafetyMetric({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "success" | "warning"
}) {
  return (
    <div className="min-w-0 rounded-xl bg-background p-2">
      <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate font-mono text-xs font-medium",
          tone === "success" && "text-emerald-700 dark:text-emerald-300",
          tone === "warning" && "text-amber-700 dark:text-amber-300"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function GstMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "emerald" | "amber" | "blue"
}) {
  const tones = {
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900/60",
    amber: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-900/60",
    blue: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-900/60",
  }

  return (
    <div className={cn("rounded-2xl border p-4", tones[tone])}>
      <p className="text-xs font-medium uppercase tracking-[0.14em] opacity-80">{label}</p>
      <p className="mt-2 truncate font-mono text-lg font-semibold">{value}</p>
    </div>
  )
}

function MatchBadge({ status }: { status: ReconciliationStatus }) {
  const tone =
    status === "MATCHED" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "NOT_MATCHED" ? "bg-muted text-muted-foreground"
        : status === "BOOKS_ONLY" || status === "EXTERNAL_ONLY" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "bg-red-500/10 text-red-700 dark:text-red-300"

  return <Badge className={cn("border-transparent", tone)}>{formatEnum(status)}</Badge>
}

function ItcBadge({ status }: { status: ItcStatus }) {
  const tone =
    status === "CLAIMED" || status === "ELIGIBLE" || status === "PARTIALLY_ELIGIBLE" ?
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "DEFERRED" || status === "NOT_REVIEWED" ?
        "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "bg-red-500/10 text-red-700 dark:text-red-300"

  return <Badge className={cn("border-transparent", tone)}>{formatEnum(status)}</Badge>
}

function FilingStatusBadge({ status }: { status: GstFilingStatus }) {
  const tone =
    status === "FILED" || status === "ACCEPTED" ?
      "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "READY_FOR_SUBMISSION" || status === "SUBMITTED" || status === "PROCESSING" || status === "SUBMITTING" ?
        "border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-300"
        : status === "REJECTED" || status === "FAILED" || status === "CANCELLED" ?
          "border-transparent bg-red-500/10 text-red-700 dark:text-red-300"
          : "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-300"

  return <Badge className={cn("max-w-full truncate", tone)}>{formatEnum(status)}</Badge>
}

function SeverityBadge({ severity }: { severity: string }) {
  const tone =
    severity === "HIGH" ? "bg-red-500/10 text-red-700 dark:text-red-300"
      : severity === "LOW" ? "bg-muted text-muted-foreground"
        : "bg-amber-500/10 text-amber-700 dark:text-amber-300"

  return <Badge className={cn("border-transparent", tone)}>{formatEnum(severity)}</Badge>
}

function TableSkeleton() {
  return (
    <div className="grid gap-2 p-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-10 rounded-lg" />
      ))}
    </div>
  )
}

function getActionCopy(state: ActionState | null) {
  if (!state) {
    return {
      title: "Update GST record",
      description: "Add a reason before saving this audited change.",
      action: "Save",
    }
  }

  const labels = {
    eligible: ["Mark ITC eligible", "This moves the record into claimable ITC.", "Mark eligible"],
    defer: ["Defer ITC", "Use this when ITC should be claimed in a later period.", "Defer"],
    reject: ["Reject ITC", "Use this when the tax is not claimable.", "Reject"],
    claim: ["Claim ITC", "This creates an immutable ITC claim snapshot for the selected period.", "Claim"],
    reverse: ["Reverse ITC claim", "This reverses the active claim and keeps the audit history.", "Reverse"],
    unmatch: ["Unmatch GST record", "This releases the book and external record for review.", "Unmatch"],
    resolve: ["Resolve exception", "This closes the reconciliation exception with your reason.", "Resolve"],
  }[state.type]

  return {
    title: labels[0],
    description: labels[1],
    action: labels[2],
  }
}

async function invalidateGstQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["gst", "reconciliation"] }),
    queryClient.invalidateQueries({ queryKey: ["gst", "itc"] }),
    queryClient.invalidateQueries({ queryKey: ["gst", "exceptions"] }),
    queryClient.invalidateQueries({ queryKey: ["gst", "imports"] }),
    queryClient.invalidateQueries({ queryKey: ["gst", "reporting"] }),
    queryClient.invalidateQueries({ queryKey: ["gst", "filing"] }),
  ])
}

function defaultPeriod() {
  return new Date().toISOString().slice(0, 7)
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0)

  return Number.isFinite(parsed) ? parsed : 0
}

function sumAmounts(...values: Array<string | number | null | undefined>) {
  return values.reduce<number>((total, value) => total + toNumber(value), 0)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatReturnType(value: GstFilingReturnType) {
  return filingReturnOptions.find((option) => option.value === value)?.label ?? value
}

function canValidateFilingRun(status: GstFilingStatus) {
  return status === "DRAFT" || status === "VALIDATED" || status === "READY_FOR_SUBMISSION"
}

function canPollFilingRun(status: GstFilingStatus) {
  return status === "SUBMITTED" || status === "PROCESSING" || status === "ACCEPTED"
}

function canRetryFilingRun(status: GstFilingStatus) {
  return status === "FAILED"
}

function canCancelFilingRun(status: GstFilingStatus) {
  return status === "DRAFT" || status === "VALIDATED" || status === "READY_FOR_SUBMISSION" || status === "FAILED"
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong."
}
