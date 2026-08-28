"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ActivityIcon,
  AlertTriangleIcon,
  BoxesIcon,
  CheckCircle2Icon,
  Clock3Icon,
  DatabaseIcon,
  ListRestartIcon,
  LockKeyholeIcon,
  PlayIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  TerminalSquareIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
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
import { toast } from "@/components/ui/toast"
import {
  getStoredAuthSession,
  subscribeToAuthSessionChange,
} from "@/lib/auth/session"
import {
  getOpsJobEvents,
  getOpsLogs,
  getOpsOverview,
  getOpsQueue,
  requeueDueOpsJobs,
  retryOpsJob,
  runOpsJobNow,
  type OpsAutomationJob,
  type OpsAutomationJobEvent,
  type OpsAutomationJobStatus,
  type OpsLogEntry,
  type OpsLogLevel,
  type OpsOverview,
} from "@/lib/ops/api"
import { cn } from "@/lib/utils"

type OpsTab = "logs" | "queue" | "migrations"
type LogFilter = OpsLogLevel | "all"
type QueueFilter = OpsAutomationJobStatus | "all"

const logLevelOptions: Array<{ value: LogFilter; label: string }> = [
  { value: "all", label: "All logs" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warnings" },
  { value: "error", label: "Errors" },
]

const queueStatusOptions: Array<{ value: QueueFilter; label: string }> = [
  { value: "all", label: "All jobs" },
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "retry_scheduled", label: "Retry scheduled" },
  { value: "failed", label: "Failed" },
  { value: "completed", label: "Completed" },
  { value: "skipped", label: "Skipped" },
]

const queueStatuses: OpsAutomationJobStatus[] = [
  "queued",
  "running",
  "retry_scheduled",
  "failed",
  "completed",
  "skipped",
]

const opsTabs = [
  { value: "logs", label: "Logs", icon: TerminalSquareIcon },
  { value: "queue", label: "Queue", icon: BoxesIcon },
  { value: "migrations", label: "Migrations", icon: DatabaseIcon },
] as const

