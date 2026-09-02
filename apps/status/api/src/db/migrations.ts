import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"

import { ensureStatusDatabaseExists, sql } from "./client.js"

type AppliedMigrationRow = {
  name: string
  checksum: string
  appliedAt?: Date
}

type MigrationFile = {
  name: string
  path: string
  checksum: string
  sqlText: string
}

type MigrationLogger = {
  info: (payload: Record<string, unknown>, message: string) => void
  warn: (payload: Record<string, unknown>, message: string) => void
  error: (payload: Record<string, unknown>, message: string) => void
}

const migrationsDirectory = fileURLToPath(new URL("../../drizzle/", import.meta.url))
const migrationLockId = 91_20_24_901

export async function runPendingStatusMigrations(logger = consoleMigrationLogger) {
  const startedAt = Date.now()
  const migrations = await readMigrationFiles()

  logger.info(
    {
      migrationsDirectory,
      filesDiscovered: migrations.length,
    },
    "status migration scan completed"
  )

  if (migrations.length === 0) {
    logger.warn({ migrationsDirectory }, "no status SQL migration files found")
    return
  }

  await ensureStatusDatabaseExists(logger)
  await sql`select pg_advisory_lock(${migrationLockId})`

  let appliedCount = 0
  let skippedCount = 0

  try {
    await ensureMigrationLedger()
    const appliedRows = await sql<AppliedMigrationRow[]>`
      select name, checksum, applied_at as "appliedAt"
      from public.gstfy_status_migrations
      order by name
    `
    const appliedMigrations = new Map(
      appliedRows.map((row) => [row.name, row.checksum])
    )

    for (const migration of migrations) {
      const appliedChecksum = appliedMigrations.get(migration.name)

      if (appliedChecksum) {
        if (appliedChecksum !== migration.checksum) {
          logger.error(
            {
              migration: migration.name,
              expectedChecksum: migration.checksum,
              appliedChecksum,
            },
            "status migration checksum mismatch"
          )
          throw new Error(
            `Status migration ${migration.name} was already applied with a different checksum.`
          )
        }

        skippedCount += 1
        continue
      }

      const migrationStartedAt = Date.now()
      await sql.unsafe(migration.sqlText)
      await sql`
        insert into public.gstfy_status_migrations (name, checksum)
        values (${migration.name}, ${migration.checksum})
      `
      appliedCount += 1

      logger.info(
        {
          migration: migration.name,
          durationMs: Date.now() - migrationStartedAt,
        },
        "status migration applied"
      )
    }

    logger.info(
      {
        filesDiscovered: migrations.length,
        appliedCount,
        skippedCount,
        durationMs: Date.now() - startedAt,
      },
      "status migration run completed"
    )
  } finally {
    await sql`select pg_advisory_unlock(${migrationLockId})`
  }
}

async function ensureMigrationLedger() {
  await sql`
    create table if not exists public.gstfy_status_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `
}

async function readMigrationFiles(): Promise<MigrationFile[]> {
  const entries = await readdir(migrationsDirectory, {
    withFileTypes: true,
  })

  const migrationNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  return Promise.all(
    migrationNames.map(async (name) => {
      const path = join(migrationsDirectory, name)
      const sqlText = await readFile(path, "utf8")

      return {
        name: basename(name),
        path,
        checksum: createHash("sha256").update(sqlText).digest("hex"),
        sqlText,
      }
    })
  )
}

const consoleMigrationLogger: MigrationLogger = {
  info: (payload, message) => {
    console.info(`[status-migrations] ${message}`, payload)
  },
  warn: (payload, message) => {
    console.warn(`[status-migrations] ${message}`, payload)
  },
  error: (payload, message) => {
    console.error(`[status-migrations] ${message}`, payload)
  },
}
