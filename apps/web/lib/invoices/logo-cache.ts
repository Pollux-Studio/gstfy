import { Buffer } from "node:buffer"

const invoiceLogoMaxBytes = 2 * 1024 * 1024
const invoiceLogoCacheTtlMs = 1000 * 60 * 60 * 6
const invoiceLogoCacheMaxEntries = 100
const supportedInvoiceLogoTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
])

type CachedInvoiceLogo = {
  dataUrl: string
  expiresAt: number
}

const globalLogoCache = globalThis as typeof globalThis & {
  __gstfyInvoiceLogoCache?: Map<string, CachedInvoiceLogo>
}

function getInvoiceLogoCache() {
  globalLogoCache.__gstfyInvoiceLogoCache ??= new Map()
  return globalLogoCache.__gstfyInvoiceLogoCache
}

export async function getCachedInvoiceLogoDataUrl(logoUrl?: string | null) {
  const normalizedLogoUrl = logoUrl?.trim()

  if (!normalizedLogoUrl) {
    return null
  }

  const cache = getInvoiceLogoCache()
  const cachedLogo = cache.get(normalizedLogoUrl)
  const now = Date.now()

  if (cachedLogo && cachedLogo.expiresAt > now) {
    return cachedLogo.dataUrl
  }

  const response = await fetch(normalizedLogoUrl, {
    cache: "force-cache",
  }).catch(() => null)

  if (!response?.ok) {
    cache.delete(normalizedLogoUrl)
    return null
  }

  const contentType = normalizeContentType(response.headers.get("content-type"))

  if (!supportedInvoiceLogoTypes.has(contentType)) {
    cache.delete(normalizedLogoUrl)
    return null
  }

  const bytes = await response.arrayBuffer()

  if (bytes.byteLength > invoiceLogoMaxBytes) {
    cache.delete(normalizedLogoUrl)
    return null
  }

  const dataUrl = `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`

  cache.set(normalizedLogoUrl, {
    dataUrl,
    expiresAt: now + invoiceLogoCacheTtlMs,
  })
  trimInvoiceLogoCache(cache)

  return dataUrl
}

function normalizeContentType(value: string | null) {
  return value?.split(";")[0]?.trim().toLowerCase() ?? ""
}

function trimInvoiceLogoCache(cache: Map<string, CachedInvoiceLogo>) {
  if (cache.size <= invoiceLogoCacheMaxEntries) {
    return
  }

  const entriesToDelete = cache.size - invoiceLogoCacheMaxEntries
  let deleted = 0

  for (const key of cache.keys()) {
    cache.delete(key)
    deleted += 1

    if (deleted >= entriesToDelete) {
      return
    }
  }
}
