import type { FastifyInstance } from "fastify"
import { z } from "zod"

import { sql } from "../../db/client.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const dashboardOverviewQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
})

const dashboardLimitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

type MoneyTotalRow = {
  total_amount: string | null
  taxable_value: string | null
  tax_amount: string | null
  paid_amount: string | null
  due_amount: string | null
  count: number
}

type AccountingSummaryRow = {
  income: string | null
  expenses: string | null
}

type InventorySummaryRow = {
  sku_count: number
  inventory_value: string | null
  negative_stock_count: number
  low_stock_count: number
}

type PartyCountRow = {
  customers: number
  suppliers: number
}

type ArApSummaryRow = {
  outstanding_amount: string | null
}

type LowStockRow = {
  item_id: string
  name: string
  sku: string
  hsn_code: string | null
  quantity_on_hand: string | null
  reorder_level: string | null
  inventory_value: string | null
  total_count: number
}

type MonthlyRow = {
  month_key: string
  sales: string | null
  purchases: string | null
  receipts: string | null
  payments: string | null
  income: string | null
  expenses: string | null
}

type RecentDocumentRow = {
  id: string
  date: string
  document_number: string
  party_name: string
  total_amount: string
  paid_amount: string
  due_amount: string
  status: string
}

type GstReadinessRow = {
  id: string | null
  period: string | null
  status: string | null
  generated_at: Date | string | null
  open_exceptions: number
  blocking_exceptions: number
}

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard/overview", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const query = dashboardOverviewQuerySchema.parse(request.query)
    const period = resolveDashboardPeriod(query)
    const businessId = access.business.id

    const [
      [businessRow],
      [sales],
      [purchases],
      [salesReturns],
      [purchaseReturns],
      [accounting],
      [inventory],
      [partyCounts],
      [receivables],
      [payables],
      monthlyRows,
      [gstReadiness],
    ] = await Promise.all([
      sql<{
        name: string
        legal_name: string
        gstin: string | null
        state_code: string | null
      }[]>`
        select
          business.trade_name as name,
          business.legal_name,
          profile.gstin,
          profile.state_code
        from public.businesses business
        left join public.business_profiles profile
          on profile.business_id = business.id
        where business.id = ${businessId}
        limit 1
      `,
      getSalesTotals(businessId, period.from, period.to),
      getPurchaseTotals(businessId, period.from, period.to),
      getAdjustmentTotals(businessId, period.from, period.to, "SALES_RETURN"),
      getAdjustmentTotals(businessId, period.from, period.to, "PURCHASE_RETURN"),
      getAccountingSummary(businessId, period.from, period.to),
      getInventorySummary(businessId),
      getPartyCounts(businessId),
      getArApOutstanding(businessId, "receivable"),
      getArApOutstanding(businessId, "payable"),
      getMonthlyRows(businessId, period.from, period.to),
      getGstReadiness(businessId),
    ])

    const salesTotal = toNumber(sales?.total_amount)
    const purchaseTotal = toNumber(purchases?.total_amount)
    const salesReturnTotal = toNumber(salesReturns?.total_amount)
    const purchaseReturnTotal = toNumber(purchaseReturns?.total_amount)
    const accountingIncome = toNumber(accounting?.income)
    const accountingExpenses = toNumber(accounting?.expenses)
    const outputGst = Math.max(
      toNumber(sales?.tax_amount) - toNumber(salesReturns?.tax_amount),
      0
    )
    const inputGst = Math.max(
      toNumber(purchases?.tax_amount) - toNumber(purchaseReturns?.tax_amount),
      0
    )
    const netProfit =
      accountingIncome !== 0 || accountingExpenses !== 0 ?
        accountingIncome - accountingExpenses
      : salesTotal - salesReturnTotal - purchaseTotal + purchaseReturnTotal

    return {
      business: {
        id: businessId,
        name: businessRow?.name ?? access.business.tradeName,
        legalName: businessRow?.legal_name ?? access.business.legalName,
        gstin: businessRow?.gstin ?? null,
        stateCode: businessRow?.state_code ?? null,
      },
      period,
      summary: {
        sales: money(salesTotal),
        purchases: money(purchaseTotal),
        netProfit: money(netProfit),
        expenses: money(accountingExpenses),
        outputGst: money(outputGst),
        inputGst: money(inputGst),
        estimatedTaxPayable: money(Math.max(outputGst - inputGst, 0)),
        receivables: money(toNumber(receivables?.outstanding_amount)),
        payables: money(toNumber(payables?.outstanding_amount)),
        salesReturns: money(salesReturnTotal),
        purchaseReturns: money(purchaseReturnTotal),
        inventoryValue: money(toNumber(inventory?.inventory_value)),
        skuCount: inventory?.sku_count ?? 0,
        negativeStockCount: inventory?.negative_stock_count ?? 0,
        lowStockCount: inventory?.low_stock_count ?? 0,
        customers: partyCounts?.customers ?? 0,
        suppliers: partyCounts?.suppliers ?? 0,
      },
      trend: normalizeMonthlyRows(monthlyRows, period.from, period.to),
      mix: [
        { label: "Sales", value: salesTotal, fill: "var(--chart-1)" },
        { label: "Purchases", value: purchaseTotal, fill: "var(--chart-2)" },
        { label: "Expenses", value: accountingExpenses, fill: "var(--chart-4)" },
        { label: "Returns", value: salesReturnTotal + purchaseReturnTotal, fill: "var(--chart-5)" },
      ].filter((item) => item.value > 0),
      lowStockItems: [],
      recentSales: [],
      recentPurchases: [],
      filingReadiness: {
        runId: gstReadiness?.id ?? null,
        period: gstReadiness?.period ?? null,
        status: gstReadiness?.status ?? "NOT_GENERATED",
        generatedAt: toIsoString(gstReadiness?.generated_at),
        openExceptions: gstReadiness?.open_exceptions ?? 0,
        blockingExceptions: gstReadiness?.blocking_exceptions ?? 0,
        nextAction: getFilingNextAction(gstReadiness),
      },
    }
  })

  app.get("/dashboard/low-stock", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const query = dashboardLimitQuerySchema.parse(request.query)
    const rows = await getLowStockRows(access.business.id, query.limit)

    return {
      totalCount: rows[0]?.total_count ?? 0,
      items: rows.map(toLowStockItem),
    }
  })

  app.get("/dashboard/recent-activity", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const query = dashboardLimitQuerySchema.parse(request.query)
    const [sales, purchases] = await Promise.all([
      getRecentSales(access.business.id, query.limit),
      getRecentPurchases(access.business.id, query.limit),
    ])

    return {
      sales: sales.map(toRecentDocument),
      purchases: purchases.map(toRecentDocument),
    }
  })
}

