"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BookOpenTextIcon,
  FilePlus2Icon,
  LandmarkIcon,
  ListChecksIcon,
  PlusIcon,
  RefreshCcwIcon,
  SearchIcon,
  TrendingUpIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import {
  createLedgerAccount,
  deactivateLedgerAccount,
  getAccountLedger,
  getBalanceSheet,
  getDayBook,
  getProfitLoss,
  getTrialBalance,
  listLedgerAccounts,
  seedLedgerAccounts,
  type CreateLedgerAccountPayload,
  type LedgerAccount,
  type LedgerAccountType,
  type NormalBalance,
} from "@/lib/accounting/api"
import { getStoredAuthSession } from "@/lib/auth/session"
import { cn } from "@/lib/utils"

type AccountFormState = {
  accountCode: string
  accountName: string
  accountType: LedgerAccountType
  accountGroup: string
  normalBalance: NormalBalance
  allowPosting: "yes" | "no"
  parentAccountId: string
  description: string
}

const emptyForm: AccountFormState = {
  accountCode: "",
  accountName: "",
  accountType: "ASSET",
  accountGroup: "CURRENT_ASSETS",
  normalBalance: "DEBIT",
  allowPosting: "yes",
  parentAccountId: "",
  description: "",
}

const accountTypeLabels: Record<LedgerAccountType, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENSE: "Expenses",
}

const accountGroups = [
  "CURRENT_ASSETS",
  "FIXED_ASSETS",
  "INVENTORY",
  "RECEIVABLES",
  "CASH",
  "BANK",
  "CURRENT_LIABILITIES",
  "PAYABLES",
  "GST_LIABILITIES",
  "GST_INPUT_CREDIT",
  "EQUITY",
  "DIRECT_INCOME",
  "INDIRECT_INCOME",
  "DIRECT_EXPENSE",
  "INDIRECT_EXPENSE",
  "UNCATEGORIZED",
]

