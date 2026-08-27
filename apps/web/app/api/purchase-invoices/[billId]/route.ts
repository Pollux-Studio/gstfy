import { NextRequest, NextResponse } from "next/server"

import { API_BASE_PATH, API_BASE_URL } from "@/lib/api/config"
import { getCachedInvoiceLogoDataUrl } from "@/lib/invoices/logo-cache"
import type { PurchaseInvoiceTemplateCode } from "@/lib/invoices/templates/purchase"
import type { PurchaseBillDetail } from "@/lib/purchases/api"
import {
  renderPurchaseInvoicePdf,
  type PurchaseInvoiceBusinessInfo,
} from "@/lib/purchases/purchase-invoice-pdf"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ billId: string }> }
) {
  const routeStartedAt = performance.now()
  const { billId } = await context.params
  const authorization = request.headers.get("authorization")

  if (!authorization) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 })
  }

  const backendHeaders = new Headers({
    Authorization: authorization,
  })
  const tenantSlug =
    request.headers.get("x-gstfy-tenant") ?? getTenantSlugFromHost(request.headers.get("host"))
  const cookie = request.headers.get("cookie")

  if (tenantSlug) {
    backendHeaders.set("X-GSTFY-Tenant", tenantSlug)
  }

  if (cookie) {
    backendHeaders.set("Cookie", cookie)
  }

  const backendStartedAt = performance.now()
  const backendResponsePromise = fetch(
    `${API_BASE_URL}${API_BASE_PATH}/purchase-bills/${encodeURIComponent(billId)}/invoice`,
    {
      cache: "no-store",
      headers: backendHeaders,
    }
  ).then((response) => ({
    duration: performance.now() - backendStartedAt,
    response,
  }))
  const settingsStartedAt = performance.now()
  const renderSettingsPromise = getPurchaseInvoiceRenderSettings(backendHeaders).then(
    (settings) => ({
      duration: performance.now() - settingsStartedAt,
      settings,
    })
  )
  const [
    { duration: backendDuration, response: backendResponse },
    { duration: settingsDuration, settings: renderSettings },
  ] = await Promise.all([backendResponsePromise, renderSettingsPromise])

  if (!backendResponse.ok) {
    return NextResponse.json(
      { message: await getBackendErrorMessage(backendResponse) },
      { status: backendResponse.status }
    )
  }

  const payload = (await backendResponse.json()) as { bill: PurchaseBillDetail }
  const renderStartedAt = performance.now()
  const pdf = await renderPurchaseInvoicePdf(payload.bill, {
    buyer: renderSettings.buyer,
    templateCode: renderSettings.purchaseInvoiceTemplate,
    watermarkText: renderSettings.invoiceWatermarkText,
  })
  const renderDuration = performance.now() - renderStartedAt
  const totalDuration = performance.now() - routeStartedAt
  return new NextResponse(pdf, {
    headers: {
      "Cache-Control": "no-store, max-age=0, must-revalidate",
      "Content-Disposition": `inline; filename="${safeFileName(payload.bill.billNumber)}.pdf"`,
      "Content-Type": "application/pdf",
      "Server-Timing": [
        `backend;dur=${backendDuration.toFixed(1)}`,
        `settings;dur=${settingsDuration.toFixed(1)}`,
        `render;dur=${renderDuration.toFixed(1)}`,
        `total;dur=${totalDuration.toFixed(1)}`,
      ].join(", "),
      "Vary": "Authorization, Cookie, X-GSTFY-Tenant",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

async function getPurchaseInvoiceRenderSettings(headers: Headers): Promise<{
  buyer: PurchaseInvoiceBusinessInfo | null
  purchaseInvoiceTemplate: PurchaseInvoiceTemplateCode | null
  invoiceWatermarkText: string | null
}> {
  const settingsResponse = await fetch(`${API_BASE_URL}${API_BASE_PATH}/settings`, {
    cache: "no-store",
    headers,
  }).catch(() => null)

  if (!settingsResponse?.ok) {
    return {
      buyer: null,
      purchaseInvoiceTemplate: null,
      invoiceWatermarkText: null,
    }
  }

  const payload = (await settingsResponse.json()) as {
    business?: {
      legalName?: string | null
      tradeName?: string | null
    }
    registration?: {
      gstin?: string | null
      principalAddressLine1?: string | null
      principalAddressLine2?: string | null
      locality?: string | null
      district?: string | null
      pincode?: string | null
      stateCode?: string | null
    }
    invoiceSettings?: {
      invoiceTemplate?: PurchaseInvoiceTemplateCode | null
      purchaseInvoiceTemplate?: PurchaseInvoiceTemplateCode | null
      invoiceWatermarkText?: string | null
      logoUrl?: string | null
    }
  }
  const logoDataUrl = await getCachedInvoiceLogoDataUrl(payload.invoiceSettings?.logoUrl)

  return {
    buyer: {
      legalName: payload.business?.legalName,
      tradeName: payload.business?.tradeName,
      logoUrl: logoDataUrl,
      gstin: payload.registration?.gstin,
      addressLine1: payload.registration?.principalAddressLine1,
      addressLine2: payload.registration?.principalAddressLine2,
      locality: payload.registration?.locality,
      district: payload.registration?.district,
      pincode: payload.registration?.pincode,
      stateCode: payload.registration?.stateCode,
    },
    purchaseInvoiceTemplate:
      payload.invoiceSettings?.purchaseInvoiceTemplate ??
      payload.invoiceSettings?.invoiceTemplate ??
      null,
    invoiceWatermarkText: payload.invoiceSettings?.invoiceWatermarkText ?? null,
  }
}

async function getBackendErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { message?: unknown }
    return typeof payload.message === "string" ? payload.message : "Unable to download invoice."
  }

  return (await response.text()) || "Unable to download invoice."
}

function getTenantSlugFromHost(host: string | null) {
  if (!host) {
    return null
  }

  const hostname = host.split(":")[0]?.toLowerCase() ?? ""
  const [subdomain, ...domainParts] = hostname.split(".")
  const parentDomain = domainParts.join(".")

  if (
    !subdomain ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    (parentDomain !== "localhost" && domainParts.length < 2) ||
    ["api", "app", "auth", "ca", "www"].includes(subdomain)
  ) {
    return null
  }

  return /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(subdomain) ? subdomain : null
}

function safeFileName(value: string) {
  const sanitized = value
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()

  return sanitized ? `purchase-${sanitized}` : "purchase-invoice"
}
