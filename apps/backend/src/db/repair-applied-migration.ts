import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"

import { closeDatabase, sql } from "./client.js"

type MigrationLedgerRow = {
  name: string
  checksum: string
}

const repairableMigrations = new Set([
  "0034_payment_receipt_hardening.sql",
  "0035_payment_receipt_production_guards.sql",
  "0053_e_invoice_engine.sql",
])
const migrationsDirectory = fileURLToPath(
  new URL("../../drizzle/", import.meta.url)
)

const migrationName = basename(process.argv[2] ?? "")

if (!repairableMigrations.has(migrationName)) {
  console.error(
    `Refusing to repair "${migrationName || "<missing>"}". Allowed migrations: ${[
      ...repairableMigrations,
    ].join(", ")}`
  )
  process.exitCode = 1
} else {
  await repairAppliedMigration(migrationName)
}

async function repairAppliedMigration(name: string) {
  try {
    const migrationPath = join(migrationsDirectory, name)
    const sqlText = await readFile(migrationPath, "utf8")
    const checksum = createHash("sha256").update(sqlText).digest("hex")
    const rows = await sql<MigrationLedgerRow[]>`
      select name, checksum
      from public.gstfy_migrations
      where name = ${name}
    `
    const ledgerRow = rows[0]

    if (!ledgerRow) {
      throw new Error(
        `Migration ${name} is not applied yet. Start the backend normally instead.`
      )
    }

    if (ledgerRow.checksum === checksum) {
      console.info(`[migrations] ${name} already matches the current checksum.`)
      return
    }

    await sql.begin(async (transaction) => {
      await transaction.unsafe(sqlText)
      await transaction`
        update public.gstfy_migrations
        set checksum = ${checksum}
        where name = ${name}
      `
    })

    console.info(
      `[migrations] repaired ${name}: replayed idempotent SQL and updated checksum.`
    )
  } finally {
    await closeDatabase()
  }
}
