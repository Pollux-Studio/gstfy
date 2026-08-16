import { and, eq, ilike, or, type SQL } from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { db, sql } from "../../db/client.js"
import {
  auditLogs,
  businessMemberPermissions,
  ledgerAccounts,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"
import { toCents, formatCents } from "../core/core.validation.js"
import {
  accountIdParamsSchema,
  createLedgerAccountSchema,
  listAccountsQuerySchema,
  reportQuerySchema,
  updateLedgerAccountSchema,
  type AccountType,
  type ReportQueryInput,
} from "./accounting.schemas.js"

type BusinessAccess = Awaited<ReturnType<typeof requirePrimaryBusinessAccess>>
type AccountingAction = "view" | "create" | "edit" | "delete"

type TrialBalanceSqlRow = {
  id: string
  account_code: string
  account_name: string
  account_type: AccountType
  account_group: string
  normal_balance: "DEBIT" | "CREDIT"
  status: string
  opening_debit: string
  opening_credit: string
  period_debit: string
  period_credit: string
}

type LedgerSqlRow = {
  line_id: string
  entry_date: string
  voucher_id: string
  voucher_number: string
  voucher_type: string
  narration: string | null
  debit: string
  credit: string
}

type DayBookSqlRow = {
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

const defaultLedgerAccounts = [
  accountSeed("1000", "Assets", "ASSET", "CURRENT_ASSETS", "DEBIT", false),
  accountSeed("1110", "Cash", "ASSET", "CASH", "DEBIT", true),
  accountSeed("1120", "Bank", "ASSET", "BANK", "DEBIT", true),
  accountSeed("1130", "Accounts Receivable", "ASSET", "RECEIVABLES", "DEBIT", true),
  accountSeed("1140", "Inventory", "ASSET", "INVENTORY", "DEBIT", true),
  accountSeed("1210", "Input CGST", "ASSET", "GST_INPUT_CREDIT", "DEBIT", true),
  accountSeed("1220", "Input SGST", "ASSET", "GST_INPUT_CREDIT", "DEBIT", true),
  accountSeed("1230", "Input IGST", "ASSET", "GST_INPUT_CREDIT", "DEBIT", true),
  accountSeed("1240", "Input Cess", "ASSET", "GST_INPUT_CREDIT", "DEBIT", true),
  accountSeed("2000", "Liabilities", "LIABILITY", "CURRENT_LIABILITIES", "CREDIT", false),
  accountSeed("2110", "Accounts Payable", "LIABILITY", "PAYABLES", "CREDIT", true),
  accountSeed("2210", "Output CGST", "LIABILITY", "GST_LIABILITIES", "CREDIT", true),
  accountSeed("2220", "Output SGST", "LIABILITY", "GST_LIABILITIES", "CREDIT", true),
  accountSeed("2230", "Output IGST", "LIABILITY", "GST_LIABILITIES", "CREDIT", true),
  accountSeed("2240", "Output Cess", "LIABILITY", "GST_LIABILITIES", "CREDIT", true),
  accountSeed("3000", "Capital", "EQUITY", "EQUITY", "CREDIT", true),
  accountSeed("4100", "Sales", "INCOME", "DIRECT_INCOME", "CREDIT", true),
  accountSeed("4200", "Service Income", "INCOME", "DIRECT_INCOME", "CREDIT", true),
  accountSeed("5100", "Purchases", "EXPENSE", "DIRECT_EXPENSE", "DEBIT", true),
  accountSeed("5200", "Cost of Goods Sold", "EXPENSE", "DIRECT_EXPENSE", "DEBIT", true),
  accountSeed("5300", "Rent", "EXPENSE", "INDIRECT_EXPENSE", "DEBIT", true),
  accountSeed("5400", "Electricity", "EXPENSE", "INDIRECT_EXPENSE", "DEBIT", true),
]

export async function registerAccountingRoutes(app: FastifyInstance) {
  app.get("/accounting/accounts", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseAccounting(access, "view")
    const query = listAccountsQuerySchema.parse(request.query)
    const conditions: SQL[] = [eq(ledgerAccounts.businessId, access.business.id)]

    if (query.status) {
      conditions.push(eq(ledgerAccounts.status, query.status))
    }

    if (query.accountType) {
      conditions.push(eq(ledgerAccounts.accountType, query.accountType))
    }

    if (query.search) {
      const term = `%${escapeLikeTerm(query.search)}%`
      const searchCondition = or(
        ilike(ledgerAccounts.accountCode, term),
        ilike(ledgerAccounts.accountName, term),
        ilike(ledgerAccounts.accountGroup, term)
      )

      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }

    return {
      accounts: await db
        .select()
        .from(ledgerAccounts)
        .where(and(...conditions))
        .orderBy(ledgerAccounts.accountCode),
    }
  })

  app.post("/accounting/accounts/seed", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseAccounting(access, "create")

    await db
      .insert(ledgerAccounts)
      .values(
        defaultLedgerAccounts.map((account) => ({
          businessId: access.business.id,
          ...account,
          isSystem: true,
          description: `Default ${account.accountGroup.toLowerCase().replaceAll("_", " ")} account.`,
        }))
      )
      .onConflictDoNothing()

    await db.insert(auditLogs).values({
      businessId: access.business.id,
      entityType: "ledger_account",
      entityId: access.business.id,
      action: "DEFAULT_CHART_SEEDED",
      userId: access.userId,
      before: null,
      after: { accountCodes: defaultLedgerAccounts.map((account) => account.accountCode) },
      reason: "Accounting engine chart seed",
    })

    return {
      accounts: await listBusinessAccounts(access.business.id),
    }
  })

  app.post("/accounting/accounts", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseAccounting(access, "create")
    const body = createLedgerAccountSchema.parse(request.body)

    await assertAccountCodeAvailable(access.business.id, body.accountCode)

    if (body.parentAccountId) {
      await requireLedgerAccount(access.business.id, body.parentAccountId)
    }

    const [account] = await db
      .insert(ledgerAccounts)
      .values({
        businessId: access.business.id,
        accountCode: body.accountCode,
        accountName: body.accountName,
        accountType: body.accountType,
        accountGroup: body.accountGroup.toUpperCase(),
        normalBalance: body.normalBalance ?? normalBalanceForType(body.accountType),
        parentAccountId: body.parentAccountId ?? null,
        allowPosting: body.allowPosting,
        description: body.description ?? null,
        status: "active",
      })
      .returning()

    if (!account) {
      throw new HttpError(500, "Unable to create ledger account.")
    }

    await db.insert(auditLogs).values({
      businessId: access.business.id,
      entityType: "ledger_account",
      entityId: account.id,
      action: "CREATED",
      userId: access.userId,
      before: null,
      after: account,
      reason: null,
    })

    return { account }
  })

  app.get("/accounting/accounts/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseAccounting(access, "view")
    const { id } = accountIdParamsSchema.parse(request.params)

    return {
      account: await requireLedgerAccount(access.business.id, id),
    }
  })

  app.patch("/accounting/accounts/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseAccounting(access, "edit")
    const { id } = accountIdParamsSchema.parse(request.params)
    const body = updateLedgerAccountSchema.parse(request.body)
    const existing = await requireLedgerAccount(access.business.id, id)

    if (body.parentAccountId) {
      if (body.parentAccountId === id) {
        throw new HttpError(400, "An account cannot be its own parent.")
      }

      await assertParentAccountIsSafe(access.business.id, id, body.parentAccountId)
    }

    if (existing.isSystem && body.status === "inactive") {
      throw new HttpError(409, "System ledger accounts cannot be deactivated.")
    }

    const [account] = await db
      .update(ledgerAccounts)
      .set({
        ...(body.accountName !== undefined ? { accountName: body.accountName } : {}),
        ...(body.accountGroup !== undefined ?
          { accountGroup: body.accountGroup.toUpperCase() }
        : {}),
        ...(body.parentAccountId !== undefined ?
          { parentAccountId: body.parentAccountId ?? null }
        : {}),
        ...(body.allowPosting !== undefined ? { allowPosting: body.allowPosting } : {}),
        ...(body.description !== undefined ? { description: body.description ?? null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(ledgerAccounts.businessId, access.business.id), eq(ledgerAccounts.id, id)))
      .returning()

    if (!account) {
      throw new HttpError(500, "Unable to update ledger account.")
    }

    await db.insert(auditLogs).values({
      businessId: access.business.id,
      entityType: "ledger_account",
      entityId: account.id,
      action: "UPDATED",
      userId: access.userId,
      before: existing,
      after: account,
      reason: null,
    })

    return { account }
  })

  app.delete("/accounting/accounts/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseAccounting(access, "delete")
    const { id } = accountIdParamsSchema.parse(request.params)
    const existing = await requireLedgerAccount(access.business.id, id)

    if (existing.isSystem) {
      throw new HttpError(409, "System ledger accounts cannot be deactivated.")
    }

    const [account] = await db
      .update(ledgerAccounts)
      .set({ status: "inactive", allowPosting: false, updatedAt: new Date() })
      .where(and(eq(ledgerAccounts.businessId, access.business.id), eq(ledgerAccounts.id, id)))
      .returning()

    if (!account) {
      throw new HttpError(500, "Unable to deactivate ledger account.")
    }

    await db.insert(auditLogs).values({
      businessId: access.business.id,
      entityType: "ledger_account",
      entityId: account.id,
      action: "DEACTIVATED",
      userId: access.userId,
      before: existing,
      after: account,
      reason: "Chart account deactivation",
    })

    return { account }
  })

  app.get("/accounting/accounts/:id/ledger", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseAccounting(access, "view")
    const { id } = accountIdParamsSchema.parse(request.params)
    const query = reportQuerySchema.parse(request.query)
    const account = await requireLedgerAccount(access.business.id, id)
    const rows = await getLedgerRows(access.business.id, account.id, query)
    let runningBalance = 0

    return {
      account,
      lines: rows.map((row) => {
        const debit = toCents(row.debit)
        const credit = toCents(row.credit)
        runningBalance +=
          account.normalBalance === "CREDIT" ? credit - debit : debit - credit

        return {
          id: row.line_id,
          date: row.entry_date,
          voucherId: row.voucher_id,
          voucherNumber: row.voucher_number,
          voucherType: row.voucher_type,
          narration: row.narration,
          debit: row.debit,
          credit: row.credit,
          runningBalance: formatCents(runningBalance),
        }
      }),
    }
  })

  app.get("/accounting/reports/trial-balance", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseAccounting(access, "view")
    const query = reportQuerySchema.parse(request.query)
    const rows = await getTrialBalanceRows(access.business.id, query)
    const accounts = rows.map(toTrialBalanceAccount)

    return {
      accounts,
      totals: {
        debit: formatCents(accounts.reduce((total, row) => total + toCents(row.debitBalance), 0)),
        credit: formatCents(accounts.reduce((total, row) => total + toCents(row.creditBalance), 0)),
      },
    }
  })

  app.get("/accounting/reports/profit-loss", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseAccounting(access, "view")
    const query = reportQuerySchema.parse(request.query)
    const rows = (await getTrialBalanceRows(access.business.id, query))
      .map(toTrialBalanceAccount)
      .filter((account) => account.accountType === "INCOME" || account.accountType === "EXPENSE")
    const income = rows.filter((row) => row.accountType === "INCOME")
    const expenses = rows.filter((row) => row.accountType === "EXPENSE")
    const totalIncome = income.reduce(
      (total, row) => total + toCents(row.creditBalance) - toCents(row.debitBalance),
      0
    )
    const totalExpenses = expenses.reduce(
      (total, row) => total + toCents(row.debitBalance) - toCents(row.creditBalance),
      0
    )

    return {
      income,
      expenses,
      totals: {
        income: formatCents(totalIncome),
        expenses: formatCents(totalExpenses),
        netProfit: formatCents(totalIncome - totalExpenses),
      },
    }
  })

  app.get("/accounting/reports/balance-sheet", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseAccounting(access, "view")
    const query = reportQuerySchema.parse(request.query)
    const rows = (await getTrialBalanceRows(access.business.id, query)).map(
      toTrialBalanceAccount
    )
    const assets = rows.filter((row) => row.accountType === "ASSET")
    const liabilities = rows.filter((row) => row.accountType === "LIABILITY")
    const equity = rows.filter((row) => row.accountType === "EQUITY")
    const totalAssets = assets.reduce(
      (total, row) => total + toCents(row.debitBalance) - toCents(row.creditBalance),
      0
    )
    const totalLiabilities = liabilities.reduce(
      (total, row) => total + toCents(row.creditBalance) - toCents(row.debitBalance),
      0
    )
    const totalEquity = equity.reduce(
      (total, row) => total + toCents(row.creditBalance) - toCents(row.debitBalance),
      0
    )

    return {
      assets,
      liabilities,
      equity,
      totals: {
        assets: formatCents(totalAssets),
        liabilities: formatCents(totalLiabilities),
        equity: formatCents(totalEquity),
        checkDifference: formatCents(totalAssets - totalLiabilities - totalEquity),
      },
    }
  })

  app.get("/accounting/reports/day-book", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    await assertCanUseAccounting(access, "view")
    const query = reportQuerySchema.parse(request.query)

    return {
      entries: await getDayBookRows(access.business.id, query),
    }
  })
}