async function getSalesTotals(businessId: string, from: string, to: string) {
  return sql<MoneyTotalRow[]>`
    select
      coalesce(sum(total_amount), 0)::text as total_amount,
      coalesce(sum(taxable_value), 0)::text as taxable_value,
      coalesce(sum(cgst_amount + sgst_amount + igst_amount + cess_amount), 0)::text as tax_amount,
      coalesce(sum(amount_paid), 0)::text as paid_amount,
      coalesce(sum(amount_due), 0)::text as due_amount,
      count(*)::int as count
    from public.sales_invoices
    where business_id = ${businessId}
      and status = 'posted'
      and invoice_date::date between ${from}::date and ${to}::date
  `
}

async function getPurchaseTotals(businessId: string, from: string, to: string) {
  return sql<MoneyTotalRow[]>`
    select
      coalesce(sum(total_amount), 0)::text as total_amount,
      coalesce(sum(taxable_value), 0)::text as taxable_value,
      coalesce(sum(cgst_amount + sgst_amount + igst_amount + cess_amount), 0)::text as tax_amount,
      coalesce(sum(amount_paid), 0)::text as paid_amount,
      coalesce(sum(amount_due), 0)::text as due_amount,
      count(*)::int as count
    from public.purchase_bills
    where business_id = ${businessId}
      and status = 'posted'
      and invoice_date::date between ${from}::date and ${to}::date
  `
}

