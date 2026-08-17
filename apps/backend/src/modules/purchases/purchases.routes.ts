import { and, desc, eq, ilike, or, sql as drizzleSql, type SQL } from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { db } from "../../db/client.js"
import {
  purchaseBillLines,
  purchaseBillPayments,
  purchaseBills,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import {
  calculateTransactionLines,
  createDraftDocumentNumber,
  getPartySnapshot,
  postPurchaseVoucher,
  resolveTransactionContext,
  sumPayments,
  type CalculatedTransaction,
  type PaymentInput,
} from "../accounting/accounting-domain.service.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"
import { formatCents, normalizeMoney, toCents } from "../core/core.validation.js"
import {
  billIdParamsSchema,
  createPurchaseBillSchema,
  listPurchaseBillsQuerySchema,
  type CreatePurchaseBillInput,
} from "./purchases.schemas.js"

type BusinessAccess = Awaited<ReturnType<typeof requirePrimaryBusinessAccess>>

export async function registerPurchasesRoutes(app: FastifyInstance) {
  app.get("/purchase-bills", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const query = listPurchaseBillsQuerySchema.parse(request.query)
    const conditions: SQL[] = [eq(purchaseBills.businessId, access.business.id)]

    if (query.status) {
      conditions.push(eq(purchaseBills.status, query.status))
    }

    if (query.search) {
      const term = `%${escapeLikeTerm(query.search)}%`
      const searchCondition = or(
        ilike(purchaseBills.billNumber, term),
        ilike(purchaseBills.supplierName, term),
        ilike(purchaseBills.supplierInvoiceNumber, term)
      )

      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }

    const offset = (query.page - 1) * query.limit
    const [countRow] = await db
      .select({ total: drizzleSql<number>`count(*)::int` })
      .from(purchaseBills)
      .where(and(...conditions))
    const total = countRow?.total ?? 0
    const bills = await db
      .select()
      .from(purchaseBills)
      .where(and(...conditions))
      .orderBy(desc(purchaseBills.createdAt))
      .limit(query.limit)
      .offset(offset)

    return {
      bills,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        hasMore: query.page * query.limit < total,
      },
    }
  })

  app.get("/purchase-bills/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const { id } = billIdParamsSchema.parse(request.params)

    return {
      bill: await getPurchaseBillDetail(access.business.id, id),
    }
  })

  app.post("/purchase-bills", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const body = createPurchaseBillSchema.parse(request.body)

    return {
      bill: await createPurchaseBill(access, body),
    }
  })

  app.post("/purchase-bills/:id/post", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const { id } = billIdParamsSchema.parse(request.params)
    const detail = await getPurchaseBillDetail(access.business.id, id)

    if (detail.status !== "draft") {
      throw new HttpError(409, "Only draft purchase bills can be posted.")
    }

    const body: CreatePurchaseBillInput = {
      status: "posted",
      supplierId: detail.supplierId,
      supplierName: detail.supplierName,
      supplierInvoiceNumber: detail.supplierInvoiceNumber,
      invoiceDate: detail.invoiceDate,
      billDate: detail.billDate,
      gstRegistrationId: detail.gstRegistrationId,
      branchId: detail.branchId,
      warehouseId: detail.warehouseId,
      placeOfSupplyStateCode: detail.placeOfSupplyStateCode,
      purchaseType: detail.purchaseType as "goods" | "services" | "expense",
      notes: detail.notes,
      lines: detail.lines.map((line) => ({
        itemId: line.itemId,
        itemName: line.itemNameSnapshot,
        hsnSacCode: line.hsnSacCode,
        quantity: line.quantity,
        unit: line.unit,
        rate: line.rate,
        gstRate: line.gstRate,
        taxability: line.taxability as CreatePurchaseBillInput["lines"][number]["taxability"],
        cessRuleId: line.cessRuleId,
        pricingMode: "tax_exclusive",
        discountAmount: line.discountAmount,
        otherCharges: [],
        itcEligible: line.itcEligible,
      })),
      payments: detail.payments.map((payment) => ({
        paymentMode: payment.paymentMode as PaymentInput["paymentMode"],
        amount: payment.amount,
        referenceNumber: payment.referenceNumber,
      })),
    }
    const posted = await postPurchaseBill(access, body)

    await db
      .update(purchaseBills)
      .set({
        voucherId: posted.voucherId,
        billNumber: posted.billNumber,
        status: "posted",
        postedBy: access.userId,
        postedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(purchaseBills.businessId, access.business.id), eq(purchaseBills.id, id)))

    return {
      bill: await getPurchaseBillDetail(access.business.id, id),
    }
  })
}

