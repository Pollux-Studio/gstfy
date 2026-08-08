import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { AppEnv } from "../config/env.js"

@Injectable()
export class SupabaseService {
  readonly publicClient: SupabaseClient
  readonly adminClient: SupabaseClient

  constructor(private readonly configService: ConfigService<AppEnv, true>) {
    const supabaseUrl = this.configService.get("SUPABASE_URL", { infer: true })
    const adminKey =
      this.configService.get("SUPABASE_SECRET_KEY", { infer: true }) ??
      this.configService.get("SUPABASE_SERVICE_ROLE_KEY", { infer: true })

    if (!adminKey) {
      throw new Error(
        "Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY for the backend admin client."
      )
    }

    const authOptions = {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }

    this.publicClient = createClient(
      supabaseUrl,
      this.configService.get("SUPABASE_PUBLISHABLE_KEY", { infer: true }),
      authOptions
    )

    this.adminClient = createClient(
      supabaseUrl,
      adminKey,
      authOptions
    )
  }
}
