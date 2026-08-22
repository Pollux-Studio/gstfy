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
  "real Postgres source-line lock prevents concurrent sales over-return",
  { skip: shouldRun ? false : "Set RUN_POSTGRES_CONCURRENCY_TEST=true to run." },
  async () => {
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for the real Postgres concurrency test.")
    }

    const postgres = (await import("postgres")).default
    const sql = postgres(databaseUrl, { max: 25, idle_timeout: 2 }) as unknown as SqlTag
    const context = createTestContext()
    const invoiceId = randomUUID()
    const invoiceLineId = randomUUID()
    const returnAId = randomUUID()
    const returnBId = randomUUID()

    try {
      await seedCommonContext(sql, context)
      await sql.begin(async (tx) => {
        await tx`
          insert into public.sales_invoices
            (id, business_id, voucher_id, party_id, customer_name, invoice_number,
             invoice_date, status, taxable_value, total_amount, amount_due, created_by,
             posted_by, posted_at)
          values
            (${invoiceId}, ${context.businessId}, ${context.sourceVoucherId},
             ${context.partyId}, 'Concurrent Customer', ${`INV-RET-${context.runId}`},
             '2026-08-17', 'posted', 1000.00, 1000.00, 1000.00,
             ${context.userId}, ${context.userId}, now())
        `
        await tx`
          insert into public.sales_invoice_lines
            (id, business_id, sales_invoice_id, item_name_snapshot, hsn_sac_code,
             quantity, unit, rate, taxable_value, gst_rate, line_total)
          values
            (${invoiceLineId}, ${context.businessId}, ${invoiceId}, 'Return Item',
             '210690', 10.000, 'PCS', 100.00, 1000.00, 18.00, 1180.00)
        `
        await seedAdjustmentDraft(tx, {
          ...context,
          adjustmentId: returnAId,
          adjustmentNumber: `SR-A-${context.runId}`,
          adjustmentType: "SALES_RETURN",
          sourceDocumentId: invoiceId,
          sourceDocumentType: "sales_invoice",
          sourcePartyRole: "customer",
          issuerType: "GSTFY_BUSINESS",
          documentDirection: "outgoing",
          lineId: randomUUID(),
          originalLineId: invoiceLineId,
          originalLineType: "sales_invoice_line",
          quantity: "7.000",
          taxableValue: "700.00",
          grandTotal: "826.00",
        })
        await seedAdjustmentDraft(tx, {
          ...context,
          adjustmentId: returnBId,
          adjustmentNumber: `SR-B-${context.runId}`,
          adjustmentType: "SALES_RETURN",
          sourceDocumentId: invoiceId,
          sourceDocumentType: "sales_invoice",
          sourcePartyRole: "customer",
          issuerType: "GSTFY_BUSINESS",
          documentDirection: "outgoing",
          lineId: randomUUID(),
          originalLineId: invoiceLineId,
          originalLineType: "sales_invoice_line",
          quantity: "5.000",
          taxableValue: "500.00",
          grandTotal: "590.00",
        })
      })

      const results = await Promise.allSettled([
        postReturnWithSourceLineLock(sql, context.businessId, invoiceId, returnAId),
        postReturnWithSourceLineLock(sql, context.businessId, invoiceId, returnBId),
      ])
      const successCount = results.filter((result) => result.status === "fulfilled").length
      const [returned] = await sql<Array<{ total: string }>>`
        select coalesce(sum(line.quantity), 0)::text as total
        from public.adjustment_document_lines line
        join public.adjustment_documents doc
          on doc.id = line.adjustment_document_id
        where line.business_id = ${context.businessId}
          and line.original_line_id = ${invoiceLineId}
          and doc.status = 'posted'
      `

      assert.equal(successCount, 1)
      assert.ok(Number(returned?.total ?? "0") <= 10)
    } finally {
      await cleanupContext(sql, context)
    }
  }
)