export function OpsDashboardPage() {
  const session = React.useSyncExternalStore(
    subscribeToAuthSessionChange,
    getStoredAuthSession,
    () => null
  )
  const accessToken = session?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState<OpsTab>("logs")
  const [logLevel, setLogLevel] = React.useState<LogFilter>("all")
  const [queueStatus, setQueueStatus] = React.useState<QueueFilter>("all")
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null)

  const overviewQuery = useQuery({
    queryKey: ["ops", "overview"],
    queryFn: () => getOpsOverview(accessToken),
    enabled: accessToken.length > 0,
    refetchInterval: 15_000,
  })
  const logsQuery = useQuery({
    queryKey: ["ops", "logs", logLevel],
    queryFn: () => getOpsLogs(accessToken, { level: logLevel }),
    enabled: accessToken.length > 0,
    refetchInterval: 5_000,
  })
  const queueQuery = useQuery({
    queryKey: ["ops", "queue", queueStatus],
    queryFn: () => getOpsQueue(accessToken, { status: queueStatus }),
    enabled: accessToken.length > 0,
    refetchInterval: 10_000,
  })
  const jobEventsQuery = useQuery({
    queryKey: ["ops", "queue", "events", selectedJobId],
    queryFn: () => getOpsJobEvents(accessToken, selectedJobId ?? ""),
    enabled: accessToken.length > 0 && Boolean(selectedJobId),
  })

  const requeueDueMutation = useMutation({
    mutationFn: () => requeueDueOpsJobs(accessToken),
    onSuccess: (result) => {
      toast.success(`Queued ${result.queued} due job${result.queued === 1 ? "" : "s"}.`)
      void invalidateOpsQueries(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const retryJobMutation = useMutation({
    mutationFn: (jobId: string) => retryOpsJob(accessToken, jobId),
    onSuccess: () => {
      toast.success("Automation job requeued.")
      void invalidateOpsQueries(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const runNowMutation = useMutation({
    mutationFn: (jobId: string) => runOpsJobNow(accessToken, jobId),
    onSuccess: () => {
      toast.success("Automation job processed.")
      void invalidateOpsQueries(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const overview = overviewQuery.data
  const queueCounts = overview?.queues.statusCounts
  const selectedJob =
    queueQuery.data?.jobs.find((job) => job.id === selectedJobId) ?? null

  if (!accessToken) {
    return (
      <OpsAccessState
        title="Sign in required"
        description="The operations dashboard requires an authenticated internal account."
      />
    )
  }

  if (overviewQuery.error && !overview) {
    return (
      <OpsAccessState
        title="Operations dashboard restricted"
        description={getErrorMessage(overviewQuery.error)}
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:p-6 lg:pt-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-6">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 bg-background">
                <LockKeyholeIcon className="size-3.5" />
                Internal only
              </Badge>
              {overview ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1.5 bg-background",
                    overview.server.redisConfigured ?
                      "text-emerald-700 dark:text-emerald-300"
                      : "text-amber-700 dark:text-amber-300"
                  )}
                >
                  <BoxesIcon className="size-3.5" />
                  {overview.server.redisConfigured ? "Queue connected" : "Queue persisted only"}
                </Badge>
              ) : null}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Operations monitor
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Backend request health, automation queues, migration status, and safe manual triggers.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => void invalidateOpsQueries(queryClient)}
              disabled={overviewQuery.isFetching || logsQuery.isFetching || queueQuery.isFetching}
            >
              {overviewQuery.isFetching || logsQuery.isFetching || queueQuery.isFetching ?
                <Spinner />
                : <RefreshCwIcon className="size-4" />}
              Refresh
            </Button>
            <Button
              type="button"
              onClick={() => requeueDueMutation.mutate()}
              disabled={requeueDueMutation.isPending}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {requeueDueMutation.isPending ? <Spinner /> : <ListRestartIcon className="size-4" />}
              Requeue due
            </Button>
          </div>
        </div>

        <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4 lg:p-6 lg:pt-4">
          {overview ?
            <>
              <OpsMetricCard
                icon={<ActivityIcon className="size-4" />}
                label="API requests"
                value={formatCompactNumber(overview.logs.requests)}
                detail={`${overview.logs.averageDurationMs}ms avg response`}
                tone="blue"
              />
              <OpsMetricCard
                icon={<ShieldAlertIcon className="size-4" />}
                label="Recent errors"
                value={String(overview.logs.recentErrors)}
                detail={`${overview.logs.errors} retained errors`}
                tone={overview.logs.recentErrors > 0 ? "red" : "green"}
              />
              <OpsMetricCard
                icon={<BoxesIcon className="size-4" />}
                label="Queue backlog"
                value={String((queueCounts?.queued ?? 0) + (queueCounts?.retry_scheduled ?? 0))}
                detail={`${overview.queues.dueJobs} due now`}
                tone={(queueCounts?.failed ?? 0) > 0 ? "amber" : "green"}
              />
              <OpsMetricCard
                icon={<DatabaseIcon className="size-4" />}
                label="Migrations"
                value={`${overview.migrations.applied}/${overview.migrations.total}`}
                detail={
                  overview.migrations.checksumMismatches > 0 ?
                    `${overview.migrations.checksumMismatches} checksum mismatch`
                    : `${overview.migrations.pending} pending`
                }
                tone={
                  overview.migrations.checksumMismatches > 0 ||
                    overview.migrations.pending > 0 ?
                    "amber"
                    : "green"
                }
              />
            </>
            : <OpsMetricsSkeleton />}
        </div>
      </section>

      <Tabs
        value={activeTab}
        defaultValue="logs"
        onValueChange={(value) => setActiveTab(value as OpsTab)}
        className="gap-0 overflow-hidden rounded-2xl border border-border bg-card"
      >
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
          <TabsList className="h-auto gap-4 border-0 bg-transparent p-0">
            {opsTabs.map((tab) => {
              const Icon = tab.icon

              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="min-w-0 rounded-none px-0 py-1 text-sm shadow-none data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
                >
                  <Icon className="size-4" />
                  {tab.label}
                </TabsTrigger>
              )
            })}
          </TabsList>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Worker</span>
            <StatusBadge
              status={overview?.server.queueWorkerEnabled ? "running" : "skipped"}
              label={overview?.server.queueWorkerEnabled ? "Enabled" : "Disabled"}
            />
          </div>
        </div>

        <TabsContent value="logs" className="m-0">
          <div className="flex flex-col gap-2 border-b border-border px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
            <p className="text-sm text-muted-foreground">
              Sanitized recent requests. Ops endpoints and health checks are intentionally omitted.
            </p>
            <Select value={logLevel} onValueChange={(value) => setLogLevel(value as LogFilter)}>
              <SelectTrigger className="h-8 w-40">
                <SelectDisplayValue
                  value={logLevel}
                  options={logLevelOptions}
                  placeholder="Log level"
                />
              </SelectTrigger>
              <SelectContent align="end">
                {logLevelOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <LogsTable
            isLoading={logsQuery.isLoading}
            logs={logsQuery.data?.logs ?? []}
          />
        </TabsContent>

        <TabsContent value="queue" className="m-0">
          <div className="grid gap-3 border-b border-border px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5 lg:px-6">
            <div className="flex flex-wrap items-center gap-2">
              {queueStatuses.map((status) => (
                <StatusPill
                  key={status}
                  status={status}
                  count={queueQuery.data?.queue.statusCounts[status] ?? queueCounts?.[status] ?? 0}
                />
              ))}
            </div>
            <Select
              value={queueStatus}
              onValueChange={(value) => setQueueStatus(value as QueueFilter)}
            >
              <SelectTrigger className="h-8 w-44">
                <SelectDisplayValue
                  value={queueStatus}
                  options={queueStatusOptions}
                  placeholder="Queue status"
                />
              </SelectTrigger>
              <SelectContent align="end">
                {queueStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-h-[30rem] lg:grid-cols-[minmax(0,1fr)_22rem]">
            <QueueTable
              jobs={queueQuery.data?.jobs ?? []}
              isLoading={queueQuery.isLoading}
              selectedJobId={selectedJobId}
              retryPendingId={
                retryJobMutation.isPending ? retryJobMutation.variables ?? null : null
              }
              runPendingId={
                runNowMutation.isPending ? runNowMutation.variables ?? null : null
              }
              onSelectJob={setSelectedJobId}
              onRetry={(jobId) => retryJobMutation.mutate(jobId)}
              onRunNow={(jobId) => runNowMutation.mutate(jobId)}
            />
            <JobEventsPanel
              selectedJob={selectedJob}
              isLoading={jobEventsQuery.isLoading}
              events={jobEventsQuery.data?.events ?? []}
            />
          </div>
        </TabsContent>

        <TabsContent value="migrations" className="m-0">
          <MigrationsTable
            isLoading={overviewQuery.isLoading}
            migrations={overview?.migrations.recent ?? []}
            summary={overview?.migrations}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function LogsTable({
  isLoading,
  logs,
}: {
  isLoading: boolean
  logs: OpsLogEntry[]
}) {
  if (isLoading) {
    return <TableSkeleton columns={7} rows={8} />
  }

  if (logs.length === 0) {
    return (
      <Empty className="min-h-[24rem] border-0 p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TerminalSquareIcon />
          </EmptyMedia>
          <EmptyTitle>No logs retained</EmptyTitle>
          <EmptyDescription>
            Make a backend request, then refresh this page to see recent sanitized API activity.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="max-h-[30rem] overflow-auto">
      <Table className="table-fixed text-xs [&_td]:px-2 [&_td]:py-2 [&_th]:h-9">
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[10%]">Time</TableHead>
            <TableHead className="w-[8%]">Level</TableHead>
            <TableHead className="w-[9%]">Method</TableHead>
            <TableHead className="w-[32%]">URL</TableHead>
            <TableHead className="w-[8%] text-right">Status</TableHead>
            <TableHead className="w-[10%] text-right">Duration</TableHead>
            <TableHead className="w-[23%]">Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="text-muted-foreground">{formatTime(log.timestamp)}</TableCell>
              <TableCell>
                <LogLevelBadge level={log.level} />
              </TableCell>
              <TableCell className="font-mono text-[11px]">{log.method ?? "-"}</TableCell>
              <TableCell className="truncate font-mono text-[11px]" title={log.url ?? ""}>
                {log.url ?? "-"}
              </TableCell>
              <TableCell className="text-right">
                <span className={getStatusCodeClassName(log.statusCode)}>
                  {log.statusCode ?? "-"}
                </span>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {typeof log.durationMs === "number" ? `${log.durationMs}ms` : "-"}
              </TableCell>
              <TableCell className="truncate" title={log.message}>
                {log.message}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function QueueTable({
  jobs,
  isLoading,
  selectedJobId,
  retryPendingId,
  runPendingId,
  onSelectJob,
  onRetry,
  onRunNow,
}: {
  jobs: OpsAutomationJob[]
  isLoading: boolean
  selectedJobId: string | null
  retryPendingId: string | null
  runPendingId: string | null
  onSelectJob: (jobId: string) => void
  onRetry: (jobId: string) => void
  onRunNow: (jobId: string) => void
}) {
  if (isLoading) {
    return <TableSkeleton columns={8} rows={8} />
  }

  if (jobs.length === 0) {
    return (
      <Empty className="min-h-[30rem] border-0 border-r border-border p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BoxesIcon />
          </EmptyMedia>
          <EmptyTitle>No automation jobs found</EmptyTitle>
          <EmptyDescription>
            Queue jobs appear after purchases, sales, POS, inventory, e-invoice, GST, and bank automation triggers run.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="max-h-[30rem] overflow-auto border-r border-border">
      <Table className="table-fixed text-xs [&_td]:px-2 [&_td]:py-2 [&_th]:h-9">
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[20%]">Job</TableHead>
            <TableHead className="w-[11%]">Status</TableHead>
            <TableHead className="w-[13%]">Source</TableHead>
            <TableHead className="w-[11%] text-right">Attempts</TableHead>
            <TableHead className="w-[13%]">Run after</TableHead>
            <TableHead className="w-[18%]">Last error</TableHead>
            <TableHead className="w-[14%] pr-3 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow
              key={job.id}
              data-state={selectedJobId === job.id ? "selected" : undefined}
            >
              <TableCell>
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => onSelectJob(job.id)}
                >
                  <p className="truncate font-medium" title={formatJobType(job.jobType)}>
                    {formatJobType(job.jobType)}
                  </p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground" title={job.id}>
                    {job.id}
                  </p>
                </button>
              </TableCell>
              <TableCell>
                <StatusBadge status={job.status} />
              </TableCell>
              <TableCell>
                <p className="truncate font-medium" title={job.sourceType}>
                  {formatSource(job.sourceType)}
                </p>
                <p className="truncate font-mono text-[10px] text-muted-foreground" title={job.sourceId}>
                  {job.sourceId}
                </p>
              </TableCell>
              <TableCell className="text-right font-mono">
                {job.attemptCount}/{job.maxAttempts}
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDateTime(job.runAfter)}</TableCell>
              <TableCell className="truncate text-muted-foreground" title={job.lastErrorMessage ?? ""}>
                {job.lastErrorMessage ?? "-"}
              </TableCell>
              <TableCell className="pr-3">
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    title="Run now"
                    onClick={() => onRunNow(job.id)}
                    disabled={job.status === "running" || runPendingId === job.id}
                  >
                    {runPendingId === job.id ? <Spinner /> : <PlayIcon className="size-4" />}
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    title="Retry"
                    onClick={() => onRetry(job.id)}
                    disabled={
                      (job.status !== "failed" && job.status !== "retry_scheduled") ||
                      retryPendingId === job.id
                    }
                  >
                    {retryPendingId === job.id ?
                      <Spinner />
                      : <RotateCcwIcon className="size-4" />}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function JobEventsPanel({
  selectedJob,
  isLoading,
  events,
}: {
  selectedJob: OpsAutomationJob | null
  isLoading: boolean
  events: OpsAutomationJobEvent[]
}) {
  return (
    <aside className="min-h-[30rem] bg-muted/10 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Job events</h2>
          <p className="text-xs text-muted-foreground">
            Select a job to inspect lifecycle events.
          </p>
        </div>
        {selectedJob ? <StatusBadge status={selectedJob.status} /> : null}
      </div>

      {!selectedJob ?
        <Empty className="min-h-[20rem] border-0 p-4">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Clock3Icon />
            </EmptyMedia>
            <EmptyTitle>No job selected</EmptyTitle>
            <EmptyDescription>
              Click any queue row to see queued, started, completed, failed, and retry events.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
        : isLoading ?
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-xl" />
            ))}
          </div>
          : events.length === 0 ?
            <Empty className="min-h-[20rem] border-0 p-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Clock3Icon />
                </EmptyMedia>
                <EmptyTitle>No events recorded</EmptyTitle>
                <EmptyDescription>
                  The job exists, but no lifecycle events have been persisted yet.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
            : <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{formatEventType(event.eventType)}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {event.message ?? "No message."}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatTime(event.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
      }
    </aside>
  )
}

function MigrationsTable({
  isLoading,
  migrations,
  summary,
}: {
  isLoading: boolean
  migrations: OpsOverview["migrations"]["recent"]
  summary: OpsOverview["migrations"] | undefined
}) {
  if (isLoading) {
    return <TableSkeleton columns={4} rows={8} />
  }

  return (
    <div>
      <div className="grid gap-3 border-b border-border px-4 py-3 sm:grid-cols-3 sm:px-5 lg:px-6">
        <MiniMetric label="Ledger" value={summary?.ledgerExists ? "Ready" : "Missing"} />
        <MiniMetric label="Pending" value={String(summary?.pending ?? 0)} />
        <MiniMetric label="Checksum" value={String(summary?.checksumMismatches ?? 0)} />
      </div>
      <div className="max-h-[30rem] overflow-auto">
        <Table className="table-fixed text-xs [&_td]:px-2 [&_td]:py-2 [&_th]:h-9">
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[48%]">Migration</TableHead>
              <TableHead className="w-[16%]">Status</TableHead>
              <TableHead className="w-[18%]">Applied</TableHead>
              <TableHead className="w-[18%]">Checksum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {migrations.map((migration) => (
              <TableRow key={migration.name}>
                <TableCell className="truncate font-mono" title={migration.name}>
                  {migration.name}
                </TableCell>
                <TableCell>
                  <MigrationStatusBadge status={migration.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {migration.appliedAt ? formatDateTime(migration.appliedAt) : "-"}
                </TableCell>
                <TableCell className="truncate font-mono text-[10px] text-muted-foreground">
                  {migration.checksum.slice(0, 12)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function OpsMetricCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail: string
  tone: "green" | "blue" | "amber" | "red"
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            tone === "green" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            tone === "blue" && "bg-blue-500/10 text-blue-700 dark:text-blue-300",
            tone === "amber" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
            tone === "red" && "bg-destructive/10 text-destructive"
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function OpsMetricsSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-28 rounded-2xl" />
      ))}
    </>
  )
}

function TableSkeleton({ columns, rows }: { columns: number; rows: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton key={columnIndex} className="h-8 rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  )
}

function OpsAccessState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center p-6">
      <Empty className="min-h-[26rem]">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="text-amber-700 dark:text-amber-300">
            <LockKeyholeIcon />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}

function StatusPill({
  status,
  count,
}: {
  status: OpsAutomationJobStatus
  count: number
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs">
      <span className={cn("size-1.5 rounded-full", getStatusDotClassName(status))} />
      <span className="text-muted-foreground">{formatStatus(status)}</span>
      <span className="font-mono font-medium">{count}</span>
    </span>
  )
}

function StatusBadge({
  status,
  label,
}: {
  status: OpsAutomationJobStatus
  label?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 bg-background",
        getStatusTextClassName(status)
      )}
    >
      <span className={cn("size-1.5 rounded-full", getStatusDotClassName(status))} />
      {label ?? formatStatus(status)}
    </Badge>
  )
}

function LogLevelBadge({ level }: { level: OpsLogLevel }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "bg-background",
        level === "error" && "border-destructive/30 text-destructive",
        level === "warn" && "border-amber-500/30 text-amber-700 dark:text-amber-300",
        level === "info" && "border-blue-500/30 text-blue-700 dark:text-blue-300"
      )}
    >
      {level.toUpperCase()}
    </Badge>
  )
}

function MigrationStatusBadge({
  status,
}: {
  status: "pending" | "applied" | "checksum_mismatch"
}) {
  if (status === "applied") {
    return (
      <Badge variant="outline" className="gap-1.5 bg-background text-emerald-700 dark:text-emerald-300">
        <CheckCircle2Icon className="size-3.5" />
        Applied
      </Badge>
    )
  }

  if (status === "checksum_mismatch") {
    return (
      <Badge variant="outline" className="gap-1.5 bg-background text-destructive">
        <AlertTriangleIcon className="size-3.5" />
        Mismatch
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="gap-1.5 bg-background text-amber-700 dark:text-amber-300">
      <Clock3Icon className="size-3.5" />
      Pending
    </Badge>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}

function getStatusDotClassName(status: OpsAutomationJobStatus) {
  if (status === "completed") {
    return "bg-emerald-500"
  }

  if (status === "failed") {
    return "bg-destructive"
  }

  if (status === "running") {
    return "bg-blue-500"
  }

  if (status === "retry_scheduled") {
    return "bg-amber-500"
  }

  if (status === "queued") {
    return "bg-sky-500"
  }

  return "bg-muted-foreground"
}

function getStatusTextClassName(status: OpsAutomationJobStatus) {
  if (status === "completed") {
    return "border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
  }

  if (status === "failed") {
    return "border-destructive/30 text-destructive"
  }

  if (status === "running" || status === "retry_scheduled") {
    return "border-amber-500/30 text-amber-700 dark:text-amber-300"
  }

  return "text-muted-foreground"
}

function getStatusCodeClassName(statusCode: number | null) {
  if (!statusCode) {
    return "text-muted-foreground"
  }

  if (statusCode >= 500) {
    return "font-medium text-destructive"
  }

  if (statusCode >= 400) {
    return "font-medium text-amber-700 dark:text-amber-300"
  }

  return "font-medium text-emerald-700 dark:text-emerald-300"
}

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .split(" ")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
}

function formatJobType(value: string) {
  const labels: Record<string, string> = {
    "stock.posted-document.sync": "Stock document sync",
    "stock.opening-stock.sync": "Opening stock sync",
    "einvoice.generate": "E-invoice generation",
    "bank-reconciliation.auto-match": "Bank auto-match",
    "gst-report.refresh": "GST report refresh",
    "filing-review.prepare": "Filing review prepare",
  }

  return labels[value] ?? value
}

function formatSource(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll(".", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
}

function formatEventType(value: string) {
  return formatSource(value)
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}

async function invalidateOpsQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["ops", "overview"] }),
    queryClient.invalidateQueries({ queryKey: ["ops", "logs"] }),
    queryClient.invalidateQueries({ queryKey: ["ops", "queue"] }),
  ])
}
