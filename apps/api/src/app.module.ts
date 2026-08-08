import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"

import { AuthModule } from "./auth/auth.module.js"
import { validateEnv } from "./config/env.js"
import { DatabaseModule } from "./database/database.module.js"
import { HealthController } from "./health.controller.js"
import { OnboardingModule } from "./onboarding/onboarding.module.js"
import { SupabaseModule } from "./supabase/supabase.module.js"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    DatabaseModule,
    SupabaseModule,
    AuthModule,
    OnboardingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
