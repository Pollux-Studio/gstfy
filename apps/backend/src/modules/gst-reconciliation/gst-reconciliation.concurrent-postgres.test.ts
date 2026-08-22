import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"

const shouldRun = process.env.RUN_POSTGRES_CONCURRENCY_TEST === "true"

type SqlTag = {
  <T extends readonly unknown[] = readonly Record<string, unknown>[]>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>
  begin<T>(callback: (tx: SqlTag) => Promise<T>): Promise<T>
  end(options?: { timeout?: number }): Promise<void>
}

test(
  "real Postgres ITC lock caps concurrent eligibility decisions",
  { skip: shouldRun ? false : "Set RUN_POSTGRES_CONCURRENCY_TEST=true to run." },
  async () => {
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for the real Postgres concurrency test.")
    }

    const postgres = (await import("postgres")).default
    const sql = postgres(databaseUrl, { max: 10, idle_timeout: 2 }) as unknown as SqlTag
    const context = createItcTestContext()

    try {
      await seedItcContext(sql, context)

      const results = await Promise.allSettled([
        markEligibleWithLock(sql, context, "7000.00"),
        markEligibleWithLock(sql, context, "6000.00"),
      ])
      const successCount = results.filter((result) => result.status === "fulfilled").length
      const [record] = await sql<Array<{ eligible_igst: string; igst: string }>>`
        select eligible_igst::text, igst::text
        from public.purchase_tax_records
        where id = ${context.purchaseTaxRecordId}
      `

      assert.equal(successCount, 1)
      assert.ok(Number(record?.eligible_igst ?? "0") <= Number(record?.igst ?? "0"))
    } finally {
      await cleanupItcContext(sql, context)
    }
  }
)

test(
  "real Postgres ITC lock allows only one concurrent claim/defer decision",
  { skip: shouldRun ? false : "Set RUN_POSTGRES_CONCURRENCY_TEST=true to run." },
  async () => {
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for the real Postgres concurrency test.")
    }

    const postgres = (await import("postgres")).default
    const sql = postgres(databaseUrl, { max: 10, idle_timeout: 2 }) as unknown as SqlTag
    const context = createItcTestContext()

    try {
      await seedItcContext(sql, context)
      await markEligibleWithLock(sql, context, "10000.00")

      const results = await Promise.allSettled([
        claimWithLock(sql, context),
        deferWithLock(sql, context),
      ])
      const successCount = results.filter((result) => result.status === "fulfilled").length
      const [record] = await sql<Array<{ itc_status: string }>>`
        select itc_status
        from public.purchase_tax_records
        where id = ${context.purchaseTaxRecordId}
      `
      const [claimCount] = await sql<Array<{ count: number }>>`
        select count(*)::int
        from public.itc_claims
        where business_id = ${context.businessId}
          and purchase_tax_record_id = ${context.purchaseTaxRecordId}
          and status = 'active'
      `

      assert.equal(successCount, 1)
      assert.ok(record?.itc_status === "CLAIMED" || record?.itc_status === "DEFERRED")
      assert.equal(claimCount?.count, record?.itc_status === "CLAIMED" ? 1 : 0)
    } finally {
      await cleanupItcContext(sql, context)
    }
  }
)

function createItcTestContext() {
  const runId = randomUUID().slice(0, 8)

  return {
    runId,
    userId: randomUUID(),
    businessId: randomUUID(),
    financialYearId: randomUUID(),
    gstRegistrationId: randomUUID(),
    partyId: randomUUID(),
    voucherId: randomUUID(),
    purchaseBillId: randomUUID(),
    purchaseTaxRecordId: randomUUID(),
  }
}

