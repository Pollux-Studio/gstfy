import { render } from "takumi-pdf/next"

import {
  createPurchaseInvoiceTemplate,
  getPurchaseInvoiceTemplate,
  type PurchaseInvoiceTemplateCode,
} from "@/lib/invoices/templates/purchase"
import type { PurchaseInvoiceBusinessInfo } from "@/lib/invoices/templates/purchase/types"
import type { PurchaseBillDetail } from "@/lib/purchases/api"

export type { PurchaseInvoiceBusinessInfo }

export type RenderPurchaseInvoicePdfOptions = {
  buyer?: PurchaseInvoiceBusinessInfo | null
  templateCode?: PurchaseInvoiceTemplateCode | null
  watermarkText?: string | null
}

export async function renderPurchaseInvoicePdf(
  bill: PurchaseBillDetail,
  options: RenderPurchaseInvoicePdfOptions = {}
) {
  const template = getPurchaseInvoiceTemplate(options.templateCode)
  const bytes = await render(
    createPurchaseInvoiceTemplate({
      bill,
      buyer: options.buyer ?? null,
      template,
      watermarkText: options.watermarkText ?? null,
    }),
    {
      size: "a4",
      margin: { top: 28, right: 26, bottom: 28, left: 26 },
    }
  )
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)

  return buffer
}
