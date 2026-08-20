"use client"

import * as React from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import {
  ArrowDownIcon,
  ArrowDownUpIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  BadgeCheckIcon,
  BadgeIndianRupeeIcon,
  CalendarIcon,
  EyeIcon,
  FileUpIcon,
  LandmarkIcon,
  MoreHorizontalIcon,
  ReceiptTextIcon,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { cn } from "@/lib/utils"
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
  { value: "unmatched", label: "Needs checking" },
  { value: "reconciled", label: "Matched" },
] as const

type SortDirection = "asc" | "desc"
type BankReconciliationTab = "register" | "statement-lines"
type BankItemSortKey = "number" | "party" | "date" | "method" | "amount" | "status"
type StatementLineSortKey =
  | "description"
  | "direction"
  | "date"
  | "amount"
  | "status"
  | "matched"

const bankTableClass =
  "w-full table-fixed text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-2"
const stickyTableHeadClass =
  "sticky top-0 z-20 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80"
const bankTabTriggerClass =
  "relative h-7 min-w-0 rounded-none px-0 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none dark:data-[state=active]:text-blue-400 after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:scale-x-0 after:rounded-full after:bg-blue-600 after:transition-transform data-[state=active]:after:scale-x-100 dark:after:bg-blue-400"
const bankTabCopy: Record<BankReconciliationTab, { title: string; description: string }> = {
  register: {
    title: "GSTFY records",
    description: "Payments recorded in GSTFY.",
  },
  "statement-lines": {
    title: "Bank statement",
    description: "Rows uploaded from your bank.",
  },
}

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
  const [itemSortKey, setItemSortKey] = React.useState<BankItemSortKey>("date")
  const [itemSortDirection, setItemSortDirection] =
    React.useState<SortDirection>("desc")
  const [lineSortKey, setLineSortKey] = React.useState<StatementLineSortKey>("date")
  const [lineSortDirection, setLineSortDirection] =
    React.useState<SortDirection>("desc")
  const [activeBankTab, setActiveBankTab] =
    React.useState<BankReconciliationTab>("register")

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

  function toggleItemSort(nextKey: BankItemSortKey) {
    if (nextKey === itemSortKey) {
      setItemSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setItemSortKey(nextKey)
    setItemSortDirection(nextKey === "date" ? "desc" : "asc")
  }

  function toggleLineSort(nextKey: StatementLineSortKey) {
    if (nextKey === lineSortKey) {
      setLineSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setLineSortKey(nextKey)
    setLineSortDirection(nextKey === "date" ? "desc" : "asc")
  }

  const items = React.useMemo(
    () => reconciliationQuery.data?.items ?? [],
    [reconciliationQuery.data?.items]
  )
  const statementLines = React.useMemo(
    () => statementLinesQuery.data?.lines ?? [],
    [statementLinesQuery.data?.lines]
  )
  const sortedItems = React.useMemo(() => {
    return [...items].sort((first, second) => {
      const direction = itemSortDirection === "asc" ? 1 : -1

      if (itemSortKey === "number") {
        return first.documentNumber.localeCompare(second.documentNumber) * direction
      }

      if (itemSortKey === "party") {
        return (
          first.partyName.localeCompare(second.partyName, undefined, {
            sensitivity: "base",
          }) * direction
        )
      }

      if (itemSortKey === "date") {
        return first.documentDate.localeCompare(second.documentDate) * direction
      }

      if (itemSortKey === "method") {
        return (
          paymentMethodLabel(first.paymentMethod).localeCompare(
            paymentMethodLabel(second.paymentMethod),
            undefined,
            { sensitivity: "base" }
          ) * direction
        )
      }

      if (itemSortKey === "status") {
        return getBankItemStatus(first).localeCompare(getBankItemStatus(second)) * direction
      }

      return (Number(first.amount) - Number(second.amount)) * direction
    })
  }, [itemSortDirection, itemSortKey, items])
  const sortedStatementLines = React.useMemo(() => {
    return [...statementLines].sort((first, second) => {
      const direction = lineSortDirection === "asc" ? 1 : -1

      if (lineSortKey === "description") {
        return (
          first.description.localeCompare(second.description, undefined, {
            sensitivity: "base",
          }) * direction
        )
      }

      if (lineSortKey === "direction") {
        return first.direction.localeCompare(second.direction) * direction
      }

      if (lineSortKey === "date") {
        return first.statementDate.localeCompare(second.statementDate) * direction
      }

      if (lineSortKey === "status") {
        return first.matchStatus.localeCompare(second.matchStatus) * direction
      }

      if (lineSortKey === "matched") {
        return (
          (first.matchedDocumentNumber ?? "").localeCompare(
            second.matchedDocumentNumber ?? "",
            undefined,
            { sensitivity: "base" }
          ) * direction
        )
      }

      return (Number(first.amount) - Number(second.amount)) * direction
    })
  }, [lineSortDirection, lineSortKey, statementLines])
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
  const activeBankTabCopy = bankTabCopy[activeBankTab]

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

      <BankReconciliationHeader
        totals={{
          reconciled: reconciliationQuery.data?.totals.reconciled ?? "0",
          unmatched: reconciliationQuery.data?.totals.unmatched ?? "0",
          count: reconciliationQuery.data?.totals.count ?? 0,
        }}
        loading={reconciliationQuery.isLoading}
        autoMatchLoading={autoMatchMutation.isPending}
        onImport={() => setImportOpen(true)}
        onAutoMatch={() => autoMatchMutation.mutate()}
      />

      <Tabs
        value={activeBankTab}
        defaultValue="register"
        onValueChange={(value) => setActiveBankTab(value as BankReconciliationTab)}
        className="min-w-0"
      >
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{activeBankTabCopy.title}</h2>
              <p className="truncate text-xs text-muted-foreground">
                {activeBankTabCopy.description}
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
                    activeBankTab === "register" ?
                      "Search document, party, reference"
                    : "Search statement line or reference"
                  }
                />
              </div>
              {activeBankTab === "register" ? (
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
              ) : (
                <Select
                  value={lineStatus}
                  onValueChange={(value) => setLineStatus(value as typeof lineStatus)}
                >
                  <SelectTrigger className="h-8 w-full sm:w-36">
                    <SelectDisplayValue
                      value={lineStatus}
                      options={[
                        { value: "all", label: "All lines" },
                        { value: "unmatched", label: "Needs checking" },
                        { value: "matched", label: "Matched" },
                      ]}
                      placeholder="Line status"
                    />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="all">All lines</SelectItem>
                    <SelectItem value="unmatched">Needs checking</SelectItem>
                    <SelectItem value="matched">Matched</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <TabsList className="h-auto flex-wrap justify-start gap-4 rounded-none border-0 bg-transparent p-0 sm:justify-end">
                <TabsTrigger value="register" className={bankTabTriggerClass}>
                  GSTFY records
                </TabsTrigger>
                <TabsTrigger value="statement-lines" className={bankTabTriggerClass}>
                  Bank statement
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="register" className="m-0">
            {reconciliationQuery.isLoading ? (
              <BankTableSkeleton />
            ) : sortedItems.length === 0 ? (
              <EmptyBankRegisterState />
            ) : (
              <>
                <div className="app-scrollbar max-h-[28rem] overflow-auto">
                  <table data-slot="table" className={cn("caption-bottom", bankTableClass)}>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead
                          label="Document"
                          sortKey="number"
                          activeSortKey={itemSortKey}
                          sortDirection={itemSortDirection}
                          className="w-[15%]"
                          onSort={toggleItemSort}
                        />
                        <SortableTableHead
                          label="Party"
                          sortKey="party"
                          activeSortKey={itemSortKey}
                          sortDirection={itemSortDirection}
                          className="w-[23%]"
                          onSort={toggleItemSort}
                        />
                        <SortableTableHead
                          label="Date"
                          sortKey="date"
                          activeSortKey={itemSortKey}
                          sortDirection={itemSortDirection}
                          className="w-[12%]"
                          onSort={toggleItemSort}
                        />
                        <SortableTableHead
                          label="Method"
                          sortKey="method"
                          activeSortKey={itemSortKey}
                          sortDirection={itemSortDirection}
                          className="w-[12%]"
                          onSort={toggleItemSort}
                        />
                        <SortableTableHead
                          label="Amount"
                          sortKey="amount"
                          activeSortKey={itemSortKey}
                          sortDirection={itemSortDirection}
                          className="w-[14%] text-right"
                          align="right"
                          onSort={toggleItemSort}
                        />
                        <SortableTableHead
                          label="Status"
                          sortKey="status"
                          activeSortKey={itemSortKey}
                          sortDirection={itemSortDirection}
                          className="w-[12%]"
                          onSort={toggleItemSort}
                        />
                        <TableHead className={cn(stickyTableHeadClass, "w-[12%] pr-3 text-right")}>
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedItems.map((item) => (
                        <TableRow key={`${item.documentType}-${item.documentId}`}>
                          <TableCell className="w-[15%]">
                            <Link
                              className="font-mono text-[11px] underline-offset-4 hover:underline"
                              href={getDocumentHref(item)}
                            >
                              {item.documentNumber}
                            </Link>
                            <p
                              className={cn(
                                "truncate text-[11px] capitalize",
                                item.documentType === "receipt" ?
                                  "text-emerald-700 dark:text-emerald-300"
                                : "text-red-700 dark:text-red-300"
                              )}
                            >
                              {item.documentType}
                            </p>
                          </TableCell>
                          <TableCell className="w-[23%]">
                            <div className="truncate font-medium">{item.partyName}</div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {item.referenceNumber || "No reference"}
                            </div>
                          </TableCell>
                          <TableCell className="w-[12%]">{formatDate(item.documentDate)}</TableCell>
                          <TableCell className="w-[12%]">{paymentMethodLabel(item.paymentMethod)}</TableCell>
                          <TableCell
                            className={cn(
                              "w-[14%] text-right font-mono tabular-nums",
                              item.documentType === "receipt" ?
                                "text-emerald-700 dark:text-emerald-300"
                              : "text-red-700 dark:text-red-300"
                            )}
                          >
                            {formatCurrency(item.amount)}
                          </TableCell>
                          <TableCell className="w-[12%]">
                            <BankReconciliationStatusBadge reconciled={Boolean(item.matchId)} />
                          </TableCell>
                          <TableCell className="w-[12%] pr-3 text-right">
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
                                  Open bank match actions for {item.documentNumber}
                                </span>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" sideOffset={8} className="w-44">
                                <DropdownMenuItem render={<Link href={getDocumentHref(item)} />}>
                                  <EyeIcon className="text-muted-foreground" />
                                  <span>View</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {item.matchId ? (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    disabled={unreconcileMutation.isPending}
                                    onClick={() => item.matchId && unreconcileMutation.mutate(item.matchId)}
                                  >
                                    <Undo2Icon className="text-muted-foreground" />
                                    <span>Unmatch</span>
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => openDialog(item)}>
                                    <BadgeCheckIcon className="text-muted-foreground" />
                                    <span>Mark matched</span>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </table>
                </div>
                <BankListFooter
                  loaded={sortedItems.length}
                  total={reconciliationQuery.data?.totals.count ?? sortedItems.length}
                  noun="bank movements"
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="statement-lines" className="m-0">
            {statementLinesQuery.isLoading ? (
              <BankTableSkeleton rows={4} />
            ) : sortedStatementLines.length === 0 ? (
              <EmptyStatementLinesState />
            ) : (
              <>
                <StatementLinesTable
                  lines={sortedStatementLines}
                  sortKey={lineSortKey}
                  sortDirection={lineSortDirection}
                  onSort={toggleLineSort}
                />
                <BankListFooter
                  loaded={sortedStatementLines.length}
                  total={statementLinesQuery.data?.pagination.total ?? sortedStatementLines.length}
                  noun="statement lines"
                />
              </>
            )}
          </TabsContent>
        </section>
      </Tabs>

      <Dialog open={Boolean(selectedItem)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as matched</DialogTitle>
            <DialogDescription>
              Confirm this GSTFY record with the matching bank statement row.
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
              Mark matched
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
            <DialogTitle>Upload bank statement</DialogTitle>
            <DialogDescription>
              Upload a CSV from your bank. GSTFY will use it to find matching payments.
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
              Upload statement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function StatementLinesTable({
  lines,
  sortKey,
  sortDirection,
  onSort,
}: {
  lines: BankStatementLine[]
  sortKey: StatementLineSortKey
  sortDirection: SortDirection
  onSort: (sortKey: StatementLineSortKey) => void
}) {
  return (
    <div className="app-scrollbar max-h-[24rem] overflow-auto">
      <table data-slot="table" className={cn("caption-bottom", bankTableClass)}>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              label="Statement line"
              sortKey="description"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              className="w-[34%]"
              onSort={onSort}
            />
            <SortableTableHead
              label="Direction"
              sortKey="direction"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              className="w-[12%]"
              onSort={onSort}
            />
            <SortableTableHead
              label="Date"
              sortKey="date"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              className="w-[12%]"
              onSort={onSort}
            />
            <SortableTableHead
              label="Amount"
              sortKey="amount"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              className="w-[14%] text-right"
              align="right"
              onSort={onSort}
            />
            <SortableTableHead
              label="Status"
              sortKey="status"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              className="w-[12%]"
              onSort={onSort}
            />
            <SortableTableHead
              label="Matched"
              sortKey="matched"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              className="w-[16%]"
              onSort={onSort}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.id}>
              <TableCell className="w-[34%]">
                <p className="truncate font-medium">{line.description}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {line.bankReference || line.fileName}
                </p>
              </TableCell>
              <TableCell
                className={cn(
                  "w-[12%] capitalize",
                  line.direction === "credit" ?
                    "text-emerald-700 dark:text-emerald-300"
                  : "text-red-700 dark:text-red-300"
                )}
              >
                {line.direction}
              </TableCell>
              <TableCell className="w-[12%]">{formatDate(line.statementDate)}</TableCell>
              <TableCell
                className={cn(
                  "w-[14%] text-right font-mono tabular-nums",
                  line.direction === "credit" ?
                    "text-emerald-700 dark:text-emerald-300"
                  : "text-red-700 dark:text-red-300"
                )}
              >
                {formatCurrency(line.amount)}
              </TableCell>
              <TableCell className="w-[12%]">
                <StatementLineStatusBadge status={line.matchStatus} />
              </TableCell>
              <TableCell className="w-[16%]">
                {line.matchedDocumentNumber ? (
                  <Link
                    className="font-mono text-[11px] underline-offset-4 hover:underline"
                    href={getStatementMatchHref(line)}
                  >
                    {line.matchedDocumentNumber}
                  </Link>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Not matched</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  )
}

function BankReconciliationHeader({
  totals,
  loading,
  autoMatchLoading,
  onImport,
  onAutoMatch,
}: {
  totals: { reconciled: string; unmatched: string; count: number }
  loading: boolean
  autoMatchLoading: boolean
  onImport: () => void
  onAutoMatch: () => void
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 bg-background">
              <LandmarkIcon className="size-3.5" />
              Bank matching
            </Badge>
            <Badge
              variant="outline"
              className="gap-1.5 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
            >
              <span className="size-1.5 rounded-full bg-current" />
              Easy check
            </Badge>
          </div>
          <div className="mt-3 max-w-2xl space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Match bank statement
            </h1>
            <p className="max-w-xl text-sm leading-5 text-muted-foreground">
              Check GSTFY payments against your bank.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" size="sm" onClick={onImport}>
                <FileUpIcon className="size-4" />
                Upload statement
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={autoMatchLoading}
                onClick={onAutoMatch}
              >
                {autoMatchLoading ? (
                  <Spinner className="size-4" />
                ) : (
                  <WandSparklesIcon className="size-4" />
                )}
                Find matches
              </Button>
            </div>
          </div>
        </div>
        <div className="border-t border-border bg-muted/10 p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="grid gap-2">
            <BankOverviewMetric
              label="Matched"
              value={formatCurrency(totals.reconciled)}
              loading={loading}
              tone="positive"
              icon={<BadgeCheckIcon className="size-4" />}
            />
            <div className="grid grid-cols-2 gap-2">
              <BankOverviewMetric
                label="Needs checking"
                value={formatCurrency(totals.unmatched)}
                loading={loading}
                tone="warning"
                icon={<BadgeIndianRupeeIcon className="size-4" />}
                compact
              />
              <BankOverviewMetric
                label="Entries"
                value={String(totals.count)}
                loading={loading}
                tone="info"
                icon={<ReceiptTextIcon className="size-4" />}
                compact
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function BankOverviewMetric({
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
  tone: "positive" | "warning" | "info"
  icon: React.ReactNode
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-background p-3",
        tone === "positive" &&
          "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20",
        tone === "warning" &&
          "border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20",
        tone === "info" &&
          "border-blue-200 bg-blue-50/60 dark:border-blue-900/60 dark:bg-blue-950/20"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            "rounded-full border bg-background p-1.5",
            tone === "positive" && "text-emerald-700 dark:text-emerald-300",
            tone === "warning" && "text-amber-700 dark:text-amber-300",
            tone === "info" && "text-blue-700 dark:text-blue-300"
          )}
        >
          {icon}
        </span>
      </div>
      {loading ? (
        <Skeleton className={cn("mt-2 h-5", compact ? "w-16" : "w-28")} />
      ) : (
        <p
          className={cn(
            "mt-2 truncate font-mono font-semibold",
            compact ? "text-sm" : "text-lg",
            tone === "positive" && "text-emerald-700 dark:text-emerald-300",
            tone === "warning" && "text-amber-700 dark:text-amber-300",
            tone === "info" && "text-blue-700 dark:text-blue-300"
          )}
        >
          {value}
        </p>
      )}
    </div>
  )
}

function SortableTableHead<TSortKey extends string>({
  label,
  sortKey,
  activeSortKey,
  sortDirection,
  align = "left",
  className,
  onSort,
}: {
  label: string
  sortKey: TSortKey
  activeSortKey: TSortKey
  sortDirection: SortDirection
  align?: "left" | "right"
  className?: string
  onSort: (sortKey: TSortKey) => void
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

function BankReconciliationStatusBadge({ reconciled }: { reconciled: boolean }) {
  if (reconciled) {
    return (
      <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        <span className="size-1.5 rounded-full bg-current" />
        Matched
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
    >
      <span className="size-1.5 rounded-full bg-current" />
      Needs checking
    </Badge>
  )
}

function StatementLineStatusBadge({ status }: { status: BankStatementLine["matchStatus"] }) {
  if (status === "matched") {
    return (
      <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        <span className="size-1.5 rounded-full bg-current" />
        Matched
      </Badge>
    )
  }

  if (status === "ignored") {
    return (
      <Badge variant="outline" className="gap-1.5 bg-muted/40 text-muted-foreground">
        <span className="size-1.5 rounded-full bg-current" />
        Ignored
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
    >
      <span className="size-1.5 rounded-full bg-current" />
      Needs checking
    </Badge>
  )
}

function EmptyBankRegisterState() {
  return (
    <Empty className="min-h-[22rem] border-0 p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="text-muted-foreground">
          <LandmarkIcon className="size-4" />
        </EmptyMedia>
        <EmptyTitle>No GSTFY bank records found</EmptyTitle>
        <EmptyDescription>
          Record bank, UPI, card, or cheque payments to match them later.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function EmptyStatementLinesState() {
  return (
    <Empty className="min-h-[18rem] border-0 p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="text-muted-foreground">
          <FileUpIcon className="size-4" />
        </EmptyMedia>
        <EmptyTitle>No bank statement rows found</EmptyTitle>
        <EmptyDescription>
          Upload a bank CSV, then let GSTFY find matching payments.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function BankTableSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 rounded-lg" />
      ))}
    </div>
  )
}

function BankListFooter({
  loaded,
  total,
  noun,
}: {
  loaded: number
  total: number
  noun: string
}) {
  return (
    <div className="flex justify-center border-t px-4 py-3 text-xs text-muted-foreground">
      Showing {loaded} of {total} {noun}
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

function paymentMethodLabel(method: BankReconciliationItem["paymentMethod"]) {
  const labels: Record<BankReconciliationItem["paymentMethod"], string> = {
    cash: "Cash",
    bank: "Bank",
    upi: "UPI",
    card: "Card",
    cheque: "Cheque",
    other: "Other",
  }

  return labels[method] ?? method
}

function getBankItemStatus(item: BankReconciliationItem) {
  return item.matchId ? "reconciled" : "unmatched"
}

function getDocumentHref(item: BankReconciliationItem) {
  return item.documentType === "receipt" ?
      `/receipts/${item.documentId}`
    : `/payments/${item.documentId}`
}

function getStatementMatchHref(line: BankStatementLine) {
  if (line.matchedDocumentType === "receipt" && line.matchedReceiptId) {
    return `/receipts/${line.matchedReceiptId}`
  }

  if (line.matchedDocumentType === "payment" && line.matchedPaymentId) {
    return `/payments/${line.matchedPaymentId}`
  }

  return "/money"
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
