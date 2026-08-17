import { randomUUID } from "node:crypto"
import test from "node:test"
import assert from "node:assert/strict"

const shouldRun = process.env.RUN_POSTGRES_CONCURRENCY_TEST === "true"

test(
  "real Postgres allocation guard prevents concurrent receipt over-allocation",
  { skip: shouldRun ? false : "Set RUN_POSTGRES_CONCURRENCY_TEST=true to run." },
  async () => {
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for the real Postgres concurrency test.")
    }

    const postgres = (await import("postgres")).default
    const sql = postgres(databaseUrl, { max: 25, idle_timeout: 2 })
    const userId = randomUUID()
    const businessId = randomUUID()
    const financialYearId = randomUUID()
    const bankAccountId = randomUUID()
    const partyId = randomUUID()
    const documentVoucherId = randomUUID()
    const receiptVoucherId = randomUUID()
    const receivableEntryId = randomUUID()
    const receiptId = randomUUID()
    const runId = randomUUID().slice(0, 8)

    try {
      await sql.begin(async (tx) => {
        await tx`
          insert into public.users (id, email, full_name, status)
          values (${userId}, ${`concurrency-${runId}@gstfy.test`}, 'Concurrency Test', 'active')
        `
        await tx`
          insert into public.businesses
            (id, tenant_slug, legal_name, trade_name, pan, constitution, status, created_by)
          values
            (${businessId}, ${`concurrency-${runId}`}, 'Concurrency Test Private Limited',
             'Concurrency Test', ${`CNCRT${runId.slice(0, 4).toUpperCase()}A`}, 'private_limited',
             'active', ${userId})
        `
        await tx`
          insert into public.financial_years
            (id, business_id, name, start_date, end_date, status, is_current)
          values
            (${financialYearId}, ${businessId}, 'FY 2026-27', '2026-04-01',
             '2027-03-31', 'active', true)
        `
        await tx`
          insert into public.ledger_accounts
            (id, business_id, account_code, account_name, account_type, account_group,
             normal_balance, allow_posting, status)
          values
            (${bankAccountId}, ${businessId}, '1010', 'Concurrency Bank',
             'ASSET', 'BANK', 'DEBIT', true, 'active')
        `
        await tx`
          insert into public.parties
            (id, business_id, party_type, display_name, legal_name, status, created_by)
          values
            (${partyId}, ${businessId}, 'business', 'Concurrency Customer',
             'Concurrency Customer', 'active', ${userId})
        `
        await tx`
          insert into public.vouchers
            (id, business_id, voucher_type, voucher_number, voucher_date, financial_year_id,
             status, created_by, posted_by, posted_at)
          values
            (${documentVoucherId}, ${businessId}, 'SALES', ${`INV-CON-${runId}`},
             '2026-08-17', ${financialYearId}, 'posted', ${userId}, ${userId}, now()),
            (${receiptVoucherId}, ${businessId}, 'RECEIPT', ${`RCP-CON-${runId}`},
             '2026-08-17', ${financialYearId}, 'posted', ${userId}, ${userId}, now())
        `
        await tx`
          insert into public.receivable_payable_entries
            (id, business_id, voucher_id, party_id, party_name_snapshot, entry_type,
             original_amount, settled_amount, outstanding_amount, status)
          values
            (${receivableEntryId}, ${businessId}, ${documentVoucherId}, ${partyId},
             'Concurrency Customer', 'receivable', 500.00, 0.00, 500.00, 'open')
        `
        await tx`
          insert into public.receipts
            (id, business_id, voucher_id, party_id, cash_bank_account_id, receipt_number,
             receipt_date, payment_method, amount, allocated_amount, unallocated_amount,
             unallocated_treatment, status, party_name_snapshot, created_by, posted_by, posted_at)
          values
            (${receiptId}, ${businessId}, ${receiptVoucherId}, ${partyId}, ${bankAccountId},
             ${`RCP-CON-${runId}`}, '2026-08-17', 'bank', 500.00, 0.00, 500.00,
             'unallocated', 'posted', 'Concurrency Customer', ${userId}, ${userId}, now())
        `
      })

      const attempts = Array.from({ length: 20 }, () =>
        sql`
          insert into public.payment_allocations
            (business_id, payment_voucher_id, allocation_kind, receipt_id,
             document_voucher_id, receivable_payable_entry_id, allocated_amount,
             status, created_by)
          values
            (${businessId}, ${receiptVoucherId}, 'receipt', ${receiptId},
             ${documentVoucherId}, ${receivableEntryId}, 100.00, 'active', ${userId})
        `
      )
      const results = await Promise.allSettled(attempts)
      const successCount = results.filter((result) => result.status === "fulfilled").length
      const [allocationTotal] = await sql<Array<{ total: string; count: number }>>`
        select coalesce(sum(allocated_amount), 0)::text as total, count(*)::int as count
        from public.payment_allocations
        where business_id = ${businessId}
          and receipt_id = ${receiptId}
          and status = 'active'
      `

      assert.ok(successCount <= 5)
      assert.equal(Number(allocationTotal?.total ?? "0"), 500)
      assert.equal(allocationTotal?.count ?? 0, 5)
    } finally {
      await sql`delete from public.businesses where id = ${businessId}`
      await sql`delete from public.users where id = ${userId}`
      await sql.end({ timeout: 5 })
    }
  }
)
