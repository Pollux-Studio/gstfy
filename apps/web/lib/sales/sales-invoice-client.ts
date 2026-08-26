import { getStoredAuthSession } from "@/lib/auth/session"

export type SalesInvoicePdfFile = {
  blob: Blob
  fileName: string
}

type FetchSalesInvoicePdfOptions = {
  force?: boolean
}

type CachedSalesInvoicePdf = {
  expiresAt: number
  promise: Promise<SalesInvoicePdfFile>
}

const PDF_CACHE_TTL_MS = 0
const salesInvoicePdfCache = new Map<string, CachedSalesInvoicePdf>()

export async function fetchSalesInvoicePdf(
  accessToken: string,
  invoiceId: string,
  options: FetchSalesInvoicePdfOptions = {}
): Promise<SalesInvoicePdfFile> {
  const tenantSlug = getTenantSlugForDownload()
  const cacheKey = getSalesInvoicePdfCacheKey(accessToken, tenantSlug, invoiceId)
  const cached = salesInvoicePdfCache.get(cacheKey)

  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return cached.promise
  }

  if (cached) {
    salesInvoicePdfCache.delete(cacheKey)
  }

  const promise = fetchSalesInvoicePdfFromServer(accessToken, invoiceId, tenantSlug, options)
  salesInvoicePdfCache.set(cacheKey, {
    expiresAt: Date.now() + PDF_CACHE_TTL_MS,
    promise,
  })

  try {
    return await promise
  } catch (error) {
    salesInvoicePdfCache.delete(cacheKey)
    throw error
  }
}

export function clearSalesInvoicePdfCache(accessToken: string, invoiceId: string) {
  salesInvoicePdfCache.delete(
    getSalesInvoicePdfCacheKey(accessToken, getTenantSlugForDownload(), invoiceId)
  )
}

async function fetchSalesInvoicePdfFromServer(
  accessToken: string,
  invoiceId: string,
  tenantSlug: string | null,
  options: FetchSalesInvoicePdfOptions
): Promise<SalesInvoicePdfFile> {
  const headers = new Headers()

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`)
  }

  if (tenantSlug) {
    headers.set("X-GSTFY-Tenant", tenantSlug)
  }

  const url =
    options.force ?
      `/api/sales-invoices/${encodeURIComponent(invoiceId)}?refresh=${Date.now()}`
    : `/api/sales-invoices/${encodeURIComponent(invoiceId)}`
  const response = await fetch(url, {
    cache: options.force ? "reload" : "default",
    credentials: "include",
    headers,
  })

  if (!response.ok) {
    throw new Error(await extractDownloadError(response))
  }

  return {
    blob: await response.blob(),
    fileName: getDownloadFileName(response, `sales-${invoiceId}.pdf`),
  }
}

function getSalesInvoicePdfCacheKey(
  accessToken: string,
  tenantSlug: string | null,
  invoiceId: string
) {
  return `${tenantSlug ?? "default"}:${fingerprint(accessToken)}:${invoiceId}`
}

function fingerprint(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }

  return Math.abs(hash).toString(36)
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function getTenantSlugForDownload() {
  const storedTenant = getStoredAuthSession()?.tenant?.slug

  if (storedTenant) {
    return storedTenant
  }

  const hostname = window.location.hostname.toLowerCase()
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

function getDownloadFileName(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") ?? ""
  const match = /filename="([^"]+)"/i.exec(disposition)
  return match?.[1] ?? fallback
}

async function extractDownloadError(response: Response) {
  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { message?: unknown }
    return typeof payload.message === "string" ? payload.message : "Unable to download invoice."
  }

  return (await response.text()) || "Unable to download invoice."
}
