import { render } from "takumi-pdf/next"

import {
  createSalesInvoiceTemplate,
  getSalesInvoiceTemplate,
  type SalesInvoiceBusinessInfo,
  type SalesInvoiceTemplateCode,
} from "@/lib/invoices/templates/sales"
import type { SalesInvoiceDetail } from "@/lib/sales/api"
import { createSignedQrDataUrl } from "@/lib/invoices/signed-qr"

export type { SalesInvoiceBusinessInfo }

export type RenderSalesInvoicePdfOptions = {
  seller?: SalesInvoiceBusinessInfo | null
  templateCode?: SalesInvoiceTemplateCode | null
  watermarkText?: string | null
}

export async function renderSalesInvoicePdf(
  invoice: SalesInvoiceDetail,
  options: RenderSalesInvoicePdfOptions = {}
) {
  const template = getSalesInvoiceTemplate(options.templateCode)
  const signedQrCodeDataUrl = await createSignedQrDataUrl(invoice.eInvoice?.signedQrCode)
  const bytes = await render(
    createSalesInvoiceTemplate({
      invoice,
      seller: options.seller ?? null,
      template,
      watermarkText: options.watermarkText ?? null,
      signedQrCodeDataUrl,
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