async function getAdjustmentTotals(
  businessId: string,
  from: string,
  to: string,
  adjustmentType: "SALES_RETURN" | "PURCHASE_RETURN"
) {
  return sql<MoneyTotalRow[]>`
    select
      coalesce(sum(grand_total), 0)::text as total_amount,
      coalesce(sum(taxable_total), 0)::text as taxable_value,
      coalesce(sum(cgst_total + sgst_total + igst_total + cess_total), 0)::text as tax_amount,
      '0'::text as paid_amount,
      '0'::text as due_amount,
      count(*)::int as count
    from public.adjustment_documents
    where business_id = ${businessId}
      and adjustment_type = ${adjustmentType}
      and status = 'posted'
      and adjustment_date between ${from}::date and ${to}::date
  `
}

async function getAccountingSummary(businessId: string, from: string, to: string) {
  return sql<AccountingSummaryRow[]>`
    select
      coalesce(sum(case
        when account.account_type = 'INCOME' then line.credit - line.debit
        else 0
      end), 0)::text as income,
      coalesce(sum(case
        when account.account_type = 'EXPENSE' then line.debit - line.credit
        else 0
      end), 0)::text as expenses
    from public.journal_entry_lines line
    inner join public.journal_entries entry
      on entry.id = line.journal_entry_id
    inner join public.ledger_accounts account
      on account.id = line.account_id
      and account.business_id = line.business_id
    where line.business_id = ${businessId}
      and entry.entry_date::date between ${from}::date and ${to}::date
  `
}

async function getInventorySummary(businessId: string) {
  return sql<InventorySummaryRow[]>`
    with tracked_items as (
      select
        item.id,
        coalesce(sum(balance.quantity_on_hand), 0) as quantity_on_hand,
        coalesce(sum(balance.inventory_value), 0) as inventory_value,
        profile.reorder_level
      from public.items item
      inner join public.item_inventory_profiles profile
        on profile.item_id = item.id
        and profile.business_id = item.business_id
      left join public.inventory_balances balance
        on balance.item_id = item.id::text
        and balance.business_id = item.business_id
      where item.business_id = ${businessId}
        and item.status = 'ACTIVE'
        and profile.track_inventory = true
      group by item.id, profile.reorder_level
    )
    select
      (count(*) filter (where quantity_on_hand > 0))::int as sku_count,
      coalesce(sum(inventory_value), 0)::text as inventory_value,
      (count(*) filter (where quantity_on_hand < 0))::int as negative_stock_count,
      (count(*) filter (
        where quantity_on_hand <= greatest(reorder_level, 0)
      ))::int as low_stock_count
    from tracked_items
  `
}

async function getPartyCounts(businessId: string) {
  return sql<PartyCountRow[]>`
    select
      (
        select count(*)::int
        from public.party_customer_profiles customer
        inner join public.parties party
          on party.id = customer.party_id
          and party.business_id = customer.business_id
        where customer.business_id = ${businessId}
          and customer.status = 'active'
          and party.status <> 'archived'
      ) as customers,
      (
        select count(*)::int
        from public.party_supplier_profiles supplier
        inner join public.parties party
          on party.id = supplier.party_id
          and party.business_id = supplier.business_id
        where supplier.business_id = ${businessId}
          and supplier.status = 'active'
          and party.status <> 'archived'
      ) as suppliers
  `
}

async function getArApOutstanding(
  businessId: string,
  entryType: "receivable" | "payable"
) {
  return sql<ArApSummaryRow[]>`
    select coalesce(sum(outstanding_amount), 0)::text as outstanding_amount
    from public.receivable_payable_entries
    where business_id = ${businessId}
      and entry_type = ${entryType}
      and status not in ('cancelled', 'closed')
      and outstanding_amount > 0
  `
}

