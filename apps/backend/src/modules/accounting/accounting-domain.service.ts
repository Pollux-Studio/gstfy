import { randomUUID } from "node:crypto"

import { and, desc, eq, gte, inArray, lte } from "drizzle-orm"

import { db } from "../../db/client.js"
import {
  businessBranches,
  financialYears,
  gstRegistrations,
  inventoryBalances,
  itemAccountingProfiles,
  itemInventoryProfiles,
  items,
  itemUnits,
  ledgerAccounts,
  parties,
  partyGstRegistrations,
  type BusinessBranchRecord,
  type GstRegistrationRecord,
  type LedgerAccountRecord,
  type PartyRecord,
} from "../../db/schema/index.js"
import { HttpError } from "../../utils/http-error.js"
import { requirePrimaryBusinessAccess } from "../businesses/business-access.js"
import { postVoucher } from "../core/core.routes.js"
import {
  formatCents,
  normalizeMoney,
  toCents,
  validateBalancedJournal,
} from "../core/core.validation.js"
import type { PostVoucherInput, VoucherType } from "../core/core.schemas.js"
import { formatQuantity, toQuantityMilli } from "../inventory/inventory.service.js"
import { calculateTaxForBusiness } from "../tax/tax-engine.service.js"
import type {
  PricingMode,
  SupplyType,
  TaxCalculationResult,
  TaxResultLine,
  Taxability,
  TransactionType,
} from "../tax/tax.types.js"

type BusinessAccess = Awaited<ReturnType<typeof requirePrimaryBusinessAccess>>

export type DocumentStatus = "draft" | "posted"
export type PaymentMode = "cash" | "upi" | "card" | "bank" | "cheque"
export type TransactionDirection = "sales" | "purchase"

export type TransactionLineInput = {
  itemId?: string | null
  itemName: string
  hsnSacCode?: string | null
  quantity: string
  unit?: string
  rate: string
  gstRate: string
  taxability?: Taxability | null
  cessRuleId?: string | null
  itcEligible?: boolean
  pricingMode?: PricingMode
  discountAmount?: string | null
}

export type PaymentInput = {
  paymentMode: PaymentMode
  amount: string
  referenceNumber?: string | null
}

export type TransactionContextInput = {
  transactionDate: string
  gstRegistrationId?: string | null
  branchId?: string | null
  warehouseId?: string | null
  placeOfSupplyStateCode?: string | null
}

export type TransactionContext = {
  financialYearId: string
  transactionDate: string
  gstRegistration: GstRegistrationRecord
  branch: BusinessBranchRecord | null
  warehouseId: string | null
  placeOfSupplyStateCode: string
}

export type CalculatedTransactionLine = TaxResultLine
export type CalculatedTransaction = TaxCalculationResult

type VoucherCommandInput = {
  access: BusinessAccess
  voucherType: VoucherType
  documentType?: string
  transactionDate: string
  context: TransactionContext
  calculated: CalculatedTransaction
  party: PartySnapshot | null
  counterpartyName: string
  payments: PaymentInput[]
  notes?: string | null
  idempotencyKey?: string
}

type PartySnapshot = {
  id: string
  displayName: string
  legalName: string | null
  tradeName: string | null
  gstin: string | null
  stateCode: string | null
}

type ItemAccountMap = Map<
  string,
  {
    salesAccountId: string | null
    purchaseAccountId: string | null
    inventoryAccountId: string | null
  }
>

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
] as const

export async function ensureDefaultLedgerAccountMap(businessId: string) {
  await db
    .insert(ledgerAccounts)
    .values(defaultLedgerAccounts.map((account) => ({ businessId, ...account })))
    .onConflictDoNothing()

  const rows = await db
    .select()
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.businessId, businessId))

  return new Map(rows.map((account) => [account.accountCode, account]))
}

