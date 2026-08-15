const reservedSlugs = new Set([
  "api",
  "app",
  "auth",
  "ca",
  "admin",
  "www",
  "mail",
  "support",
  "gstfy",
])

export function createTenantSlug(input: string) {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)

  const normalized = slug.length >= 3 ? slug : "business"
  return reservedSlugs.has(normalized) ? `${normalized}-business` : normalized
}
