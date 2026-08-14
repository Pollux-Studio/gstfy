import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"

import { sql } from "./client.js"

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

const migrationsDirectory = fileURLToPath(
  new URL("../../drizzle/", import.meta.url)
)
const migrationLockId = 91_20_24_001

export async function runPendingMigrations(logger = consoleMigrationLogger) {
  const startedAt = Date.now()
  const migrations = await readMigrationFiles()

  logger.info(
    {
      migrationsDirectory,
      filesDiscovered: migrations.length,
    },
    "migration scan completed"
  )

  if (migrations.length === 0) {
    logger.warn({ migrationsDirectory }, "no SQL migration files found")
    return
  }

  logger.info({ migrationLockId }, "acquiring migration advisory lock")
  await sql`select pg_advisory_lock(${migrationLockId})`

  let appliedCount = 0
  let skippedCount = 0

  try {
    await ensureMigrationLedger()
    const appliedRows = await sql<AppliedMigrationRow[]>`
      select name, checksum, applied_at as "appliedAt"
      from public.gstfy_migrations
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
            "migration checksum mismatch"
          )
          throw new Error(
            `Migration ${migration.name} was already applied with a different checksum.`
          )
        }

        skippedCount += 1
        logger.info(
          {
            migration: migration.name,
            checksum: migration.checksum,
          },
          "migration already applied"
        )
        continue
      }

      const migrationStartedAt = Date.now()
      logger.info(
        {
          migration: migration.name,
          checksum: migration.checksum,
          path: migration.path,
        },
        "applying migration"
      )
      await sql.unsafe(migration.sqlText)
      await sql`
        insert into public.gstfy_migrations (name, checksum)
        values (${migration.name}, ${migration.checksum})
      `
      appliedCount += 1
      logger.info(
        {
          migration: migration.name,
          durationMs: Date.now() - migrationStartedAt,
        },
        "migration applied"
      )
    }

    logger.info(
      {
        filesDiscovered: migrations.length,
        appliedCount,
        skippedCount,
        pendingCount: migrations.length - appliedCount - skippedCount,
        durationMs: Date.now() - startedAt,
      },
      "migration run completed"
    )
  } finally {
    await sql`select pg_advisory_unlock(${migrationLockId})`
    logger.info({ migrationLockId }, "migration advisory lock released")
  }
}

export async function getMigrationStatus() {
  const migrations = await readMigrationFiles()
  const ledgerRows = await sql<{ exists: boolean }[]>`
    select to_regclass('public.gstfy_migrations') is not null as exists
  `
  const ledgerExists = ledgerRows[0]?.exists ?? false
  const appliedRows =
    ledgerExists ?
      await sql<AppliedMigrationRow[]>`
        select name, checksum, applied_at as "appliedAt"
        from public.gstfy_migrations
        order by name
      `
    : []
  const appliedMigrations = new Map(appliedRows.map((row) => [row.name, row]))
  const migrationsWithStatus = migrations.map((migration) => {
    const appliedMigration = appliedMigrations.get(migration.name)
    const status =
      !appliedMigration ? "pending"
      : appliedMigration.checksum === migration.checksum ? "applied"
      : "checksum_mismatch"

    return {
      name: migration.name,
      checksum: migration.checksum,
      appliedChecksum: appliedMigration?.checksum ?? null,
      appliedAt: appliedMigration?.appliedAt ?? null,
      status,
    }
  })

  return {
    migrationsDirectory,
    ledgerExists,
    total: migrationsWithStatus.length,
    applied: migrationsWithStatus.filter((migration) => migration.status === "applied")
      .length,
    pending: migrationsWithStatus.filter((migration) => migration.status === "pending")
      .length,
    checksumMismatches: migrationsWithStatus.filter(
      (migration) => migration.status === "checksum_mismatch"
    ).length,
    migrations: migrationsWithStatus,
  }
}

async function ensureMigrationLedger() {
  await sql`
    create table if not exists public.gstfy_migrations (
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
    console.info(`[migrations] ${message}`, payload)
  },
  warn: (payload, message) => {
    console.warn(`[migrations] ${message}`, payload)
  },
  error: (payload, message) => {
    console.error(`[migrations] ${message}`, payload)
  },
}