export async function resolveTransactionContext(
  access: BusinessAccess,
  input: TransactionContextInput
): Promise<TransactionContext> {
  const financialYear = await db.query.financialYears.findFirst({
    where: and(
      eq(financialYears.businessId, access.business.id),
      lte(financialYears.startDate, input.transactionDate),
      gte(financialYears.endDate, input.transactionDate),
      eq(financialYears.status, "active")
    ),
    orderBy: [desc(financialYears.isCurrent), desc(financialYears.startDate)],
  })

  if (!financialYear) {
    throw new HttpError(400, "No active financial year covers this transaction date.")
  }

  const gstRegistration =
    input.gstRegistrationId ?
      await db.query.gstRegistrations.findFirst({
        where: and(
          eq(gstRegistrations.businessId, access.business.id),
          eq(gstRegistrations.id, input.gstRegistrationId)
        ),
      })
    : await db.query.gstRegistrations.findFirst({
        where: and(
          eq(gstRegistrations.businessId, access.business.id),
          eq(gstRegistrations.status, "active")
        ),
      })

  if (!gstRegistration) {
    throw new HttpError(400, "No active GST registration is available for posting.")
  }

  const branch =
    input.branchId ?
      await db.query.businessBranches.findFirst({
        where: and(
          eq(businessBranches.businessId, access.business.id),
          eq(businessBranches.id, input.branchId)
        ),
      })
    : await db.query.businessBranches.findFirst({
        where: and(
          eq(businessBranches.businessId, access.business.id),
          eq(businessBranches.gstRegistrationId, gstRegistration.id),
          eq(businessBranches.status, "active")
        ),
      })

  if (input.branchId && !branch) {
    throw new HttpError(404, "Branch not found.")
  }

  const placeOfSupplyStateCode =
    input.placeOfSupplyStateCode?.trim() || gstRegistration.stateCode

  return {
    financialYearId: financialYear.id,
    transactionDate: input.transactionDate,
    gstRegistration,
    branch: branch ?? null,
    warehouseId: input.warehouseId ?? null,
    placeOfSupplyStateCode,
  }
}

export async function getPartySnapshot(
  businessId: string,
  partyId: string | null | undefined
): Promise<PartySnapshot | null> {
  if (!partyId) {
    return null
  }

  const party = await db.query.parties.findFirst({
    where: and(eq(parties.businessId, businessId), eq(parties.id, partyId)),
  })

  if (!party) {
    throw new HttpError(404, "Party not found.")
  }

  const gstRegistration = await db.query.partyGstRegistrations.findFirst({
    where: and(
      eq(partyGstRegistrations.businessId, businessId),
      eq(partyGstRegistrations.partyId, partyId),
      eq(partyGstRegistrations.status, "active")
    ),
    orderBy: [desc(partyGstRegistrations.isPrimary), desc(partyGstRegistrations.createdAt)],
  })

  return {
    id: party.id,
    displayName: getPartyName(party),
    legalName: party.legalName,
    tradeName: party.tradeName,
    gstin: gstRegistration?.gstin ?? null,
    stateCode: gstRegistration?.stateCode ?? null,
  }
}

export function calculateTransactionLines(
  businessId: string,
  lines: TransactionLineInput[],
  context: TransactionContext,
  transactionType: TransactionType = "sales",
  options: {
    supplyType?: SupplyType
    partyRegistrationType?: "registered" | "unregistered"
    reverseCharge?: boolean
  } = {}
): Promise<CalculatedTransaction> {
  return calculateTaxForBusiness(businessId, lines, {
    transactionDate: context.transactionDate,
    transactionType,
    supplyType: options.supplyType,
    partyRegistrationType: options.partyRegistrationType,
    sellerGstin: context.gstRegistration.gstin,
    sellerStateCode: context.gstRegistration.stateCode,
    placeOfSupplyStateCode: context.placeOfSupplyStateCode,
    reverseCharge: options.reverseCharge,
  })
}

export function sumPayments(payments: PaymentInput[]) {
  return payments.reduce((total, payment) => {
    const amount = toCents(normalizeMoney(payment.amount))

    if (amount <= 0) {
      throw new HttpError(400, "Payment amount must be greater than zero.")
    }

    return total + amount
  }, 0)
}