async function getLowStockRows(businessId: string, limit = 10) {
  return sql<LowStockRow[]>`
    select
      item.id::text as item_id,
      item.name,
      item.sku,
      tax.hsn_sac as hsn_code,
      coalesce(sum(balance.quantity_on_hand), 0)::text as quantity_on_hand,
      profile.reorder_level::text,
      coalesce(sum(balance.inventory_value), 0)::text as inventory_value,
      count(*) over()::int as total_count
    from public.items item
    inner join public.item_inventory_profiles profile
      on profile.item_id = item.id
      and profile.business_id = item.business_id
    left join public.inventory_balances balance
      on balance.item_id = item.id::text
      and balance.business_id = item.business_id
    left join lateral (
      select hsn_sac
      from public.item_tax_profiles tax_profile
      where tax_profile.item_id = item.id
        and tax_profile.business_id = item.business_id
        and tax_profile.status = 'ACTIVE'
      order by tax_profile.effective_from desc
      limit 1
    ) tax on true
    where item.business_id = ${businessId}
      and item.status = 'ACTIVE'
      and profile.track_inventory = true
    group by item.id, item.name, item.sku, tax.hsn_sac, profile.reorder_level
    having coalesce(sum(balance.quantity_on_hand), 0) <= greatest(profile.reorder_level, 0)
    order by coalesce(sum(balance.quantity_on_hand), 0), item.name
    limit ${limit}
  `
}

async function getMonthlyRows(businessId: string, from: string, to: string) {
  return sql<MonthlyRow[]>`
    with months as (
      select generate_series(
        date_trunc('month', ${from}::date),
        date_trunc('month', ${to}::date),
        interval '1 month'
      )::date as month_start
    ),
    sales as (
      select date_trunc('month', invoice_date::date)::date as month_start,
        sum(total_amount) as total
      from public.sales_invoices
      where business_id = ${businessId}
        and status = 'posted'
        and invoice_date::date between ${from}::date and ${to}::date
      group by 1
    ),
    purchases as (
      select date_trunc('month', invoice_date::date)::date as month_start,
        sum(total_amount) as total
      from public.purchase_bills
      where business_id = ${businessId}
        and status = 'posted'
        and invoice_date::date between ${from}::date and ${to}::date
      group by 1
    ),
    receipts as (
      select date_trunc('month', receipt_date)::date as month_start,
        sum(amount) as total
      from public.receipts
      where business_id = ${businessId}
        and status = 'posted'
        and receipt_date between ${from}::date and ${to}::date
      group by 1
    ),
    payments as (
      select date_trunc('month', payment_date)::date as month_start,
        sum(amount) as total
      from public.payments
      where business_id = ${businessId}
        and status = 'posted'
        and payment_date between ${from}::date and ${to}::date
      group by 1
    ),
    accounting as (
      select date_trunc('month', entry.entry_date::date)::date as month_start,
        sum(case when account.account_type = 'INCOME' then line.credit - line.debit else 0 end) as income,
        sum(case when account.account_type = 'EXPENSE' then line.debit - line.credit else 0 end) as expenses
      from public.journal_entry_lines line
      inner join public.journal_entries entry
        on entry.id = line.journal_entry_id
      inner join public.ledger_accounts account
        on account.id = line.account_id
        and account.business_id = line.business_id
      where line.business_id = ${businessId}
        and entry.entry_date::date between ${from}::date and ${to}::date
      group by 1
    )
    select
      to_char(months.month_start, 'YYYY-MM') as month_key,
      coalesce(sales.total, 0)::text as sales,
      coalesce(purchases.total, 0)::text as purchases,
      coalesce(receipts.total, 0)::text as receipts,
      coalesce(payments.total, 0)::text as payments,
      coalesce(accounting.income, 0)::text as income,
      coalesce(accounting.expenses, 0)::text as expenses
    from months
    left join sales using (month_start)
    left join purchases using (month_start)
    left join receipts using (month_start)
    left join payments using (month_start)
    left join accounting using (month_start)
    order by months.month_start
  `
}

async function getRecentSales(businessId: string, limit = 8) {
  return sql<RecentDocumentRow[]>`
    select
      id::text,
      invoice_date as date,
      invoice_number as document_number,
      customer_name as party_name,
      total_amount::text,
      amount_paid::text as paid_amount,
      amount_due::text as due_amount,
      status
    from public.sales_invoices
    where business_id = ${businessId}
      and status in ('draft', 'posted')
    order by created_at desc
    limit ${limit}
  `
}