async function seedItcContext(
  sql: SqlTag,
  context: ReturnType<typeof createItcTestContext>
) {
  await sql.begin(async (tx) => {
    await tx`
      insert into public.users (id, email, full_name, status)
      values (${context.userId}, ${`itc-concurrency-${context.runId}@gstfy.test`},
              'ITC Concurrency', 'active')
    `
    await tx`
      insert into public.businesses
        (id, tenant_slug, legal_name, trade_name, pan, constitution, status, created_by)
      values
        (${context.businessId}, ${`itc-concurrency-${context.runId}`},
         'ITC Concurrency Private Limited', 'ITC Concurrency',
         ${`ITCCN${context.runId.slice(0, 4).toUpperCase()}A`}, 'private_limited',
         'active', ${context.userId})
    `
    await tx`
      insert into public.financial_years
        (id, business_id, name, start_date, end_date, status, is_current)
      values
        (${context.financialYearId}, ${context.businessId}, 'FY 2026-27',
         '2026-04-01', '2027-03-31', 'active', true)
    `
    await tx`
      insert into public.gst_registrations
        (id, business_id, gstin, legal_name, trade_name, state_code, status)
      values
        (${context.gstRegistrationId}, ${context.businessId}, '33ABCDE1234F1Z5',
         'ITC Concurrency Private Limited', 'ITC Concurrency', '33', 'active')
    `
    await tx`
      insert into public.parties
        (id, business_id, party_type, display_name, legal_name, status, created_by)
      values
        (${context.partyId}, ${context.businessId}, 'business', 'Concurrent Supplier',
         'Concurrent Supplier', 'active', ${context.userId})
    `
    await tx`
      insert into public.vouchers
        (id, business_id, gst_registration_id, voucher_type, voucher_number,
         voucher_date, financial_year_id, status, created_by, posted_by, posted_at)
      values
        (${context.voucherId}, ${context.businessId}, ${context.gstRegistrationId},
         'PURCHASE', ${`ITC-VCH-${context.runId}`}, '2026-08-17',
         ${context.financialYearId}, 'posted', ${context.userId}, ${context.userId}, now())
    `
    await tx`
      insert into public.purchase_bills
        (id, business_id, voucher_id, gst_registration_id, supplier_id, supplier_name,
         bill_number, supplier_invoice_number, invoice_date, bill_date, status,
         taxable_value, igst_amount, total_amount, amount_due, itc_eligible_amount,
         created_by, posted_by, posted_at)
      values
        (${context.purchaseBillId}, ${context.businessId}, ${context.voucherId},
         ${context.gstRegistrationId}, ${context.partyId}, 'Concurrent Supplier',
         ${`ITC-BILL-${context.runId}`}, ${`SUP-ITC-${context.runId}`},
         '2026-08-17', '2026-08-17', 'posted', 100000.00, 10000.00,
         110000.00, 110000.00, 10000.00, ${context.userId}, ${context.userId}, now())
    `
    await tx`
      insert into public.purchase_tax_records
        (id, business_id, source_type, purchase_bill_id, voucher_id,
         gst_registration_id, supplier_id, supplier_name, supplier_gstin,
         invoice_number, normalized_invoice_number, invoice_date, taxable_value,
         igst, total_tax, tax_period, reconciliation_status, itc_status, input_type)
      values
        (${context.purchaseTaxRecordId}, ${context.businessId}, 'purchase_bill',
         ${context.purchaseBillId}, ${context.voucherId}, ${context.gstRegistrationId},
         ${context.partyId}, 'Concurrent Supplier', '33ABCDE1234F1Z5',
         ${`SUP-ITC-${context.runId}`}, ${`SUPITC${context.runId.toUpperCase()}`},
         '2026-08-17', 100000.00, 10000.00, 10000.00, '2026-08',
         'MATCHED', 'NOT_REVIEWED', 'regular')
    `
  })
}

async function markEligibleWithLock(
  sql: SqlTag,
  context: ReturnType<typeof createItcTestContext>,
  amount: string
) {
  await sql.begin(async (tx) => {
    const [record] = await tx<Array<{ itc_status: string; igst: string }>>`
      select itc_status, igst::text
      from public.purchase_tax_records
      where id = ${context.purchaseTaxRecordId}
      for update
    `

    if (record?.itc_status !== "NOT_REVIEWED") {
      throw new Error("ITC record was already reviewed.")
    }

    if (Number(amount) > Number(record.igst)) {
      throw new Error("ITC amount exceeds source tax.")
    }

    await tx`
      update public.purchase_tax_records
      set itc_status = 'PARTIALLY_ELIGIBLE',
          eligible_igst = ${amount},
          ineligible_igst = igst - ${amount}::numeric
      where id = ${context.purchaseTaxRecordId}
        and itc_status = ${record.itc_status}
    `
  })
}

async function claimWithLock(
  sql: SqlTag,
  context: ReturnType<typeof createItcTestContext>
) {
  await sql.begin(async (tx) => {
    const [record] = await tx<Array<{ itc_status: string; eligible_igst: string }>>`
      select itc_status, eligible_igst::text
      from public.purchase_tax_records
      where id = ${context.purchaseTaxRecordId}
      for update
    `

    if (!record || !["ELIGIBLE", "PARTIALLY_ELIGIBLE"].includes(record.itc_status)) {
      throw new Error("Only eligible ITC can be claimed.")
    }

    await tx`
      update public.purchase_tax_records
      set itc_status = 'CLAIMED'
      where id = ${context.purchaseTaxRecordId}
        and itc_status = ${record.itc_status}
    `
    await tx`
      insert into public.itc_claims
        (business_id, purchase_tax_record_id, claim_period, claimed_igst,
         source_tax_record, claimed_by)
      values
        (${context.businessId}, ${context.purchaseTaxRecordId}, '2026-08',
         ${record.eligible_igst}, '{}'::jsonb, ${context.userId})
    `
  })
}

async function deferWithLock(
  sql: SqlTag,
  context: ReturnType<typeof createItcTestContext>
) {
  await sql.begin(async (tx) => {
    const [record] = await tx<Array<{ itc_status: string }>>`
      select itc_status
      from public.purchase_tax_records
      where id = ${context.purchaseTaxRecordId}
      for update
    `

    if (record?.itc_status !== "PARTIALLY_ELIGIBLE") {
      throw new Error("Only reviewed ITC can be deferred in this test.")
    }

    await tx`
      update public.purchase_tax_records
      set itc_status = 'DEFERRED'
      where id = ${context.purchaseTaxRecordId}
        and itc_status = ${record.itc_status}
    `
  })
}

async function cleanupItcContext(
  sql: SqlTag,
  context: ReturnType<typeof createItcTestContext>
) {
  await sql.begin(async (tx) => {
    await tx`delete from public.businesses where id = ${context.businessId}`
    await tx`delete from public.users where id = ${context.userId}`
  })
}