export async function postSalesVoucher(input: VoucherCommandInput) {
  return postDomainVoucher(input, "sales")
}

export async function postPurchaseVoucher(input: VoucherCommandInput) {
  return postDomainVoucher(input, "purchase")
}

export function createDraftDocumentNumber(prefix: string) {
  return `${prefix}-DRAFT-${randomUUID().slice(0, 8).toUpperCase()}`
}

function accountSeed(
  accountCode: string,
  accountName: string,
  accountType: string,
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
    isSystem: true,
    status: "active",
  }
}

async function postDomainVoucher(
  input: VoucherCommandInput,
  direction: TransactionDirection
) {
  const accountMap = await ensureDefaultLedgerAccountMap(input.access.business.id)
  const itemAccountMap = await getItemAccountMap(
    input.access.business.id,
    input.calculated.lines
      .map((line) => line.itemId)
      .filter((itemId): itemId is string => Boolean(itemId))
  )
  const inventoryEntries = await buildInventoryEntries(input, direction, itemAccountMap)
  const journalLines = buildJournalLines(
    input,
    direction,
    accountMap,
    itemAccountMap,
    inventoryEntries
  )

  validateBalancedJournal({ journal: { lines: journalLines } })

  return postVoucher(input.access, {
    idempotencyKey: input.idempotencyKey ?? randomUUID(),
    voucherType: input.voucherType,
    documentType: input.documentType,
    voucherDate: input.transactionDate,
    financialYearId: input.context.financialYearId,
    gstRegistrationId: input.context.gstRegistration.id,
    branchId: input.context.branch?.id ?? null,
    warehouseId: input.context.warehouseId,
    seriesCode: "DEFAULT",
    notes: input.notes ?? undefined,
    snapshots: {
      seller: {
        businessId: input.access.business.id,
        legalName: input.access.business.legalName,
        tradeName: input.access.business.tradeName,
        gstin: input.context.gstRegistration.gstin,
      },
      branch: input.context.branch ?? undefined,
      party: input.party ?? undefined,
      tax: {
        placeOfSupplyStateCode: input.context.placeOfSupplyStateCode,
        classification: input.calculated.classification,
        taxRuleVersion: input.calculated.taxRuleVersion,
        taxableValue: input.calculated.totals.taxableValue,
        cgstAmount: input.calculated.totals.cgstAmount,
        sgstAmount: input.calculated.totals.sgstAmount,
        igstAmount: input.calculated.totals.igstAmount,
        totalAmount: input.calculated.totals.totalAmount,
        taxBreakup: input.calculated.taxBreakup,
      },
    },
    journal: {
      description: `${input.voucherType} - ${input.counterpartyName}`,
      lines: journalLines,
    },
    inventoryEntries,
    gstEntries: buildGstEntries(input, direction),
    receivablePayableEntries: buildReceivablePayableEntries(input, direction),
    paymentAllocations: [],
  })
}