async function listBusinessAccounts(businessId: string) {
  return db
    .select()
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.businessId, businessId))
    .orderBy(ledgerAccounts.accountCode)
}

async function requireLedgerAccount(businessId: string, accountId: string) {
  const account = await db.query.ledgerAccounts.findFirst({
    where: and(eq(ledgerAccounts.businessId, businessId), eq(ledgerAccounts.id, accountId)),
  })

  if (!account) {
    throw new HttpError(404, "Ledger account not found.")
  }

  return account
}

async function assertAccountCodeAvailable(businessId: string, accountCode: string) {
  const existing = await db.query.ledgerAccounts.findFirst({
    where: and(
      eq(ledgerAccounts.businessId, businessId),
      eq(ledgerAccounts.accountCode, accountCode)
    ),
  })

  if (existing) {
    throw new HttpError(409, "Ledger account code already exists.")
  }
}

async function assertParentAccountIsSafe(
  businessId: string,
  accountId: string,
  parentAccountId: string
) {
  let currentParentId: string | null = parentAccountId

  while (currentParentId) {
    if (currentParentId === accountId) {
      throw new HttpError(400, "Account parent cannot create a hierarchy cycle.")
    }

    const parent = await requireLedgerAccount(businessId, currentParentId)
    currentParentId = parent.parentAccountId
  }
}

