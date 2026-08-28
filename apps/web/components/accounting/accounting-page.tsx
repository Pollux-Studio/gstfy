"use client"

import * as React from "react"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  BanIcon,
  BookOpenTextIcon,
  EyeIcon,
  FilePlus2Icon,
  LandmarkIcon,
  ListChecksIcon,
  PlusIcon,
  SearchIcon,
  SearchXIcon,
  SlidersHorizontalIcon,
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
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
  TableFooter,
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
  getBalanceSheet,
  getDayBook,
  getProfitLoss,
  getTrialBalance,
  listLedgerAccounts,
  seedLedgerAccounts,
  type CreateLedgerAccountPayload,
  type LedgerAccount,
  type LedgerAccountSortBy,
  type LedgerAccountStatus,
  type LedgerAccountType,
  type NormalBalance,
  type SortDirection,
  type TrialBalanceAccount,
} from "@/lib/accounting/api"
import { getStoredAuthSession } from "@/lib/auth/session"
import { cn } from "@/lib/utils"

type AccountFormState = {
  accountName: string
  accountType: LedgerAccountType
  accountGroup: string
  normalBalance: NormalBalance
  allowPosting: "yes" | "no"
  parentAccountId: string
  description: string
}

const emptyForm: AccountFormState = {
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

const accountTypeSelectOptions: ReadonlyArray<{
  value: LedgerAccountType
  label: string
}> = Object.entries(accountTypeLabels).map(([value, label]) => ({
  value: value as LedgerAccountType,
  label,
}))

const normalBalanceOptions: ReadonlyArray<{
  value: NormalBalance
  label: string
}> = [
    { value: "DEBIT", label: "Debit" },
    { value: "CREDIT", label: "Credit" },
  ]

const postingAllowedOptions: ReadonlyArray<{
  value: AccountFormState["allowPosting"]
  label: string
}> = [
    { value: "yes", label: "Posting account" },
    { value: "no", label: "Grouping account only" },
  ]

type AccountStatusFilter = LedgerAccountStatus | "all"
type AccountTypeFilter = LedgerAccountType | "all"
type TrialBalanceSideFilter = "all" | "debit" | "credit" | "zero"
type AccountingTab = "accounts" | "trial" | "profit-loss" | "balance-sheet" | "day-book"

const statusFilterOptions: ReadonlyArray<{
  value: AccountStatusFilter
  label: string
}> = [
    { value: "all", label: "All statuses" },
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ]

const typeFilterOptions: ReadonlyArray<{
  value: AccountTypeFilter
  label: string
}> = [
    { value: "all", label: "All types" },
    { value: "ASSET", label: "Assets" },
    { value: "LIABILITY", label: "Liabilities" },
    { value: "EQUITY", label: "Equity" },
    { value: "INCOME", label: "Income" },
    { value: "EXPENSE", label: "Expenses" },
  ]

const trialBalanceSideOptions: ReadonlyArray<{
  value: TrialBalanceSideFilter
  label: string
}> = [
    { value: "all", label: "All balances" },
    { value: "debit", label: "Debit balances" },
    { value: "credit", label: "Credit balances" },
    { value: "zero", label: "Zero balances" },
  ]

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

const accountGroupOptions: ReadonlyArray<{ value: string; label: string }> =
  accountGroups.map((group) => ({ value: group, label: humanize(group) }))

const accountGroupTypeMap: Partial<Record<string, LedgerAccountType>> = {
  CURRENT_ASSETS: "ASSET",
  FIXED_ASSETS: "ASSET",
  INVENTORY: "ASSET",
  RECEIVABLES: "ASSET",
  CASH: "ASSET",
  BANK: "ASSET",
  GST_INPUT_CREDIT: "ASSET",
  CURRENT_LIABILITIES: "LIABILITY",
  PAYABLES: "LIABILITY",
  GST_LIABILITIES: "LIABILITY",
  EQUITY: "EQUITY",
  DIRECT_INCOME: "INCOME",
  INDIRECT_INCOME: "INCOME",
  DIRECT_EXPENSE: "EXPENSE",
  INDIRECT_EXPENSE: "EXPENSE",
}

const defaultGroupByAccountType: Record<LedgerAccountType, string> = {
  ASSET: "CURRENT_ASSETS",
  LIABILITY: "CURRENT_LIABILITIES",
  EQUITY: "EQUITY",
  INCOME: "DIRECT_INCOME",
  EXPENSE: "DIRECT_EXPENSE",
}

const accountCodeBaseByType: Record<LedgerAccountType, number> = {
  ASSET: 1000,
  LIABILITY: 2000,
  EQUITY: 3000,
  INCOME: 4000,
  EXPENSE: 5000,
}

const accountCodeBaseByGroup: Record<string, number> = {
  CURRENT_ASSETS: 1100,
  CASH: 1110,
  BANK: 1120,
  RECEIVABLES: 1130,
  INVENTORY: 1140,
  FIXED_ASSETS: 1500,
  GST_INPUT_CREDIT: 1210,
  CURRENT_LIABILITIES: 2000,
  PAYABLES: 2110,
  GST_LIABILITIES: 2210,
  EQUITY: 3000,
  DIRECT_INCOME: 4100,
  INDIRECT_INCOME: 4300,
  DIRECT_EXPENSE: 5100,
  INDIRECT_EXPENSE: 5300,
  UNCATEGORIZED: 9000,
}

const accountingTablePageSize = 15
const accountingTabTriggerClass =
  "relative h-7 min-w-0 rounded-none px-0 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none dark:data-[state=active]:text-blue-400 after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:scale-x-0 after:rounded-full after:bg-blue-600 after:transition-transform data-[state=active]:after:scale-x-100 dark:after:bg-blue-400"
const compactStickyTableHeadClass =
  "sticky top-0 z-20 h-7 bg-card shadow-[0_1px_0_0_var(--border)]"
const accountingTabTableHeightClass = "h-[30rem]"
const accountingTabFooterClass = "h-10"
const accountingTabCopy: Record<AccountingTab, { title: string; description: string }> = {
  accounts: {
    title: "Ledger accounts",
    description: "Full-width chart register with filtered, sorted, paginated records.",
  },
  trial: {
    title: "Trial balance",
    description: "Filter accounts by category and balance side while totals update instantly.",
  },
  "profit-loss": {
    title: "Profit and loss",
    description: "Review income, expenses, and net result in one compact statement view.",
  },
  "balance-sheet": {
    title: "Balance sheet",
    description: "Check assets against liabilities and equity from posted accounting facts.",
  },
  "day-book": {
    title: "Day book",
    description: "Inspect posted voucher movement with debit and credit totals.",
  },
}

export function AccountingPage() {
  const queryClient = useQueryClient()
  const accessToken = getStoredAuthSession()?.session.accessToken ?? ""
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<AccountStatusFilter>("active")
  const [typeFilter, setTypeFilter] = React.useState<AccountTypeFilter>("all")
  const [sortBy, setSortBy] = React.useState<LedgerAccountSortBy>("accountCode")
  const [sortDir, setSortDir] = React.useState<SortDirection>("asc")
  const [activeAccountingTab, setActiveAccountingTab] =
    React.useState<AccountingTab>("accounts")
  const [trialCategoryFilter, setTrialCategoryFilter] =
    React.useState<AccountTypeFilter>("all")
  const [trialBalanceSideFilter, setTrialBalanceSideFilter] =
    React.useState<TrialBalanceSideFilter>("all")
  const [profitLossGroupFilter, setProfitLossGroupFilter] = React.useState<string[]>(
    []
  )
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [form, setForm] = React.useState<AccountFormState>(emptyForm)
  const hasAttemptedAutoSeedRef = React.useRef(false)

  const accountsQuery = useInfiniteQuery({
    queryKey: ["accounting", "accounts", search, statusFilter, typeFilter, sortBy, sortDir],
    queryFn: ({ pageParam }) =>
      listLedgerAccounts(accessToken, search, {
        page: pageParam,
        limit: accountingTablePageSize,
        status: statusFilter,
        accountType: typeFilter,
        sortBy,
        sortDir,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
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
  const dayBookQuery = useInfiniteQuery({
    queryKey: ["accounting", "day-book"],
    queryFn: ({ pageParam }) =>
      getDayBook(accessToken, {
        page: pageParam,
        limit: accountingTablePageSize,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: accessToken.length > 0,
  })
  const seedMutation = useMutation({
    mutationFn: () => seedLedgerAccounts(accessToken),
    onSuccess: async () => {
      await invalidateAccountingQueries(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateLedgerAccountPayload) =>
      createLedgerAccount(accessToken, payload),
    onSuccess: async () => {
      setIsCreateOpen(false)
      setForm(emptyForm)
      toast.success("Ledger account created.")
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

  const accounts = React.useMemo(
    () => accountsQuery.data?.pages.flatMap((page) => page.accounts) ?? [],
    [accountsQuery.data?.pages]
  )
  const parentAccountOptions = React.useMemo(
    () => [
      { value: "none", label: "No parent" },
      ...accounts.map((account) => ({
        value: account.id,
        label: `${account.accountCode} · ${account.accountName}`,
      })),
    ],
    [accounts]
  )
  const accountGroupOptionsForType = React.useMemo(
    () =>
      accountGroupOptions.filter(
        (option) =>
          option.value === "UNCATEGORIZED" ||
          accountGroupTypeMap[option.value] === form.accountType
      ),
    [form.accountType]
  )
  const generatedAccountCode = React.useMemo(
    () => getNextAccountCode(accounts, form.accountType, form.accountGroup),
    [accounts, form.accountGroup, form.accountType]
  )
  const dayBookEntries = React.useMemo(
    () => dayBookQuery.data?.pages.flatMap((page) => page.entries) ?? [],
    [dayBookQuery.data?.pages]
  )
  const totalAccountsCount =
    accountsQuery.data?.pages[0]?.pagination.total ?? accounts.length
  const totalDayBookEntriesCount =
    dayBookQuery.data?.pages[0]?.pagination.total ?? dayBookEntries.length
  const dayBookDebitTotal = React.useMemo(
    () =>
      formatAmount(
        dayBookEntries.reduce(
          (total, entry) => total + toNumber(entry.total_debit),
          0
        )
      ),
    [dayBookEntries]
  )
  const dayBookCreditTotal = React.useMemo(
    () =>
      formatAmount(
        dayBookEntries.reduce(
          (total, entry) => total + toNumber(entry.total_credit),
          0
        )
      ),
    [dayBookEntries]
  )
  const activeAccountsCount = accounts.filter((account) => account.status === "active").length
  const postingAccountsCount = accounts.filter((account) => account.allowPosting).length
  const systemAccountsCount = accounts.filter((account) => account.isSystem).length
  const hasActiveFilters =
    search.trim().length > 0 || statusFilter !== "active" || typeFilter !== "all"
  const trialBalanceAccounts = React.useMemo(
    () => trialBalanceQuery.data?.accounts ?? [],
    [trialBalanceQuery.data?.accounts]
  )
  const filteredTrialBalanceAccounts = React.useMemo(
    () =>
      trialBalanceAccounts.filter((account) => {
        if (trialCategoryFilter !== "all" && account.accountType !== trialCategoryFilter) {
          return false
        }

        const debit = toNumber(account.debitBalance)
        const credit = toNumber(account.creditBalance)

        if (trialBalanceSideFilter === "debit") {
          return debit > 0
        }

        if (trialBalanceSideFilter === "credit") {
          return credit > 0
        }

        if (trialBalanceSideFilter === "zero") {
          return debit === 0 && credit === 0
        }

        return true
      }),
    [trialBalanceAccounts, trialBalanceSideFilter, trialCategoryFilter]
  )
  const filteredTrialDebitTotal = React.useMemo(
    () =>
      formatAmount(
        filteredTrialBalanceAccounts.reduce(
          (total, account) => total + toNumber(account.debitBalance),
          0
        )
      ),
    [filteredTrialBalanceAccounts]
  )
  const filteredTrialCreditTotal = React.useMemo(
    () =>
      formatAmount(
        filteredTrialBalanceAccounts.reduce(
          (total, account) => total + toNumber(account.creditBalance),
          0
        )
      ),
    [filteredTrialBalanceAccounts]
  )
  const hasTrialFilters =
    trialCategoryFilter !== "all" || trialBalanceSideFilter !== "all"
  const profitLossIncomeRows = React.useMemo(
    () => profitLossQuery.data?.income ?? [],
    [profitLossQuery.data?.income]
  )
  const profitLossExpenseRows = React.useMemo(
    () => profitLossQuery.data?.expenses ?? [],
    [profitLossQuery.data?.expenses]
  )
  const profitLossGroupOptions = React.useMemo(() => {
    const groups = new Set<string>()

    for (const account of [...profitLossIncomeRows, ...profitLossExpenseRows]) {
      if (account.accountGroup) {
        groups.add(account.accountGroup)
      }
    }

    return Array.from(groups).sort((left, right) =>
      humanize(left).localeCompare(humanize(right))
    )
  }, [profitLossExpenseRows, profitLossIncomeRows])
  const activeProfitLossGroupFilter = React.useMemo(
    () =>
      profitLossGroupFilter.filter((group) => profitLossGroupOptions.includes(group)),
    [profitLossGroupFilter, profitLossGroupOptions]
  )
  const filteredProfitLossIncomeRows = React.useMemo(
    () =>
      filterProfitLossRowsByGroup(profitLossIncomeRows, activeProfitLossGroupFilter),
    [activeProfitLossGroupFilter, profitLossIncomeRows]
  )
  const filteredProfitLossExpenseRows = React.useMemo(
    () =>
      filterProfitLossRowsByGroup(profitLossExpenseRows, activeProfitLossGroupFilter),
    [activeProfitLossGroupFilter, profitLossExpenseRows]
  )
  const filteredProfitLossIncomeTotal = React.useMemo(
    () =>
      formatAmount(
        filteredProfitLossIncomeRows.reduce(
          (total, account) => total + getProfitLossRowAmount(account, "income"),
          0
        )
      ),
    [filteredProfitLossIncomeRows]
  )
  const filteredProfitLossExpenseTotal = React.useMemo(
    () =>
      formatAmount(
        filteredProfitLossExpenseRows.reduce(
          (total, account) => total + getProfitLossRowAmount(account, "expense"),
          0
        )
      ),
    [filteredProfitLossExpenseRows]
  )
  const filteredProfitLossNetProfit = React.useMemo(
    () =>
      formatAmount(
        toNumber(filteredProfitLossIncomeTotal) - toNumber(filteredProfitLossExpenseTotal)
      ),
    [filteredProfitLossExpenseTotal, filteredProfitLossIncomeTotal]
  )
  const hasProfitLossFilters = activeProfitLossGroupFilter.length > 0
  const balanceSheetAssetRows = React.useMemo(
    () => balanceSheetQuery.data?.assets ?? [],
    [balanceSheetQuery.data?.assets]
  )
  const balanceSheetLiabilityRows = React.useMemo(
    () => [
      ...(balanceSheetQuery.data?.liabilities ?? []),
      ...(balanceSheetQuery.data?.equity ?? []),
    ],
    [balanceSheetQuery.data?.equity, balanceSheetQuery.data?.liabilities]
  )
  const balanceSheetAssetTotal = balanceSheetQuery.data?.totals.assets ?? "0.00"
  const balanceSheetLiabilityTotal = React.useMemo(
    () =>
      formatAmount(
        toNumber(balanceSheetQuery.data?.totals.liabilities) +
        toNumber(balanceSheetQuery.data?.totals.equity)
      ),
    [balanceSheetQuery.data?.totals.equity, balanceSheetQuery.data?.totals.liabilities]
  )
  const balanceSheetCheckDifference =
    balanceSheetQuery.data?.totals.checkDifference ?? "0.00"
  const hasBalanceSheetRows =
    balanceSheetAssetRows.length > 0 || balanceSheetLiabilityRows.length > 0
  const activeTabCopy = accountingTabCopy[activeAccountingTab]

  React.useEffect(() => {
    const accountTotal = accountsQuery.data?.pages[0]?.pagination.total

    if (
      !accessToken ||
      search.trim().length > 0 ||
      statusFilter !== "active" ||
      typeFilter !== "all" ||
      accountTotal !== 0 ||
      accountsQuery.isLoading ||
      accountsQuery.isFetching ||
      seedMutation.isPending ||
      hasAttemptedAutoSeedRef.current
    ) {
      return
    }

    hasAttemptedAutoSeedRef.current = true
    seedMutation.mutate()
  }, [
    accessToken,
    accountsQuery.data,
    accountsQuery.isFetching,
    accountsQuery.isLoading,
    search,
    seedMutation,
    statusFilter,
    typeFilter,
  ])

  function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createMutation.mutate({
      accountCode: generatedAccountCode,
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

  function handleSortChange(nextSortBy: LedgerAccountSortBy) {
    if (sortBy === nextSortBy) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setSortBy(nextSortBy)
    setSortDir("asc")
  }

  function clearFilters() {
    setSearch("")
    setStatusFilter("active")
    setTypeFilter("all")
  }

  function clearTrialFilters() {
    setTrialCategoryFilter("all")
    setTrialBalanceSideFilter("all")
  }

  function clearProfitLossFilters() {
    setProfitLossGroupFilter([])
  }

  function openCreateDialog() {
    setForm(emptyForm)
    setIsCreateOpen(true)
  }

  function handleCreateDialogOpenChange(open: boolean) {
    if (createMutation.isPending) {
      return
    }

    setIsCreateOpen(open)

    if (!open) {
      setForm(emptyForm)
    }
  }

  function toggleProfitLossGroup(group: string, checked: boolean) {
    setProfitLossGroupFilter((current) => {
      if (!checked) {
        return current.filter((value) => value !== group)
      }

      if (current.includes(group)) {
        return current
      }

      return [...current, group]
    })
  }

  function handleBalanceSheetExport(format: "excel" | "pdf") {
    if (!hasBalanceSheetRows) {
      toast.error("No balance sheet data available to export.")
      return
    }

    const report = {
      assetRows: balanceSheetAssetRows,
      liabilityRows: balanceSheetLiabilityRows,
      assetTotal: balanceSheetAssetTotal,
      liabilityTotal: balanceSheetLiabilityTotal,
      checkDifference: balanceSheetCheckDifference,
    }

    if (format === "excel") {
      downloadBalanceSheetExcel(report)
      return
    }

    const didOpen = printBalanceSheetPdf(report)

    if (!didOpen) {
      toast.error("Allow pop-ups to export the Balance Sheet PDF.")
    }
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-4 p-3 pt-4 sm:p-4 lg:gap-5 lg:p-6 lg:pt-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="p-3.5 sm:p-4 lg:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 bg-background">
                <BookOpenTextIcon className="size-3.5" />
                Accounting
              </Badge>
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <span className="size-1.5 rounded-full bg-current" />
                Double-entry ready
              </Badge>
            </div>
            <div className="mt-3 max-w-2xl space-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Accounting
              </h1>
              <p className="max-w-xl text-sm leading-5 text-muted-foreground">
                Manage the chart of accounts and review posted books from vouchers.
                Journal lines stay read-only after posting.
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                className="h-8 rounded-lg"
                onClick={openCreateDialog}
              >
                <PlusIcon className="size-4" />
                Add account
              </Button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ListChecksIcon className="size-3.5" />
                Defaults are prepared automatically for new workspaces.
              </div>
            </div>
          </div>
          <div className="border-t border-border bg-muted/10 p-3.5 sm:p-4 lg:border-l lg:border-t-0 lg:p-5">
            <div className="grid grid-cols-2 gap-2">
              <AccountingTopMetric
                icon={<BookOpenTextIcon className="size-4" />}
                label="Visible"
                value={accounts.length.toString()}
              />
              <AccountingTopMetric
                icon={<ListChecksIcon className="size-4" />}
                label="Active"
                value={activeAccountsCount.toString()}
                tone="success"
              />
              <AccountingTopMetric
                icon={<FilePlus2Icon className="size-4" />}
                label="Posting"
                value={postingAccountsCount.toString()}
              />
              <AccountingTopMetric
                icon={<LandmarkIcon className="size-4" />}
                label="System"
                value={systemAccountsCount.toString()}
              />
            </div>
          </div>
        </div>
      </section>

      <Tabs
        value={activeAccountingTab}
        defaultValue="accounts"
        onValueChange={(value) => setActiveAccountingTab(value as AccountingTab)}
        className="min-w-0"
      >
        <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
          <div className="border-b border-border px-4 py-3 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 space-y-1">
                <h2 className="text-base font-semibold">{activeTabCopy.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {activeTabCopy.description}
                </p>
              </div>
              <TabsList className="h-auto flex-wrap justify-start gap-4 rounded-none border-0 bg-transparent p-0 xl:justify-end">
                <TabsTrigger value="accounts" className={accountingTabTriggerClass}>
                  Accounts
                </TabsTrigger>
                <TabsTrigger value="trial" className={accountingTabTriggerClass}>
                  Trial
                </TabsTrigger>
                <TabsTrigger value="profit-loss" className={accountingTabTriggerClass}>
                  P&L
                </TabsTrigger>
                <TabsTrigger value="balance-sheet" className={accountingTabTriggerClass}>
                  Balance
                </TabsTrigger>
                <TabsTrigger value="day-book" className={accountingTabTriggerClass}>
                  Day book
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="accounts" className="m-0">
            <div className="flex flex-col gap-2 border-b border-border px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:w-72">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-8 pl-8"
                    placeholder="Search accounts..."
                    aria-label="Search ledger accounts"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter((value ?? "active") as AccountStatusFilter)
                  }
                >
                  <SelectTrigger className="h-8 w-full sm:w-40">
                    <SelectDisplayValue
                      value={statusFilter}
                      options={statusFilterOptions}
                      placeholder="Status"
                    />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {statusFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={typeFilter}
                  onValueChange={(value) =>
                    setTypeFilter((value ?? "all") as AccountTypeFilter)
                  }
                >
                  <SelectTrigger className="h-8 w-full sm:w-36">
                    <SelectDisplayValue
                      value={typeFilter}
                      options={typeFilterOptions}
                      placeholder="Type"
                    />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {typeFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-destructive hover:text-destructive"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
            <AccountTable
              accounts={accounts}
              isLoading={accountsQuery.isLoading}
              isFetchingNextPage={accountsQuery.isFetchingNextPage}
              hasNextPage={accountsQuery.hasNextPage}
              totalAccountsCount={totalAccountsCount}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSortChange}
              onLoadMore={() => void accountsQuery.fetchNextPage()}
              onDeactivate={(account) => deactivateMutation.mutate(account.id)}
              isDeactivating={deactivateMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="trial" className="m-0">
            <div className="flex flex-col gap-2 border-b border-border px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={trialCategoryFilter}
                  onValueChange={(value) =>
                    setTrialCategoryFilter((value ?? "all") as AccountTypeFilter)
                  }
                >
                  <SelectTrigger className="h-8 w-full sm:w-40">
                    <SelectDisplayValue
                      value={trialCategoryFilter}
                      options={typeFilterOptions}
                      placeholder="Category"
                    />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {typeFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={trialBalanceSideFilter}
                  onValueChange={(value) =>
                    setTrialBalanceSideFilter(
                      (value ?? "all") as TrialBalanceSideFilter
                    )
                  }
                >
                  <SelectTrigger className="h-8 w-full sm:w-44">
                    <SelectDisplayValue
                      value={trialBalanceSideFilter}
                      options={trialBalanceSideOptions}
                      placeholder="Balance"
                    />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {trialBalanceSideOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  {filteredTrialBalanceAccounts.length} of {trialBalanceAccounts.length} accounts
                </div>
              </div>
              {hasTrialFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-destructive hover:text-destructive"
                  onClick={clearTrialFilters}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
            <TrialBalanceTable
              isLoading={trialBalanceQuery.isLoading}
              accounts={filteredTrialBalanceAccounts}
              debitTotal={filteredTrialDebitTotal}
              creditTotal={filteredTrialCreditTotal}
            />
          </TabsContent>

          <TabsContent value="profit-loss" className="m-0">
            <div className="flex flex-col gap-2 border-b border-border px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-full justify-start gap-2 sm:w-56"
                      />
                    }
                  >
                    <SlidersHorizontalIcon className="size-4" />
                    <span className="truncate">
                      {hasProfitLossFilters
                        ? `${activeProfitLossGroupFilter.length} groups selected`
                        : "All P&L groups"}
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Included groups</DropdownMenuLabel>
                      <DropdownMenuCheckboxItem
                        checked={!hasProfitLossFilters}
                        onCheckedChange={() => setProfitLossGroupFilter([])}
                      >
                        All income and expenses
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator />
                      {profitLossGroupOptions.length > 0 ? (
                        profitLossGroupOptions.map((group) => (
                          <DropdownMenuCheckboxItem
                            key={group}
                            checked={activeProfitLossGroupFilter.includes(group)}
                            onCheckedChange={(checked) =>
                              toggleProfitLossGroup(group, checked === true)
                            }
                          >
                            {humanize(group)}
                          </DropdownMenuCheckboxItem>
                        ))
                      ) : (
                        <DropdownMenuItem disabled>No P&L groups yet</DropdownMenuItem>
                      )}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="text-xs text-muted-foreground">
                  {filteredProfitLossIncomeRows.length} income /{" "}
                  {filteredProfitLossExpenseRows.length} expense accounts
                </div>
              </div>
              {hasProfitLossFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-destructive hover:text-destructive"
                  onClick={clearProfitLossFilters}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
            <ProfitLossPanel
              incomeRows={filteredProfitLossIncomeRows}
              expenseRows={filteredProfitLossExpenseRows}
              incomeTotal={filteredProfitLossIncomeTotal}
              expenseTotal={filteredProfitLossExpenseTotal}
              netProfit={filteredProfitLossNetProfit}
              isLoading={profitLossQuery.isLoading}
            />
          </TabsContent>

          <TabsContent value="balance-sheet" className="m-0">
            <div className="flex flex-col gap-2 border-b border-border px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
              <div className="text-xs text-muted-foreground">
                Export the current balance sheet snapshot with posted account totals.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <BalanceSheetExportButton
                  label="Excel"
                  logoSrc="/excel-logo.webp"
                  disabled={balanceSheetQuery.isLoading || !hasBalanceSheetRows}
                  onClick={() => handleBalanceSheetExport("excel")}
                />
                <BalanceSheetExportButton
                  label="PDF"
                  logoSrc="/pdf-logo.webp"
                  disabled={balanceSheetQuery.isLoading || !hasBalanceSheetRows}
                  onClick={() => handleBalanceSheetExport("pdf")}
                />
              </div>
            </div>
            <BalanceSheetPanel
              assetRows={balanceSheetAssetRows}
              liabilityRows={balanceSheetLiabilityRows}
              assetTotal={balanceSheetAssetTotal}
              liabilityTotal={balanceSheetLiabilityTotal}
              checkDifference={balanceSheetCheckDifference}
              isLoading={balanceSheetQuery.isLoading}
            />
          </TabsContent>

          <TabsContent value="day-book" className="m-0">
            <div className="flex flex-col gap-2 border-b border-border px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex size-7 items-center justify-center rounded-lg border border-border bg-muted/30 text-foreground">
                  <FilePlus2Icon className="size-3.5" />
                </span>
                <span>
                  <span className="font-medium text-foreground">
                    {dayBookEntries.length}
                  </span>{" "}
                  of {totalDayBookEntriesCount} posted voucher rows loaded
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <DayBookMetric label="Debit" value={dayBookDebitTotal} tone="success" />
                <DayBookMetric label="Credit" value={dayBookCreditTotal} tone="danger" />
              </div>
            </div>
            <DayBookTable
              isLoading={dayBookQuery.isLoading}
              isFetchingNextPage={dayBookQuery.isFetchingNextPage}
              hasNextPage={dayBookQuery.hasNextPage}
              totalEntriesCount={totalDayBookEntriesCount}
              onLoadMore={() => void dayBookQuery.fetchNextPage()}
              entries={dayBookEntries}
            />
          </TabsContent>
        </section>
      </Tabs>

      <Dialog open={isCreateOpen} onOpenChange={handleCreateDialogOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-3xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-4 py-4 pr-12 sm:px-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 text-foreground">
                <BookOpenTextIcon className="size-4" />
              </span>
              <div className="min-w-0 space-y-1">
                <DialogTitle>Add ledger account</DialogTitle>
                <DialogDescription className="text-xs">
                  Create chart metadata for posting-ready books. Journal entries
                  still flow through domain transactions, not manual edits.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form className="flex min-h-0 flex-col" onSubmit={handleCreateSubmit}>
            <div className="app-scrollbar max-h-[calc(100dvh-13rem)] overflow-y-auto px-4 py-4 sm:px-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
                <div className="space-y-4">
                  <section className="rounded-2xl border border-border bg-background p-4">
                    <div className="mb-3">
                      <h3 className="text-sm font-medium">Basic details</h3>
                      <p className="text-xs text-muted-foreground">
                        Use a short code and a clear name so reports stay readable.
                      </p>
                    </div>
                    <FieldGroup className="gap-3">
                      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                        <Field>
                          <FieldLabel>
                            Account code<span className="text-destructive">*</span>
                          </FieldLabel>
                          <Input
                            value={generatedAccountCode}
                            className="h-8 bg-muted/40 font-mono text-muted-foreground"
                            readOnly
                            tabIndex={-1}
                            aria-readonly="true"
                            required
                          />
                          <FieldDescription className="text-xs">
                            Auto generated from account type and group.
                          </FieldDescription>
                        </Field>
                        <Field>
                          <FieldLabel>
                            Account name<span className="text-destructive">*</span>
                          </FieldLabel>
                          <Input
                            value={form.accountName}
                            onChange={(event) =>
                              updateForm("accountName", event.target.value)
                            }
                            className="h-8"
                            placeholder="Petty Cash"
                            required
                          />
                        </Field>
                      </div>
                      <Field>
                        <FieldLabel>Description</FieldLabel>
                        <Textarea
                          value={form.description}
                          onChange={(event) =>
                            updateForm("description", event.target.value)
                          }
                          className="min-h-20 resize-none"
                          placeholder="Where this account should be used"
                        />
                      </Field>
                    </FieldGroup>
                  </section>

                  <section className="rounded-2xl border border-border bg-background p-4">
                    <div className="mb-3">
                      <h3 className="text-sm font-medium">Classification</h3>
                      <p className="text-xs text-muted-foreground">
                        Classification controls where this account appears in
                        Trial, P&L, and Balance Sheet reports.
                      </p>
                    </div>
                    <FieldGroup className="gap-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field>
                          <FieldLabel>
                            Account type<span className="text-destructive">*</span>
                          </FieldLabel>
                          <Select
                            value={form.accountType}
                            onValueChange={(value) => {
                              const accountType = value as LedgerAccountType
                              updateForm("accountType", accountType)
                              updateForm(
                                "accountGroup",
                                defaultGroupByAccountType[accountType]
                              )
                              updateForm(
                                "normalBalance",
                                accountType === "ASSET" || accountType === "EXPENSE" ?
                                  "DEBIT"
                                  : "CREDIT"
                              )
                            }}
                          >
                            <SelectTrigger className="h-8 w-full">
                              <SelectDisplayValue
                                value={form.accountType}
                                options={accountTypeSelectOptions}
                                placeholder="Choose type"
                              />
                            </SelectTrigger>
                            <SelectContent align="start">
                              {accountTypeSelectOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field>
                          <FieldLabel>
                            Account group<span className="text-destructive">*</span>
                          </FieldLabel>
                          <Select
                            value={form.accountGroup}
                            onValueChange={(value) =>
                              updateForm("accountGroup", value ?? "UNCATEGORIZED")
                            }
                          >
                            <SelectTrigger className="h-8 w-full">
                              <SelectDisplayValue
                                value={form.accountGroup}
                                options={accountGroupOptionsForType}
                                placeholder="Choose group"
                              />
                            </SelectTrigger>
                            <SelectContent align="start">
                              {accountGroupOptionsForType.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                    </FieldGroup>
                  </section>
                </div>

                <aside className="space-y-4">
                  <section className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium">Posting rules</h3>
                        <p className="text-xs text-muted-foreground">
                          Decide if voucher lines can hit this account.
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-background">
                        {accountTypeLabels[form.accountType]}
                      </Badge>
                    </div>
                    <FieldGroup className="gap-3">
                      <Field>
                        <FieldLabel>Normal balance</FieldLabel>
                        <Select
                          value={form.normalBalance}
                          onValueChange={(value) =>
                            updateForm("normalBalance", value as NormalBalance)
                          }
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectDisplayValue
                              value={form.normalBalance}
                              options={normalBalanceOptions}
                              placeholder="Normal balance"
                            />
                          </SelectTrigger>
                          <SelectContent align="start">
                            {normalBalanceOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
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
                            updateForm(
                              "allowPosting",
                              value as AccountFormState["allowPosting"]
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectDisplayValue
                              value={form.allowPosting}
                              options={postingAllowedOptions}
                              placeholder="Posting mode"
                            />
                          </SelectTrigger>
                          <SelectContent align="start">
                            {postingAllowedOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>Parent account</FieldLabel>
                        <Select
                          value={form.parentAccountId || "none"}
                          onValueChange={(value) =>
                            updateForm(
                              "parentAccountId",
                              !value || value === "none" ? "" : value
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectDisplayValue
                              value={form.parentAccountId || "none"}
                              options={parentAccountOptions}
                              placeholder="Parent account"
                            />
                          </SelectTrigger>
                          <SelectContent align="start" className="max-h-72">
                            {parentAccountOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </FieldGroup>
                  </section>

                  <section className="rounded-2xl border border-border bg-background p-4 text-xs">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-medium">
                          {accountTypeLabels[form.accountType]}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Balance side</span>
                        <span
                          className={cn(
                            "font-mono font-semibold",
                            form.normalBalance === "DEBIT" &&
                            "text-emerald-700 dark:text-emerald-300",
                            form.normalBalance === "CREDIT" && "text-destructive"
                          )}
                        >
                          {form.normalBalance}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Posting</span>
                        <span className="font-medium">
                          {form.allowPosting === "yes" ? "Allowed" : "Blocked"}
                        </span>
                      </div>
                    </div>
                  </section>
                </aside>
              </div>
            </div>
            <DialogFooter className="border-t border-border px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="outline"
                disabled={createMutation.isPending}
                onClick={() => handleCreateDialogOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <Spinner className="size-4" />
                ) : (
                  "Create account"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function AccountTable({
  accounts,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  totalAccountsCount,
  sortBy,
  sortDir,
  isDeactivating,
  onSort,
  onLoadMore,
  onDeactivate,
}: {
  accounts: LedgerAccount[]
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  totalAccountsCount: number
  sortBy: LedgerAccountSortBy
  sortDir: SortDirection
  isDeactivating: boolean
  onSort: (sortBy: LedgerAccountSortBy) => void
  onLoadMore: () => void
  onDeactivate: (account: LedgerAccount) => void
}) {
  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!hasNextPage || isFetchingNextPage) {
        return
      }

      const target = event.currentTarget
      const remaining = target.scrollHeight - target.scrollTop - target.clientHeight

      if (remaining <= 8) {
        onLoadMore()
      }
    },
    [hasNextPage, isFetchingNextPage, onLoadMore]
  )

  if (isLoading) {
    return <TableSkeleton columns={7} />
  }

  if (accounts.length === 0) {
    return (
      <>
        <div
          className={cn(
            "flex items-center justify-center text-center",
            accountingTabTableHeightClass
          )}
        >
          <div className="px-4">
            <p className="font-medium">No ledger accounts found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Default chart accounts are prepared automatically for new workspaces.
            </p>
          </div>
        </div>
        <InfiniteTableFooter
          isFetchingNextPage={false}
          hasNextPage={false}
          loadedCount={0}
          totalCount={totalAccountsCount}
          noun="accounts"
        />
      </>
    )
  }

  return (
    <>
      <div
        className={cn(
          "app-scrollbar overflow-y-auto overflow-x-hidden [&_[data-slot=table-container]]:overflow-visible",
          accountingTabTableHeightClass
        )}
        onScroll={handleScroll}
      >
        <Table className="w-full table-fixed text-[11px] sm:text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-2">
          <colgroup>
            <col className="w-[12%]" />
            <col className="w-[27%]" />
            <col className="w-[14%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
            <col className="w-[8%]" />
            <col className="w-[7%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
            <TableRow className="hover:bg-transparent">
              <SortableAccountsTableHead
                sortKey="accountCode"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
              >
                Code
              </SortableAccountsTableHead>
              <SortableAccountsTableHead
                sortKey="accountName"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
              >
                Account
              </SortableAccountsTableHead>
              <SortableAccountsTableHead
                sortKey="accountType"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
              >
                Type
              </SortableAccountsTableHead>
              <SortableAccountsTableHead
                sortKey="accountGroup"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
              >
                Group
              </SortableAccountsTableHead>
              <TableHead className={compactStickyTableHeadClass}>Posting</TableHead>
              <SortableAccountsTableHead
                sortKey="status"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
              >
                Status
              </SortableAccountsTableHead>
              <TableHead className={cn(compactStickyTableHeadClass, "pr-3 text-right")}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-mono text-xs">{account.accountCode}</TableCell>
                <TableCell>
                  <div className="min-w-0 space-y-0.5">
                    <div className="truncate font-medium">{account.accountName}</div>
                    {account.isSystem ? (
                      <Badge variant="outline" className="px-1 py-0 text-[10px]">
                        System
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{accountTypeLabels[account.accountType]}</TableCell>
                <TableCell className="truncate text-muted-foreground">
                  {humanize(account.accountGroup)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={account.allowPosting ? "default" : "outline"}
                    className="max-w-full truncate px-1 py-0 text-[10px]"
                  >
                    {account.allowPosting ? "Allowed" : "Group only"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "max-w-full truncate px-1 py-0 text-[10px]",
                      account.status === "active" &&
                      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                    )}
                  >
                    {humanize(account.status)}
                  </Badge>
                </TableCell>
                <TableCell className="pr-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Open ${account.accountName} ledger`}
                      nativeButton={false}
                      render={
                        <Link href={`/accounting/accounts/${account.id}`} />
                      }
                    >
                      <EyeIcon className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Deactivate ${account.accountName}`}
                      disabled={
                        account.isSystem ||
                        account.status === "inactive" ||
                        isDeactivating
                      }
                      onClick={() => onDeactivate(account)}
                    >
                      <BanIcon className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <InfiniteTableFooter
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        loadedCount={accounts.length}
        totalCount={totalAccountsCount}
        noun="accounts"
      />
    </>
  )
}

function SortableAccountsTableHead({
  children,
  onSort,
  sortBy,
  sortDir,
  sortKey,
}: {
  children: React.ReactNode
  onSort: (sortBy: LedgerAccountSortBy) => void
  sortBy: LedgerAccountSortBy
  sortDir: SortDirection
  sortKey: LedgerAccountSortBy
}) {
  const isActive = sortBy === sortKey
  const SortIcon =
    !isActive ? ArrowUpDownIcon
      : sortDir === "asc" ? ArrowUpIcon
        : ArrowDownIcon

  return (
    <TableHead className={compactStickyTableHeadClass}>
      <button
        type="button"
        className={cn(
          "flex max-w-full items-center gap-1 rounded-md text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive ? "text-primary" : "text-foreground"
        )}
        onClick={() => onSort(sortKey)}
      >
        <span className="truncate">{children}</span>
        <SortIcon
          className={cn(
            "size-3 shrink-0",
            !isActive && "text-muted-foreground/70"
          )}
        />
      </button>
    </TableHead>
  )
}

function AccountingTopMetric({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: "default" | "success"
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground",
            tone === "success" &&
            "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
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
    <div className="grid min-h-0 grid-rows-[auto_auto]">
      <div
        className={cn(
          "app-scrollbar overflow-y-auto overflow-x-hidden [&_[data-slot=table-container]]:overflow-visible",
          accountingTabTableHeightClass
        )}
      >
        <Table className="w-full table-fixed text-[11px] sm:text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-2">
          <colgroup>
            <col className="w-[13%]" />
            <col className="w-[37%]" />
            <col className="w-[18%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
            <TableRow className="hover:bg-transparent">
              <TableHead className={compactStickyTableHeadClass}>Code</TableHead>
              <TableHead className={compactStickyTableHeadClass}>Account</TableHead>
              <TableHead className={compactStickyTableHeadClass}>Type</TableHead>
              <TableHead className={cn(compactStickyTableHeadClass, "text-right")}>
                Debit
              </TableHead>
              <TableHead className={cn(compactStickyTableHeadClass, "pr-3 text-right")}>
                Credit
              </TableHead>
            </TableRow>
          </TableHeader>
          {accounts.length > 0 ? (
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-mono text-xs">{account.accountCode}</TableCell>
                  <TableCell className="truncate">{account.accountName}</TableCell>
                  <TableCell>{accountTypeLabels[account.accountType]}</TableCell>
                  <AmountCell
                    value={account.debitBalance}
                    tone={getTrialAmountTone(account.accountType)}
                  />
                  <AmountCell
                    value={account.creditBalance}
                    tone={getTrialAmountTone(account.accountType)}
                    className="pr-3"
                  />
                </TableRow>
              ))}
            </TableBody>
          ) : null}
        </Table>
        {accounts.length === 0 ? (
          <Empty className="h-[calc(30rem-1.75rem)] border-0 p-4">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <SearchXIcon className="size-4" />
              </EmptyMedia>
              <EmptyTitle>No trial accounts match</EmptyTitle>
              <EmptyDescription>
                The selected category and balance filter removed every account from
                this trial view. Clear filters or choose a broader category to review
                debit and credit totals.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
      </div>
      <Table className="w-full table-fixed text-[11px] sm:text-xs [&_td]:h-10 [&_td]:px-2 [&_td]:py-0">
        <colgroup>
          <col className="w-[13%]" />
          <col className="w-[37%]" />
          <col className="w-[18%]" />
          <col className="w-[16%]" />
          <col className="w-[16%]" />
        </colgroup>
        <TableFooter className={cn("border-t border-border bg-muted/40", accountingTabFooterClass)}>
          <TableRow className="h-10 hover:bg-muted/40">
            <TableCell colSpan={3} className="font-medium">
              Total
            </TableCell>
            <AmountCell value={debitTotal} />
            <AmountCell value={creditTotal} className="pr-3" />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}

function ProfitLossPanel({
  incomeRows,
  expenseRows,
  incomeTotal,
  expenseTotal,
  netProfit,
  isLoading,
}: {
  incomeRows: TrialBalanceAccount[]
  expenseRows: TrialBalanceAccount[]
  incomeTotal: string
  expenseTotal: string
  netProfit: string
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className={cn("p-4", accountingTabTableHeightClass)}>
        <TableSkeleton columns={2} />
      </div>
    )
  }

  const netProfitValue = toNumber(netProfit)

  return (
    <div className="grid min-h-0 grid-rows-[auto_auto]">
      <div
        className={cn(
          "grid min-h-0 gap-3 p-3 lg:grid-cols-2",
          accountingTabTableHeightClass
        )}
      >
        <StatementList
          title="Income"
          rows={incomeRows}
          total={incomeTotal}
          tone="income"
        />
        <StatementList
          title="Expenses"
          rows={expenseRows}
          total={expenseTotal}
          tone="expense"
        />
      </div>
      <div
        className={cn(
          "grid border-t border-border bg-muted/20 text-xs sm:grid-cols-3",
          accountingTabFooterClass
        )}
      >
        <ProfitLossMetric label="Income" value={incomeTotal} tone="success" />
        <ProfitLossMetric label="Expenses" value={expenseTotal} tone="danger" />
        <ProfitLossMetric
          label={netProfitValue >= 0 ? "Net profit" : "Net loss"}
          value={netProfit}
          tone={netProfitValue >= 0 ? "success" : "danger"}
        />
      </div>
    </div>
  )
}

function BalanceSheetPanel({
  assetRows,
  liabilityRows,
  assetTotal,
  liabilityTotal,
  checkDifference,
  isLoading,
}: {
  assetRows: TrialBalanceAccount[]
  liabilityRows: TrialBalanceAccount[]
  assetTotal: string
  liabilityTotal: string
  checkDifference: string
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className={cn("p-4", accountingTabTableHeightClass)}>
        <TableSkeleton columns={2} />
      </div>
    )
  }

  const checkDifferenceValue = toNumber(checkDifference)

  return (
    <div className="grid min-h-0 grid-rows-[auto_auto]">
      <div
        className={cn(
          "grid min-h-0 gap-3 p-3 lg:grid-cols-2",
          accountingTabTableHeightClass
        )}
      >
        <StatementList title="Assets" rows={assetRows} total={assetTotal} tone="success" />
        <StatementList
          title="Liabilities + Equity"
          rows={liabilityRows}
          total={liabilityTotal}
          tone="danger"
        />
      </div>
      <div
        className={cn(
          "grid border-t border-border bg-muted/20 text-xs sm:grid-cols-3",
          accountingTabFooterClass
        )}
      >
        <ProfitLossMetric label="Assets" value={assetTotal} tone="success" />
        <ProfitLossMetric
          label="Liabilities + equity"
          value={liabilityTotal}
          tone="danger"
        />
        <ProfitLossMetric
          label="Check difference"
          value={checkDifference}
          tone={checkDifferenceValue === 0 ? "success" : "danger"}
        />
      </div>
    </div>
  )
}

function BalanceSheetExportButton({
  label,
  logoSrc,
  disabled,
  onClick,
}: {
  label: string
  logoSrc: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-2 rounded-lg px-2.5 text-xs"
      disabled={disabled}
      onClick={onClick}
    >
      <Image
        src={logoSrc}
        alt=""
        width={18}
        height={18}
        className="size-4 rounded-sm object-cover"
      />
      {label}
    </Button>
  )
}

function StatementList({
  title,
  rows,
  total,
  tone = "default",
}: {
  title: string
  rows: Array<{ id: string; accountName: string; debitBalance: string; creditBalance: string }>
  total: string
  tone?: "default" | "income" | "expense" | "success" | "danger"
}) {
  const amountClassName = getStatementAmountClassName(tone)

  return (
    <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl border">
      <div className="border-b px-3 py-2 text-sm font-medium">{title}</div>
      <div className="app-scrollbar min-h-0 divide-y overflow-y-auto">
        {rows.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No balances yet.</div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-4 p-2.5 text-xs">
              <span className="min-w-0 truncate">{row.accountName}</span>
              <span className={cn("font-mono", amountClassName)}>
                {formatCurrency(getStatementDisplayAmount(row, tone))}
              </span>
            </div>
          ))
        )}
      </div>
      <div className="flex h-9 items-center justify-between gap-4 border-t bg-muted/30 px-3 font-medium">
        <span>Total</span>
        <span className={cn("font-mono", amountClassName)}>{formatCurrency(total)}</span>
      </div>
    </div>
  )
}

function ProfitLossMetric({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "success" | "danger"
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-3 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono font-semibold",
          tone === "success" && "text-emerald-700 dark:text-emerald-300",
          tone === "danger" && "text-destructive"
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  )
}

function DayBookMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "success" | "danger"
}) {
  return (
    <div className="flex h-8 min-w-32 items-center justify-between gap-3 rounded-lg border border-border bg-background px-2.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono font-semibold tabular-nums",
          tone === "success" && "text-emerald-700 dark:text-emerald-300",
          tone === "danger" && "text-destructive"
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  )
}

function DayBookTable({
  entries,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  totalEntriesCount,
  onLoadMore,
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
  isFetchingNextPage: boolean
  hasNextPage: boolean
  totalEntriesCount: number
  onLoadMore: () => void
}) {
  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!hasNextPage || isFetchingNextPage) {
        return
      }

      const target = event.currentTarget
      const remaining = target.scrollHeight - target.scrollTop - target.clientHeight

      if (remaining < 160) {
        onLoadMore()
      }
    },
    [hasNextPage, isFetchingNextPage, onLoadMore]
  )

  if (isLoading) {
    return (
      <div className={cn("p-4", accountingTabTableHeightClass)}>
        <TableSkeleton columns={5} />
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          "app-scrollbar overflow-y-auto overflow-x-hidden [&_[data-slot=table-container]]:overflow-visible",
          accountingTabTableHeightClass
        )}
        onScroll={handleScroll}
      >
        <Table className="w-full table-fixed text-[11px] sm:text-xs [&_td]:min-w-0 [&_td]:overflow-hidden [&_td]:px-2 [&_td]:py-2 [&_th]:h-8 [&_th]:min-w-0 [&_th]:px-2">
          <colgroup>
            <col className="w-[13%]" />
            <col className="w-[23%]" />
            <col className="w-[34%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
            <TableRow className="hover:bg-transparent">
              <TableHead className={compactStickyTableHeadClass}>Date</TableHead>
              <TableHead className={compactStickyTableHeadClass}>Voucher</TableHead>
              <TableHead className={compactStickyTableHeadClass}>Party</TableHead>
              <TableHead className={cn(compactStickyTableHeadClass, "text-right")}>
                Debit
              </TableHead>
              <TableHead className={cn(compactStickyTableHeadClass, "text-right")}>
                Credit
              </TableHead>
            </TableRow>
          </TableHeader>
          {entries.length > 0 ? (
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.voucher_id}>
                  <TableCell className="text-muted-foreground">
                    {formatDate(entry.voucher_date)}
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0 space-y-1">
                      <div className="truncate font-mono text-[11px]">
                        {entry.voucher_number}
                      </div>
                      <Badge
                        variant="outline"
                        className="h-5 max-w-full truncate rounded-md px-1.5 text-[10px] font-normal text-muted-foreground"
                      >
                        {humanize(entry.voucher_type)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "block truncate",
                        !entry.party_name && "text-muted-foreground"
                      )}
                    >
                      {entry.party_name ?? "Business transaction"}
                    </span>
                  </TableCell>
                  <AmountCell value={entry.total_debit} tone="success" />
                  <AmountCell value={entry.total_credit} tone="danger" />
                </TableRow>
              ))}
            </TableBody>
          ) : null}
        </Table>
        {entries.length === 0 ? (
          <Empty className="h-[calc(30rem-1.75rem)] border-0 p-4">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
              >
                <FilePlus2Icon className="size-4" />
              </EmptyMedia>
              <EmptyTitle>No posted vouchers yet</EmptyTitle>
              <EmptyDescription>
                Day book entries appear automatically once sales, purchases,
                payments, receipts, or adjustments post accounting vouchers.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
      </div>
      <InfiniteTableFooter
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        loadedCount={entries.length}
        totalCount={totalEntriesCount}
        noun="day book entries"
      />
    </>
  )
}

function InfiniteTableFooter({
  isFetchingNextPage,
  hasNextPage,
  loadedCount,
  totalCount,
  noun,
}: {
  isFetchingNextPage: boolean
  hasNextPage: boolean
  loadedCount: number
  totalCount: number
  noun: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center border-t px-4 text-xs text-muted-foreground",
        accountingTabFooterClass
      )}
    >
      {isFetchingNextPage ? (
        <span className="inline-flex items-center gap-2">
          <Spinner className="size-3.5" />
          Loading more {noun}
        </span>
      ) : hasNextPage ? (
        <span>Scroll to load more {noun}</span>
      ) : (
        <span>
          Showing {loadedCount} of {totalCount} {noun}
        </span>
      )}
    </div>
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

function AmountCell({
  value,
  className,
  tone = "default",
}: {
  value: string
  className?: string
  tone?: "default" | "success" | "danger"
}) {
  return (
    <TableCell
      className={cn(
        "text-right font-mono tabular-nums",
        tone === "success" && "text-emerald-700 dark:text-emerald-300",
        tone === "danger" && "text-destructive",
        className
      )}
    >
      {formatCurrency(value)}
    </TableCell>
  )
}

function filterProfitLossRowsByGroup(
  rows: TrialBalanceAccount[],
  selectedGroups: string[]
) {
  if (selectedGroups.length === 0) {
    return rows
  }

  return rows.filter((row) => selectedGroups.includes(row.accountGroup))
}

function getProfitLossRowAmount(
  row: Pick<TrialBalanceAccount, "debitBalance" | "creditBalance">,
  section: "income" | "expense"
) {
  if (section === "income") {
    return toNumber(row.creditBalance) - toNumber(row.debitBalance)
  }

  return toNumber(row.debitBalance) - toNumber(row.creditBalance)
}

function getStatementDisplayAmount(
  row: Pick<TrialBalanceAccount, "debitBalance" | "creditBalance">,
  tone: "default" | "income" | "expense" | "success" | "danger"
) {
  if (tone === "income") {
    return getProfitLossRowAmount(row, "income")
  }

  if (tone === "expense") {
    return getProfitLossRowAmount(row, "expense")
  }

  return Math.max(toNumber(row.debitBalance), toNumber(row.creditBalance))
}

function getStatementAmountClassName(
  tone: "default" | "income" | "expense" | "success" | "danger"
) {
  if (tone === "income" || tone === "success") {
    return "text-emerald-700 dark:text-emerald-300"
  }

  if (tone === "expense" || tone === "danger") {
    return "text-destructive"
  }

  return undefined
}

function getTrialAmountTone(accountType: LedgerAccountType) {
  if (accountType === "INCOME") {
    return "success"
  }

  if (accountType === "EXPENSE") {
    return "danger"
  }

  return "default"
}

function getNextAccountCode(
  accounts: LedgerAccount[],
  accountType: LedgerAccountType,
  accountGroup: string
) {
  const existingCodes = new Set(accounts.map((account) => account.accountCode))
  const matchingGroupCodes = accounts
    .filter((account) => account.accountGroup === accountGroup)
    .map((account) => Number(account.accountCode))
    .filter((code) => Number.isFinite(code))
  const baseCode =
    accountCodeBaseByGroup[accountGroup] ?? accountCodeBaseByType[accountType]
  const highestGroupCode =
    matchingGroupCodes.length > 0 ? Math.max(...matchingGroupCodes) : baseCode - 10
  let nextCode = Math.max(baseCode, highestGroupCode + 10)

  while (existingCodes.has(String(nextCode))) {
    nextCode += 10
  }

  return String(nextCode)
}

type BalanceSheetExportReport = {
  assetRows: TrialBalanceAccount[]
  liabilityRows: TrialBalanceAccount[]
  assetTotal: string
  liabilityTotal: string
  checkDifference: string
}

function downloadBalanceSheetExcel(report: BalanceSheetExportReport) {
  const generatedAt = new Date()
  const rows = getBalanceSheetExportRows(report)
  const tableRows = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.section)}</td>
          <td>${escapeHtml(row.accountName)}</td>
          <td style="text-align:right;">${escapeHtml(row.amount)}</td>
        </tr>`
    )
    .join("")
  const workbook = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Balance Sheet</title>
      </head>
      <body>
        <h1>Balance Sheet</h1>
        <p>Generated on ${escapeHtml(formatDateTime(generatedAt))}</p>
        <table border="1" cellspacing="0" cellpadding="6">
          <thead>
            <tr>
              <th>Section</th>
              <th>Account</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>`

  downloadTextFile(
    `balance-sheet-${getFileDateStamp(generatedAt)}.xls`,
    workbook,
    "application/vnd.ms-excel;charset=utf-8"
  )
}

function printBalanceSheetPdf(report: BalanceSheetExportReport) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer")

  if (!printWindow) {
    return false
  }

  const generatedAt = new Date()
  const rows = getBalanceSheetExportRows(report)
  const tableRows = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.section)}</td>
          <td>${escapeHtml(row.accountName)}</td>
          <td class="amount">${escapeHtml(row.amount)}</td>
        </tr>`
    )
    .join("")

  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Balance Sheet</title>
        <style>
          body {
            color: #111827;
            font-family: Arial, sans-serif;
            margin: 32px;
          }
          h1 {
            font-size: 22px;
            margin: 0 0 4px;
          }
          p {
            color: #6b7280;
            font-size: 12px;
            margin: 0 0 24px;
          }
          table {
            border-collapse: collapse;
            font-size: 12px;
            width: 100%;
          }
          th,
          td {
            border: 1px solid #d1d5db;
            padding: 8px;
            text-align: left;
          }
          th {
            background: #f3f4f6;
          }
          .amount {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            text-align: right;
            white-space: nowrap;
          }
          @media print {
            body {
              margin: 18mm;
            }
          }
        </style>
      </head>
      <body>
        <h1>Balance Sheet</h1>
        <p>Generated on ${escapeHtml(formatDateTime(generatedAt))}</p>
        <table>
          <thead>
            <tr>
              <th>Section</th>
              <th>Account</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>`)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()

  return true
}

function getBalanceSheetExportRows(report: BalanceSheetExportReport) {
  return [
    ...report.assetRows.map((row) => ({
      section: "Assets",
      accountName: row.accountName,
      amount: formatCurrency(getStatementDisplayAmount(row, "success")),
    })),
    {
      section: "Assets",
      accountName: "Total assets",
      amount: formatCurrency(report.assetTotal),
    },
    ...report.liabilityRows.map((row) => ({
      section: "Liabilities + Equity",
      accountName: row.accountName,
      amount: formatCurrency(getStatementDisplayAmount(row, "danger")),
    })),
    {
      section: "Liabilities + Equity",
      accountName: "Total liabilities + equity",
      amount: formatCurrency(report.liabilityTotal),
    },
    {
      section: "Check",
      accountName: "Check difference",
      amount: formatCurrency(report.checkDifference),
    },
  ]
}

function downloadTextFile(fileName: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value)
}

function getFileDateStamp(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
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