function buildJournalLines(
  input: VoucherCommandInput,
  direction: TransactionDirection,
  accountMap: Map<string, LedgerAccountRecord>,
  itemAccountMap: ItemAccountMap,
  inventoryEntries: PostVoucherInput["inventoryEntries"],
): PostVoucherInput["journal"]["lines"] {
  const totalCents = toCents(input.calculated.totals.totalAmount)
  const paidCents = Math.min(sumPayments(input.payments), totalCents)
  const dueCents = totalCents - paidCents
  const lines: PostVoucherInput["journal"]["lines"] = []

  for (const [accountId, amountCents] of groupLineTaxableAmounts(
    input.calculated.lines,
    direction,
    itemAccountMap,
    accountMap,
    inventoryEntries
  )) {
    const account = accountById(accountMap, accountId)
    lines.push(toJournalLine(account, {
      debit: direction === "purchase" ? amountCents : 0,
      credit: direction === "sales" ? amountCents : 0,
      narration: direction === "sales" ? "Taxable sales" : "Taxable purchases",
      input,
    }))
  }

  pushTaxLine(lines, input, accountMap, direction, "cgst", input.calculated.totals.cgstAmount)
  pushTaxLine(lines, input, accountMap, direction, "sgst", input.calculated.totals.sgstAmount)
  pushTaxLine(lines, input, accountMap, direction, "igst", input.calculated.totals.igstAmount)
  pushTaxLine(lines, input, accountMap, direction, "cess", input.calculated.totals.cessAmount)

  if (direction === "sales") {
    pushCostOfGoodsSoldLines(lines, input, accountMap, inventoryEntries)
  }

  const groupedPayments = groupPaymentAmounts(input.payments)
  for (const [mode, amountCents] of groupedPayments) {
    const account = getAccount(accountMap, paymentAccountCode(mode))
    lines.push(toJournalLine(account, {
      debit: direction === "sales" ? amountCents : 0,
      credit: direction === "purchase" ? amountCents : 0,
      narration: `${paymentLabel(mode)} ${direction === "sales" ? "receipt" : "payment"}`,
      input,
    }))
  }

  if (dueCents > 0) {
    const account = getAccount(accountMap, direction === "sales" ? "1130" : "2110")
    lines.push(toJournalLine(account, {
      debit: direction === "sales" ? dueCents : 0,
      credit: direction === "purchase" ? dueCents : 0,
      narration: direction === "sales" ? "Outstanding receivable" : "Outstanding payable",
      input,
    }))
  }

  return lines.filter((line) => toCents(line.debit) > 0 || toCents(line.credit) > 0)
}

async function buildInventoryEntries(
  input: VoucherCommandInput,
  direction: TransactionDirection,
  itemAccountMap: ItemAccountMap
): Promise<PostVoucherInput["inventoryEntries"]> {
  const itemIds = Array.from(
    new Set(
      input.calculated.lines
        .map((line) => line.itemId)
        .filter((itemId): itemId is string => Boolean(itemId))
    )
  )

  if (itemIds.length === 0) {
    return []
  }

  const products = await getInventoryProductMap(
    input.access.business.id,
    itemIds,
    input.context.warehouseId
  )
  const entries: PostVoucherInput["inventoryEntries"] = []

  for (const line of input.calculated.lines) {
    if (!line.itemId) {
      continue
    }

    const product = products.get(line.itemId)

    if (!product) {
      continue
    }

    if (!input.context.warehouseId) {
      throw new HttpError(
        400,
        "Tracked goods require a warehouse before posting sales or purchases."
      )
    }

    const baseQuantity = convertToBaseQuantity(
      line.quantity,
      line.unit,
      product.unit?.baseUnit ?? line.unit,
      product.unit?.secondaryUnit ?? null,
      product.unit?.conversionFactor ?? "1"
    )
    const baseQuantityMilli = toQuantityMilli(baseQuantity)

    if (baseQuantityMilli <= 0) {
      throw new HttpError(400, "Inventory quantity must be greater than zero.")
    }

    const itemAccount = itemAccountMap.get(line.itemId)

    if (direction === "purchase") {
      const unitCost = formatCents(
        Math.round((toCents(line.taxableValue) * 1000) / baseQuantityMilli)
      )
      entries.push({
        branchId: input.context.branch?.id ?? null,
        warehouseId: input.context.warehouseId,
        itemId: line.itemId,
        itemNameSnapshot: product.item.name,
        skuSnapshot: product.item.sku,
        unitSnapshot: product.unit?.baseUnit ?? line.unit,
        itemSnapshot: buildInventoryItemSnapshot(line, product.item),
        movementType: "PURCHASE",
        quantityIn: baseQuantity,
        quantityOut: "0",
        quantity: baseQuantity,
        unit: product.unit?.baseUnit ?? line.unit,
        sourceUnit: line.unit,
        baseQuantity,
        unitCost,
        inventoryValue: line.taxableValue,
        totalCost: line.taxableValue,
        transactionDate: input.transactionDate,
        reason: "Purchase posting",
      })
      continue
    }

    const unitCost = product.balance ? averageCost(product.balance.quantityOnHand, product.balance.inventoryValue) : "0.00"
    const inventoryValue = formatCents(
      Math.round((toCents(unitCost) * baseQuantityMilli) / 1000)
    )

    entries.push({
      branchId: input.context.branch?.id ?? null,
      warehouseId: input.context.warehouseId,
      itemId: line.itemId,
      itemNameSnapshot: product.item.name,
      skuSnapshot: product.item.sku,
      unitSnapshot: product.unit?.baseUnit ?? line.unit,
      itemSnapshot: {
        ...buildInventoryItemSnapshot(line, product.item),
        inventoryAccountId: itemAccount?.inventoryAccountId ?? null,
      },
      movementType: "SALE",
      quantityIn: "0",
      quantityOut: baseQuantity,
      quantity: baseQuantity,
      unit: product.unit?.baseUnit ?? line.unit,
      sourceUnit: line.unit,
      baseQuantity,
      unitCost,
      inventoryValue,
      totalCost: inventoryValue,
      transactionDate: input.transactionDate,
      reason: "Sales posting",
    })
  }

  return entries
}

