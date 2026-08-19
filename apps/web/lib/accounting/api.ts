import { apiRequest } from "@/lib/api/client"

export type LedgerAccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE"
export type NormalBalance = "DEBIT" | "CREDIT"
export type LedgerAccountStatus = "active" | "inactive"
export type LedgerAccountSortBy =
  | "accountCode"
  | "accountName"
  | "accountType"
  | "accountGroup"
  | "status"
export type SortDirection = "asc" | "desc"

export type LedgerAccount = {
  id: string
  businessId: string
  accountCode: string
  accountName: string
  accountType: LedgerAccountType
  accountGroup: string
  normalBalance: NormalBalance
  parentAccountId: string | null
  isSystem: boolean
  allowPosting: boolean
  description: string | null
  status: LedgerAccountStatus
  createdAt: string
  updatedAt: string
}

export type CreateLedgerAccountPayload = {
  parentAccountId?: string | null
  accountCode: string
  accountName: string
  accountType: LedgerAccountType
  accountGroup?: string
  normalBalance?: NormalBalance
  allowPosting?: boolean
  description?: string
}

export type UpdateLedgerAccountPayload = {
  parentAccountId?: string | null
  accountName?: string
  accountGroup?: string
  allowPosting?: boolean
  description?: string | null
  status?: LedgerAccountStatus
}

export type AccountingReportQuery = {
  from?: string
  to?: string
  branchId?: string | null
  gstRegistrationId?: string | null
  warehouseId?: string | null
  page?: number
  limit?: number
}

export type ListLedgerAccountsFilters = {
  page?: number
  limit?: number
  status?: LedgerAccountStatus | "all"
  accountType?: LedgerAccountType | "all"
  sortBy?: LedgerAccountSortBy
  sortDir?: SortDirection
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export type TrialBalanceAccount = {
  id: string
  accountCode: string
  accountName: string
  accountType: LedgerAccountType
  accountGroup: string
  normalBalance: NormalBalance
  status: LedgerAccountStatus
  openingDebit: string
  openingCredit: string
  periodDebit: string
  periodCredit: string
  debitBalance: string
  creditBalance: string
}

export type TrialBalanceResponse = {
  accounts: TrialBalanceAccount[]
  totals: {
    debit: string
    credit: string
  }
}

export type ProfitLossResponse = {
  income: TrialBalanceAccount[]
  expenses: TrialBalanceAccount[]
  totals: {
    income: string
    expenses: string
    netProfit: string
  }
}

export type BalanceSheetResponse = {
  assets: TrialBalanceAccount[]
  liabilities: TrialBalanceAccount[]
  equity: TrialBalanceAccount[]
  totals: {
    assets: string
    liabilities: string
    equity: string
    checkDifference: string
  }
}

export type LedgerLine = {
  id: string
  date: string
  voucherId: string
  voucherNumber: string
  voucherType: string
  narration: string | null
  debit: string
  credit: string
  runningBalance: string
}

export type DayBookEntry = {
  voucher_id: string
  voucher_date: string
  voucher_number: string
  voucher_type: string
  party_name: string | null
  branch_id: string | null
  gst_registration_id: string | null
  total_debit: string
  total_credit: string
}

export async function listLedgerAccounts(
  accessToken: string,
  search = "",
  filters: ListLedgerAccountsFilters = {}
) {
  const query = new URLSearchParams()

  if (search.trim()) {
    query.set("search", search.trim())
  }

  if (filters.page) {
    query.set("page", String(filters.page))
  }

  if (filters.limit) {
    query.set("limit", String(filters.limit))
  }

  if (filters.status && filters.status !== "all") {
    query.set("status", filters.status)
  }

  if (filters.accountType && filters.accountType !== "all") {
    query.set("accountType", filters.accountType)
  }

  if (filters.sortBy) {
    query.set("sortBy", filters.sortBy)
  }

  if (filters.sortDir) {
    query.set("sortDir", filters.sortDir)
  }

  return apiRequest<{ accounts: LedgerAccount[]; pagination: PaginationMeta }>(
    `/accounting/accounts${query.size ? `?${query.toString()}` : ""}`,
    { method: "GET", accessToken }
  )
}

export async function createLedgerAccount(
  accessToken: string,
  payload: CreateLedgerAccountPayload
) {
  return apiRequest<{ account: LedgerAccount }>("/accounting/accounts", {
    method: "POST",
    accessToken,
    body: payload,
  })
}

export async function updateLedgerAccount(
  accessToken: string,
  accountId: string,
  payload: UpdateLedgerAccountPayload
) {
  return apiRequest<{ account: LedgerAccount }>(`/accounting/accounts/${accountId}`, {
    method: "PATCH",
    accessToken,
    body: payload,
  })
}

export async function deactivateLedgerAccount(accessToken: string, accountId: string) {
  return apiRequest<{ account: LedgerAccount }>(`/accounting/accounts/${accountId}`, {
    method: "DELETE",
    accessToken,
  })
}

export async function seedLedgerAccounts(accessToken: string) {
  return apiRequest<{ accounts: LedgerAccount[] }>("/accounting/accounts/seed", {
    method: "POST",
    accessToken,
  })
}

export async function getAccountLedger(
  accessToken: string,
  accountId: string,
  query: AccountingReportQuery = {}
) {
  return apiRequest<{
    account: LedgerAccount
    lines: LedgerLine[]
    pagination: PaginationMeta
  }>(
    `/accounting/accounts/${accountId}/ledger${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export async function getTrialBalance(
  accessToken: string,
  query: AccountingReportQuery = {}
) {
  return apiRequest<TrialBalanceResponse>(
    `/accounting/reports/trial-balance${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export async function getProfitLoss(accessToken: string, query: AccountingReportQuery = {}) {
  return apiRequest<ProfitLossResponse>(
    `/accounting/reports/profit-loss${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export async function getBalanceSheet(
  accessToken: string,
  query: AccountingReportQuery = {}
) {
  return apiRequest<BalanceSheetResponse>(
    `/accounting/reports/balance-sheet${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

export async function getDayBook(accessToken: string, query: AccountingReportQuery = {}) {
  return apiRequest<{ entries: DayBookEntry[]; pagination: PaginationMeta }>(
    `/accounting/reports/day-book${toQueryString(query)}`,
    { method: "GET", accessToken }
  )
}

function toQueryString(query: AccountingReportQuery) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, String(value))
    }
  }

  return params.size ? `?${params.toString()}` : ""
}
