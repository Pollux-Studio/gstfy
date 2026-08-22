import { getStoredAuthSession } from "@/lib/auth/session"

export type PurchaseInvoicePdfFile = {
  blob: Blob
  fileName: string
}

type FetchPurchaseInvoicePdfOptions = {
  force?: boolean
}

type CachedPurchaseInvoicePdf = {
  expiresAt: number
  promise: Promise<PurchaseInvoicePdfFile>
}

const PDF_CACHE_TTL_MS = 0
const purchaseInvoicePdfCache = new Map<string, CachedPurchaseInvoicePdf>()

export async function fetchPurchaseInvoicePdf(
  accessToken: string,
  billId: string,
  options: FetchPurchaseInvoicePdfOptions = {}
): Promise<PurchaseInvoicePdfFile> {
  const tenantSlug = getTenantSlugForDownload()
  const cacheKey = getPurchaseInvoicePdfCacheKey(accessToken, tenantSlug, billId)
  const cached = purchaseInvoicePdfCache.get(cacheKey)

  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return cached.promise
  }

  if (cached) {
    purchaseInvoicePdfCache.delete(cacheKey)
  }

  const promise = fetchPurchaseInvoicePdfFromServer(accessToken, billId, tenantSlug, options)
  purchaseInvoicePdfCache.set(cacheKey, {
    expiresAt: Date.now() + PDF_CACHE_TTL_MS,
    promise,
  })

  try {
    return await promise
  } catch (error) {
    purchaseInvoicePdfCache.delete(cacheKey)
    throw error
  }
}

export function clearPurchaseInvoicePdfCache(accessToken: string, billId: string) {
  purchaseInvoicePdfCache.delete(
    getPurchaseInvoicePdfCacheKey(accessToken, getTenantSlugForDownload(), billId)
  )
}

async function fetchPurchaseInvoicePdfFromServer(
  accessToken: string,
  billId: string,
  tenantSlug: string | null,
  options: FetchPurchaseInvoicePdfOptions
): Promise<PurchaseInvoicePdfFile> {
  const headers = new Headers()

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`)
  }

  if (tenantSlug) {
    headers.set("X-GSTFY-Tenant", tenantSlug)
  }

  const url =
    options.force ?
      `/api/purchase-invoices/${encodeURIComponent(billId)}?refresh=${Date.now()}`
    : `/api/purchase-invoices/${encodeURIComponent(billId)}`
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
    fileName: getDownloadFileName(response, `purchase-${billId}.pdf`),
  }
}

function getPurchaseInvoicePdfCacheKey(
  accessToken: string,
  tenantSlug: string | null,
  billId: string
) {
  return `${tenantSlug ?? "default"}:${fingerprint(accessToken)}:${billId}`
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