async function getInventoryProductMap(
  businessId: string,
  itemIds: string[],
  warehouseId: string | null
) {
  const [productRows, profileRows, unitRows, balanceRows] = await Promise.all([
    db
      .select()
      .from(items)
      .where(and(eq(items.businessId, businessId), inArray(items.id, itemIds))),
    db
      .select()
      .from(itemInventoryProfiles)
      .where(
        and(
          eq(itemInventoryProfiles.businessId, businessId),
          inArray(itemInventoryProfiles.itemId, itemIds)
        )
      ),
    db
      .select()
      .from(itemUnits)
      .where(and(eq(itemUnits.businessId, businessId), inArray(itemUnits.itemId, itemIds))),
    warehouseId ?
      db
        .select()
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.businessId, businessId),
            eq(inventoryBalances.warehouseId, warehouseId),
            inArray(inventoryBalances.itemId, itemIds)
          )
        )
    : Promise.resolve([]),
  ])
  const profileByItem = new Map(profileRows.map((profile) => [profile.itemId, profile]))
  const unitByItem = new Map(unitRows.map((unit) => [unit.itemId, unit]))
  const balanceByItem = new Map(balanceRows.map((balance) => [balance.itemId, balance]))
  const result = new Map<
    string,
    {
      item: (typeof productRows)[number]
      unit: (typeof unitRows)[number] | null
      balance: (typeof balanceRows)[number] | null
    }
  >()

  for (const item of productRows) {
    const profile = profileByItem.get(item.id)
    const isTracked = item.itemType === "GOODS" && profile?.trackInventory !== false

    if (!isTracked) {
      continue
    }

    result.set(item.id, {
      item,
      unit: unitByItem.get(item.id) ?? null,
      balance: balanceByItem.get(item.id) ?? null,
    })
  }

  return result
}

function buildInventoryItemSnapshot(
  line: CalculatedTransactionLine,
  item: { itemType: string; sku: string }
) {
  return {
    itemType: item.itemType,
    sku: item.sku,
    hsnSac: line.hsnSacCode ?? null,
    taxability: line.taxability,
    gstRate: line.gstRate,
    taxRuleId: line.taxRuleId,
    taxRuleVersion: line.taxRuleVersion,
  }
}

function convertToBaseQuantity(
  quantity: string,
  sourceUnit: string,
  baseUnit: string,
  secondaryUnit: string | null,
  conversionFactor: string
) {
  if (sourceUnit.toLowerCase() === baseUnit.toLowerCase()) {
    return formatQuantity(toQuantityMilli(quantity))
  }

  if (secondaryUnit && sourceUnit.toLowerCase() === secondaryUnit.toLowerCase()) {
    return formatQuantity(Math.round(toQuantityMilli(quantity) * Number(conversionFactor)))
  }

  return formatQuantity(toQuantityMilli(quantity))
}