async function assertCanUseAccounting(access: BusinessAccess, action: AccountingAction) {
  if (access.membership.role === "owner" || access.membership.role === "admin") {
    return
  }

  const permissionColumn =
    action === "view" ? businessMemberPermissions.canView
    : action === "create" ? businessMemberPermissions.canCreate
    : action === "edit" ? businessMemberPermissions.canEdit
    : businessMemberPermissions.canDelete

  const permission = await db.query.businessMemberPermissions.findFirst({
    where: and(
      eq(businessMemberPermissions.businessMemberId, access.membership.id),
      eq(businessMemberPermissions.module, "accounting"),
      eq(permissionColumn, true)
    ),
  })

  if (!permission) {
    throw new HttpError(403, "You do not have permission to access accounting.")
  }
}

function toTrialBalanceAccount(row: TrialBalanceSqlRow) {
  const opening = toCents(row.opening_debit) - toCents(row.opening_credit)
  const periodDebit = toCents(row.period_debit)
  const periodCredit = toCents(row.period_credit)
  const closing = opening + periodDebit - periodCredit

  return {
    id: row.id,
    accountCode: row.account_code,
    accountName: row.account_name,
    accountType: row.account_type,
    accountGroup: row.account_group,
    normalBalance: row.normal_balance,
    status: row.status,
    openingDebit: opening >= 0 ? formatCents(opening) : "0.00",
    openingCredit: opening < 0 ? formatCents(Math.abs(opening)) : "0.00",
    periodDebit: row.period_debit,
    periodCredit: row.period_credit,
    debitBalance: closing >= 0 ? formatCents(closing) : "0.00",
    creditBalance: closing < 0 ? formatCents(Math.abs(closing)) : "0.00",
  }
}

