import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import { getEnv } from "../config/env.js"
import * as schema from "./schema/index.js"

const env = getEnv()

export const sql = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {
    // PostgreSQL emits noisy NOTICE messages for idempotent migration statements
    // such as DROP TRIGGER IF EXISTS. Errors are still thrown normally.
  },
})

export const db = drizzle(sql, { schema })

export async function closeDatabase() {
  await sql.end({ timeout: 5 })
}