function pushCostOfGoodsSoldLines(
  lines: PostVoucherInput["journal"]["lines"],
  input: VoucherCommandInput,
  accountMap: Map<string, LedgerAccountRecord>,
  inventoryEntries: PostVoucherInput["inventoryEntries"]
) {
  const cogsCents = inventoryEntries.reduce(
    (total, entry) => total + toCents(entry.inventoryValue ?? entry.totalCost ?? "0.00"),
    0
  )

  if (cogsCents <= 0) {
    return
  }

  lines.push(
    toJournalLine(getAccount(accountMap, "5200"), {
      debit: cogsCents,
      credit: 0,
      narration: "Cost of goods sold",
      input,
    }),
    toJournalLine(getAccount(accountMap, "1140"), {
      debit: 0,
      credit: cogsCents,
      narration: "Inventory consumed",
      input,
    })
  )
}

function buildGstEntries(
  input: VoucherCommandInput,
  direction: TransactionDirection
): PostVoucherInput["gstEntries"] {
  const entryType = direction === "sales" ? "output" : "input"
  const entries: PostVoucherInput["gstEntries"] = []

  for (const entry of input.calculated.taxBreakup) {
    if (toCents(entry.taxAmount) <= 0) {
      continue
    }

    entries.push({
      gstRegistrationId: input.context.gstRegistration.id,
      branchId: input.context.branch?.id ?? null,
      entryType,
      taxComponent: entry.component,
      taxRate: entry.taxRate,
      taxableValue: entry.taxableValue,
      taxAmount: entry.taxAmount,
      placeOfSupplyStateCode: input.context.placeOfSupplyStateCode,
      itcEligibility:
        direction === "purchase" ? entry.itcEligibility ?? "eligible" : undefined,
    })
  }

  return entries
}

function buildReceivablePayableEntries(
  input: VoucherCommandInput,
  direction: TransactionDirection
): PostVoucherInput["receivablePayableEntries"] {
  const totalCents = toCents(input.calculated.totals.totalAmount)
  const dueCents = totalCents - Math.min(sumPayments(input.payments), totalCents)

  if (dueCents <= 0) {
    return []
  }

  return [
    {
      partyId: input.party?.id,
      partyNameSnapshot: input.party?.displayName ?? input.counterpartyName,
      partySnapshot: input.party ?? undefined,
      entryType: direction === "sales" ? "receivable" : "payable",
      originalAmount: formatCents(dueCents),
    },
  ]
}

async function getItemAccountMap(
  businessId: string,
  itemIds: string[]
) {
  if (itemIds.length === 0) {
    return new Map() as ItemAccountMap
  }

  const rows = await db
    .select({
      itemId: itemAccountingProfiles.itemId,
      salesAccountId: itemAccountingProfiles.salesAccountId,
      purchaseAccountId: itemAccountingProfiles.purchaseAccountId,
      inventoryAccountId: itemAccountingProfiles.inventoryAccountId,
    })
    .from(itemAccountingProfiles)
    .where(
      and(
        eq(itemAccountingProfiles.businessId, businessId),
        inArray(itemAccountingProfiles.itemId, itemIds)
      )
    )

  return new Map(rows.map((row) => [row.itemId, row]))
}

function groupLineTaxableAmounts(
  lines: CalculatedTransactionLine[],
  direction: TransactionDirection,
  itemAccountMap: ItemAccountMap,
  accountMap: Map<string, LedgerAccountRecord>,
  inventoryEntries: PostVoucherInput["inventoryEntries"]
) {
  const fallbackAccount = getAccount(accountMap, direction === "sales" ? "4100" : "5100")
  const inventoryAccount = getAccount(accountMap, "1140")
  const trackedPurchaseItems = new Set(inventoryEntries.map((entry) => entry.itemId))
  const grouped = new Map<string, number>()

  for (const line of lines) {
    const itemAccount =
      line.itemId ? itemAccountMap.get(line.itemId) : undefined
    const accountId =
      direction === "sales" ? itemAccount?.salesAccountId : itemAccount?.purchaseAccountId
    const resolvedAccountId =
      direction === "purchase" && line.itemId && trackedPurchaseItems.has(line.itemId) ?
        itemAccount?.inventoryAccountId ?? inventoryAccount.id
      : accountId ?? fallbackAccount.id

    grouped.set(
      resolvedAccountId,
      (grouped.get(resolvedAccountId) ?? 0) + toCents(line.taxableValue)
    )
  }

  return grouped
}