async function getTrialBalanceRows(businessId: string, query: ReportQueryInput) {
  const from = query.from ?? null
  const to = query.to ?? null
  const branchId = query.branchId ?? null
  const gstRegistrationId = query.gstRegistrationId ?? null
  const warehouseId = query.warehouseId ?? null

  return sql<TrialBalanceSqlRow[]>`
    select
      account.id,
      account.account_code,
      account.account_name,
      account.account_type,
      account.account_group,
      account.normal_balance,
      account.status,
      coalesce(sum(case
        when ${from}::text is not null and entry.entry_date < ${from}::text
          then line.debit
        else 0
      end), 0)::text as opening_debit,
      coalesce(sum(case
        when ${from}::text is not null and entry.entry_date < ${from}::text
          then line.credit
        else 0
      end), 0)::text as opening_credit,
      coalesce(sum(case
        when (${from}::text is null or entry.entry_date >= ${from}::text)
          and (${to}::text is null or entry.entry_date <= ${to}::text)
          then line.debit
        else 0
      end), 0)::text as period_debit,
      coalesce(sum(case
        when (${from}::text is null or entry.entry_date >= ${from}::text)
          and (${to}::text is null or entry.entry_date <= ${to}::text)
          then line.credit
        else 0
      end), 0)::text as period_credit
    from public.ledger_accounts account
    left join public.journal_entry_lines line
      on line.account_id = account.id
      and line.business_id = account.business_id
    left join public.journal_entries entry
      on entry.id = line.journal_entry_id
    left join public.vouchers voucher
      on voucher.id = entry.voucher_id
    where account.business_id = ${businessId}
      and (${branchId}::uuid is null or voucher.branch_id = ${branchId}::uuid or voucher.id is null)
      and (${gstRegistrationId}::uuid is null or voucher.gst_registration_id = ${gstRegistrationId}::uuid or voucher.id is null)
      and (${warehouseId}::uuid is null or voucher.warehouse_id = ${warehouseId}::uuid or voucher.id is null)
    group by account.id
    order by account.account_code
  `
}

