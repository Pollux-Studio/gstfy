"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import {
  BadgeCheckIcon,
  CalendarIcon,
  FileUpIcon,
  LandmarkIcon,
  SearchIcon,
  Undo2Icon,
  WandSparklesIcon,
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
import {
  autoMatchBankStatementLines,
  importBankStatement,
  listBankReconciliation,
  listBankStatementLines,
  reconcileBankDocument,
  unreconcileBankDocument,
  type BankReconciliationItem,
  type BankStatementLine,
} from "@/lib/payment-receipt/api"

const statusOptions = [
  { value: "all", label: "All" },
  { value: "unmatched", label: "Unmatched" },
  { value: "reconciled", label: "Reconciled" },
] as const

const today = () => new Date().toISOString().slice(0, 10)

export function BankReconciliationPage() {
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState("")
  const [status, setStatus] =
    React.useState<(typeof statusOptions)[number]["value"]>("unmatched")
  const [selectedItem, setSelectedItem] =
    React.useState<BankReconciliationItem | null>(null)
  const [statementDate, setStatementDate] = React.useState(today())
  const [bankReference, setBankReference] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [importOpen, setImportOpen] = React.useState(false)
  const [importAccountId, setImportAccountId] = React.useState("")
  const [importFileName, setImportFileName] = React.useState("")
  const [importCsvText, setImportCsvText] = React.useState("")
  const [lineStatus, setLineStatus] = React.useState<"all" | "unmatched" | "matched">(
    "unmatched"
  )

  const reconciliationQuery = useQuery({
    queryKey: ["money", "bank-reconciliation", search, status],
    queryFn: () => listBankReconciliation(accessToken, { search, status }),
    enabled: accessToken.length > 0,
  })
  const statementLinesQuery = useQuery({
    queryKey: ["money", "bank-statement-lines", search, lineStatus],
    queryFn: () =>
      listBankStatementLines(accessToken, {
        search,
        status: lineStatus,
        page: 1,
        limit: 50,
      }),
    enabled: accessToken.length > 0,
  })
  const accountsQuery = useQuery({
    queryKey: ["money", "bank-import-accounts"],
    queryFn: () => listLedgerAccounts(accessToken, "", { limit: 100 }),
    enabled: accessToken.length > 0 && importOpen,
  })

  const reconcileMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) {
        return
      }

      await reconcileBankDocument(accessToken, {
        documentType: selectedItem.documentType,
        documentId: selectedItem.documentId,
        statementDate,
        bankReference: bankReference || null,
        notes: notes || null,
      })
    },
    onSuccess: async () => {
      toast.success("Bank entry reconciled.")
      closeDialog()
      await invalidateReconciliation(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const unreconcileMutation = useMutation({
    mutationFn: (matchId: string) => unreconcileBankDocument(accessToken, matchId),
    onSuccess: async () => {
      toast.success("Bank match removed.")
      await invalidateReconciliation(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const importMutation = useMutation({
    mutationFn: () =>
      importBankStatement(accessToken, {
        cashBankAccountId: importAccountId,
        fileName: importFileName || "bank-statement.csv",
        csvText: importCsvText,
      }),
    onSuccess: async (response) => {
      toast.success(`${response.imported} bank statement lines imported.`)
      setImportOpen(false)
      resetImportForm()
      await invalidateReconciliation(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const autoMatchMutation = useMutation({
    mutationFn: () =>
      autoMatchBankStatementLines(accessToken, {
        cashBankAccountId: importAccountId || null,
        dateToleranceDays: 3,
      }),
    onSuccess: async (response) => {
      toast.success(
        `${response.matched} lines auto-matched. ${response.skipped} need manual review.`
      )
      await invalidateReconciliation(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openDialog(item: BankReconciliationItem) {
    setSelectedItem(item)
    setStatementDate(item.statementDate ?? today())
    setBankReference(item.bankReference ?? item.referenceNumber ?? "")
    setNotes(item.notes ?? "")
  }

  function closeDialog() {
    setSelectedItem(null)
    setStatementDate(today())
    setBankReference("")
    setNotes("")
  }

  function resetImportForm() {
    setImportAccountId("")
    setImportFileName("")
    setImportCsvText("")
  }

  async function handleStatementFile(file: File | null) {
    if (!file) {
      return
    }

    setImportFileName(file.name)
    setImportCsvText(await file.text())
  }

  const items = reconciliationQuery.data?.items ?? []
  const statementLines = statementLinesQuery.data?.lines ?? []
  const bankAccounts =
    accountsQuery.data?.accounts.filter(
      (account) =>
        account.status === "active" &&
        account.allowPosting &&
        account.accountGroup === "BANK"
    ) ?? []
  const canImport =
    importAccountId.length > 0 &&
    importFileName.trim().length > 0 &&
    importCsvText.trim().length > 0

  return (
    <main className="min-w-0 space-y-5 p-4 sm:p-6">
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="gap-1.5">
              <LandmarkIcon className="size-3.5" />
              Bank book control
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Bank reconciliation
              </h1>
              <p className="text-sm text-muted-foreground">
                Match posted non-cash receipts and payments to bank statement lines.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <FileUpIcon className="size-4" />
              Import statement
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={autoMatchMutation.isPending}
              onClick={() => autoMatchMutation.mutate()}
            >
              {autoMatchMutation.isPending ? (
                <Spinner className="size-4" />
              ) : (
                <WandSparklesIcon className="size-4" />
              )}
              Auto-match
            </Button>
            <div className="relative">
              <SearchIcon className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="h-8 w-full pl-8 sm:w-64"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search number, party, reference"
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
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Reconciled"
          value={formatCurrency(reconciliationQuery.data?.totals.reconciled ?? "0")}
        />
        <MetricCard
          label="Unmatched"
          value={formatCurrency(reconciliationQuery.data?.totals.unmatched ?? "0")}
        />
        <MetricCard
          label="Lines"
          value={String(reconciliationQuery.data?.totals.count ?? 0)}
        />
      </section>

      <section className="rounded-2xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-medium">Imported statement lines</h2>
            <p className="text-sm text-muted-foreground">
              Bank statement rows waiting for auto-match or manual review.
            </p>
          </div>
          <Select
            value={lineStatus}
            onValueChange={(value) => setLineStatus(value as typeof lineStatus)}
          >
            <SelectTrigger className="h-8 w-full sm:w-36">
              <SelectDisplayValue
                value={lineStatus}
                options={[
                  { value: "all", label: "All lines" },
                  { value: "unmatched", label: "Unmatched" },
                  { value: "matched", label: "Matched" },
                ]}
                placeholder="Line status"
              />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all">All lines</SelectItem>
              <SelectItem value="unmatched">Unmatched</SelectItem>
              <SelectItem value="matched">Matched</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {statementLinesQuery.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        ) : statementLines.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No imported statement lines for this filter.
          </div>
        ) : (
          <StatementLinesTable lines={statementLines} />
        )}
      </section>

      <section className="rounded-2xl border bg-card">
        {reconciliationQuery.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        ) : (
          <div className="max-h-[38rem] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={`${item.documentType}-${item.documentId}`}>
                    <TableCell>
                      <p className="font-mono text-xs">{item.documentNumber}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {item.documentType}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      {item.partyName}
                    </TableCell>
                    <TableCell>{formatDate(item.documentDate)}</TableCell>
                    <TableCell className="capitalize">{item.paymentMethod}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.amount)}
                    </TableCell>
                    <TableCell>
                      {item.matchId ? (
                        <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-700">
                          <BadgeCheckIcon className="size-3.5" />
                          Reconciled
                        </Badge>
                      ) : (
                        <Badge variant="outline">Unmatched</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.matchId ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={unreconcileMutation.isPending}
                          onClick={() => item.matchId && unreconcileMutation.mutate(item.matchId)}
                        >
                          <Undo2Icon className="size-4" />
                          Undo
                        </Button>
                      ) : (
                        <Button type="button" size="sm" onClick={() => openDialog(item)}>
                          Reconcile
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {items.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No bank movements found for this filter.
              </div>
            ) : null}
          </div>
        )}
      </section>

      <Dialog open={Boolean(selectedItem)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as reconciled</DialogTitle>
            <DialogDescription>
              Confirm the document against the statement date and bank reference.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Document</span>
              <span className="font-mono">{selectedItem?.documentNumber}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-mono">{formatCurrency(selectedItem?.amount ?? "0")}</span>
            </div>
          </div>
          <Field>
            <FieldLabel>Statement date</FieldLabel>
            <div className="relative">
              <CalendarIcon className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                type="date"
                value={statementDate}
                onChange={(event) => setStatementDate(event.target.value)}
              />
            </div>
          </Field>
          <Field>
            <FieldLabel>Bank reference</FieldLabel>
            <Input
              value={bankReference}
              onChange={(event) => setBankReference(event.target.value)}
              placeholder="UTR / cheque / statement reference"
            />
          </Field>
          <Field>
            <FieldLabel>Notes</FieldLabel>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional reconciliation note"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              disabled={!statementDate || reconcileMutation.isPending}
              onClick={() => reconcileMutation.mutate()}
            >
              {reconcileMutation.isPending ? <Spinner className="size-4" /> : null}
              Mark reconciled
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(open) => {
        setImportOpen(open)
        if (!open) {
          resetImportForm()
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import bank statement</DialogTitle>
            <DialogDescription>
              Upload a CSV with date, description, reference, and debit/credit or amount columns.
              Credits are matched to receipts; debits are matched to payments.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel>Bank ledger account</FieldLabel>
            <Select
              value={importAccountId}
              onValueChange={(value) => setImportAccountId(value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectDisplayValue
                  value={importAccountId}
                  options={bankAccounts.map((account) => ({
                    value: account.id,
                    label: `${account.accountCode} · ${account.accountName}`,
                  }))}
                  placeholder="Choose bank account"
                />
              </SelectTrigger>
              <SelectContent align="start">
                {bankAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.accountCode} · {account.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>CSV file</FieldLabel>
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void handleStatementFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <Field>
            <FieldLabel>CSV preview</FieldLabel>
            <Textarea
              value={importCsvText}
              onChange={(event) => setImportCsvText(event.target.value)}
              placeholder={"date,description,reference,debit,credit\n2026-08-17,UPI receipt,UTR123,,1000.00"}
              className="min-h-36 font-mono text-xs"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!canImport || importMutation.isPending}
              onClick={() => importMutation.mutate()}
            >
              {importMutation.isPending ? <Spinner className="size-4" /> : <FileUpIcon className="size-4" />}
              Import lines
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function StatementLinesTable({ lines }: { lines: BankStatementLine[] }) {
  return (
    <div className="max-h-80 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Statement line</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Matched document</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.id}>
              <TableCell>
                <p className="text-sm font-medium">{line.description}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(line.statementDate)} · {line.bankReference || line.fileName}
                </p>
              </TableCell>
              <TableCell className="capitalize">{line.direction}</TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(line.amount)}
              </TableCell>
              <TableCell>
                {line.matchStatus === "matched" ? (
                  <Badge className="bg-emerald-500/10 text-emerald-700">Matched</Badge>
                ) : (
                  <Badge variant="outline">Unmatched</Badge>
                )}
              </TableCell>
              <TableCell>
                {line.matchedDocumentNumber ? (
                  <span className="font-mono text-xs">{line.matchedDocumentNumber}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Not matched</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 font-mono text-2xl font-semibold">{value}</p>
    </div>
  )
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong. Please try again."
}

async function invalidateReconciliation(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["money", "bank-reconciliation"] }),
    queryClient.invalidateQueries({ queryKey: ["money", "bank-statement-lines"] }),
  ])
}