test(
  "real Postgres AR/AP lock caps concurrent credit-note adjustment effects",
  { skip: shouldRun ? false : "Set RUN_POSTGRES_CONCURRENCY_TEST=true to run." },
  async () => {
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for the real Postgres concurrency test.")
    }

    const postgres = (await import("postgres")).default
    const sql = postgres(databaseUrl, { max: 25, idle_timeout: 2 }) as unknown as SqlTag
    const context = createTestContext()
    const entryId = randomUUID()
    const creditAId = randomUUID()
    const creditBId = randomUUID()

    try {
      await seedCommonContext(sql, context)
      await sql.begin(async (tx) => {
        await tx`
          insert into public.receivable_payable_entries
            (id, business_id, voucher_id, party_id, party_name_snapshot, entry_type,
             original_amount, adjustment_amount, effective_amount, settled_amount,
             outstanding_amount, excess_settled_amount, status)
          values
            (${entryId}, ${context.businessId}, ${context.sourceVoucherId},
             ${context.partyId}, 'Concurrent Customer', 'receivable', 10000.00,
             0.00, 10000.00, 0.00, 10000.00, 0.00, 'open')
        `
        await seedAdjustmentHeader(tx, {
          ...context,
          adjustmentId: creditAId,
          adjustmentNumber: `CN-A-${context.runId}`,
          adjustmentType: "CREDIT_NOTE",
          sourceDocumentType: "sales_invoice",
          sourcePartyRole: "customer",
          issuerType: "GSTFY_BUSINESS",
          documentDirection: "outgoing",
          grandTotal: "7000.00",
        })
        await seedAdjustmentHeader(tx, {
          ...context,
          adjustmentId: creditBId,
          adjustmentNumber: `CN-B-${context.runId}`,
          adjustmentType: "CREDIT_NOTE",
          sourceDocumentType: "sales_invoice",
          sourcePartyRole: "customer",
          issuerType: "GSTFY_BUSINESS",
          documentDirection: "outgoing",
          grandTotal: "5000.00",
        })
      })

      await Promise.all([
        applyCreditWithEntryLock(sql, context, creditAId, entryId, "7000.00"),
        applyCreditWithEntryLock(sql, context, creditBId, entryId, "5000.00"),
      ])
      const [effectTotal] = await sql<Array<{ total: string; count: number }>>`
        select coalesce(sum(amount), 0)::text as total, count(*)::int as count
        from public.receivable_payable_adjustment_effects
        where business_id = ${context.businessId}
          and receivable_payable_entry_id = ${entryId}
          and status = 'active'
      `

      assert.equal(Number(effectTotal?.total ?? "0"), 10000)
      assert.equal(effectTotal?.count ?? 0, 2)
    } finally {
      await cleanupContext(sql, context)
    }
  }
)

function createTestContext() {
  const runId = randomUUID().slice(0, 8)

  return {
    runId,
    userId: randomUUID(),
    businessId: randomUUID(),
    financialYearId: randomUUID(),
    partyId: randomUUID(),
    sourceVoucherId: randomUUID(),
  }
}

async function seedCommonContext(
  sql: SqlTag,
  context: ReturnType<typeof createTestContext>
) {
  await sql.begin(async (tx) => {
    await tx`
      insert into public.users (id, email, full_name, status)
      values (${context.userId}, ${`adjustment-concurrency-${context.runId}@gstfy.test`},
              'Adjustment Concurrency', 'active')
    `
    await tx`
      insert into public.businesses
        (id, tenant_slug, legal_name, trade_name, pan, constitution, status, created_by)
      values
        (${context.businessId}, ${`adj-concurrency-${context.runId}`},
         'Adjustment Concurrency Private Limited', 'Adjustment Concurrency',
         ${`ADJCN${context.runId.slice(0, 4).toUpperCase()}A`}, 'private_limited',
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
      insert into public.parties
        (id, business_id, party_type, display_name, legal_name, status, created_by)
      values
        (${context.partyId}, ${context.businessId}, 'business', 'Concurrent Customer',
         'Concurrent Customer', 'active', ${context.userId})
    `
    await tx`
      insert into public.vouchers
        (id, business_id, voucher_type, voucher_number, voucher_date,
         financial_year_id, status, created_by, posted_by, posted_at)
      values
        (${context.sourceVoucherId}, ${context.businessId}, 'SALES',
         ${`SRC-ADJ-${context.runId}`}, '2026-08-17', ${context.financialYearId},
         'posted', ${context.userId}, ${context.userId}, now())
    `
  })
}

async function seedAdjustmentHeader(
  tx: SqlTag,
  input: ReturnType<typeof createTestContext> & {
    adjustmentId: string
    adjustmentNumber: string
    adjustmentType: string
    sourceDocumentId?: string
    sourceDocumentType: string
    sourcePartyRole: string
    issuerType: string
    documentDirection: string
    grandTotal: string
  }
) {
  await tx`
    insert into public.adjustment_documents
      (id, business_id, adjustment_number, adjustment_type, original_voucher_id,
       source_document_id, source_document_type, party_id, adjustment_date, status,
       issuer_type, document_direction, source_party_role, adjustment_context,
       taxable_total, grand_total, created_by)
    values
      (${input.adjustmentId}, ${input.businessId}, ${input.adjustmentNumber},
       ${input.adjustmentType}, ${input.sourceVoucherId},
       ${input.sourceDocumentId ?? randomUUID()},
       ${input.sourceDocumentType}, ${input.partyId}, '2026-08-17', 'draft',
       ${input.issuerType}, ${input.documentDirection}, ${input.sourcePartyRole},
       'goods_related', ${input.grandTotal}, ${input.grandTotal}, ${input.userId})
  `
}