async function getLedgerRows(
  businessId: string,
  accountId: string,
  query: ReportQueryInput
) {
  const from = query.from ?? null
  const to = query.to ?? null
  const branchId = query.branchId ?? null
  const gstRegistrationId = query.gstRegistrationId ?? null
  const warehouseId = query.warehouseId ?? null

  return sql<LedgerSqlRow[]>`
    select
      line.id as line_id,
      entry.entry_date,
      voucher.id as voucher_id,
      voucher.voucher_number,
      voucher.voucher_type,
      line.narration,
      line.debit::text,
      line.credit::text
    from public.journal_entry_lines line
    inner join public.journal_entries entry
      on entry.id = line.journal_entry_id
    inner join public.vouchers voucher
      on voucher.id = entry.voucher_id
    where line.business_id = ${businessId}
      and line.account_id = ${accountId}
      and (${from}::text is null or entry.entry_date >= ${from}::text)
      and (${to}::text is null or entry.entry_date <= ${to}::text)
      and (${branchId}::uuid is null or voucher.branch_id = ${branchId}::uuid)
      and (${gstRegistrationId}::uuid is null or voucher.gst_registration_id = ${gstRegistrationId}::uuid)
      and (${warehouseId}::uuid is null or voucher.warehouse_id = ${warehouseId}::uuid)
    order by entry.entry_date, entry.created_at, line.created_at, line.id
  `
}

async function getDayBookRows(businessId: string, query: ReportQueryInput) {
  const from = query.from ?? null
  const to = query.to ?? null
  const branchId = query.branchId ?? null
  const gstRegistrationId = query.gstRegistrationId ?? null
  const warehouseId = query.warehouseId ?? null

  return sql<DayBookSqlRow[]>`
    select
      voucher.id as voucher_id,
      voucher.voucher_date,
      voucher.voucher_number,
      voucher.voucher_type,
      coalesce(
        voucher.party_snapshot ->> 'displayName',
        voucher.party_snapshot ->> 'tradeName',
        voucher.party_snapshot ->> 'legalName'
      ) as party_name,
      voucher.branch_id,
      voucher.gst_registration_id,
      coalesce(sum(line.debit), 0)::text as total_debit,
      coalesce(sum(line.credit), 0)::text as total_credit
    from public.vouchers voucher
    left join public.journal_entries entry
      on entry.voucher_id = voucher.id
    left join public.journal_entry_lines line
      on line.journal_entry_id = entry.id
    where voucher.business_id = ${businessId}
      and (${from}::text is null or voucher.voucher_date >= ${from}::text)
      and (${to}::text is null or voucher.voucher_date <= ${to}::text)
      and (${branchId}::uuid is null or voucher.branch_id = ${branchId}::uuid)
      and (${gstRegistrationId}::uuid is null or voucher.gst_registration_id = ${gstRegistrationId}::uuid)
      and (${warehouseId}::uuid is null or voucher.warehouse_id = ${warehouseId}::uuid)
    group by voucher.id
    order by voucher.voucher_date desc, voucher.created_at desc
    limit 100
  `
}

function accountSeed(
  accountCode: string,
  accountName: string,
  accountType: AccountType,
  accountGroup: string,
  normalBalance: "DEBIT" | "CREDIT",
  allowPosting: boolean
) {
  return {
    accountCode,
    accountName,
    accountType,
    accountGroup,
    normalBalance,
    allowPosting,
  }
}

function normalBalanceForType(accountType: AccountType) {
  return accountType === "ASSET" || accountType === "EXPENSE" ? "DEBIT" : "CREDIT"
}

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}
