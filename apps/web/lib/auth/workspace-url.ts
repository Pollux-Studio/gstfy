import {
  RESERVED_APP_SUBDOMAINS,
  getPublicSubdomainUrl,
} from "@/lib/api/config"

export function createWorkspaceSlugPreview(input: string) {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)

  const normalized = slug.length >= 3 ? slug : "business"
  return RESERVED_APP_SUBDOMAINS.has(normalized)
    ? `${normalized}-business`
    : normalized
}

export function getWorkspaceUrlPreview(workspaceSlug: string) {
  return buildSubdomainUrl(workspaceSlug)
}

export function getAuthSubdomainUrl(path = "") {
  return buildSubdomainUrl("auth", path)
}

export function getCaAppSubdomainUrl(path = "") {
  return buildSubdomainUrl("ca", path)
}

export function appendPathToUrl(baseUrl: string, path: string) {
  const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`

  return trimmedBaseUrl ? `${trimmedBaseUrl}${normalizedPath}` : normalizedPath
}

function buildSubdomainUrl(subdomain: string, path = "") {
  return getPublicSubdomainUrl(subdomain, path)
}