export function AccountingPage() {
  const queryClient = useQueryClient()
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const [search, setSearch] = React.useState("")
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [form, setForm] = React.useState<AccountFormState>(emptyForm)
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null)

  const accountsQuery = useQuery({
    queryKey: ["accounting", "accounts", search],
    queryFn: () => listLedgerAccounts(accessToken, search),
    enabled: accessToken.length > 0,
  })
  const trialBalanceQuery = useQuery({
    queryKey: ["accounting", "trial-balance"],
    queryFn: () => getTrialBalance(accessToken),
    enabled: accessToken.length > 0,
  })
  const profitLossQuery = useQuery({
    queryKey: ["accounting", "profit-loss"],
    queryFn: () => getProfitLoss(accessToken),
    enabled: accessToken.length > 0,
  })
  const balanceSheetQuery = useQuery({
    queryKey: ["accounting", "balance-sheet"],
    queryFn: () => getBalanceSheet(accessToken),
    enabled: accessToken.length > 0,
  })
  const dayBookQuery = useQuery({
    queryKey: ["accounting", "day-book"],
    queryFn: () => getDayBook(accessToken),
    enabled: accessToken.length > 0,
  })
  const ledgerQuery = useQuery({
    queryKey: ["accounting", "ledger", selectedAccountId],
    queryFn: () => getAccountLedger(accessToken, selectedAccountId ?? ""),
    enabled: accessToken.length > 0 && Boolean(selectedAccountId),
  })

  const seedMutation = useMutation({
    mutationFn: () => seedLedgerAccounts(accessToken),
    onSuccess: async () => {
      toast.success("Default chart of accounts seeded.")
      await invalidateAccountingQueries(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateLedgerAccountPayload) =>
      createLedgerAccount(accessToken, payload),
    onSuccess: async () => {
      toast.success("Ledger account created.")
      setIsCreateOpen(false)
      setForm(emptyForm)
      await invalidateAccountingQueries(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deactivateMutation = useMutation({
    mutationFn: (accountId: string) => deactivateLedgerAccount(accessToken, accountId),
    onSuccess: async () => {
      toast.success("Ledger account deactivated.")
      await invalidateAccountingQueries(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const accounts = accountsQuery.data?.accounts ?? []
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId)

  function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createMutation.mutate({
      accountCode: form.accountCode,
      accountName: form.accountName,
      accountType: form.accountType,
      accountGroup: form.accountGroup,
      normalBalance: form.normalBalance,
      allowPosting: form.allowPosting === "yes",
      parentAccountId: form.parentAccountId || null,
      description: form.description || undefined,
    })
  }

  function updateForm<K extends keyof AccountFormState>(
    key: K,
    value: AccountFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6">
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <Badge variant="outline" className="gap-1.5">
              <BookOpenTextIcon className="size-3.5" />
              Double-entry foundation
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Accounting</h1>
              <p className="text-sm text-muted-foreground">
                Manage stable ledger accounts and inspect books derived from posted
                vouchers. Posted journal lines are read-only accounting facts.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? (
                <Spinner className="size-4" />
              ) : (
                <RefreshCcwIcon className="size-4" />
              )}
              Seed defaults
            </Button>
            <Button onClick={() => setIsCreateOpen(true)}>
              <PlusIcon className="size-4" />
              Add account
            </Button>
          </div>
        </div>
      </section>

      <Tabs defaultValue="accounts" className="space-y-5">
        <TabsList className="h-auto flex-wrap justify-start rounded-xl border bg-transparent p-1">
          <TabsTrigger value="accounts">Chart of accounts</TabsTrigger>
          <TabsTrigger value="trial">Trial balance</TabsTrigger>
          <TabsTrigger value="profit-loss">Profit & loss</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance sheet</TabsTrigger>
          <TabsTrigger value="day-book">Day book</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-5">
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.8fr)]">
            <div className="rounded-2xl border bg-card">
              <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-medium">Ledger accounts</h2>
                  <p className="text-sm text-muted-foreground">
                    `account_id` is the accounting identity. Code and name are snapshots
                    on posted lines.
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-8"
                    placeholder="Search accounts"
                  />
                </div>
              </div>
              <AccountTable
                accounts={accounts}
                isLoading={accountsQuery.isLoading}
                selectedAccountId={selectedAccountId}
                onSelect={setSelectedAccountId}
                onDeactivate={(account) => deactivateMutation.mutate(account.id)}
                isDeactivating={deactivateMutation.isPending}
              />
            </div>
            <LedgerPanel
              account={selectedAccount ?? null}
              lines={ledgerQuery.data?.lines ?? []}
              isLoading={ledgerQuery.isLoading}
            />
          </section>
        </TabsContent>

        <TabsContent value="trial">
          <ReportCard title="Trial balance" icon={<ListChecksIcon className="size-4" />}>
            <TrialBalanceTable
              isLoading={trialBalanceQuery.isLoading}
              accounts={trialBalanceQuery.data?.accounts ?? []}
              debitTotal={trialBalanceQuery.data?.totals.debit ?? "0.00"}
              creditTotal={trialBalanceQuery.data?.totals.credit ?? "0.00"}
            />
          </ReportCard>
        </TabsContent>

        <TabsContent value="profit-loss">
          <ReportCard title="Profit & loss" icon={<TrendingUpIcon className="size-4" />}>
            <StatementGrid
              leftTitle="Income"
              rightTitle="Expenses"
              leftRows={profitLossQuery.data?.income ?? []}
              rightRows={profitLossQuery.data?.expenses ?? []}
              leftTotal={profitLossQuery.data?.totals.income ?? "0.00"}
              rightTotal={profitLossQuery.data?.totals.expenses ?? "0.00"}
              resultLabel="Net profit"
              resultValue={profitLossQuery.data?.totals.netProfit ?? "0.00"}
              isLoading={profitLossQuery.isLoading}
            />
          </ReportCard>
        </TabsContent>

        <TabsContent value="balance-sheet">
          <ReportCard title="Balance sheet" icon={<LandmarkIcon className="size-4" />}>
            <StatementGrid
              leftTitle="Assets"
              rightTitle="Liabilities + Equity"
              leftRows={balanceSheetQuery.data?.assets ?? []}
              rightRows={[
                ...(balanceSheetQuery.data?.liabilities ?? []),
                ...(balanceSheetQuery.data?.equity ?? []),
              ]}
              leftTotal={balanceSheetQuery.data?.totals.assets ?? "0.00"}
              rightTotal={formatAmount(
                toNumber(balanceSheetQuery.data?.totals.liabilities) +
                  toNumber(balanceSheetQuery.data?.totals.equity)
              )}
              resultLabel="Check difference"
              resultValue={balanceSheetQuery.data?.totals.checkDifference ?? "0.00"}
              isLoading={balanceSheetQuery.isLoading}
            />
          </ReportCard>
        </TabsContent>

        <TabsContent value="day-book">
          <ReportCard title="Day book" icon={<FilePlus2Icon className="size-4" />}>
            <DayBookTable
              isLoading={dayBookQuery.isLoading}
              entries={dayBookQuery.data?.entries ?? []}
            />
          </ReportCard>
        </TabsContent>
      </Tabs>

      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Add ledger account</SheetTitle>
            <SheetDescription>
              Create chart metadata only. Journal posting happens through domain
              services, not this screen.
            </SheetDescription>
          </SheetHeader>
          <form className="mt-6 space-y-5" onSubmit={handleCreateSubmit}>
            <FieldGroup className="gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Account code</FieldLabel>
                  <Input
                    value={form.accountCode}
                    onChange={(event) =>
                      updateForm("accountCode", event.target.value.toUpperCase())
                    }
                    placeholder="1150"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>Account type</FieldLabel>
                  <Select
                    value={form.accountType}
                    onValueChange={(value) => {
                      const accountType = value as LedgerAccountType
                      updateForm("accountType", accountType)
                      updateForm(
                        "normalBalance",
                        accountType === "ASSET" || accountType === "EXPENSE" ?
                          "DEBIT"
                        : "CREDIT"
                      )
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(accountTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel>Account name</FieldLabel>
                <Input
                  value={form.accountName}
                  onChange={(event) => updateForm("accountName", event.target.value)}
                  placeholder="Petty Cash"
                  required
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Account group</FieldLabel>
                  <Select
                    value={form.accountGroup}
                    onValueChange={(value) => updateForm("accountGroup", value ?? "UNCATEGORIZED")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accountGroups.map((group) => (
                        <SelectItem key={group} value={group}>
                          {humanize(group)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Normal balance</FieldLabel>
                  <Select
                    value={form.normalBalance}
                    onValueChange={(value) =>
                      updateForm("normalBalance", value as NormalBalance)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEBIT">Debit</SelectItem>
                      <SelectItem value="CREDIT">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel>Parent account</FieldLabel>
                <Select
                  value={form.parentAccountId || "none"}
                  onValueChange={(value) =>
                    updateForm("parentAccountId", !value || value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.accountCode} · {account.accountName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Posting allowed</FieldLabel>
                <Select
                  value={form.allowPosting}
                  onValueChange={(value) =>
                    updateForm("allowPosting", value as AccountFormState["allowPosting"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No, grouping account only</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Description</FieldLabel>
                <Textarea
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  placeholder="Where this account should be used"
                />
              </Field>
            </FieldGroup>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Spinner className="size-4" /> : null}
                Create account
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </main>
  )
}

function AccountTable({
  accounts,
  isLoading,
  selectedAccountId,
  isDeactivating,
  onSelect,
  onDeactivate,
}: {
  accounts: LedgerAccount[]
  isLoading: boolean
  selectedAccountId: string | null
  isDeactivating: boolean
  onSelect: (accountId: string) => void
  onDeactivate: (account: LedgerAccount) => void
}) {
  if (isLoading) {
    return <TableSkeleton columns={6} />
  }

  if (accounts.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="font-medium">No ledger accounts found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Seed defaults or add an account to start accounting reports.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Group</TableHead>
            <TableHead>Posting</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => (
            <TableRow
              key={account.id}
              className={cn(
                "cursor-pointer",
                selectedAccountId === account.id && "bg-muted/50"
              )}
              onClick={() => onSelect(account.id)}
            >
              <TableCell className="font-mono text-xs">{account.accountCode}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="font-medium">{account.accountName}</div>
                  {account.isSystem ? (
                    <Badge variant="outline" className="text-[11px]">
                      System
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{accountTypeLabels[account.accountType]}</TableCell>
              <TableCell className="text-muted-foreground">{humanize(account.accountGroup)}</TableCell>
              <TableCell>
                <Badge variant={account.allowPosting ? "default" : "outline"}>
                  {account.allowPosting ? "Allowed" : "Group only"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={account.isSystem || account.status === "inactive" || isDeactivating}
                  onClick={(event) => {
                    event.stopPropagation()
                    onDeactivate(account)
                  }}
                >
                  Deactivate
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function LedgerPanel({
  account,
  lines,
  isLoading,
}: {
  account: LedgerAccount | null
  lines: Array<{
    id: string
    date: string
    voucherNumber: string
    voucherType: string
    narration: string | null
    debit: string
    credit: string
    runningBalance: string
  }>
  isLoading: boolean
}) {
  return (
    <div className="rounded-2xl border bg-card">
      <div className="border-b p-4">
        <h2 className="font-medium">Ledger drill-down</h2>
        <p className="text-sm text-muted-foreground">
          {account ?
            `${account.accountCode} · ${account.accountName}`
          : "Select an account to inspect posted lines."}
        </p>
      </div>
      {!account ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Ledger lines will appear here after selecting an account.
        </div>
      ) : isLoading ? (
        <TableSkeleton columns={5} />
      ) : lines.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No posted journal lines for this account.
        </div>
      ) : (
        <div className="max-h-[520px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Voucher</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{formatDate(line.date)}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="font-mono text-xs">{line.voucherNumber}</div>
                      <div className="text-xs text-muted-foreground">{line.voucherType}</div>
                    </div>
                  </TableCell>
                  <AmountCell value={line.debit} />
                  <AmountCell value={line.credit} />
                  <AmountCell value={line.runningBalance} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function TrialBalanceTable({
  accounts,
  debitTotal,
  creditTotal,
  isLoading,
}: {
  accounts: Array<{
    id: string
    accountCode: string
    accountName: string
    accountType: LedgerAccountType
    debitBalance: string
    creditBalance: string
  }>
  debitTotal: string
  creditTotal: string
  isLoading: boolean
}) {
  if (isLoading) {
    return <TableSkeleton columns={5} />
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Debit</TableHead>
          <TableHead className="text-right">Credit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {accounts.map((account) => (
          <TableRow key={account.id}>
            <TableCell className="font-mono text-xs">{account.accountCode}</TableCell>
            <TableCell>{account.accountName}</TableCell>
            <TableCell>{accountTypeLabels[account.accountType]}</TableCell>
            <AmountCell value={account.debitBalance} />
            <AmountCell value={account.creditBalance} />
          </TableRow>
        ))}
        <TableRow className="bg-muted/40 font-medium">
          <TableCell colSpan={3}>Total</TableCell>
          <AmountCell value={debitTotal} />
          <AmountCell value={creditTotal} />
        </TableRow>
      </TableBody>
    </Table>
  )
}

function StatementGrid({
  leftTitle,
  rightTitle,
  leftRows,
  rightRows,
  leftTotal,
  rightTotal,
  resultLabel,
  resultValue,
  isLoading,
}: {
  leftTitle: string
  rightTitle: string
  leftRows: Array<{ id: string; accountName: string; debitBalance: string; creditBalance: string }>
  rightRows: Array<{ id: string; accountName: string; debitBalance: string; creditBalance: string }>
  leftTotal: string
  rightTotal: string
  resultLabel: string
  resultValue: string
  isLoading: boolean
}) {
  if (isLoading) {
    return <TableSkeleton columns={2} />
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <StatementList title={leftTitle} rows={leftRows} total={leftTotal} />
      <StatementList title={rightTitle} rows={rightRows} total={rightTotal} />
      <div className="rounded-xl border bg-muted/30 p-4 lg:col-span-2">
        <div className="flex items-center justify-between gap-4">
          <span className="font-medium">{resultLabel}</span>
          <span className="font-mono text-lg font-semibold">{formatCurrency(resultValue)}</span>
        </div>
      </div>
    </div>
  )
}

function StatementList({
  title,
  rows,
  total,
}: {
  title: string
  rows: Array<{ id: string; accountName: string; debitBalance: string; creditBalance: string }>
  total: string
}) {
  return (
    <div className="rounded-xl border">
      <div className="border-b p-3 font-medium">{title}</div>
      <div className="divide-y">
        {rows.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No balances yet.</div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-4 p-3 text-sm">
              <span>{row.accountName}</span>
              <span className="font-mono">
                {formatCurrency(
                  Math.max(toNumber(row.debitBalance), toNumber(row.creditBalance))
                )}
              </span>
            </div>
          ))
        )}
      </div>
      <div className="flex items-center justify-between gap-4 border-t bg-muted/30 p-3 font-medium">
        <span>Total</span>
        <span className="font-mono">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}

function DayBookTable({
  entries,
  isLoading,
}: {
  entries: Array<{
    voucher_id: string
    voucher_date: string
    voucher_number: string
    voucher_type: string
    party_name: string | null
    total_debit: string
    total_credit: string
  }>
  isLoading: boolean
}) {
  if (isLoading) {
    return <TableSkeleton columns={5} />
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Voucher</TableHead>
          <TableHead>Party</TableHead>
          <TableHead className="text-right">Debit</TableHead>
          <TableHead className="text-right">Credit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
              No posted vouchers yet.
            </TableCell>
          </TableRow>
        ) : (
          entries.map((entry) => (
            <TableRow key={entry.voucher_id}>
              <TableCell>{formatDate(entry.voucher_date)}</TableCell>
              <TableCell>
                <div className="space-y-0.5">
                  <div className="font-mono text-xs">{entry.voucher_number}</div>
                  <div className="text-xs text-muted-foreground">{entry.voucher_type}</div>
                </div>
              </TableCell>
              <TableCell>{entry.party_name ?? "Business transaction"}</TableCell>
              <AmountCell value={entry.total_debit} />
              <AmountCell value={entry.total_credit} />
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

function ReportCard({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center gap-2 border-b p-4">
        {icon}
        <h2 className="font-medium">{title}</h2>
      </div>
      <div className="overflow-x-auto p-1 sm:p-4">{children}</div>
    </section>
  )
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton key={columnIndex} className="h-8 rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  )
}

function AmountCell({ value }: { value: string }) {
  return (
    <TableCell className="text-right font-mono tabular-nums">
      {formatCurrency(value)}
    </TableCell>
  )
}

async function invalidateAccountingQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: ["accounting"] })
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatCurrency(value: string | number) {
  const amount = typeof value === "number" ? value : toNumber(value)

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount)
}

function toNumber(value: string | undefined) {
  const parsed = Number(value ?? "0")
  return Number.isFinite(parsed) ? parsed : 0
}

function formatAmount(value: number) {
  return value.toFixed(2)
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
