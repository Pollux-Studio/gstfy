import { and, desc, eq, ilike, or, sql as drizzleSql, type SQL } from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { db } from "../../db/client.js"
import {
  salesInvoiceLines,
  salesInvoicePayments,
  salesInvoices,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"
import {
  calculateTransactionLines,
  createDraftDocumentNumber,
  getPartySnapshot,
  resolveTransactionContext,
  sumPayments,
  postSalesVoucher,
  type PartySnapshot,
  type CalculatedTransaction,
  type PaymentInput,
} from "../accounting/accounting-domain.service.js"
import { formatCents, normalizeMoney, toCents } from "../core/core.validation.js"
import {
  createSalesInvoiceSchema,
  invoiceIdParamsSchema,
  listSalesInvoicesQuerySchema,
  type CreateSalesInvoiceInput,
} from "./sales.schemas.js"

type BusinessAccess = Awaited<ReturnType<typeof requirePrimaryBusinessAccess>>

export async function registerSalesRoutes(app: FastifyInstance) {
  app.get("/sales/invoices", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const query = listSalesInvoicesQuerySchema.parse(request.query)
    const conditions: SQL[] = [eq(salesInvoices.businessId, access.business.id)]

    if (query.status) {
      conditions.push(eq(salesInvoices.status, query.status))
    }

    if (query.search) {
      const term = `%${escapeLikeTerm(query.search)}%`
      const searchCondition = or(
        ilike(salesInvoices.invoiceNumber, term),
        ilike(salesInvoices.customerName, term)
      )

      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }

    const offset = (query.page - 1) * query.limit
    const [countRow] = await db
      .select({ total: drizzleSql<number>`count(*)::int` })
      .from(salesInvoices)
      .where(and(...conditions))
    const total = countRow?.total ?? 0
    const invoices = await db
      .select()
      .from(salesInvoices)
      .where(and(...conditions))
      .orderBy(desc(salesInvoices.createdAt))
      .limit(query.limit)
      .offset(offset)

    return {
      invoices,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        hasMore: query.page * query.limit < total,
      },
    }
  })

  app.get("/sales/invoices/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const { id } = invoiceIdParamsSchema.parse(request.params)

    return {
      invoice: await getSalesInvoiceDetail(access.business.id, id),
    }
  })

  app.post("/sales/invoices", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const body = createSalesInvoiceSchema.parse(request.body)

    return {
      invoice: await createSalesInvoice(access, body),
    }
  })

  app.post("/sales/invoices/:id/post", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const { id } = invoiceIdParamsSchema.parse(request.params)
    const detail = await getSalesInvoiceDetail(access.business.id, id)

    if (detail.status !== "draft") {
      throw new HttpError(409, "Only draft invoices can be posted.")
    }

    const body: CreateSalesInvoiceInput = {
      status: "posted",
      partyId: detail.partyId,
      customerName: detail.customerName,
      invoiceDate: detail.invoiceDate,
      dueDate: detail.dueDate,
      gstRegistrationId: detail.gstRegistrationId,
      branchId: detail.branchId,
      warehouseId: detail.warehouseId,
      placeOfSupplyStateCode: detail.placeOfSupplyStateCode,
      supplyType: detail.supplyType as "b2b" | "b2c",
      invoiceType: detail.invoiceType as "tax_invoice" | "bill_of_supply",
      notes: detail.notes,
      lines: detail.lines.map((line) => ({
        itemId: line.itemId,
        itemName: line.itemNameSnapshot,
        hsnSacCode: line.hsnSacCode,
        quantity: line.quantity,
        unit: line.unit,
        rate: line.rate,
        gstRate: line.gstRate,
        taxability: line.taxability as CreateSalesInvoiceInput["lines"][number]["taxability"],
        cessRuleId: line.cessRuleId,
        pricingMode: "tax_exclusive",
        discountAmount: line.discountAmount,
        otherCharges: [],
      })),
      payments: detail.payments.map((payment) => ({
        paymentMode: payment.paymentMode as PaymentInput["paymentMode"],
        amount: payment.amount,
        referenceNumber: payment.referenceNumber,
      })),
    }
    const posted = await postSalesInvoice(access, body, {
      allowArchivedParty: true,
      partySnapshot: coercePartySnapshot(detail.partySnapshot),
    })

    await db.transaction(async (tx) => {
      await tx
        .update(salesInvoices)
        .set({
          voucherId: posted.voucherId,
          invoiceNumber: posted.invoiceNumber,
          status: "posted",
          postedBy: access.userId,
          postedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(salesInvoices.businessId, access.business.id), eq(salesInvoices.id, id)))
    })

    return {
      invoice: await getSalesInvoiceDetail(access.business.id, id),
    }
  })
}

