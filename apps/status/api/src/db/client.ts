import postgres from "postgres"

import { getEnv } from "../config/env.js"

const env = getEnv()

export const sql = postgres(env.STATUS_DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {
    // PostgreSQL NOTICE messages from idempotent migrations are intentionally quiet.
  },
})

export async function closeStatusDatabase() {
  await sql.end({ timeout: 5 })
}

export async function ensureStatusDatabaseExists(logger = consoleDatabaseLogger) {
  if (!env.STATUS_CREATE_DATABASE_IF_MISSING) {
    return {
      checked: false,
      created: false,
      reason: "disabled",
    }
  }

  const databaseUrl = new URL(env.STATUS_DATABASE_URL)
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""))

  if (!databaseName || databaseName === "postgres" || databaseName === "template1") {
    return {
      checked: false,
      created: false,
      reason: "reserved-database",
    }
  }

  if (!isLocalPostgresHost(databaseUrl.hostname)) {
    return {
      checked: false,
      created: false,
      reason: "non-local-host",
    }
  }

  const maintenanceUrl = new URL(databaseUrl)
  maintenanceUrl.pathname = "/postgres"

  const maintenanceSql = postgres(maintenanceUrl.toString(), {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    onnotice: () => undefined,
  })

  try {
    const rows = await maintenanceSql<{ exists: boolean }[]>`
      select exists(
        select 1
        from pg_database
        where datname = ${databaseName}
      ) as exists
    `

    if (rows[0]?.exists) {
      return {
        checked: true,
        created: false,
        reason: "already-exists",
      }
    }

    await maintenanceSql`create database ${maintenanceSql(databaseName)}`
    logger.info(
      {
        databaseName,
      },
      "status database created"
    )

    return {
      checked: true,
      created: true,
      reason: "created",
    }
  } catch (error) {
    logger.error(
      {
        databaseName,
        err: error,
      },
      "status database bootstrap failed"
    )
    throw error
  } finally {
    await maintenanceSql.end({ timeout: 5 })
  }
}

function isLocalPostgresHost(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname)
}

const consoleDatabaseLogger = {
  info: (payload: Record<string, unknown>, message: string) => {
    console.info(`[status-db] ${message}`, payload)
  },
  error: (payload: Record<string, unknown>, message: string) => {
    console.error(`[status-db] ${message}`, payload)
  },
}