async function createPurchaseBill(access: BusinessAccess, body: CreatePurchaseBillInput) {
  const posted = body.status === "posted" ? await postPurchaseBill(access, body) : null
  const context =
    posted?.context ??
    await resolveTransactionContext(access, {
      transactionDate: body.billDate,
      gstRegistrationId: body.gstRegistrationId,
      branchId: body.branchId,
      warehouseId: body.warehouseId,
      placeOfSupplyStateCode: body.placeOfSupplyStateCode,
    })
  const calculated =
    posted?.calculated ??
    await calculateTransactionLines(access.business.id, body.lines, context, "purchase")
  const party = posted?.party ?? (await getPartySnapshot(access.business.id, body.supplierId))
  const supplierName = resolveCounterpartyName(body.supplierName, party?.displayName, "Unregistered supplier")
  const amountPaid = formatCents(Math.min(sumPayments(body.payments), toCents(calculated.totals.totalAmount)))
  const amountDue = formatCents(toCents(calculated.totals.totalAmount) - toCents(amountPaid))
  const itcEligibleAmount = calculateItcEligibleAmount(calculated, body.lines)

  const [bill] = await db
    .insert(purchaseBills)
    .values({
      businessId: access.business.id,
      voucherId: posted?.voucherId ?? null,
      gstRegistrationId: context.gstRegistration.id,
      branchId: context.branch?.id ?? null,
      warehouseId: context.warehouseId,
      supplierId: body.supplierId ?? null,
      supplierSnapshot: party ?? null,
      supplierName,
      billNumber: posted?.billNumber ?? createDraftDocumentNumber("PUR"),
      supplierInvoiceNumber: body.supplierInvoiceNumber,
      invoiceDate: body.invoiceDate,
      billDate: body.billDate,
      placeOfSupplyStateCode: context.placeOfSupplyStateCode,
      purchaseType: body.purchaseType,
      status: body.status,
      taxableValue: calculated.totals.taxableValue,
      cgstAmount: calculated.totals.cgstAmount,
      sgstAmount: calculated.totals.sgstAmount,
      igstAmount: calculated.totals.igstAmount,
      cessAmount: calculated.totals.cessAmount,
      totalAmount: calculated.totals.totalAmount,
      amountPaid,
      amountDue,
      itcEligibleAmount,
      notes: body.notes,
      createdBy: access.userId,
      postedBy: posted ? access.userId : null,
      postedAt: posted ? new Date() : null,
    })
    .returning()

  if (!bill) {
    throw new HttpError(500, "Unable to create purchase bill.")
  }

  await insertPurchaseChildren(bill.id, access.business.id, calculated, body.lines, body.payments)

  return getPurchaseBillDetail(access.business.id, bill.id)
}

async function postPurchaseBill(access: BusinessAccess, body: CreatePurchaseBillInput) {
  const context = await resolveTransactionContext(access, {
    transactionDate: body.billDate,
    gstRegistrationId: body.gstRegistrationId,
    branchId: body.branchId,
    warehouseId: body.warehouseId,
    placeOfSupplyStateCode: body.placeOfSupplyStateCode,
  })
  const calculated = await calculateTransactionLines(
    access.business.id,
    body.lines,
    context,
    "purchase"
  )
  const totalCents = toCents(calculated.totals.totalAmount)
  const paidCents = sumPayments(body.payments)

  if (paidCents > totalCents) {
    throw new HttpError(400, "Purchase payments cannot exceed bill total.")
  }

  const party = await getPartySnapshot(access.business.id, body.supplierId)
  const supplierName = resolveCounterpartyName(body.supplierName, party?.displayName, "Unregistered supplier")
  const result = await postPurchaseVoucher({
    access,
    voucherType: "PURCHASE",
    documentType: "purchase",
    transactionDate: body.billDate,
    context,
    calculated,
    party,
    counterpartyName: supplierName,
    payments: body.payments,
    notes: body.notes,
  })

  return {
    voucherId: result.voucher.id,
    billNumber: result.voucher.voucherNumber,
    context,
    calculated,
    party,
  }
}

async function insertPurchaseChildren(
  billId: string,
  businessId: string,
  calculated: CalculatedTransaction,
  sourceLines: CreatePurchaseBillInput["lines"],
  payments: PaymentInput[]
) {
  await db.insert(purchaseBillLines).values(
    calculated.lines.map((line, index) => ({
      businessId,
      purchaseBillId: billId,
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
      itcEligible: sourceLines[index]?.itcEligible ?? true,
      sortOrder: index,
    }))
  )

  if (payments.length === 0) {
    return
  }

  await db.insert(purchaseBillPayments).values(
    payments.map((payment) => ({
      businessId,
      purchaseBillId: billId,
      paymentMode: payment.paymentMode,
      amount: normalizeMoney(payment.amount),
      referenceNumber: payment.referenceNumber ?? null,
    }))
  )
}

async function getPurchaseBillDetail(businessId: string, billId: string) {
  const bill = await db.query.purchaseBills.findFirst({
    where: and(eq(purchaseBills.businessId, businessId), eq(purchaseBills.id, billId)),
  })

  if (!bill) {
    throw new HttpError(404, "Purchase bill not found.")
  }

  const [lines, payments] = await Promise.all([
    db
      .select()
      .from(purchaseBillLines)
      .where(eq(purchaseBillLines.purchaseBillId, billId))
      .orderBy(purchaseBillLines.sortOrder),
    db
      .select()
      .from(purchaseBillPayments)
      .where(eq(purchaseBillPayments.purchaseBillId, billId)),
  ])

  return {
    ...bill,
    lines,
    payments,
  }
}

function calculateItcEligibleAmount(
  calculated: CalculatedTransaction,
  sourceLines: CreatePurchaseBillInput["lines"]
) {
  const eligibleTax = calculated.lines.reduce((total, line, index) => {
    if (sourceLines[index]?.itcEligible === false) {
      return total
    }

    return (
      total +
      toCents(line.cgstAmount) +
      toCents(line.sgstAmount) +
      toCents(line.igstAmount) +
      toCents(line.cessAmount)
    )
  }, 0)

  return formatCents(eligibleTax)
}

function resolveCounterpartyName(
  requestedName: string | null | undefined,
  partyName: string | null | undefined,
  fallback: string
) {
  return requestedName?.trim() || partyName?.trim() || fallback
}

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}