async function createSalesInvoice(access: BusinessAccess, body: CreateSalesInvoiceInput) {
  const posted = body.status === "posted" ? await postSalesInvoice(access, body) : null
  const context =
    posted?.context ??
    await resolveTransactionContext(access, {
      transactionDate: body.invoiceDate,
      gstRegistrationId: body.gstRegistrationId,
      branchId: body.branchId,
      warehouseId: body.warehouseId,
      placeOfSupplyStateCode: body.placeOfSupplyStateCode,
    })
  const calculated =
    posted?.calculated ??
    await calculateTransactionLines(access.business.id, body.lines, context, "sales", {
      supplyType: body.supplyType,
    })
  const party = posted?.party ?? (await getPartySnapshot(access.business.id, body.partyId))
  const customerName = resolveCounterpartyName(body.customerName, party?.displayName, "Walk-in customer")
  const amountPaid = formatCents(Math.min(sumPayments(body.payments), toCents(calculated.totals.totalAmount)))
  const amountDue = formatCents(toCents(calculated.totals.totalAmount) - toCents(amountPaid))

  const [invoice] = await db
    .insert(salesInvoices)
    .values({
      businessId: access.business.id,
      voucherId: posted?.voucherId ?? null,
      gstRegistrationId: context.gstRegistration.id,
      branchId: context.branch?.id ?? null,
      warehouseId: context.warehouseId,
      partyId: body.partyId ?? null,
      partySnapshot: party ?? null,
      customerName,
      invoiceNumber: posted?.invoiceNumber ?? createDraftDocumentNumber("INV"),
      invoiceDate: body.invoiceDate,
      dueDate: body.dueDate,
      placeOfSupplyStateCode: context.placeOfSupplyStateCode,
      supplyType: body.supplyType,
      invoiceType: body.invoiceType,
      status: body.status,
      taxableValue: calculated.totals.taxableValue,
      cgstAmount: calculated.totals.cgstAmount,
      sgstAmount: calculated.totals.sgstAmount,
      igstAmount: calculated.totals.igstAmount,
      cessAmount: calculated.totals.cessAmount,
      totalAmount: calculated.totals.totalAmount,
      amountPaid,
      amountDue,
      notes: body.notes,
      createdBy: access.userId,
      postedBy: posted ? access.userId : null,
      postedAt: posted ? new Date() : null,
    })
    .returning()

  if (!invoice) {
    throw new HttpError(500, "Unable to create sales invoice.")
  }

  await insertSalesChildren(invoice.id, access.business.id, calculated, body.payments)

  return getSalesInvoiceDetail(access.business.id, invoice.id)
}

async function postSalesInvoice(
  access: BusinessAccess,
  body: CreateSalesInvoiceInput,
  options: { allowArchivedParty?: boolean; partySnapshot?: PartySnapshot | null } = {}
) {
  const context = await resolveTransactionContext(access, {
    transactionDate: body.invoiceDate,
    gstRegistrationId: body.gstRegistrationId,
    branchId: body.branchId,
    warehouseId: body.warehouseId,
    placeOfSupplyStateCode: body.placeOfSupplyStateCode,
  })
  const calculated = await calculateTransactionLines(
    access.business.id,
    body.lines,
    context,
    "sales",
    {
      supplyType: body.supplyType,
    }
  )
  const totalCents = toCents(calculated.totals.totalAmount)
  const paidCents = sumPayments(body.payments)

  if (paidCents > totalCents) {
    throw new HttpError(400, "Sales payments cannot exceed invoice total.")
  }

  const party =
    options.partySnapshot ??
    (await getPartySnapshot(access.business.id, body.partyId, {
      allowArchived: options.allowArchivedParty,
    }))
  const customerName = resolveCounterpartyName(body.customerName, party?.displayName, "Walk-in customer")
  const result = await postSalesVoucher({
    access,
    voucherType: "SALES",
    documentType: "invoice",
    transactionDate: body.invoiceDate,
    context,
    calculated,
    party,
    counterpartyName: customerName,
    payments: body.payments,
    notes: body.notes,
  })

  return {
    voucherId: result.voucher.id,
    invoiceNumber: result.voucher.voucherNumber,
    context,
    calculated,
    party,
  }
}

