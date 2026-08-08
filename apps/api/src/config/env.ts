import { z } from "zod"

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_APP_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SUPABASE_JWKS_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
})

export type AppEnv = z.infer<typeof envSchema>

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config)

  if (!result.success) {
    throw new Error(`Invalid API environment: ${result.error.message}`)
  }

  if (!result.data.SUPABASE_SERVICE_ROLE_KEY && !result.data.SUPABASE_SECRET_KEY) {
    throw new Error(
      "Invalid API environment: set either SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY"
    )
  }

  return result.data
}
