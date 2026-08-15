const reservedWorkspaceSlugs = new Set([
  "api",
  "app",
  "auth",
  "admin",
  "www",
  "mail",
  "support",
  "gstfy",
])

export function createWorkspaceSlugPreview(input: string) {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)

  const normalized = slug.length >= 3 ? slug : "business"
  return reservedWorkspaceSlugs.has(normalized) ? `${normalized}-business` : normalized
}

export function getWorkspaceUrlPreview(workspaceSlug: string) {
  return buildSubdomainUrl(workspaceSlug)
}

export function getAuthSubdomainUrl(path = "") {
  return buildSubdomainUrl("auth", path)
}

export function appendPathToUrl(baseUrl: string, path: string) {
  const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`

  return trimmedBaseUrl ? `${trimmedBaseUrl}${normalizedPath}` : normalizedPath
}

function buildSubdomainUrl(subdomain: string, path = "") {
  if (typeof window === "undefined") {
    return path || ""
  }

  const { protocol, hostname, port } = window.location
  const normalizedPath = path.startsWith("/") || path.length === 0 ? path : `/${path}`
  const baseHost = getBaseHost(hostname)
  const portSuffix = port ? `:${port}` : ""

  return `${protocol}//${subdomain}.${baseHost}${portSuffix}${normalizedPath}`
}

function getBaseHost(hostname: string) {
  const normalizedHostname = hostname.toLowerCase()

  if (
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname.endsWith(".localhost")
  ) {
    return "localhost"
  }

  const labels = normalizedHostname.split(".").filter(Boolean)

  if (labels.length <= 2) {
    return normalizedHostname
  }

  return labels.slice(-2).join(".")
}