async function seedAdjustmentDraft(
  tx: SqlTag,
  input: Parameters<typeof seedAdjustmentHeader>[1] & {
    lineId: string
    originalLineId: string
    originalLineType: string
    quantity: string
    taxableValue: string
  }
) {
  await seedAdjustmentHeader(tx, input)
  await tx`
    insert into public.adjustment_document_lines
      (id, business_id, adjustment_document_id, original_line_id, original_line_type,
       description_snapshot, hsn_sac_snapshot, uqc_snapshot, quantity, unit, rate,
       taxable_value, line_total, inventory_effect)
    values
      (${input.lineId}, ${input.businessId}, ${input.adjustmentId},
       ${input.originalLineId}, ${input.originalLineType}, 'Return Item',
       '210690', 'PCS', ${input.quantity}, 'PCS', 100.00, ${input.taxableValue},
       ${input.grandTotal}, 'STOCK_IN')
  `
}

async function postReturnWithSourceLineLock(
  sql: SqlTag,
  businessId: string,
  invoiceId: string,
  adjustmentId: string
) {
  await sql.begin(async (tx) => {
    await tx`
      select id from public.sales_invoice_lines
      where business_id = ${businessId}
        and sales_invoice_id = ${invoiceId}
      for update
    `
    const [line] = await tx<Array<{
      originalLineId: string
      requestedQuantity: string
      originalQuantity: string
    }>>`
      select adj_line.original_line_id::text as "originalLineId",
             adj_line.quantity::text as "requestedQuantity",
             src_line.quantity::text as "originalQuantity"
      from public.adjustment_document_lines adj_line
      join public.sales_invoice_lines src_line
        on src_line.id = adj_line.original_line_id
      where adj_line.business_id = ${businessId}
        and adj_line.adjustment_document_id = ${adjustmentId}
      limit 1
    `

    if (!line) {
      throw new Error("Adjustment line missing.")
    }

    const [returned] = await tx<Array<{ returnedQuantity: string }>>`
      select coalesce(sum(adj_line.quantity), 0)::text as "returnedQuantity"
      from public.adjustment_document_lines adj_line
      join public.adjustment_documents doc
        on doc.id = adj_line.adjustment_document_id
      where adj_line.business_id = ${businessId}
        and adj_line.original_line_id = ${line.originalLineId}
        and doc.status = 'posted'
    `

    if (
      Number(line.requestedQuantity) + Number(returned?.returnedQuantity ?? "0") >
      Number(line.originalQuantity)
    ) {
      throw new Error("Return quantity exceeds the remaining quantity.")
    }

    await tx`
      update public.adjustment_documents
      set status = 'posted', posted_at = now(), updated_at = now()
      where business_id = ${businessId}
        and id = ${adjustmentId}
    `
  })
}

async function applyCreditWithEntryLock(
  sql: SqlTag,
  context: ReturnType<typeof createTestContext>,
  adjustmentId: string,
  entryId: string,
  requestedAmount: string
) {
  await sql.begin(async (tx) => {
    const [entry] = await tx<Array<{ originalAmount: string }>>`
      select original_amount::text as "originalAmount"
      from public.receivable_payable_entries
      where business_id = ${context.businessId}
        and id = ${entryId}
      for update
    `

    if (!entry) {
      throw new Error("Receivable/payable entry missing.")
    }

    const [existing] = await tx<Array<{ adjustedAmount: string }>>`
      select coalesce(sum(amount), 0)::text as "adjustedAmount"
      from public.receivable_payable_adjustment_effects
      where business_id = ${context.businessId}
        and receivable_payable_entry_id = ${entryId}
        and status = 'active'
    `
    const remaining = Math.max(
      Number(entry.originalAmount) - Number(existing?.adjustedAmount ?? "0"),
      0
    )
    const applied = Math.min(Number(requestedAmount), remaining)

    if (applied > 0) {
      await tx`
        insert into public.receivable_payable_adjustment_effects
          (business_id, adjustment_document_id, source_voucher_id,
           receivable_payable_entry_id, effect_kind, amount, status, created_by)
        values
          (${context.businessId}, ${adjustmentId}, ${context.sourceVoucherId},
           ${entryId}, 'receivable_reduction', ${applied.toFixed(2)}, 'active',
           ${context.userId})
      `
    }
  })
}

async function cleanupContext(
  sql: SqlTag,
  context: ReturnType<typeof createTestContext>
) {
  await sql`delete from public.businesses where id = ${context.businessId}`
  await sql`delete from public.users where id = ${context.userId}`
  await sql.end({ timeout: 5 })
}
