import { sql } from "../../db/client.js"
import type { ServiceHealth, ServiceStatus } from "./service-status.types.js"

const serviceDefinitions = [
  { key: "pos", label: "POS", tableName: "pos_sales" },
  { key: "sales", label: "Sales", tableName: "sales_invoices" },
  { key: "purchases", label: "Purchases", tableName: "purchase_bills" },
  { key: "inventory", label: "Inventory", tableName: "items" },
  { key: "warehouses", label: "Warehouses", tableName: "warehouses" },
  { key: "branches", label: "Branches", tableName: "business_branches" },
] as const

export async function getServiceHealth() {
  const checkedAt = new Date().toISOString()
  const databaseStartedAt = performance.now()

  try {
    await sql`select 1`
  } catch (error) {
    const database = createHealth(
      "database",
      "Database",
      "unavailable",
      Math.round(performance.now() - databaseStartedAt),
      getErrorMessage(error)
    )

    return {
      status: "unavailable" as const,
      checkedAt,
      services: [
        createHealth("api", "API", "operational", 0, null),
        database,
        ...serviceDefinitions.map((service) =>
          createHealth(
            service.key,
            service.label,
            "unavailable",
            null,
            "Waiting for database connectivity."
          )
        ),
      ],
    }
  }

  const moduleStartedAt = performance.now()
  let availableTables = new Set<string>()
  let tableCheckError: string | null = null

  try {
    availableTables = await getAvailableTables()
  } catch (error) {
    tableCheckError = getErrorMessage(error)
  }

  const moduleLatencyMs = Math.round(performance.now() - moduleStartedAt)
  const database = createHealth(
    "database",
    "Database",
    "operational",
    Math.round(performance.now() - databaseStartedAt),
    null
  )
  const services: ServiceHealth[] = [
    createHealth("api", "API", "operational", 0, null),
    database,
    ...serviceDefinitions.map((service) =>
      !tableCheckError && availableTables.has(service.tableName) ?
        createHealth(service.key, service.label, "operational", moduleLatencyMs, null)
      : createHealth(
          service.key,
          service.label,
          "unavailable",
          moduleLatencyMs,
          tableCheckError ?? "Required data storage is not available."
        )
    ),
  ]

  return {
    status: getOverallStatus(services),
    checkedAt,
    services,
  }
}

async function getAvailableTables() {
  const rows = await sql<{ tableName: string; available: boolean }[]>`
    select table_name as "tableName", to_regclass('public.' || table_name) is not null as available
    from unnest(array[
      'pos_sales',
      'sales_invoices',
      'purchase_bills',
      'items',
      'warehouses',
      'business_branches'
    ]::text[]) as tables(table_name)
  `

  return new Set(rows.filter((row) => row.available).map((row) => row.tableName))
}

function createHealth(
  key: string,
  label: string,
  status: ServiceStatus,
  latencyMs: number | null,
  message: string | null
): ServiceHealth {
  return { key, label, status, latencyMs, message }
}

function getOverallStatus(services: ServiceHealth[]): ServiceStatus {
  if (services.some((service) => service.status === "unavailable")) {
    return "unavailable"
  }

  return services.some((service) => service.status === "degraded") ?
    "degraded"
  : "operational"
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Database health check failed."
}