function pushTaxLine(
  lines: PostVoucherInput["journal"]["lines"],
  input: VoucherCommandInput,
  accountMap: Map<string, LedgerAccountRecord>,
  direction: TransactionDirection,
  component: "cgst" | "sgst" | "igst" | "cess",
  amount: string
) {
  const amountCents = toCents(amount)

  if (amountCents <= 0) {
    return
  }

  const account = getAccount(accountMap, taxAccountCode(direction, component))
  lines.push(toJournalLine(account, {
    debit: direction === "purchase" ? amountCents : 0,
    credit: direction === "sales" ? amountCents : 0,
    narration: `${direction === "sales" ? "Output" : "Input"} ${component.toUpperCase()}`,
    input,
  }))
}

function getAccount(accountMap: Map<string, LedgerAccountRecord>, accountCode: string) {
  const account = accountMap.get(accountCode)

  if (!account) {
    throw new HttpError(500, `Required ledger account ${accountCode} is not configured.`)
  }

  return account
}

function accountById(accountMap: Map<string, LedgerAccountRecord>, accountId: string) {
  const account = Array.from(accountMap.values()).find((row) => row.id === accountId)

  if (!account) {
    throw new HttpError(400, "Mapped ledger account is not available.")
  }

  return account
}

function toJournalLine(
  account: LedgerAccountRecord,
  values: {
    debit: number
    credit: number
    narration: string
    input: VoucherCommandInput
  }
) {
  return {
    accountId: account.id,
    accountCode: account.accountCode,
    accountName: account.accountName,
    debit: formatCents(values.debit),
    credit: formatCents(values.credit),
    narration: values.narration,
    branchId: values.input.context.branch?.id ?? null,
    gstRegistrationId: values.input.context.gstRegistration.id,
    warehouseId: values.input.context.warehouseId,
  }
}

function groupPaymentAmounts(payments: PaymentInput[]) {
  const grouped = new Map<PaymentMode, number>()

  for (const payment of payments) {
    grouped.set(
      payment.paymentMode,
      (grouped.get(payment.paymentMode) ?? 0) + toCents(normalizeMoney(payment.amount))
    )
  }

  return grouped
}

function paymentAccountCode(mode: PaymentMode) {
  return mode === "cash" ? "1110" : "1120"
}

function paymentLabel(mode: PaymentMode) {
  const labels: Record<PaymentMode, string> = {
    cash: "Cash",
    upi: "UPI",
    card: "Card",
    bank: "Bank",
    cheque: "Cheque",
  }

  return labels[mode]
}

function taxAccountCode(
  direction: TransactionDirection,
  component: "cgst" | "sgst" | "igst" | "cess"
) {
  const salesCodes = {
    cgst: "2210",
    sgst: "2220",
    igst: "2230",
    cess: "2240",
  }
  const purchaseCodes = {
    cgst: "1210",
    sgst: "1220",
    igst: "1230",
    cess: "1240",
  }

  return direction === "sales" ? salesCodes[component] : purchaseCodes[component]
}

function averageCost(quantity: string, inventoryValue: string) {
  const quantityMilli = toQuantityMilli(quantity)

  if (quantityMilli <= 0) {
    return "0.00"
  }

  return formatCents(Math.round((toCents(inventoryValue) * 1000) / quantityMilli))
}

function getPartyName(party: PartyRecord) {
  return party.displayName || party.tradeName || party.legalName || "Unknown party"
}
