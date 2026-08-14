import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"

import { sql } from "./client.js"

type AppliedMigrationRow = {
  name: string
  checksum: string
}

type MigrationFile = {
  name: string
  path: string
  checksum: string
  sqlText: string
}

const migrationsDirectory = fileURLToPath(
  new URL("../../drizzle/", import.meta.url)
)
const migrationLockId = 91_20_24_001

export async function runPendingMigrations() {
  const migrations = await readMigrationFiles()

  if (migrations.length === 0) {
    console.info("[migrations] no SQL migration files found")
    return
  }

  await sql`select pg_advisory_lock(${migrationLockId})`

  try {
    await ensureMigrationLedger()
    const appliedRows = await sql<AppliedMigrationRow[]>`
      select name, checksum
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
          throw new Error(
            `Migration ${migration.name} was already applied with a different checksum.`
          )
        }

        continue
      }

      await sql.unsafe(migration.sqlText)
      await sql`
        insert into public.gstfy_migrations (name, checksum)
        values (${migration.name}, ${migration.checksum})
      `
      console.info(`[migrations] applied ${migration.name}`)
    }
  } finally {
    await sql`select pg_advisory_unlock(${migrationLockId})`
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
