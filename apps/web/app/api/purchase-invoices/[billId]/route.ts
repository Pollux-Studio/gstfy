import { NextRequest, NextResponse } from "next/server"

import { API_BASE_PATH, API_BASE_URL } from "@/lib/api/config"
import type { PurchaseBillDetail } from "@/lib/purchases/api"
import { renderPurchaseInvoicePdf } from "@/lib/purchases/purchase-invoice-pdf"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ billId: string }> }
) {
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

  const backendResponse = await fetch(
    `${API_BASE_URL}${API_BASE_PATH}/purchase-bills/${encodeURIComponent(billId)}`,
    {
      cache: "no-store",
      headers: backendHeaders,
    }
  )

  if (!backendResponse.ok) {
    return NextResponse.json(
      { message: await getBackendErrorMessage(backendResponse) },
      { status: backendResponse.status }
    )
  }

  const payload = (await backendResponse.json()) as { bill: PurchaseBillDetail }
  const pdf = await renderPurchaseInvoicePdf(payload.bill)

  return new NextResponse(pdf, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${safeFileName(payload.bill.billNumber)}.pdf"`,
      "Content-Type": "application/pdf",
    },
  })
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