async function getRecentPurchases(businessId: string, limit = 8) {
  return sql<RecentDocumentRow[]>`
    select
      id::text,
      invoice_date as date,
      bill_number as document_number,
      supplier_name as party_name,
      total_amount::text,
      amount_paid::text as paid_amount,
      amount_due::text as due_amount,
      status
    from public.purchase_bills
    where business_id = ${businessId}
      and status in ('draft', 'posted')
    order by created_at desc
    limit ${limit}
  `
}

async function getGstReadiness(businessId: string) {
  return sql<GstReadinessRow[]>`
    select
      run.id::text,
      run.period,
      run.status,
      run.generated_at,
      count(exception.id) filter (where exception.status = 'OPEN')::int as open_exceptions,
      count(exception.id) filter (
        where exception.status = 'OPEN'
          and exception.is_blocking = true
      )::int as blocking_exceptions
    from public.gst_reporting_runs run
    left join public.gst_reporting_exceptions exception
      on exception.run_id = run.id
      and exception.business_id = run.business_id
    where run.business_id = ${businessId}
    group by run.id
    order by coalesce(run.generated_at, run.created_at) desc
    limit 1
  `
}

function resolveDashboardPeriod(query: { from?: string; to?: string }) {
  const now = new Date()
  const fiscalStartYear =
    now.getUTCMonth() + 1 >= 4 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const from = query.from ?? `${fiscalStartYear}-04-01`
  const to = query.to ?? `${fiscalStartYear + 1}-03-31`

  return {
    from,
    to,
    label: `FY ${fiscalStartYear}-${String(fiscalStartYear + 1).slice(-2)}`,
  }
}

function normalizeMonthlyRows(rows: MonthlyRow[], from: string, to: string) {
  return rows.map((row) => {
    const sales = toNumber(row.sales)
    const purchases = toNumber(row.purchases)
    const income = toNumber(row.income)
    const expenses = toNumber(row.expenses)
    const fallbackProfit = sales - purchases

    return {
      month: formatMonthLabel(row.month_key),
      monthKey: row.month_key,
      sales,
      purchases,
      receipts: toNumber(row.receipts),
      payments: toNumber(row.payments),
      income: income !== 0 || expenses !== 0 ? income - expenses : fallbackProfit,
      from,
      to,
    }
  })
}

function toRecentDocument(row: RecentDocumentRow) {
  return {
    id: row.id,
    date: row.date,
    documentNumber: row.document_number,
    party: row.party_name,
    total: toNumber(row.total_amount),
    paid: toNumber(row.paid_amount),
    due: toNumber(row.due_amount),
    status: row.status,
  }
}

function toLowStockItem(row: LowStockRow) {
  return {
    itemId: row.item_id,
    name: row.name,
    sku: row.sku,
    hsnCode: row.hsn_code ?? "",
    quantityOnHand: row.quantity_on_hand ?? "0.000",
    reorderLevel: row.reorder_level ?? "0.000",
    inventoryValue: money(toNumber(row.inventory_value)),
  }
}

function getFilingNextAction(row: GstReadinessRow | undefined) {
  if (!row?.id) {
    return "Generate GST report for the filing period."
  }

  if (row.blocking_exceptions > 0) {
    return "Resolve blocking GST exceptions before filing."
  }

  if (row.open_exceptions > 0) {
    return "Review GST warnings before marking ready."
  }

  if (row.status === "READY_FOR_SUBMISSION") {
    return "Ready for filing review and submission."
  }

  if (row.status === "FILED" || row.status === "LOCKED") {
    return "Filing records are locked for this period."
  }

  return "Review report and mark ready when checks pass."
}

function formatMonthLabel(monthKey: string) {
  const [year = 1970, month = 1] = monthKey.split("-").map(Number)
  const date = new Date(Date.UTC(year, (month || 1) - 1, 1))
  return new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date)
}

function money(value: number) {
  return Number(value.toFixed(2))
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}
