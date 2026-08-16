import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm"
import type { FastifyInstance } from "fastify"

import { db } from "../../db/client.js"
import { posSaleLines, posSalePayments, posSales } from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import {
  calculateTransactionLines,
  getPartySnapshot,
  postSalesVoucher,
  resolveTransactionContext,
  sumPayments,
  type CalculatedTransaction,
} from "../accounting/accounting-domain.service.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"
import { normalizeMoney, toCents } from "../core/core.validation.js"
import {
  listPosSalesQuerySchema,
  posCheckoutSchema,
  posSaleIdParamsSchema,
  type PosCheckoutInput,
} from "./pos.schemas.js"

type BusinessAccess = Awaited<ReturnType<typeof requirePrimaryBusinessAccess>>

export async function registerPosRoutes(app: FastifyInstance) {
  app.get("/pos/sales", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const query = listPosSalesQuerySchema.parse(request.query)
    const conditions: SQL[] = [eq(posSales.businessId, access.business.id)]

    if (query.search) {
      const term = `%${escapeLikeTerm(query.search)}%`
      const searchCondition = or(
        ilike(posSales.receiptNumber, term),
        ilike(posSales.customerName, term)
      )

      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }

    return {
      sales: await db
        .select()
        .from(posSales)
        .where(and(...conditions))
        .orderBy(desc(posSales.createdAt))
        .limit(query.limit),
    }
  })

  app.get("/pos/sales/:id", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const { id } = posSaleIdParamsSchema.parse(request.params)

    return {
      sale: await getPosSaleDetail(access.business.id, id),
    }
  })

  app.post("/pos/checkout", async (request) => {
    const access = await requirePrimaryBusinessAccess(request)
    const body = posCheckoutSchema.parse(request.body)

    return {
      sale: await checkoutPosSale(access, body),
    }
  })
}

async function checkoutPosSale(access: BusinessAccess, body: PosCheckoutInput) {
  const context = await resolveTransactionContext(access, {
    transactionDate: body.receiptDate,
    gstRegistrationId: body.gstRegistrationId,
    branchId: body.branchId,
    warehouseId: body.warehouseId,
    placeOfSupplyStateCode: body.placeOfSupplyStateCode,
  })
  const calculated = await calculateTransactionLines(
    access.business.id,
    body.lines,
    context,
    "pos"
  )
  const totalCents = toCents(calculated.totals.totalAmount)
  const paidCents = sumPayments(body.payments)

  if (paidCents !== totalCents) {
    throw new HttpError(400, "POS checkout payments must exactly match the receipt total.")
  }

  const party = await getPartySnapshot(access.business.id, body.partyId)
  const customerName = body.customerName?.trim() || party?.displayName || "Walk-in customer"
  const result = await postSalesVoucher({
    access,
    voucherType: "SALES",
    documentType: "pos",
    transactionDate: body.receiptDate,
    context,
    calculated,
    party,
    counterpartyName: customerName,
    payments: body.payments,
    notes: body.notes,
  })

  const [sale] = await db
    .insert(posSales)
    .values({
      businessId: access.business.id,
      voucherId: result.voucher.id,
      gstRegistrationId: context.gstRegistration.id,
      branchId: context.branch?.id ?? null,
      warehouseId: context.warehouseId,
      partyId: body.partyId ?? null,
      customerName,
      receiptNumber: result.voucher.voucherNumber,
      receiptDate: body.receiptDate,
      placeOfSupplyStateCode: context.placeOfSupplyStateCode,
      status: "posted",
      taxableValue: calculated.totals.taxableValue,
      cgstAmount: calculated.totals.cgstAmount,
      sgstAmount: calculated.totals.sgstAmount,
      igstAmount: calculated.totals.igstAmount,
      cessAmount: calculated.totals.cessAmount,
      totalAmount: calculated.totals.totalAmount,
      amountPaid: calculated.totals.totalAmount,
      amountDue: "0.00",
      notes: body.notes,
      createdBy: access.userId,
      postedAt: new Date(),
    })
    .returning()

  if (!sale) {
    throw new HttpError(500, "Unable to create POS sale.")
  }

  await insertPosChildren(sale.id, access.business.id, calculated, body.payments)

  return getPosSaleDetail(access.business.id, sale.id)
}

async function insertPosChildren(
  saleId: string,
  businessId: string,
  calculated: CalculatedTransaction,
  payments: PosCheckoutInput["payments"]
) {
  await db.insert(posSaleLines).values(
    calculated.lines.map((line, index) => ({
      businessId,
      posSaleId: saleId,
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

  await db.insert(posSalePayments).values(
    payments.map((payment) => ({
      businessId,
      posSaleId: saleId,
      paymentMode: payment.paymentMode,
      amount: normalizeMoney(payment.amount),
      referenceNumber: payment.referenceNumber ?? null,
    }))
  )
}

async function getPosSaleDetail(businessId: string, saleId: string) {
  const sale = await db.query.posSales.findFirst({
    where: and(eq(posSales.businessId, businessId), eq(posSales.id, saleId)),
  })

  if (!sale) {
    throw new HttpError(404, "POS sale not found.")
  }

  const [lines, payments] = await Promise.all([
    db
      .select()
      .from(posSaleLines)
      .where(eq(posSaleLines.posSaleId, saleId))
      .orderBy(posSaleLines.sortOrder),
    db.select().from(posSalePayments).where(eq(posSalePayments.posSaleId, saleId)),
  ])

  return {
    ...sale,
    lines,
    payments,
  }
}

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}
