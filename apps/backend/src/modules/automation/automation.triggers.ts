import type { FastifyBaseLogger } from "fastify"

import { ensureAutomationSettings } from "./automation.repository.js"
import { enqueueAutomationJob } from "./automation.queue.js"
import type { AutomationQueueInput } from "./automation.types.js"
import type { BusinessAccess } from "../businesses/business-access.js"

type PostedDocumentInput = {
  sourceType: "sales_invoice" | "purchase_bill" | "pos_sale" | "credit_note" | "debit_note"
  sourceId: string
  voucherId: string | null
  sourceDocumentType?: "sales_invoice" | "credit_note" | "debit_note"
  sourceDocumentId?: string
}

export async function enqueuePostedDocumentAutomation(
  access: BusinessAccess,
  input: PostedDocumentInput,
  logger?: FastifyBaseLogger
) {
  const settings = await ensureAutomationSettings(access.business.id)

  if (settings?.autoStockAccountingEnabled) {
    await enqueueBestEffort(
      {
        businessId: access.business.id,
        jobType: "stock.posted-document.sync",
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        payload: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          voucherId: input.voucherId,
        },
        createdBy: access.userId,
        priority: 10,
      },
      logger
    )
  }

  if (settings?.autoEInvoiceEnabled && input.sourceDocumentType) {
    await enqueueBestEffort(
      {
        businessId: access.business.id,
        jobType: "einvoice.generate",
        sourceType: input.sourceDocumentType,
        sourceId: input.sourceDocumentId ?? input.sourceId,
        payload: {
          sourceDocumentType: input.sourceDocumentType,
          sourceDocumentId: input.sourceDocumentId ?? input.sourceId,
        },
        createdBy: access.userId,
        priority: 20,
      },
      logger
    )
  }
}

export async function enqueueOpeningStockAutomation(
  access: BusinessAccess,
  input: {
    sourceId: string
    transactionId: string
  },
  logger?: FastifyBaseLogger
) {
  const settings = await ensureAutomationSettings(access.business.id)

  if (!settings?.autoStockAccountingEnabled) {
    return
  }

  await enqueueBestEffort(
    {
      businessId: access.business.id,
      jobType: "stock.opening-stock.sync",
      sourceType: "opening_stock",
      sourceId: input.sourceId,
      payload: input,
      createdBy: access.userId,
      priority: 10,
    },
    logger
  )
}

export async function enqueueBankAutoMatchAutomation(
  access: BusinessAccess,
  input: {
    importId?: string | null
    cashBankAccountId?: string | null
    dateToleranceDays?: number
    triggerSourceType?: string
    triggerSourceId?: string
  },
  logger?: FastifyBaseLogger
) {
  const settings = await ensureAutomationSettings(access.business.id)

  if (!settings?.bankAutoMatchHighConfidenceEnabled) {
    return
  }

  await enqueueBestEffort(
    {
      businessId: access.business.id,
      jobType: "bank-reconciliation.auto-match",
      sourceType: input.triggerSourceType ?? "bank_statement_import",
      sourceId:
        input.triggerSourceId ??
        input.importId ??
        input.cashBankAccountId ??
        access.business.id,
      payload: {
        importId: input.importId ?? null,
        cashBankAccountId: input.cashBankAccountId ?? null,
        dateToleranceDays: input.dateToleranceDays ?? 3,
      },
      createdBy: access.userId,
      priority: 15,
    },
    logger
  )
}

async function enqueueBestEffort(
  input: AutomationQueueInput,
  logger?: FastifyBaseLogger
) {
  try {
    await enqueueAutomationJob(input, logger)
  } catch (error) {
    logger?.warn(
      {
        jobType: input.jobType,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        err: error,
      },
      "failed to persist automation job"
    )
  }
}
