import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm"

import { db } from "../../db/client.js"
import {
  itemTaxProfiles,
  taxRules,
  type ItemTaxProfileRecord,
  type TaxRuleRecord,
} from "../../db/schema/index.js"
import {
  type TaxCalculationContext,
  type TaxLineInput,
  type TaxRuleResolution,
  type Taxability,
} from "./tax.types.js"
import { taxError } from "./tax.errors.js"
import { normalizeRate } from "./tax.validation.js"

const currentTaxRuleVersion = "GSTFY_TAX_V1"
const currentTaxRuleEffectiveFrom = "2017-07-01"

export async function resolveBusinessTaxLines(
  businessId: string,
  lines: TaxLineInput[],
  context: TaxCalculationContext
) {
  return Promise.all(
    lines.map(async (line) => {
      const productProfile =
        line.itemId ?
          await resolveEffectiveProductTaxProfile(businessId, line.itemId, context.transactionDate)
        : null
      const productResolvedLine = applyProductTaxProfile(line, productProfile)
      const resolvedTaxRule = await resolveConfiguredTaxRule(
        businessId,
        productResolvedLine,
        context
      )

      return {
        ...productResolvedLine,
        resolvedTaxRule,
      }
    })
  )
}

export function resolveTaxRule(
  line: TaxLineInput,
  context: TaxCalculationContext
): TaxRuleResolution {
  if (line.resolvedTaxRule) {
    return line.resolvedTaxRule
  }

  const taxability = normalizeTaxability(line.taxability)
  const gstRate = taxability === "TAXABLE" ? normalizeRate(line.gstRate) : "0.00"
  const hsnSacKey = line.hsnSacCode?.trim() || "manual"

  return {
    taxRuleId: [
      currentTaxRuleVersion,
      context.transactionType,
      taxability,
      hsnSacKey,
      gstRate,
    ].join(":"),
    taxRuleVersion: currentTaxRuleVersion,
    effectiveFrom: currentTaxRuleEffectiveFrom,
    effectiveTo: null,
    taxability,
    gstRate,
    cessRuleId: line.cessRuleId?.trim() || null,
  }
}

async function resolveEffectiveProductTaxProfile(
  businessId: string,
  itemId: string,
  transactionDate: string
) {
  return db.query.itemTaxProfiles.findFirst({
    where: and(
      eq(itemTaxProfiles.businessId, businessId),
      eq(itemTaxProfiles.itemId, itemId),
      eq(itemTaxProfiles.status, "ACTIVE"),
      lte(itemTaxProfiles.effectiveFrom, transactionDate),
      or(isNull(itemTaxProfiles.effectiveTo), gte(itemTaxProfiles.effectiveTo, transactionDate))
    ),
    orderBy: [desc(itemTaxProfiles.effectiveFrom), desc(itemTaxProfiles.createdAt)],
  })
}

function applyProductTaxProfile(
  line: TaxLineInput,
  profile: ItemTaxProfileRecord | null | undefined
): TaxLineInput {
  if (!profile) {
    return line
  }

  return {
    ...line,
    hsnSacCode: profile.hsnSac ?? line.hsnSacCode ?? null,
    taxability: normalizeTaxability(profile.taxability as Taxability),
    gstRate: profile.gstRate,
    cessRuleId: profile.cessRuleId ?? line.cessRuleId ?? null,
  }
}

async function resolveConfiguredTaxRule(
  businessId: string,
  line: TaxLineInput,
  context: TaxCalculationContext
): Promise<TaxRuleResolution> {
  const fallbackRule = resolveTaxRule(line, context)
  const rows = await db
    .select()
    .from(taxRules)
    .where(
      and(
        or(isNull(taxRules.businessId), eq(taxRules.businessId, businessId)),
        eq(taxRules.status, "active"),
        eq(taxRules.transactionType, context.transactionType),
        eq(taxRules.taxability, fallbackRule.taxability),
        eq(taxRules.gstRate, fallbackRule.gstRate),
        lte(taxRules.effectiveFrom, context.transactionDate),
        or(isNull(taxRules.effectiveTo), gte(taxRules.effectiveTo, context.transactionDate))
      )
    )
    .orderBy(desc(taxRules.businessId), desc(taxRules.effectiveFrom), desc(taxRules.createdAt))

  if (rows.length === 0) {
    return fallbackRule
  }

  const scopedRows = selectHighestPrecedenceRules(rows, businessId)

  if (scopedRows.length > 1) {
    throw taxError(
      "AMBIGUOUS_TAX_RULE",
      "Multiple active tax rules match this transaction context.",
      "taxRule"
    )
  }

  return toTaxRuleResolution(scopedRows[0] ?? rows[0] ?? fallbackRule)
}

function selectHighestPrecedenceRules(rows: TaxRuleRecord[], businessId: string) {
  const businessRules = rows.filter((row) => row.businessId === businessId)

  return businessRules.length > 0 ? businessRules : rows.filter((row) => row.businessId === null)
}

function toTaxRuleResolution(rule: TaxRuleRecord | TaxRuleResolution): TaxRuleResolution {
  if ("ruleCode" in rule) {
    return {
      taxRuleId: rule.id,
      taxRuleVersion: rule.version,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      taxability: normalizeTaxability(rule.taxability as Taxability),
      gstRate: normalizeRate(rule.gstRate),
      cessRuleId: rule.cessRuleId,
    }
  }

  return rule
}

function normalizeTaxability(value: Taxability | null | undefined): Taxability {
  return value ?? "TAXABLE"
}