async function insertSalesChildren(
  invoiceId: string,
  businessId: string,
  calculated: CalculatedTransaction,
  payments: PaymentInput[]
) {
  await db.insert(salesInvoiceLines).values(
    calculated.lines.map((line, index) => ({
      businessId,
      salesInvoiceId: invoiceId,
      itemId: line.itemId,
      itemNameSnapshot: line.itemName,
      hsnSacCode: line.hsnSacCode ?? null,
      quantity: line.quantity,
      unit: line.unit,
      rate: normalizeMoney(line.rate),
      taxableValue: line.taxableValue,
      gstRate: normalizeMoney(line.gstRate),
      taxability: line.taxability,
      classification: line.classification,
      supplyLocationTreatment: line.supplyLocationTreatment,
      grossValue: line.grossValue,
      discountAmount: line.discountAmount,
      taxableCharges: line.taxableCharges,
      nonTaxableCharges: line.nonTaxableCharges,
      cgstRate: line.cgstRate,
      cgstAmount: line.cgstAmount,
      sgstRate: line.sgstRate,
      sgstAmount: line.sgstAmount,
      igstRate: line.igstRate,
      igstAmount: line.igstAmount,
      cessRuleId: line.cessRuleId,
      cessAmount: line.cessAmount,
      taxRuleId: line.taxRuleId,
      taxRuleVersion: line.taxRuleVersion,
      reverseCharge: line.reverseCharge,
      roundOff: line.roundOff,
      lineTotal: line.lineTotal,
      sortOrder: index,
    }))
  )

  if (payments.length === 0) {
    return
  }

  await db.insert(salesInvoicePayments).values(
    payments.map((payment) => ({
      businessId,
      salesInvoiceId: invoiceId,
      paymentMode: payment.paymentMode,
      amount: normalizeMoney(payment.amount),
      referenceNumber: payment.referenceNumber ?? null,
    }))
  )
}

async function getSalesInvoiceDetail(businessId: string, invoiceId: string) {
  const invoice = await db.query.salesInvoices.findFirst({
    where: and(eq(salesInvoices.businessId, businessId), eq(salesInvoices.id, invoiceId)),
  })

  if (!invoice) {
    throw new HttpError(404, "Sales invoice not found.")
  }

  const [lines, payments] = await Promise.all([
    db
      .select()
      .from(salesInvoiceLines)
      .where(eq(salesInvoiceLines.salesInvoiceId, invoiceId))
      .orderBy(salesInvoiceLines.sortOrder),
    db
      .select()
      .from(salesInvoicePayments)
      .where(eq(salesInvoicePayments.salesInvoiceId, invoiceId)),
  ])

  return {
    ...invoice,
    lines,
    payments,
  }
}

function resolveCounterpartyName(
  requestedName: string | null | undefined,
  partyName: string | null | undefined,
  fallback: string
) {
  return requestedName?.trim() || partyName?.trim() || fallback
}

function coercePartySnapshot(value: unknown): PartySnapshot | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const snapshot = value as Record<string, unknown>

  if (typeof snapshot.id !== "string" || typeof snapshot.displayName !== "string") {
    return null
  }

  return {
    id: snapshot.id,
    displayName: snapshot.displayName,
    legalName: typeof snapshot.legalName === "string" ? snapshot.legalName : null,
    tradeName: typeof snapshot.tradeName === "string" ? snapshot.tradeName : null,
    gstin: typeof snapshot.gstin === "string" ? snapshot.gstin : null,
    stateCode: typeof snapshot.stateCode === "string" ? snapshot.stateCode : null,
  }
}

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}
